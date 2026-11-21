# CrakkerXworld.AI Python API (Hinglish setup)

## Architecture

- Frontend: existing HTML/CSS/JavaScript + Vite, hosted on Cloudflare.
- PDF/image conversions: the website runs all eight tools locally in the browser using pdf-lib, PDF.js, Canvas and JSZip. Python conversion routes remain optional/legacy.
- Optional Python backend: FastAPI + scikit-learn TF-IDF search, live AI Updates feeds, and legacy conversion endpoints. The live website converters use browser-side handlers instead.
- No LLM, hosted model API, or neural model download is used. Search is local scikit-learn TF-IDF.
- Existing login/payment endpoints: Cloudflare Worker JavaScript remains in place for this upgrade so existing authentication/payment flows are not silently broken. This is not a full migration of every legacy API to Python.

## Local test

Terminal 1:

```bash
cd backend
python -m venv .venv
# Windows: .venv\\Scripts\\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Terminal 2 (project root):

```bash
npm install
npm run dev
```

Open http://localhost:5173. All eight converters run without the Python service. If FastAPI is running, Vite proxies optional `/api/search` and `/api/ai/*` routes to it. Python health: http://127.0.0.1:8000/health. API docs: http://127.0.0.1:8000/docs.

## Deploy Python API

Deploy the `backend/` Docker service to Render, Railway, Fly.io or another Python container host. `backend/Dockerfile` and the root `render.yaml` are included. Set:

- `CORS_ORIGINS=https://www.crakkerxai.com,https://crakkerxai.com`
- No model API keys or model downloads are required.
- `INTERNAL_API_KEY` as a long random secret (Render can generate one from `render.yaml`).

After deployment, test `https://YOUR-PYTHON-API/health` and `https://YOUR-PYTHON-API/api/search?q=pdf%20to%20png`.

## Connect Cloudflare

In Cloudflare Worker/Pages Functions environment variables, add:

- `PYTHON_API_URL=https://YOUR-PYTHON-API-HOST` (no trailing path)
- `PYTHON_API_SECRET` = exactly the same value as Python `INTERNAL_API_KEY`

Deploy the Cloudflare project again. The Worker sends the shared secret to protect optional Python API routes. The Worker proxies `/api/search` and `/api/ai/*` to FastAPI. Normal conversion tools do not call the Python service. Keep the existing Supabase/Razorpay secrets as-is. Do not put secrets in Vite variables.

## Important limitations

- TF-IDF is a machine-learning information-retrieval baseline, not a generative AI model.
- Tool search uses local TF-IDF only; no LLM, external inference API, or model download.
- No OCR, chatbot or generative-AI document extraction endpoint is claimed as active in this build. No generative document extraction or OCR model is included. AI Updates displays publisher-provided content without LLM summarization.
- All eight current conversion tools use `src/converters.js` for in-browser processing. The Python `/api/tools/*` endpoints remain optional/legacy and are not needed for production conversion.
