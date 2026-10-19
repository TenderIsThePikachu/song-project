import assert from 'node:assert/strict';

const apiUrl = process.env.TEST_API_URL ?? 'http://127.0.0.1:8788';
let shortId = '';

async function readJson(response) {
  const payload = await response.json();
  assert.equal(response.ok, true, payload?.error ?? `HTTP ${response.status}`);
  return payload;
}

try {
  const uploadResponse = await fetch(
    `${apiUrl}/api/shorts/upload?fileName=shorts-smoke.mp4&creatorEmail=smoke%40songmaker.local`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'video/mp4' },
      body: Buffer.from('songmaker-shorts-smoke'),
    }
  );
  const upload = await readJson(uploadResponse);
  assert.ok(upload.videoUrl, '업로드 응답에 videoUrl이 있어야 합니다.');
  assert.ok(upload.videoStorageKey, '업로드 응답에 videoStorageKey가 있어야 합니다.');

  const createResponse = await fetch(`${apiUrl}/api/shorts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: '숏폼 업로드 회귀 테스트',
      description: '자동 테스트 후 삭제됩니다.',
      creatorName: 'Smoke Test',
      creatorEmail: 'smoke@songmaker.local',
      videoUrl: upload.videoUrl,
      videoStorageKey: upload.videoStorageKey,
      videoFileName: 'shorts-smoke.mp4',
      videoSizeBytes: 22,
      musicProjectId: 'smoke-project',
      musicProjectTitle: '연결 음악',
      musicShareTrackId: 'smoke-share-track',
    }),
  });
  const created = await readJson(createResponse);
  shortId = created.shortId;

  const bootstrap = await readJson(await fetch(`${apiUrl}/api/shorts/bootstrap`));
  const savedShort = bootstrap.shorts.find((short) => short.id === shortId);
  assert.ok(savedShort, '등록한 숏폼이 목록에 있어야 합니다.');
  assert.equal(savedShort.videoUrl, upload.videoUrl);
  assert.equal(savedShort.musicProjectId, 'smoke-project');
  assert.equal(savedShort.musicShareTrackId, 'smoke-share-track');

  console.log('Shorts upload smoke test passed: upload, create, link, and bootstrap.');
} finally {
  if (shortId) {
    await fetch(`${apiUrl}/api/shorts/${encodeURIComponent(shortId)}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail: 'smoke@songmaker.local' }),
    });
  }
}
