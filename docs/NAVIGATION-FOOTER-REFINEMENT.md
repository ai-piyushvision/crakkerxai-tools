# Navigation and footer refinement

## What changed

- Updated the shared primary navigation order to: PDF & image tools, How it works, Plans, AI updates, Help & feedback, Privacy.
- Renamed the old generic "All tools" primary-navigation link to "PDF & image tools" so the destination is clear before opening it.
- Replaced the tall one-link-per-row footer with compact two-column link groups on desktop and tablet, with a single-column link layout on narrow phones.
- Renamed footer sections to "Explore & support" and "Policies & resources".
- Replaced casual account labels with "Workspace" and "Profile & preferences"; changed the unauthenticated CTA to "Sign in".
- Standardized dashboard labels: "PDF & image tools", "Local history", "Plans & billing", "Support & feedback" and "Profile & preferences".
- Used "Local history" rather than "My files" because the dashboard shows a browser-local activity index, not cloud-stored user files.

## Source of truth

` scripts/generate-pages.mjs ` (without the spaces) produces the homepage and all static informational/tool pages. The generated HTML files are included in this ZIP. Shared layout CSS is in `src/styles.css`; workspace labels and dynamic fallbacks are in `src/account-page.js` and `src/account-menu.js`.

## Validation

- `npm run prepare:pages`: passed.
- `npm test`: 101 passed, 0 failed.
- `npm run build`: not completed in the packaging environment because Vite is not installed (`vite: not found`). Install dependencies with `npm ci`, then run the build locally before deployment.

## Deploy

From the project directory:

```powershell
npm ci
npm test
npm run build
npx wrangler deploy
```
