# CrakkerXworld.AI — Brand / Login activation

Current public website stays at www.crakkerxai.com. The brand display name is **CrakkerXworld.AI** (lowercase `w`). No redirect to an unowned `.ai` domain should be added.

## Local Supabase login activation

1. Create a project at https://supabase.com/dashboard.
2. In Project Settings / Connect / API keys, obtain Project URL and **publishable (or legacy anon) public key**.
3. Next to `package.json` create `.env.local` with:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_PUBLISHABLE_OR_ANON_KEY
```

4. Authentication > URL Configuration: Site URL `https://www.crakkerxai.com`; redirect allowlist `http://localhost:5173/account/` and `https://www.crakkerxai.com/account/`.
5. Enable Email auth. For **numeric email OTP**, change Supabase Email Templates > Magic Link to include `{{ .Token }}` (the default is a clickable magic link).
6. Restart `npm run dev` after editing `.env.local`. Test email/password and email OTP with a real inbox.
7. Mobile OTP requires enabled Phone provider and configured SMS provider, plus India-specific DLT compliance when required. Google/GitHub login needs OAuth provider setup.

## Cloudflare Worker production setup

Set Worker variables `SUPABASE_URL`, `SUPABASE_ANON_KEY` and **secret** `SUPABASE_SERVICE_ROLE_KEY` in Cloudflare > Workers & Pages > crakkerxai-tools > Settings > Variables and Secrets. Deploy the updated Worker code after verifying setup; initialize `supabase/schema.sql` in the Supabase SQL editor before using account dashboard / paid features.

Do not put service-role key, SMS provider tokens, Razorpay secret or passwords in `VITE_` variables, source files, GitHub, or this chat. Payment checkout should stay disabled until merchant setup and test payments are completed. Free conversion tools remain available without login.
