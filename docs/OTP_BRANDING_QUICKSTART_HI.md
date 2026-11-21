# CrakkerXworld.AI — OTP + Branding Update

**Visible brand:** CrakkerXworld / CrakkerXworld.AI. **Actual website:** https://www.crakkerxai.com (do NOT use or publish the unpurchased `.ai` domain). Repo, Cloudflare Worker, AdSense publisher ID and routes are unchanged.

## Local test

1. Merge only project files over your current `D:\Crakker.AI\crakkerxai-github-ready`. Do not replace/delete `.git` or `.env`.
2. `npm install` -> `npm test` -> `npm run build` -> `npm run dev`.
3. Open `http://localhost:5173/account/` and check Email OTP, Mobile OTP, Password, Google, GitHub options and Create account / Log in tabs. Note: real OTP delivery only after Supabase provider setup.
4. Test 8 conversion tools, Pricing, AdSense `ads.txt` and actual download output.
5. If all good: `git add .`, `git commit -m "Add OTP login and CrakkerXworld branding"`, `git push origin main`. Cloudflare Worker redeploys from main.

## Activate real OTP login

1. Create or use your existing Supabase project. Authentication → URL Configuration: Site URL `https://www.crakkerxai.com`, redirect `https://www.crakkerxai.com/account/` (and `http://localhost:5173/account/` for local test).
2. Enable **Email** provider; change Email Templates → Magic Link/OTP template body to include `{{ .Token }}` (otherwise users get a link instead of a code). Configure custom SMTP for production deliverability.
3. Enable **Phone** provider and configure an SMS provider with a funded account. Check India TRAI/DLT sender/template regulations with your provider. Configure Supabase rate limits + CAPTCHA/abuse protection. Each SMS may cost money.
4. Enable Google + GitHub OAuth in Supabase, their redirect URI points to `https://PROJECT_REF.supabase.co/auth/v1/callback`.
5. Cloudflare Worker production Settings → Variables and Secrets: `SUPABASE_URL` (text), `SUPABASE_ANON_KEY` (text/public), `SUPABASE_SERVICE_ROLE_KEY` (**secret only**). Do not copy secret values into the frontend or GitHub.
6. Deploy and test **signup** using Email OTP, signup using Mobile OTP, then log out / login using each. Phone-only signups now work with `/api/me` because a verified phone is accepted.
7. Password signup/login stays available. Phone and email identities may represent **different users** unless verified and linked explicitly; do not assume automatic account linking.

## Payments

Existing Normal ₹79, Plus ₹149, Pro ₹299, Ultra ₹599 plans and Razorpay backend code are preserved. Payments default **OFF**. Real payments need KYC, test checkout and webhook, server secrets and `PAYMENTS_ENABLED=true` only after verification.

## Important

This is a code package, not a live deployment. Real SMS and OAuth transactions were **not** tested without your configured provider accounts. Branding does not mean you own crakkerxworld.ai; canonical URLs, sitemap, OAuth and AdSense remain on crakkerxai.com.
