import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../server/worker.js';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const BASE='https://knhduwfwngrffnlxbnwt.supabase.co';
const env={MSG91_AUTHKEY:'test-auth',MSG91_SMS_WIDGET_ID:'sms-widget',MSG91_WHATSAPP_WIDGET_ID:'wa-widget',MSG91_WIDGET_TOKEN:'browser-widget-token',SUPABASE_SERVICE_ROLE_KEY:'service-role'};
const jwt='header.payload.signature';
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});

test('Create account requires one mobile route plus a real email field; signup does not create mobile-only profiles',()=>{
 const html=read('account/index.html');
 const generated=read('scripts/generate-pages.mjs');
 const page=read('src/account-page.js');
 assert.match(html,/id="auth-email"[^>]*type="email"/);
 assert.match(html,/id="auth-phone"[^>]*type="tel"/);
 assert.match(html,/id="phone-otp-channel-field"/);
 assert.match(page,/if\(mode==='signup'\)next='phone-otp'/);
 assert.match(page,/api\/auth\/msg91\/prepare-signup/);
 assert.match(page,/client\.auth\.signInWithOtp\(\{email:signupContext\.email/);
 assert.match(page,/api\/auth\/msg91\/link-signup/);
 assert.match(generated,/id="identity-management-panel"/);
});

test('new signup verifies MSG91 phone proof and stores a short-lived pending identity before email verification',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);const body=options.body?JSON.parse(options.body):undefined;
  calls.push({url:String(url),method:options.method||'GET',body});
  if(u.hostname==='control.msg91.com')return json({type:'success',message:{identifier:'919876543210'}});
  if(u.pathname==='/rest/v1/msg91_pending_signups')return json([{id:'7a9ea4e4-6fca-4ab9-9de3-a7e2c3a5c2a1',expires_at:'2026-11-21T12:30:00Z'}],201);
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/msg91/prepare-signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:jwt,email:'person@example.com',fullName:'Test User',channel:'whatsapp'})});
  const res=await worker.fetch(req,env);const body=await res.json();
  assert.equal(res.status,200);assert.equal(body.pendingSignupId,'7a9ea4e4-6fca-4ab9-9de3-a7e2c3a5c2a1');
  const insert=calls.find(call=>new URL(call.url).pathname==='/rest/v1/msg91_pending_signups');
  assert.equal(insert.body.email,'person@example.com');assert.equal(insert.body.phone_e164,'+919876543210');
  assert.equal(insert.body.channel,'whatsapp');assert.notEqual(insert.body.proof_sha256,jwt);
  assert.equal(calls.some(call=>new URL(call.url).pathname==='/auth/v1/admin/users'),false);
 }finally{globalThis.fetch=original;}
});

test('link endpoint binds the verified mobile to the existing verified email user ID',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);const body=options.body?JSON.parse(options.body):undefined;
  calls.push({url:String(url),method:options.method||'GET',headers:options.headers,body});
  if(u.pathname==='/auth/v1/user')return json({id:'email-user-1',email:'person@example.com',email_confirmed_at:'2026-11-21T10:00:00Z',user_metadata:{full_name:'Test User'}});
  if(u.pathname==='/rest/v1/rpc/link_verified_msg91_phone')return json({linked:true,phone_e164:'+919876543210',merged_legacy_account:true});
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/msg91/link-signup',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer verified-email-session'},body:JSON.stringify({pendingSignupId:'7a9ea4e4-6fca-4ab9-9de3-a7e2c3a5c2a1'})});
  const res=await worker.fetch(req,env);const body=await res.json();
  assert.equal(res.status,200);assert.equal(body.linked,true);assert.equal(body.mergedLegacyAccount,true);
  const rpc=calls.find(call=>new URL(call.url).pathname==='/rest/v1/rpc/link_verified_msg91_phone');
  assert.deepEqual(rpc.body,{p_pending_signup_id:'7a9ea4e4-6fca-4ab9-9de3-a7e2c3a5c2a1',p_auth_user_id:'email-user-1',p_verified_email:'person@example.com'});
 }finally{globalThis.fetch=original;}
});

