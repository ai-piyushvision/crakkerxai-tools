# CrakkerXworld.AI — Browser-local converters + Cloudflare Worker

CrakkerXworld.AI (brand aliases: Crakker X World / Crakker X AI) provides eight PDF and image utilities that process files locally in the browser. An optional Python FastAPI service powers AI Updates and server-assisted tool discovery.

**Tools:** Images to PDF, PDF to PNG, Merge PDF, Extract PDF Pages, Rotate PDF, Convert Image Format, Resize Image, Compress Image.

## Architecture

- Frontend: existing HTML/CSS/JavaScript + Vite, deployed through the current Cloudflare Worker static-assets setup.
- Conversion engine: browser-side JavaScript using pdf-lib, PDF.js, Canvas and JSZip. All eight converters run on the visitor’s device; file bytes are not uploaded to a conversion API. Each task has a 50 MB combined-input limit and browser memory limits apply.
- Tool search: instant local catalog matching is available without a server; optional Python + scikit-learn TF-IDF ranking can enhance search when the API is connected.
- No LLM or paid AI API is used. AI news is aggregated from free public publisher RSS/Atom feeds without generated summaries; live feed refresh requires the optional Python API.
- Existing Supabase/Razorpay account and payment APIs remain in the Cloudflare Worker JavaScript for compatibility; they have not been migrated to Python in this release.

## Local development

Terminal 1 — Python backend:

```bash
cd backend
python -m venv .venv
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2 — frontend:

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api/search`, `/api/tools/*` and `/api/ai/*` to the local Python API. Python API docs are at `http://127.0.0.1:8000/docs`.

## Production deployment

1. Build the frontend with `npm ci`, `npm test`, and `npm run build`.
2. Deploy the built `dist/` assets and `server/worker.js` to the existing Cloudflare Worker using `npx wrangler deploy` (or your existing manual Cloudflare flow).
3. The eight PDF/image converters work without `PYTHON_API_URL`, Render, or any Python service. They execute in the browser and do not upload file contents.
4. Optional: deploy `backend/` from the root `render.yaml` if you want live AI Updates feeds and Python TF-IDF search. Only then configure Cloudflare Worker `PYTHON_API_URL` and `PYTHON_API_SECRET` to match the Render service URL and `INTERNAL_API_KEY`.
5. Keep existing Supabase/Razorpay variables unchanged. Never put service-role or payment secrets in Vite client variables.

## Supabase Email OTP (local)
The public Supabase project URL and publishable key are already set in `.env.local` and in the browser-safe configuration fallback. Run `npm ci` then `npm run dev`; no Cloudflare service-role secret is required to initialise Email OTP/password login. Enable Email under Supabase Authentication providers and configure the Email OTP template/SMTP sender. The Cloudflare service-role secret is required separately for private feedback storage, MSG91 account bridging, and paid membership database operations.

See [`docs/ADSENSE_READINESS_AUDIT.md`](docs/ADSENSE_READINESS_AUDIT.md) for the source audit findings, validation results, manual pre-approval checks and deployment handoff.

## Public website content and indexing

The site publishes the homepage, eight individual converter landing pages, and the following informational/support pages: About, Contact, Privacy Policy, Terms of Use, Disclaimer, FAQ, How it Works, Pricing, Feedback, and AI Updates. The page generator in `scripts/generate-pages.mjs` is the source of truth for these generated HTML files and `public/sitemap.xml`. Update the source content and run `npm run prepare:pages` rather than editing generated HTML by hand.

The `account/` route is intentionally excluded from the sitemap and marked `noindex,nofollow`; `robots.txt` allows crawlers to fetch it so they can read that directive. `/api/` remains disallowed. `public/ads.txt` and the AdSense publisher meta tag are included. A display ad slot is rendered only when a valid `VITE_ADSENSE_SLOT_ID` is configured and the visitor is eligible under the current free/paid account check. Keep the slot value empty until a real display ad unit has been created in AdSense.

## Validation

Run `npm test` after content or route changes. The tests cover the eight converter handlers, the local-processing boundary, generated metadata, canonical URLs, structured data, sitemap entries, public support/policy pages, and feedback endpoint safeguards. A successful local test run does not replace a browser QA pass on real PDFs/images or Google’s own AdSense review.

## Account password security (2026-11-20)

See [`docs/PASSWORD_POLICY_SETUP_HI.md`](docs/PASSWORD_POLICY_SETUP_HI.md) before deploying the account-security update. Apply `supabase/migrations/20261120_account_password_policy.sql` before deploying the Worker. The migration intentionally requires legacy accounts to set a password once because historical password-change times were not recorded. New password changes are timestamped by an `auth.users.encrypted_password` trigger; the account page enforces a 60-day maximum age. Mobile accounts can sign in with their verified `+91` phone number and password through the Worker.

## Auth provider setup (21 Nov 2026)

For user-selectable first-delivery SMS/WhatsApp OTP, Google OAuth, and GitHub OAuth setup, follow [`docs/AUTH_PROVIDER_ACTIVATION_20261121_HI.md`](docs/AUTH_PROVIDER_ACTIVATION_20261121_HI.md). MSG91 requires channel-specific widget IDs/tokens; Google/GitHub providers must be enabled with provider-issued credentials in Supabase.


## Authentication setup

See `docs/MSG91_SMS_WHATSAPP_FINAL_SETUP_20261121_HI.md` for exact SMS/WhatsApp widget IDs, existing-token reuse, Cloudflare variables, and delivery verification. OAuth login buttons use the supplied Google and GitHub logo artwork and adapt to Morning/Night theme.

## Unified email and mobile account identities

New signup now verifies both the user's email and mobile number before linking them to one Supabase account. Existing email/social accounts can link a phone from the profile, while legacy mobile-only accounts can add a verified email. Apply `supabase/migrations/20261121_unified_email_phone_identity.sql` in the production Supabase project before deploying; see [Hindi deployment and verification steps](docs/UNIFIED_EMAIL_MOBILE_IDENTITY_20261121_HI.md).
