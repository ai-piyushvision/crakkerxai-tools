# Password login human check — 21 November 2026

Password login now displays a pool-table **Hold to confirm** interaction. The cue ball animates into the pocket after a sustained press. The same check is required for email+password and linked mobile+password sign-in. Email OTP, SMS OTP, WhatsApp OTP and OAuth flows are unchanged.

## Required Supabase migration

Run `supabase/migrations/20261121_password_human_challenges.sql` in the same Supabase project used by the production Worker. The table has RLS enabled, browser roles have no permissions, and only the Worker service role can create, consume and clean up challenges.

## Deployment

1. Merge the full project into the existing `crakkerxai-tools` repository; preserve `.git` and production secrets.
2. Run `npm ci`, `npm test`, and `npm run build`.
3. Apply the SQL migration above in production Supabase.
4. Push the changes and deploy the `crakkerxai-tools` Worker.
5. Test email-password and mobile-password sign-in on desktop and mobile.

## Security note

The pool hold is a lightweight interaction/anti-replay check: its challenge is short-lived, one-time, IP-bound, and stored server-side. A custom hold interaction is not as strong as a managed CAPTCHA such as Cloudflare Turnstile or hCaptcha against sophisticated automation. For high-risk public endpoints, retain rate limits and consider adding a managed CAPTCHA alongside this interaction. Do not disable Supabase authentication or expose the service-role key.

## Password-login flow

The control is shown only for password-based login (email+password or linked mobile+password). Users press and hold the green pool table for 1.6 seconds; the cue ball rolls into the pocket and the status changes to Verified. A fresh challenge is required after each login attempt, including a wrong password. OTP and Google/GitHub flows do not show this control.

The Worker validates the challenge ID, expiry, client IP hash, minimum server-side age, hold duration and one-time consumption before it calls Supabase Password Auth and returns a session. The challenge table is not accessible to `anon` or `authenticated` roles.
