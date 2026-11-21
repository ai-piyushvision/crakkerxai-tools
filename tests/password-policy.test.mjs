import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../server/worker.js';
import {normalizePasswordPolicyRow,requiresCurrentPasswordForSetup} from '../src/password-policy.mjs';

const SUPABASE_URL='https://knhduwfwngrffnlxbnwt.supabase.co';
const env={SUPABASE_URL,SUPABASE_ANON_KEY:'sb_publishable_test',SUPABASE_SERVICE_ROLE_KEY:'test-service-role'};
const originalFetch=globalThis.fetch;

function response(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});}


test('authenticated RLS password-policy row maps first-time accounts to initial setup',()=>{
 const status=normalizePasswordPolicyRow({password_changed_at:null,password_setup_required:true,password_setup_reason:'initial_setup'},Date.now());
 assert.equal(status.passwordSet,false);assert.equal(status.mustSetPassword,true);assert.equal(status.passwordSetupReason,'initial_setup');
});


test('legacy rollout account logged in through verified email OTP does not require an unknown current password',()=>{
 const policy=normalizePasswordPolicyRow({password_changed_at:null,password_setup_required:true,password_setup_reason:'legacy_rollout'},Date.now());
 assert.equal(policy.mustSetPassword,true);
 assert.equal(requiresCurrentPasswordForSetup(policy,{verifiedEmailOtp:true}),false);
});

test('legacy rollout still requires current password without a fresh verified email OTP',()=>{
 const policy=normalizePasswordPolicyRow({password_changed_at:null,password_setup_required:true,password_setup_reason:'legacy_rollout'},Date.now());
 assert.equal(requiresCurrentPasswordForSetup(policy,{verifiedEmailOtp:false}),true);
});

test('60-day password renewal still requires current password even after email OTP',()=>{
 const policy=normalizePasswordPolicyRow({password_changed_at:new Date(Date.now()-61*86400000).toISOString(),password_setup_required:false,password_setup_reason:'completed'},Date.now());
 assert.equal(requiresCurrentPasswordForSetup(policy,{verifiedEmailOtp:true}),true);
});

test('authenticated RLS password-policy row enforces 60-day expiry precisely',()=>{
 const now=Date.now();
 const fresh=normalizePasswordPolicyRow({password_changed_at:new Date(now-59*86400000).toISOString(),password_setup_required:false,password_setup_reason:'completed'},now);
 const expired=normalizePasswordPolicyRow({password_changed_at:new Date(now-60*86400000).toISOString(),password_setup_required:false,password_setup_reason:'completed'},now);
 assert.equal(fresh.mustSetPassword,false);assert.equal(expired.mustSetPassword,true);
});

test('authenticated RLS password-policy row fails closed for missing or malformed records',()=>{
 assert.throws(()=>normalizePasswordPolicyRow(null),/No password-security record/);
 assert.throws(()=>normalizePasswordPolicyRow({password_changed_at:'not-a-date',password_setup_required:false}),/timestamp.*invalid/i);
});

test('password-policy endpoint requires a verified Supabase session and returns an expired-password gate',async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async (url,options={})=>{
    const parsed=new URL(url);
    if(parsed.pathname==='/auth/v1/user')return response({id:'user-1',email:'user@example.com',email_confirmed_at:new Date().toISOString()});
    if(parsed.pathname==='/rest/v1/account_password_security')return response([{password_changed_at:new Date(Date.now()-61*86400000).toISOString(),password_setup_required:false,password_setup_reason:'completed'}]);
    throw new Error(`Unexpected request ${url}`);
  };
  try{
    const req=new Request('https://www.crakkerxai.com/api/auth/password-policy',{headers:{Authorization:'Bearer verified-access-token'}});
    const res=await worker.fetch(req,env);const body=await res.json();
    assert.equal(res.status,200);assert.equal(body.mustSetPassword,true);assert.equal(body.passwordMaxAgeDays,60);assert.ok(body.passwordAgeDays>=61);
  }finally{globalThis.fetch=oldFetch;}
});


