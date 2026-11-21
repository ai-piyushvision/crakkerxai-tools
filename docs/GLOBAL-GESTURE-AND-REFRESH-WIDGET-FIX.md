# Global gesture containment and refresh/scroll controls

## Global navigation-gesture containment
The previous guard was initialised only from the account/dashboard page. This update adds `src/browser-gesture-guard.js` and initialises it from `src/main.js`, so it runs on the landing page and all generated routes (tools, privacy, pricing, feedback, AI updates, and account).

It handles cancellable horizontal edge-touch gestures and page-level horizontal wheel gestures, while opting `.dash-table-scroll` and explicit horizontal scrollers out. Global CSS applies horizontal overscroll containment.

## Refresh and scroll widget
- The account dashboard keeps a dedicated floating refresh/scroll pill.
- Refresh remains a circular refresh icon with a separate action.
- Scroll-to-top is labelled **Top** instead of using an arrow glyph.
- The global help widget remains available.
- Duplicate global/dashboard Top controls are hidden on the account route.

## Limits
A site can cancel horizontal touch and wheel events when the browser dispatches them as cancellable DOM events. A browser extension, OS-level touchpad gesture UI, or browser chrome overlay is rendered outside the site's DOM and cannot be forcibly hidden by website JavaScript/CSS. The supplied video shows a full-viewport purple right-arrow overlay during route transitions; it is not present in the website's HTML/SVG/CSS assets. This update prevents the corresponding cancellable in-page gesture paths, but it cannot control an independently injected browser/OS overlay.

## Verification
- `node --check` for browser gesture guard, main.js, account-page.js and page generator.
- `npm run prepare:pages`.
- `npm test` including regression tests for global guard initialisation, event cancellation, table horizontal scroll exemption, separate refresh control and text-based Top control.
