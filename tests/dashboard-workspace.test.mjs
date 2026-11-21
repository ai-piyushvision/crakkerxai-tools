import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../account/index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../src/account-page.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('account workspace contains all nine in-dashboard destinations',()=>{
  for(const view of ['overview','analytics','reports','files','resources','tools','plans','updates','support','profile']){
    assert.match(html,new RegExp(`data-dashboard-panel="${view}"`));
    assert.match(html,new RegExp(`data-dashboard-view="${view}"`));
  }
  assert.equal((html.match(/data-dashboard-panel="/g)||[]).length,10);
});

test('workspace sidebar stays rendered and view switches without page navigation',()=>{
  assert.match(css,/#dashboard \.dash-sidebar\{[\s\S]*?position:sticky/);
  assert.match(css,/#dashboard \.dash-sidebar\{[\s\S]*?display:flex!important/);
  assert.match(js,/function setDashboardView\(/);
  assert.match(js,/panel\.hidden=!active/);
  assert.match(js,/button\.addEventListener\('click',\(\)=>setDashboardView/);
});

test('analytics and history use actual browser activity records',()=>{
  assert.match(js,/cx_conversion_activity_v1/);
  assert.match(html,/data-dashboard-panel="analytics"/);
  assert.match(html,/id="dash-activity-body"/);
  assert.match(html,/id="dash-export-activity"/);
  assert.match(html,/local activity index/i);
});

test('resources view contains product-specific help and tool links',()=>{
  assert.match(html,/data-dashboard-panel="resources"/);
  assert.match(html,/PDF workspace/);
  assert.match(html,/Image workspace/);
  assert.match(html,/Feedback &amp; bug reports/);
});


test('lower sidebar destinations stay inside the dashboard instead of leaving the workspace',()=>{
  for(const view of ['tools','plans','updates','support']){
    assert.match(html,new RegExp(`<button[^>]*data-dashboard-view=\"${view}\"`));
  }
  assert.match(html,/data-sidebar-toggle/);
  assert.match(js,/cx_dashboard_sidebar_collapsed/);
  assert.match(js,/sidebar-collapsed/);
  assert.match(css,/#dashboard\.dashboard\.sidebar-collapsed/);
});

test('signed-in shared header exposes a Dashboard shortcut',()=>{
  assert.match(html,/data-dashboard-link/);
  const menu=readFileSync(new URL('../src/account-menu.js',import.meta.url),'utf8');
  assert.match(menu,/show\('dashboard-link',active\)/);
});


test('universal workspace search indexes tools, billing, profile and public pages',()=>{
  const js=readFileSync(new URL('../src/account-page.js',import.meta.url),'utf8');
  for(const label of ['About CrakkerXworld.AI','How it works','Privacy policy','Terms of use','Feedback & bug reports','Pricing page']) assert.ok(js.includes(label));
  for(const key of ['billing','payment','profile','support','analytics','overview','updates','Notifications']) assert.ok(js.includes(key));
  assert.match(js,/function buildDashboardSearchIndex\(/);
  assert.match(js,/function rankDashboardSearch\(/);
  assert.match(js,/function chooseDashboardSearchResult\(/);
  assert.match(js,/result.type==='notification'/);
  assert.match(html,/id="dash-search-results"/);
  assert.match(html,/data-dashboard-panel="profile"/);
});

test('dashboard profile and notification controls have working menu handlers',()=>{
  const js=readFileSync(new URL('../src/account-page.js',import.meta.url),'utf8');
  assert.match(html,/data-dash-profile-toggle/);
  assert.match(html,/data-dash-notification-toggle/);
  assert.match(html,/data-dashboard-signout/);
  assert.match(js,/function initDashboardTopbarMenus\(/);
  assert.match(js,/data-dashboard-signout/);
  assert.match(js,/dash-profile-menu/);
});
