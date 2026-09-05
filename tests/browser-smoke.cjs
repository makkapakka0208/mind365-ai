const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXE ? { executablePath: process.env.BROWSER_EXE } : {}) });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => dialog.accept());
    const base = process.env.TEST_BASE_URL || 'http://localhost:3001';
    await page.goto(`${base}/daily-log/?date=2026-09-04`);
    const input = page.locator('textarea').first();
    await input.waitFor({ timeout: 60000 });
    await input.fill('Browser regression: recover this unfinished diary.');
    await page.getByRole('status').filter({ hasText: '草稿已保存' }).waitFor();
    await page.reload();
    await input.waitFor();
    await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('Browser regression'));
    await page.goto(`${base}/daily-log/?date=2026-09-03`);
    await input.waitFor();
    await input.fill('A separate date draft.');
    await page.goto(`${base}/daily-log/?date=2026-09-04`);
    await page.waitForFunction(() => document.querySelector('textarea')?.value.includes('Browser regression'));
    await page.getByRole('button', { name: '保存日记', exact: true }).click();
    await page.waitForFunction(() => {
      const data = JSON.parse(localStorage.getItem('mind365:data:guest') || '{}');
      return JSON.parse(data.daily_logs || '[]').length === 1 && !JSON.parse(data.journal_drafts || '{}')['2026-09-04'];
    });
    await input.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: '.next/reliability-desktop.png', fullPage: true });
    await page.goto(`${base}/settings/`);
    await page.getByRole('button', { name: '导出备份', exact: true }).waitFor();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '导出备份', exact: true }).click();
    const download = await downloadPromise;
    const backup = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
    assert.equal(backup.version, 3);
    assert.equal(backup.daily_logs.length, 1);
    assert.ok(backup.extras.journal_drafts['2026-09-03']);
    assert.ok(Array.isArray(backup.todos));
    await page.locator('input[type=file]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.getByText(/导入完成：恢复/).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: '导出备份', exact: true }).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: '.next/reliability-mobile-settings.png', fullPage: true });
    await page.goto(`${base}/daily-log/?date=2026-09-03`);
    await page.waitForFunction(() => document.querySelector('textarea')?.value === 'A separate date draft.');
    await input.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.screenshot({ path: '.next/reliability-mobile-draft.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('PASS: draft reload/date isolation/save cleanup; complete backup export/import; desktop/mobile rendering; no page errors.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
