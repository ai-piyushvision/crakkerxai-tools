"""CrakkerXworld.AI Python API: ML-assisted tool discovery and AI capability status.

The eight file converters intentionally remain in-browser for privacy and speed.
This API handles natural-language tool search and provides a clean home for future
Python NLP/document-intelligence services.
"""
from __future__ import annotations

import os
import re
import io
import json
import hmac
import zipfile
import time
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from html.parser import HTMLParser
from concurrent.futures import ThreadPoolExecutor
from collections import defaultdict, deque
from pathlib import Path
from functools import lru_cache
from typing import Any

from fastapi import FastAPI, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from fastapi.responses import Response
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

APP_NAME = "CrakkerXworld.AI Python API"
ALLOWED_ORIGINS = [
    item.strip() for item in os.getenv(
        "CORS_ORIGINS",
        "https://www.crakkerxai.com,https://crakkerxai.com,http://localhost:5173,http://127.0.0.1:5173",
    ).split(",") if item.strip()
]

TOOLS: list[dict[str, Any]] = [
    {"slug": "images-to-pdf", "name": "Images to PDF", "category": "PDF", "description": "Convert JPG PNG WEBP images photos pictures into one PDF document", "aliases": ["image to pdf", "jpg to pdf", "jpeg to pdf", "png to pdf", "photo to pdf", "pictures to pdf", "combine images", "images converter"]},
    {"slug": "pdf-to-png", "name": "PDF to PNG", "category": "PDF", "description": "Convert PDF pages documents into PNG image pictures", "aliases": ["pdf to image", "pdf to jpg", "pdf to jpeg", "pdf page to png", "save pdf as image", "convert pdf pages", "pdf converter"]},
    {"slug": "merge-pdf", "name": "Merge PDF", "category": "PDF", "description": "Combine join merge multiple PDF files documents into one", "aliases": ["combine pdf", "join pdf", "pdf merger", "merge documents", "multiple pdf to one", "combine pdf files"]},
    {"slug": "extract-pdf-pages", "name": "Extract PDF Pages", "category": "PDF", "description": "Extract selected pages split pages take pages from PDF document", "aliases": ["split pdf", "pdf splitter", "remove pdf pages", "save selected pages", "separate pdf pages", "extract pages from pdf"]},
    {"slug": "rotate-pdf", "name": "Rotate PDF", "category": "PDF", "description": "Rotate PDF document pages clockwise or counterclockwise", "aliases": ["turn pdf", "change pdf orientation", "rotate pdf pages", "fix sideways pdf"]},
    {"slug": "convert-image", "name": "Convert Image Format", "category": "Image", "description": "Convert image formats PNG JPG JPEG WEBP between formats", "aliases": ["image converter", "png to jpg", "jpg to png", "webp converter", "change image format", "convert photo format"]},
    {"slug": "resize-image", "name": "Resize Image", "category": "Image", "description": "Resize image photo picture dimensions width height", "aliases": ["change image size", "image resizer", "photo resizer", "reduce image dimensions", "resize picture"]},
    {"slug": "compress-image", "name": "Compress Image", "category": "Image", "description": "Compress optimize reduce image file size photo without losing too much quality", "aliases": ["image compressor", "reduce image size", "make image smaller", "photo compressor", "optimize images", "shrink image"]},
]


def _normalise(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _document(tool: dict[str, Any]) -> str:
    return " ".join([tool["name"], tool["category"], tool["description"], *tool["aliases"]])


_CORPUS = [_document(tool) for tool in TOOLS]
_VECTORIZER = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), lowercase=True, sublinear_tf=True)
_MATRIX = _VECTORIZER.fit_transform(_CORPUS)

# Official publisher feeds. The page labels these as source announcements, not
# independently verified reporting. Failed feeds are isolated from the others.
AI_NEWS_FEEDS = [
    {"source": "OpenAI", "category": "Models & APIs", "url": "https://openai.com/news/rss.xml"},
    {"source": "Anthropic", "category": "Models & APIs", "url": "https://www.anthropic.com/news/rss.xml"},
    {"source": "Python.org", "category": "Python", "url": "https://blog.python.org/feeds/posts/default?alt=rss"},
    {"source": "AWS Machine Learning", "category": "Cloud & MLOps", "url": "https://aws.amazon.com/blogs/machine-learning/feed/"},
    {"source": "Microsoft Azure", "category": "Cloud & MLOps", "url": "https://azure.microsoft.com/en-us/updates/feed/"},
    {"source": "Microsoft AI", "category": "Models & APIs", "url": "https://blogs.microsoft.com/ai/feed/"},
    {"source": "Google Cloud AI", "category": "Cloud & MLOps", "url": "https://cloudblog.withgoogle.com/rss/"},
    {"source": "Hugging Face", "category": "Open Source & Models", "url": "https://huggingface.co/blog/feed.xml"},
    {"source": "PyTorch", "category": "Python & Frameworks", "url": "https://pytorch.org/blog/feed.xml"},
]
_AI_FEED_CACHE: dict[str, Any] = {"expires": 0.0, "payload": None}

