# Authentication Logo Size and Label Layout Update — 21 Nov 2026

## Changes

- Increased SMS and WhatsApp logo artwork to 78px on desktop, 66px on common mobile widths, and 56px on very narrow screens.
- Changed OTP channel cards to icon-first vertical layouts, with `SMS` and `WhatsApp` labels centred directly below each logo.
- Increased Google and GitHub artwork to the same visual scale and moved each provider label directly below its logo.
- Removed visible icon-tile backgrounds so transparent, full-colour supplied artwork displays directly on the card surface.
- Added responsive sizes for mobile layouts and retained two cards per row.
- Kept dark/light theme contrast: GitHub mark is inverted for dark mode and original dark mark is used for light mode; Google, SMS and WhatsApp artwork retains its brand colours.
- Updated both `account/index.html` and `scripts/generate-pages.mjs` so page regeneration retains the new layout.

## Verification

Run `npm test`. The test suite includes checks for icon-first markup, labels and responsive logo sizes.

Run `npm run build` in the repository environment after installing dependencies with `npm ci`.
