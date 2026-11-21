-- Enforce first password setup and a 60-day password-age policy.
-- Existing accounts are marked for one-time password setup because historical
-- password-change timestamps were not previously stored by this application.
BEGIN;

CREATE TABLE IF NOT EXISTS public.account_password_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  password_changed_at timestamptz,
  password_setup_required boolean NOT NULL DEFAULT true,
  password_setup_reason text NOT NULL DEFAULT 'initial_setup',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep this migration safe to re-run if an earlier draft created the table.
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS password_setup_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS password_setup_reason text NOT NULL DEFAULT 'initial_setup';
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  ALTER TABLE public.account_password_security
    ADD CONSTRAINT account_password_security_reason_check
    CHECK (password_setup_reason IN ('initial_setup','legacy_rollout','completed'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

ALTER TABLE public.account_password_security ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_password_security FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_password_security TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_password_security TO service_role;

-- Authenticated users may read their own password-policy row only. Writes remain
-- service-role/trigger-only, so clients cannot change their password age/status.
DROP POLICY IF EXISTS account_password_security_select_own ON public.account_password_security;
CREATE POLICY account_password_security_select_own
  ON public.account_password_security
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Exact historical password age is unavailable for accounts created before
-- this policy existed. Require one password refresh once to establish a baseline.
INSERT INTO public.account_password_security(user_id, password_changed_at, password_setup_required, password_setup_reason)
SELECT
  id,
  NULL,
  TRUE,
  CASE
    WHEN COALESCE(encrypted_password, '') = '' THEN 'initial_setup'
    ELSE 'legacy_rollout'
  END
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Correct rows created by an earlier draft of this migration. Existing accounts
-- without an encrypted password are first-time setup, not an old-password change.
UPDATE public.account_password_security AS security
SET password_setup_reason = CASE
      WHEN COALESCE(auth_user.encrypted_password, '') = '' THEN 'initial_setup'
      ELSE 'legacy_rollout'
    END,
    password_setup_required = TRUE,
    updated_at = now()
FROM auth.users AS auth_user
WHERE security.user_id = auth_user.id
  AND security.password_changed_at IS NULL
  AND security.password_setup_required = TRUE
  AND security.password_setup_reason IN ('initial_setup', 'legacy_rollout');

CREATE OR REPLACE FUNCTION public.capture_auth_password_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  has_password boolean;
BEGIN
  has_password := COALESCE(NEW.encrypted_password, '') <> '';

  IF TG_OP = 'INSERT' THEN
    -- Accounts created without a password (including OTP and social signups)
    -- must set one and then sign in with that password. A direct password signup
    -- already has a password, so its change date is recorded immediately.
    INSERT INTO public.account_password_security(user_id, password_changed_at, password_setup_required, password_setup_reason, updated_at)
    VALUES (
      NEW.id,
      CASE WHEN has_password THEN now() ELSE NULL END,
      NOT has_password,
      CASE WHEN has_password THEN 'completed' ELSE 'initial_setup' END,
      now()
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
  END IF;

  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    INSERT INTO public.account_password_security(user_id, password_changed_at, password_setup_required, password_setup_reason, updated_at)
    VALUES (
      NEW.id,
      CASE WHEN has_password THEN now() ELSE NULL END,
      NOT has_password,
      CASE WHEN has_password THEN 'completed' ELSE 'initial_setup' END,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET password_changed_at = EXCLUDED.password_changed_at,
          password_setup_required = EXCLUDED.password_setup_required,
          password_setup_reason = EXCLUDED.password_setup_reason,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auth_user_password_security_insert ON auth.users;
CREATE TRIGGER auth_user_password_security_insert
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.capture_auth_password_change();

DROP TRIGGER IF EXISTS auth_user_password_security_update ON auth.users;
CREATE TRIGGER auth_user_password_security_update
AFTER UPDATE OF encrypted_password ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.capture_auth_password_change();

COMMIT;
