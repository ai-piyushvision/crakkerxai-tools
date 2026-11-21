import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('social provider logos are present in both account page and generated build template',()=>{
  for(const path of ['account/index.html','scripts/generate-pages.mjs']){
    const text=read(path);
    assert.match(text,/google-g-mark\.png/);
    assert.match(text,/github-octocat-mark\.png/);
    assert.match(text,/social-actions[^]*aria-label="Continue with a social account"/);
  }
});

test('account forms use custom concise validation and support four-digit OTP',()=>{
  const html=read('account/index.html');
  const generator=read('scripts/generate-pages.mjs');
  for(const text of [html,generator]){
    assert.match(text,/id="auth-form" class="auth-form" novalidate/);
    assert.match(text,/id="otp-form" class="auth-form" novalidate/);
    assert.match(text,/pattern="\[0-9\]\{4,8\}"/);
  }
});

test('brand icons are transparent PNG assets and CSS does not add white tiles',()=>{
  for(const path of ['public/otp-sms.png','public/otp-whatsapp.png','public/auth/google-g-mark.png','public/auth/github-octocat-mark.png']){
    assert.ok(existsSync(new URL('../'+path,import.meta.url)));
  }
  const css=read('src/styles.css');
  assert.match(css,/\.otp-channel-logo-wrap\{[^}]*background:transparent/);
  assert.match(css,/\.social-logo-shell\{[^}]*background:transparent/);
});

test('auth provider and OTP channel cards use large icons above visible labels',()=>{
  for(const path of ['account/index.html','scripts/generate-pages.mjs']){
    const text=read(path);
    assert.match(text,/class="otp-channel-label"><strong>SMS<\/strong>/);
    assert.match(text,/class="otp-channel-label"><strong>WhatsApp<\/strong>/);
    assert.match(text,/class="social-provider-label">Google<\/span>/);
    assert.match(text,/class="social-provider-label">GitHub<\/span>/);
  }
  const css=read('src/styles.css');
  assert.match(css,/\.otp-channel-option\s*\{[^}]*flex-direction:\s*column/);
  assert.match(css,/\.social-btn\s*\{[^}]*flex-direction:\s*column/);
  assert.match(css,/\.otp-channel-logo-wrap\s*\{[^}]*width:\s*82px/);
  assert.match(css,/\.social-logo-shell\s*\{[^}]*width:\s*82px/);
  assert.match(css,/@media \(max-width: 540px\)[\s\S]*?\.otp-channel-logo-wrap,[\s\S]*?\.social-logo-shell/);
});
