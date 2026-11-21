import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/worker.js';
import {readFileSync} from 'node:fs';

const PROJECT_URL='https://knhduwfwngrffnlxbnwt.supabase.co';
const PUBLIC_KEY='sb_publishable_sIQ_gPy9T64vg0M0L_Ff1w_c4NhturO';

async function getConfig(env={}) {
  const response=await worker.fetch(new Request('https://crakkerxai.com/api/config'),env);
  assert.equal(response.status,200);
  return response.json();
}

test('public Supabase URL and publishable key enable auth without service-role key',async()=>{
  const config=await getConfig({SUPABASE_URL:PROJECT_URL,SUPABASE_ANON_KEY:PUBLIC_KEY});
  assert.equal(config.authEnabled,true);
  assert.equal(config.serverDatabaseEnabled,false);
  assert.equal(config.passwordPolicyReady,false);
  assert.equal(config.paymentsEnabled,false);
  assert.equal(config.supabaseUrl,PROJECT_URL);
  assert.equal(config.supabaseAnonKey,PUBLIC_KEY);
});

test('known public Supabase project fallback keeps email auth enabled on a fresh Worker',async()=>{
  const config=await getConfig({});
  assert.equal(config.authEnabled,true);
  assert.equal(config.supabaseUrl,PROJECT_URL);
  assert.equal(config.supabaseAnonKey,PUBLIC_KEY);
  assert.equal(config.serverDatabaseEnabled,false);
  assert.equal(config.paymentsEnabled,false);
});

test('privileged features remain disabled without the service-role secret',async()=>{
  const config=await getConfig({SUPABASE_URL:PROJECT_URL,SUPABASE_ANON_KEY:PUBLIC_KEY});
  assert.equal(config.serverDatabaseEnabled,false);
  assert.equal(config.paymentsEnabled,false);
  assert.equal(config.msg91Enabled,false);
});

test('local auth client prioritises Vite public config before Worker fetch',()=>{
  const source=readFileSync(new URL('../src/auth-client.js',import.meta.url),'utf8');
  assert.match(source,/if\s*\(import\.meta\.env\.DEV && localConfig\.authEnabled\) return localConfig/);
  assert.match(source,/VITE_SUPABASE_PUBLISHABLE_KEY/);
  assert.match(source,/PUBLIC_SUPABASE_KEY/);
});

test('document prevents horizontal overscroll browser navigation gestures',()=>{
  const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
  assert.match(css,/html, body \{ overscroll-behavior-x: none; \}/);
});
