# CrakkerXworld.AI Conversion — light theme readability fix

This update addresses the account workspace theme screenshots where dark-theme text colours remained on pale backgrounds after switching to Light mode.

## Corrected areas
- Account page title and subtitle
- Dashboard page headings and date chip
- Sidebar labels, navigation, active state, search field and collapse control
- Sticky dashboard toolbar and profile chip
- Welcome/greeting banner
- KPI cards and usage donut
- Analytics panels, SVG axes/grid and weekly charts
- Reports KPIs, table headings, rows, filters and empty states
- My Files summary, file cards and tables
- Tools directory, plan cards, AI Updates and Feedback/Help cards
- Resources cards, help rail, checklist and shortcuts

## Visual behaviour
- Light theme uses white/light-neutral surfaces with dark, readable text and subtle borders.
- Branded action buttons retain their accent treatment and white button text.
- Dark theme styling is unchanged.
- Font family, font sizes, weights, spacing and line heights are not changed by the light-theme override block.

## Verification
`node scripts/generate-pages.mjs` and `npm test` are run as part of validation.
