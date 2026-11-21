-- Apply this only when account_password_security already exists.
-- It allows a signed-in user to read their own policy row; it does not grant writes.
DO $$
BEGIN
  IF to_regclass('public.account_password_security') IS NULL THEN
    RAISE EXCEPTION 'Table public.account_password_security does not exist. Run supabase/migrations/20261120_account_password_policy.sql first.';
  END IF;
END;
$$;

ALTER TABLE public.account_password_security ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_password_security FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_password_security TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_password_security TO service_role;

DROP POLICY IF EXISTS account_password_security_select_own ON public.account_password_security;
CREATE POLICY account_password_security_select_own
  ON public.account_password_security
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
