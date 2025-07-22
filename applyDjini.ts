// applyDjini.ts
import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs';
// Remove pdf-parse import and PDF logic
// import pdfParse from 'pdf-parse';
// @ts-ignore
import fetch from 'node-fetch';

// Utility to load CV text from cache file
function getCVTextFromFile(cachePath: string): string {
  return fs.readFileSync(cachePath, 'utf-8');
}

async function generateCoverLetter(cvText: string, jobDescription: string, apiKey: string): Promise<string> {
  const prompt = `Write a professional, concise, and relevant cover letter for the following job description, using the provided CV as background.\n\nJob Description:\n${jobDescription}\n\nCV:\n${cvText}\n\nCover Letter:`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  });
  const data = await response.json();
  console.log(">>>>>>>>>>>>>>>>>>> data",data);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Hi, I am interested in this position...';
}

(async () => {
  const browser = await chromium.launch({ headless: false }); // Set to true to run in background
  const context = await browser.newContext();
  const page = await context.newPage();

  // Load CV text from cv.txt
  const cvText = getCVTextFromFile('cv.txt');

  // 1. Go to Djini login
  await page.goto('https://djinni.co/login?from=landing_international&lang=en');

  // 2. Log in
  await page.fill('#email', process.env.DJINI_EMAIL || '');
  await page.fill('#password', process.env.DJINI_PASSWORD || '');
  await page.click('button[type="submit"]');
  // Wait for the successful login redirect to the inbox, which is more reliable
  await page.waitForURL('**/my/inbox/**');

  // 3. Navigate to filtered job listings based on requirements
  const keywords = [
    "JavaScript", "React.js", "Svelte", "Vue.js",
    "Strapi", "Python", "Nodejs", "Golang", "Nestjs", "Html", "Css"
  ];
  const expLevels = ["no_exp", "1y", "2y", "3y"];
  const baseUrl = "https://djinni.co/jobs/?";
  const keywordParams = keywords.map(k => `primary_keyword=${encodeURIComponent(k)}`).join("&");
  const expParams = expLevels.map(e => `exp_level=${e}`).join("&");
  const jobsUrl = `${baseUrl}${keywordParams}&${expParams}&employment=remote&publication_period=7&region=other`;
  await page.goto(jobsUrl);

  // Wait for the first job link to appear. This is more reliable than waiting for a container.
  await page.waitForSelector('.job-item__title-link');

  // 4. Loop through jobs and apply (simplified version)
  // Loop through the first 5 pages
  for (let pageNum = 1; pageNum <= 5; pageNum++) {
    const pagedJobsUrl = jobsUrl + `&page=${pageNum}`;
    await page.goto(pagedJobsUrl);
    await page.waitForSelector('.job-item__title-link');
    const jobLinks = await page.$$eval('.job-item__title-link', links => links.map(link => (link as HTMLAnchorElement).href));
    for (const link of jobLinks) {
      await page.goto(link);


      // Log all button texts for debugging
      const allButtons = await page.$$eval('button', btns => btns.map(btn => btn.textContent?.trim()));
      console.log('All button texts on page:', allButtons);

      // Wait a bit longer before searching for the button
      await page.waitForTimeout(2000);

      // First, check if we have already applied to this job
      const alreadyAppliedLocator = page.locator('text=Your application has been sent');
      if (await alreadyAppliedLocator.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`--> SKIPPING (Already Applied): ${link}`);
        continue; // Move to the next job
      }

      // Find all potential "Apply" buttons and iterate to find a clickable one
      const applyButtons = await page.getByRole('button', { name: 'Apply for the job' }).all();
      let didApply = false;

      console.log(`Found ${applyButtons.length} potential 'Apply for the job' buttons.`);

      for (const applyButton of applyButtons) {
        try {
          // Use a short timeout to quickly check if the button is actionable
          if (await applyButton.isVisible({ timeout: 1000 })) {
            console.log(`--> APPLYING: ${link}`);
            await applyButton.click();
            
            // Scrape job description
            let jobDescription = '';
            try {
              jobDescription = await page.$eval('.job-description', el => el.textContent?.trim() || '');
            } catch {
              jobDescription = await page.content(); // fallback: use full page content
            }
            // Generate cover letter
            const coverLetter = await generateCoverLetter(cvText, jobDescription, process.env.GEMINI_API_KEY || '');
            await page.fill('#message', coverLetter);
            await page.click('#job_apply');
            
            console.log(`--> SUCCESS: Application sent for ${link}`);
            didApply = true;
            break; // Exit the loop since we've successfully applied
          }
        } catch (e) {
          // This button wasn't clickable, ignore and try the next one.
        }
      }

      if (!didApply) {
        console.log(`--> SKIPPING (No visible 'Apply' button found): ${link}`);
      }

      await page.waitForTimeout(4000); // Avoid rate limits
    }
  }

  await browser.close();
})();
