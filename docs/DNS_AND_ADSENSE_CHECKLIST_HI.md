# DNS & AdSense checklist — Cloudflare Pages

- Source repository: GitHub; production hosting: Cloudflare Pages.
- Existing website stays on ChatGPT Sites until DNS switched.
- Deploy and test all 8 tools at `YOUR_PROJECT.pages.dev` first.
- Cloudflare Pages > Custom domains > add `www.crakkerxai.com`.
- In GoDaddy DNS, EDIT `www` CNAME from `custom-domains.chatgpt.site`
  to your exact `YOUR_PROJECT.pages.dev` hostname.
- Preserve Search Console verification TXT and email/NS records.
- Avoid touching apex until you plan root-domain redirect separately.
- Confirm https://www.crakkerxai.com/ and /ads.txt.
- AdSense Meta tag already in HEAD; ads.txt already in `public/ads.txt`.
- After verification request review. Actual ads require Ready approval.
- Never force 60-second ad before download; against AdSense policy.

Read `docs/DEPLOY_GITHUB_CLOUDFLARE_HI.md` for full detail.