class _TextOnly(HTMLParser):
    def __init__(self):
        super().__init__(); self.parts: list[str] = []
    def handle_data(self, data: str):
        self.parts.append(data)

def _plain_text(value: str, max_length: int = 420) -> str:
    parser = _TextOnly()
    try: parser.feed(value or "")
    except Exception: pass
    return re.sub(r"\s+", " ", unescape(" ".join(parser.parts))).strip()[:max_length]

def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()

def _feed_date(value: str) -> str | None:
    if not value: return None
    try:
        parsed = parsedate_to_datetime(value)
        if parsed.tzinfo is None: parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).isoformat()
    except Exception:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            if parsed.tzinfo is None: parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc).isoformat()
        except Exception: return None

def _fetch_ai_feed(feed: dict[str, str]) -> tuple[list[dict[str, Any]], str | None]:
    request = urllib.request.Request(feed["url"], headers={"User-Agent": "CrakkerXworldAI-NewsBot/1.0 (+https://www.crakkerxai.com/)", "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml"})
    try:
        with urllib.request.urlopen(request, timeout=7) as response:
            raw = response.read(2_000_000)
        root = ET.fromstring(raw)
        entries = [node for node in root.iter() if _local_name(node.tag) in {"item", "entry"}]
        output = []
        for entry in entries[:18]:
            fields: dict[str, str] = {}
            link = ""
            for child in list(entry):
                key = _local_name(child.tag)
                if key == "link":
                    link = child.attrib.get("href") or (child.text or "").strip() or link
                elif key in {"title", "description", "summary", "content", "pubdate", "published", "updated", "date"}:
                    fields[key] = " ".join(child.itertext()).strip()
            title = _plain_text(fields.get("title", ""), 180)
            if not title or not link.startswith(("https://", "http://")): continue
            published = _feed_date(fields.get("pubdate") or fields.get("published") or fields.get("updated") or fields.get("date") or "")
            summary = _plain_text(fields.get("description") or fields.get("summary") or fields.get("content") or "", 500)
            version_matches = re.findall(r"(?i)(?:\b(?:v|version)\s*|\b(?:Python|PyTorch|CUDA|TensorFlow|NumPy|FastAPI|Django|Node\.js)\s+)(\d+\.\d+(?:\.\d+){0,2})\b", title + " " + summary)
            output.append({"title": title, "description": summary or "Open the original publisher announcement for full technical details.", "url": link, "source": feed["source"], "category": feed["category"], "published_at": published, "versions": list(dict.fromkeys(version_matches))[:5]})
        return output, None
    except Exception as exc:
        return [], str(exc)[:160]

def _get_ai_updates() -> dict[str, Any]:
    now = time.time()
    cached = _AI_FEED_CACHE.get("payload")
    if cached and now < float(_AI_FEED_CACHE.get("expires", 0)): return cached
    with ThreadPoolExecutor(max_workers=6) as pool:
        fetched = list(pool.map(_fetch_ai_feed, AI_NEWS_FEEDS))
    stories = [story for items, _ in fetched for story in items]
    stories.sort(key=lambda item: item.get("published_at") or "", reverse=True)
    # De-duplicate publisher mirrors by normalized headline.
    unique = []; seen = set()
    for story in stories:
        key = re.sub(r"[^a-z0-9]+", " ", story["title"].lower()).strip()
        if key in seen: continue
        seen.add(key); unique.append(story)
    checked = datetime.now(timezone.utc).isoformat()
    payload = {"ok": True, "last_checked": checked, "refresh_seconds": 900, "stories": unique[:60], "sources": [{"name": feed["source"], "category": feed["category"], "url": feed["url"], "status": "available" if fetched[i][0] else "temporarily_unavailable"} for i, feed in enumerate(AI_NEWS_FEEDS)], "available_sources": sum(bool(items) for items, _ in fetched), "total_sources": len(AI_NEWS_FEEDS), "note": "Live publisher-feed aggregation. Titles, descriptions and dates are supplied by original publishers; verify technical details in the linked announcement."}
    _AI_FEED_CACHE.update({"expires": now + 900, "payload": payload})
    return payload


