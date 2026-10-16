import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5174';
const executablePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outputDir = new URL('../test-results/', import.meta.url);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const runtimeErrors = [];

page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
    runtimeErrors.push(`console: ${message.text()}`);
  }
});

const selectTimelinePosition = async (ratio) => {
  const timeline = page.locator('.composer-arrangement-lanes');
  const box = await timeline.boundingBox();
  assert.ok(box, 'The arrangement timeline must be visible.');
  await timeline.click({ position: { x: box.width * ratio, y: 20 } });
};

const applyMeter = async (beats, beatType) => {
  await page.locator('.transport-meter-button').click();
  const dialog = page.getByRole('dialog', { name: '변박 설정' });
  await dialog.locator('input[type="number"]').fill(String(beats));
  await dialog.locator('select').selectOption(String(beatType));
  await dialog.getByRole('button', { name: '적용' }).click();
};

try {
  await page.goto(`${baseUrl}/composer`, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('song-maker-composer-draft'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.composer-arrangement-lanes').waitFor();

  await selectTimelinePosition(0.205);
  await applyMeter(3, 4);
  await selectTimelinePosition(0.355);
  await applyMeter(6, 8);

  const meterRows = page.locator('.transport-meter-list > div');
  await page.locator('.transport-meter-button').click();
  assert.deepEqual(
    await meterRows.allTextContents(),
    ['1마디4/4', '9마디3/4×', '17마디6/8×'],
    'The meter-change list should contain the two changes at their selected bars.'
  );

  const positions = await page.locator('.composer-arrangement-ruler > button').evaluateAll(
    (buttons) => Object.fromEntries(
      buttons.map((button) => [button.textContent?.trim(), Number.parseFloat(button.style.left)])
    )
  );
  assert.ok(Math.abs(positions['9'] - 20) < 0.1, `Bar 9 should start at 20%, got ${positions['9']}%.`);
  assert.ok(Math.abs(positions['17'] - 35) < 0.1, `Bar 17 should start at 35%, got ${positions['17']}%.`);
  assert.equal(
    await page.locator('.composer-arrangement-grid .is-meter-change').count(),
    2,
    'The arrangement should show both meter-change boundaries.'
  );

  await page.screenshot({ path: fileURLToPath(new URL('browser-variable-meter.png', outputDir)) });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('.transport-meter-button').click();
  assert.deepEqual(
    await page.locator('.transport-meter-list > div').allTextContents(),
    ['1마디4/4', '9마디3/4×', '17마디6/8×'],
    'Meter changes should persist after a reload.'
  );

  assert.deepEqual(runtimeErrors, [], `Browser runtime errors:\n${runtimeErrors.join('\n')}`);
  console.log('Browser smoke test passed: variable meter interaction, alignment, and persistence.');
} finally {
  await browser.close();
}