test('password age of exactly 60 days is expired and requires a password update',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  const parsed=new URL(url);
  if(parsed.pathname==='/auth/v1/user')return response({id:'user-60',email:'user@example.com',email_confirmed_at:new Date().toISOString()});
  if(parsed.pathname==='/rest/v1/account_password_security')return response([{password_changed_at:new Date(Date.now()-60*86400000).toISOString(),password_setup_required:false,password_setup_reason:'completed'}]);
  throw new Error(`Unexpected request ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/password-policy',{headers:{Authorization:'Bearer verified-access-token'}});
  const res=await worker.fetch(req,env);const body=await res.json();
  assert.equal(res.status,200);assert.equal(body.mustSetPassword,true);assert.ok(body.passwordAgeDays>=60);
 }finally{globalThis.fetch=oldFetch;}
});

test('password-policy allows a password younger than 60 days',async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    const parsed=new URL(url);
    if(parsed.pathname==='/auth/v1/user')return response({id:'user-2',email:'user@example.com',email_confirmed_at:new Date().toISOString()});
    if(parsed.pathname==='/rest/v1/account_password_security')return response([{password_changed_at:new Date(Date.now()-12*86400000).toISOString(),password_setup_required:false,password_setup_reason:'completed'}]);
    throw new Error(`Unexpected request ${url}`);
  };
  try{
    const req=new Request('https://www.crakkerxai.com/api/auth/password-policy',{headers:{Authorization:'Bearer verified-access-token'}});
    const res=await worker.fetch(req,env);const body=await res.json();
    assert.equal(res.status,200);assert.equal(body.mustSetPassword,false);assert.equal(body.passwordAgeDays,12);
  }finally{globalThis.fetch=oldFetch;}
});

test('phone-password sign-in resolves the verified phone identity and exchanges password with Supabase',async()=>{
  const oldFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async (url,options={})=>{
    const parsed=new URL(url);calls.push({url:String(url),method:options.method||'GET'});
    if(parsed.pathname==='/rest/v1/msg91_phone_identities')return response([{auth_user_id:'user-mobile-1'}]);
    if(parsed.pathname==='/auth/v1/admin/users/user-mobile-1')return response({user:{id:'user-mobile-1',email:'mobile-123@auth.crakkerxai.com'}});
    if(parsed.pathname==='/auth/v1/token')return response({access_token:'access-token',refresh_token:'refresh-token',expires_in:3600,token_type:'bearer'});
    throw new Error(`Unexpected request ${url}`);
  };
  try{
    const req=new Request('https://www.crakkerxai.com/api/auth/phone-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:'+919876543210',password:'StrongPassword123'})});
    const res=await worker.fetch(req,env);const body=await res.json();
    assert.equal(res.status,200);assert.equal(body.access_token,'access-token');assert.equal(body.refresh_token,'refresh-token');
    assert.ok(calls.some(call=>call.url.includes('/rest/v1/msg91_phone_identities')));
    assert.ok(calls.some(call=>call.url.includes('/auth/v1/token?grant_type=password')));
  }finally{globalThis.fetch=oldFetch;}
});

test('phone-password endpoint does not reveal whether a phone identity exists',async()=>{
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async url=>{
    if(new URL(url).pathname==='/rest/v1/msg91_phone_identities')return response([]);
    throw new Error(`Unexpected request ${url}`);
  };
  try{
    const req=new Request('https://www.crakkerxai.com/api/auth/phone-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:'+919876543210',password:'IncorrectPassword'})});
    const res=await worker.fetch(req,env);const body=await res.json();
    assert.equal(res.status,401);assert.equal(body.error,'Mobile number or password is incorrect.');
  }finally{globalThis.fetch=oldFetch;}
});

test('phone-password endpoint fails closed if privileged Worker configuration is absent',async()=>{
  const req=new Request('https://www.crakkerxai.com/api/auth/phone-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:'+919876543210',password:'StrongPassword123'})});
  const res=await worker.fetch(req,{SUPABASE_URL:env.SUPABASE_URL,SUPABASE_ANON_KEY:env.SUPABASE_ANON_KEY});
  assert.equal(res.status,503);
});

test('current-password endpoint verifies the authenticated user password without returning a session token',async()=>{
 const oldFetch=globalThis.fetch;let submitted;
 globalThis.fetch=async(url,options={})=>{
  const parsed=new URL(url);
  if(parsed.pathname==='/auth/v1/user')return response({id:'same-user',email:'user@example.com',email_confirmed_at:new Date().toISOString()});
  if(parsed.pathname==='/auth/v1/token' && parsed.searchParams.get('grant_type')==='password'){
   submitted=JSON.parse(options.body);
   return response({user:{id:'same-user'},access_token:'must-not-be-returned',refresh_token:'must-not-be-returned'});
  }
  throw new Error(`Unexpected request ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/verify-current-password',{
   method:'POST',headers:{Authorization:'Bearer verified-access-token','Content-Type':'application/json'},
   body:JSON.stringify({password:'OldPassword123'})
  });
  const res=await worker.fetch(req,env);const body=await res.json();
  assert.equal(res.status,200);assert.deepEqual(body,{verified:true});
  assert.deepEqual(submitted,{email:'user@example.com',password:'OldPassword123'});
  assert.equal('access_token' in body,false);
 }finally{globalThis.fetch=oldFetch;}
});

