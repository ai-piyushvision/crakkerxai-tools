# CrakkerXworld.AI — Authentication and brand repair (20 Nov 2026)

This update is for the **`crakkerxai-tools`** repository and Cloudflare Worker named **`crakkerxai-tools`**. Do not deploy this website from a different project/repository.

## What changed

- Password-policy startup errors now provide a specific reason instead of the generic `Unable to complete this request` message.
- Password-policy reads first use the authenticated Worker route, then fall back to the signed-in user reading only their own row through Supabase RLS. This fallback does not require `SUPABASE_SERVICE_ROLE_KEY`.
- A new authenticated Worker endpoint, `/api/auth/verify-current-password`, verifies an existing password against the same Supabase user without returning or storing a second session token.
- First-time accounts without a password see only **New password** and **Confirm new password**.
- Existing accounts and 60-day renewals see **Current password**, **New password**, and **Confirm new password**. The current password is validated before the password update.
- The password migration distinguishes old accounts that already have a password (`legacy_rollout`) from old OTP/social accounts that do not (`initial_setup`).
- MSG91 `AuthenticationFailure` is converted into an actionable explanation about the matching AuthKey, widget token, widget ID and production domain.
- Google/GitHub OAuth now uses the canonical production return URL for both `crakkerxai.com` and `www.crakkerxai.com`, with clearer provider/redirect error messages.
- Homepage visible brand text now includes **Crakker X World**. Existing Organization/WebSite metadata, canonical URL, and sitemap remain in place.

## Required production steps

1. Merge these source files into the existing **`crakkerxai-tools`** Git clone. Preserve its `.git` directory and existing environment secrets.
2. In the same Supabase project used by this website, run:
   - `supabase/migrations/20261110_msg91_phone_auth.sql` if it has not already been applied.
   - `supabase/migrations/20261120_account_password_policy.sql` (re-run the updated, idempotent migration if an earlier version was already applied; it adds the authenticated own-row SELECT policy).
3. In Cloudflare Worker `crakkerxai-tools`, confirm:
   - `SUPABASE_SERVICE_ROLE_KEY` is set as a Secret for MSG91 account bridging, membership/payment data and other private Worker operations. The password-policy read fallback does not depend on it.
   - If using a non-default Supabase project, both `SUPABASE_URL` and `SUPABASE_ANON_KEY` match that project.
   - MSG91 values belong together: `MSG91_AUTHKEY`, `MSG91_WIDGET_TOKEN`, and `MSG91_WIDGET_ID`.
4. Deploy from the `crakkerxai-tools` repository:
   ```powershell
   npm ci
   npm test
   npm run build
   git add -A
   git commit -m "Fix auth password lifecycle and provider diagnostics"
   git push origin main
   npx wrangler deploy
   ```
5. Open `https://www.crakkerxai.com/api/config`. Expected:
   ```json
   {
     "authEnabled": true,
     "serverDatabaseEnabled": true,
     "passwordPolicyReady": true,
     "msg91Enabled": true
   }
   ```
   `passwordPolicyReady` is a Worker-side preflight indicator. If it is false, the browser still attempts a secure authenticated RLS read. The migration must be installed and the direct read must succeed; do not bypass the password-policy gate.
6. For Google and GitHub, enable each provider in Supabase Auth, add its OAuth Client ID/Secret, allow `https://www.crakkerxai.com/account/` in Supabase Redirect URLs, and register the callback URL shown by Supabase in each provider console.
7. For Google Search, inspect `https://www.crakkerxai.com/` in Search Console and request indexing; verify the sitemap `https://www.crakkerxai.com/sitemap.xml`.

## Important boundaries

- `AuthenticationFailure` is returned by MSG91 before this site can verify the OTP. The code now identifies the likely configuration area, but only the MSG91 account owner can correct a rejected key/token, widget ID, domain allowlist, channel permission or credit balance.
- The source cannot enable Google/GitHub OAuth credentials or change Supabase/Cloudflare secrets.
- Google may autocorrect `crakker x world` to another query and controls its own crawl/index/ranking. The site can provide clear brand signals but cannot guarantee a search result or timing.
- Automated Node regression tests passed in the working copy. A Vite production build could not be completed in this environment because `vite` was unavailable after dependency installation timed out; run `npm ci` and `npm run build` on the repository machine before deployment.


## Follow-up patch (21 Nov 2026)

For the Worker-to-Supabase password-policy connection failure, also read `docs/AUTH_REPAIR_20261121_HI.md`. It adds the signed-in user's own-row RLS fallback and the standalone SQL patch under `supabase/patches/`.
