import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');

test('light theme defines a readable workspace palette',()=>{
  assert.match(css,/:root\[data-theme="light"\]\{[\s\S]*?--dash-light-text:#1d2939/);
  assert.match(css,/:root\[data-theme="light"\] #dashboard\.dashboard\{[\s\S]*?background:var\(--dash-light-bg\)/);
  assert.match(css,/:root\[data-theme="light"\] #dashboard \.dash-content\{[\s\S]*?background:/);
});

test('light theme fixes headings and greeting contrast',()=>{
  assert.match(css,/:root\[data-theme="light"\] #dashboard \.dash-page-heading h2\{[\s\S]*?color:#182338/);
  assert.match(css,/:root\[data-theme="light"\] #dashboard \.dash-greeting h2\{[\s\S]*?color:#17243a/);
  assert.match(css,/:root\[data-theme="light"\] #dashboard \.dash-greeting\{[\s\S]*?background:/);
  assert.match(css,/:root\[data-theme="light"\] \.account-heading h1\{[\s\S]*?color:#172033/);
});

test('all dashboard view types have explicit light theme text and surfaces',()=>{
  for(const selector of [
    '.dash-stat','.dash-panel','.dash-data-table th','.dash-data-table td',
    '.dash-file-card','.dash-resource-card','.dash-plan-feature-card',
    '.dash-update-feature','.dash-support-grid h3','.dash-secondary-intro h3'
  ]){
    assert.ok(css.includes(`:root[data-theme="light"] #dashboard ${selector}`),`Missing light-theme rule for ${selector}`);
  }
});

test('light theme override keeps typography unchanged',()=>{
  const marker='LIGHT THEME ACCESSIBILITY FIX';
  const start=css.indexOf(marker);
  assert.ok(start>=0,'Light theme override block exists');
  const tail=css.slice(start);
  const end=tail.indexOf('/* Dashboard search, profile and notification controls');
  const block=end>=0?tail.slice(0,end):tail;
  assert.doesNotMatch(block,/font-size\s*:/i);
  assert.doesNotMatch(block,/font-family\s*:/i);
  assert.doesNotMatch(block,/line-height\s*:/i);
});
