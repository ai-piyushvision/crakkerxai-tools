# Feedback, Bug Reports, Themes aur AI Updates

## Naye pages
- `/feedback/` — name, email, contact number, WhatsApp, category, subject, details aur optional page URL.
- `/ai-updates/` — official AI lab, research aur cloud AI source links.
- Header mein Feedback, AI Updates aur Dark/Light theme toggle.

## Theme
- Default theme dark hai; user toggle se light mode select kar sakta hai.
- Selection browser `localStorage` mein `cx_theme` key ke under save hoti hai.
- Palette: black, white, red, blue, gold.

## Feedback database setup (required before production)
1. Supabase SQL Editor mein `supabase/migrations/20261117_feedback_submissions.sql` run karein.
2. Cloudflare Worker environment mein existing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` configured hone chahiye.
3. `/api/feedback` Worker endpoint form submissions ko `feedback_submissions` table mein store karta hai.
4. Public/anon/authenticated roles ko table access nahi diya gaya. Worker server-side service role se insert karta hai.
5. IP address ko raw form data ke roop mein save nahi kiya jata; abuse throttle ke liye SHA-256 hash store hota hai. Per hashed IP 15 minute mein maximum 3 submissions allow hain.

## Email notifications (optional but recommended)
Resend account mein sender domain verify karke Cloudflare Worker secrets/vars set karein:
- `RESEND_API_KEY` (secret)
- `FEEDBACK_NOTIFY_EMAIL` (team inbox)
- `FEEDBACK_FROM_EMAIL` (verified sender, e.g. `CrakkerXworld.AI <notifications@your-domain.com>`)

Database storage primary record hai. Email notification provider unavailable ho to bhi successful DB submission ko fail nahi kiya jata. Supabase Dashboard > Table Editor > `feedback_submissions` se reports review karein.

## AI Updates page — live publisher feed
- `/api/ai/updates` Python API official RSS/Atom feeds ko fetch karke latest technical announcements return karta hai.
- Coverage: OpenAI, Anthropic, Python.org, AWS Machine Learning, Microsoft Azure, Microsoft AI, Google Cloud AI, Hugging Face aur PyTorch.
- Story cards title, publisher-provided description, publication date, original link aur publisher text mein milne wale explicit version numbers dikhate hain.
- Backend successful feeds ko 15 minutes cache karta hai; page par Refresh feed button manual refresh trigger karta hai.
- Source health panel batata hai kaun se feeds respond kar rahe hain. Agar publisher feed down ho ya block kare to page official source links ke saath graceful fallback dikhata hai.
- Local Vite proxy already `/api/ai` ko `http://127.0.0.1:8000` forward karta hai. Production Cloudflare Worker mein `PYTHON_API_URL` HTTPS Python API base URL set hona zaroori hai.
- Yeh original publisher feed aggregation hai, guaranteed complete coverage nahi. Version/date wahi show honge jo source provide karta hai; production upgrade se pehle original announcement verify karein.

Python API local run:
```cmd
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
Test endpoint: `http://127.0.0.1:8000/api/ai/updates`

## Test before deploy
```cmd
npm install
npm run prepare:pages
npm test
npm run build
```

Cloudflare Pages/Worker deploy se pehle Supabase migration apply karein aur production secrets set karein. Test submission bhej kar Supabase table aur optional team inbox dono verify karein.
