import { useEffect, useState, type ReactNode } from 'react';
import { useAuthStore } from '../../store/authStore';
import {
  connectFirebaseUserToServer,
  restoreSessionFromServer,
  type AuthSessionResponse,
} from '../../utils/authApi';
import { getStoredSessionToken } from '../../utils/authSession';
import { isLocalDevelopmentHost } from '../../utils/localEnvironment';

const LOCAL_DEVELOPMENT_ACCOUNT = {
  email: 'jaehyeong@songmaker.local',
  password: 'songmaker-local-dev',
  name: '김재형',
} as const;

let localSessionPromise: Promise<AuthSessionResponse> | null = null;

function getLocalSession() {
  if (!localSessionPromise) {
    localSessionPromise = (async () => {
      if (getStoredSessionToken()) {
        try {
          const restoredSession = await restoreSessionFromServer();

          if (restoredSession.user.email === LOCAL_DEVELOPMENT_ACCOUNT.email) {
            return restoredSession;
          }
        } catch {
          // The local server may have restarted and invalidated its previous session.
        }
      }

      return connectFirebaseUserToServer({
        ...LOCAL_DEVELOPMENT_ACCOUNT,
        mode: 'login',
      });
    })();
  }

  return localSessionPromise;
}

type LocalAuthBootstrapProps = {
  children: ReactNode;
};

export default function LocalAuthBootstrap({ children }: LocalAuthBootstrapProps) {
  const login = useAuthStore((state) => state.login);
  const [isReady, setIsReady] = useState(() => !isLocalDevelopmentHost());

  useEffect(() => {
    if (!isLocalDevelopmentHost()) {
      setIsReady(true);
      return;
    }

    let cancelled = false;

    void getLocalSession()
      .then((response) => {
        if (cancelled) return;

        login({
          email: response.user.email,
          name: response.user.name,
          avatarUrl: response.user.avatarUrl,
          sessionToken: response.sessionToken || null,
        });
      })
      .catch((error) => {
        console.error('로컬 자동 로그인에 실패했습니다.', error);
      })
      .finally(() => {
        if (!cancelled) setIsReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [login]);

  if (!isReady) {
    return <div style={{ minHeight: '100vh', background: '#15161a' }} />;
  }

  return children;
}
