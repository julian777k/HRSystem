/**
 * Playwright script to test R2 image loading on production landing page.
 * Run from: /Users/hong/Desktop/HR-SYSTEM/hr/
 * Command: npx playwright test test-r2-images.mjs --reporter=list
 *   OR: node test-r2-images.mjs (standalone)
 */

import { chromium } from 'playwright';

const BASE = 'https://keystonehr.app';

// All screenshot image paths used in the landing page
const SCREENSHOT_PATHS = [
  '/api/files/screenshots/03_dashboard.png',
  '/api/files/screenshots/25_mobile_dashboard.png',
  '/api/files/screenshots/10_welfare_catalog.png',
  '/api/files/screenshots/08_welfare_item_form.png',
  '/api/files/screenshots/13_overtime_request_filled.png',
  '/api/files/screenshots/15_time_wallet_balance.png',
  '/api/files/screenshots/15b_time_wallet_usage.png',
  '/api/files/screenshots/17_webhook_schedule_configured.png',
  '/api/files/screenshots/04_employee_list.png',
  '/api/files/screenshots/20_leave_calendar.png',
  '/api/files/screenshots/06_departments_expanded.png',
  '/api/files/screenshots/18_my_leave.png',
  '/api/files/screenshots/14_overtime_approval_list.png',
  '/api/files/screenshots/14_overtime_approved.png',
];

