# CrakkerXworld.AI — mobile OTP, password login aur 60-day password policy

## Is update mein kya badla

- Email OTP, mobile OTP, Google/GitHub sign-in ke baad authenticated session par server-side password policy check hota hai.
- Naye OTP/social accounts jinke paas password nahi hai, unhe pehle sirf **New password + Confirm new password** bharna hoga. First-time setup mein old password maangna nahi chahiye.
- Existing/legacy accounts aur 60-day renewal mein **Current password + New password + Confirm new password** required hain. Current password ko save karne se pehle Supabase Auth ke against verify kiya jata hai.
- Password save aur database trigger verification successful hone ke baad app session sign out karta hai aur user ko naye password se dobara sign in karne ko kehta hai.
- Mobile OTP se verified account ke liye `Mobile number + password` login bhi add hai. Phone number ko private `msg91_phone_identities` mapping se resolve karke Worker Supabase Auth password grant use karta hai; browser ko hidden alias email expose nahi kiya jata.
- Password age 60 din ya usse zyada ho, to workspace dikhane se pehle password update screen aati hai.
- Password-change time `auth.users.encrypted_password` ke database trigger se record hota hai. Browser localStorage/user metadata ko trusted password-age source nahi banaya gaya.

## Existing accounts ka one-time migration behaviour

Supabase ne is application ke purane accounts ke liye password-change history store nahi ki thi. Isliye exact historical password age ko retrospectively prove karna possible nahi hai. Migration existing accounts ko ek baar `password_changed_at = NULL` mark karti hai, lekin `auth.users.encrypted_password` se ye distinguish karti hai ki password pehle se set tha ya nahi:
- Existing password wale accounts `legacy_rollout` hain; unhe **current password + new password + confirmation** dena hoga.
- Purane OTP/social accounts jinke paas password nahi tha, `initial_setup` rehte hain; unhe **sirf new password + confirmation** dena hoga.

Is action ke baad trigger actual password-change time record karega; agle logins par 60-day age accurately calculate hogi. Migration mein backfill bhi hai taaki pehle wale draft ko already apply kar chuke users ke no-password accounts galti se old-password flow mein na chale jaayen.

Yeh deliberate secure baseline hai. Isko silently `auth.users.updated_at` se infer nahi kiya gaya, kyunki woh email/metadata changes ke karan update ho sakta hai aur password-change time ka reliable proof nahi hai.

## Deployment order — zaroor follow karein

### 1. Supabase SQL migrations apply karein

Supabase Dashboard → SQL Editor mein same Supabase project par ye migrations order mein run karein:

1. `supabase/migrations/20261110_msg91_phone_auth.sql` — phone identity mapping aur OTP replay-protection tables.
2. `supabase/migrations/20261120_account_password_policy.sql` — first password setup aur 60-day password-change tracking.

`20261120` migration idempotent hai; existing account table ko zaroori columns ke saath update bhi karti hai.

### 2. Cloudflare Worker secrets/vars verify karein

Worker `crakkerxai-tools` ke Variables and Secrets mein required values configure honi chahiye:

- `SUPABASE_SERVICE_ROLE_KEY` (Secret; browser bundle mein kabhi nahi)
- `MSG91_AUTHKEY` (Secret)
- `MSG91_WIDGET_TOKEN` (Secret)
- `MSG91_WIDGET_ID` (aapke MSG91 widget ka exact ID; agar source default aapke widget se match nahi karta to ise set karein)
- `SUPABASE_URL` aur matching `SUPABASE_ANON_KEY` tab set karein jab aap default code mein bundled Supabase project ke bajay kisi doosre Supabase project ka use kar rahe hain. Is repo ka current public project URL/key safe browser fallback ke roop mein configured hai.

`/api/config` par `authEnabled: true`, `serverDatabaseEnabled: true` aur `msg91Enabled: true` aana chahiye. `msg91Enabled` ke liye MSG91 AuthKey, widget token aur service-role secret zaroori hain; current public Supabase URL/key ko code fallback se liya ja sakta hai. Public response mein service-role key ya MSG91 AuthKey expose nahi hoti. Supabase Auth settings mein email/password aur phone identity support verify karein; MSG91 hi OTP send/verify karta hai.

#### Wrangler se required secrets set karna (values terminal prompt par paste karein; source file mein nahi)

```powershell
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put MSG91_AUTHKEY
npx wrangler secret put MSG91_WIDGET_TOKEN
```

Agar custom Supabase project use kar rahe hain to `SUPABASE_URL` aur `SUPABASE_ANON_KEY` ko Cloudflare Worker variables/secrets mein bhi matching pair ke roop mein set karein. `MSG91_WIDGET_ID` ko matching widget ID ke saath Worker variable mein set karein.

