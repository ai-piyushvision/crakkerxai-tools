import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const sources = [
  'server/msg91-auth.js',
  'server/worker.js',
  'msg91_patch/msg91-auth.js'
];

test('Cloudflare Worker fetch calls never use the unsupported redirect:error mode', () => {
  const combined = sources.map(path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).join('\n');
  assert.doesNotMatch(combined, /redirect\s*:\s*['"]error['"]/);
  assert.match(readFileSync(new URL('../server/msg91-auth.js', import.meta.url), 'utf8'), /verifyAccessToken[\s\S]*?redirect\s*:\s*['"]manual['"]/);
});
