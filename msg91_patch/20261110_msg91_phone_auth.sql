-- Minimal service-role-only records for MSG91 verified mobile identities and token replay prevention.
CREATE TABLE IF NOT EXISTS public.msg91_phone_identities (
  phone_e164 text PRIMARY KEY,
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT msg91_phone_india CHECK (phone_e164 ~ '^[+]91[6-9][0-9]{9}$')
);
CREATE TABLE IF NOT EXISTS public.msg91_otp_redemptions (
  token_sha256 char(64) PRIMARY KEY,
  phone_e164 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT msg91_proof_digest CHECK (token_sha256 ~ '^[a-f0-9]{64}$')
);
CREATE INDEX IF NOT EXISTS msg91_otp_redemptions_created_at ON public.msg91_otp_redemptions(created_at);
ALTER TABLE public.msg91_phone_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.msg91_otp_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.msg91_phone_identities FROM anon, authenticated;
REVOKE ALL ON public.msg91_otp_redemptions FROM anon, authenticated;
GRANT SELECT, INSERT ON public.msg91_phone_identities TO service_role;
GRANT SELECT, INSERT ON public.msg91_otp_redemptions TO service_role;