test('identity status reports a single linked email and phone identity for the signed-in profile',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  const u=new URL(url);
  if(u.pathname==='/auth/v1/user')return json({id:'email-user-1',email:'person@example.com',email_confirmed_at:'2026-11-21T10:00:00Z'});
  if(u.pathname==='/rest/v1/msg91_phone_identities')return json([{phone_e164:'+919876543210'}]);
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/identity-status',{headers:{Authorization:'Bearer verified-email-session'}});
  const res=await worker.fetch(req,env);const body=await res.json();
  assert.equal(res.status,200);assert.equal(body.email,'person@example.com');assert.equal(body.phone,'+919876543210');
  assert.equal(body.phoneVerified,true);assert.equal(body.syntheticEmail,false);
 }finally{globalThis.fetch=original;}
});

test('identity linking migration prevents duplicate phones and safely merges only synthetic legacy mobile users',()=>{
 const sql=read('supabase/migrations/20261121_unified_email_phone_identity.sql');
 assert.match(sql,/email_confirmed_at IS NULL/);
 assert.match(sql,/msg91_pending_signups/);
 assert.match(sql,/PHONE_ALREADY_LINKED_TO_ANOTHER_ACCOUNT/);
 assert.match(sql,/mobile-\[0-9a-f\]\{32\}@auth/);
 assert.match(sql,/payment_orders/);
 assert.match(sql,/memberships/);
 assert.match(sql,/conversion_usage/);
 assert.match(sql,/DELETE FROM auth\.users WHERE id = v_existing_user_id/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.link_verified_msg91_phone/);
});

test('legacy mobile-only signup endpoint no longer creates a separate synthetic account',async()=>{
 const req=new Request('https://www.crakkerxai.com/api/auth/msg91',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accessToken:jwt,signup:true})});
 const res=await worker.fetch(req,env);const body=await res.json();
 assert.equal(res.status,400);assert.equal(body.code,'UNIFIED_SIGNUP_REQUIRED');
});

test('legacy mobile-only accounts add an email using fresh mobile OTP plus email OTP, not an unverified direct email change',()=>{
 const html=read('account/index.html');
 const generated=read('scripts/generate-pages.mjs');
 const page=read('src/account-page.js');
 assert.match(html,/id="identity-email-channel-sms"/);
 assert.match(html,/id="identity-email-channel-whatsapp"/);
 assert.match(html,/Verify mobile &amp; add email/);
 assert.match(generated,/id="identity-email-channel-sms"/);
 assert.match(page,/kind:'identity-email-link-phone'/);
 assert.match(page,/client\.auth\.signInWithOtp\(\{email:signupContext\.email/);
 assert.doesNotMatch(page,/client\.auth\.updateUser\(\{email\}/);
});

test('identity linking UI exposes both verified sign-in routes after a legacy profile is consolidated',()=>{
 const html=read('account/index.html');
 const page=read('src/account-page.js');
 assert.match(html,/id="identity-management-panel"/);
 assert.match(html,/Link a mobile number/);
 assert.match(html,/Add a login email/);
 assert.match(page,/Email, SMS and WhatsApp now open this same account/);
 assert.match(page,/Your previous mobile-only profile and its available account records were consolidated/);
});

test('legacy synthetic mobile profile is prompted to add a real email even though its phone is already linked',()=>{
 const page=read('src/account-page.js');
 const syntheticBranch=page.indexOf('if(status.syntheticEmail){');
 const linkedPhoneBranch=page.indexOf('else if(status.phone){',syntheticBranch);
 assert.notEqual(syntheticBranch,-1);
 assert.notEqual(linkedPhoneBranch,-1);
 assert.ok(syntheticBranch<linkedPhoneBranch,'synthetic mobile account must be handled before the ordinary linked-email account');
 assert.match(page,/Your mobile account is active\. Add and verify a real email address/);
});

test('email linking failure preserves the authenticated mobile dashboard instead of showing a second login form',()=>{
 const page=read('src/account-page.js');
 assert.match(page,/msg91ProofVerified&&otpContext\?\.kind==='identity-email-link-phone'[\s\S]*?hide\('otp-panel'\);hide\('auth-panel'\);/);
});
