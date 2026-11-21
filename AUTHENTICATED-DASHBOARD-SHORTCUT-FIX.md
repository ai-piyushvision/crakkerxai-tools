# Authenticated dashboard shortcut fix

## Symptom
The shared header could show the signed-in avatar and dashboard shortcut, but opening `/account/?view=overview` could leave the account sign-in panel visible.

## Change
- Dashboard enhancement initialisation is isolated so a non-critical dashboard control/widget error cannot abort Supabase session detection.
- The account page records the authenticated session before hydrating local analytics.
- Analytics widget failures are handled without switching an authenticated visitor back to the sign-in panel.
- If later workspace hydration fails while a valid session exists, the page keeps the authenticated workspace visible and reports a recoverable message.

## Scope
This addresses the frontend state/rendering path. It does not change Supabase credentials, Worker secrets, OAuth provider configuration, or the server-side `/api/me` implementation. If `/api/me` itself fails, the account dashboard should still remain visible and show a membership-data warning rather than presenting the login form.
