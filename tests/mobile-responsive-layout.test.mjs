import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const css=fs.readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const generator=fs.readFileSync(new URL('../scripts/generate-pages.mjs',import.meta.url),'utf8');

test('mobile expanded navigation participates in normal document flow',()=>{
  assert.match(css,/Mobile layout regression guard:[\s\S]*?\.header-inner[\s\S]*?height:\s*auto\s*!important/);
  assert.match(css,/\.main-nav\.is-mobile-open[\s\S]*?position:\s*static/);
  assert.match(css,/\.main-nav\.is-mobile-open[\s\S]*?overflow-y:\s*auto/);
});

test('nested Services navigation remains usable on narrow screens',()=>{
  assert.match(css,/\.main-nav \.conversion-tools-menu[\s\S]*?position:\s*static\s*!important/);
  assert.match(generator,/Services[\s\S]*?Conversion tools[\s\S]*?tools\.map/);
});

test('mobile navigation closes after desktop resize',()=>{
  assert.match(main,/addEventListener\('resize',[\s\S]*?innerWidth>780[\s\S]*?close\(\)/);
});

test('account refresh widgets are hidden while authentication forms are visible',()=>{
  assert.match(css,/account-body:has\(#auth-panel:not\(\.hidden\)\)[\s\S]*?\.cx-scroll-widget/);
});

test('mobile account and hero content constrain widths to viewport',()=>{
  assert.match(css,/\.account-page\s*\{[^}]*max-width:\s*100%/);
  assert.match(css,/\.hero-premium\s*\{[^}]*max-width:\s*100%/);
});
