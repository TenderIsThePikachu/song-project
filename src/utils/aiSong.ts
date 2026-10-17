import demoSong from '../dummy/song-project.json';
import type { SongProject } from '../store/songStore.ts';

const DEMO_GENERATION_DELAY_MS = 900;

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

export async function fetchAiMusic(prompt: string): Promise<SongProject> {
  if (!prompt.trim()) {
    throw new Error('AI에게 전달할 작곡 조건을 입력해 주세요.');
  }

  await delay(DEMO_GENERATION_DELAY_MS);
  return structuredClone(demoSong) as SongProject;
}
