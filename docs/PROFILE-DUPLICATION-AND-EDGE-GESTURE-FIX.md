# Profile duplication and horizontal gesture fix

## Duplicate PS/profile button
The authenticated account screen had two separate profile controls:
- the shared site-header account menu (`.account-menu`)
- the dashboard toolbar profile menu (`.dash-user-menu-wrap`)

The shared site-header menu is retained as the single profile entry point. The dashboard-local copy is hidden only when the signed-in dashboard is visible. It is not hidden on other pages.

## Purple arrow / swipe overlay
The project contains no large purple arrow image, SVG, animation, or custom cursor asset. The pictured shape is consistent with a browser/OS edge-navigation gesture indicator, which is drawn by the browser or OS outside the website DOM. The website cannot reliably style or remove browser chrome/extension overlays.

This update strengthens the page-side handling:
- `overscroll-behavior-x: none` for the workspace.
- cancel horizontal touch swipes that start at the viewport edge when the browser dispatches cancelable DOM events.
- cancel page-level horizontal touchpad wheel events, while preserving horizontal table scrolling.

If the arrow still appears when refreshing with no touchpad/edge swipe and all browser extensions disabled, it is outside the site's own DOM/CSS and needs browser/OS gesture or extension settings checked. It is not a page asset in the source.
