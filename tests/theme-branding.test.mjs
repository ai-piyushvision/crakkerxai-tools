import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('theme switch labels the modes Morning and Night', async () => {
  const main = await read('src/main.js');
  const account = await read('account/index.html');
  assert.match(main, /theme==='dark'\?'Morning Mode':'Night Mode'/);
  assert.match(main, /theme==='dark'\?'🌅':'🌙'/);
  assert.match(account, /data-theme-label>Morning Mode<\/span>/);
});

test('mobile channel selector uses local supplied logo assets', async () => {
  const account = await read('account/index.html');
  const generator = await read('scripts/generate-pages.mjs');
  const css = await read('src/styles.css');
  assert.match(account, /otp-sms\.png/);
  assert.match(account, /otp-whatsapp\.png/);
  assert.match(generator, /otp-sms\.png/);
  assert.match(generator, /otp-whatsapp\.png/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:540px\)[\s\S]*?otp-channel-logo-wrap/);
  await access(new URL('../public/otp-sms.png', import.meta.url), constants.R_OK);
  await access(new URL('../public/otp-whatsapp.png', import.meta.url), constants.R_OK);
});

test('theme label stays visible on mobile', async () => {
  const css = await read('src/styles.css');
  assert.doesNotMatch(css, /\.theme-toggle \[data-theme-label\]\{display:none\}/);
  assert.match(css, /data-theme-label\]\{display:inline!important;font-size:9px/);
});
