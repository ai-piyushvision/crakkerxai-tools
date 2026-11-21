import unittest
from backend.app.main import search_tools

class SearchTests(unittest.TestCase):
    def test_exact_tool_name(self):
        result = search_tools(q="PDF to PNG")
        self.assertEqual(result.results[0]["slug"], "pdf-to-png")

    def test_alias_search(self):
        result = search_tools(q="jpg to pdf")
        self.assertEqual(result.results[0]["slug"], "images-to-pdf")

    def test_natural_language(self):
        result = search_tools(q="make my picture file smaller")
        self.assertEqual(result.results[0]["slug"], "compress-image")

if __name__ == "__main__":
    unittest.main()
