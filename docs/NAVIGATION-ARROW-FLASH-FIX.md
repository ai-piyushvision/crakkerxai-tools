# Navigation arrow / white-frame mitigation

## What the supplied recording shows
At approximately 4.0 seconds, the browser URL has already changed to `/ai-updates/`. The page viewport is temporarily white and contains a large purple right-pointing gesture graphic. At approximately 4.5 seconds, the regular AI Updates page has rendered. The generated AI Updates HTML does not contain that arrow SVG/image/component; the only inline SVGs in the header/footer are the small brand icon.

## Site-side fixes included in this update

1. **Blocking stylesheet in `<head>`**: the shared page generator now emits the selected-theme critical background CSS and a stylesheet `<link>` before `<body>`. This prevents the old pattern where styles were first requested only after `src/main.js` executed. The application CSS is no longer imported asynchronously through the main JS module.
2. **Theme before first paint**: the saved light/dark theme is applied in the head before the critical background rules.
3. **All-page gesture guard**: the existing global guard now also cancels horizontal right-button drags (a common browser mouse-gesture trigger) while preserving ordinary right-click context menus.
4. **Horizontal scrolling opt-in**: report/file tables retain intentional horizontal scrolling.
5. **Native-like scroll controls**: refresh remains separate; the scroll-to-top control is text-labelled `Top`, not a large arrow graphic.

## Generated pages
The page generator writes the critical CSS and blocking stylesheet link to homepage, informational pages, account page, and all eight tool pages. `prepare:pages` was run after the change.

## Verification
- `node --check` passed for application and generator scripts.
- `npm run prepare:pages` generated homepage, 8 tool pages and 6 informational pages.
- `npm test`: 85 passing tests.
- All 17 generated `index.html` files contain the stylesheet link and critical theme rules before `<body>`.

A full production Vite build and a real client Windows/Chrome physical gesture recording could not be run in this environment. If the purple arrow is drawn by a Chrome extension or OS gesture utility outside the page DOM, website code cannot guarantee removal of that external overlay. This update addresses the site-controlled first-paint and DOM input paths without claiming control over browser chrome or external extensions.
