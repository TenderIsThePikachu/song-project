//import { BASS_NOTES, MELODY_NOTES, GUITAR_TRACK_LABELS, DRUM_TRACK_LABELS } from '../constants/composer.ts';
import demoSong from '../dummy/song-project.json';

//const GITHUB_TOKEN = import.meta.env.VITE_API_KEY;
//const GITHUB_ENDPOINT = 'https://models.inference.ai.azure.com/chat/completions';

//const TOTAL_STEPS = 640;
//const DRUM_TYPES = ['Kick', 'Snare', 'HiHat', 'Clap', 'Percussion'];

/**
 * 공통 모델 호출 함수
 */
/*
async function callModel(messages: any[], temperature = 0.8) {
  const response = await fetch(GITHUB_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(err);
    throw new Error('AI request failed');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
*/
/**
 * 1단계 — 실제 작곡 (JSON 절대 금지)
 */
/*
async function composeMusicText(prompt: string): Promise<string> {
  return await callModel(
    [
      {
        role: 'system',
        content: `
You are an expert MIDI programmer and step sequencer engineer.

Your job is NOT to simplify the music.
Your job is to faithfully translate the musical description into a rich, dense 128-step sequence.

CRITICAL RULES:

- Fill the sequence like a real produced loop.
- Do NOT leave empty space unless the music description clearly implies silence.
- Use MANY notes.
- Use varied durations (2,4,8,16,32).
- Create rhythmic patterns, not sparse hits.
- Drums must have continuous groove (especially hi-hats).
- Bass must create rhythm, not single hits.
- Melody must form phrases across bars.
- Guitar must create rhythmic harmony patterns, not long static notes.

Technical limits:
- 128 steps (0~127), 16 steps per bar.
- Melody notes: ${MELODY_NOTES.join(', ')}
- Guitar notes: ${GUITAR_TRACK_LABELS.join(', ')}
- Bass notes: ${BASS_NOTES.join(', ')}
- Drums: ${DRUM_TRACK_LABELS.join(', ')}

IMPORTANT DRUM RULE:
- Use field name "note" for drums, NOT "type".
- Each drum hit must have duration 1.

Output ONLY valid JSON in THIS exact format:

{
  "bpm": number,
  "tracks": {
    "melody": [{ "note": "", "start": 0, "duration": 0 }],
    "guitar": [{ "note": "", "start": 0, "duration": 0 }],
    "drums": [{ "note": "", "start": 0, "duration": 1 }],
    "bass": [{ "note": "", "start": 0, "duration": 0 }]
  }
}
`,
      },
      { role: 'user', content: prompt },
    ],
    0.9
  );
}

/**
 * 2단계 — 시퀀서 JSON 변환
 */
/*
async function convertToSequencer(musicDescription: string) {
  const jsonText = await callModel(
    [
      {
        role: 'system',
        content: `
You are an expert MIDI programmer and step sequencer engineer.

Your job is NOT to simplify the music.
Your job is to faithfully translate the musical description into a rich, dense 128-step sequence.

CRITICAL RULES:

- Fill the sequence like a real produced loop.
- Do NOT leave empty space unless the music description clearly implies silence.
- Use MANY notes.
- Use varied durations (2,4,8,16,32).
- Create rhythmic patterns, not sparse hits.
- Drums must have continuous groove (especially hi-hats).
- Bass must create rhythm, not single hits.
- Melody must form phrases across bars.

Technical limits:
- 128 steps (0~127), 16 steps per bar.
- Melody notes: ${MELODY_NOTES.join(', ')}
- Bass notes: ${BASS_NOTES.join(', ')}
- Drums: ${DRUM_TYPES.join(', ')}

Output ONLY valid JSON:

{
  "bpm": number,
  "tracks": {
    "melody": [{ "note": "", "start": 0, "duration": 0 }],
    "drums": [{ "type": "", "start": 0 }],
    "bass": [{ "note": "", "start": 0, "duration": 0 }]
  }
}
`,
      },
      { role: 'user', content: musicDescription },
    ],
    0.2
  );

  
  try {
    const clean = extractJson(jsonText);
    return JSON.parse(clean);
  } catch (e) {
    console.error('Invalid JSON from AI:', jsonText);
    throw new Error('AI generated invalid JSON');
  }
}

function extractJson(text: string) {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (match) return match[1];

  const fallback = text.match(/\{[\s\S]*\}/);
  if (fallback) return fallback[0];

  throw new Error('No JSON found in AI response');
}
*/
/**
 * 최종 외부 호출 함수 (기존 함수 교체)
 */

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchAiMusic(prompt: string) {
  console.log('Prompt:', prompt);

  await delay(10000);

  return structuredClone(demoSong);
}
/*
  if (!GITHUB_TOKEN?.trim()) {
    throw new Error('GitHub Models token is not configured.');
  }

  // 1️⃣ 진짜 작곡
  const musicText = await composeMusicText(prompt);

  // 2️⃣ JSON 변환
  const parsedData = await convertToSequencer(musicText);

  // 프론트엔드 포맷 유지
  return {
    version: 2,
    steps: TOTAL_STEPS,
    bpm: parsedData.bpm || 100,
    volumes: { melody: 82, drums: 78, bass: 84 },
    tracks: parsedData.tracks || { melody: [], drums: [], bass: [] },
  };
  */


