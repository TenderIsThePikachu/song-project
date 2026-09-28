import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { clearStoredSessionToken, storeSessionToken } from '../utils/authSession';

export type AuthUser = {
  name: string;
  email: string;
  avatarUrl?: string;
};

type StoredProfile = {
  name: string;
  avatarUrl?: string;
  composerTutorialCompleted?: boolean;
};

type AuthState = {
  user: AuthUser | null;
  sessionToken: string | null;
  profilesByEmail: Record<string, StoredProfile>;
  login: (payload: {
    email: string;
    name?: string;
    avatarUrl?: string;
    sessionToken?: string | null;
  }) => void;
  signup: (payload: {
    email: string;
    nickname: string;
    avatarUrl?: string;
    sessionToken?: string | null;
  }) => void;
  updateProfile: (payload: { email: string; name: string; avatarUrl?: string; }) => void;
  clearAvatar: (email: string) => void;
  markComposerTutorialCompleted: (email: string) => void;
  logout: () => void;
};

function getDisplayName(email: string, fallback?: string) {
  const trimmedFallback = fallback?.trim();

  if (trimmedFallback) {
    return trimmedFallback;
  }

  const [localPart] = email.split('@');
  return localPart?.trim() || 'user';
}

function isFirebaseIdToken(token: string | null) {
  return token?.split('.').length === 3;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      sessionToken: null,
      profilesByEmail: {},
      login: ({ email, name, avatarUrl, sessionToken }) =>
        set((state) => {
          const existingProfile = state.profilesByEmail[email];
          const nextName = getDisplayName(email, name ?? existingProfile?.name);
          const nextAvatarUrl = avatarUrl ?? existingProfile?.avatarUrl;

          if (sessionToken) {
            storeSessionToken(sessionToken);
          }

          return {
            user: {
              email,
              name: nextName,
              avatarUrl: nextAvatarUrl,
            },
            sessionToken: sessionToken ?? state.sessionToken,
            profilesByEmail: {
              ...state.profilesByEmail,
              [email]: {
                name: nextName,
                avatarUrl: nextAvatarUrl,
                composerTutorialCompleted: existingProfile?.composerTutorialCompleted ?? false,
              },
            },
          };
        }),
      signup: ({ email, nickname, avatarUrl, sessionToken }) =>
        set((state) => {
          const existingProfile = state.profilesByEmail[email];
          const nextName = getDisplayName(email, nickname);
          const nextAvatarUrl = avatarUrl ?? existingProfile?.avatarUrl;

          if (sessionToken) {
            storeSessionToken(sessionToken);
          }

          return {
            user: {
              email,
              name: nextName,
              avatarUrl: nextAvatarUrl,
            },
            sessionToken: sessionToken ?? state.sessionToken,
            profilesByEmail: {
              ...state.profilesByEmail,
              [email]: {
                name: nextName,
                avatarUrl: nextAvatarUrl,
                composerTutorialCompleted: existingProfile?.composerTutorialCompleted ?? false,
              },
            },
          };
        }),
      updateProfile: ({ email, name, avatarUrl }) =>
        set((state) => {
          const currentProfile = state.profilesByEmail[email];
          const nextName = getDisplayName(email, name || currentProfile?.name);

          const nextAvatar =
            avatarUrl ??
            currentProfile?.avatarUrl ??
            state.user?.avatarUrl;
            
          return {
            user:
              state.user?.email === email
                ? {
                    ...state.user,
                    name: nextName,
                    avatarUrl: nextAvatar,
                  }
                : state.user,
            profilesByEmail: {
              ...state.profilesByEmail,
              [email]: {
                name: nextName,
                avatarUrl: nextAvatar,
                
                composerTutorialCompleted: currentProfile?.composerTutorialCompleted ?? false,
              },
            },
          };
        }),
      clearAvatar: (email) =>
        set((state) => {
          const currentProfile = state.profilesByEmail[email];
          const nextName = currentProfile?.name ?? state.user?.name ?? getDisplayName(email);

          return {
            user:
              state.user?.email === email
                ? {
                    ...state.user,
                    avatarUrl: undefined,
                  }
                : state.user,
            profilesByEmail: {
              ...state.profilesByEmail,
              [email]: {
                name: nextName,
                avatarUrl: undefined,
                composerTutorialCompleted: currentProfile?.composerTutorialCompleted ?? false,
              },
            },
          };
        }),
      markComposerTutorialCompleted: (email) =>
        set((state) => {
          const currentProfile = state.profilesByEmail[email];
          const nextName = currentProfile?.name ?? state.user?.name ?? getDisplayName(email);

          return {
            user: state.user,
            profilesByEmail: {
              ...state.profilesByEmail,
              [email]: {
                name: nextName,
                avatarUrl: currentProfile?.avatarUrl,
                composerTutorialCompleted: true,
              },
            },
          };
        }),
      logout: () => {
        clearStoredSessionToken();
        set({ user: null, sessionToken: null });
      },
    }),
    {
      name: 'song-maker-auth',
      version: 1,
      migrate: (persistedState, version) => {
        const state = persistedState as AuthState;

        if (version < 1 && isFirebaseIdToken(state.sessionToken)) {
          clearStoredSessionToken();
          return { ...state, user: null, sessionToken: null };
        }

        return state;
      },
    }
  )
);