MAX_TOTAL_BYTES = 50 * 1024 * 1024
MAX_IMAGE_PIXELS = 30_000_000
MAX_PDF_PAGES = 120
_RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)
_RATE_LIMIT = 15
_RATE_WINDOW_SECONDS = 60


def _safe_filename(name: str, fallback: str) -> str:
    clean = re.sub(r"[^A-Za-z0-9._-]+", "-", Path(name or fallback).name).strip(".-")
    return (clean or fallback)[:120]


def _response(data: bytes, filename: str, content_type: str) -> Response:
    safe = _safe_filename(filename, "download.bin")
    return Response(
        content=data,
        media_type=content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{safe}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "X-Processed-By": "CrakkerXworld-Python",
        },
    )


def _zip_outputs(outputs: list[tuple[str, bytes]], archive_name: str) -> tuple[str, bytes, str]:
    if len(outputs) == 1:
        name, data = outputs[0]
        return name, data, "application/octet-stream"
    memory = io.BytesIO()
    with zipfile.ZipFile(memory, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        used: set[str] = set()
        for name, data in outputs:
            candidate = _safe_filename(name, "output.bin")
            stem, suffix = Path(candidate).stem, Path(candidate).suffix
            index = 2
            while candidate in used:
                candidate = f"{stem}-{index}{suffix}"
                index += 1
            used.add(candidate)
            archive.writestr(candidate, data)
    return archive_name, memory.getvalue(), "application/zip"


def _parse_pages(value: str, count: int) -> list[int]:
    value = (value or "all").strip().lower()
    if value in {"", "all", "*"}:
        return list(range(count))
    selected: list[int] = []
    for part in value.split(","):
        part = part.strip()
        if re.fullmatch(r"\d+", part):
            start = end = int(part)
        elif re.fullmatch(r"\d+\s*-\s*\d+", part):
            left, right = re.split(r"\s*-\s*", part)
            start, end = int(left), int(right)
            if end < start:
                raise ValueError("Page range end must be greater than or equal to its start.")
        else:
            raise ValueError("Enter page numbers like 1,3,5-7 or all.")
        if start < 1 or end > count:
            raise ValueError(f"Page numbers must be between 1 and {count}.")
        selected.extend(range(start - 1, end))
    # Keep user order while removing duplicate pages.
    return list(dict.fromkeys(selected))


async def _read_uploads(files: list[UploadFile], expected: str) -> list[tuple[str, bytes]]:
    if not files:
        raise HTTPException(status_code=400, detail="Choose at least one file.")
    if len(files) > 30:
        raise HTTPException(status_code=413, detail="Choose no more than 30 files per task.")
    items: list[tuple[str, bytes]] = []
    total = 0
    for upload in files:
        name = _safe_filename(upload.filename or "upload", "upload")
        suffix = Path(name).suffix.lower()
        if expected == "pdf" and suffix != ".pdf":
            raise HTTPException(status_code=415, detail=f"{name}: only PDF files are supported.")
        if expected == "image" and suffix not in {".jpg", ".jpeg", ".png", ".webp"}:
            raise HTTPException(status_code=415, detail=f"{name}: use JPG, PNG or WebP images.")
        data = await upload.read(MAX_TOTAL_BYTES + 1)
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise HTTPException(status_code=413, detail="Total upload limit is 50 MB per conversion.")
        if not data:
            raise HTTPException(status_code=400, detail=f"{name}: file is empty.")
        items.append((name, data))
    return items


def _open_image(data: bytes):
    from PIL import Image, ImageOps
    image = Image.open(io.BytesIO(data))
    if image.width * image.height > MAX_IMAGE_PIXELS:
        raise ValueError("Image dimensions exceed 30 million pixels.")
    image = ImageOps.exif_transpose(image)
    image.load()
    return image


def _image_bytes(image, fmt: str, quality: int = 85) -> bytes:
    from PIL import Image
    output = io.BytesIO()
    if fmt == "JPEG":
        if image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info):
            rgba = image.convert("RGBA")
            background = Image.new("RGB", rgba.size, "white")
            background.paste(rgba, mask=rgba.getchannel("A"))
            image = background
        else:
            image = image.convert("RGB")
        image.save(output, format=fmt, quality=quality, optimize=True)
    elif fmt == "WEBP":
        image.save(output, format=fmt, quality=quality, method=5)
    else:
        image.save(output, format=fmt, optimize=True)
    return output.getvalue()


