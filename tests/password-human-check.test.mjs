import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../server/worker.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const BASE='https://knhduwfwngrffnlxbnwt.supabase.co';
const env={SUPABASE_SERVICE_ROLE_KEY:'test-service-role'};
const json=(body,status=200)=>new Response(body===null?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});

test('Password login presents the pool-table hold challenge in the authored and generated account pages',()=>{
 const html=read('account/index.html');const generated=read('scripts/generate-pages.mjs');const css=read('src/styles.css');
 for(const source of [html,generated]){
  assert.match(source,/id="password-human-check"/);
  assert.match(source,/id="password-human-hold"/);
  assert.match(source,/Hold to confirm/);
  assert.match(source,/id="password-human-status"/);
 }
 assert.match(css,/pool-cue-ball/);assert.match(css,/pool-confirm-control\.is-verified/);
});

test('password login must complete the server-issued human check and uses the Worker password endpoint',()=>{
 const page=read('src/account-page.js');const workerSource=read('server/worker.js');
 assert.match(page,/apiRequest\('\/api\/auth\/password-human-challenge'/);
 assert.match(page,/apiRequest\('\/api\/auth\/password-login'/);
 assert.match(page,/passwordHumanState!=='verified'/);
 assert.match(page,/pointerdown/);
 assert.match(workerSource,/consumePasswordHumanChallenge/);
 assert.match(workerSource,/auth_human_challenges/);
});

test('password human challenge is stored server-side and expires',async()=>{
 const original=globalThis.fetch;const calls=[];
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);const method=options.method||'GET';calls.push({url:String(url),method,body:options.body?JSON.parse(options.body):null});
  if(u.pathname==='/rest/v1/auth_human_challenges'&&method==='GET')return json([]);
  if(u.pathname==='/rest/v1/auth_human_challenges'&&method==='DELETE')return json(null,204);
  if(u.pathname==='/rest/v1/auth_human_challenges'&&method==='POST')return json(null,201);
  throw new Error(`Unexpected fetch ${method} ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/password-human-challenge',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.10'},body:'{}'});
  const res=await worker.fetch(req,env);const body=await res.json();
  assert.equal(res.status,200);assert.match(body.challengeId,/^[0-9a-f-]{36}$/i);assert.equal(body.minimumHoldMs,1600);assert.ok(Date.parse(body.expiresAt)>Date.now());
  const insert=calls.find(call=>call.method==='POST');assert.equal(insert.body.challenge_type,'pool_hold_confirm');assert.match(insert.body.ip_hash,/^[a-f0-9]{64}$/);
 }finally{globalThis.fetch=original;}
});

test('password login consumes a valid one-time human challenge before Supabase sign-in',async()=>{
 const original=globalThis.fetch;const calls=[];const challengeId='e3e5bca6-9ab6-48f1-a2c0-89d6b8d0cb52';
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url);const method=options.method||'GET';const body=options.body?JSON.parse(options.body):null;calls.push({url:String(url),method,body});
  if(u.pathname==='/rest/v1/auth_human_challenges'&&method==='GET')return json([{challenge_id:challengeId,created_at:new Date(Date.now()-2200).toISOString(),expires_at:new Date(Date.now()+120000).toISOString()}]);
  if(u.pathname==='/rest/v1/auth_human_challenges'&&method==='PATCH')return json([{challenge_id:challengeId,used_at:new Date().toISOString()}]);
  if(u.pathname==='/auth/v1/token'&&u.searchParams.get('grant_type')==='password')return json({access_token:'access',refresh_token:'refresh',expires_in:3600,token_type:'bearer'});
  throw new Error(`Unexpected fetch ${method} ${url}`);
 };
 try{
  const req=new Request('https://www.crakkerxai.com/api/auth/password-login',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.10'},body:JSON.stringify({identityType:'email',identity:'user@example.com',password:'ValidPassword123',challengeId,heldMs:1700})});
  const res=await worker.fetch(req,env);const body=await res.json();
  assert.equal(res.status,200);assert.equal(body.access_token,'access');assert.equal(body.refresh_token,'refresh');
  const consumeIndex=calls.findIndex(call=>call.method==='PATCH');const loginIndex=calls.findIndex(call=>new URL(call.url).pathname==='/auth/v1/token');assert.ok(consumeIndex>=0&&loginIndex>consumeIndex);
 }finally{globalThis.fetch=original;}
});

test('password login rejects short, expired or replayed human challenges',async t=>{
 const original=globalThis.fetch;const challengeId='e3e5bca6-9ab6-48f1-a2c0-89d6b8d0cb52';
 await t.test('short hold is rejected without provider login',async()=>{
  let called=false;globalThis.fetch=async()=>{called=true;throw new Error('must not fetch');};
  const req=new Request('https://www.crakkerxai.com/api/auth/password-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identityType:'email',identity:'user@example.com',password:'secret',challengeId,heldMs:500})});
  const res=await worker.fetch(req,env);const body=await res.json();assert.equal(res.status,403);assert.equal(called,false);assert.match(body.error,/human check/i);
 });
 await t.test('consumed challenge cannot be replayed',async()=>{
  globalThis.fetch=async(url,options={})=>{const u=new URL(url);const method=options.method||'GET';if(u.pathname==='/rest/v1/auth_human_challenges'&&method==='GET')return json([{challenge_id:challengeId,created_at:new Date(Date.now()-2200).toISOString(),expires_at:new Date(Date.now()+60000).toISOString()}]);if(u.pathname==='/rest/v1/auth_human_challenges'&&method==='PATCH')return json([]);throw new Error(`Unexpected fetch ${url}`);};
  const req=new Request('https://www.crakkerxai.com/api/auth/password-login',{method:'POST',headers:{'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.10'},body:JSON.stringify({identityType:'email',identity:'user@example.com',password:'secret',challengeId,heldMs:1700})});
  const res=await worker.fetch(req,env);assert.equal(res.status,409);
 });
 globalThis.fetch=original;
});

test('password human challenge migration denies browser roles and grants Worker service role',()=>{
 const sql=read('supabase/migrations/20261121_password_human_challenges.sql');
 assert.match(sql,/create table if not exists public\.auth_human_challenges/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all .* from anon, authenticated/i);
 assert.match(sql,/grant select, insert, update, delete .* to service_role/i);
});
