# Profile, Settings aur Pool Verification Update — 21 Nov 2026

## Kya update hua

- Password-login pool hold challenge ke felt colour ab maroon, red, blue, emerald aur dark green shades ke beech rotate hote hain. Reduced-motion preference active hone par animation reduce/stop hoti hai.
- Successful email, mobile aur OAuth sign-in ke baad account route `?view=profile` open karta hai.
- Profile mein authenticated user ka name, email, linked mobile, verification status, membership plan aur expiry (available hone par) dikhte hain. Missing data ko fake value se replace nahi kiya jata.
- Display name ko profile se update kiya ja sakta hai.
- Settings panel mein Morning/Night theme, font size, security/product/email notification preferences, location consent preference aur reduced-motion controls hain.
- Preferences per-user `public.account_preferences` table mein store hoti hain. Worker authenticated session se current user ID leta hai; client arbitrary `user_id` select nahi kar sakta.

## Required Supabase migration

File: `supabase/migrations/20261121_account_preferences.sql`

1. Supabase Dashboard mein wahi project kholo jo website use karti hai.
2. SQL Editor → New query kholo.
3. Upar wali migration file ka complete SQL paste karke Run karo.
4. Verify:

```sql
select to_regclass('public.account_preferences');
```

Expected: `account_preferences`.

Table RLS enabled rakhti hai; direct browser roles ko table access nahi milta. Worker server-side service-role key se validated, authenticated-user scoped preferences read/write karta hai. `SUPABASE_SERVICE_ROLE_KEY` kabhi frontend ya Git repository mein mat rakho.

## Deploy

Project root se:

```powershell
npm ci
npm test
npm run build
git add -A
git commit -m "Add profile dashboard and account preferences"
git push origin main
npx wrangler deploy
```

Agar Git commit ke liye changes nahi hon, commit command skip karo. Cloudflare deployment complete hone ke baad fresh login karke Profile aur Settings test karo.

## Settings ke scope ki important baat

- Theme, font size aur reduced-motion controls turant UI par apply hote hain.
- Notification switches per-user notification preferences save karte hain. Actual email/push notification delivery tabhi hogi jab relevant delivery provider/notification workflow configured ho.
- Location switch sirf user ki preference/consent state save karta hai. Ye page background mein GPS/browser location collect nahi karta; future location feature ko browser permission alag se maangni hogi.
- Plan membership data database mein available hone par dikhaya jata hai. Payment provider configuration disabled/missing ho toh paid subscription status ko fabricate nahi kiya jata.

## Verification performed

- `node --check src/account-page.js`
- `node --check server/worker.js`
- `node --check scripts/generate-pages.mjs`
- `npm test`: 193 tests passed, 0 failed.
- `npm run build`: page generation completed, but Vite build did not run because `vite` is not installed in this workspace. Run `npm ci` locally before production build.
