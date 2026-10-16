import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5174';
const apiUrl = process.env.TEST_API_URL ?? 'http://127.0.0.1:8788';
const executablePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const outputDir = fileURLToPath(new URL('../test-results/workflows/', import.meta.url));

await mkdir(outputDir, { recursive: true });

async function api(path, init = {}) {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

function trackRuntimeErrors(page, errors) {
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('ERR_NETWORK_ACCESS_DENIED')) {
      errors.push(`console: ${message.text()}`);
    }
  });
}

async function applyMeter(page, timelineRatio, beats, beatType) {
  const timeline = page.locator('.composer-arrangement-lanes');
  const bounds = await timeline.boundingBox();
  assert.ok(bounds, 'The arrangement timeline must be visible.');
  await timeline.click({ position: { x: bounds.width * timelineRatio, y: 20 } });
  await page.locator('.transport-meter-button').click();
  const panel = page.locator('.transport-meter-popover');
  await panel.locator('input[type="number"]').fill(String(beats));
  await panel.locator('select').selectOption(String(beatType));
  await panel.locator('.transport-meter-actions .is-primary').click();
}

async function waitForDownloads(downloads, count, timeout = 120_000) {
  const deadline = Date.now() + timeout;
  while (downloads.length < count && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(downloads.length >= count, `Expected ${count} downloads, received ${downloads.length}.`);
}

function authState(user) {
  return JSON.stringify({
    state: {
      user,
      sessionToken: null,
      profilesByEmail: {
        [user.email]: { name: user.name, composerTutorialCompleted: true },
      },
    },
    version: 1,
  });
}

const browser = await chromium.launch({ executablePath, headless: true });
const runtimeErrors = [];
let temporaryCollabProjectId = null;
let temporaryLibraryProjectId = null;

try {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const dialogMessages = [];
  const downloads = [];
  trackRuntimeErrors(page, runtimeErrors);
  page.on('dialog', async (dialog) => {
    dialogMessages.push(dialog.message());
    await dialog.accept();
  });
  page.on('download', (download) => {
    downloads.push((async () => {
      const target = join(outputDir, download.suggestedFilename());
      await download.saveAs(target);
      return target;
    })());
  });

  await page.goto(`${baseUrl}/composer`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.removeItem('song-maker-composer-draft');
    localStorage.removeItem('song-maker-composer-tabs');
    localStorage.removeItem('song-maker-personal-composer-backup');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.composer-arrangement-lanes').waitFor();

  const initialProject = {
    version: 2,
    compositionMode: 'standard',
    timeSignature: { beats: 4, beatType: 4 },
    timeSignatureChanges: [{ bar: 0, beats: 4, beatType: 4 }],
    bpm: 240,
    steps: 256,
    noteLyrics: { '24-0': '\uC2DC\uC791' },
    barLyrics: [],
    lyricsStartBar: 1,
    tracks: {
      melody: [
        { note: 'C4', start: 0, duration: 4 },
        { note: 'D4', start: 48, duration: 4 },
        { note: 'E4', start: 84, duration: 2 },
      ],
      violin: [],
      saxophone: [],
      guitar: [],
      drums: [{ note: 'Kick', start: 0, duration: 1 }],
      bass: [],
    },
    extraTracks: [],
  };
  await page.locator('input[type="file"][accept="application/json"]').setInputFiles({
    name: 'workflow-fixture.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(initialProject)),
  });
  await page.waitForURL(/source=file/);

  const workflowTitle = '\uD1B5\uD569 \uD68C\uADC0 \uD14C\uC2A4\uD2B8 \uACE1';
  await page.locator('.transport-song-title').fill(workflowTitle);
  await applyMeter(page, 0.205, 3, 4);
  await applyMeter(page, 0.355, 6, 8);

  await page.locator('.transport-meter-button').click();
  const meterText = await page.locator('.transport-meter-list').innerText();
  assert.match(meterText, /4\/4/);
  assert.match(meterText, /3\/4/);
  assert.match(meterText, /6\/8/);
  await page.locator('.transport-meter-button').click();

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.locator('.composer-arrangement-lanes').waitFor();
  await page.locator('.transport-meter-button').click();
  const persistedMeterText = await page.locator('.transport-meter-list').innerText();
  assert.match(persistedMeterText, /3\/4/);
  assert.match(persistedMeterText, /6\/8/);
  await page.locator('.transport-meter-button').click();

  await page.locator('.transport-button--score').click();
  await page.locator('.score-viewer-canvas svg').first().waitFor({ timeout: 30_000 });
  await page.screenshot({
    path: join(outputDir, 'score-viewer.png'),
    fullPage: false,
  });

  const beforeMusicXml = downloads.length;
  await page.locator('.score-viewer-actions button').filter({ hasText: 'MusicXML' }).click();
  await waitForDownloads(downloads, beforeMusicXml + 1);
  const musicXmlPath = await downloads[beforeMusicXml];
  const musicXml = await readFile(musicXmlPath, 'utf8');
  assert.equal(basename(musicXmlPath), `${workflowTitle}.musicxml`);
  assert.ok(musicXml.includes(`<work-title>${workflowTitle}</work-title>`));
  assert.match(musicXml, /<beats>3<\/beats><beat-type>4<\/beat-type>/);
  assert.match(musicXml, /<beats>6<\/beats><beat-type>8<\/beat-type>/);
  assert.match(musicXml, /<part-name[^>]*>\uD53C\uC544\uB178<\/part-name>/);

  const beforePdf = downloads.length;
  await page.locator('.score-viewer-actions .is-primary').click();
  await waitForDownloads(downloads, beforePdf + 1);
  const pdfPath = await downloads[beforePdf];
  const pdfHeader = (await readFile(pdfPath)).subarray(0, 5).toString('ascii');
  assert.equal(basename(pdfPath), `${workflowTitle}.pdf`);
  assert.equal(pdfHeader, '%PDF-');
  await page.locator('.score-viewer-icon-button').click();

  const beforeSave = downloads.length;
  await page.locator('.transport-actions .transport-button').filter({ hasText: '\uC800\uC7A5\uD558\uAE30' }).click();
  const saveDialog = page.locator('.transport-dialog--save');
  await saveDialog.locator('input[type="text"]').fill(workflowTitle);
  await saveDialog.locator('textarea').fill('\uC800\uC7A5\uACFC \uBD88\uB7EC\uC624\uAE30 \uC790\uB3D9 \uAC80\uC99D');
  await saveDialog.locator('select').selectOption('ballad');
  const backupSwitch = saveDialog.locator('.transport-dialog-switch');
  if (!(await backupSwitch.evaluate((element) => element.classList.contains('is-on')))) {
    await saveDialog.locator('.transport-dialog-toggle-row').click();
  }
  await saveDialog.locator('.transport-dialog-button--confirm').click();
  await saveDialog.waitFor({ state: 'hidden', timeout: 120_000 });
  await waitForDownloads(downloads, beforeSave + 2);
  const savedDownloadPaths = await Promise.all(downloads.slice(beforeSave));
  const jsonPath = savedDownloadPaths.find((path) => path.endsWith('.json'));
  assert.ok(jsonPath, 'Saving with backup enabled must download a JSON project file.');
  const savedProject = JSON.parse(await readFile(jsonPath, 'utf8'));
  assert.equal(savedProject.version, 2);
  assert.equal(savedProject.timeSignatureChanges.length, 3);
  assert.deepEqual(
    savedProject.timeSignatureChanges.map(({ bar, beats, beatType }) => ({ bar, beats, beatType })),
    [
      { bar: 0, beats: 4, beatType: 4 },
      { bar: 3, beats: 3, beatType: 4 },
      { bar: 6, beats: 6, beatType: 8 },
    ]
  );
  temporaryLibraryProjectId = new URL(page.url()).searchParams.get('project');

  await applyMeter(page, 0.01, 2, 4);
  await page.locator('input[type="file"][accept="application/json"]').setInputFiles(jsonPath);
  await page.waitForURL(/source=file/);
  await page.locator('.transport-meter-button').click();
  const loadedMeterText = await page.locator('.transport-meter-list').innerText();
  assert.match(loadedMeterText, /4\/4/);
  assert.match(loadedMeterText, /3\/4/);
  assert.match(loadedMeterText, /6\/8/);
  assert.doesNotMatch(loadedMeterText, /2\/4/);
  await page.locator('.transport-meter-button').click();

  const sourceProjectId = `workflow-${Date.now()}`;
  const owner = { email: 'workflow-owner@songmaker.local', name: '\uD68C\uADC0 \uC18C\uC720\uC790' };
  const editor = { email: 'workflow-editor@songmaker.local', name: '\uD68C\uADC0 \uD3B8\uC9D1\uC790' };
  const createResponse = await api('/api/collab/projects/from-composer', {
    method: 'POST',
    body: JSON.stringify({
      sourceProjectId,
      title: '\uD611\uC5C5 \uD68C\uADC0 \uD14C\uC2A4\uD2B8',
      summary: '\uC790\uB3D9 \uD14C\uC2A4\uD2B8 \uD6C4 \uC0AD\uC81C\uB429\uB2C8\uB2E4.',
      genre: 'ballad',
      bpm: savedProject.bpm,
      steps: savedProject.steps,
      ownerEmail: owner.email,
      ownerName: owner.name,
      color: '#14b8a6',
      sessionId: 'workflow-create',
      snapshot: savedProject,
    }),
  });
  assert.equal(createResponse.status, 200);
  temporaryCollabProjectId = (await createResponse.json()).projectId;

  const joinResponse = await api(`/api/collab/projects/${temporaryCollabProjectId}/join`, {
    method: 'POST',
    body: JSON.stringify(editor),
  });
  assert.equal(joinResponse.status, 200);

  async function createCollabPage(user) {
    const collabContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await collabContext.addInitScript(({ serialized }) => {
      localStorage.setItem('song-maker-auth', serialized);
    }, { serialized: authState(user) });
    const collabPage = await collabContext.newPage();
    trackRuntimeErrors(collabPage, runtimeErrors);
    await collabPage.goto(`${baseUrl}/composer?collab=${temporaryCollabProjectId}`, {
      waitUntil: 'domcontentloaded',
    });
    await collabPage.locator('.composer-collab-edge-button').waitFor({ timeout: 30_000 });
    return { context: collabContext, page: collabPage };
  }

  const ownerBrowser = await createCollabPage(owner);
  const editorBrowser = await createCollabPage(editor);

  for (const collabPage of [ownerBrowser.page, editorBrowser.page]) {
    await collabPage.locator('.composer-tab-card.is-melody:not(.is-duplicate) .composer-tab-button')
      .evaluate((button) => button.click());
    await collabPage.locator('.composer-collab-edge-button').click();
    await collabPage.locator('.composer-collab-drawer-tabs button').nth(1).click();
  }

  const chatMessage = `\uC2E4\uC2DC\uAC04 \uCC44\uD305 ${Date.now()}`;
  await ownerBrowser.page.locator('.composer-collab-chat-form textarea').fill(chatMessage);
  await ownerBrowser.page.locator('.composer-collab-chat-form button').click();
  await editorBrowser.page.getByText(chatMessage, { exact: true }).waitFor({ timeout: 15_000 });

  const authorshipBootstrap = await (await api('/api/collab/bootstrap')).json();
  const authorshipProject = authorshipBootstrap.projects.find(
    (project) => project.id === temporaryCollabProjectId
  );
  const authorshipSessionId = 'workflow-authorship';
  const authorshipLock = await api(
    `/api/collab/projects/${temporaryCollabProjectId}/composer-lock`,
    {
      method: 'POST',
      body: JSON.stringify({
        instrument: 'melody', barIndex: 0, sessionId: authorshipSessionId,
        email: owner.email, name: owner.name, color: '#14b8a6', lock: true,
      }),
    }
  );
  assert.equal(authorshipLock.status, 200);
  const authorshipOperation = await api(
    `/api/collab/projects/${temporaryCollabProjectId}/composer-operation`,
    {
      method: 'POST',
      body: JSON.stringify({
        operation: {
          type: 'set-melody-note', row: 0, col: 2, note: 'C8', length: 4, barIndex: 0,
        },
        email: owner.email,
        name: owner.name,
        color: '#14b8a6',
        sessionId: authorshipSessionId,
        baseRevision: authorshipProject.snapshotRevision,
      }),
    }
  );
  assert.equal(authorshipOperation.status, 200);
  await api(`/api/collab/projects/${temporaryCollabProjectId}/composer-lock`, {
    method: 'POST',
    body: JSON.stringify({
      instrument: 'melody', barIndex: 0, sessionId: authorshipSessionId, lock: false,
    }),
  });
  await editorBrowser.page.waitForTimeout(2_000);
  const authorshipState = await (await api('/api/collab/bootstrap')).json();
  const authorshipStateProject = authorshipState.projects.find(
    (project) => project.id === temporaryCollabProjectId
  );
  assert.equal(authorshipStateProject.noteAuthors['melody:0:2'], owner.email);
  assert.equal(authorshipStateProject.noteColors['melody:0:2'], '#14b8a6');
  await editorBrowser.page.reload({ waitUntil: 'domcontentloaded' });
  await editorBrowser.page.locator('.composer-collab-edge-button').waitFor({ timeout: 30_000 });
  await editorBrowser.page.locator('.composer-roll-shell--melody').waitFor();
  const authoredNote = editorBrowser.page.locator(`.piano-roll-cell.is-collab-authored[title*="${owner.name}"]`).first();
  await authoredNote.waitFor({ timeout: 15_000 });
  assert.match(await authoredNote.getAttribute('title'), new RegExp(owner.name));

  const lockA = await api(`/api/collab/projects/${temporaryCollabProjectId}/composer-lock`, {
    method: 'POST',
    body: JSON.stringify({
      instrument: 'melody', barIndex: 0, sessionId: 'workflow-lock-a',
      email: owner.email, name: owner.name, color: '#14b8a6', lock: true,
    }),
  });
  assert.equal(lockA.status, 200);
  const lockB = await api(`/api/collab/projects/${temporaryCollabProjectId}/composer-lock`, {
    method: 'POST',
    body: JSON.stringify({
      instrument: 'melody', barIndex: 0, sessionId: 'workflow-lock-b',
      email: editor.email, name: editor.name, color: '#6366f1', lock: true,
    }),
  });
  assert.equal(lockB.status, 409, 'A second editor must not acquire the same bar lock.');
  await api(`/api/collab/projects/${temporaryCollabProjectId}/composer-lock`, {
    method: 'POST',
    body: JSON.stringify({ instrument: 'melody', barIndex: 0, sessionId: 'workflow-lock-a', lock: false }),
  });

  const bootstrap = await (await api('/api/collab/bootstrap')).json();
  const collabProject = bootstrap.projects.find((project) => project.id === temporaryCollabProjectId);
  assert.equal(collabProject.snapshot.version, 2);
  assert.ok(Array.isArray(collabProject.snapshot.tracks.melody));
  const baseRevision = collabProject.snapshotRevision;
  const firstOperation = await api(`/api/collab/projects/${temporaryCollabProjectId}/composer-operation`, {
    method: 'POST',
    body: JSON.stringify({
      operation: { type: 'set-volume', instrument: 'melody', volume: 71 },
      email: owner.email, name: owner.name, sessionId: 'workflow-revision-a', baseRevision,
    }),
  });
  assert.equal(firstOperation.status, 200);
  const staleOperation = await api(`/api/collab/projects/${temporaryCollabProjectId}/composer-operation`, {
    method: 'POST',
    body: JSON.stringify({
      operation: { type: 'set-volume', instrument: 'melody', volume: 52 },
      email: editor.email, name: editor.name, sessionId: 'workflow-revision-b', baseRevision,
    }),
  });
  assert.equal(staleOperation.status, 409, 'A stale concurrent edit must be rejected.');

  await ownerBrowser.context.close();
  await editorBrowser.context.close();
  await context.close();

  assert.deepEqual(runtimeErrors, [], `Browser runtime errors:\n${runtimeErrors.join('\n')}`);
  console.log('Workflow smoke test passed: meter, save/load, MusicXML, PDF, chat, authorship, and conflicts.');
} finally {
  if (temporaryCollabProjectId) {
    await api(`/api/collab/projects/${temporaryCollabProjectId}/delete`, {
      method: 'POST',
      body: JSON.stringify({ userEmail: 'workflow-owner@songmaker.local' }),
    }).catch(() => undefined);
  }
  if (temporaryLibraryProjectId) {
    await api(`/api/composer-library/projects/${temporaryLibraryProjectId}/delete`, {
      method: 'POST',
      body: JSON.stringify({ userEmail: 'guest@songmaker.local' }),
    }).catch(() => undefined);
  }
  await browser.close();
}