async function main() {
  console.log('='.repeat(70));
  console.log('R2 Image Loading Test — Production (keystonehr.app)');
  console.log('='.repeat(70));
  console.log();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // ── Step 1: Direct API route test ──────────────────────────────────
  console.log('--- Step 1: Direct API Route Tests ---');
  console.log();

  const apiResults = [];
  for (const path of SCREENSHOT_PATHS) {
    const url = `${BASE}${path}`;
    try {
      const resp = await page.request.get(url);
      const status = resp.status();
      const contentType = resp.headers()['content-type'] || '(none)';
      const contentLength = resp.headers()['content-length'] || '(unknown)';
      const ok = status === 200 && contentType.startsWith('image/');
      apiResults.push({ path, status, contentType, contentLength, ok });
      const icon = ok ? 'OK' : 'FAIL';
      console.log(`  [${icon}] ${status} ${contentType} size=${contentLength}  ${path}`);
    } catch (err) {
      apiResults.push({ path, status: 'ERROR', contentType: '-', contentLength: '-', ok: false, error: err.message });
      console.log(`  [FAIL] ERROR  ${path}  — ${err.message}`);
    }
  }

  const apiOk = apiResults.filter(r => r.ok).length;
  const apiFail = apiResults.filter(r => !r.ok).length;
  console.log();
  console.log(`  API summary: ${apiOk} OK, ${apiFail} FAIL out of ${apiResults.length} total`);
  console.log();

  // ── Step 2: Full landing page load test ────────────────────────────
  console.log('--- Step 2: Landing Page Full Load Test ---');
  console.log();

  const consoleErrors = [];
  const failedRequests = [];
  const networkResponses = [];

  // Collect console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Track network requests
  page.on('response', response => {
    const url = response.url();
    const status = response.status();
    if (url.includes('/api/files/') || url.includes('/_next/image')) {
      networkResponses.push({ url, status });
      if (status >= 400) {
        failedRequests.push({ url, status });
      }
    }
  });

  page.on('requestfailed', request => {
    const url = request.url();
    failedRequests.push({ url, status: 'NETWORK_ERROR', failure: request.failure()?.errorText });
  });

  // Navigate to landing page
  console.log(`  Navigating to ${BASE} ...`);
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('  Page loaded successfully.');
  } catch (err) {
    console.log(`  Page load error: ${err.message}`);
  }
  console.log();

  // Take screenshot
  const screenshotPath = '/Users/hong/Desktop/HR-SYSTEM/hr/landing-page-screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  Full-page screenshot saved: ${screenshotPath}`);
  console.log();

  // ── Step 3: Check all <img> tags ──────────────────────────────────
  console.log('--- Step 3: Image Element Analysis ---');
  console.log();

  // Scroll down to trigger lazy loading
  await page.evaluate(async () => {
    const delay = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < document.body.scrollHeight; i += 500) {
      window.scrollTo(0, i);
      await delay(200);
    }
    window.scrollTo(0, 0);
  });
  // Wait a bit for lazy images to load
  await page.waitForTimeout(3000);

  const imgAnalysis = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.map(img => ({
      src: img.src,
      alt: img.alt || '(no alt)',
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
      displayed: img.offsetWidth > 0 && img.offsetHeight > 0,
      broken: img.complete && img.naturalWidth === 0,
    }));
  });

  const brokenImages = imgAnalysis.filter(img => img.broken);
  const loadedImages = imgAnalysis.filter(img => !img.broken && img.complete);

  console.log(`  Total <img> elements: ${imgAnalysis.length}`);
  console.log(`  Loaded OK: ${loadedImages.length}`);
  console.log(`  Broken (naturalWidth===0): ${brokenImages.length}`);
  console.log();

  if (imgAnalysis.length > 0) {
    console.log('  All images:');
    for (const img of imgAnalysis) {
      const status = img.broken ? 'BROKEN' : (img.complete ? 'OK' : 'LOADING');
      const dims = `${img.naturalWidth}x${img.naturalHeight}`;
      // Shorten URL for display
      const shortSrc = img.src.replace(BASE, '');
      console.log(`    [${status}] ${dims}  ${shortSrc}  alt="${img.alt}"`);
    }
    console.log();
  }

  if (brokenImages.length > 0) {
    console.log('  BROKEN IMAGES DETAIL:');
    for (const img of brokenImages) {
      console.log(`    src: ${img.src}`);
      console.log(`    alt: ${img.alt}`);
      console.log();
    }
  }

  // ── Step 4: Console errors ──────────────────────────────────────
  console.log('--- Step 4: Console Errors ---');
  console.log();
  if (consoleErrors.length === 0) {
    console.log('  No console errors detected.');
  } else {
    console.log(`  ${consoleErrors.length} console error(s):`);
    for (const err of consoleErrors) {
      console.log(`    ${err}`);
    }
  }
  console.log();

  // ── Step 5: Failed network requests ────────────────────────────
  console.log('--- Step 5: Failed Network Requests ---');
  console.log();
  if (failedRequests.length === 0) {
    console.log('  No failed network requests for image/file URLs.');
  } else {
    console.log(`  ${failedRequests.length} failed request(s):`);
    for (const req of failedRequests) {
      const shortUrl = req.url.replace(BASE, '');
      console.log(`    [${req.status}] ${shortUrl}${req.failure ? ' — ' + req.failure : ''}`);
    }
  }
  console.log();

  // ── Step 6: All image-related network responses ────────────────
  console.log('--- Step 6: Image-Related Network Responses ---');
  console.log();
  if (networkResponses.length === 0) {
    console.log('  No image-related network responses captured.');
  } else {
    for (const resp of networkResponses) {
      const shortUrl = resp.url.replace(BASE, '');
      const icon = resp.status < 400 ? 'OK' : 'FAIL';
      console.log(`    [${icon}] ${resp.status}  ${shortUrl}`);
    }
  }
  console.log();

  // ── Summary ────────────────────────────────────────────────────
  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`  API direct test:      ${apiOk}/${apiResults.length} OK`);
  console.log(`  Page images:          ${loadedImages.length}/${imgAnalysis.length} loaded`);
  console.log(`  Broken images:        ${brokenImages.length}`);
  console.log(`  Console errors:       ${consoleErrors.length}`);
  console.log(`  Failed net requests:  ${failedRequests.length}`);
  console.log();

  const allGood = apiFail === 0 && brokenImages.length === 0 && failedRequests.length === 0;
  if (allGood) {
    console.log('  RESULT: All images loading correctly from R2!');
  } else {
    console.log('  RESULT: Issues detected — see details above.');
  }
  console.log();

  await browser.close();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
