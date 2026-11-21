# Cloudflare Worker redirect compatibility fix — 21 Nov 2026

The production Worker logs showed this runtime exception during `POST /api/auth/msg91`:

`Invalid redirect value, must be one of "follow" or "manual" ("error" won't be implemented since it does not make sense at the edge; use "manual" and check the response status code).`

Cloudflare Workers do not support Fetch's `redirect: "error"` mode. All Worker fetch calls now use the supported `manual` mode. The MSG91 access-token verification handler reports an explicit `MSG91_VERIFY_REDIRECTED` result for 3xx responses instead of attempting to follow a redirect with credentials. The configured Python API proxy also rejects unexpected 3xx responses rather than forwarding a redirect to the browser.

No MSG91 keys, widget IDs, Supabase credentials, CAPTCHA settings, or database migrations are changed by this patch.

Run `npm ci`, `npm test`, `npm run build`, then deploy the Worker. After deployment, request a fresh OTP and verify once. Reusing a code already verified by MSG91 will fail because MSG91 proofs are single-use.
