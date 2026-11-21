# Supabase configuration — CrakkerXworld.AI Conversion

## Local environment
The supplied `.env.local` is prefilled with the Supabase project URL and browser-safe publishable key provided by the project owner. The client also has a browser-safe fallback for this same public project configuration; no service-role key is needed to initialize Email OTP or password login.

Do not add a Supabase secret/service-role key to `.env.local` or any `VITE_` variable. VITE variables are visible to browser users.

## Start locally
From the project root, with Node.js 20.19+:
```powershell
npm ci
npm run dev
```
Vite loads `.env.local` automatically. Restart Vite after changing it.

## Supabase Dashboard setup
In Supabase:
1. Authentication → Providers → enable Email.
2. Authentication → URL Configuration → add `http://localhost:5173/**` (or the exact localhost callback URL) to allowed redirect URLs.
3. Configure the email OTP template/provider. The Supabase default email sender has strict rate limits; production email delivery generally requires configuring SMTP.
4. For Google/GitHub sign-in, configure each OAuth provider's client credentials and callback URLs in Supabase. Buttons do not become operational merely by enabling Supabase.
5. Apply `supabase/schema.sql` in SQL Editor for the full database schema, or apply only the individual migrations appropriate to the environment. Do not run overlapping schema and migrations blindly on an existing production database.

## Authentication behaviour
- Local frontend can initialize Supabase Auth using the publishable key.
- Email OTP/password auth uses Supabase Auth directly.
- Mobile OTP still requires the existing Cloudflare Worker plus MSG91 AuthKey, widget token, Supabase service-role secret and the `20261110_msg91_phone_auth.sql` migration. Private feedback writes and paid membership data also require the service-role secret.
- Payments and Worker-only API routes remain disabled locally unless the Worker is running and configured.

## Feedback submissions
Feedback is stored by the existing Cloudflare Worker in `public.feedback_submissions` using the server-side Supabase service-role key. Do not expose that key in the browser. Local feedback submission will need the Worker/API backend running; the Supabase browser key alone intentionally cannot insert into this protected table.

## Verify
Open the browser developer console and check for Supabase Auth errors. Confirm the Supabase project URL and public key match the project selected in the dashboard. Never share secret/service-role keys, SMTP passwords, MSG91 auth keys, or OTPs.
