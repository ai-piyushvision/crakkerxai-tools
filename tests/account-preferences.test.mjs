import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../server/worker.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const env={SUPABASE_SERVICE_ROLE_KEY:'service-role-key'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
const user={id:'profile-user-123',email:'piyush@example.com',email_confirmed_at:'2026-11-21T10:00:00Z',created_at:'2026-11-01T10:00:00Z',user_metadata:{full_name:'Piyush Sharma'}};

test('account preferences GET returns safe defaults for the authenticated user',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);calls.push({url:String(url),method:options.method||'GET'});
  if(u.pathname==='/auth/v1/user')return json(user);
  if(u.pathname==='/rest/v1/account_preferences')return json([]);
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/account/preferences',{headers:{Authorization:'Bearer user-session'}});
  const response=await worker.fetch(req,env);const body=await response.json();
  assert.equal(response.status,200);
  assert.deepEqual(body.preferences,{theme:'dark',font_size:'normal',notifications_security:true,notifications_product:true,notifications_email:true,location_enabled:false,reduced_motion:false});
  assert.ok(calls.some(call=>call.method==='GET'&&call.url.includes('account_preferences')));
 }finally{globalThis.fetch=original;}
});

test('account preferences PATCH is scoped to authenticated user and persists validated fields',async()=>{
 const original=globalThis.fetch;let posted=null;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);
  if(u.pathname==='/auth/v1/user')return json(user);
  if(u.pathname==='/rest/v1/account_preferences'&&options.method==='POST'){
   posted=JSON.parse(options.body);
   return json([{...posted,created_at:'2026-11-21T10:00:00Z'}],200);
  }
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const preferences={theme:'light',font_size:'large',notifications_security:false,notifications_product:true,notifications_email:false,location_enabled:true,reduced_motion:true,user_id:'attacker-user'};
  const req=new Request('https://www.crakkerxai.com/api/account/preferences',{method:'PATCH',headers:{Authorization:'Bearer user-session','Content-Type':'application/json'},body:JSON.stringify({preferences})});
  const response=await worker.fetch(req,env);const body=await response.json();
  assert.equal(response.status,200);assert.equal(body.saved,true);
  assert.equal(posted.user_id,user.id);assert.equal(posted.theme,'light');assert.equal(posted.location_enabled,true);assert.equal(posted.reduced_motion,true);
  assert.equal(Object.hasOwn(posted,'user_id')&&posted.user_id==='attacker-user',false);
 }finally{globalThis.fetch=original;}
});

test('account preferences rejects invalid values without writing to the database',async()=>{
 const original=globalThis.fetch;let writes=0;
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);
  if(u.pathname==='/auth/v1/user')return json(user);
  if(u.pathname==='/rest/v1/account_preferences'){writes++;return json([]);}
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/account/preferences',{method:'PATCH',headers:{Authorization:'Bearer user-session','Content-Type':'application/json'},body:JSON.stringify({theme:'neon'})});
  const response=await worker.fetch(req,env);const body=await response.json();
  assert.equal(response.status,400);assert.match(body.error,/Morning Mode or Night Mode/);assert.equal(writes,0);
 }finally{globalThis.fetch=original;}
});

test('profile API returns email, verified phone identity and membership for the same auth user',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  const u=new URL(url);
  if(u.pathname==='/auth/v1/user')return json(user);
  if(u.pathname==='/rest/v1/msg91_phone_identities')return json([{phone_e164:'+919111030100'}]);
  if(u.pathname==='/rest/v1/memberships')return json([{plan:'plus',expires_at:'2027-01-01T00:00:00Z'}]);
  if(u.pathname==='/rest/v1/payment_orders')return json([]);
  throw new Error(`Unexpected fetch ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/me',{headers:{Authorization:'Bearer user-session'}});
  const response=await worker.fetch(req,env);const body=await response.json();
  assert.equal(response.status,200);assert.equal(body.user.id,user.id);assert.equal(body.user.fullName,'Piyush Sharma');
  assert.equal(body.user.email,'piyush@example.com');assert.equal(body.user.phone,'+919111030100');assert.equal(body.user.phoneVerified,true);assert.equal(body.plan,'plus');
 }finally{globalThis.fetch=original;}
});

test('profile and settings UI contains account details, display-name editing and saved preference controls',()=>{
 const html=read('account/index.html');const generator=read('scripts/generate-pages.mjs');const page=read('src/account-page.js');const css=read('src/styles.css');
 for(const marker of ['dash-profile-email-detail','dash-profile-phone-detail','dash-profile-plan-detail','profile-name-form','pref-theme','pref-font-size','pref-notifications-security','pref-notifications-product','pref-notifications-email','pref-location-enabled','pref-reduced-motion','account-settings-save']){
  assert.ok(html.includes(marker),`generated account page missing ${marker}`);assert.ok(generator.includes(marker),`page generator missing ${marker}`);
 }
 assert.match(page,/api\/account\/preferences/);assert.match(page,/saveProfileName/);assert.match(page,/profileRedirectUrl/);
 assert.match(css,/@keyframes pool-felt-colour-cycle/);assert.match(css,/#dashboard \.account-settings-grid/);assert.match(css,/data-font-size="extra-large"/);
});

test('account preferences migration enforces private per-user settings and accepted value constraints',()=>{
 const sql=read('supabase/migrations/20261121_account_preferences.sql');
 assert.match(sql,/user_id uuid PRIMARY KEY REFERENCES auth\.users\(id\) ON DELETE CASCADE/i);
 assert.match(sql,/ENABLE ROW LEVEL SECURITY/i);assert.match(sql,/REVOKE ALL .* anon, authenticated/i);assert.match(sql,/TO service_role/i);
 assert.match(sql,/font_size IN \('small','normal','large','extra-large'\)/);assert.match(sql,/location_enabled boolean NOT NULL DEFAULT false/);
});
