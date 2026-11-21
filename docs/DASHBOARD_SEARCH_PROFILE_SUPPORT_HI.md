# Dashboard search, profile and support controls

## Universal dashboard search
The main workspace search indexes:
- All eight PDF/image tools and common task aliases
- Overview, Analytics, Reports & Activity, My Files and Resources
- All Tools, Upgrade Plan/Billing, AI Updates, Feedback & Help and My Profile
- About, How it works, Privacy, Terms, Feedback and Pricing pages
- Recent local conversion-history entries
- Notifications

Type to see results. Use Up/Down arrows and Enter, or click a result. A result opens the in-dashboard view, the dedicated converter, the matching site page, a filtered history row, or the notification panel.

## Profile and notifications
The dashboard profile chip opens a menu with My Profile, Plans & Billing, Help & Support and Sign out. The bell button opens the notification panel. The shared site-header profile dropdown retains its account, plan and sign-out actions.

## Support
The dashboard Help & Support view links to the existing feedback form for bug reports and feature requests, plus the privacy page for account/file handling information. Feedback submission continues to use the existing `/api/feedback` Worker endpoint; in local Vite preview, that endpoint must be reachable through a configured Worker/API host to store a submission.

## Verification
Run `npm test` and `npm run dev`. All dashboard search and menu controls are generated from `scripts/generate-pages.mjs` and wired in `src/account-page.js` / `src/account-menu.js`.
