import fs from 'node:fs';import path from 'node:path';
import {tools} from '../src/catalog.mjs';
const root=process.cwd();const pub='ca-pub-8574777140654469';
const desc='Free, private PDF and image tools: convert, merge, extract, rotate, resize and compress. No sign-up, no file uploads.';
const escapeHtml=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const icon=(name,cls='')=>{
 const icons={
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
 'file-image':'<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Z"/><path d="M13 2v7h7"/><circle cx="9" cy="13" r="1"/><path d="m7 19 4-4 2 2 2-3 3 5"/>',
 files:'<path d="M16 3H6a2 2 0 0 0-2 2v12"/><rect x="8" y="7" width="12" height="14" rx="2"/><path d="M12 12h4M12 16h4"/>',
 scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8.12 8.12 12.26 12.26M14.5 9.5l5.9-5.9M8.12 15.88l3-3"/>',
 rotate:'<path d="M2 12a10 10 0 0 1 18-6"/><path d="M20 2v4h-4"/><path d="M22 12a10 10 0 0 1-18 6"/><path d="M4 22v-4h4"/>',
 repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11V8a2 2 0 0 1 2-2h16"/><path d="m7 22-4-4 4-4"/><path d="M21 13v3a2 2 0 0 1-2 2H3"/>',
 maximize:'<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M8 8h8v8H8z"/>',
 minimize:'<path d="m8 3 0 5H3M21 8h-5V3M3 16h5v5M16 21v-5h5"/><path d="m3 8 5-5M16 8l5-5M3 16l5 5M21 16l-5 5"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5"/><path d="M5 17v3h14v-3"/>',
 upload:'<path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
 shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
 check:'<path d="m5 12 4 4L19 6"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/>',plus:'<path d="M12 4v16M4 12h16"/>',
 trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6M10 10v7m4-7v7"/>', up:'<path d="m6 15 6-6 6 6"/>', down:'<path d="m6 9 6 6 6-6"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>'
 };
 return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]||icons.image}</svg>`;
};
const link=(target,depth)=>'../'.repeat(depth)+target;
function layout({title,description,main,depth=0,slug='',contentClass='',extraMeta=''}){
 const at=(p)=>link(p,depth);const canonical=`https://www.crakkerxai.com/${depth?slug+'/':''}`;
 return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="theme-color" content="#fbfcf7"/><meta name="description" content="${escapeHtml(description||desc)}"/>
