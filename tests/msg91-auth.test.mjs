import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/worker.js';

const BASE='https://knhduwfwngrffnlxbnwt.supabase.co';
const minimalEnv={MSG91_AUTHKEY:'test-msg91-authkey',MSG91_WIDGET_ID:'wa-widget-id',MSG91_SMS_WIDGET_ID:'sms-widget-id',MSG91_WIDGET_TOKEN:'test-sms-widget-token',SUPABASE_SERVICE_ROLE_KEY:'test-service-role'};
const jwt='header.payload.signature';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

 test('MSG91 is enabled from safe project defaults when optional public Supabase vars are not duplicated in Worker settings',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async url=>{
   if(new URL(url).pathname==='/rest/v1/account_password_security')return json([]);
   throw new Error(`Unexpected fetch ${url}`);
  };
  try{
   const req=new Request('https://www.crakkerxai.com/api/config');
   const res=await worker.fetch(req,minimalEnv);const body=await res.json();
   assert.equal(res.status,200);assert.equal(body.authEnabled,true);assert.equal(body.serverDatabaseEnabled,true);assert.equal(body.msg91Enabled,true);
   assert.equal(body.passwordPolicyReady,true);
   assert.equal(body.supabaseUrl,BASE);assert.equal(body.msg91WidgetToken,'test-sms-widget-token');assert.equal(body.msg91SmsEnabled,true);assert.equal(body.msg91WhatsappEnabled,true);assert.equal(body.MSG91_AUTHKEY,undefined);assert.equal(body.SUPABASE_SERVICE_ROLE_KEY,undefined);
  }finally{globalThis.fetch=original;}
 });


test('a partial custom Supabase project override cannot accidentally mix URL and key from different projects',async()=>{
 const req=new Request('https://www.crakkerxai.com/api/config');
 const res=await worker.fetch(req,{...minimalEnv,SUPABASE_URL:'https://another-project.supabase.co'});
 const body=await res.json();
 assert.equal(body.authEnabled,false);assert.equal(body.msg91Enabled,false);
});

test('legacy mobile-only signup endpoint rejects requests so new accounts use unified email plus phone verification',async()=>{
 const req=new Request('https://www.crakkerxai.com/api/auth/msg91',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:jwt,signup:true,fullName:'Test User'})});
 const res=await worker.fetch(req,minimalEnv);const body=await res.json();
 assert.equal(res.status,400);assert.equal(body.code,'UNIFIED_SIGNUP_REQUIRED');
});

test('verified MSG91 login reuses the existing phone identity instead of creating a second account',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);calls.push({url:String(url),method:options.method||'GET'});
  if(u.hostname==='control.msg91.com')return json({type:'success',message:{identifier:'919876543210'}});
  if(u.pathname==='/rest/v1/msg91_otp_redemptions')return json([{token_sha256:'digest'}],201);
  if(u.pathname==='/rest/v1/msg91_phone_identities'&&(options.method||'GET')==='GET')return json([{auth_user_id:'existing-user'}]);
  if(u.pathname==='/auth/v1/admin/users/existing-user')return json({user:{id:'existing-user',email:'mobile-old@auth.crakkerxai.com',phone:'+919876543210'}});
  if(u.pathname==='/auth/v1/admin/generate_link')return json({hashed_token:'login-hash'});
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/msg91',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:jwt,signup:false})});
  const res=await worker.fetch(req,minimalEnv);const body=await res.json();
  assert.equal(res.status,200);assert.equal(body.tokenHash,'login-hash');
  assert.equal(calls.some(c=>c.url.endsWith('/auth/v1/admin/users')&&c.method==='POST'),false);
 }finally{globalThis.fetch=original;}
});


test('MSG91 SMS and WhatsApp use separate channel-specific widget credentials',async()=>{
 const req=new Request('https://www.crakkerxai.com/api/config');
 const res=await worker.fetch(req,{...minimalEnv,MSG91_WHATSAPP_WIDGET_ID:'wa-widget-id',MSG91_WHATSAPP_WIDGET_TOKEN:'wa-widget-token'});
 const body=await res.json();
 assert.equal(res.status,200);
 assert.equal(body.msg91SmsEnabled,true);
 assert.equal(body.msg91WhatsappEnabled,true);
 assert.equal(body.msg91WhatsappWidgetId,'wa-widget-id');
 assert.equal(body.msg91WhatsappWidgetToken,'wa-widget-token');
});


