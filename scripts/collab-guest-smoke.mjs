import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5173';
const executablePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launch({ executablePath, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  await page.goto(`${baseUrl}/collab`, { waitUntil: 'networkidle' });
  assert.equal(new URL(page.url()).pathname, '/collab', 'Logged-out local users must stay on the collaboration page.');

  const recentRoomButton = page.getByRole('button', { name: /최근 작업실 열기/ });
  assert.equal(await recentRoomButton.isEnabled(), true, 'The recent collaboration room button must be enabled.');

  const createButton = page.getByRole('button', { name: /새 협업 만들기/ });
  await createButton.click();
  const createDialog = page.getByRole('dialog', { name: '새 협업 만들기' });
  await createDialog.waitFor({ state: 'visible' });
  await createDialog.getByRole('button', { name: '닫기' }).click();
  await createDialog.waitFor({ state: 'hidden' });

  const firstOpenButton = page.locator('.collab-card-open').first();
  await firstOpenButton.waitFor({ state: 'visible' });
  assert.equal(await firstOpenButton.isEnabled(), true, 'The collaboration room button must be enabled.');
  await firstOpenButton.click();
  await page.waitForURL(/\/collab\/[^/]+$/);
  assert.notEqual(new URL(page.url()).pathname, '/login', 'Opening a local collaboration project must not redirect to login.');
  await page.locator('.collab-room-layout').waitFor();

  const composerButton = page.locator('.collab-composer-button');
  assert.equal(await composerButton.isEnabled(), true, 'The local collaboration composer button must be enabled.');
  await composerButton.click();
  await page.waitForURL(/\/composer\?collab=/);
  await page.locator('.composer-page').waitFor();

  console.log('Local collaboration guest smoke test passed.');
} finally {
  await context.close();
  await browser.close();
}
