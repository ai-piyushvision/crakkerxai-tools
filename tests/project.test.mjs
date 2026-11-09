import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {tools} from '../src/catalog.mjs';
test('eight distinct tool pages',()=>{
  assert.equal(tools.length,8);assert.equal(new Set(tools.map(t=>t.slug)).size,8);
  for(const t of tools){const page=fs.readFileSync(`tools/${t.slug}/index.html`,'utf8');assert.ok(page.includes(`<h1>${t.title}</h1>`));assert.ok(page.includes('name="google-adsense-account"'));}
});
test('ads.txt is correctly formatted',()=>{
  assert.equal(fs.readFileSync('public/ads.txt','utf8').trim(),'google.com, pub-8574777140654469, DIRECT, f08c47fec0942fa0');
});
test('no file transfer in conversion logic',()=>{
  const code=fs.readFileSync('src/converters.js','utf8');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(code),'Conversion engine must be local');
});
test('sitemap includes tool pages',()=>{
  const s=fs.readFileSync('public/sitemap.xml','utf8');
  for(const t of tools)assert.ok(s.includes(`https://www.crakkerxai.com/tools/${t.slug}/`));
});
