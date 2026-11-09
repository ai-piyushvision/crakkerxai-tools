import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const slugs = [
  'images-to-pdf', 'pdf-to-png', 'merge-pdf', 'extract-pdf-pages',
  'rotate-pdf', 'convert-image', 'resize-image', 'compress-image'
];
const pageFiles = ['index.html', 'about/index.html','privacy/index.html','terms/index.html','how-it-works/index.html','pricing/index.html','account/index.html', ...slugs.map(x => `tools/${x}/index.html`)];
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rollupOptions: { input: Object.fromEntries(pageFiles.map(p => [p.replaceAll('/','_'), resolve(p)])) }
  }
});
