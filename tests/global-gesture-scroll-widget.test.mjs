import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const guard = readFileSync(new URL('../src/browser-gesture-guard.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const account = readFileSync(new URL('../src/account-page.js', import.meta.url), 'utf8');
const generator = readFileSync(new URL('../scripts/generate-pages.mjs', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('horizontal gesture guard is global, not account-page-only', () => {
  assert.match(main, /initBrowserGestureGuard\(\);initTheme\(\)/);
  assert.match(guard, /addEventListener\('touchstart'/);
  assert.match(guard, /addEventListener\('touchmove'/);
  assert.match(guard, /addEventListener\('wheel'/);
  assert.match(guard, /event\.preventDefault\(\)/);
});

test('native horizontal overscroll is contained while vertical scroll remains enabled', () => {
  assert.match(css, /overscroll-behavior-x:\s*none\s*!important/);
});

test('all scroll-to-top buttons are text controls, not up-arrow glyphs', () => {
  assert.match(main, /class="cx-float-top"[^>]*>Top<\/button>/);
  assert.match(account, /class="cx-scroll-widget-top"[^>]*><span class="cx-scroll-widget-top-label">Top<\/span>/);
  assert.doesNotMatch(generator, /data-dash-top/);
  assert.doesNotMatch(account, /class="cx-scroll-widget-top"[^>]*>\s*↑/);
});

test('refresh control remains separate from scroll-to-top control', () => {
  assert.match(account, /class="cx-scroll-widget-refresh"/);
  assert.match(account, /class="cx-scroll-widget-top-label">Top/);
  assert.match(css, /\.cx-scroll-widget-refresh\.is-refreshing/);
});