test('existing legacy widget ID is treated as WhatsApp-primary, not incorrectly exposed as SMS',async()=>{
 const req=new Request('https://www.crakkerxai.com/api/config');
 const env={MSG91_AUTHKEY:'test-auth',MSG91_WIDGET_ID:'existing-wa-widget',MSG91_WIDGET_TOKEN:'existing-shared-token',SUPABASE_SERVICE_ROLE_KEY:'test-service-role'};
 const res=await worker.fetch(req,env);const body=await res.json();
 assert.equal(res.status,200);assert.equal(body.msg91Enabled,true);
 assert.equal(body.msg91SmsEnabled,false);assert.equal(body.msg91SmsWidgetId,'');
 assert.equal(body.msg91WhatsappEnabled,true);assert.equal(body.msg91WhatsappWidgetId,'existing-wa-widget');
 assert.equal(body.msg91WhatsappWidgetToken,'existing-shared-token');
});

test('MSG91 is not falsely enabled using a baked-in widget ID when no exact ID is configured',async()=>{
 const req=new Request('https://www.crakkerxai.com/api/config');
 const env={MSG91_AUTHKEY:'test-auth',MSG91_WIDGET_TOKEN:'test-token',SUPABASE_SERVICE_ROLE_KEY:'test-service-role'};
 const res=await worker.fetch(req,env);const body=await res.json();
 assert.equal(res.status,200);assert.equal(body.msg91Enabled,false);assert.equal(body.msg91WidgetId,'');
});


test('existing shared CrakkerXOTP token is reused for both channel widgets without generating a new token',async()=>{
 const req=new Request('https://www.crakkerxai.com/api/config');
 const res=await worker.fetch(req,{...minimalEnv,MSG91_WHATSAPP_WIDGET_ID:'wa-primary-widget'});
 const body=await res.json();
 assert.equal(res.status,200);
 assert.equal(body.msg91SmsEnabled,true);
 assert.equal(body.msg91WhatsappEnabled,true);
 assert.equal(body.msg91SmsWidgetToken,'test-sms-widget-token');
 assert.equal(body.msg91WhatsappWidgetToken,'test-sms-widget-token');
 assert.equal(body.msg91WhatsappWidgetId,'wa-primary-widget');
});


test('mobile login without a linked phone identity returns an actionable message and does not consume the OTP proof',async()=>{
 const original=globalThis.fetch;let redemptionWrites=0;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);
  if(u.hostname==='control.msg91.com')return json({type:'success',message:{identifier:'919876543210'}});
  if(u.pathname==='/rest/v1/msg91_phone_identities'&&(options.method||'GET')==='GET')return json([]);
  if(u.pathname==='/rest/v1/msg91_otp_redemptions'&&options.method==='POST'){redemptionWrites++;return json([{token_sha256:'digest'}],201);}
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/msg91',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:jwt,signup:false,channel:'whatsapp'})});
  const res=await worker.fetch(req,minimalEnv);const body=await res.json();
  assert.equal(res.status,404);
  assert.equal(body.code,'PHONE_ACCOUNT_NOT_FOUND');
  assert.match(body.error,/Choose Create account/);
  assert.equal(body.stage,'lookup_phone_identity');
  assert.equal(redemptionWrites,0);
 }finally{globalThis.fetch=original;}
});

test('Supabase session-link failures return a visible stage and reference instead of a generic 500',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);
  if(u.hostname==='control.msg91.com')return json({type:'success',message:{identifier:'919876543210'}});
  if(u.pathname==='/rest/v1/msg91_phone_identities'&&(options.method||'GET')==='GET')return json([{auth_user_id:'existing-user'}]);
  if(u.pathname==='/auth/v1/admin/users/existing-user')return json({user:{id:'existing-user',email:'mobile-old@auth.crakkerxai.com',phone:'+919876543210'}});
  if(u.pathname==='/auth/v1/admin/generate_link')return json({msg:'SMTP/provider config missing'},500);
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/msg91',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:jwt,signup:false})});
  const res=await worker.fetch(req,minimalEnv);const body=await res.json();
  assert.equal(res.status,502);
  assert.equal(body.code,'SUPABASE_LINK_REJECTED');
  assert.equal(body.stage,'generate_supabase_session_link');
  assert.ok(body.requestId);
  assert.match(body.error,/Supabase rejected session creation/);
 }finally{globalThis.fetch=original;}
});