test('current-password endpoint rejects a password that authenticates as another user',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  const parsed=new URL(url);
  if(parsed.pathname==='/auth/v1/user')return response({id:'same-user',email:'user@example.com',email_confirmed_at:new Date().toISOString()});
  if(parsed.pathname==='/auth/v1/token')return response({user:{id:'different-user'},access_token:'x',refresh_token:'y'});
  throw new Error(`Unexpected request ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/verify-current-password',{
   method:'POST',headers:{Authorization:'Bearer verified-access-token','Content-Type':'application/json'},
   body:JSON.stringify({password:'OldPassword123'})
  });
  const res=await worker.fetch(req,env);const body=await res.json();
  assert.equal(res.status,401);assert.match(body.error,/Current password is incorrect/);
 }finally{globalThis.fetch=oldFetch;}
});

test('password-policy endpoint reports missing Worker service-role configuration clearly',async()=>{
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  if(new URL(url).pathname==='/auth/v1/user')return response({id:'user-1',email:'user@example.com',email_confirmed_at:new Date().toISOString()});
  throw new Error(`Unexpected request ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/password-policy',{headers:{Authorization:'Bearer verified-access-token'}});
  const res=await worker.fetch(req,{SUPABASE_URL,SUPABASE_ANON_KEY:'sb_publishable_test'});
  const body=await res.json();
  assert.equal(res.status,503);assert.match(body.error,/SUPABASE_SERVICE_ROLE_KEY/);
 }finally{globalThis.fetch=oldFetch;}
});

test('account flow contains forced password setup, mobile password login and 60-day policy checks',()=>{
  const account=readFileSync(new URL('../src/account-page.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../account/index.html',import.meta.url),'utf8');
  assert.match(account,/apiRequest\('\/api\/auth\/password-policy'/);
  assert.match(account,/client\.from\('account_password_security'\)/);
  assert.match(account,/loadPasswordPolicy\(updatedSession\)/);
  assert.match(account,/verifyCurrentPasswordForSession\(session,currentPassword\)/);
  assert.match(account,/apiRequest\('\/api\/auth\/verify-current-password'/);
  assert.match(account,/Refresh your account password/);
  assert.match(account,/requiresCurrentPasswordForSetup\(policy,\{verifiedEmailOtp\}\)/);
  assert.match(account,/storeEmailOtpPasswordSetupProof\(result\.data\.session\.user\.id\)/);
  assert.match(account,/legacyOtpSetup/);
  assert.match(account,/apiRequest\('\/api\/auth\/phone-password'/);
  assert.match(account,/client\.auth\.updateUser\(\{password\}\)/);
  assert.match(account,/client\.auth\.signOut\(\)/);
  assert.match(html,/id="password-setup-form"/);
  assert.match(html,/id="setup-current-password-field"/);
  assert.match(html,/Confirm new password/);
  assert.match(html,/id="password-identity-type"/);
});

test('password policy migration records password hash changes on auth.users and secures the policy table',()=>{
  const sql=readFileSync(new URL('../supabase/migrations/20261120_account_password_policy.sql',import.meta.url),'utf8');
  assert.match(sql,/AFTER UPDATE OF encrypted_password ON auth\.users/);
  assert.match(sql,/password_changed_at = EXCLUDED\.password_changed_at/);
  assert.match(sql,/password_setup_required = EXCLUDED\.password_setup_required/);
  assert.match(sql,/password_setup_reason = EXCLUDED\.password_setup_reason/);
  assert.match(sql,/CASE WHEN has_password THEN 'completed' ELSE 'initial_setup' END/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON public\.account_password_security FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/GRANT SELECT ON public\.account_password_security TO authenticated/);
  assert.match(sql,/CREATE POLICY account_password_security_select_own/);
  assert.match(sql,/USING \(auth\.uid\(\) = user_id\)/);
  assert.match(sql,/COALESCE\(encrypted_password, ''\)\s*=\s*'' THEN 'initial_setup'\s*ELSE 'legacy_rollout'/);
  assert.match(sql,/password_changed_at IS NULL/);
  assert.match(sql,/password_setup_reason IN \('initial_setup', 'legacy_rollout'\)/);
  assert.match(sql,/NOT has_password/);
  assert.match(sql,/password_setup_required boolean NOT NULL DEFAULT true/);
});


test('schema.sql embeds the exact password policy migration',()=>{
 const migration=readFileSync(new URL('../supabase/migrations/20261120_account_password_policy.sql',import.meta.url),'utf8').trim();
 const schema=readFileSync(new URL('../supabase/schema.sql',import.meta.url),'utf8');
 const marker='-- Password security policy (also available as supabase/migrations/20261120_account_password_policy.sql)';
 assert.ok(schema.includes(marker));
 assert.equal(schema.slice(schema.indexOf(marker)+marker.length).trim(),migration);
});
