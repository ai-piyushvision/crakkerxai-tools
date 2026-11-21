import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/account-page.js',import.meta.url),'utf8');

test('account uses contained overscroll to suppress native browser pull/edge indicators',()=>{
  assert.match(css,/overscroll-behavior:\s*none!important/);
  assert.match(css,/overscroll-behavior-y:\s*contain!important/);
  assert.match(css,/overscroll-behavior-x:\s*none!important/);
});

test('account adds accessible refresh and scroll-to-top controls',()=>{
  assert.match(js,/className='cx-scroll-widget'/);
  assert.match(js,/aria-label="Refresh page"/);
  assert.match(js,/aria-label="Scroll to top"/);
  assert.match(js,/window\.scrollTo\(\{top:0,behavior:'smooth'\}\)/);
  assert.match(css,/\.cx-scroll-widget/);
});

test('mobile pull-to-refresh shows a branded spinner instead of a browser arrow',()=>{
  assert.match(js,/className='cx-pull-refresh'/);
  assert.match(js,/Release to refresh/);
  assert.match(js,/Refreshing…/);
  assert.match(css,/\.cx-pull-refresh-spinner/);
  assert.match(css,/@keyframes cxRefreshSpin/);
});

test('refresh controls initialize once on the account page',()=>{
  assert.match(js,/function initRefreshScrollWidgets\(\)/);
  assert.match(js,/export async function initAccount\(\)\{\s*initRefreshScrollWidgets\(\)/);
});
