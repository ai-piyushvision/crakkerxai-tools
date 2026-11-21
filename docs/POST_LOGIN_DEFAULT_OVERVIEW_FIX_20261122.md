# Post-login default view correction

- All successful Email OTP, mobile OTP, password, Google and GitHub authentication redirects now target `/account/?view=overview`.
- A fresh visit to `/account/` defaults to Overview; it no longer restores a stale Profile view from `sessionStorage`.
- Profile & preferences remains available through an explicit `/account/?view=profile` link or the in-dashboard Profile navigation.
- Updated both `account/index.html` and `scripts/generate-pages.mjs` so the next generated build preserves the explicit Profile link.
- Verification: `node --test tests/*.test.mjs` passed (193 tests).
