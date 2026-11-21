# CrakkerXworld.AI navigation and responsive UX update

## Changes
- Replaced the incorrect top-level "PDF & image tools" label with **Services**.
- Added an accessible Services dropdown containing **Conversion tools** and direct links to all eight PDF/image conversion services.
- Added a mobile navigation toggle so the same top-level navigation is available on phone browsers; the Services submenu expands inside the mobile menu.
- Added sticky-header scroll state, restrained reveal-on-scroll transitions, and hover lift for cards.
- Honors `prefers-reduced-motion` and keeps keyboard focus indicators visible.
- Expanded homepage audience messaging to include enterprise and large organizations, professional teams, developers, creators, and individual users. Enterprise copy does not claim unsupported enterprise certifications, SLAs, or compliance features.
- Improved search, support, account and conversion form placeholder wording.
- Preserved the existing browser conversion handlers and file-processing behavior.

## Validation
- Page generator completed: homepage, eight tool pages, and nine informational pages.
- Automated tests: 104 passed, 0 failed.
- JavaScript syntax checks passed for `src/main.js` and `scripts/generate-pages.mjs`.
- Production build not run: `node_modules/.bin/vite` is not present in this environment. Run `npm ci && npm run build` locally before deployment.
- Mobile visual QA in a real browser is still required; automated checks verify the mobile menu markup, responsive CSS and event handlers.
