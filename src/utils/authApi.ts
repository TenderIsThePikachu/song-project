import { clearStoredSessionToken, getStoredSessionToken } from './authSession';
import { APP_SERVER_URL } from './serverApi';

export type AuthApiUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: number;
};

export type AuthSessionResponse = {
  user: AuthApiUser;
  sessionToken: string;
};

const AUTH_SERVER_URL = APP_SERVER_URL;

async function fetchAuthJson<T>(path: string, init?: RequestInit) {
  let response: Response;

  try {
    const sessionToken = getStoredSessionToken();
    response = await fetch(`${AUTH_SERVER_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      '인증 서버에 연결하지 못했습니다. `npm.cmd run dev`가 실행 중인지 확인해주세요.'
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || '인증 요청에 실패했습니다.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  const responseText = await response.text();
  if (!contentType.includes('application/json') || responseText.trimStart().startsWith('<')) {
    throw new Error('인증 서버 주소가 올바르지 않습니다. 백엔드 서버 연결을 확인해 주세요.');
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error('인증 서버 응답 형식이 올바르지 않습니다.');
  }
}

export function signupWithServer(payload: { email: string; password: string; name: string }) {
  return fetchAuthJson<AuthSessionResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginWithServer(payload: { email: string; password: string }) {
  return fetchAuthJson<AuthSessionResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function connectFirebaseUserToServer(payload: {
  email: string;
  password: string;
  name: string;
  mode: 'login' | 'signup';
}): Promise<AuthSessionResponse> {
  const login = () => loginWithServer({ email: payload.email, password: payload.password });
  const signup = () =>
    signupWithServer({
      email: payload.email,
      password: payload.password,
      name: payload.name,
    });

  try {
    return await (payload.mode === 'signup' ? signup() : login());
  } catch (primaryError) {
    try {
      return await (payload.mode === 'signup' ? login() : signup());
    } catch (secondaryError) {
      clearStoredSessionToken();
      console.warn('App server session unavailable; continuing with Firebase auth.', {
        primaryError,
        secondaryError,
      });
      return {
        user: {
          id: `firebase:${payload.email.toLowerCase()}`,
          email: payload.email,
          name: payload.name,
          createdAt: Date.now(),
        },
        sessionToken: '',
      };
    }
  }
}

export function requestPasswordReset(payload: { email: string }) {
  return fetchAuthJson<{ ok: true; message: string }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function restoreSessionFromServer() {
  return fetchAuthJson<AuthSessionResponse>('/api/auth/session');
}

export function logoutOnServer() {
  return fetchAuthJson<{ ok: true }>('/api/auth/logout', {
    method: 'POST',
  });
}
