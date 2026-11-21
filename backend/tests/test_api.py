import io
import unittest
import zipfile
from fastapi.testclient import TestClient
from PIL import Image
from pypdf import PdfWriter
from backend.app.main import app

class ProcessingApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        image = Image.new("RGB", (24, 18), "red")
        image_buffer = io.BytesIO()
        image.save(image_buffer, format="PNG")
        cls.png = image_buffer.getvalue()
        writer = PdfWriter()
        writer.add_blank_page(width=72, height=72)
        pdf_buffer = io.BytesIO()
        writer.write(pdf_buffer)
        cls.pdf = pdf_buffer.getvalue()
        multi_writer = PdfWriter()
        multi_writer.add_blank_page(width=72, height=72)
        multi_writer.add_blank_page(width=72, height=72)
        multi_buffer = io.BytesIO()
        multi_writer.write(multi_buffer)
        cls.multi_pdf = multi_buffer.getvalue()

    def post(self, slug, uploads, options="{}"):
        response = self.client.post(f"/api/tools/{slug}", files=uploads, data={"options": options})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertGreater(len(response.content), 0)
        return response

    def test_health_and_search(self):
        self.assertTrue(self.client.get("/health").json()["ok"])
        result = self.client.get("/api/search", params={"q": "jpg to pdf"}).json()
        self.assertEqual(result["results"][0]["slug"], "images-to-pdf")

    def test_all_eight_python_processors(self):
        self.assertEqual(self.post("images-to-pdf", [("files", ("a.png", self.png, "image/png"))]).headers["content-type"], "application/pdf")
        self.assertEqual(self.post("pdf-to-png", [("files", ("a.pdf", self.pdf, "application/pdf"))]).headers["content-type"], "image/png")
        self.assertEqual(self.post("merge-pdf", [("files", ("a.pdf", self.pdf, "application/pdf")), ("files", ("b.pdf", self.pdf, "application/pdf"))]).headers["content-type"], "application/pdf")
        self.assertEqual(self.post("extract-pdf-pages", [("files", ("a.pdf", self.pdf, "application/pdf"))], '{"pages":"1"}').headers["content-type"], "application/pdf")
        self.assertEqual(self.post("rotate-pdf", [("files", ("a.pdf", self.pdf, "application/pdf"))], '{"angle":90,"pages":"all"}').headers["content-type"], "application/pdf")
        self.assertEqual(self.post("convert-image", [("files", ("a.png", self.png, "image/png"))], '{"format":"webp"}').headers["content-type"], "image/webp")
        self.assertEqual(self.post("resize-image", [("files", ("a.png", self.png, "image/png"))], '{"width":12,"lockAspect":true}').headers["content-type"], "image/png")
        self.assertEqual(self.post("compress-image", [("files", ("a.png", self.png, "image/png"))], '{"format":"webp"}').headers["content-type"], "image/webp")


    def test_pdf_to_image_single_page_jpg(self):
        response = self.post(
            "pdf-to-png",
            [("files", ("sample.pdf", self.multi_pdf, "application/pdf"))],
            '{"pages":"2","outputFormat":"jpg"}',
        )
        self.assertEqual(response.headers["content-type"], "image/jpeg")
        self.assertIn("page-002.jpg", response.headers["content-disposition"])

    def test_pdf_to_image_all_pages_zip(self):
        response = self.post(
            "pdf-to-png",
            [("files", ("sample.pdf", self.multi_pdf, "application/pdf"))],
            '{"pages":"all","outputFormat":"png"}',
        )
        self.assertEqual(response.headers["content-type"], "application/zip")
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            self.assertEqual(archive.namelist(), ["page-001.png", "page-002.png"])

    def test_pdf_and_images_downloaded_together(self):
        response = self.post(
            "pdf-to-png",
            [("files", ("sample.pdf", self.multi_pdf, "application/pdf"))],
            '{"pages":"1","outputFormat":"png","includeOriginalPdf":true}',
        )
        self.assertEqual(response.headers["content-type"], "application/zip")
        with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
            self.assertIn("sample-original.pdf", archive.namelist())
            self.assertIn("page-001.png", archive.namelist())

    def test_reject_wrong_file_type(self):
        response = self.client.post("/api/tools/pdf-to-png", files=[("files", ("not-a-pdf.png", self.png, "image/png"))], data={"options": "{}"})
        self.assertEqual(response.status_code, 415)

if __name__ == "__main__":
    unittest.main()
