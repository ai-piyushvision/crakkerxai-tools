-- Per-user workspace preferences. Only the Cloudflare Worker service role can access these rows.
BEGIN;

CREATE TABLE IF NOT EXISTS public.account_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark','light')),
  font_size text NOT NULL DEFAULT 'normal' CHECK (font_size IN ('small','normal','large','extra-large')),
  notifications_security boolean NOT NULL DEFAULT true,
  notifications_product boolean NOT NULL DEFAULT true,
  notifications_email boolean NOT NULL DEFAULT true,
  location_enabled boolean NOT NULL DEFAULT false,
  reduced_motion boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_preferences_updated_at_idx
  ON public.account_preferences(updated_at DESC);
ALTER TABLE public.account_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.account_preferences FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.account_preferences TO service_role;

COMMIT;
