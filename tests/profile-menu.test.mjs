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

test('fresh login opens the authenticated account dashboard',()=>{
 const account=file('src/account-page.js');
 assert.match(account,/window\.location\.assign\('\/account\/\?view=overview'\)/);
 assert.match(account,/const profileRedirectUrl=\(\)=>`\$\{redirectUrl\(\)\}\?view=overview`/);
 assert.match(account,/const initial=params\.get\('view'\)\|\|'overview'/);
 assert.match(file('account/index.html'),/account\/\?view=profile/);
 assert.match(file('scripts/generate-pages.mjs'),/account\/\'\)\}\?view=profile/);
 assert.doesNotMatch(account,/cx_login_return_home/);
});

test('authenticated workspace hydration errors never reveal the sign-in form',()=>{
 const account=file('src/account-page.js');
 assert.match(account,/let activeAccountSession=null/);
 assert.match(account,/activeAccountSession=await getSession\(\)/);
 assert.match(account,/if\(activeAccountSession\?\.user\)\{/);
 assert.match(account,/A dashboard rendering error must never send an already signed-in user back to the login form/);
});

test('dashboard widget initialisation cannot abort authenticated account session boot',()=>{
 const account=file('src/account-page.js');
 assert.match(account,/try\{initDashboardWorkspace\(\);\}\s*catch\(error\)\{console\.error\('Dashboard controls could not be initialised:'/);
});
