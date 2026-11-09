# CrakkerXworld.AI — GitHub + Cloudflare Pages website

A screenshot-inspired recreation of CrakkerXworld.AI, with the same overall
cream/dark-green style and eight browser-based file tools. Original ChatGPT
Sites source was not available, so this is not a verbatim copy.

**8 tools:** Images to PDF, PDF to PNG, Merge PDF, Extract PDF Pages,
Rotate PDF, Convert Image Format, Resize Image, Compress Image.

All conversions run locally in the user's browser. Limitations include a
50 MB total input cap and inability to process some unusual/malformed PDFs.

## Run locally

```bash
npm install
npm test
npm run dev
```

For production preview:

```bash
npm run build
npm run preview
```

## Publish (recommended)

1. Push source files to an empty GitHub repository.
2. Connect the repository to **Cloudflare Pages**.
3. Set build command `npm run build`, output directory `dist`.
4. Test on your assigned `*.pages.dev` URL.
5. Add `www.crakkerxai.com` as Cloudflare Pages custom domain.
6. Only after testing, switch GoDaddy `www` CNAME from existing ChatGPT
   hostname to the assigned Pages hostname.
7. Verify AdSense and request review; wait for site status **Ready**.
8. After approval, set production build variable `VITE_ADSENSE_SLOT_ID`
   to the numeric ad slot ID and redeploy.

Full Hindi/English steps: **docs/DEPLOY_GITHUB_CLOUDFLARE_HI.md**

Important: GitHub is used as the source repository, **not** the production
hosting platform for this monetized website. GitHub Pages is subject to
commercial website restrictions. Google AdSense prohibits preset-time ads
before downloads; downloads remain immediately available.

The AdSense publisher verification code is already in generated HTML. The
`public/ads.txt` file is copied to `/ads.txt` on production builds. Actual
ads are shown only if eligible, approved and the unit is filled.

`src/converters.js` contains conversion algorithms, `src/main.js`
contains UX and ad mounting logic, `src/styles.css` the responsive design,
`scripts/generate-pages.mjs` generates pages, and `tests/` contains tests.

This is not a guarantee that every PDF/image will convert successfully.
Run manual production/browser checks before changing DNS.

---

## Optional user accounts and paid plans (November 2026 update)

The project now includes **`/pricing/`**, **`/account/`**, Google/GitHub OAuth entry points, email/password signup/login and password recovery, a profile dashboard, 30-day plan passes, Cloudflare Worker payment APIs, Razorpay Checkout, signed webhook handling, Supabase database schema, and ad-free paid-user gating. Existing eight conversion algorithms are unchanged.

**Payments are disabled by default.** Nothing charges users until the owner separately sets up Supabase, verifies Google/GitHub OAuth, sets up a Razorpay merchant account and server-side secrets, runs the SQL schema, completes test transactions, publishes support/legal policies and explicitly enables `PAYMENTS_ENABLED=true`.

Full Hinglish setup: [`docs/LOGIN_PAYMENTS_SETUP_HI.md`](docs/LOGIN_PAYMENTS_SETUP_HI.md). Source of prices: [`src/plans.mjs`](src/plans.mjs). Back-end source: [`server/worker.js`](server/worker.js). SQL: [`supabase/schema.sql`](supabase/schema.sql).

> **No recurring debit:** Plan checkout is a one-time purchase of 30 days. **Not production hardened:** Browser-only conversion limits can be bypassed; move premium-only processing server-side before promising enforceable usage restrictions. A security, payment and legal review is required before enabling real charges.


Branding note: Display brand CrakkerXworld.AI / CrakkerXworld, live URL www.crakkerxai.com. Mobile OTP needs Supabase Phone provider + SMS provider + relevant India DLT configuration.
