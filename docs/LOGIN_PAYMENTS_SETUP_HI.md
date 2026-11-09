# CrakkerXworld.AI — Login, Signup, Pricing and Razorpay Setup (Hinglish)

**Is version mein existing 8 tools aur AdSense publisher ID preserved hain.** Free tools bina login ke open hote hain. Account ke liye Supabase; paid membership ke liye server-side Razorpay Checkout + Cloudflare Worker + Supabase SQL use hota hai.

## 0. Pehle testing, live charges baad mein

- Pricing: Free ₹0, Normal ₹79, Plus ₹149, Pro ₹299, Ultra ₹599.
- Paid plans **one-time 30-day pass** hain, auto-debit ya auto-renewal nahi.
- Yeh prices public proposal hain; GST agar legally applicable ho tabhi included tax account karo. GST registration ke bina GST collect/invoice mat karo.
- Checkout by default **OFF** (`PAYMENTS_ENABLED` missing or not `true`). Fake/demo payment recording nahi hai.
- User ka bank/card data website par collect nahi hota. Razorpay hosted Checkout se payment hoti hai.
- Server payment verification HMAC-SHA256 + Razorpay payment capture + stored order/amount match karta hai.
- `supabase/schema.sql` mein Postgres tables, RLS and security-definer functions hain.

## 1. Update project locally and deploy (existing Worker)

1. Current repo ka backup/branch lo; ZIP ka contents `D:\Crakker.AI\crakkerxai-github-ready` mein merge karo (overwrite project files, `.git` and local `.env` keep intact).
2. `npm install`, `npm test`, `npm run build`, `npm run dev`.
3. `/pricing/`, `/account/` and all eight tools check karo. `VITE_SUPABASE_URL` aur `VITE_SUPABASE_ANON_KEY` empty hone par Login disabled message normal hai.
4. `git add . && git commit -m "Add account and pricing system" && git push origin main`.
5. Cloudflare Worker `crakkerxai-tools` redeploy hota hai; **wrangler.jsonc** `server/worker.js` ko API aur `dist` ko assets ki tarah serve karta hai. Ensure `https://www.crakkerxai.com/ads.txt` still works.

## 2. Supabase Auth configure karo

1. https://supabase.com/dashboard → New project. Project password safe rakho. Project region apni audience ke close choose karo.
2. SQL Editor → `supabase/schema.sql` ka pura SQL run karo.
3. Authentication → Providers → **Email** enable. Email confirmation ON recommended. SMTP sender configuration aur email deliverability check karo before release (default email sending limits apply).
4. Authentication → URL Configuration:
   - Site URL `https://www.crakkerxai.com`
   - Redirect URLs add `https://www.crakkerxai.com/account/`, aur local tests ke liye `http://localhost:5173/account/`.
5. Authentication → Sign In / Providers → Google (OAuth client) + GitHub (OAuth app). Dono providers ka OAuth callback URL **Supabase project** ke `https://PROJECT_REF.supabase.co/auth/v1/callback` par set hota hai (not `www.crakkerxai.com/account/`). Client secrets sirf Supabase console mein add karo. Provider setup officially docs ke according validate karo.
6. Project settings → API mein `Project URL`, `anon/publishable key`, `service_role/secret key` milegi. **Service-role key frontend ya GitHub pe kabhi nahi dalni.**

## 3. Cloudflare Worker variables/secrets

Cloudflare Dashboard → Workers & Pages → `crakkerxai-tools` → Settings → Variables and Secrets (production environment). Set:

| Name | Type | Value |
|---|---|---|
| `SUPABASE_URL` | text | `https://PROJECT_REF.supabase.co` |
| `SUPABASE_ANON_KEY` | text | Supabase public anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret** | Supabase server service_role key |
| `RAZORPAY_KEY_ID` | text | `rzp_test_...` to test, later live key |
| `RAZORPAY_KEY_SECRET` | **secret** | Matching Razorpay secret |
| `RAZORPAY_WEBHOOK_SECRET` | **secret** | Razorpay webhook-specific secret |
| `PAYMENTS_ENABLED` | text | `false` until ready/tested; then `true` |

Config changes apply on redeploy/activate depending on Cloudflare workflow. On live site check `https://www.crakkerxai.com/api/config`: should show `authEnabled:true`. This JSON exposes **only public Supabase key and Razorpay Key ID**, never service-role/payment secret. Don't paste actual secrets in ChatGPT or public repos.

For local auth-only test, copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Vite local dev does not host Worker payment APIs; use `wrangler dev` or deployed preview for end-to-end payment tests.

## 4. Razorpay merchant account + webhooks

1. https://dashboard.razorpay.com/ → Merchant signup, complete relevant KYC, settlement bank details, website/privacy/terms/refund policy as requested.
2. First select **Test Mode**, generate **Test API Key ID/Secret**.
3. Settings/Webhooks → create webhook endpoint:

   `https://www.crakkerxai.com/api/razorpay/webhook`

   Enable **payment.captured** and **payment.refunded** events. Use a strong webhook secret, set same in Cloudflare. Ensure automatic payment capture is enabled.
4. Verify `schema.sql` ran, test user email verified, `PAYMENTS_ENABLED=true` only in **test environment with test keys**.
5. Login, choose plan, open Razorpay Checkout, test success and failure, confirm `/account/` shows plan and payment history, test webhook retry and duplicate payment event **does not double-extend**.
6. After merchant approval, switch to live keys + live webhook secret, establish real support contact, approved refund/cancellation terms, reconcile refunds and disputes. **Only then** set `PAYMENTS_ENABLED=true` in production. Cloudflare can have preview/staging separate from production for tests.
7. Money from customer goes to **Razorpay settlement bank account**, not Google AdSense. AdSense ad earnings use their own payout process and are unrelated.

