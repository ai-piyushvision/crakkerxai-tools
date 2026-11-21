# CrakkerXworld.AI — Mobile OTP Verification Repair (21 Nov 2026)

## What was wrong

1. The JavaScript OTP normalizer accepted 4–8 digits, but `account/index.html` still had HTML `pattern="[0-9]{6,8}"` and `minlength="6"`. A 4-digit WhatsApp OTP was therefore blocked by the browser before the submit handler ran.
2. The Worker hid mobile-auth exchange failures behind `Unable to complete this request. Please try again.` This made it impossible to tell whether MSG91 proof verification, phone identity lookup, Supabase account creation, session-link generation, or replay storage failed.
3. The same already-verified MSG91 code could be submitted again after the downstream session exchange failed, producing an `otp already verified` message.
4. Wrangler configuration did not explicitly enable Worker Observability logs/traces, matching the user's empty Cloudflare Observability view.

## Changes in this repair

- OTP input accepts 4–8 numeric digits to support the configured MSG91 widgets (4-digit WhatsApp and 6-digit SMS).
- Mobile OTP verify request sends the selected channel for safe diagnostics.
- After MSG91 verifies a code, if Supabase session exchange fails, the UI clears the consumed code and asks the user to request a fresh OTP instead of reusing it.
- `/api/auth/msg91` returns safe diagnostic fields: `code`, `stage`, and `requestId`.
- Worker logs emit `msg91_auth_flow_failed` with request ID, stage and non-secret diagnostic detail; no OTP, phone, access-token, AuthKey or widget token is logged.
- A successful mobile exchange logs `msg91_auth_flow_succeeded`.
- `wrangler.jsonc` enables Observability logs, invocation logs and traces.
- The Worker looks up a phone identity before consuming the one-time proof. A login attempt for a phone with no registered identity now returns `PHONE_ACCOUNT_NOT_FOUND` without burning the verified proof.

## Important account-linking note

An earlier account query for `ai.piyushsharma@gmail.com` showed `phone_e164 = NULL` in `msg91_phone_identities`. That means the email OTP account has no mobile identity mapping yet. A mobile OTP **Login** cannot automatically identify that email account from the phone number alone.

- If this is a first-time mobile account, use **Create account** in the mobile OTP form.
- If the phone number must sign in to the existing email account, first implement/use an explicit authenticated phone-linking flow. Do not silently create a second identity and assume it is the same account.

## Deploy

From the existing `crakkerxai-tools` repository:

```powershell
npm ci
npm test
npm run build
git add -A
git commit -m "Fix mobile OTP verification and Worker diagnostics"
git push origin main
npx wrangler deploy
```

No new MSG91 token or Supabase SQL migration is included in this repair.

## Verify after deployment

1. Test a 4-digit WhatsApp OTP and a 6-digit SMS OTP. Both should pass the browser's native form validation.
2. Open Cloudflare > Workers & Pages > `crakkerxai-tools` > Observability > Logs, start Live, then run one fresh OTP flow.
3. If account exchange still fails, the page should display a diagnostic code and request reference (for example `PHONE_ACCOUNT_NOT_FOUND` or `SUPABASE_LINK_REJECTED`).
4. Match that reference in Worker logs. Do not share OTPs, mobile numbers, Authorization headers, tokens or secrets.
