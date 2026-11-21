import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handlers } from '../src/converters.js';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const expected = [
  'images-to-pdf', 'pdf-to-png', 'merge-pdf', 'extract-pdf-pages',
  'rotate-pdf', 'convert-image', 'resize-image', 'compress-image'
];

test('all eight conversion handlers are available in the browser bundle', () => {
  assert.deepEqual(Object.keys(handlers).sort(), [...expected].sort());
  for (const slug of expected) assert.equal(typeof handlers[slug], 'function', `${slug} handler missing`);
});

test('tool UI invokes local handlers and does not upload conversion files to /api/tools', () => {
  const main = read('src/main.js');
  assert.match(main, /import \{handlers as browserConverters\} from '\.\/converters\.js'/);
  assert.match(main, /const converter=browserConverters\[type\]/);
  assert.match(main, /await converter\(files,opts\(\),setProgress\)/);
  assert.doesNotMatch(main, /fetch\(`\/api\/tools\//);
  assert.doesNotMatch(main, /Uploading securely to the Python processing service/);
});

test('PDF to PNG honors page selection, PNG/JPG format and optional original PDF ZIP', () => {
  const converters = read('src/converters.js');
  const pdfToPng = converters.slice(converters.indexOf('export async function pdfToPng'), converters.indexOf('export async function mergePdf'));
  assert.match(pdfToPng, /parsePageRanges\(options\.pages,pdf\.numPages\)/);
  assert.match(pdfToPng, /options\.outputFormat/);
  assert.match(pdfToPng, /options\.includeOriginalPdf/);
  assert.match(pdfToPng, /application\/pdf/);
  assert.match(pdfToPng, /application\/zip|packFiles/);
});

test('generated tool pages disclose local-only processing and retain file-size safeguards', () => {
  const generator = read('scripts/generate-pages.mjs');
  const catalog = read('src/catalog.mjs');
  assert.match(generator, /Files are processed in your browser/);
  assert.match(generator, /Local browser processing\. Your files stay on your device/);
  assert.match(catalog, /processed locally in your browser/i);
  assert.match(read('src/utils.mjs'), /MAX_TOTAL_BYTES = 50 \* 1024 \* 1024/);
});
