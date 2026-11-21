# CrakkerXworld.AI — browser-local conversions + optional Python search/news backend

The current release processes all 8 PDF/image tools locally in the browser with `src/converters.js`. The optional Python service remains available for AI Updates feed aggregation and server-assisted TF-IDF tool search.

## Local run

1. From project root run `npm ci`, `npm test`, then `npm run dev`. All eight converters work without starting Python.
2. Optional for live AI Updates/search: start FastAPI from `backend/` using its virtual environment and `python -m uvicorn app.main:app --reload --port 8000`.
3. Open `http://localhost:5173`.

## Production deployment

1. Build with `npm ci`, `npm test`, and `npm run build`.
2. Deploy the current `dist/` assets and Worker to the existing Cloudflare Worker.
3. All eight converters work without `PYTHON_API_URL`, Render, or a Python backend. The browser handles the selected files locally.
4. Optional: deploy `backend/` using root `render.yaml` if live AI Updates feeds and server-side TF-IDF search are required. Set Cloudflare Worker `PYTHON_API_URL` and `PYTHON_API_SECRET` only for those optional routes.

No LLM, paid AI API, neural model download, OCR pipeline, or generative document extraction is part of this build.