def _process_tool(slug: str, items: list[tuple[str, bytes]], options: dict[str, Any]) -> tuple[str, bytes, str]:
    if slug == "images-to-pdf":
        from PIL import Image
        pages = []
        total_pixels = 0
        for _, data in items:
            image = _open_image(data)
            total_pixels += image.width * image.height
            if total_pixels > 90_000_000:
                raise ValueError("Combined image dimensions exceed the safe processing limit.")
            if image.mode in {"RGBA", "LA"} or (image.mode == "P" and "transparency" in image.info):
                rgba = image.convert("RGBA")
                page = Image.new("RGB", rgba.size, "white")
                page.paste(rgba, mask=rgba.getchannel("A"))
            else:
                page = image.convert("RGB")
            pages.append(page)
        if not pages:
            raise ValueError("Choose at least one image.")
        output = io.BytesIO()
        pages[0].save(output, format="PDF", save_all=True, append_images=pages[1:], resolution=150)
        for page in pages:
            page.close()
        return "images.pdf", output.getvalue(), "application/pdf"

    if slug == "pdf-to-png":
        import fitz
        from PIL import Image
        document = fitz.open(stream=items[0][1], filetype="pdf")
        try:
            if document.page_count > MAX_PDF_PAGES:
                raise ValueError(f"This tool supports up to {MAX_PDF_PAGES} pages per conversion.")
            scale = float(options.get("scale", 1.5))
            if scale not in {1.0, 1.5, 2.0}:
                scale = 1.5
            selected_pages = _parse_pages(str(options.get("pages", "all")), document.page_count)
            if not selected_pages:
                raise ValueError("Choose at least one page to convert.")
            output_format = str(options.get("outputFormat", "png")).lower()
            if output_format not in {"png", "jpg", "jpeg"}:
                raise ValueError("Choose PNG or JPG as the image format.")
            is_jpeg = output_format in {"jpg", "jpeg"}
            extension = "jpg" if is_jpeg else "png"
            outputs: list[tuple[str, bytes]] = []
            for index in selected_pages:
                page = document.load_page(index)
                page_scale = min(scale, (16_000_000 / max(1.0, page.rect.width * page.rect.height)) ** 0.5)
                pix = page.get_pixmap(matrix=fitz.Matrix(page_scale, page_scale), alpha=False)
                raw = pix.tobytes("png")
                if is_jpeg:
                    image = Image.open(io.BytesIO(raw)).convert("RGB")
                    converted = io.BytesIO()
                    image.save(converted, format="JPEG", quality=92, optimize=True)
                    raw = converted.getvalue()
                    image.close()
                outputs.append((f"page-{index + 1:03d}.{extension}", raw))
            include_original = bool(options.get("includeOriginalPdf", False))
            if include_original:
                outputs.insert(0, (_safe_filename(Path(items[0][0]).stem + "-original.pdf", "original.pdf"), items[0][1]))
            if len(outputs) == 1:
                filename, data = outputs[0]
                return filename, data, "image/jpeg" if is_jpeg else "image/png"
            archive_name = f"{Path(items[0][0]).stem}-images-and-pdf.zip" if include_original else f"{Path(items[0][0]).stem}-{extension}-pages.zip"
            return _zip_outputs(outputs, archive_name)
        finally:
            document.close()

    if slug in {"merge-pdf", "extract-pdf-pages", "rotate-pdf"}:
        from pypdf import PdfReader, PdfWriter
        writer = PdfWriter()
        if slug == "merge-pdf":
            if len(items) < 2:
                raise ValueError("Choose two or more PDF documents to merge.")
            for _, data in items:
                reader = PdfReader(io.BytesIO(data), strict=False)
                if reader.is_encrypted:
                    raise ValueError("Password-protected PDFs are not supported.")
                for page in reader.pages:
                    writer.add_page(page)
            filename = "merged.pdf"
        else:
            reader = PdfReader(io.BytesIO(items[0][1]), strict=False)
            if reader.is_encrypted:
                raise ValueError("Password-protected PDFs are not supported.")
            count = len(reader.pages)
            if count == 0 or count > 1000:
                raise ValueError("This PDF has an unsupported page count.")
            if slug == "extract-pdf-pages":
                pages = _parse_pages(str(options.get("pages", "all")), count)
                for index in pages:
                    writer.add_page(reader.pages[index])
                filename = f"{Path(items[0][0]).stem}-extracted.pdf"
            else:
                angle = int(options.get("angle", 90))
                if angle not in {90, 180, 270}:
                    raise ValueError("Choose 90, 180 or 270 degrees.")
                pages = _parse_pages(str(options.get("pages", "all")), count)
                for index, page in enumerate(reader.pages):
                    if index in pages:
                        page.rotate(angle)
                    writer.add_page(page)
                filename = f"{Path(items[0][0]).stem}-rotated.pdf"
        output = io.BytesIO()
        writer.write(output)
        return filename, output.getvalue(), "application/pdf"

    if slug in {"convert-image", "resize-image", "compress-image"}:
        from PIL import Image
        outputs = []
        for name, data in items:
            image = _open_image(data)
            stem = Path(name).stem
            if slug == "convert-image":
                fmt_choice = str(options.get("format", "webp")).lower()
                fmt = {"jpg": "JPEG", "jpeg": "JPEG", "png": "PNG", "webp": "WEBP"}.get(fmt_choice, "WEBP")
                quality = max(35, min(100, int(options.get("quality", 85))))
                ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}[fmt]
                outputs.append((f"{stem}.{ext}", _image_bytes(image, fmt, quality)))
            elif slug == "resize-image":
                width = max(1, min(12000, int(options.get("width", 1200))))
                lock = str(options.get("lockAspect", "true")).lower() != "false"
                if lock:
                    height = max(1, round(image.height * width / image.width))
                else:
                    height = max(1, min(12000, int(options.get("height", 800))))
                if width * height > MAX_IMAGE_PIXELS:
                    raise ValueError("Requested dimensions exceed 30 million pixels.")
                resized = image.resize((width, height), Image.Resampling.LANCZOS)
                source_ext = Path(name).suffix.lower()
                fmt = "PNG" if source_ext == ".png" else "WEBP" if source_ext == ".webp" else "JPEG"
                ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}[fmt]
                outputs.append((f"{stem}-{width}x{height}.{ext}", _image_bytes(resized, fmt, 90)))
                resized.close()
            else:
                fmt_choice = str(options.get("format", "webp")).lower()
                fmt = "JPEG" if fmt_choice in {"jpg", "jpeg"} else "WEBP"
                quality = max(30, min(95, int(options.get("quality", 75))))
                max_dimension = int(options.get("maxDimension") or 0)
                if max_dimension > 0:
                    factor = min(1.0, max_dimension / max(image.width, image.height))
                    size = (max(1, round(image.width * factor)), max(1, round(image.height * factor)))
                    resized = image.resize(size, Image.Resampling.LANCZOS) if size != image.size else image.copy()
                else:
                    resized = image.copy()
                ext = "jpg" if fmt == "JPEG" else "webp"
                outputs.append((f"{stem}-compressed.{ext}", _image_bytes(resized, fmt, quality)))
                resized.close()
            image.close()
        name, data, mime = _zip_outputs(outputs, f"{slug}.zip")
        if len(outputs) == 1:
            ext = Path(name).suffix.lower()
            mime = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "application/octet-stream")
        return name, data, mime

    raise HTTPException(status_code=404, detail="Unknown tool.")


