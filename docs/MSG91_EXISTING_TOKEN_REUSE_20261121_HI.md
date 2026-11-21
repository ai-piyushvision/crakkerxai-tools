# MSG91 — existing CrakkerXOTP token reuse (no token generation)

## Current confirmed setup from screenshots

- Cloudflare already contains `MSG91_AUTHKEY`, `MSG91_WIDGET_TOKEN`, and `SUPABASE_SERVICE_ROLE_KEY`.
- MSG91 token list contains an enabled token named `CrakkerXOTP`.
- The existing MSG91 widget `SecureOTPWidgetCNWD` has Default Channel = WhatsApp and Retry Channels including SMS.
- The `/api/config` response previously pasted showed a token string different from the string visible in the current MSG91 token list. If that response is current, edit the existing Cloudflare secret `MSG91_WIDGET_TOKEN` and paste the current `CrakkerXOTP` token value. This reuses the current token; do not click Generate New Token.

## Why two widget IDs are needed

The site's current browser adapter calls MSG91 `sendOtp(phone)` for the initial delivery. It does not tell the SDK to choose a different primary channel for each call. The initial delivery channel comes from the widget's Default Channel. Therefore, the existing WhatsApp-primary widget can start OTP delivery on WhatsApp, but its SMS retry option is not the same as an SMS-first send.

To let the customer choose the first delivery channel:

1. Keep `SecureOTPWidgetCNWD` as the WhatsApp-primary widget.
2. Configure a second widget whose Default Channel is SMS.
3. For each widget, open Client Side Integration and copy the `widgetId` from its generated integration code.
4. In Client Side Integration, select the existing enabled `CrakkerXOTP` token for both widgets if the MSG91 UI permits. The updated Worker reuses `MSG91_WIDGET_TOKEN` for both channels, so separate channel token secrets are optional.
5. If MSG91 does not allow the same token to be selected for both widgets, stop and ask MSG91 support whether that existing account token can be attached to both widgets. Do not generate a new token unless MSG91 confirms reuse is impossible.

## Cloudflare settings

Open Cloudflare → Workers & Pages → `crakkerxai-tools` → Settings → Variables and Secrets.

Keep these existing Secrets:

- `MSG91_AUTHKEY`
- `MSG91_WIDGET_TOKEN` — existing `CrakkerXOTP` token (update this same secret only if its value does not match the current enabled token shown in MSG91)
- `SUPABASE_SERVICE_ROLE_KEY`

Add/update these Text variables with the exact widget IDs from MSG91 Client Side Integration:

- `MSG91_WHATSAPP_WIDGET_ID` — `SecureOTPWidgetCNWD` WhatsApp-primary widget ID
- `MSG91_SMS_WIDGET_ID` — second SMS-primary widget ID

Optional token overrides, not required when the shared token is accepted:

- `MSG91_SMS_WIDGET_TOKEN`
- `MSG91_WHATSAPP_WIDGET_TOKEN`

The Worker now uses the existing `MSG91_WIDGET_TOKEN` as a fallback for either channel. A channel-specific override takes precedence if configured.

## Domain restrictions

The supplied widget summary screenshot does not show a domain allowlist. Inspect the gear/settings action next to the `CrakkerXOTP` token and the widget's Settings / Client Side Integration screens. If a domain/origin allowlist is present, allow:

- `https://www.crakkerxai.com`
- `https://crakkerxai.com`

Do not assume the country allowlist (India) is a domain allowlist.

## Verify after deployment

The public `/api/config` response should include:

- `msg91SmsEnabled: true`
- `msg91WhatsappEnabled: true`

These values mean the Worker sees both widget IDs and has a usable token. They do not prove live delivery. Test SMS and WhatsApp separately with a number you control and confirm the first OTP arrives on the selected channel.

Email OTP is delivered by Supabase Auth and does not validate MSG91 credentials. A working email OTP therefore does not prove that the MSG91 widget/AuthKey pair is valid.
