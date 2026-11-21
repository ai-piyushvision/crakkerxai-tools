# Theme labels and OTP channel branding update — 21 Nov 2026

## What changed

- Added the supplied WhatsApp mark as `public/otp-whatsapp.png`.
- Added a local SVG SMS illustration inspired by the supplied SMS reference as `public/otp-sms.svg`.
- Replaced the account page's generic inline OTP glyphs with the local logo assets.
- Kept SMS and WhatsApp side-by-side in a two-column selector, including narrow mobile widths.
- Added white, bordered logo wells so black artwork remains visible in Night and Morning themes.
- Renamed the theme switch destination labels: dark theme offers **Morning Mode**; light theme offers **Night Mode**.
- Kept theme labels visible on mobile and tightened the header layout for small screens.
- Updated `scripts/generate-pages.mjs` so generated pages retain the account logo assets and Morning/Night theme labels.

## Validation

- `npm test`: 153 tests passed.
- `node --check src/main.js`: passed.
- `node --check scripts/generate-pages.mjs`: passed.
- `node scripts/generate-pages.mjs`: passed.
- `npm run build`: not completed in this environment because Vite is not installed (`vite: not found`). Run `npm ci` before building/deploying.

## Deployment

Merge these files into the existing `crakkerxai-tools` repository. Preserve `.git`, local environment files and production secrets. Then run:

```bash
npm ci
npm test
npm run build
git add -A
git commit -m "Add OTP channel logos and Morning/Night theme labels"
git push origin main
npx wrangler deploy
```

These changes affect the frontend assets and theme presentation. They do not create MSG91 credentials or enable a provider in MSG91/Supabase.