## 3. Build and deploy

```powershell
npm ci
npm test
npm run build
git add -A
git commit -m "Add mobile password login and 60-day password policy"
git push origin main
npx wrangler deploy
```

### 4. End-to-end verification

Use a test account/phone number first:

1. Live `/api/config` check: `authEnabled`, `serverDatabaseEnabled` aur `msg91Enabled` sab `true` hone chahiye. Agar `msg91Enabled` false hai to browser OTP flow start hi nahi ho sakta; Cloudflare Worker secrets/widget ID check karein.
2. Create account → Mobile OTP → verify OTP.
3. Password setup screen must appear; enter and confirm a password (minimum 10 characters, letters and numbers).
4. After save, the app signs out and returns to sign-in.
5. Select Password → Sign in using → Mobile number; sign in with the same verified phone and password.
6. Repeat with Email OTP for an email account; after setup, select Password → Email address.
7. Confirm a password changed less than 60 days ago opens the workspace.
8. For a controlled test only, change the test account's `password_changed_at` row to a timestamp 61 days old; the next account-page load must force password update. Restore by changing the test account password through the app.

Do not manipulate the timestamp for real customer accounts.

## Google / GitHub OAuth prerequisites

The browser code starts Google/GitHub OAuth and now uses the canonical production return URL `https://www.crakkerxai.com/account/` whenever visitors enter through either the `www` or non-`www` domain. Provider credentials still have to be configured in Supabase:

1. In Supabase Authentication → Providers, enable Google and GitHub separately and add each provider's OAuth Client ID and Client Secret.
2. In Supabase Authentication → URL Configuration, set the production Site URL to `https://www.crakkerxai.com` and include `https://www.crakkerxai.com/account/` in the allowed redirect URLs.
3. In each Google/GitHub developer console, register the callback URL shown by that same Supabase project's provider setup page. Do not substitute the website URL for Supabase's OAuth callback URL.
4. Confirm Supabase allows new user sign-ups if you expect first-time Google/GitHub users to create accounts.

The source code cannot create OAuth client credentials or enable providers inside Supabase. Missing-provider and redirect-allowlist failures now show more useful messages on the login screen.

## MSG91 prerequisites

- MSG91 widget must have the production origin/domain allowed as configured in MSG91.
- The widget ID/token and Worker auth key must belong to the same MSG91 account/widget.
- The phone identity SQL table must already exist.
- Mobile password sign-in is limited to verified Indian `+91` numbers because the current `msg91_phone_identities` schema enforces the Indian number format.

## Google brand search: “Crakker X World”

The homepage title, visible text and Organization/WebSite structured data now use the exact spaced brand spelling `Crakker X World` alongside the compact domain brand `CrakkerXworld.AI` and `Crakker X World AI`. This improves the site's brand-entity signals but cannot force a Google ranking or immediate search result.

After deployment:

1. In Google Search Console, inspect `https://www.crakkerxai.com/` and request indexing.
2. Confirm the submitted sitemap is still `https://www.crakkerxai.com/sitemap.xml`.
3. In URL Inspection, check the crawled title and rendered page content after Google recrawls.
4. Search results can take time to update. Google may still autocorrect ambiguous queries such as “Crakker x world”; the owner cannot control Google's spelling correction or ranking.

## Operational notes

- The account page first asks the authenticated Worker for the policy, then securely falls back to a Supabase RLS query limited to the signed-in user's own `account_password_security` row. `passwordPolicyReady` in `/api/config` reports only the Worker-side preflight and is not the final user-session check.
- Re-run the updated `supabase/migrations/20261120_account_password_policy.sql` in the same Supabase project connected to the site. It grants SELECT to `authenticated` with `auth.uid() = user_id`; it does not grant users INSERT/UPDATE/DELETE. If the migration is missing, password setup remains blocked with a migration-specific error rather than bypassing the security check.
- Mobile password login uses Supabase Auth's password grant through the Worker and returns only the user session tokens to the browser over HTTPS. It does not send a password to MSG91.
- Supabase Auth and Cloudflare logs should be checked for provider-side failures. Never paste passwords, OTPs, access tokens, refresh tokens or service-role keys into support requests.


## `AuthenticationFailure` on Mobile OTP

If the page shows `AuthenticationFailure` before the OTP verification screen, the MSG91 widget has rejected its browser authentication. This is not evidence that the mobile number is invalid. Verify all of the following in the **same** MSG91 account:

1. `MSG91_AUTHKEY` and `MSG91_WIDGET_TOKEN` belong to the same account/widget integration.
2. `MSG91_WIDGET_ID` is the exact widget ID paired with that browser token.
3. The production origin `https://www.crakkerxai.com` is permitted in the MSG91 widget's domain/origin settings.
4. The widget is active and the account has the required SMS channel permission/credits.

