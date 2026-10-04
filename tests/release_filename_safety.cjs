// Run after building: node tests/release_filename_safety.cjs
// Requires the existing Playwright test runtime; set PLAYWRIGHT_BROWSER_CHANNEL
// to msedge when using the installed Windows browser instead of bundled Chromium.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const name = `BK "quoted" & <notes> [Regular] 'single'.ttf`;

async function checkFilename(page) {
  const row = page.locator('#batchFontList .batch-font-row');
  assert.equal(await row.count(), 1);
  const checkbox = row.locator('[data-batch-select-id]');
  assert.equal(await checkbox.getAttribute('aria-label'), name,
    'The complete source filename must remain literal in the accessible label');
  assert.equal(await row.locator('.batch-file strong').textContent(), name);
  assert.equal(await row.locator('.batch-file strong').getAttribute('title'), name);
  assert.equal(await page.locator('.font-filename').textContent(), name);
  assert.equal(await row.locator('.batch-check').evaluate(el => el.children.length), 1,
    'Filename punctuation must not add elements to the checkbox label');
  assert.deepEqual(await checkbox.evaluate(el => el.getAttributeNames().sort()),
    ['aria-label', 'checked', 'data-batch-select-id', 'type']);
}

async function main() {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_BROWSER_CHANNEL ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL } : {}) });
  try {
    for (const variant of ['index.html', 'index.self-extract.html']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ja-JP' });
      const page = await context.newPage();
      const errors = [], requests = [], consoleErrors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      await context.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
      try {
        await page.goto(pathToFileURL(path.join(root, 'dist', variant)).href);
        await page.waitForFunction(() => document.querySelector('#versionBadge')?.textContent === 'v1.0.0');
        assert.equal(await page.locator('#createFontButton').isDisabled(), true);
        await page.setInputFiles('#fontFileInput', { name, mimeType: 'font/ttf',
          buffer: await fs.readFile(path.join(root, 'test-data/fonts/BKTest-Regular.ttf')) });
        await page.waitForFunction(() => document.querySelector('#summaryReady')?.textContent.trim() === '1 / 1');
        await checkFilename(page);
        await page.locator('#languageButton').click();
        assert.equal(await page.locator('html').getAttribute('lang'), 'en');
        await checkFilename(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('[data-mobile-key="output"]').click();
        await checkFilename(page);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        // A normal state refresh must retain the same safe label and checkbox behavior.
        await page.locator('[data-batch-select-id]').uncheck();
        assert.equal(await page.locator('[data-batch-select-id]').isChecked(), false);
        await page.locator('[data-batch-select-id]').check();
        await checkFilename(page);
        assert.deepEqual(errors, [], 'No browser page errors');
        assert.deepEqual(consoleErrors, [], 'No browser console errors');
        assert.deepEqual(requests, [], 'No runtime HTTP/HTTPS requests');
        console.log(`PASS ${variant}: literal filename, selection, JA/EN, desktop/mobile, local file, no network/errors`);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
