# Authentication deployment notes — current configuration

## Supabase project configuration

The Worker already contains the current project's **public** Supabase URL and publishable key as fallbacks. Email OTP/password authentication does not require the service-role key. If you override either `SUPABASE_URL` or `SUPABASE_ANON_KEY`, configure both as a matching pair; a partial override is rejected to avoid using a URL from one project with a key from another.

The Worker `SUPABASE_SERVICE_ROLE_KEY` is a secret used only for private database operations, MSG91 account bridging, paid membership data. Never expose it in browser code, `VITE_` variables, `.env.local` or Git.

## MSG91 mobile OTP requirements

Mobile OTP is enabled only when all of these are present in the production Cloudflare Worker environment:
- `MSG91_AUTHKEY` — secret
- `MSG91_WIDGET_TOKEN` — secret stored in Worker settings, exposed to the browser only through the public `/api/config` response because it is the browser-scoped MSG91 widget token
- `SUPABASE_SERVICE_ROLE_KEY` — secret
- `MSG91_WIDGET_ID` — optional variable when the source default does not match the actual MSG91 widget

The known default public Supabase URL/key can be used without duplicating those values in Worker variables. If a different Supabase project is used, configure both the URL and matching public key.

Apply both SQL migrations in the same project:
1. `supabase/migrations/20261110_msg91_phone_auth.sql`
2. `supabase/migrations/20261120_account_password_policy.sql`

The MSG91 widget must be configured for the live site origin. Use `https://www.crakkerxai.com` and verify the widget ID/token/AuthKey belong to the same MSG91 account.

## Live configuration check

Open `https://www.crakkerxai.com/api/config`. The expected values are:
- `authEnabled: true`
- `serverDatabaseEnabled: true`
- `msg91Enabled: true`

If `msg91Enabled` is false, the browser will not be able to start mobile OTP. Check the Worker secrets and any custom Supabase URL/key override before testing the form.

## Mobile account lifecycle

A new MSG91-verified phone account is provisioned with a hidden email alias and a phone-identity mapping. The password-policy trigger marks accounts without a password as requiring initial password setup. The user sets a password, the app verifies the database timestamp, signs out, and asks the user to sign in again with the verified mobile number and password.

The Worker supports mobile/password login for verified Indian `+91` numbers. It resolves the private phone-to-user mapping server-side; the hidden alias is not shown in the browser UI.

Existing account password-change timestamps were not historically collected. The initial policy migration therefore asks all pre-existing accounts to refresh their password once, establishing a trustworthy timestamp. After that, the Worker blocks workspace access when the last password change is 60 days old or older.

## Test order

1. Check `/api/config` flags above.
2. Test a new phone number using Create account → Mobile OTP → Verify.
3. Confirm password setup appears, save a password, and confirm sign-out occurs.
4. Sign in with Password → Mobile number using the same number/password.
5. Sign out, then test mobile OTP Login against the existing phone mapping.
6. Test an old account and confirm the one-time rollout password update appears.
7. After a successful password update, verify the workspace loads and a refresh keeps the session.

Do not put OTPs, passwords, access tokens, refresh tokens or service-role keys in bug reports.


### Channel-specific MSG91 widgets

Configure `MSG91_SMS_WIDGET_ID` for an SMS-primary widget and `MSG91_WHATSAPP_WIDGET_ID` for a WhatsApp-primary widget. Keep the existing `MSG91_WIDGET_TOKEN` secret; the Worker can reuse it for both widgets unless a channel-specific token override is set. In MSG91 Client Side Integration, select the existing CrakkerXOTP token for each widget if the console permits it. Both widgets must belong to the same MSG91 account as `MSG91_AUTHKEY`, and both must allow the production origin. The existing SecureOTPWidgetCNWD shown by the owner is WhatsApp-primary, so create/configure an SMS-primary widget as well. Do not generate a new token unless MSG91 explicitly confirms the existing one cannot be reused. The site disables WhatsApp selection until the WhatsApp widget is configured; it does not silently route a WhatsApp selection through SMS.

### Google and GitHub OAuth

Supabase Authentication → Sign In / Providers must have Google and GitHub enabled with their provider-issued Client ID and Client Secret. Provider callback for this Supabase project: `https://knhduwfwngrffnlxbnwt.supabase.co/auth/v1/callback`. Supabase Site URL: `https://www.crakkerxai.com`; allow `https://www.crakkerxai.com/account/` and `https://crakkerxai.com/account/`. Code cannot enable providers or create OAuth client credentials.
