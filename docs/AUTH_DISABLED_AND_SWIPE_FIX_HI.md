# Login "not connected" and purple swipe-arrow fix

## Root cause found in the source
The previous Cloudflare Worker treated `SUPABASE_SERVICE_ROLE_KEY` as a prerequisite for `authEnabled`. That key is a privileged server-only key and is not required for ordinary Supabase email/password/OTP authentication. As a result, a valid Supabase project URL + public publishable key could still be reported as `authEnabled:false`.

## Code changes
- Browser authentication now resolves the supplied Supabase project URL and `sb_publishable_...` key directly. Local Vite development prefers this browser-safe configuration and does not wait for a Cloudflare `/api/config` route that Vite does not host.
- The Cloudflare Worker now reports `authEnabled` from the public project URL/key only. `serverDatabaseEnabled` separately reports whether the server-only service-role key exists.
- Authenticated user validation uses the public key. Basic `/api/me` returns the authenticated user's Free plan while server-side DB credentials are not configured.
- Service-role access remains required for private feedback writes, MSG91-to-Supabase identity bridging, payment tables and paid membership operations. The service-role key is never bundled into the browser.
- `.env.local` contains the Supabase URL and publishable public key already supplied by the owner. It is Git-ignored.

## Supabase Email OTP requirement
In Supabase Dashboard → Authentication → Providers → Email, enable Email. In Authentication → Email Templates, configure the OTP template to include `{{ .Token }}`. For production email delivery, configure a reliable SMTP sender under Authentication settings; the default sender has low/strict limits. Add `http://localhost:5173/account/` to Authentication → URL Configuration → Redirect URLs for local testing.

## Local run
From the project root (same directory as `package.json`):
```powershell
npm ci
npm run dev
```
Restart Vite after changing `.env.local`. This project also includes a browser-safe fallback key so the account page does not silently disable itself when Vite env loading is absent.

## Cloudflare production
The Worker includes only the public project URL and publishable key as safe fallback values, so email OTP can initialise even before database admin setup. For private database features, set `SUPABASE_SERVICE_ROLE_KEY` as a Cloudflare Worker **secret**. Keep `SUPABASE_URL` and `SUPABASE_ANON_KEY` as Worker variables if you prefer configuration in the dashboard. Never place the service-role key in `.env.local`, `VITE_` variables, GitHub or browser code.

## Purple arrow
The site source contains no large purple navigation-arrow element or cursor asset. The screenshot shape matches a browser/OS horizontal back-forward swipe gesture overlay. Added `overscroll-behavior-x: none` to the document and workspace to prevent horizontal overscroll navigation in browsers that honour this CSS setting. If it still appears, disable the browser's swipe-navigation/touchpad gesture or relevant extension; browser chrome overlays are not part of website DOM and cannot be styled away.
