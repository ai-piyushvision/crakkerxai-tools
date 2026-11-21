import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/account-page.js',import.meta.url),'utf8');
const guard=readFileSync(new URL('../src/browser-gesture-guard.js',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const generator=readFileSync(new URL('../scripts/generate-pages.mjs',import.meta.url),'utf8');

test('account dashboard shows one profile control, keeping shared header profile',()=>{
  assert.match(css,/body\.account-body #dashboard:not\(\.hidden\) \.dash-user-menu-wrap\{\s*display:none!important/);
  assert.match(generator,/class="account-menu hidden" data-account-menu/);
  assert.match(generator,/class="dash-user-menu-wrap"/);
});

test('horizontal edge gestures are guarded without reloading dashboard views',()=>{
  assert.match(guard,/function initBrowserGestureGuard\(\)/);
  assert.match(guard,/edgeTouch/);
  assert.match(guard,/event\.preventDefault\(\)/);
  assert.match(guard,/const horizontal = Math\.abs\(event\.deltaX\)/);
  assert.match(css,/overscroll-behavior-x:none!important/);
  assert.match(main,/initBrowserGestureGuard\(\);initTheme\(\)/);
  assert.match(js,/history\.replaceState\(null,'',url\)/);
});

test('gesture guard preserves intended horizontal file table scrolling',()=>{
  assert.match(guard,/\.cx-allow-horizontal-scroll,\[data-allow-horizontal-scroll\],\.dash-table-scroll/);
});
