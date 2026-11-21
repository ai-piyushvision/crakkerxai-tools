import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const generator=readFileSync(new URL('../scripts/generate-pages.mjs',import.meta.url),'utf8');
const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const guard=readFileSync(new URL('../src/browser-gesture-guard.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('critical theme and blocking stylesheet are emitted in document head before body',()=>{
  assert.match(generator,/<style id="cx-critical-theme">[\s\S]*?<\/style><link rel="stylesheet" href="\$\{at\('src\/styles\.css'\)\}"\/>/);
  assert.match(generator,/html,body\{margin:0;min-height:100%;background:#070a10/);
  assert.match(generator,/html\[data-theme="light"\],html\[data-theme="light"\] body\{background:#f4f6fb/);
});

test('CSS is not deferred through the JavaScript module entry point',()=>{
  assert.doesNotMatch(main,/import\s+['"]\.\/styles\.css['"]/);
});

test('all pages use global gesture guard and right-button horizontal drags are cancelled',()=>{
  assert.match(main,/initBrowserGestureGuard\(\)/);
  assert.match(guard,/event\.button === 2/);
  assert.match(guard,/rightDrag\.dragged = true/);
  assert.match(guard,/event\.preventDefault\(\)/);
  assert.match(guard,/event\.stopPropagation\(\)/);
  assert.match(guard,/suppressContextMenu/);
});

test('vertical scroll and intentional horizontal table scroll remain enabled',()=>{
  assert.match(guard,/deltaX/);
  assert.match(css,/touch-action:pan-x pan-y pinch-zoom/);
  assert.match(css,/overscroll-behavior-x:contain/);
});
