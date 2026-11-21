CrakkerXworld.AI MSG91 Mobile OTP integration (patch installer)

1. Extract this ZIP into your repository root D:\Crakker.AI\crakkerxai-github-ready\
   Keep these files under msg91_patch folder (same location as apply_msg91_patch.py).
2. From repo root run:
   python msg91_patch/apply_msg91_patch.py
   npm ci
   npm test
   npm run build
3. Cloudflare Workers & Pages > crakkerxai-tools > Settings > Variables and Secrets:
   MSG91_AUTHKEY (Secret) - already added
   MSG91_WIDGET_TOKEN (Secret) - copy the Client Side Integration token selected as CrakkerXOTP
   MSG91_WIDGET_ID (Text) - 366b6a64745a343733373331 (optional, default in code)
4. Run Supabase SQL file msg91_patch/20261110_msg91_phone_auth.sql in Supabase SQL Editor.
   Required before mobile authentication works. Service-role key must already be configured.
5. Commit and push to your branch (or main when tested):
   git add .
   git commit -m "Integrate MSG91 OTP with Supabase phone sessions"
   git push origin main
6. SMS is the widget's primary channel; WhatsApp is a resend option.
   Configure SMS as primary and WhatsApp as retry channel in MSG91 Widget Settings.
   Actual delivery requires MSG91 channel permissions, credits and approved templates.
7. Password, email OTP, Google, GitHub and Razorpay stay unchanged.

SECURITY NOTES
- Do not place MSG91_AUTHKEY or SUPABASE_SERVICE_ROLE_KEY in GitHub or browser JS.
- MSG91_WIDGET_TOKEN is a browser-scoped token and must be delivered to browser SDK.
- Phone logins create a separate Supabase identity from an existing email-only account.
  Account linking must be separately verified and implemented later.
- This patch is not yet production-tested with live MSG91 OTP delivery.
- The widget sends an SMS first, then supports a WhatsApp resend when configured.
- It does NOT simultaneously send the same OTP on both channels.
- Use email OTP as the fallback until a test verifies complete session creation.
