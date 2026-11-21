# Email OTP first-time password setup fix — 21 November 2026

## Bug
Existing accounts were backfilled with `password_setup_reason = legacy_rollout` and `password_changed_at = NULL`. The account page treated every `legacy_rollout` as a normal password change and required `Current password`, even after the user had just verified an Email OTP.

## Fix
- Successful Email OTP verification stores a short-lived (15 minute), browser-session marker tied to the Supabase user ID.
- For a `legacy_rollout` row with no password-change timestamp, a matching fresh Email OTP proof allows first-time password setup without the old password.
- The form still requires `New password` and `Confirm new password`.
- `client.auth.updateUser({ password })` continues to update the existing authenticated account. The existing database trigger records the password-change timestamp and completes the 60-day baseline.
- A 60-day expiry with a real timestamp continues to require the current password.
- The marker is cleared after successful setup, on password-login attempts, on OAuth login attempts, and on logout.

## Deployment
This is a frontend JavaScript change only. No additional SQL migration is required because the table, RLS policy, and password-change trigger are already installed and confirmed in the Supabase SQL results. Deploy the updated `crakkerxai-tools` project, then sign out and sign in again using Email OTP.

## Verification
Automated tests cover: legacy + Email OTP skips old password; legacy without Email OTP still asks for it; 60-day expiry continues to enforce current password.
