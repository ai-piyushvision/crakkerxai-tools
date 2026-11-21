import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('mobile OTP requires a channel choice before requesting a code',()=>{
 const html=read('account/index.html');
 const generator=read('scripts/generate-pages.mjs');
 const js=read('src/account-page.js');
 assert.match(html,/id="phone-otp-channel-field"/);
 assert.match(html,/value="sms"/);
 assert.match(html,/value="whatsapp"/);
 assert.match(generator,/id=\"phone-otp-channel-field\"/);
 assert.match(generator,/id=\"otp-channel-whatsapp\"/);
 assert.match(js,/sendMsg91Otp\(value,config,selectedPhoneOtpChannel\)/);
 assert.match(js,/channel:selectedPhoneOtpChannel/);
});

test('SMS and WhatsApp channel credentials are independently exposed by the Worker config',()=>{
 const worker=read('server/worker.js');
 assert.match(worker,/msg91SmsWidgetId:phoneAuthConfig\(env\)\.smsWidgetId/);
 assert.match(worker,/msg91WhatsappWidgetId:phoneAuthConfig\(env\)\.whatsappWidgetId/);
});

test('WhatsApp cannot silently fall back to the SMS widget',()=>{
 const adapter=read('src/msg91-widget.js');
 assert.match(adapter,/WhatsApp OTP is not connected yet/);
 assert.match(adapter,/if \(channel === 'whatsapp'\)/);
});

test('OAuth disabled provider errors explain that Supabase provider setup is required',()=>{
 const errors=read('src/oauth-errors.mjs');
 assert.match(errors,/provider is not enabled/);
 assert.match(errors,/Authentication → Sign In \/ Providers/);
});
