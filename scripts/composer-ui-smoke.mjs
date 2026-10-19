import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5173';
const executablePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const viewportWidth = Number(process.env.TEST_VIEWPORT_WIDTH ?? 800);
const viewportHeight = Number(process.env.TEST_VIEWPORT_HEIGHT ?? 900);

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({
  viewport: { width: viewportWidth, height: viewportHeight },
});
const page = await context.newPage();
const runtimeErrors = [];

page.on('pageerror', (error) => runtimeErrors.push(error.message));

try {
  await page.goto(`${baseUrl}/composer`, { waitUntil: 'networkidle' });
  await page.locator('.composer-page').waitFor();

  const titleInput = page.locator('.transport-song-title');
  await titleInput.fill('제목 수정 확인');
  await titleInput.press('Enter');
  assert.equal(await titleInput.inputValue(), '제목 수정 확인');

  const melodyTrack = page.locator('.composer-track-row').filter({
    has: page.locator('.composer-track-name', { hasText: /^멜로디$/ }),
  }).first();
  await melodyTrack.waitFor();

  const melodyVolume = melodyTrack.locator('input[type="range"]');
  assert.equal(await melodyVolume.count(), 1, '멜로디 트랙에 음량 조절이 있어야 합니다.');
  await melodyVolume.fill('37');
  assert.equal(await melodyVolume.inputValue(), '37');

  const composerMetrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    footerHeight: document.querySelector('.composer-footer')?.getBoundingClientRect().height ?? 0,
    footerScrollHeight: document.querySelector('.composer-footer')?.scrollHeight ?? 0,
    trackPanelWidth: Number.parseFloat(
      window.getComputedStyle(document.querySelector('.composer-page')).getPropertyValue(
        '--composer-track-panel-width'
      )
    ),
  }));
  assert.ok(
    composerMetrics.scrollWidth <= composerMetrics.innerWidth + 1,
    JSON.stringify(composerMetrics)
  );
  if (viewportWidth <= 1080) {
    assert.ok(
      composerMetrics.footerHeight > 60,
      `좁은 화면의 다단 재생 바 높이가 확보되어야 합니다: ${JSON.stringify(composerMetrics)}`
    );
  }
  if (viewportWidth > 720 && viewportWidth <= 1080) {
    assert.ok(
      composerMetrics.footerHeight <= 150,
      `분할 화면의 재생 바가 너무 높습니다: ${JSON.stringify(composerMetrics)}`
    );
    assert.ok(
      composerMetrics.footerScrollHeight <= composerMetrics.footerHeight + 1,
      `분할 화면의 재생 바 내용이 잘렸습니다: ${JSON.stringify(composerMetrics)}`
    );
    assert.ok(
      composerMetrics.trackPanelWidth <= 180,
      `분할 화면의 트랙 패널이 너무 넓습니다: ${JSON.stringify(composerMetrics)}`
    );
  }
  if (process.env.TEST_SCREENSHOT_PATH) {
    await page.screenshot({ path: process.env.TEST_SCREENSHOT_PATH, fullPage: false });
  }

  await page.goto(`${baseUrl}/composer?tab=bass`, { waitUntil: 'networkidle' });
  const bassScroller = page.locator('.composer-main--bass .piano-roll-melody-scroller');
  await bassScroller.waitFor();
  const bassScrollRange = await bassScroller.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    overflowY: window.getComputedStyle(element).overflowY,
  }));
  assert.ok(
    bassScrollRange.scrollHeight > bassScrollRange.clientHeight,
    `베이스 피아노롤에 세로 스크롤 범위가 있어야 합니다: ${JSON.stringify(bassScrollRange)}`
  );
  assert.equal(bassScrollRange.overflowY, 'scroll');
  await bassScroller.hover();
  await page.mouse.wheel(0, 420);
  await page.waitForTimeout(100);
  assert.ok(await bassScroller.evaluate((element) => element.scrollTop > 0));

  const emptyBassCell = page
    .locator('.composer-main--bass .piano-roll-cell:not(.is-active):not(.is-note-tail)')
    .first();
  await emptyBassCell.click();
  await page.waitForTimeout(300);

  await page.goto(`${baseUrl}/collab`, { waitUntil: 'networkidle' });
  await page.locator('.collab-card-open').first().click();
  await page.waitForURL(/\/collab\/[^/]+$/);
  await page.locator('.collab-room-layout').waitFor();

  const collabMetrics = await page.evaluate(() => {
    const shell = document.querySelector('.collab-room-shell')?.getBoundingClientRect();
    const main = document.querySelector('.collab-room-main')?.getBoundingClientRect();
    const side = document.querySelector('.collab-room-side')?.getBoundingClientRect();
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      shellLeft: shell?.left ?? -1,
      shellRight: shell?.right ?? Number.POSITIVE_INFINITY,
      mainLeft: main?.left ?? 0,
      sideLeft: side?.left ?? 1,
    };
  });
  assert.ok(collabMetrics.scrollWidth <= collabMetrics.innerWidth + 1);
  assert.ok(collabMetrics.shellLeft >= 0 && collabMetrics.shellRight <= collabMetrics.innerWidth);
  if (viewportWidth <= 900) {
    assert.equal(Math.round(collabMetrics.mainLeft), Math.round(collabMetrics.sideLeft));
  }
  assert.deepEqual(runtimeErrors, [], `Browser runtime errors:\n${runtimeErrors.join('\n')}`);

  console.log('Composer UI smoke test passed: title, melody volume, bass scroll, and split layout.');
} finally {
  await context.close();
  await browser.close();
}
