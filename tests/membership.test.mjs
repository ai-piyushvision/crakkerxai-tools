import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from '../server/worker.js';
import {PLANS, amountPaise, getPlan, PAID_PLAN_IDS} from '../src/plans.mjs';
const env={ASSETS:{fetch:async()=>new Response('static ok',{status:200})}};
test('pricing tiers and server-calculated amounts',()=>{
 assert.deepEqual(Object.keys(PLANS),['free','normal','plus','pro','ultra']);
 assert.deepEqual(PAID_PLAN_IDS,['normal','plus','pro','ultra']);
 assert.deepEqual(PAID_PLAN_IDS.map(amountPaise),[7900,14900,29900,59900]);
 assert.equal(amountPaise('free'),null);
 assert.equal(amountPaise('madeup'),null);
 assert.equal(getPlan('madeup'),PLANS.free);
 assert.equal(PLANS.ultra.daily,null);
});
test('pricing, login, and password reset forms generated',()=>{
 for(const s of ['pricing','account'])assert.ok(fs.readFileSync(`${s}/index.html`,'utf8').includes('name="google-adsense-account"'));
 const auth=fs.readFileSync('account/index.html','utf8');
 for(const id of ['auth-form','tab-signup','forgot-password','reset-form','google-login','github-login','checkout-btn'])assert.ok(auth.includes(`id="${id}"`),id);
 assert.ok(fs.readFileSync('pricing/index.html','utf8').includes('Pay once for 30 days'));
});
test('browser source does not embed payment or service-role secrets',()=>{
 const files=['src/account-page.js','src/auth-client.js','src/pricing-page.js','src/ad-access.js','src/main.js'];
 for(const file of files){const source=fs.readFileSync(file,'utf8');assert.ok(!/rzp_live_[0-9a-zA-Z]+|sk_test_[0-9a-zA-Z]+|service_role\s*:\s*['"]/.test(source),file);}
});
test('Worker public config excludes server credentials and defaults payment OFF',async()=>{
 const response=await worker.fetch(new Request('https://www.crakkerxai.com/api/config'),env);
 assert.equal(response.status,200);
 const output=await response.json();
 assert.equal(output.authEnabled,false);assert.equal(output.paymentsEnabled,false);
 assert.ok(!JSON.stringify(output).includes('SUPABASE_SERVICE_ROLE_KEY'));
});
test('Worker denies unconfigured protected endpoints and preserves static assets',async()=>{
 const req=new Request('https://www.crakkerxai.com/api/create-order',{method:'POST'});
 const response=await worker.fetch(req,env);assert.equal(response.status,503);
 const page=await worker.fetch(new Request('https://www.crakkerxai.com/pricing/'),env);
 assert.equal(await page.text(),'static ok');
});
test('Worker rejects tampered webhook before parsing',async()=>{
 const webhookEnv={...env,RAZORPAY_WEBHOOK_SECRET:'unit-test-secret'};
 const req=new Request('https://www.crakkerxai.com/api/razorpay/webhook',{method:'POST',headers:{'x-razorpay-signature':'0'.repeat(64)},body:'{"event":"payment.captured"}'});
 const response=await worker.fetch(req,webhookEnv);assert.equal(response.status,401);
});
test('database RLS and idempotent fulfilment function are included',()=>{
 const schema=fs.readFileSync('supabase/schema.sql','utf8');
 for(const entry of ['enable row level security','activate_paid_order','revoke_refunded_order','try_consume_usage','for update','service_role'])assert.ok(schema.includes(entry),entry);
});

test('valid captured-payment webhook checks stored amount before granting membership',async()=>{
 const secret='webhook-test-secret';
 const body=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:'pay_123',order_id:'order_123',status:'captured',currency:'INR',amount:14900}}}});
 const {createHmac}=await import('node:crypto');
 const signature=createHmac('sha256',secret).update(body).digest('hex');
 const savedFetch=globalThis.fetch;let grants=0;
 globalThis.fetch=async(input,options={})=>{
  const url=String(input);
  if(url.includes('payment_orders?'))return new Response(JSON.stringify([{razorpay_order_id:'order_123',user_id:'test-user',plan:'plus',amount_paise:14900,state:'created',payment_id:null}]),{status:200});
  if(url.endsWith('/rpc/activate_paid_order')){grants++;return new Response(JSON.stringify([{plan:'plus',expires_at:'2026-12-09T00:00:00Z'}]),{status:200});}
  throw Error('Unexpected network request: '+url);
 };
 try{
  const mockEnv={...env,SUPABASE_URL:'https://example.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fake-server-key',RAZORPAY_WEBHOOK_SECRET:secret};
  const response=await worker.fetch(new Request('https://www.crakkerxai.com/api/razorpay/webhook',{method:'POST',body,headers:{'x-razorpay-signature':signature}}),mockEnv);
  assert.equal(response.status,200);assert.equal(grants,1);
  const altered=body.replace('14900','15000');
  const alteredSignature=createHmac('sha256',secret).update(altered).digest('hex');
  const bad=await worker.fetch(new Request('https://www.crakkerxai.com/api/razorpay/webhook',{method:'POST',body:altered,headers:{'x-razorpay-signature':alteredSignature}}),mockEnv);
  assert.equal(bad.status,500);assert.equal(grants,1);
 }finally{globalThis.fetch=savedFetch;}
});

test('phone-OTP verified user can access account API without email',async()=>{
 const savedFetch=globalThis.fetch;
 globalThis.fetch=async(input)=>{
  const path=String(input);
  if(path.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id:'2f64cbe6-ef20-44f3-a1fb-2c48aa78b62b',phone:'+919876543210',phone_confirmed_at:'2026-11-09T08:00:00Z',email:null,email_confirmed_at:null}),{status:200});
  if(path.includes('/rest/v1/memberships?'))return new Response('[]',{status:200});
  if(path.includes('/rest/v1/payment_orders?'))return new Response('[]',{status:200});
  throw new Error('Unexpected fetch '+path);
 };
 try{
  const envForPhone={...env,SUPABASE_URL:'https://example.supabase.co',SUPABASE_ANON_KEY:'public-test-key',SUPABASE_SERVICE_ROLE_KEY:'server-test-only'};
  const response=await worker.fetch(new Request('https://www.crakkerxai.com/api/me',{headers:{Authorization:'Bearer verified-phone-test-session'}}),envForPhone);
  assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.plan,'free');assert.equal(body.user.email,null);
 }finally{globalThis.fetch=savedFetch;}
});
test('OTP registration/login markup and server confirmation checks included',()=>{
 const html=fs.readFileSync('account/index.html','utf8');
 for(const id of ['method-email-otp','method-phone-otp','method-password','phone-field','otp-form','otp-code','otp-verify-btn','otp-resend'])assert.ok(html.includes(`id="${id}"`),id);
 const account=fs.readFileSync('src/account-page.js','utf8');
 for(const t of ['signInWithOtp','verifyOtp','shouldCreateUser','phone:value'])assert.ok(account.includes(t),t);
 const server=fs.readFileSync('server/worker.js','utf8');assert.ok(server.includes('phone_confirmed_at'));
});
