# CrakkerXworld.AI Conversion — five-view account workspace

After successful login the account route opens `/account/` and displays the authenticated workspace.

## Sidebar views (single page; no reload)
1. **Overview** — KPI summary, 7-day conversion trend, PDF/image donut, recent conversions and quick tools.
2. **Analytics** — 30-day trend, PDF/image breakdown, weekly category bars and most-used tools.
3. **Reports & Activity** — searchable/filterable conversion history with CSV export.
4. **My Files** — recent conversion record cards and a searchable/sortable local activity index.
5. **Resources** — PDF/image tool collections, how-to guide, AI Updates, privacy and support resources.

The sidebar remains visible while each view changes. Selecting a view changes the panel in place; it does not navigate to another page.

## Data integrity
Dashboard metrics are computed from `cx_conversion_activity_v1`, the browser-local successful conversion activity log. The UI does not invent revenue, visitor, cloud storage or user analytics.
The My Files view is explicitly a **local activity index**, not cloud file storage. Source/output binaries are not uploaded to Supabase or cloud storage by this dashboard.
When there is no activity, charts show an empty state instead of fabricated sample data.

## Local development
Use Node.js 20.19+:
```powershell
npm ci
npm test
npm run dev
```
