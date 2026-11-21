import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);

test('OTP form accepts the configured 4-, 6- and 8-digit MSG91 widget formats',async()=>{
  const html=await readFile(new URL('account/index.html',root),'utf8');
  assert.match(html,/id="otp-code"[^>]*pattern="\[0-9\]\{4,8\}"[^>]*minlength="4"[^>]*maxlength="8"/);
  assert.doesNotMatch(html,/id="otp-code"[^>]*pattern="\[0-9\]\{6,8\}"/);
});

test('MSG91 verification failure forces a fresh OTP instead of allowing reuse of an already-verified code',async()=>{
  const source=await readFile(new URL('src/account-page.js',root),'utf8');
  assert.match(source,/let msg91ProofVerified=false/);
  assert.match(source,/The provider has already verified that code\. Request a fresh/);
  assert.match(source,/channel:otpContext\.channel\|\|'sms'/);
});

test('Worker observability logs and traces are enabled for production diagnostics',async()=>{
  const config=JSON.parse(await readFile(new URL('wrangler.jsonc',root),'utf8'));
  assert.equal(config.observability.enabled,true);
  assert.equal(config.observability.logs.enabled,true);
  assert.equal(config.observability.logs.invocation_logs,true);
  assert.equal(config.observability.traces.enabled,true);
});
