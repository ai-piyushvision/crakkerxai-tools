# Mobile responsive layout fix

## Root cause addressed
The shared `.header-inner` had a fixed desktop height while the mobile navigation expanded as a wrapped flex child. On narrow screens, the expanded menu could therefore paint outside the header's reserved layout height and overlap the page content.

## Changes
- At widths up to 780px, the shared header row now uses automatic height and the expanded primary navigation remains in normal document flow.
- Mobile Services and Conversion tools submenus are constrained to the viewport and scroll within the navigation region.
- Header order is explicitly controlled for brand, theme controls, hamburger, account control, and navigation.
- Resizing back to desktop closes the mobile navigation state.
- Mobile hero and account/auth form widths are constrained to the viewport; CTA and social controls use narrow-screen layouts.
- Account refresh/scroll widgets are hidden while login, OTP, or password-recovery panels are visible, preventing the floating pill from covering Google/GitHub buttons or form content.
- Existing scroll animations retain the reduced-motion accessibility behavior.

## Validation
- `node --check src/main.js`: passed
- `node --check scripts/generate-pages.mjs`: passed
- `npm test`: 109 passed, 0 failed
- `npm run prepare:pages`: passed; homepage, 8 tool pages and 9 informational pages generated
- `npm run build`: not completed in this environment because Vite is not installed
- `npm ci --no-audit --no-fund`: timed out in this environment; install dependencies locally before building
- Real-device browser verification remains required after deployment. No claim of zero bugs is made without that verification.

## Separate issue seen in screenshot
The message “Unable to complete this request. Please try again.” is an authentication/API failure, not a responsive CSS defect. This package prevents the account page's floating widget from covering the form, but it does not claim to fix Supabase/Worker authentication configuration or service availability.
