# Account / OTP local fix

This patch fixes an account-page startup error: the account initializer registered a click handler on `#otp-whatsapp`, but the generated account page did not contain that element. The null reference stopped initialization before the account configuration check completed, leaving `Checking account configuration…` visible indefinitely.

## Changes

- Added the missing **Resend via WhatsApp** action to the OTP verification panel. It is shown for the mobile OTP flow; MSG91 must be enabled for it to work.
- Made the WhatsApp event binding null-safe so a missing optional UI control cannot stop account initialization.
- Added a 5-second timeout to `/api/config` lookup so a local Vite-only run falls back to the `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` values instead of waiting forever.
- On account setup errors, hide the loading message and show the sign-in panel plus a readable error.
- Updated the page generator as well as generated HTML so `npm run prepare:pages` does not remove the WhatsApp control.

## Local run

Run these commands from the **project root** (`D:\Crakker.AI\crakkerxai-tools-main`), not from its parent folder:

```cmd
npm install
npm test
npm run dev
```

Open `http://localhost:5173/account/`.

## Real authentication requirements

The page can display the login methods without credentials, but real delivery/authentication needs provider configuration:

- Email OTP and password: configure Supabase and put the public project URL and anon/publishable key in `.env.local` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for local Vite testing.
- Mobile SMS and WhatsApp resend: configure the MSG91 widget and server-side MSG91/Supabase secrets in the Cloudflare Worker. The WhatsApp action appears after a mobile SMS OTP request. Do not put MSG91 AuthKey or Supabase service-role key in `.env.local`, frontend code, or GitHub.
- Google/GitHub: configure OAuth providers and redirect URLs in Supabase.

A Vite-only local server does not run the Cloudflare Worker API routes. Therefore the real mobile/WhatsApp OTP exchange must be tested against a configured Worker preview or deployed Worker, not just `npm run dev`.