class SearchResponse(BaseModel):
    query: str
    mode: str
    results: list[dict[str, Any]]


app = FastAPI(title=APP_NAME, version="1.0.0", description="Python NLP and ML-assisted tool discovery API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@app.post("/api/tools/{slug}")
async def process_tool(request: Request, slug: str, files: list[UploadFile] = File(...), options: str = Form("{}")):
    internal_key = os.getenv("INTERNAL_API_KEY")
    supplied_key = request.headers.get("x-internal-api-key", "")
    if internal_key and not hmac.compare_digest(internal_key, supplied_key):
        raise HTTPException(status_code=401, detail="Unauthorized processing request.")
    allowed = {tool["slug"] for tool in TOOLS}
    if slug not in allowed:
        raise HTTPException(status_code=404, detail="Unknown tool.")
    client_ip = request.headers.get("x-crakk-client-ip") or (request.client.host if request.client else "unknown")
    now = time.monotonic()
    bucket = _RATE_BUCKETS[client_ip]
    while bucket and now - bucket[0] > _RATE_WINDOW_SECONDS:
        bucket.popleft()
    if len(bucket) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many conversion requests. Please wait a minute and try again.", headers={"Retry-After": "60"})
    bucket.append(now)
    image_tools = {"images-to-pdf", "convert-image", "resize-image", "compress-image"}
    items = await _read_uploads(files, "image" if slug in image_tools else "pdf")
    try:
        parsed_options = json.loads(options or "{}")
        if not isinstance(parsed_options, dict):
            raise ValueError("Options must be a JSON object.")
        filename, data, mime = _process_tool(slug, items, parsed_options)
        return _response(data, filename, mime)
    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc)
        if "password" in message.lower() or "encrypt" in message.lower():
            raise HTTPException(status_code=422, detail="Password-protected PDFs are not supported.") from exc
        raise HTTPException(status_code=422, detail=message[:240] or "Unable to process this file.") from exc
    finally:
        for upload in files:
            await upload.close()


