# MSG91 Invalid Captcha Token – Repair Notes (21 Nov 2026)

## What was wrong in the website

`src/msg91-widget.js` initialized the MSG91 SDK with `captchaRenderId: 'msg91-captcha'`, but `account/index.html` did not contain an element with that ID. The MSG91 SDK therefore had no explicit CAPTCHA render target in the account form.

The repair adds a visible, non-hidden `<div id="msg91-captcha">` immediately before the Send OTP button. The browser adapter also creates this mount if an older/stale HTML page is served, and clears stale CAPTCHA markup when the user switches between SMS and WhatsApp widgets.

`Invalid Captcha Token` is now reported separately from `AuthenticationFailure`. The message explains that OTP generation was rejected at the CAPTCHA stage and that no OTP delivery log is expected until CAPTCHA validation succeeds.

## Why MSG91 OTP Widget Logs can show “Nothing Here”

The browser Network capture showed the widget process and `sendOtp` flow loading, followed by `Invalid Captcha Token`. This means the widget's CAPTCHA check rejected the attempt before an OTP was generated. An OTP delivery/transaction log may therefore not be created. An empty log alone does not prove that the browser never contacted MSG91.

## After deploying this repair

1. Deploy the updated `crakkerxai-tools` project and Worker.
2. Open the exact production account host used by customers. The supplied browser screenshot showed `https://crakkerxai.com/account/` (apex host, without `www`).
3. Hard-refresh the page, select WhatsApp, and send one test OTP.
4. Repeat with SMS.
5. Check OTP Widget/SDK → Logs after each test.

## If “Invalid Captcha Token” remains

The domain must be authorized by the CAPTCHA/widget configuration at MSG91. The screenshots supplied so far show Token settings with IP Security/Whitelisted IPs, but do not show a domain allowlist field. Do not change IP Security to solve a domain/CAPTCHA issue.

Ask MSG91 support to verify/rebind the CAPTCHA site-key/widget configuration for both widget IDs and allow both hostnames:

- `crakkerxai.com`
- `www.crakkerxai.com`

Provide the two widget names/IDs through MSG91's authenticated support channel:

- `SecureOTPWidgetTNI6` — SMS widget ID `366b7567324e363437333233`
- `SecureOTPWidgetCNWD` — WhatsApp widget ID `366b6a64745a343733373331`

Do not send the AuthKey or `tokenAuth` in an ordinary support ticket unless MSG91 explicitly requests them through a secure credential-sharing channel. Never expose them in browser code, screenshots, GitHub, or chat.

## Validation

The Node automated test suite passes after these changes. Actual CAPTCHA verification and OTP delivery still require a live MSG91 test after deployment; they cannot be simulated by local tests.
