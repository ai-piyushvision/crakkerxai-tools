# CrakkerXworld.AI — Password screen / Supabase fallback repair (21 Nov 2026)

This update fixes the case where a user is already signed in (the profile/header shows the user), but the account page remains on **Account security check** because `/api/auth/password-policy` cannot reach Supabase through the Cloudflare Worker.

## What changed

- Account page now tries the authenticated Worker policy endpoint first.
- If the Worker request fails, it reads only the signed-in user's `account_password_security` row directly through the existing Supabase session.
- The password-policy migration grants `authenticated` SELECT and a row-level policy `auth.uid() = user_id`. Users cannot INSERT, UPDATE or DELETE their password-security row.
- Password age and setup status are calculated from the returned row. Missing/malformed policy records fail closed; the application does not silently bypass the 60-day rule.
- Existing/current password verification re-authenticates the same Supabase identity through the browser client, avoiding another Worker-to-Supabase request. A different user ID causes sign-out.

## Required Supabase action

Open Supabase Dashboard → SQL Editor → New query.

If `account_password_security` already exists from the earlier migration, run:

`supabase/patches/20261121_password_policy_authenticated_read.sql`

If the table does not exist, run the complete updated migration:

`supabase/migrations/20261120_account_password_policy.sql`

The full migration is re-runnable and adds the same authenticated own-row SELECT policy. Do not grant `anon` access and do not grant authenticated users write permissions.

## Deploy the correct website project

Use the existing `crakkerxai-tools` repository and its `crakkerxai-tools` Cloudflare Worker. Do not deploy this site from `crakker-matrix-engine`.

From the repository root:

```powershell
npm ci
npm test
npm run build
git add -A
git commit -m "Fix password policy Supabase fallback"
git push origin main
npx wrangler deploy
```

## Verify after deployment

1. Open `https://www.crakkerxai.com/account/` and refresh the page.
2. Sign in using the same OTP/Google/GitHub flow.
3. A user with no password should see **New password** and **Confirm new password**.
4. A user with a password flagged for initial rollout or 60-day renewal should see **Current password**, **New password**, and **Confirm new password**.
5. After a valid save, the app confirms the database trigger recorded the update, signs out, and asks the user to sign in again with the new password.

If the page still shows the security check, the new frontend is not yet deployed or the SQL read policy has not been applied to the same Supabase project used by the site. The detailed error now includes both Worker and direct Supabase failure causes.

## Test status

- Node regression tests: 132 passed, 0 failed.
- JavaScript syntax checks: passed.
- Vite production build: not verified in this environment because `vite` is not installed here. Run `npm ci` then `npm run build` in the repository checkout before deploying.

No live Cloudflare Worker, Supabase database, OAuth provider or production site was modified from this workspace.
