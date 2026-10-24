import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import type { ExtraInstrumentTrack } from '../store/songStore';
import { isLocalDevelopmentHost } from './localEnvironment';
import { uploadServerFile } from './serverApi';

const DB_NAME = 'song-maker-audio';
const DB_VERSION = 1;
const STORE_NAME = 'ai-vocal-clips';

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('이 브라우저에서는 보컬 오디오 저장을 지원하지 않습니다.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('보컬 오디오 저장소를 열지 못했습니다.'));
  });
}

async function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openDatabase();

  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('보컬 오디오 저장에 실패했습니다.'));
    });
  } finally {
    database.close();
  }
}

export function saveAiVocalAudio(trackId: string, blob: Blob) {
  return runTransaction('readwrite', (store) => store.put(blob, trackId));
}

export function loadAiVocalAudio(trackId: string) {
  return runTransaction<Blob | undefined>('readonly', (store) => store.get(trackId));
}

export function deleteAiVocalAudio(trackId: string) {
  return runTransaction('readwrite', (store) => store.delete(trackId));
}

export type AiVocalAudioSource = {
  audioUrl: string;
  audioStorageKey: string;
  audioFileName: string;
};

export async function uploadAiVocalAudio(
  trackId: string,
  blob: Blob,
  creatorEmail?: string
): Promise<AiVocalAudioSource> {
  const fileName = `ai-vocal-${trackId}.wav`;
  const file = new File([blob], fileName, { type: blob.type || 'audio/wav' });

  if (isLocalDevelopmentHost()) {
    const params = new URLSearchParams({ fileName });
    if (creatorEmail?.trim()) params.set('creatorEmail', creatorEmail.trim());
    return uploadServerFile<AiVocalAudioSource>(
      `/api/composer/vocal-upload?${params.toString()}`,
      file,
      'AI 보컬 음원을 로컬 서버에 저장하지 못했습니다.'
    );
  }

  const audioStorageKey = `composer_vocals/${Date.now()}_${fileName}`;
  const audioRef = ref(storage, audioStorageKey);
  await uploadBytes(audioRef, file, { contentType: file.type });

  return {
    audioUrl: await getDownloadURL(audioRef),
    audioStorageKey,
    audioFileName: fileName,
  };
}

export async function loadAiVocalAudioSource(
  track: Pick<ExtraInstrumentTrack, 'id' | 'audioUrl'>
) {
  const cachedBlob = await loadAiVocalAudio(track.id);
  if (cachedBlob) return cachedBlob;
  if (!track.audioUrl) return undefined;

  const response = await fetch(track.audioUrl);
  if (!response.ok) {
    throw new Error(`AI 보컬 음원을 불러오지 못했습니다. (${response.status})`);
  }

  const blob = await response.blob();
  await saveAiVocalAudio(track.id, blob);
  return blob;
}
