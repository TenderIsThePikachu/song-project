import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5173';
const executablePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outputDir = new URL('../test-results/', import.meta.url);

const expectedCovers = [
  'cover-citypop-night.webp',
  'night-loop.webp',
  'emotional-bridge.webp',
  'midnight-hook.webp',
  'deep-house-line.webp',
];

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 1900, height: 900 } });

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  const chart = page.locator('.main-hot-chart');
  await chart.scrollIntoViewIfNeeded();
  await page.locator('.main-hot-cover').first().waitFor();

  const covers = await page.locator('.main-hot-cover').evaluateAll((elements) =>
    elements.slice(0, 5).map((element) => getComputedStyle(element).backgroundImage),
  );

  expectedCovers.forEach((cover, index) => {
    assert.match(covers[index] ?? '', new RegExp(cover.replace('.', '\\.')));
  });

  await page.waitForFunction(() =>
    [...document.querySelectorAll('.main-hot-cover')].slice(0, 5).every((cover) => {
      const match = getComputedStyle(cover).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
      if (!match) return false;
      const image = new Image();
      image.src = match[1];
      return image.complete && image.naturalWidth > 0;
    }),
  );

  await chart.screenshot({
    path: fileURLToPath(new URL('hot-chart-images.png', outputDir)),
  });
  console.log('HOT chart image smoke test passed.');
} finally {
  await browser.close();
}
