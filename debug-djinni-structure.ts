// debug-djinni-structure.ts - Run to inspect current Djinni jobs page structure
// Usage: node --loader ts-node/esm debug-djinni-structure.ts
import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 1. Log in
    await page.goto('https://djinni.co/login?from=landing_international&lang=en');
    await page.fill('#email', process.env.DJINI_EMAIL || '');
    await page.fill('#password', process.env.DJINI_PASSWORD || '');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/my/inbox/**');

    // 2. Navigate to jobs - use a simpler URL first (fewer filters = more likely to have results)
    const simpleJobsUrl = 'https://djinni.co/jobs/?primary_keyword=JavaScript&exp_level=1y&employment=remote&publication_period=7';
    console.log('Navigating to:', simpleJobsUrl);
    await page.goto(simpleJobsUrl, { waitUntil: 'networkidle', timeout: 60000 });

    // 3. Wait a bit for any JS-rendered content
    await page.waitForTimeout(5000);

    // 4. Dump page HTML for inspection
    const html = await page.content();
    fs.writeFileSync('djinni-jobs-page.html', html, 'utf-8');
    console.log('Saved page HTML to djinni-jobs-page.html');

    // 5. Try various selectors and report what we find
    const selectorsToTry = [
      '.job-item__title-link',
      '.job-list-item__title-link',
      '.job-list-item__link',
      '.job-list-item',
      'a[href*="/jobs/"]',
      '[class*="job-item"]',
      '[class*="job-list"]',
    ];

    console.log('\n--- Selector check ---');
    for (const sel of selectorsToTry) {
      try {
        const count = await page.$$eval(sel, (el) => el.length);
        const sample = await page.$$eval(
          sel,
          (els, s) =>
            els
              .slice(0, 3)
              .map((e) => ({
                tag: e.tagName,
                class: (e as HTMLElement).className,
                href: (e as HTMLAnchorElement).href?.substring(0, 60),
              })),
          sel
        );
        console.log(`${sel}: found ${count} | sample:`, JSON.stringify(sample, null, 2));
      } catch (e) {
        console.log(`${sel}: ERROR -`, (e as Error).message);
      }
    }

    // 6. Find all links that look like job links (contain /jobs/ in href)
    const jobLikeLinks = await page.$$eval('a[href*="/jobs/"]', (links) =>
      links
        .filter((a) => /\/jobs\/\d+-/.test((a as HTMLAnchorElement).href))
        .slice(0, 5)
        .map((a) => ({
          href: (a as HTMLAnchorElement).href,
          class: (a as HTMLElement).className,
          text: (a as HTMLElement).textContent?.trim().substring(0, 50),
        }))
    );
    console.log('\n--- Job-like links (href contains /jobs/ID-) ---');
    console.log(JSON.stringify(jobLikeLinks, null, 2));
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await browser.close();
  }
})();
