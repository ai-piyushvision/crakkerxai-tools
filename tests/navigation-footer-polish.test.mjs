import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicPages = [
  'index.html', 'about/index.html', 'contact/index.html', 'faq/index.html',
  'disclaimer/index.html', 'privacy/index.html', 'terms/index.html',
  'how-it-works/index.html', 'pricing/index.html', 'feedback/index.html',
  'ai-updates/index.html', 'account/index.html',
  'tools/images-to-pdf/index.html', 'tools/pdf-to-png/index.html',
  'tools/merge-pdf/index.html', 'tools/extract-pdf-pages/index.html',
  'tools/rotate-pdf/index.html', 'tools/convert-image/index.html',
  'tools/resize-image/index.html', 'tools/compress-image/index.html'
];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function navLabels(html) {
  const nav = html.match(/<nav aria-label="Main navigation" class="main-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  const topLevel = nav.replace(/<div class=\"nav-services\">[\s\S]*?<\/div><\/div>/, '');
  return ['Services', ...[...topLevel.matchAll(/<a href=\"[^\"]+\">([^<]+)<\/a>/g)].map(match => match[1].replace(/&amp;/g, '&').trim())];
}

test('shared header uses the intended task-first navigation sequence on every page', () => {
  const expected = ['Services', 'How it works', 'Plans', 'AI updates', 'Support', 'Privacy'];
  for (const page of publicPages) {
    const html = read(page);
    assert.deepEqual(navLabels(html), expected, page);
    assert.match(html, /data-services-toggle[\s\S]*data-conversion-toggle[\s\S]*class=\"conversion-tools-menu\"/, page);
    for (const tool of ['Images to PDF','PDF to PNG','Merge PDF','Extract PDF Pages','Rotate PDF','Convert Image Format','Resize Image','Compress Image']) assert.ok(html.includes(tool), `${page}: ${tool}`);
  }
});

test('footer groups are compact and use consistent service/workspace labels', () => {
  const html = read('index.html');
  assert.match(html, /<strong>Services &amp; support<\/strong>/);
  assert.match(html, /<strong>Policies &amp; resources<\/strong>/);
  assert.match(html, /data-conversion-toggle[\s\S]*<strong>Conversion tools<\/strong>/);
  assert.match(html, />Workspace<\/a>/);
  assert.doesNotMatch(html, />My account<\/a>|>Your account<\/a>/i);
  const css = read('src/styles.css');
  assert.match(css, /\.footer-links\{[\s\S]*?display:grid/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:480px\)[\s\S]*?\.footer-links\{grid-template-columns:1fr/);
});

test('account and profile fallbacks use professional workspace terminology', () => {
  const account = read('account/index.html');
  const accountPage = read('src/account-page.js');
  const accountMenu = read('src/account-menu.js');
  assert.match(account, />Workspace<\/strong>/);
  assert.match(account, />Profile &amp; preferences<\/button>/);
  assert.match(accountPage, /Your <span>workspace\.<\/span>/);
  assert.match(accountPage, /'Workspace'/);
  assert.match(accountMenu, /'Workspace'/);
  assert.doesNotMatch(accountPage + accountMenu, /'My account'|'Your account'/i);
});

test('mobile navigation exposes Services and all conversion tools with accessible controls', () => {
  const html = read('index.html');
  assert.match(html, /data-mobile-nav-toggle[\s\S]*aria-controls="primary-navigation"/);
  assert.match(html, /data-services-toggle/);
  assert.match(html, /data-conversion-toggle/);
  assert.match(html, /class=\"conversion-tools-menu\"[\s\S]*Images to PDF[\s\S]*PDF to PNG[\s\S]*Merge PDF[\s\S]*Extract PDF Pages[\s\S]*Rotate PDF[\s\S]*Convert Image Format[\s\S]*Resize Image[\s\S]*Compress Image/);
  assert.match(read('scripts/generate-pages.mjs'), /tools\.map\(tool=>/); // future catalog additions automatically enter this submenu
  const css = read('src/styles.css');
  assert.match(css, /@media\(max-width:780px\)[\s\S]*?\.main-nav\.is-mobile-open/);
  assert.match(read('src/main.js'), /function initResponsiveNavigation/);
});

test('homepage audience copy includes enterprise and organization use cases', () => {
  const html = read('index.html');
  assert.match(html, /Enterprise and large organizations/);
  assert.match(html, /Developers and professional teams/);
  assert.doesNotMatch(html, /Creators and small businesses/);
});

test('scroll reveal respects reduced-motion preferences', () => {
  assert.match(read('src/main.js'), /function initScrollReveal/);
  assert.match(read('src/styles.css'), /prefers-reduced-motion:reduce/);
  assert.match(read('src/styles.css'), /reveal-on-scroll\.is-in-view/);
});
