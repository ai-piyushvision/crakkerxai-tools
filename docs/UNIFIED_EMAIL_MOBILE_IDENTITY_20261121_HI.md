# CrakkerXworld.AI — Unified Email + Mobile Account Setup

## Purpose

Email OTP, SMS OTP, WhatsApp OTP, Google and GitHub should resolve to one Supabase `auth.users.id` for the same person. Email and mobile are not separate profile types.

## What changed

- New account creation collects the user's name (optional), email address and mobile number.
- The user chooses SMS or WhatsApp and verifies the mobile number first.
- The user then verifies the email OTP. Only after both proofs are valid does the Worker link the phone identity to the verified email account.
- Email OTP/password login and mobile SMS/WhatsApp login resolve to the same Supabase user when both identifiers are linked.
- Existing email/social accounts can link a mobile number from **Profile & preferences → Email & mobile identity**.
- Existing mobile-only legacy accounts can add an email from the same panel. The flow verifies the mobile again, then verifies the email, and consolidates the old synthetic mobile-only profile into the verified email profile.
- The migration only auto-merges the application's old synthetic accounts (`mobile-<32 hex>@auth.crakkerxai.com` with `mobile_login=true`). It does not silently merge two real email accounts.
- When a phone belongs to another real email account, linking is refused with a clear conflict. The user must sign in to the account that already owns that phone or request a manual review. This protects users from accidental account takeover.

## Required Supabase migration

Run this migration in the **same Supabase project used by the production website** (`knhduwfwngrffnlxbnwt`):

`supabase/migrations/20261121_unified_email_phone_identity.sql`

Steps:

1. Open the Supabase Dashboard for project `knhduwfwngrffnlxbnwt`.
2. Open **SQL Editor → New query**.
3. Open the migration file above from this repository and copy its complete contents.
4. Paste and run it once.
5. Confirm the query finishes without an error.

The migration creates a private, service-role-only pending identity table and a security-definer linking function. It does not delete existing accounts when the migration is run. Account consolidation happens only later, after a user proves both the phone and the email.

Prerequisites already used by this project:

- `public.msg91_phone_identities` from `20261110_msg91_phone_auth.sql`.
- `public.msg91_otp_redemptions` from `20261110_msg91_phone_auth.sql`.
- `public.account_password_security` from `20261120_account_password_policy.sql`.
- The base tables in `supabase/schema.sql` (`payment_orders`, `memberships`, `conversion_usage`) are merged when present. Missing optional account-data tables are skipped by the merge routine.

Do not drop or recreate `auth.users`, `msg91_phone_identities`, or existing account tables. Do not run a destructive reset.

## Cloudflare Worker deployment

After the Supabase migration succeeds, deploy the latest `crakkerxai-tools` project:

```powershell
npm ci
npm test
npm run build

git add -A
git commit -m "Unify email and mobile account identities"
git push origin main
npx wrangler deploy
```

Keep the current production secrets and MSG91 widget variables. This identity change does not require generating a new MSG91 token or changing either widget ID.

## User flows after deployment

### New account

1. Open **Create account**.
2. Enter name (optional), email and mobile number.
3. Choose SMS or WhatsApp and request the mobile OTP.
4. Enter the mobile OTP.
5. Enter the email OTP sent to the supplied email.
6. The Worker links both verified identifiers to the same Supabase user. The account then continues to the existing password security setup, if required.

### Existing email account

1. Sign in using Email OTP, password, Google or GitHub.
2. Open **Profile & preferences → Email & mobile identity**.
3. Choose SMS or WhatsApp, enter the mobile number and verify the OTP.
4. The mobile is linked to the currently signed-in email account. If it belongs to one of this application's old synthetic mobile-only profiles, the server safely moves the supported account records and retires that synthetic profile.

### Existing mobile-only account

1. Sign in using the existing mobile number via SMS or WhatsApp.
2. Open **Profile & preferences → Email & mobile identity → Add a login email**.
3. Enter the real email address and choose SMS or WhatsApp.
4. Verify the mobile OTP, then verify the email OTP.
5. The verified email account becomes the primary profile; the old synthetic mobile-only account and its supported records are consolidated into it.

### Returning login

After linking is complete, any of the following opens the same Supabase profile:

- Email OTP
- Email + password
- SMS OTP to the linked mobile
- WhatsApp OTP to the linked mobile
- Google/GitHub for the email identity (when configured in Supabase)

For Google/GitHub accounts, users should sign in with the provider first and link their mobile from **Profile & preferences**. A provider signup alone does not prove ownership of a mobile number.

## Safe conflict behaviour

- A mobile number cannot be linked to two Supabase users.
- An email cannot be attached to an account unless its OTP is verified.
- A mobile cannot be attached unless its MSG91 OTP proof is verified.
- The link request is short-lived and one-use.
- Only the application's old synthetic mobile-only accounts are merged automatically.
- If the mobile is attached to another real email account, the application refuses the merge rather than combining unrelated profiles.

## Verification checklist

After migration and deployment, test with a controlled account:

- New signup with email + mobile using SMS.
- New signup with email + mobile using WhatsApp.
- Login to that account with Email OTP.
- Logout, then login to the same account with SMS OTP.
- Logout, then login to the same account with WhatsApp OTP.
- Sign in with Google/GitHub and link the mobile from Profile & preferences.
- Sign in to an old mobile-only account and use **Add a login email** to verify and consolidate it.

To inspect a linked record in Supabase SQL Editor:

```sql
select
  i.phone_e164,
  i.auth_user_id,
  u.email,
  u.email_confirmed_at
from public.msg91_phone_identities as i
join auth.users as u on u.id = i.auth_user_id
order by i.created_at desc;
```

The same person should have one row in `msg91_phone_identities`, and the email/phone login methods should resolve to the same `auth_user_id`.
