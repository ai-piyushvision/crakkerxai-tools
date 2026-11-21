-- Unify email OTP and MSG91 SMS/WhatsApp identities on one Supabase auth.users row.
-- Existing synthetic mobile-only accounts can be merged into a verified email account
-- only after the user proves both the email (Supabase OTP) and the phone (MSG91 OTP).
BEGIN;

CREATE TABLE IF NOT EXISTS public.msg91_pending_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  phone_e164 text NOT NULL,
  full_name text,
  channel text NOT NULL CHECK (channel IN ('sms','whatsapp')),
  proof_sha256 char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '20 minutes'),
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT msg91_pending_email_format CHECK (email = lower(email) AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  CONSTRAINT msg91_pending_phone_format CHECK (phone_e164 ~ '^[+]91[6-9][0-9]{9}$'),
  CONSTRAINT msg91_pending_proof_format CHECK (proof_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS msg91_pending_signups_expiry_idx ON public.msg91_pending_signups(expires_at);
ALTER TABLE public.msg91_pending_signups ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.msg91_pending_signups FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.msg91_pending_signups TO service_role;

CREATE OR REPLACE FUNCTION public.link_verified_msg91_phone(
  p_pending_signup_id uuid,
  p_auth_user_id uuid,
  p_verified_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_pending public.msg91_pending_signups%ROWTYPE;
  v_target auth.users%ROWTYPE;
  v_old auth.users%ROWTYPE;
  v_existing_user_id uuid;
  v_target_phone text;
  v_merged boolean := false;
BEGIN
  SELECT * INTO v_target
  FROM auth.users
  WHERE id = p_auth_user_id
  FOR UPDATE;
  IF NOT FOUND OR v_target.email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'VERIFIED_EMAIL_SESSION_REQUIRED';
  END IF;
  IF lower(coalesce(v_target.email,'')) <> lower(coalesce(p_verified_email,'')) THEN
    RAISE EXCEPTION 'VERIFIED_EMAIL_MISMATCH';
  END IF;

  SELECT * INTO v_pending
  FROM public.msg91_pending_signups
  WHERE id = p_pending_signup_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PHONE_LINK_REQUEST_NOT_FOUND';
  END IF;
  IF lower(v_pending.email) <> lower(v_target.email) THEN
    RAISE EXCEPTION 'PHONE_LINK_EMAIL_MISMATCH';
  END IF;
  IF v_pending.expires_at <= now() THEN
    RAISE EXCEPTION 'PHONE_LINK_REQUEST_EXPIRED';
  END IF;

  -- Idempotent retry after an interrupted response.
  SELECT auth_user_id INTO v_existing_user_id
  FROM public.msg91_phone_identities
  WHERE phone_e164 = v_pending.phone_e164
  FOR UPDATE;
  IF v_pending.consumed_at IS NOT NULL THEN
    IF v_existing_user_id = p_auth_user_id THEN
      RETURN jsonb_build_object('linked', true, 'phone_e164', v_pending.phone_e164, 'merged_legacy_account', false);
    END IF;
    RAISE EXCEPTION 'PHONE_LINK_REQUEST_ALREADY_USED';
  END IF;

  SELECT phone_e164 INTO v_target_phone
  FROM public.msg91_phone_identities
  WHERE auth_user_id = p_auth_user_id
  LIMIT 1
  FOR UPDATE;
  IF v_target_phone IS NOT NULL AND v_target_phone <> v_pending.phone_e164 THEN
    RAISE EXCEPTION 'ACCOUNT_ALREADY_HAS_DIFFERENT_MOBILE';
  END IF;

  IF v_existing_user_id IS NOT NULL AND v_existing_user_id <> p_auth_user_id THEN
    SELECT * INTO v_old
    FROM auth.users
    WHERE id = v_existing_user_id
    FOR UPDATE;
    IF NOT FOUND
       OR coalesce(v_old.raw_user_meta_data ->> 'mobile_login','false') <> 'true'
       OR coalesce(v_old.email,'') !~* '^mobile-[0-9a-f]{32}@auth\.crakkerxai\.com$' THEN
      RAISE EXCEPTION 'PHONE_ALREADY_LINKED_TO_ANOTHER_ACCOUNT';
    END IF;

    -- The old row is a system-created mobile-only profile (not a real email account).
    -- Move its server-owned records to the email-verified account before deleting it.
    IF to_regclass('public.payment_orders') IS NOT NULL THEN
      EXECUTE 'UPDATE public.payment_orders SET user_id = $1 WHERE user_id = $2'
        USING p_auth_user_id, v_existing_user_id;
    END IF;
    IF to_regclass('public.memberships') IS NOT NULL THEN
      EXECUTE $merge_membership$
        INSERT INTO public.memberships(user_id, plan, expires_at, last_order_id, updated_at)
        SELECT $1, plan, expires_at, last_order_id, now()
        FROM public.memberships WHERE user_id = $2
        ON CONFLICT (user_id) DO UPDATE SET
          plan = CASE WHEN EXCLUDED.expires_at > memberships.expires_at THEN EXCLUDED.plan ELSE memberships.plan END,
          expires_at = GREATEST(memberships.expires_at, EXCLUDED.expires_at),
          last_order_id = CASE WHEN EXCLUDED.expires_at > memberships.expires_at THEN EXCLUDED.last_order_id ELSE memberships.last_order_id END,
          updated_at = now()
      $merge_membership$ USING p_auth_user_id, v_existing_user_id;
      EXECUTE 'DELETE FROM public.memberships WHERE user_id = $1' USING v_existing_user_id;
    END IF;
    IF to_regclass('public.conversion_usage') IS NOT NULL THEN
      EXECUTE $merge_usage$
        INSERT INTO public.conversion_usage(user_id, day, used)
        SELECT $1, day, used FROM public.conversion_usage WHERE user_id = $2
        ON CONFLICT (user_id, day) DO UPDATE
          SET used = public.conversion_usage.used + EXCLUDED.used
      $merge_usage$ USING p_auth_user_id, v_existing_user_id;
      EXECUTE 'DELETE FROM public.conversion_usage WHERE user_id = $1' USING v_existing_user_id;
    END IF;

    -- Preserve the old mobile profile's display name if the verified email
    -- account does not already have one.
    IF coalesce(v_target.raw_user_meta_data ->> 'full_name','') = ''
       AND coalesce(v_target.raw_user_meta_data ->> 'name','') = ''
       AND coalesce(v_old.raw_user_meta_data ->> 'full_name','') <> '' THEN
      UPDATE auth.users
      SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
        || jsonb_build_object('full_name', v_old.raw_user_meta_data ->> 'full_name')
      WHERE id = p_auth_user_id;
    END IF;

    UPDATE public.msg91_phone_identities
    SET auth_user_id = p_auth_user_id
    WHERE phone_e164 = v_pending.phone_e164;
    DELETE FROM auth.users WHERE id = v_existing_user_id;
    v_merged := true;
  ELSIF v_existing_user_id IS NULL THEN
    INSERT INTO public.msg91_phone_identities(phone_e164, auth_user_id)
    VALUES (v_pending.phone_e164, p_auth_user_id);
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object('phone_verified', true, 'linked_phone_e164', v_pending.phone_e164)
  WHERE id = p_auth_user_id;

  UPDATE public.msg91_pending_signups
  SET consumed_at = now()
  WHERE id = p_pending_signup_id;

  RETURN jsonb_build_object('linked', true, 'phone_e164', v_pending.phone_e164, 'merged_legacy_account', v_merged);
END;
$$;

REVOKE ALL ON FUNCTION public.link_verified_msg91_phone(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_verified_msg91_phone(uuid, uuid, text) TO service_role;

COMMIT;
