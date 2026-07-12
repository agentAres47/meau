// Step 2 experiment (see AMIZONE-REAL-LOGIN-SESSION.md): drive a REAL browser
// through Amizone's login and observe whether Cloudflare Turnstile lets an
// automated browser through or throws a challenge.
//
// SECURITY:
// - Credentials come ONLY from env vars (AMIZONE_USER / AMIZONE_PASS). Never
//   hardcoded, never written to a file, never printed. Password stays in memory.
// - We never log the password or dump full page HTML (which could echo an input).
// - Screenshots show the rendered page (password field renders as dots).
//
// Outputs: 0x_*.png screenshots + result.json (no secrets) in this folder.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { stdin, stdout } from 'node:process';

// Ask in the terminal; password echo is suppressed. Nothing is stored.
function ask(query, hidden = false) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: stdin, output: stdout });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes('\n')) rl.output.write('\n');
      };
      rl.output.write(query);
    }
    rl.question(hidden ? '' : query, (a) => {
      rl.close();
      resolve(a.trim());
    });
  });
}

// Credentials from env (if set) else interactive prompt. In memory only.
const USER = process.env.AMIZONE_USER || (await ask('Amizone ID: '));
const PASS = process.env.AMIZONE_PASS || (await ask('Amizone password (hidden): ', true));
if (!USER || !PASS) {
  console.error('Both Amizone ID and password are required.');
  process.exit(2);
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const steps = [];
const log = (s) => {
  steps.push(s);
  console.log(s);
};

// Prefer the real installed Chrome (looks less automated than bundled Chromium);
// fall back to Chromium. This is "use a real browser", not "defeat the check".
let browser;
try {
  browser = await chromium.launch({ headless: false, channel: 'chrome' });
  log('launched: system Chrome (headful)');
} catch {
  browser = await chromium.launch({ headless: false });
  log('launched: bundled Chromium (headful)');
}

const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const result = { outcome: 'unknown' };

try {
  log('navigating to https://s.amizone.net/');
  await page.goto('https://s.amizone.net/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000); // let Turnstile initialise
  await page.screenshot({ path: '01_loaded.png', fullPage: true });

  const turnstileCount = await page
    .locator('script[src*="turnstile"], .cf-turnstile, [name="cf-turnstile-response"]')
    .count();
  log(`turnstile widget present: ${turnstileCount > 0}`);

  await page.fill('input[name="_UserName"]', USER);
  await page.fill('input[name="_Password"]', PASS);
  log('filled credentials');

  // Poll for the Turnstile token to auto-populate (managed challenges can pass
  // silently). If it stays empty, that itself is the answer.
  let token = '';
  for (let i = 0; i < 20; i++) {
    token = await page
      .$eval('[name="cf-turnstile-response"]', (el) => el.value)
      .catch(() => '');
    if (token) break;
    await page.waitForTimeout(1000);
  }
  log(`turnstile token populated: ${token ? `YES (len ${token.length})` : 'NO'}`);
  await page.screenshot({ path: '02_before_submit.png', fullPage: true });

  // Submit via the real button if present, else requestSubmit() (runs onsubmit
  // validateToken(), unlike form.submit()).
  await Promise.all([
    page.waitForNavigation({ timeout: 30000 }).catch(() => null),
    (async () => {
      const btn = page.locator('button[type="submit"], input[type="submit"], #loginbtn').first();
      if (await btn.count()) await btn.click().catch(() => {});
      else await page.evaluate(() => document.getElementById('loginform')?.requestSubmit());
    })(),
  ]);
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '03_after_submit.png', fullPage: true });

  const url = page.url();
  const title = await page.title().catch(() => '');
  const bodyPreview = (await page.locator('body').innerText().catch(() => '')).slice(0, 400);
  log(`post-submit url: ${url}`);
  log(`post-submit title: ${title}`);

  const challengeVisible = await page
    .locator('iframe[src*="challenges.cloudflare.com"], iframe[src*="turnstile"]')
    .count();

  if (/error\.html/i.test(url)) result.outcome = 'REJECTED (redirected to /Error.html — token likely missing/invalid)';
  else if (/dashboard|home|attendance|profile/i.test(`${url} ${title} ${bodyPreview}`))
    result.outcome = 'LOGIN_SUCCESS';
  else if (challengeVisible) result.outcome = 'CHALLENGE_SHOWN (interactive Turnstile — hard wall)';
  else result.outcome = 'UNKNOWN (inspect screenshots)';

  result.url = url;
  result.title = title;
  result.turnstileToken = token ? `populated(len ${token.length})` : 'empty';

  if (result.outcome === 'LOGIN_SUCCESS') {
    await page.goto('https://s.amizone.net/Profile', { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.screenshot({ path: '04_profile.png', fullPage: true });
    // Grab visible profile text only (no HTML dump). Manually eyeball the shot too.
    result.profilePreview = (await page.locator('body').innerText().catch(() => '')).slice(0, 800);
  }
} catch (e) {
  result.outcome = `ERROR: ${e?.message ?? e}`;
  log(result.outcome);
  await page.screenshot({ path: '09_error.png', fullPage: true }).catch(() => {});
} finally {
  writeFileSync('result.json', JSON.stringify({ ...result, steps }, null, 2));
  log(`DONE: ${result.outcome}`);
  await page.waitForTimeout(2000);
  await browser.close();
}
