# Latest CrakkerXworld.AI update — 20 November 2026

## Changes in this package

1. **Google brand query signals:** homepage `<title>`, visible copy, Open Graph site name and Organization/WebSite JSON-LD now use the exact spaced name `Crakker X World` plus `CrakkerXworld.AI`. This helps align the official website content with the phrase people type into Google; it cannot guarantee a ranking or override Google's spelling correction.
2. **MSG91 mobile OTP configuration:** the Worker no longer requires the public Supabase URL and publishable key to be duplicated in Cloudflare variables when the repository's existing public defaults are used. It still requires `MSG91_AUTHKEY`, `MSG91_WIDGET_TOKEN` and `SUPABASE_SERVICE_ROLE_KEY`. If a different Supabase project is configured, its URL and public key must be supplied as a matching pair.
3. **Phone OTP account bridge:** verified first-time mobile signup provisions one Supabase Auth user plus a private phone mapping; returning OTP login reuses that mapping. The browser never receives the hidden alias email.
4. **Phone/password sign-in:** verified Indian `+91` mobile users can sign in with their mobile number and password.
5. **First password and 60-day policy:** OTP/social accounts without a password must set one before entering the workspace, then sign out and sign in again. Password updates are recorded by a database trigger. At 60 days or older, the user must refresh the password before workspace access.
6. **Legacy account rollout:** old password-change timestamps were not historically collected. The migration therefore requires each pre-existing account to refresh its password once to establish a reliable starting date. This is not a claim that every existing password is already 60 days old.
7. **Password recovery:** after completing a recovery-link password reset, the user is signed out and must sign in again with the new password.
8. **Privacy disclosure:** the Privacy Policy now explains password-change metadata storage and the initial/60-day password workflow.

## Required setup before live mobile OTP works

Apply in the same Supabase project, in this order:

1. `supabase/migrations/20261110_msg91_phone_auth.sql`
2. `supabase/migrations/20261120_account_password_policy.sql`

Set these Cloudflare Worker secrets:

```powershell
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put MSG91_AUTHKEY
npx wrangler secret put MSG91_WIDGET_TOKEN
```

Set `MSG91_WIDGET_ID` to the ID of the same MSG91 widget if it differs from the source default. The live website origin must be allowed in the MSG91 widget settings. Do not put any of these values in Git or browser `.env` files.

Then open `https://www.crakkerxai.com/api/config`. The expected flags are `authEnabled: true`, `serverDatabaseEnabled: true`, and `msg91Enabled: true`. Mobile OTP cannot work on the live site until those provider settings and migrations are in place.

Detailed deployment and end-to-end tests: `docs/PASSWORD_POLICY_SETUP_HI.md`.

## Validation performed in this environment

- `npm test`: 124 passed, 0 failed.
- JavaScript syntax checks: passed for account, Worker, MSG91 bridge and page generator.
- Page generation: 8 tool pages and 9 public information pages regenerated.
- Sitemap: valid XML, 19 URLs.
- Structured data: 47 JSON-LD blocks parsed across 19 generated pages.
- Production build: not verified because Vite is not installed in this environment (`vite: not found`). Run `npm ci` and `npm run build` locally before deployment.
- Live MSG91, Supabase and Google Search Console checks: not performed from this environment.
