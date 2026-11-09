import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('Cloudflare guide uses Vite build output',()=>{
  const guide=read('docs/DEPLOY_GITHUB_CLOUDFLARE_HI.md');
  assert.match(guide,/npm run build/);
  assert.match(guide,/`dist`/);
});
test('AdSense meta present and ads.txt correct',()=>{
  assert.match(read('index.html'),/google-adsense-account/);
  assert.equal(read('public/ads.txt').trim(),'google.com, pub-8574777140654469, DIRECT, f08c47fec0942fa0');
});
test('No forced download timer and separate labeled ad slot',()=>{
  const converter=read('src/main.js');
  const generator=read('scripts/generate-pages.mjs');
  assert.match(generator,/Advertisements/);
  assert.match(converter,/mountAd\(\)/);
  assert.doesNotMatch(converter,/setTimeout|setInterval/);
});