<meta name="google-adsense-account" content="${pub}"/>
<link rel="canonical" href="${canonical}"/><meta property="og:type" content="website"/><meta property="og:title" content="${escapeHtml(title)}"/><meta property="og:description" content="${escapeHtml(description||desc)}"/>
<link rel="icon" href="${at('favicon.svg')}" type="image/svg+xml"/>
<title>${escapeHtml(title)} | CrakkerX AI</title>${extraMeta}
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${pub}" crossorigin="anonymous"></script>
</head><body data-tool="${escapeHtml(slug.startsWith('tools/')?slug.split('/').pop():'')}" class="${contentClass}">
<header class="site-header"><div class="container header-inner"><a class="brand" href="${at('')}" aria-label="CrakkerX AI home"><span class="brand-icon">${icon('repeat')}</span><span>CrakkerX<span class="brand-green">AI</span></span></a>
<nav aria-label="Main navigation" class="main-nav"><a href="${at('')}#tools">All tools</a><a href="${at('how-it-works/')}">How it works</a><a href="${at('privacy/')}">Privacy</a></nav>
<a class="always-free" href="${at('about/')}"><span class="green-dot"></span> Always free</a></div></header>
<main>${main}</main>
<footer class="site-footer"><div class="container footer-grid"><div><a class="brand footer-brand" href="${at('')}"><span class="brand-icon">${icon('repeat')}</span><span>CrakkerX<span class="brand-green">AI</span></span></a><p>Little tools. Big time savers.<br/>Private PDF &amp; image utilities for everyday tasks.</p></div>
<div class="footer-links"><strong>Explore</strong><a href="${at('')}#tools">All tools</a><a href="${at('how-it-works/')}">How it works</a><a href="${at('about/')}">About</a></div>
<div class="footer-links"><strong>Information</strong><a href="${at('privacy/')}">Privacy</a><a href="${at('terms/')}">Terms of use</a><a href="${at('sitemap.xml')}">Sitemap</a></div></div>
<div class="container footer-bottom">© ${new Date().getFullYear()} CrakkerX AI. Made for simpler file tasks. Independent tools; not affiliated with Google.</div></footer>
<script type="module" src="/src/main.js"></script></body></html>`;
}
const card=(t,depth)=>`<a class="tool-card" data-cat="${t.category}" data-title="${t.title.toLowerCase()}" href="${link('tools/'+t.slug+'/',depth)}"><span class="tool-icon ${t.accent}">${icon(t.icon)}</span><span class="tool-card-go">↗</span><strong>${t.title}</strong><span>${t.subtitle}</span><span class="tool-card-cta">Open tool ${icon('arrow')}</span></a>`;
const home=`<section class="hero container"><p class="eyebrow"><span class="green-dot"></span> LITTLE TOOLS. BIG TIME SAVERS.</p>
<h1>Free PDF &amp; <span>Image Tools.</span></h1><p class="hero-desc">PNG to PDF, PDF to PNG, merge, resize and more.<br/>All your file tools, together. Completely free.</p><a class="primary-btn hero-btn" href="#tools">Find your tool ${icon('arrow')}</a>
<div class="trust-strip"><span>${icon('check')} No sign-up</span><span>${icon('check')} No watermarks</span><span>${icon('shield')} Files stay on your device</span></div></section>
<div class="container"><hr class="hero-rule"/></div><section class="catalog-section container" id="tools"><p class="eyebrow muted">THE EVERYDAY TOOLKIT</p><h2>A little tool for every task.</h2>
<div class="search-wrap">${icon('search')}<input id="tool-search" type="search" placeholder="Search tools…" aria-label="Search tools" /></div>
<div class="filter-row" aria-label="Filter tools"><button type="button" class="filter active" data-filter="all">All tools <span>8</span></button><button type="button" class="filter" data-filter="pdf">PDF tools <span>5</span></button><button type="button" class="filter" data-filter="image">Image tools <span>3</span></button></div>
<div class="tool-grid" id="tool-grid">${tools.map(t=>card(t,0)).join('')}</div><p id="no-results" class="hidden no-results">No matching tools. Try a different search.</p></section>
<section class="section-muted"><div class="container pillars"><div><span class="pillar-icon">${icon('shield')}</span><h3>Privacy comes first</h3><p>Your chosen files stay inside your browser. No file uploads or accounts are needed.</p></div><div><span class="pillar-icon">${icon('check')}</span><h3>Simple by design</h3><p>Pick a tool, choose a file, and download the result. No unnecessary steps.</p></div><div><span class="pillar-icon">${icon('download')}</span><h3>Download instantly</h3><p>No watermarks, no sign-up, and no waiting for an email with your files.</p></div></div></section>`;
function write(file,content){const p=path.join(root,file);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,content);}
write('index.html',layout({title:'Free PDF & Image Tools',main:home,contentClass:'homepage'}));
const options={
  'pdf-to-png':`<div class="field"><label for="scale">Image quality</label><select id="scale"><option value="1.5">High (1.5×)</option><option value="2">Extra high (2×)</option><option value="1">Standard (1×)</option></select></div>`,
  'extract-pdf-pages':`<div class="field"><label for="pages">Pages to extract <small>(example: 1,3,5-7 or all)</small></label><input id="pages" type="text" value="1" placeholder="1,3,5-7" /></div>`,
  'rotate-pdf':`<div class="options-grid"><div class="field"><label for="angle">Rotation</label><select id="angle"><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">270° clockwise</option></select></div><div class="field"><label for="pages">Pages <small>(blank = all)</small></label><input id="pages" type="text" placeholder="all" /></div></div>`,
  'convert-image':`<div class="options-grid"><div class="field"><label for="format">Output format</label><select id="format"><option value="webp">WebP</option><option value="jpg">JPG</option><option value="png">PNG</option></select></div><div class="field"><label for="quality">Quality <span id="quality-label">85%</span></label><input id="quality" type="range" min="35" max="100" value="85"/></div></div>`,
  'resize-image':`<div class="options-grid"><div class="field"><label for="width">Width (pixels)</label><input id="width" type="number" min="1" max="12000" value="1200" inputmode="numeric"/></div><div class="field"><label for="height">Height (pixels)</label><input id="height" type="number" min="1" max="12000" value="800" inputmode="numeric" disabled/></div></div><label class="checkbox-row"><input id="lockAspect" type="checkbox" checked/> Keep original aspect ratio</label>`,
  'compress-image':`<div class="options-grid"><div class="field"><label for="format">Output format</label><select id="format"><option value="webp">WebP (recommended)</option><option value="jpg">JPG</option></select></div><div class="field"><label for="quality">Quality <span id="quality-label">75%</span></label><input id="quality" type="range" min="30" max="95" value="75"/></div></div><div class="field"><label for="maxDimension">Maximum width/height <small>(optional)</small></label><select id="maxDimension"><option value="">Keep original dimensions</option><option value="2560">2560 pixels</option><option value="1920">1920 pixels</option><option value="1280">1280 pixels</option><option value="800">800 pixels</option></select></div>`
};
for(const t of tools){
 const html=`<section class="tool-page container"><div class="breadcrumbs"><a href="../../">All tools</a><span>/</span>${t.title}</div>
<div class="tool-panel" id="converter" data-tool-name="${t.slug}"><span class="tool-icon large ${t.accent}">${icon(t.icon)}</span><h1>${t.title}</h1><p class="tool-lead">${t.subtitle}</p>
<div class="drop-zone" id="drop-zone"><span class="upload-arrow">${icon('upload')}</span><button class="primary-btn select-btn" type="button" id="choose-file">Choose files ${icon('plus')}</button>
<p>or drop files here · 50 MB total maximum</p><input class="sr-only" type="file" id="file-input" accept="${t.accept}" ${t.multiple?'multiple':''} aria-label="Choose files for ${t.title}" /></div>
<div id="file-list" class="file-list" aria-live="polite"></div><p class="upload-hint">${t.tips||'Your files stay on your device. Nothing is uploaded.'}</p>
${options[t.slug]||''}
<p id="progress" class="progress-text" role="status" aria-live="polite"></p><p id="error" class="error-box hidden" role="alert"></p>
<button type="button" id="run-btn" class="primary-btn run-btn" disabled>${t.button} ${icon('arrow')}</button>
<div id="result" class="result hidden" aria-live="polite"><div class="result-status"><span>${icon('check')}</span><strong id="result-status">Ready!</strong></div><a id="download-link" class="download-btn" href="#" download>${icon('download')} <span id="download-label">Download result</span></a></div>
<p class="privacy-line">${icon('shield')} Private by design. No uploads, no watermarks.</p></div>
<section class="ad-section hidden" id="result-ad" aria-label="Advertisement"><p class="ad-label">Advertisements</p><div class="ad-wrapper" id="ad-container"></div></section>
<section class="tool-explain"><h2>How to use ${t.title}</h2><ol>${t.instructions.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ol>
<h2>About ${t.title}</h2><p>${escapeHtml(t.description)}</p>
<h2>Common questions</h2><div class="faq-list">${t.faq.map(([q,a])=>`<details><summary>${escapeHtml(q)}</summary><p>${escapeHtml(a)}</p></details>`).join('')}</div>
<div class="back-tools"><a href="../../#tools">Browse all tools ${icon('arrow')}</a></div></section></section>`;
 write(`tools/${t.slug}/index.html`,layout({title:`${t.title} — Free Online Tool`,description:t.description,main:html,depth:2,slug:`tools/${t.slug}`}));
}
const staticPages={
 'how-it-works':{title:'How it works',lead:'From file to finished in three simple steps.',body:`<section><h2>1. Choose a tool</h2><p>Pick one of eight free tools for PDF and image conversion, editing or compression. Each has its own page with instructions and sensible defaults.</p><h2>2. Select files on your device</h2><p>Drag and drop a file or tap Choose files. Your selected files stay in your browser. We do not receive or store the file contents on our servers.</p><h2>3. Download the result</h2><p>Conversions use local browser technology, including PDF rendering and standard image canvas functions. Once finished, download your file directly. Multi-file image output is packaged as a ZIP.</p><h2>Supported files</h2><p>We support standard PDF files plus PNG, JPG/JPEG and WebP images. Password-protected PDFs, certain uncommon PDF features and unsupported image formats may not work. Total input is limited to 50 MB per conversion for browser performance.</p><h2>Stay safe</h2><p>Keep a backup of important originals, review your output before sharing it, and use a compatible, up-to-date browser. Our tools are free to use without signing up.</p></section>`},
 'about':{title:'About CrakkerX AI',lead:'Little tools. Big time savers.',body:`<section><h2>Why we built this toolkit</h2><p>CrakkerX AI provides easy-to-use tools for everyday PDF and image tasks. Instead of asking you to create an account or upload personal files to a server, common editing and conversion tasks run directly in your browser.</p><h2>What you can do</h2><p>Combine images into a PDF, convert PDF pages to images, merge PDFs, extract or rotate pages, change picture formats, resize images and compress them for convenient sharing.</p><h2>Our approach</h2><p>We aim for clear tools, simple mobile-friendly controls and visible download links. We do not apply watermarks to your output. Browser capabilities and input formats have limits, so review your finished files before relying on them.</p><h2>Keeping the tools free</h2><p>We may display clearly identified advertising on this website. Ads are separate from download buttons, and you will never be required to click an ad to receive a converted file.</p></section>`},
 'privacy':{title:'Privacy Policy',lead:'Your files belong to you. We build around that.',body:`<section><p><strong>Effective date:</strong> 8 November 2026</p><h2>File processing</h2><p>When you use our converter tools, the files you select are processed locally on your device using browser technologies. File contents are not sent to our conversion server. Downloaded results are created in your browser; we do not retain copies of the files you select.</p><h2>Information automatically handled by hosting</h2><p>Our hosting provider may process standard technical requests such as IP address, user agent and timestamps for security, operation and diagnostics. This is separate from the content of any local files being converted.</p><h2>Advertising and cookies</h2><p>This site may use Google AdSense to serve advertisements. Google and its partners may use cookies, local storage or similar technologies to deliver ads, prevent fraud and measure performance, subject to relevant law and consent requirements. Review <a href="https://policies.google.com/technologies/ads" rel="noopener noreferrer" target="_blank">Google's advertising technologies</a> and <a href="https://policies.google.com/privacy" rel="noopener noreferrer" target="_blank">Google's privacy policy</a>.</p><h2>Third-party code</h2><p>Our PDF processing libraries are bundled with the site. Google advertising scripts are loaded separately and may communicate with Google's services. We do not intentionally share selected file contents with Google Ads.</p><h2>Data retention</h2><p>We do not operate user accounts or a database of uploaded conversion files. Browser memory and temporary download URLs are cleared as you leave or refresh the page.</p><h2>Your options</h2><p>You can configure cookie preferences in your browser and use applicable consent controls if they are offered. If you choose not to allow advertising cookies, personalized advertising may be limited.</p><h2>Changes</h2><p>We may update this policy if our services or legal requirements change. The effective date above identifies this version.</p><p><strong>Site:</strong> www.crakkerxai.com</p></section>`},
 'terms':{title:'Terms of Use',lead:'Simple rules for using our free tools.',body:`<section><p><strong>Effective date:</strong> 8 November 2026</p><h2>Use of tools</h2><p>CrakkerX AI provides browser-based PDF and image tools on an as-available basis. You are responsible for having the rights to process and use the files you select.</p><h2>Check your results</h2><p>Conversions may alter file formats, image compression, resolution, page layout or metadata. Review results carefully. Do not rely on a converted document as the only copy of an important original.</p><h2>Technical limits</h2><p>We do not guarantee support for all PDFs or image variants. Large files, encrypted documents, damaged files and browser memory limits can prevent conversion.</p><h2>Advertising</h2><p>Advertisements may appear on this website. Download links are independent of advertisements. We do not require advertising clicks, advertising views, sign-up or payment to obtain converted results.</p><h2>Availability</h2><p>We may improve or change tools without advance notice. These tools are offered without warranties to the extent permitted by law.</p><h2>Privacy</h2><p>Read our <a href="../privacy/">Privacy Policy</a> for information about file processing and website advertising.</p></section>`}
};
for(const [slug,s] of Object.entries(staticPages)){
 const main=`<section class="article-page container"><div class="breadcrumbs"><a href="../">Home</a><span>/</span>${s.title}</div><p class="eyebrow muted">CRAKKERX AI</p><h1>${s.title}</h1><p class="article-lead">${s.lead}</p><div class="article-content">${s.body}</div></section>`;
 write(`${slug}/index.html`,layout({title:s.title,description:s.lead,main,depth:1,slug}));
}
const urls=['','about/','privacy/','terms/','how-it-works/',...tools.map(t=>`tools/${t.slug}/`)];
write('public/sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>https://www.crakkerxai.com/${u}</loc></url>`).join('')}</urlset>`);
console.log(`Generated homepage, ${tools.length} tool pages, ${Object.keys(staticPages).length} informational pages.`);
