import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tools } from '../src/catalog.mjs';

const read = (path) => fs.readFileSync(path, 'utf8');
const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;');

test('every tool has a unique search title and page-specific meta description', () => {
  const titles = new Set();
  for (const tool of tools) {
    assert.ok(tool.seoTitle && tool.seoDescription, `${tool.slug} needs SEO title and description`);
    assert.ok(tool.seoDescription.length >= 120 && tool.seoDescription.length <= 170, `${tool.slug} meta description length: ${tool.seoDescription.length}`);
    const title = `${tool.seoTitle} | CrakkerXworld.AI`;
    assert.ok(title.length <= 70, `${tool.slug} title is too long (${title.length})`);
    assert.ok(!titles.has(title), `Duplicate title: ${title}`);
    titles.add(title);
  }
});

test('all eight generated tool pages contain unique metadata, visible guidance and canonical URLs', () => {
  for (const tool of tools) {
    const html = read(`tools/${tool.slug}/index.html`);
    assert.ok(html.includes(`<title>${escapeHtml(tool.seoTitle)} | CrakkerXworld.AI</title>`), `${tool.slug} title missing`);
    assert.ok(html.includes(`name="description" content="${escapeHtml(tool.seoDescription)}"`), `${tool.slug} meta description missing`);
    assert.ok(html.includes(`rel="canonical" href="https://www.crakkerxai.com/tools/${tool.slug}/"`), `${tool.slug} canonical missing`);
    assert.ok(html.includes(`<h1>${tool.title}</h1>`), `${tool.slug} H1 missing`);
    assert.ok(html.includes(tool.seoIntro), `${tool.slug} SEO introduction missing`);
    assert.ok(html.includes('Supported formats and options'), `${tool.slug} format section missing`);
    assert.ok(html.includes('Common questions about'), `${tool.slug} FAQ section missing`);
    assert.ok(html.includes('tool-seo-related'), `${tool.slug} related links missing`);
    assert.ok(html.includes('locally in your browser'), `${tool.slug} privacy explanation missing`);
  }
});

test('related tool links resolve to existing pages and homepage links all tools', () => {
  const home = read('index.html');
  for (const tool of tools) {
    assert.ok(home.includes(`href="tools/${tool.slug}/"`), `Homepage link missing: ${tool.slug}`);
    assert.ok(tool.related.length >= 2, `${tool.slug} should have at least two related tools`);
    const html = read(`tools/${tool.slug}/index.html`);
    for (const relatedSlug of tool.related) {
      assert.ok(tools.some(item => item.slug === relatedSlug), `Unknown related tool ${relatedSlug}`);
      assert.ok(html.includes(`href="../../tools/${relatedSlug}/"`), `${tool.slug} does not link to ${relatedSlug}`);
    }
  }
});

test('tool structured data is valid JSON-LD and includes application, webpage and breadcrumbs', () => {
  for (const tool of tools) {
    const html = read(`tools/${tool.slug}/index.html`);
    const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    assert.ok(scripts.length >= 2, `${tool.slug} should include organization and tool structured data`);
    const parsed = scripts.map(match => JSON.parse(match[1]));
    const graph = parsed.find(item => Array.isArray(item['@graph']))?.['@graph'] || [];
    assert.ok(graph.some(item => item['@type'] === 'SoftwareApplication'), `${tool.slug} SoftwareApplication schema missing`);
    assert.ok(graph.some(item => item['@type'] === 'WebPage'), `${tool.slug} WebPage schema missing`);
    assert.ok(graph.some(item => item['@type'] === 'BreadcrumbList'), `${tool.slug} BreadcrumbList schema missing`);
    assert.ok(!JSON.stringify(graph).includes('aggregateRating'), 'Do not invent reviews or ratings');
  }
});

test('homepage reinforces brand variants and the main PDF/image search topics', () => {
  const home = read('index.html');
  assert.ok(home.includes('Crakker X World | Official Website of CrakkerXworld.AI'));
  assert.ok(home.includes('Crakker X World is the name visitors may search for when looking for CrakkerXworld.AI'));
  const websiteScript = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1])).find(item => item['@type'] === 'WebSite');
  assert.ok(websiteScript.alternateName.includes('Crakker X World AI'));
  assert.ok(home.includes('Online PDF and image conversion services'));
  const orgScript = [...home.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1])).find(item => item['@type'] === 'Organization');
  assert.ok(orgScript.alternateName.includes('CrakkerXAI'));
  assert.ok(orgScript.alternateName.includes('Crakker X World AI'));
});

test('sitemap still lists all eight tool URLs and account remains excluded from indexing', () => {
  const sitemap = read('public/sitemap.xml');
  const robots = read('public/robots.txt');
  for (const tool of tools) assert.ok(sitemap.includes(`https://www.crakkerxai.com/tools/${tool.slug}/`));
  assert.ok(!robots.includes('Disallow: /account/'));
  assert.ok(read('account/index.html').includes('noindex,nofollow'), 'Account page should remain noindex while crawlable');
  assert.ok(robots.includes('Sitemap: https://www.crakkerxai.com/sitemap.xml'));
});


test('each tool page explains a practical example and limitations unique to the tool', () => {
  for (const tool of tools) {
    const html = read(`tools/${tool.slug}/index.html`);
    assert.ok(tool.example && tool.limitations, `${tool.slug} needs example and limitations content`);
    assert.ok(html.includes('A practical example'), `${tool.slug} example section missing`);
    assert.ok(html.includes(escapeHtml(tool.example)), `${tool.slug} example text missing`);
    assert.ok(html.includes('Limitations to know before converting'), `${tool.slug} limitations section missing`);
    assert.ok(html.includes(escapeHtml(tool.limitations)), `${tool.slug} limitations text missing`);
  }
});

test('Contact, FAQ and Disclaimer pages are built, linked and included in the sitemap', () => {
  for (const slug of ['contact', 'faq', 'disclaimer']) {
    assert.ok(fs.existsSync(`${slug}/index.html`), `${slug} page is missing`);
    const html = read(`${slug}/index.html`);
    assert.ok(html.includes(`rel="canonical" href="https://www.crakkerxai.com/${slug}/"`));
    assert.ok(html.includes('<h1>'));
    assert.ok(read('public/sitemap.xml').includes(`https://www.crakkerxai.com/${slug}/`));
  }
  assert.ok(read('vite.config.js').includes('contact/index.html'));
  const faq = read('faq/index.html');
  const faqSchema = [...faq.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(match => JSON.parse(match[1])).find(item => item['@type'] === 'FAQPage');
  assert.ok(faqSchema && faqSchema.mainEntity.length === 10);
  assert.equal((faq.match(/<summary>/g) || []).length, faqSchema.mainEntity.length, 'FAQ schema must match all visible FAQ entries');
  const pricing = read('pricing/index.html');
  assert.ok(pricing.includes('How do I ask about a payment or refund?'));
  assert.ok(pricing.includes('href="../contact/"'), 'Pricing support link should resolve to Contact Us');
  assert.ok(!pricing.includes('published support contact'));
  assert.ok(!pricing.includes('under the refund policy'));
});

test('privacy notice describes actual browser file handling and the real feedback channel', () => {
  const privacy = read('privacy/index.html');
  assert.ok(privacy.includes('does not send the selected file contents to the conversion server'));
  assert.ok(privacy.includes('local browser storage'));
  assert.ok(privacy.includes('daily guest conversion counter'));
  assert.ok(privacy.includes('feedback endpoint'));
  assert.ok(privacy.includes('href="../contact/"'));
  assert.ok(!privacy.includes('published contact channel'));
});
