# CrakkerX AI — GitHub to Cloudflare Pages deployment

## Why Cloudflare Pages instead of GitHub Pages?

Your goal is an ad-supported commercial website. GitHub Pages terms do not
allow using GitHub Pages as free hosting for an online business or SaaS.
Keep source on GitHub; let Cloudflare Pages host the built site.
Official: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits

## Stage 1 — local validation

Windows CMD:

```bat
cd /d D:\Crakker.AI\crakkerxai-github-ready
npm install
npm test
npm run build
npm run preview
```

Check all 8 tools and output file downloads in the production preview.
Unit tests alone don't guarantee all browser conversions work.

## Stage 2 — GitHub repository (code only)

Create an empty GitHub repository such as `crakkerxai-tools`, then:

```bat
git init
git add .
git commit -m "CrakkerX AI — Cloudflare Pages release"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/crakkerxai-tools.git
git push -u origin main
```

Replace YOUR_USERNAME with your account name; do not paste a password or token
into a public source file. If git commands are not available, install Git for
Windows or upload folder contents through GitHub's Add file > Upload files UI.

## Stage 3 — Cloudflare Pages

1. https://dash.cloudflare.com/ -> Workers & Pages -> Create application -> Pages -> Connect to Git.
2. Authorize GitHub, select `crakkerxai-tools`.
3. Production branch `main`.
4. Build command: `npm run build`.
5. Build output directory: `dist`.
6. Root directory: leave empty if `package.json` is at repo root.
7. Deploy and open `https://YOUR_PROJECT.pages.dev/`.
8. Test homepage, all 8 tools, every Download, `/ads.txt` and `/privacy/`.

Cloudflare docs: https://developers.cloudflare.com/pages/configuration/build-configuration/

## Stage 4 — link GoDaddy www domain AFTER testing

1. Cloudflare Pages -> your project -> Custom domains -> Add custom domain:
   `www.crakkerxai.com`.
2. Cloudflare will show the exact target, generally `YOUR_PROJECT.pages.dev`.
3. In GoDaddy DNS, EDIT existing `CNAME www` pointing to
   `custom-domains.chatgpt.site`. Set it to your actual
   `YOUR_PROJECT.pages.dev` (do not create a duplicate `www` CNAME).
4. Wait for DNS/SSL activation, check `https://www.crakkerxai.com/` and
   `https://www.crakkerxai.com/ads.txt`. Keep TXT record for Search Console.
5. Apex `crakkerxai.com` is a separate concern: Cloudflare Pages requires
   Cloudflare DNS zone/nameservers to host the apex directly, OR use a
   separately configured domain-forwarding solution at the DNS provider to
   redirect bare domain to `https://www.crakkerxai.com/`. Do not edit
   nameservers or apex A/MX records blindly: email and existing routing
   can break. Check how current bare domain resolves first.

Cloudflare docs: https://developers.cloudflare.com/pages/configuration/custom-domains/

## Stage 5 — AdSense

Already in site HEAD on every page:

```html
<meta name="google-adsense-account" content="ca-pub-8574777140654469">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8574777140654469" crossorigin="anonymous"></script>
```

Already in `public/ads.txt`:

```
google.com, pub-8574777140654469, DIRECT, f08c47fec0942fa0
```

After published, check View Source and `/ads.txt` using the new domain.
AdSense -> Sites -> crakkerxai.com -> Meta tag -> Verify -> Request review.
Site must be approved / Ready before Google ads can serve. Approval may take
several days and sometimes 2–4 weeks; ads are not guaranteed per download.

After approved, create a Display ad unit and copy the numeric slot ID.
Cloudflare Pages -> project -> Settings -> Environment variables -> add
`VITE_ADSENSE_SLOT_ID=YOUR_NUMERIC_SLOT_ID` for Production -> redeploy.
Once a file conversion is complete, the ad unit appears in a separate
Advertisements section. Ad filling is up to Google. Download stays available
immediately and no ad is required to be clicked or watched.

**Never lock a download for 60 seconds to display an AdSense ad.** Google's
Ad placement policy forbids ads served for a preset time before downloads.
Official: https://support.google.com/adsense/answer/1346295?hl=en

## Additional checks

- Check mobile and desktop layout, all 8 tools, errors, download MIME/types.
- Check PNG transparency, multi-page PDF conversion, page count/order.
- Check `/privacy/`, `/terms/`, `/about/`, `/sitemap.xml`, HTTPS.
- Do not remove GoDaddy TXT ownership, SPF/DKIM, MX, DMARC, NS records.
- This recreation may differ from the original ChatGPT Sites source.
