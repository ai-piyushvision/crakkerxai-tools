export const tools = [
  {
    slug: 'images-to-pdf',
    title: 'Images to PDF',
    seoTitle: 'Images to PDF Online – JPG, PNG & WebP',
    seoDescription: 'Convert JPG, PNG and WebP images to one PDF online for free. Arrange photos in order and create one page per image in your browser. No file uploads.',
    subtitle: 'Turn PNG & JPG images into one neat PDF.',
    category: 'pdf', accent: 'purple', icon: 'image', button: 'Create PDF',
    accept: 'image/jpeg,image/png,image/webp', multiple: true,
    description: 'Convert JPG, JPEG, PNG and WebP images into one PDF document in your browser. Add multiple pictures, arrange their order and download a PDF with one image per page.',
    seoIntro: 'Use this free images to PDF converter as a JPG to PDF or PNG to PDF tool for pictures and scanned pages. Add several JPG, JPEG, PNG or WebP images, arrange their order, and create one PDF page for each image. Your files are processed locally in your browser.',
    formatDetails: 'Input formats: JPG, JPEG, PNG and WebP. Select multiple image files in one task; the combined input limit is 50 MB. Each image is placed on its own PDF page while keeping its proportions.',
    useCases: [
      'Combine photos of receipts, forms or notes into one PDF.',
      'Turn scanned pages or document pictures into a shareable PDF.',
      'Put multiple JPG, PNG or WebP images into a single file in a chosen order.'
    ],
    related: ['pdf-to-png', 'convert-image', 'compress-image', 'merge-pdf'],
    instructions: [
      'Choose one or more JPG, JPEG, PNG or WebP images.',
      'Use the up and down controls beside each file to arrange the page order. Each image becomes one PDF page.',
      'Select Create PDF and download the combined document when processing finishes.'
    ],
    tips: 'One image per PDF page, at the image proportions. Use ↑ ↓ to reorder files before creating the PDF.',
    example: 'For example, add three receipt photos in date order. The result is a three-page PDF with one photo on each page, ready to share as a single document.',
    limitations: 'The pages contain the original pictures as images; text inside a photo is not converted into selectable or searchable text. The tool does not crop, straighten or run OCR on the pictures. The combined input limit is 50 MB, and very large images may be limited by available browser memory.',
    faq: [
      ['Which image formats can I convert to PDF?', 'You can select JPG, JPEG, PNG and WebP images.'],
      ['Can I combine multiple pictures into one PDF?', 'Yes. Select multiple images and arrange their order before creating the PDF.'],
      ['Are my images uploaded to a server?', 'No. The conversion runs in your browser; selected file contents are not sent to the conversion server.'],
      ['What is the maximum input size?', 'The combined selected files must be 50 MB or less for one task.']
    ]
  },
  {
    slug: 'pdf-to-png',
    title: 'PDF to PNG',
    seoTitle: 'PDF to PNG Converter – PDF to JPG',
    seoDescription: 'Convert PDF pages to PNG or JPG images online. Choose one page or all pages, set 1× to 2× rendering quality, and download results as a ZIP. No file uploads.',
    subtitle: 'Save every PDF page as a high-quality PNG image.',
    category: 'pdf', accent: 'sand', icon: 'file-image', button: 'Convert PDF to PNG',
    accept: '.pdf,application/pdf', multiple: false,
    description: 'Convert PDF pages into PNG or JPG images in your browser. Export all pages or one selected page, choose image quality, and download multiple images in a ZIP file.',
    seoIntro: 'Convert PDF to image files with this browser-based PDF to PNG and PDF to JPG converter. Render every page or choose a single page, select PNG or JPG output, and choose standard, high or extra-high rendering quality. Multi-page results are packaged in a ZIP download.',
    formatDetails: 'Input: PDF files up to 50 MB and 120 pages per task. Output: PNG or JPG. Rendering scale options are 1×, 1.5× and 2×; very large pages may be capped to keep browser memory use manageable.',
    useCases: [
      'Save a PDF page as a PNG image for a presentation or document.',
      'Create JPG or PNG previews of scanned PDF pages.',
      'Convert every page of a PDF into separate images in one ZIP file.'
    ],
    related: ['images-to-pdf', 'extract-pdf-pages', 'merge-pdf', 'rotate-pdf'],
    instructions: [
      'Choose the PDF file you want to convert.',
      'Choose all pages or one page, select PNG or JPG, and set the image quality.',
      'Optionally include the original PDF, then convert and download the image or ZIP file.'
    ],
    tips: 'Choose one page for a single image or all pages for a ZIP of page images. Higher rendering scales can produce larger output files.',
    example: 'A four-page PDF exported as PNG produces four numbered image files in a ZIP. Choosing page 2 instead produces one image for that page.',
    limitations: 'The tool accepts one PDF up to 50 MB and 120 pages per task. Each page is rasterized, so the image output does not retain selectable PDF text, links or vector editing. Higher scale settings use more memory and create larger images.',
    faq: [
      ['Can I convert only one PDF page?', 'Yes. Choose Single page in the export settings and enter the page number.'],
      ['Can I convert PDF to JPG instead of PNG?', 'Yes. Select JPG as the output format before converting.'],
      ['How are multiple pages downloaded?', 'When more than one output file is created, the page images are packaged in a ZIP file.'],
      ['Does PDF to image conversion keep selectable text?', 'No. Each page is rendered as an image, so the output is not an editable text document.'],
      ['Is there a page limit?', 'This browser tool supports up to 120 pages per task and a 50 MB input PDF.']
    ]
  },
  {
    slug: 'merge-pdf',
    title: 'Merge PDF',
    seoTitle: 'Merge PDF Online – Combine Files',
    seoDescription: 'Combine two or more PDF files into one PDF online. Arrange source documents in order, merge their pages and download the result. Files stay in your browser.',
    subtitle: 'Combine several PDF files into one tidy document.',
    category: 'pdf', accent: 'blue', icon: 'files', button: 'Merge PDFs',
    accept: '.pdf,application/pdf', multiple: true,
    description: 'Combine two or more PDF files into one document in your browser. Arrange the files in the order you want, merge their pages and download one PDF.',
    seoIntro: 'Use this free merge PDF online tool to combine multiple PDF files into one document. Select at least two PDFs, arrange the files in the required order, and merge their pages into a single downloadable PDF. Processing takes place in your browser.',
    formatDetails: 'Input: two or more standard PDF files with a combined size of up to 50 MB. Output: one merged PDF. Password-protected or damaged PDFs may not open.',
    useCases: [
      'Combine separate report chapters or project documents.',
      'Join scanned PDF documents and forms into one file.',
      'Put invoices, statements or supporting documents in the required order.'
    ],
    related: ['extract-pdf-pages', 'rotate-pdf', 'pdf-to-png', 'images-to-pdf'],
    instructions: [
      'Select at least two PDF documents.',
      'Move the selected files up or down until they are in the required order.',
      'Click Merge PDFs and download the combined PDF when it is ready.'
    ],
    tips: 'Arrange the source PDFs before merging. The pages are added in the same order as the selected files.',
    example: 'Select a project brief, its appendix and a supporting schedule in that order. The output places every page from the brief first, followed by the appendix and then the schedule.',
    limitations: 'At least two standard PDFs are required and their combined input size must not exceed 50 MB. Damaged or password-protected files may fail to open. Review the merged file before sending it, especially when the source documents contain forms or other interactive elements.',
    faq: [
      ['How many PDF files can I merge?', 'Select at least two PDFs. The combined input size limit is 50 MB per task.'],
      ['Can I change the order before merging?', 'Yes. Use the up and down controls beside each selected file.'],
      ['Can I merge password-protected PDFs?', 'Password-protected PDFs are not supported by this tool.'],
      ['Are my PDFs uploaded?', 'No. PDF merging runs locally in your browser.']
    ]
  },
  {
    slug: 'extract-pdf-pages',
    title: 'Extract PDF Pages',
    seoTitle: 'Extract PDF Pages Online – PDF Extractor',
    seoDescription: 'Extract selected PDF pages online using page numbers or ranges such as 1,3,5-7. Create and download a new PDF with only the pages you need.',
    subtitle: 'Keep only the pages you need from a PDF.',
    category: 'pdf', accent: 'mint', icon: 'scissors', button: 'Extract Pages',
    accept: '.pdf,application/pdf', multiple: false,
    description: 'Extract selected pages from a PDF using individual page numbers or ranges such as 1,3,5-7. Save the chosen pages as a new PDF in your browser.',
    seoIntro: 'Extract pages from a PDF online without changing the original file. Enter individual page numbers, comma-separated selections or ranges such as 1,3,5-7, then create a new PDF containing only the pages you selected. The page order follows your selection.',
    formatDetails: 'Input: one PDF file up to 50 MB. Enter page numbers such as 1,3,5-7 or type all to select every page. The output is a new PDF containing the selected pages.',
    useCases: [
      'Save only the pages needed from a long report or manual.',
      'Create a smaller PDF containing selected forms or attachments.',
      'Separate chosen pages before sharing or combining them with another PDF.'
    ],
    related: ['merge-pdf', 'pdf-to-png', 'rotate-pdf', 'images-to-pdf'],
    instructions: [
      'Choose the PDF document you want to work with.',
      'Enter page numbers or ranges, for example 1,3,5-7. Enter all to keep every page.',
      'Click Extract Pages and download the new PDF containing the selected pages.'
    ],
    tips: 'Use commas for separate pages and a hyphen for a range. Page numbers start at 1 and must exist in the PDF.',
    example: 'Entering 1,3,5-7 creates a new PDF with source pages 1, 3, 5, 6 and 7, in that selected order.',
    limitations: 'The tool works with one PDF up to 50 MB. Every requested page number must exist in the source document. Damaged or password-protected PDFs may not open; the original source file is not changed.',
    faq: [
      ['How do I extract multiple PDF pages?', 'Enter page numbers separated by commas, for example 1,3,6.'],
      ['Can I extract a page range?', 'Yes. Enter a range such as 2-5, or combine ranges and individual pages like 1,3,5-7.'],
      ['Can I extract all pages?', 'Yes. Enter all or leave the page selection blank.'],
      ['Does extraction change my original PDF?', 'No. The tool creates a new PDF and leaves your original file unchanged.']
    ]
  },
  {
    slug: 'rotate-pdf',
    title: 'Rotate PDF',
    seoTitle: 'Rotate PDF Online – Rotate Pages',
    seoDescription: 'Rotate all PDF pages or selected pages by 90, 180 or 270 degrees clockwise. Download the updated PDF; your original file stays unchanged.',
    subtitle: 'Rotate selected PDF pages in a few clicks.',
    category: 'pdf', accent: 'amber', icon: 'rotate', button: 'Rotate PDF',
    accept: '.pdf,application/pdf', multiple: false,
    description: 'Rotate every page in a PDF or selected page numbers by 90, 180 or 270 degrees clockwise. Download the updated PDF after processing in your browser.',
    seoIntro: 'Rotate PDF pages online when a document is sideways or upside down. Choose 90°, 180° or 270° clockwise rotation, apply it to the entire PDF or enter specific page numbers, and download the updated document. The original PDF is not overwritten.',
    formatDetails: 'Input: one PDF file up to 50 MB. Rotation options: 90°, 180° or 270° clockwise. Leave the page field blank to rotate all pages, or enter page numbers and ranges to rotate selected pages.',
    useCases: [
      'Correct sideways pages in a scanned PDF.',
      'Turn upside-down pages in a document or report.',
      'Rotate only selected pages without changing the rest of the PDF.'
    ],
    related: ['extract-pdf-pages', 'merge-pdf', 'pdf-to-png'],
    instructions: [
      'Choose the PDF you want to adjust.',
      'Select 90°, 180° or 270° clockwise. Leave Pages blank to rotate all pages, or enter a selection such as 1,3-5.',
      'Click Rotate PDF and download the updated document.'
    ],
    tips: 'Leave the page selection blank to rotate the whole document. Enter page numbers to rotate only those pages.',
    example: 'When page 4 is sideways but the other pages are already upright, enter 4 and choose 90° clockwise. Only that page receives the rotation change.',
    limitations: 'One PDF up to 50 MB is accepted. Available increments are 90°, 180° and 270° clockwise; arbitrary angles are not supported. Rotation changes page orientation metadata rather than repainting the page contents.',
    faq: [
      ['Can I rotate only one PDF page?', 'Yes. Enter the page number in the Pages field.'],
      ['Which rotation angles are available?', 'You can rotate pages by 90°, 180° or 270° clockwise.'],
      ['Does rotation reduce PDF quality?', 'The tool updates page rotation metadata rather than re-rendering page content.'],
      ['Can I rotate all pages at once?', 'Yes. Leave the Pages field blank to rotate every page.']
    ]
  },
  {
    slug: 'convert-image',
    title: 'Convert Image Format',
    seoTitle: 'Convert Image Online – JPG, PNG & WebP',
    seoDescription: 'Convert JPG, PNG and WebP images online to PNG, JPG or WebP. Set output quality, process multiple pictures and download batch results in a ZIP file.',
    subtitle: 'Change PNG, JPG, and WebP image formats.',
    category: 'image', accent: 'peach', icon: 'repeat', button: 'Convert Images',
    accept: 'image/jpeg,image/png,image/webp', multiple: true,
    description: 'Convert JPG, JPEG, PNG and WebP images to PNG, JPG or WebP in your browser. Convert multiple images in one task and download batch results in a ZIP file.',
    seoIntro: 'Use this online image format converter to change JPG, JPEG, PNG and WebP images, including PNG to JPG or JPG to PNG conversions. Choose the output format and quality, process several pictures in one task, and download the converted images in a ZIP file.',
    formatDetails: 'Input: JPG, JPEG, PNG and WebP. Output: PNG, JPG or WebP. The quality control applies to lossy JPG and WebP encoding; PNG is exported without a lossy quality setting. Combined input is limited to 50 MB.',
    useCases: [
      'Convert PNG screenshots to JPG for smaller, widely compatible files.',
      'Convert JPG or PNG images to WebP for supported websites and apps.',
      'Convert several images to a common format and download them together.'
    ],
    related: ['images-to-pdf', 'resize-image', 'compress-image'],
    instructions: [
      'Choose one or more JPG, JPEG, PNG or WebP images.',
      'Select PNG, JPG or WebP as the output format and adjust quality when available.',
      'Click Convert Images. Download the converted image or the ZIP containing batch results.'
    ],
    tips: 'JPG does not support transparency; transparent areas are filled with white. Choose PNG or WebP when transparency matters.',
    example: 'Convert a group of PNG screenshots to WebP for a website, or export a transparent PNG to JPG when a white background is acceptable. Multiple results are downloaded together as a ZIP.',
    limitations: 'Inputs are JPG/JPEG, PNG and WebP; outputs are PNG, JPG or WebP. JPG cannot keep transparent pixels, which are filled white. The quality setting affects lossy JPG/WebP output, not PNG. Very large images can hit the 30-megapixel canvas limit or browser memory limits.',
    faq: [
      ['Which image formats are supported?', 'The converter accepts JPG, JPEG, PNG and WebP files.'],
      ['Which output formats can I choose?', 'You can export images as PNG, JPG or WebP.'],
      ['Can I convert multiple images at once?', 'Yes. Select multiple images; the results are packaged in a ZIP file.'],
      ['What happens to transparent areas when converting to JPG?', 'JPG does not support transparency, so transparent areas are filled with white.']
    ]
  },
  {
    slug: 'resize-image',
    title: 'Resize Image',
    seoTitle: 'Resize Image Online – Free Image Resizer',
    seoDescription: 'Resize JPG, PNG and WebP images online to custom pixel dimensions. Keep the original aspect ratio or set width and height separately, then download results.',
    subtitle: 'Change image dimensions while keeping them sharp.',
    category: 'image', accent: 'teal', icon: 'maximize', button: 'Resize Images',
    accept: 'image/jpeg,image/png,image/webp', multiple: true,
    description: 'Resize JPG, JPEG, PNG and WebP images to a chosen pixel width. Keep the original aspect ratio or set both width and height, then download the resized images.',
    seoIntro: 'Resize images online by entering the pixel width you need. Use the aspect-ratio option to calculate the matching height automatically, or turn it off to set both dimensions. JPG, JPEG, PNG and WebP images are processed in your browser.',
    formatDetails: 'Input: JPG, JPEG, PNG and WebP. Set width and optional height in pixels; each dimension can be from 1 to 12,000 pixels, subject to a 30-megapixel canvas limit. Multiple results are packaged in a ZIP file.',
    useCases: [
      'Prepare photos for forms, portals or websites that require specific dimensions.',
      'Reduce large image dimensions before sharing or uploading elsewhere.',
      'Create consistently sized image files while preserving aspect ratio.'
    ],
    related: ['compress-image', 'convert-image', 'images-to-pdf'],
    instructions: [
      'Choose one or more JPG, JPEG, PNG or WebP images.',
      'Enter the desired width in pixels. Keep the aspect-ratio option enabled to calculate height automatically, or enter both dimensions.',
      'Click Resize Images and download the resized image or ZIP file.'
    ],
    tips: 'Keep aspect ratio enabled to avoid stretching. Large dimensions can be limited by browser memory and the 30-megapixel canvas safety limit.',
    example: 'A 2400 × 1600 photo resized to 1200 pixels wide becomes 1200 × 800 when aspect ratio is locked. Turn the lock off only when you intentionally need a different width and height.',
    limitations: 'JPG, PNG and WebP inputs are accepted. Each output dimension must be from 1 to 12,000 pixels and the canvas cannot exceed 30 megapixels. The output keeps PNG or WebP when the source filename uses that extension; other supported images are exported as JPG.',
    faq: [
      ['Can I resize an image by pixels?', 'Yes. Enter the target width and, when aspect ratio is disabled, the target height in pixels.'],
      ['Can I keep the original aspect ratio?', 'Yes. Keep the aspect-ratio checkbox enabled and the height is calculated automatically.'],
      ['Which formats can I resize?', 'JPG, JPEG, PNG and WebP images are supported.'],
      ['Can I resize several images together?', 'Yes. Select multiple images and download the resized results in a ZIP file.']
    ]
  },
  {
    slug: 'compress-image',
    title: 'Compress Image',
    seoTitle: 'Compress Images Online – Reduce JPG & PNG',
    seoDescription: 'Compress JPG, PNG and WebP images online. Adjust quality, choose WebP or JPG output, optionally reduce dimensions and download multiple results in a ZIP.',
    subtitle: 'Make images smaller for sharing and websites.',
    category: 'image', accent: 'rose', icon: 'minimize', button: 'Compress Images',
    accept: 'image/jpeg,image/png,image/webp', multiple: true,
    description: 'Compress JPG, JPEG, PNG and WebP images by exporting to WebP or JPG with adjustable quality and optional resizing. Download multiple optimized images in a ZIP file.',
    seoIntro: 'Reduce image file size with this browser-based image compressor. Select JPG, JPEG, PNG or WebP images, choose WebP or JPG output, adjust compression quality, and optionally limit the maximum width or height. Multiple compressed images can be downloaded in one ZIP file.',
    formatDetails: 'Input: JPG, JPEG, PNG and WebP. Output: WebP or JPG. Quality can be adjusted from 30% to 95%; optional maximum dimensions include 800, 1280, 1920 or 2560 pixels. PNG transparency is retained in WebP but filled white in JPG. Combined input is limited to 50 MB.',
    useCases: [
      'Reduce image size before attaching pictures to emails or messages.',
      'Create lighter WebP or JPG versions for web pages.',
      'Resize and compress batches of images for easier sharing.'
    ],
    related: ['resize-image', 'convert-image', 'images-to-pdf'],
    instructions: [
      'Choose one or more JPG, JPEG, PNG or WebP images.',
      'Choose WebP or JPG output, adjust quality, and optionally select a maximum dimension.',
      'Click Compress Images and download the optimized image or ZIP file.'
    ],
    tips: 'A smaller file is not guaranteed for every input; already optimized images may remain similar in size. Use WebP if you need to preserve transparency.',
    example: 'For a 3000 × 2000 photo, choose a 1920-pixel maximum dimension to produce a 1920 × 1280 image, then select WebP and a quality level that suits the intended use.',
    limitations: 'JPG, PNG and WebP inputs are exported as WebP or JPG. Quality can be set from 30% to 95%; maximum dimensions are optional. JPG fills transparent areas with white, while WebP can retain transparency. Compression does not guarantee a smaller file for every source image.',
    faq: [
      ['Can I compress PNG images?', 'Yes. PNG can be selected as an input; output is WebP or JPG. Choose WebP to preserve transparent areas.'],
      ['Will compression always make an image smaller?', 'No. Already optimized images may remain similar in size or occasionally become larger.'],
      ['Can I control image quality?', 'Yes. Choose a quality setting between 30% and 95%.'],
      ['Can I reduce image dimensions too?', 'Yes. Select an optional maximum width or height of 800, 1280, 1920 or 2560 pixels.']
    ]
  }
];

export const bySlug = Object.fromEntries(tools.map(tool => [tool.slug, tool]));
