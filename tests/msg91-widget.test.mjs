import test from 'node:test';
import assert from 'node:assert/strict';
import {sendMsg91Otp} from '../src/msg91-widget.js';

test('MSG91 AuthenticationFailure is translated into actionable widget configuration guidance',async()=>{
 const previousWindow=globalThis.window;
 globalThis.window={
  initSendOTP:async()=>{
   globalThis.window.sendOtp=(_phone,_success,onError)=>onError('AuthenticationFailure');
   globalThis.window.verifyOtp=()=>{};
  }
 };
 try{
  await assert.rejects(
   sendMsg91Otp('+919876543210',{msg91Enabled:true,msg91WidgetId:'test-widget',msg91WidgetToken:'browser-token'}),
   /MSG91 rejected the selected OTP widget.*CrakkerXOTP.*MSG91_WIDGET_TOKEN.*MSG91_AUTHKEY.*www\.crakkerxai\.com/
  );
 }finally{
  if(previousWindow===undefined)delete globalThis.window;
  else globalThis.window=previousWindow;
 }
});


test('initial SMS OTP uses the selected SMS widget, not the WhatsApp widget',async()=>{
 const oldWindow=globalThis.window;const calls=[];
 globalThis.window={
  initSendOTP:({widgetId})=>{calls.push(['init',widgetId]);globalThis.window.sendOtp=(phone,ok)=>{calls.push(['send',phone]);ok({reqId:'sms-request-123456'});};globalThis.window.verifyOtp=()=>{};},
  document:undefined
 };
 try{
  const {reqId,channel}=await sendMsg91Otp('+919876543210',{msg91Enabled:true,msg91WidgetId:'legacy-sms-id',msg91WidgetToken:'legacy-sms-token',msg91SmsEnabled:true,msg91SmsWidgetId:'sms-primary-id',msg91SmsWidgetToken:'sms-primary-token',msg91WhatsappEnabled:true,msg91WhatsappWidgetId:'wa-primary-id',msg91WhatsappWidgetToken:'wa-primary-token'},'sms');
  assert.equal(reqId,'sms-request-123456');assert.equal(channel,'sms');
  assert.deepEqual(calls,[['init','sms-primary-id'],['send','919876543210']]);
 }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});

test('initial WhatsApp OTP requires and uses the dedicated WhatsApp-primary widget',async()=>{
 const oldWindow=globalThis.window;const calls=[];
 globalThis.window={
  initSendOTP:({widgetId})=>{calls.push(['init',widgetId]);globalThis.window.sendOtp=(phone,ok)=>{calls.push(['send',phone]);ok({reqId:'wa-request-123456'});};globalThis.window.verifyOtp=()=>{};},
  document:undefined
 };
 try{
  const {reqId,channel}=await sendMsg91Otp('+919876543210',{msg91Enabled:true,msg91WidgetId:'sms-id',msg91WidgetToken:'sms-token',msg91WhatsappEnabled:true,msg91WhatsappWidgetId:'wa-primary-id',msg91WhatsappWidgetToken:'wa-primary-token'},'whatsapp');
  assert.equal(reqId,'wa-request-123456');assert.equal(channel,'whatsapp');
  assert.deepEqual(calls,[['init','wa-primary-id'],['send','919876543210']]);
 }finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});

test('WhatsApp cannot silently fall back to SMS when its own widget is not configured',async()=>{
 const oldWindow=globalThis.window;globalThis.window={};
 try{await assert.rejects(sendMsg91Otp('+919876543210',{msg91Enabled:true,msg91WidgetId:'sms-id',msg91WidgetToken:'sms-token'},'whatsapp'),/WhatsApp OTP is not connected yet/);}
 finally{if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;}
});

test('mobile OTP channel picker is an enabled horizontal icon-card selector',async()=>{
 const fs=await import('node:fs/promises');
 const html=await fs.readFile(new URL('../account/index.html',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 const js=await fs.readFile(new URL('../src/account-page.js',import.meta.url),'utf8');
 assert.match(html,/otp-channel-options/);
 assert.match(html,/sms-icon/);
 assert.match(html,/whatsapp-icon/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(js,/sms\.disabled=!smsEnabled|whatsapp\.disabled=!whatsappEnabled/);
});

test('OAuth provider buttons have theme-aware supplied logos and mobile layout',async()=>{
 const fs=await import('node:fs/promises');
 const html=await fs.readFile(new URL('../account/index.html',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(html,/google-g-mark\.png/);
 assert.match(html,/github-octocat-mark\.png/);
 assert.match(css,/social-logo-google-shell/);
 assert.match(css,/social-logo-github-shell/);
 assert.match(css,/@media\(max-width:540px\)\{\.social-actions/);
});


test('account page contains the visible MSG91 CAPTCHA render target used by the SDK',async()=>{
 const fs=await import('node:fs/promises');
 const html=await fs.readFile(new URL('../account/index.html',import.meta.url),'utf8');
 const css=await fs.readFile(new URL('../src/styles.css',import.meta.url),'utf8');
 const js=await fs.readFile(new URL('../src/msg91-widget.js',import.meta.url),'utf8');
 assert.match(html,/<div id="msg91-captcha" class="msg91-captcha-mount"/);
 assert.match(js,/captchaRenderId:\s*'msg91-captcha'/);
 assert.match(js,/function ensureCaptchaMount\(\)/);
 assert.match(css,/\.msg91-captcha-mount\{display:block/);
});

test('MSG91 invalid CAPTCHA error explains that OTP generation and OTP logs are not reached',async()=>{
 const previousWindow=globalThis.window;
 globalThis.window={
  location:{origin:'https://crakkerxai.com'},
  initSendOTP:async()=>{
   globalThis.window.sendOtp=(_phone,_success,onError)=>onError('Invalid Captcha Token');
   globalThis.window.verifyOtp=()=>{};
  }
 };
 try{
  await assert.rejects(
   sendMsg91Otp('+919876543210',{msg91Enabled:true,msg91WidgetId:'test-widget',msg91WidgetToken:'browser-token'}),
   /CAPTCHA verification failed.*crakkerxai\.com.*before OTP generation.*no OTP delivery\/log entry is expected/
  );
 }finally{
  if(previousWindow===undefined)delete globalThis.window;
  else globalThis.window=previousWindow;
 }
});
