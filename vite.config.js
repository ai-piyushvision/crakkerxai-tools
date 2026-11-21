import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const slugs = [
  'images-to-pdf', 'pdf-to-png', 'merge-pdf', 'extract-pdf-pages',
  'rotate-pdf', 'convert-image', 'resize-image', 'compress-image'
];
const pageFiles = ['index.html', 'about/index.html','contact/index.html','faq/index.html','disclaimer/index.html','privacy/index.html','terms/index.html','how-it-works/index.html','pricing/index.html','account/index.html','feedback/index.html','ai-updates/index.html', ...slugs.map(x => `tools/${x}/index.html`)];
export default defineConfig({
  base: './',
  server: { proxy: { '/api/search': { target: 'http://127.0.0.1:8000', changeOrigin: true }, '/api/tools': { target: 'http://127.0.0.1:8000', changeOrigin: true }, '/api/ai': { target: 'http://127.0.0.1:8000', changeOrigin: true } } },
  build: {
    target: 'es2022',
    rollupOptions: { input: Object.fromEntries(pageFiles.map(p => [p.replaceAll('/','_'), resolve(p)])) }
  }
});
