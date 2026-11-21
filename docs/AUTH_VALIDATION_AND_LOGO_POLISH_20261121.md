# CrakkerXworld.AI — Account UI polish (21 Nov 2026)

## Changes
- Replaced long technical account errors with short, user-facing validation messages.
- Mobile-account-not-found now reads: "No account found for this mobile number. Create an account or sign in by email."
- OTP, CAPTCHA, password mismatch, credential and network errors have concise messages.
- Disabled browser-native form popups on the auth and OTP forms so the page can display consistent messages.
- Updated OTP verification input to accept the widget's 4–8 digit formats.
- Added the supplied Google and GitHub artwork to the social sign-in buttons for both login and create-account modes.
- Replaced the SMS/WhatsApp channel tiles with colourful transparent artwork; no white square image tiles.
- Added Morning/Night theme-aware social logo contrast and mobile sizing.
- Updated both `account/index.html` and `scripts/generate-pages.mjs` so page generation preserves the account UI, CAPTCHA mount and social logos.

## Validation
- `node scripts/generate-pages.mjs`: passed.
- `node --test tests/*.test.mjs`: 168/168 passed.
- `node --check src/account-page.js`, `src/auth-messages.mjs`, and `scripts/generate-pages.mjs`: passed.
- `npm ci` timed out in this build workspace, so `npm run build` was not verified here. Run `npm ci` followed by `npm run build` in the deployment environment.

## Deployment
Merge this complete project into the existing `crakkerxai-tools` repository. Keep `.git` and production secrets. Then run:

```powershell
npm ci
npm test
npm run build
git add -A
git commit -m "Polish auth validation and provider logos"
git push origin main
npx wrangler deploy
```
