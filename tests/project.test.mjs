import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {tools} from '../src/catalog.mjs';
test('eight distinct tool pages',()=>{
  assert.equal(tools.length,8);assert.equal(new Set(tools.map(t=>t.slug)).size,8);
  for(const t of tools){const page=fs.readFileSync(`tools/${t.slug}/index.html`,'utf8');assert.ok(page.includes(`<h1>${t.title}</h1>`));assert.ok(page.includes('name="google-adsense-account"'));}
});
test('ads.txt is correctly formatted',()=>{
  assert.equal(fs.readFileSync('public/ads.txt','utf8').trim(),'google.com, pub-8574777140654469, DIRECT, f08c47fec0942fa0');
});
test('no file transfer in conversion logic',()=>{
  const code=fs.readFileSync('src/converters.js','utf8');
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(code),'Conversion engine must be local');
});
test('sitemap includes tool pages',()=>{
  const s=fs.readFileSync('public/sitemap.xml','utf8');
  for(const t of tools)assert.ok(s.includes(`https://www.crakkerxai.com/tools/${t.slug}/`));
});
test('premium homepage, account workspace and PDF export dialog are generated',()=>{
  const home=fs.readFileSync('index.html','utf8');
  const account=fs.readFileSync('account/index.html','utf8');
  const pdf=fs.readFileSync('tools/pdf-to-png/index.html','utf8');
  const css=fs.readFileSync('src/styles.css','utf8');
  const main=fs.readFileSync('src/main.js','utf8');
  assert.ok(home.includes('Every file task.')&&home.includes('preview-window'));
  assert.ok(account.includes('dash-sidebar')&&account.includes('dash-stat-grid')&&account.includes('id="logout"'));
  assert.ok(pdf.includes('id="pdf-export-modal"')&&pdf.includes('name="export-pages"')&&pdf.includes('id="include-original-pdf"'));
  assert.ok(main.includes('confirm-pdf-export')&&main.includes('outputFormat'));
  assert.ok(css.includes('.hero-premium')&&css.includes('.dash-sidebar')&&css.includes('.conversion-modal'));
});
test('dual themes, feedback workflow, AI updates and sitemap routes are generated',()=>{
  const home=fs.readFileSync('index.html','utf8');
  const feedback=fs.readFileSync('feedback/index.html','utf8');
  const ai=fs.readFileSync('ai-updates/index.html','utf8');
  const main=fs.readFileSync('src/main.js','utf8');
  const worker=fs.readFileSync('server/worker.js','utf8');
  const css=fs.readFileSync('src/styles.css','utf8');
  const sql=fs.readFileSync('supabase/migrations/20261117_feedback_submissions.sql','utf8');
  const sitemap=fs.readFileSync('public/sitemap.xml','utf8');
  assert.ok(home.includes('data-theme-toggle')&&home.includes('AI Updates')&&home.includes('Feedback'));
  assert.ok(home.includes("localStorage.getItem('cx_theme')"));
  for(const field of ['name','email','phone','whatsapp','category','subject','message'])assert.ok(feedback.includes(`name="${field}"`));
  assert.ok(ai.includes('data-ai-updates')&&ai.includes('data-ai-story-list')&&ai.includes('data-ai-source-list'));
  const pythonApi=fs.readFileSync('backend/app/main.py','utf8');
  assert.ok(pythonApi.includes('AI_NEWS_FEEDS')&&pythonApi.includes('AWS Machine Learning')&&pythonApi.includes('Microsoft Azure')&&pythonApi.includes('/api/ai/updates'));
  assert.ok(main.includes('function initAiUpdatesFeed')&&main.includes('/api/ai/updates'));
  assert.ok(css.includes('.ai-story-card')&&css.includes('.ai-widget')&&css.includes('font-size:clamp(36px,4.25vw,54px)'));
  assert.ok(css.includes(':root[data-theme=\"light\"] .ai-story-title'));
  const vite=fs.readFileSync('vite.config.js','utf8');
  assert.ok(vite.includes('feedback/index.html')&&vite.includes('ai-updates/index.html'));
  assert.ok(worker.includes('incoming.searchParams.has(\'refresh\')'));  
  assert.ok(main.includes('function initTheme')&&main.includes('function initFeedbackForm')&&main.includes("fetch('/api/feedback'"));
  assert.ok(worker.includes("path==='/api/feedback'")&&worker.includes('handleFeedback'));
  assert.ok(sql.includes('feedback_submissions')&&sql.includes('enable row level security'));
  assert.ok(css.includes(':root[data-theme="dark"]')&&css.includes(':root[data-theme="light"]'));
  assert.ok(sitemap.includes('/feedback/')&&sitemap.includes('/ai-updates/'));
});
