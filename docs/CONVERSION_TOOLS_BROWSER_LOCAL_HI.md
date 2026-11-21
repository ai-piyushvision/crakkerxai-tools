# All 8 conversion tools — browser-local processing

## Why the previous error appeared
The tool UI sent each selected file to `/api/tools/{slug}`. The Cloudflare Worker tried to forward that request to the Python API, but `PYTHON_API_URL` was missing. The Worker correctly returned `Python API is not configured`.

## Fix in this release
The tool UI now calls the existing browser handlers in `src/converters.js` directly. Files are processed on the user’s device with `pdf-lib`, PDF.js, Canvas and JSZip. The 8 routes are:

- Images to PDF
- PDF to PNG (all pages or one selected page; PNG/JPG; optional original PDF in ZIP)
- Merge PDF
- Extract PDF Pages
- Rotate PDF
- Convert Image Format
- Resize Image
- Compress Image

No Render/Python host or `PYTHON_API_URL` is needed for these 8 converters. The 50 MB combined-input cap is retained. Browser/device memory and supported format limits still apply.

## What still uses the optional Python API
- Live AI Updates feed aggregation
- Server-assisted TF-IDF tool search ranking (the local catalog search continues to work without it)

If those optional features are required, deploy `backend/` separately to Render and configure Worker variables `PYTHON_API_URL` and `PYTHON_API_SECRET`. This is not a prerequisite for file conversion.

## Deploy this code
1. Push this project source to GitHub.
2. From the project root run `npm ci`, `npm test`, `npm run build`.
3. Deploy the updated Worker + `dist/` bundle to Cloudflare (`npx wrangler deploy`, or the existing manual Cloudflare flow).
4. Test one sample file through each of the eight production URLs and confirm the download opens.
