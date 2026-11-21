import io
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app import main


class AiUpdatesTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)
        main._AI_FEED_CACHE.update({"expires": 0.0, "payload": None})

    def test_ai_updates_endpoint_returns_live_feed_shape(self):
        sample = {
            "ok": True,
            "last_checked": "2026-11-17T10:00:00+00:00",
            "refresh_seconds": 900,
            "stories": [
                {"title": "Python 3.14.0 release", "description": "New runtime release.", "url": "https://python.org/", "source": "Python.org", "category": "Python", "published_at": "2026-11-17T09:00:00+00:00", "versions": ["3.14.0"]},
                {"title": "PyTorch v2.8.0", "description": "Framework update.", "url": "https://pytorch.org/", "source": "PyTorch", "category": "Python & Frameworks", "published_at": "2026-11-16T09:00:00+00:00", "versions": ["2.8.0"]},
            ],
            "sources": [{"name": "Python.org", "category": "Python", "url": "https://python.org/feed", "status": "available"}],
            "available_sources": 1,
            "total_sources": 1,
            "note": "Publisher supplied information.",
        }
        with patch.object(main, "_get_ai_updates", return_value=sample):
            response = self.client.get("/api/ai/updates?limit=1")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["stories"]), 1)
        self.assertEqual(body["stories"][0]["versions"], ["3.14.0"])
        self.assertEqual(body["available_sources"], 1)

    def test_feed_parser_extracts_title_description_and_version(self):
        xml = b'''<?xml version="1.0"?><rss version="2.0"><channel><item><title>Python 3.14.0 is now available</title><link>https://www.python.org/downloads/</link><description><![CDATA[<p>Download Python 3.14.0 with improvements.</p>]]></description><pubDate>Tue, 17 Nov 2026 09:00:00 GMT</pubDate></item></channel></rss>'''
        class FakeResponse(io.BytesIO):
            def __enter__(self): return self
            def __exit__(self, *args): self.close()
        with patch("backend.app.main.urllib.request.urlopen", return_value=FakeResponse(xml)):
            stories, error = main._fetch_ai_feed({"source": "Python.org", "category": "Python", "url": "https://example.org/feed"})
        self.assertIsNone(error)
        self.assertEqual(stories[0]["title"], "Python 3.14.0 is now available")
        self.assertEqual(stories[0]["versions"], ["3.14.0"])
        self.assertIn("improvements", stories[0]["description"])


if __name__ == "__main__":
    unittest.main()
