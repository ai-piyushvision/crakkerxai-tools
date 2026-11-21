# CrakkerXworld.AI — GitHub source + Cloudflare Worker deployment

## Architecture

- GitHub `main` stores the complete source code.
- Cloudflare Worker `crakkerxai-tools` serves the Vite `dist/` assets and keeps the existing auth, feedback and payment API routes.
- All eight PDF/image converters run locally in the visitor’s browser through `src/converters.js`. They do not require Render, `PYTHON_API_URL`, or a Python processing backend.
- The optional Python service is only for live AI Updates and server-assisted TF-IDF search.

## 1. Local validation (project root)

```powershell
npm ci
npm test
npm run build
```

Test a sample input for each of the 8 tools in local preview before production deployment. `npm test` checks source and route wiring but is not a substitute for real PDF/image sample-file tests.

## 2. Push source to GitHub

```powershell
git status
git add .
git commit -m "Use browser-local processing for all eight tools"
git push origin main
```

Do not commit `.env.local`, service-role keys, Razorpay secrets, MSG91 credentials, or `node_modules`.

## 3. Deploy to the existing Cloudflare Worker

This project uses `wrangler.jsonc` with Worker name `crakkerxai-tools`, entry file `server/worker.js`, and static assets from `dist/`. Keep the existing Worker and its current Supabase/Razorpay/MSG91 secrets.

After `npm run build`, deploy using the existing Cloudflare workflow. From the project root the manual command is:

```powershell
npx wrangler deploy
```

Build output directory: `dist`. The Worker deployment will publish the built `dist/` assets and the Worker API together. Confirm the new Version ID in Cloudflare → Workers & Pages → `crakkerxai-tools` → Deployments.

## 4. Optional Python API

No Python deployment or Worker variable is required for the 8 converters. If you want live AI Updates and server-assisted TF-IDF search, deploy `backend/` separately using `render.yaml`, then configure `PYTHON_API_URL` and `PYTHON_API_SECRET` in Cloudflare Worker variables/secrets. This optional service is not used by normal file conversions.

## 5. Production verification

- Homepage, account, all eight tool URLs, `/privacy/`, `/terms/`, `/sitemap.xml`, and `/ads.txt`.
- Run at least one real sample conversion per tool and verify the downloaded file opens.
- Check multi-page PDF to PNG, one-page selection, JPG output, optional original-PDF ZIP, batch image ZIPs, page ranges, and PDF ordering.
- Confirm Network tab shows no `/api/tools/*` requests when a file is converted.
