# Navigation hierarchy update

## Required structure

Services
└── Conversion tools
    ├── Images to PDF
    ├── PDF to PNG
    ├── Merge PDF
    ├── Extract PDF Pages
    ├── Rotate PDF
    ├── Convert Image Format
    ├── Resize Image
    └── Compress Image

The navigation is generated from `src/catalog.mjs` in `scripts/generate-pages.mjs`. Adding a new entry to the shared `tools` catalog automatically adds its page link to the Conversion tools submenu on every generated page; no duplicate desktop/mobile lists need to be maintained.

## Interaction

- Desktop: hover/focus Services, then hover/focus or click Conversion tools.
- Mobile/tablet: open the hamburger menu, tap Services, then tap Conversion tools.
- Both layouts use the same nested markup and shared generated tool list.
- Escape, outside click, and tool-link selection close the menu.
- The mobile nav has a bounded vertical scroll area so the menu remains reachable on short screens.
- Scroll header/reveal motion is preserved and reduced-motion preferences are respected.

## Validation

Run `npm test` and `npm run build` from the project root. The test suite includes assertions that every generated public page has the same nested hierarchy and all catalog conversion tools.
