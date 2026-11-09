import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('shared header menu present on homepage and all tool pages',()=>{
 for(const path of ['index.html','account/index.html','pricing/index.html','tools/images-to-pdf/index.html','tools/pdf-to-png/index.html']){
  const html=file(path);
  for(const marker of ['data-account-nav','data-profile-trigger','data-profile-popover','Payment history','Notifications','data-profile-signout']){
   assert.ok(html.includes(marker),`${path}: missing ${marker}`);
  }
 }
});
test('signed-in menu uses supabase session and does not fabricate payments or notifications',()=>{
 const script=file('src/account-menu.js');
 assert.match(script,/getSession/);assert.match(script,/signOut/);
 assert.match(file('scripts/generate-pages.mjs'),/No notifications yet/);
 assert.match(script,/api\/me/);
});
test('pricing and account included in production Vite entrypoints',()=>{
 const config=file('vite.config.js');
 assert.ok(config.includes('pricing/index.html'));
 assert.ok(config.includes('account/index.html'));
});
test('old conversion handler stays present',()=>{
 const js=file('src/main.js');
 assert.match(js,/initConverter\(\)/);
 assert.match(js,/mountAd\(\)/);
});

test('fresh login returns to original homepage',()=>{
 const account=file('src/account-page.js');
 assert.match(account,/window\.location\.assign\('\/'\)/);
 assert.match(account,/cx_login_return_home/);
});
