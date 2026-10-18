import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:5174';
const executablePath =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage();

try {
  await page.goto(`${baseUrl}/composer`, { waitUntil: 'domcontentloaded' });

  const result = await page.evaluate(async () => {
    const [{ useSongStore }, { saveAiVocalAudio, deleteAiVocalAudio }, { exportSongAsMp3 }] =
      await Promise.all([
        import('/src/store/songStore.ts'),
        import('/src/utils/aiVocalAudioStorage.ts'),
        import('/src/audio/engine.ts'),
      ]);

    const createToneWav = (durationSeconds, frequency, sampleRate = 44100) => {
      const frameCount = Math.floor(durationSeconds * sampleRate);
      const buffer = new ArrayBuffer(44 + frameCount * 2);
      const view = new DataView(buffer);
      const writeAscii = (offset, value) => {
        for (let index = 0; index < value.length; index += 1) {
          view.setUint8(offset + index, value.charCodeAt(index));
        }
      };

      writeAscii(0, 'RIFF');
      view.setUint32(4, 36 + frameCount * 2, true);
      writeAscii(8, 'WAVE');
      writeAscii(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeAscii(36, 'data');
      view.setUint32(40, frameCount * 2, true);

      for (let frame = 0; frame < frameCount; frame += 1) {
        const fade = Math.min(1, frame / 200, (frameCount - frame) / 200);
        const sample = Math.sin((2 * Math.PI * frequency * frame) / sampleRate) * 0.5 * fade;
        view.setInt16(44 + frame * 2, sample * 0x7fff, true);
      }

      return new Blob([buffer], { type: 'audio/wav' });
    };

    useSongStore.getState().clear();
    useSongStore.setState({ steps: 16, bpm: 120 });
    const trackId = useSongStore.getState().addAiVocalTrack('female');

    try {
      await saveAiVocalAudio(trackId, createToneWav(1, 440));
      const mp3 = await exportSongAsMp3();
      const context = new AudioContext();
      const decoded = await context.decodeAudioData(await mp3.arrayBuffer());
      const samples = decoded.getChannelData(0);
      let energy = 0;

      for (let index = 0; index < samples.length; index += 1) {
        energy += samples[index] * samples[index];
      }

      await context.close();
      return {
        size: mp3.size,
        duration: decoded.duration,
        rms: Math.sqrt(energy / Math.max(1, samples.length)),
      };
    } finally {
      await deleteAiVocalAudio(trackId);
    }
  });

  assert.ok(result.size > 1000, `The exported MP3 should contain audio data, got ${result.size} bytes.`);
  assert.ok(result.duration >= 1, `The exported MP3 should include the vocal duration, got ${result.duration}s.`);
  assert.ok(result.rms > 0.02, `The exported MP3 should contain audible vocal energy, got RMS ${result.rms}.`);

  console.log(
    `MP3 vocal smoke test passed: ${result.size} bytes, ${result.duration.toFixed(2)}s, RMS ${result.rms.toFixed(4)}.`
  );
} finally {
  await browser.close();
}
