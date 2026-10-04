// Run after building: node tests/release_font_export.cjs
// Uses Playwright Chromium, or PLAYWRIGHT_BROWSER_CHANNEL (e.g. msedge).
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ headless: true,
    ...(process.env.PLAYWRIGHT_BROWSER_CHANNEL ? { channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL } : {}) });
  const report = [];
  try {
    for (const variant of ['index.html', 'index.self-extract.html']) {
      const context = await browser.newContext({ acceptDownloads: true });
      const page = await context.newPage();
      const errors = [], requests = [], consoleErrors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      await context.route(/^https?:/, route => { requests.push(route.request().url()); return route.abort(); });
      try {
        await page.goto(pathToFileURL(path.join(root, 'dist', variant)).href);
        await page.waitForFunction(() => document.querySelector('#versionBadge')?.textContent === 'v1.0.0');
        await page.setInputFiles('#fontFileInput', ['Regular', 'Bold'].map(style =>
          path.join(root, `test-data/fonts/BKTest-${style}.ttf`)));
        await page.waitForFunction(() => document.querySelector('#summaryReady')?.textContent.trim() === '2 / 2');
        await page.locator('#subsetText').fill('Browser Kitty 123 ABC xyz');
        const rows = page.locator('#batchFontList .batch-font-row');
        await rows.nth(0).locator('[data-output-field="filename"]').fill('export-regular');
        await rows.nth(0).locator('[data-output-field="filename"]').blur();
        await page.locator('#createFontButton').click();
        // Boot alone cannot catch a loader CSP that blocks the worker's WASM.
        await page.waitForFunction(() => document.querySelectorAll('#batchResultList .batch-result-row').length === 2,
          null, { timeout: 60000 });
        assert.equal(await page.locator('#batchResultList .failed').count(), 0,
          `${variant}: ${await page.locator('#batchResultList').textContent()}`);
        assert.equal(await page.evaluate(() => [...document.fonts].filter(font =>
          font.family.startsWith('BKSubsetResult') && font.status === 'loaded').length), 2);
        const css = await page.locator('#packageCss').inputValue();
        assert(css.includes('./fonts/export-regular.woff2'));
        assert(css.includes('font-weight: 400') && css.includes('font-weight: 700'));
        assert(css.includes('unicode-range:') && css.includes('font-display: swap'));
        const downloadPromise = page.waitForEvent('download');
        await page.locator('[data-download-result-id]').first().click();
        const download = await downloadPromise;
        assert.equal(download.suggestedFilename(), 'export-regular.woff2');
        const bytes = await fs.readFile(await download.path());
        assert.equal(bytes.toString('ascii', 0, 4), 'wOF2');
        assert.equal(bytes.readUInt32BE(8), bytes.length, 'Exported WOFF2 length matches its header');
        assert.equal(await page.evaluate(async data => {
          const font = new FontFace('ExportedRegressionFont', new Uint8Array(data));
          await font.load();
          return font.status;
        }, [...bytes]), 'loaded', 'Downloaded bytes must be a browser-loadable font');
        const zipPromise = page.waitForEvent('download');
        await page.locator('#downloadPackageButton').click();
        const zip = await zipPromise;
        assert.equal(zip.suggestedFilename(), 'font-subset.zip');
        const reportDir = path.join(root, 'tests/reports');
        await fs.mkdir(reportDir, { recursive: true });
        await zip.saveAs(path.join(reportDir, `${variant}-font-subset.zip`));
        assert.deepEqual(errors, [], 'No browser page errors');
        assert.deepEqual(consoleErrors, [], 'No browser console errors');
        assert.deepEqual(requests, [], 'No runtime HTTP/HTTPS requests');
        report.push({ variant, generatedFonts: 2, exportedWoff2Bytes: bytes.length,
          exportedFontLoaded: true, zipExport: true, errors, consoleErrors, requests });
        console.log(`PASS ${variant}: two real WASM subsets, edited WOFF2 export/reload, CSS/ZIP, no network/errors`);
      } finally { await context.close(); }
    }
    await fs.writeFile(path.join(root, 'tests/reports/release-font-export.json'), JSON.stringify(report, null, 2));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