## 5. Pricing limits, technical truth

`src/plans.mjs` is the source of prices and rules; Worker uses it to **recalculate all order amounts** server-side, never accepting browser-supplied prices. When live payments are enabled, browser UI applies batch and size limits. Authenticated account daily quotas are counted atomically in Supabase. For anonymous free users, quota is browser-local.

**Important limitation:** All existing converters run in the customer's browser. A technically skilled person can bypass client-side file-size/batch checks or run their own local conversion. No JavaScript-only paywall can enforce true paid feature access. For fraud-resistant premium-only features, move the premium processing or critical capabilities to a server and apply authorization there. This starter does not guarantee quota security or prevent abuse. Keep `PAYMENTS_ENABLED=false` until business/consumer expectations and controls are verified.

Ultra means unlimited *number of monthly conversions under fair-use*, not infinite single file size or server resources. Per-task limit is 1024 MB, actual browser memory may be lower.

## 6. Google AdSense

Publisher ID and `public/ads.txt` remain unchanged. AdSense is loaded on free/anonymous pages after checking account entitlement; active paid users are spared ads where the script is controlled by this website. AdSense approval is separate and not guaranteed. Download is never locked for mandatory 60-90 seconds, which would violate AdSense policies.

## 7. Go-live safety checklist (must complete before real charges)

- [ ] Local tests pass, production build passes; all 8 converters manually tested on mobile/desktop.
- [ ] Google and GitHub OAuth accounts both tested; email confirmation and password reset tested.
- [ ] Supabase row-level security enabled and service-role secret only on Worker.
- [ ] Razorpay test key: success/failure/tampered signature/replayed webhook tested.
- [ ] Payments captured, amount INR matched, plan expires after 30 days, no auto-renewal.
- [ ] Refund, dispute, failed settlement handling and support channel documented; conduct first real low-value payment test safely.
- [ ] Customer support email, contact details and legally reviewed Privacy/Terms/Refund and Cancellation policy published. Policy text in starter is NOT legal advice.
- [ ] GST registration/invoicing requirements checked with accountant.
- [ ] CAPTCHA / rate limiting for signup, order creation and abuse controls configured.
- [ ] Cloudflare route and `/ads.txt` still work; AdSense review state checked.

**Official docs:**
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/auth/social-login/auth-github
- https://supabase.com/docs/guides/auth/redirect-urls
- https://developers.cloudflare.com/workers/static-assets/
- https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/


## NEW: Email OTP and mobile OTP registration/login (CrakkerXworld.AI branding)

- Account page `/account/` has three direct choices: **Email OTP**, **Mobile OTP**, **Password**, plus Google / GitHub social sign-in. Both Login and Create account offer these methods. Password flow is preserved for existing users. OTP code is verified with `supabase.auth.verifyOtp()` before a login session is accepted.
- Email OTP: Supabase → Authentication → Providers → Email ON; **Authentication → Email Templates → Magic Link** use `{{ .Token }}` in body instead of only `{{ .ConfirmationURL }}`. Example email: `<h2>CrakkerXworld.AI sign-in code</h2><p>Your code: {{ .Token }}</p>`.
- Mobile OTP: Supabase → Authentication → Providers → Phone → Enable; configure a supported **SMS provider** with its own credentials inside Supabase (e.g. Twilio, Vonage, MessageBird or supported Send SMS Hook). **No SMS messages are sent until configured and funded.** Some providers require verified sender IDs, especially for India.
- For India, check **TRAI DLT sender/template registration** requirements and your SMS provider's domestic routes before launching. Country code auto-applies `+91` to a valid 10-digit Indian mobile number. For overseas numbers use E.164 format like `+447700900123`.
- Phone OTP sends a code by SMS; Google/GitHub OAuth redirects to Supabase callback configured in your provider dashboards. Email OTP requires custom email template and a reliable SMTP sender for production. Defaults have low quota.
- For OTP login (`Log in`), `shouldCreateUser:false`: accounts cannot be created silently. For OTP registration (`Create account`), `shouldCreateUser:true`: account becomes usable **after verification**.
- Set Supabase Auth **rate limits** and **CAPTCHA**, monitor SMS costs and abuse. Frontend 60-second resend cooldown is only convenience; server/provider limits are required for security.
- Phone-only and email-only identities may create separate accounts unless explicitly linked by a secure, verified process. Do not merge them just by matching the user's typed name or number. A later account linking feature can be added with fresh reauthentication.
- SMS/phone account data are personal data; update privacy/terms and consent text according to applicable law. Do not log raw OTP codes anywhere.
- **CrakkerXworld.AI is the displayed brand, not a purchased/active domain.** Keep every functional URL, OAuth Site URL, canonical URL, sitemap link and AdSense registration on the owned **www.crakkerxai.com** until a new domain is actually acquired and connected. Do not change the Cloudflare or GitHub project identifiers.
- Test independently: email OTP signup/login, SMS OTP signup/login, existing password login, Google, GitHub, account dashboard, checkout TEST mode, all eight conversions, `ads.txt`.

Official reference: https://supabase.com/docs/guides/auth/phone-login , https://supabase.com/docs/guides/auth/auth-email-passwordless , https://supabase.com/docs/reference/javascript/auth-signinwithotp