The browser now converts this provider error into an actionable message. It cannot repair a rejected MSG91 credential or change provider permissions from the source code.

## Crakker X World Google search visibility

The homepage already contains the exact visible brand name `Crakker X World`, the official-site title/description, Organization and WebSite structured data, a canonical URL, and the sitemap reference. The supplied screenshot shows Google autocorrecting `crakker x world` to the unrelated query `crackers world`; the website code cannot override Google's query correction or guarantee a ranking.

After deploying the homepage update, use Google Search Console URL Inspection on `https://www.crakkerxai.com/` and request indexing. Also verify that `https://www.crakkerxai.com/sitemap.xml` is submitted and that the canonical URL shown by Google is the `www` URL. Check the exact query with `site:crakkerxai.com` and `CrakkerXworld.AI` while Google recrawls. Search visibility and timing are controlled by Google's indexing/ranking systems, not by the website's login code.


## Authenticated browser fallback (21 Nov 2026)

The account page can read `account_password_security` directly through the signed-in Supabase session if the Cloudflare Worker policy endpoint is temporarily unreachable. The migration grants `authenticated` SELECT with `auth.uid() = user_id` and keeps all writes revoked for normal users. Re-run the updated `20261120_account_password_policy.sql` migration in Supabase, then deploy the updated `crakkerxai-tools` project. Do not grant anon access or user write permissions. Existing accounts still require their current password when the policy marks them for a refresh.

## Mobile OTP delivery channel selection (SMS / WhatsApp)

The account form now lets the visitor choose the initial delivery route before the OTP request. To keep the unselected route from receiving the first code, configure two independent MSG91 OTP widgets in the same MSG91 account:

- SMS-primary widget: set its initial/default delivery channel to SMS. Store its exact `MSG91_SMS_WIDGET_ID` and Client Side Integration token as `MSG91_SMS_WIDGET_TOKEN`.
- WhatsApp-primary widget: set its initial/default delivery channel to WhatsApp. Store its exact `MSG91_WHATSAPP_WIDGET_ID` and Client Side Integration token as `MSG91_WHATSAPP_WIDGET_TOKEN`.
- `MSG91_AUTHKEY` must belong to that same MSG91 account. Do not reuse one widget's token with the other widget ID.
- In each widget's allowed domains/origins, allow `https://www.crakkerxai.com` (and `https://crakkerxai.com` if the apex domain is used).

Set these in the Cloudflare Worker `crakkerxai-tools` settings. Widget ID values may be plain Worker variables; all tokens/AuthKeys must be Worker secrets. Legacy `MSG91_WIDGET_ID` and `MSG91_WIDGET_TOKEN` names remain accepted for the SMS widget only. A WhatsApp choice is disabled in the UI until its own widget ID/token are configured. The browser receives widget-specific Client Side Integration tokens through `/api/config` because MSG91's browser SDK requires them; MSG91_AUTHKEY and Supabase service-role key are never returned.

After redeploying, check `/api/config`: `msg91SmsEnabled` should be `true`; `msg91WhatsappEnabled` should be `true` only after its separate widget is configured. Test one SMS-selected request and one WhatsApp-selected request using a phone you control. Confirm the first OTP arrives only on the selected channel. If the widget rejects authentication, verify the exact Widget ID/token pair and account/domain settings in MSG91; source code cannot correct mismatched provider credentials.

## Google and GitHub sign-up / login

Supabase returned `Unsupported provider: provider is not enabled` for Google. This is an external Supabase Auth setting, not a frontend code defect. Enable each provider and add the corresponding OAuth credentials:

1. Supabase Dashboard → Authentication → Sign In / Providers → Google: enable and save the Google OAuth Client ID and Client Secret. Repeat for GitHub with a GitHub OAuth Client ID and Client Secret.
2. The Supabase callback URL for this project is `https://knhduwfwngrffnlxbnwt.supabase.co/auth/v1/callback`. Register this exact callback URL in the Google Cloud OAuth client and GitHub OAuth App.
3. Supabase Authentication → URL Configuration: Site URL `https://www.crakkerxai.com`; add `https://www.crakkerxai.com/account/` and `https://crakkerxai.com/account/` to Redirect URLs.
4. Ensure Supabase allows new user signups. An OAuth user who does not yet exist is created at first successful provider authorization; an existing provider identity signs in.
5. Keep OAuth Client Secrets in Supabase provider settings only. Never add them to the browser bundle, GitHub source, or Cloudflare public config.

The account page now translates Supabase's disabled-provider and redirect errors into setup guidance. Code deployment alone cannot enable Google/GitHub providers or create their OAuth client secrets.
