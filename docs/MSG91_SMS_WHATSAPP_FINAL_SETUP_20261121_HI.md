# MSG91 SMS + WhatsApp setup for CrakkerXworld.AI (existing token)

## What the current screenshots confirm

- Cloudflare already contains Secrets: `MSG91_AUTHKEY`, `MSG91_WIDGET_TOKEN`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep them; do not generate a new token.
- MSG91 widget `SecureOTPWidgetCNWD` is WhatsApp-primary; SMS is currently only a retry channel.
- The app intentionally requires a separate SMS-primary widget ID and a WhatsApp-primary widget ID so the selected channel receives the first OTP. It must not send on WhatsApp first and then retry SMS.
- The widget summary shows OTP Length = 4 digits. This update now accepts 4–8 digit codes; no need to change the widget's OTP length just for the client validator.

## Step 1 — Get the existing WhatsApp widget ID

1. MSG91 Dashboard → OTP Widget → `SecureOTPWidgetCNWD`.
2. Open **Client Side Integration**.
3. Find the generated configuration values `widgetId` and `tokenAuth`.
4. Use the `widgetId` for the WhatsApp widget. Do not share/copy `tokenAuth` into chat.
5. The user previously pasted an older `/api/config` response containing candidate ID `366b6a673331`. Compare it with the current Client Side Integration code before using it; do not assume it is still correct.

## Step 2 — Configure an SMS-primary widget

1. MSG91 → OTP Widget → create a second widget (for example `CrakkerXworldSMS`).
2. Set **Default Channel = SMS**.
3. Keep India allowed; use the same phone identifier format.
4. Open Client Side Integration and copy the second widget's `widgetId`.
5. If MSG91 permits selecting the current enabled `CrakkerXOTP` token for this widget too, reuse it. Do not click Generate New Token.
6. If the same token cannot be attached to both widgets, stop and ask MSG91 support whether the existing account token can be shared across these two OTP widgets.

## Step 3 — Cloudflare variables

Cloudflare → Workers & Pages → `crakkerxai-tools` → Settings → Variables and Secrets → Production.

Keep these existing Secrets (already visible in the owner's screenshot):

- `MSG91_AUTHKEY` — server-side account AuthKey.
- `MSG91_WIDGET_TOKEN` — enabled `CrakkerXOTP` token. This is used as the fallback client token for both widgets.
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase server-side key.

Add these **Text** variables (not Secrets):

- `MSG91_WHATSAPP_WIDGET_ID` = exact ID from `SecureOTPWidgetCNWD` Client Side Integration.
- `MSG91_SMS_WIDGET_ID` = exact ID from the new SMS-primary widget Client Side Integration.

Do not add channel-specific token Secrets unless MSG91 issues different tokens or the shared token does not authenticate both widgets. The code already falls back to existing `MSG91_WIDGET_TOKEN` for both channel token slots.

## Step 4 — Domain permission

In MSG91, inspect the gear/settings action for the `CrakkerXOTP` token and the widget's settings. If MSG91 provides an allowed-domain/origin setting, add both:

- `https://www.crakkerxai.com`
- `https://crakkerxai.com`

The country allowlist (India) is not a domain allowlist.

## Step 5 — Deploy and verify

Deploy the Worker after adding the two IDs. Open `https://www.crakkerxai.com/api/config` and verify:

- `msg91SmsEnabled: true`
- `msg91WhatsappEnabled: true`

Those flags only confirm Worker configuration is complete; they do not prove provider delivery. Test with your own number: select SMS and confirm the first OTP arrives by SMS; then select WhatsApp and confirm the first OTP arrives by WhatsApp.

## Why this needs two widget IDs

The browser adapter calls MSG91 `sendOtp(phone)` for the initial send. MSG91 uses the selected widget's configured default channel. The existing `SecureOTPWidgetCNWD` widget is WhatsApp-primary, and its SMS retry option does not make it SMS-primary. A second SMS-primary widget is required to ensure only the selected first-delivery channel is triggered.

## OTP length compatibility

The supplied widget screenshot shows a 4-digit OTP. The app input and validator now accept 4–8 digits to match the current provider configuration while retaining 6–8 digit compatibility.