@app.get("/health")
def health():
    return {"ok": True, "service": APP_NAME, "search": "ready"}


@app.get("/api/search", response_model=SearchResponse)
def search_tools(q: str = Query(min_length=1, max_length=120), limit: int = 8):
    query = _normalise(q)
    limit = max(1, min(int(limit), 8))
    if not query:
        return SearchResponse(query=q, mode="tfidf-char-ngram", results=[])

    mode = "tfidf-char-ngram"
    query_vector = _VECTORIZER.transform([query])
    scores = cosine_similarity(query_vector, _MATRIX)[0]

    # Intent boosts make broad natural-language searches useful without pretending
    # that one ambiguous word identifies a single tool.
    broad_intents = {
        "convert": {"images-to-pdf", "pdf-to-png", "convert-image"},
        "conversion": {"images-to-pdf", "pdf-to-png", "convert-image"},
        "converter": {"images-to-pdf", "pdf-to-png", "convert-image"},
        "image": {"images-to-pdf", "convert-image", "resize-image", "compress-image"},
        "photo": {"images-to-pdf", "convert-image", "resize-image", "compress-image"},
        "pdf": {"images-to-pdf", "pdf-to-png", "merge-pdf", "extract-pdf-pages", "rotate-pdf"},
    }
    for intent, slugs in broad_intents.items():
        if query == intent or query in {f"{intent} tool", f"{intent} tools", f"online {intent}"}:
            for index, tool in enumerate(TOOLS):
                if tool["slug"] in slugs:
                    scores[index] += 0.35

    # Small, transparent exact/alias boosts improve common short queries and typos.
    for index, tool in enumerate(TOOLS):
        name = _normalise(tool["name"])
        aliases = [_normalise(alias) for alias in tool["aliases"]]
        if query == name:
            scores[index] += 0.8
        elif any(query == alias for alias in aliases):
            scores[index] += 0.65
        elif query in name or name in query:
            scores[index] += 0.2
        elif any(query in alias or alias in query for alias in aliases if len(alias) > 3):
            scores[index] += 0.12

    ranked = sorted(enumerate(scores), key=lambda item: float(item[1]), reverse=True)
    cutoff = max(0.15, float(ranked[0][1]) * 0.22) if ranked else 0.15
    results = []
    for index, score in ranked[:limit]:
        if float(score) < cutoff:
            continue
        tool = TOOLS[index]
        results.append({
            "slug": tool["slug"],
            "name": tool["name"],
            "category": tool["category"],
            "url": f"/tools/{tool['slug']}/",
            "score": round(float(score), 4),
        })
    return SearchResponse(query=q, mode=mode, results=results)


@app.get("/api/ai/updates")
def ai_updates(limit: int = Query(default=40, ge=1, le=60), refresh: bool = False):
    if refresh: _AI_FEED_CACHE.update({"expires": 0.0, "payload": None})
    payload = _get_ai_updates()
    payload = dict(payload)
    payload["stories"] = payload["stories"][:limit]
    return payload


@app.get("/api/ai/status")
def ai_status():
    return {
        "python_backend": True,
        "processing_api_key_configured": bool(os.getenv("INTERNAL_API_KEY")),
        "ml_search": "scikit-learn TF-IDF character n-gram retrieval",
        "generative_ai_or_llm": False,
        "paid_ai_api": False,
        "document_ai": "not configured",
        "news": "free public publisher RSS/Atom feeds; no LLM summarization",
        "note": "Tool discovery uses local TF-IDF matching. Publisher titles and descriptions are shown as supplied; no generative model or paid AI API is called.",
    }
