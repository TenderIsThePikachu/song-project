import { useAuthStore } from '../store/authStore';
import { getStoredSessionToken } from './authSession';
import { storeSessionToken } from './authSession';

const DEFAULT_SERVER_URL =
  typeof window !== 'undefined'
    ? import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:8788`
      : `${window.location.protocol}//${window.location.hostname}`
    : 'http://localhost:8788';

const CONFIGURED_SERVER_URL =
  (import.meta.env.VITE_APP_SERVER_URL as string | undefined) ??
  (import.meta.env.VITE_AUTH_SERVER_URL as string | undefined) ??
  (import.meta.env.VITE_COLLAB_SERVER_URL as string | undefined);

function resolveServerUrl() {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:8788`;
  }

  if (!CONFIGURED_SERVER_URL?.trim()) {
    return DEFAULT_SERVER_URL;
  }

  return CONFIGURED_SERVER_URL.replace(/\/+$/, '');
}

export const APP_SERVER_URL = resolveServerUrl();

async function readServerJson<T>(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  const responseText = await response.text();

  if (!contentType.includes('application/json') || responseText.trimStart().startsWith('<')) {
    throw new Error(
      `API 서버 주소가 올바르지 않습니다. 현재 서버 주소(${APP_SERVER_URL})와 실행 포트 8788을 확인해 주세요.`
    );
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error('API 서버 응답 형식이 올바르지 않습니다. 서버를 다시 실행해 주세요.');
  }
}

export async function fetchServerJson<T>(
  path: string,
  init?: RequestInit,
  connectionErrorMessage = '서버에 연결하지 못했습니다. `npm.cmd run dev`가 실행 중인지 확인해주세요.'
) {
  let response: Response;

  try {
    const persistedSessionToken = useAuthStore.getState().sessionToken;
    const sessionToken = getStoredSessionToken() ?? persistedSessionToken;

    if (sessionToken && !getStoredSessionToken()) {
      storeSessionToken(sessionToken);
    }

    response = await fetch(`${APP_SERVER_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(connectionErrorMessage);
  }

  if (!response.ok) {
    const payload = await readServerJson<{ error?: string }>(response).catch(() => null);
    throw new Error(payload?.error || '서버 요청에 실패했습니다.');
  }

  return readServerJson<T>(response);
}

export async function uploadServerFile<T>(
  path: string,
  file: File,
  connectionErrorMessage = '파일 업로드 서버에 연결하지 못했습니다.'
) {
  let response: Response;

  try {
    const persistedSessionToken = useAuthStore.getState().sessionToken;
    const sessionToken = getStoredSessionToken() ?? persistedSessionToken;
    response = await fetch(`${APP_SERVER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: file,
    });
  } catch {
    throw new Error(connectionErrorMessage);
  }

  if (!response.ok) {
    const payload = await readServerJson<{ error?: string }>(response).catch(() => null);
    throw new Error(payload?.error || '파일 업로드에 실패했습니다.');
  }

  return readServerJson<T>(response);
}
