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

try {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('.main-cover-card').first().waitFor();
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.main-cover-art-wrap img')]
      .every((image) => image.complete && image.naturalWidth > 0)
  );

  const movingCard = await page.locator('.main-cover-card[data-offset="1"]').elementHandle();
  const nextButton = await page.locator('.main-cover-arrow.is-right').elementHandle();
  assert.ok(movingCard && nextButton, 'The next cover and navigation button must be visible.');

  const samples = await page.evaluate(async ({ card, button }) => {
    const frames = [];
    button.click();
    const startedAt = performance.now();

    await new Promise((resolve) => {
      const sample = () => {
        const bounds = card.getBoundingClientRect();
        frames.push({
          elapsed: performance.now() - startedAt,
          center: bounds.left + bounds.width / 2,
          layoutWidth: card.offsetWidth,
          layoutHeight: card.offsetHeight,
        });
        if (performance.now() - startedAt < 850) requestAnimationFrame(sample);
        else resolve();
      };
      requestAnimationFrame(sample);
    });

    return frames;
  }, { card: movingCard, button: nextButton });

  assert.deepEqual([...new Set(samples.map((sample) => sample.layoutWidth))], [340]);
  assert.deepEqual([...new Set(samples.map((sample) => sample.layoutHeight))], [470]);
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(
      samples[index].center <= samples[index - 1].center + 0.75,
      `The cover reversed direction at ${Math.round(samples[index].elapsed)}ms.`
    );
  }

  await page.locator('.main-cover-arrow.is-right').click();
  await page.waitForTimeout(120);
  await page.locator('.main-cover-arrow.is-right').click();
  await page.waitForTimeout(120);
  await page.locator('.main-cover-arrow.is-right').click();
  await page.waitForTimeout(900);

  assert.equal(await page.locator('.main-cover-card.is-center').count(), 1);
  assert.equal(await page.locator('.main-cover-card.is-center').evaluate((card) => card.offsetWidth), 340);
  assert.ok(
    await page.locator('.main-cover-pagination button').count() <= 7,
    'The recommendation pagination must stay compact when server tracks increase.'
  );

  const verticalGap = await page.evaluate(() => {
    const centerCard = document.querySelector('.main-cover-card.is-center')?.getBoundingClientRect();
    const trending = document.querySelector('.main-trending')?.getBoundingClientRect();
    if (!centerCard || !trending) return Number.NaN;
    return trending.top - centerCard.bottom;
  });
  assert.ok(
    verticalGap >= 30 && verticalGap <= 100,
    `The trending strip must stay directly below the cover flow, got ${verticalGap}px.`
  );
  assert.deepEqual(runtimeErrors, [], `Browser runtime errors:\n${runtimeErrors.join('\n')}`);

  await page.screenshot({
    path: fileURLToPath(new URL('coverflow-stable.png', outputDir)),
    fullPage: false,
  });
  console.log('Cover-flow smoke test passed: stable layout, monotonic motion, and rapid navigation.');
} finally {
  await browser.close();
}
