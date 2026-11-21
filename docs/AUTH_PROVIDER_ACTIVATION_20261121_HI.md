# CrakkerXworld.AI — Mobile OTP, SMS/WhatsApp, Google and GitHub activation

This update changes the auth UI and routing code in the `crakkerxai-tools` project. It does not and cannot create MSG91 credentials or OAuth credentials in third-party dashboards.

## 1. MSG91: reuse the existing CrakkerXOTP token (no token regeneration)

The current MSG91 widget `SecureOTPWidgetCNWD` shown by the owner is **WhatsApp-primary**: its Default Channel is WhatsApp and SMS is listed only as a retry channel. It can serve an initial WhatsApp send. A true user choice where SMS is sent first also needs a second **SMS-primary** widget. Do not map the WhatsApp-primary widget ID as the SMS widget: `sendOtp(phone)` follows the widget's configured default channel.

The owner already has these Cloudflare secrets; keep them and do not create a replacement token:

- `MSG91_AUTHKEY` — existing server AuthKey.
- `MSG91_WIDGET_TOKEN` — existing enabled `CrakkerXOTP` Client Side Integration token. The updated Worker reuses this same token for both channels when channel-specific overrides are absent.
- `SUPABASE_SERVICE_ROLE_KEY` — existing Supabase server key.

No new token is required in the standard shared-token setup. Optional channel-specific overrides are only needed if MSG91 requires a different token for one widget:

- `MSG91_SMS_WIDGET_TOKEN` — optional override for SMS.
- `MSG91_WHATSAPP_WIDGET_TOKEN` — optional override for WhatsApp.

Add these **Text variables** in Cloudflare → Workers & Pages → `crakkerxai-tools` → Settings → Variables and Secrets:

- `MSG91_WHATSAPP_WIDGET_ID` — exact widget ID for the existing `SecureOTPWidgetCNWD` WhatsApp-primary widget.
- `MSG91_SMS_WIDGET_ID` — exact ID for a second widget configured with Default Channel = SMS.

Get each ID from that widget's **Client Side Integration** generated code (`widgetId`). The token on the `CrakkerXOTP` token management screen is not the widget ID. In the Client Side Integration page, select/reuse the existing enabled `CrakkerXOTP` token for each widget if MSG91 offers it. Do not click Generate New Token. If MSG91 does not allow that token to be associated with the second widget, pause and ask MSG91 support whether one enabled account token can be used for multiple widgets; do not guess or mix another account's token.

**Important credential correction:** The `/api/config` output previously pasted in chat showed a token string that did not match the token shown in the MSG91 token list screenshot. If that output is current, edit the existing Cloudflare secret `MSG91_WIDGET_TOKEN` and paste the current enabled `CrakkerXOTP` value from MSG91. This is an update to the existing secret, not token generation. Never paste token/AuthKey values into chat or screenshots.

The current widget screenshot shows Default Channel = WhatsApp, Retry Channels includes SMS. That does **not** make it SMS-primary. To deliver the first OTP by the user's selected channel, the SMS widget's default channel must be SMS and the WhatsApp widget's default channel must be WhatsApp.

In MSG91, open the token row's gear/settings action (next to `CrakkerXOTP`) and inspect any domain/origin restrictions. Allow the production site origins `https://www.crakkerxai.com` and `https://crakkerxai.com` if the token/widget settings expose an allowlist. Also check the widget's Settings / Client Side Integration pages for domain restrictions. The screenshot so far does not show the allowlist, so its current state is unverified.

After updating the existing secret and adding the two widget IDs, deploy the `crakkerxai-tools` Worker. The `/api/config` response should report `msg91SmsEnabled: true` and `msg91WhatsappEnabled: true`. These flags only confirm that configuration is present; live delivery must still be tested with real OTP sends.

## 2. Supabase Google OAuth

The supplied screenshot's response `Unsupported provider: provider is not enabled` means Google is disabled for the current Supabase project.

1. Open Supabase Dashboard → Authentication → Sign In / Providers → Google.
2. Enable Google and save the Google OAuth Client ID and Client Secret from the Google Cloud OAuth client.
3. In Google Cloud Console, add this exact Authorized redirect URI:
   `https://knhduwfwngrffnlxbnwt.supabase.co/auth/v1/callback`

## 3. Supabase GitHub OAuth

1. Open Supabase Dashboard → Authentication → Sign In / Providers → GitHub.
2. Enable GitHub and save the GitHub OAuth Client ID and Client Secret from the GitHub OAuth App.
3. In GitHub OAuth App settings, set Authorization callback URL to:
   `https://knhduwfwngrffnlxbnwt.supabase.co/auth/v1/callback`

Do not use the website URL as the provider callback. The provider callback belongs to the Supabase project.

## 4. Supabase redirect configuration

Supabase → Authentication → URL Configuration:

- Site URL: `https://www.crakkerxai.com`
- Redirect URL allowlist: `https://www.crakkerxai.com/account/`
- Also allow `https://crakkerxai.com/account/` if users can enter through the apex domain.

Ensure new-user signups are enabled if Google/GitHub first-time users should automatically create accounts. The app's OAuth buttons use the same OAuth flow for both login and signup; provider authorization decides whether the identity is existing or first-time.

## 5. Deploy source updates

Use the existing `crakkerxai-tools` Git repository only. Do not deploy this website code to `crakker-matrix-engine`.

```powershell
npm ci
npm test
npm run build
git add -A
git commit -m "Fix mobile OTP channel selection and OAuth provider guidance"
git push origin main
npx wrangler deploy
```

## 6. End-to-end test checklist

1. Visit `/account/` and choose Create account → Mobile OTP.
2. Select SMS and request a code. Confirm that the first code arrives by SMS.
3. Repeat with a test number / controlled test and select WhatsApp. Confirm the first code arrives in WhatsApp, not SMS.
4. Verify the OTP. Confirm a new phone identity is created once and a Supabase session is established.
5. Log out. Choose Log in → Mobile OTP with the same number. Verify and confirm the existing mapped identity is reused.
6. Test Google and GitHub only after each Supabase provider is enabled and its credentials/callback have been saved.
7. Confirm first-time OAuth users can be created if signups are enabled, and existing provider identities can sign in.

Automated code tests do not validate live MSG91 delivery, provider permissions, OAuth client credentials, or real account creation. Those require test transactions in the actual MSG91 and Supabase projects.
