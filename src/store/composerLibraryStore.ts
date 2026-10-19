import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SongProject } from './songStore';
import { useMusicShareStore } from './musicShareStore';
import {
  deleteComposerProjectOnServer,
  fetchComposerLibraryBootstrap,
  saveComposerProjectOnServer,
  shareComposerProjectOnServer,
  toggleFavoriteTrackOnServer,
  type ComposerLibrarySnapshot,
} from '../utils/libraryApi';

export type ComposerProjectRecord = {
  id: string;
  title: string;
  description: string;
  genre: string;
  bpm: number;
  steps: number;
  createdAt: number;
  updatedAt: number;
  creatorName: string;
  creatorEmail: string;
  project: SongProject;
  exportFormat: 'wav' | 'mp3' | 'flac';
  isShared: boolean;
  shareVisibility: 'public' | 'private';
  shareMidiEnabled: boolean;
  coverImageUrl?: string;
  coverImageStorageKey?: string;
  coverImageFileName?: string;
};

type SaveProjectPayload = {
  id?: string;
  title: string;
  description: string;
  genre: string;
  bpm: number;
  steps: number;
  project: SongProject;
  creatorName: string;
  creatorEmail: string;
  exportFormat: 'wav' | 'mp3' | 'flac';
};

type ShareProjectPayload = Omit<SaveProjectPayload, 'exportFormat'> & {
  shareVisibility: 'public' | 'private';
  shareMidiEnabled: boolean;
  coverImageUrl?: string;
  coverImageStorageKey?: string;
  coverImageFileName?: string;
};

type ComposerLibraryState = {
  projects: ComposerProjectRecord[];
  favoriteTrackIdsByUser: Record<string, string[]>;
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  bootstrapError: string | null;
  seedLibrary: (force?: boolean) => Promise<void>;
  applyServerSnapshot: (snapshot: ComposerLibrarySnapshot) => void;
  saveProject: (payload: SaveProjectPayload) => Promise<string>;
  shareProject: (payload: ShareProjectPayload) => Promise<string>;
  toggleFavoriteTrack: (trackId: string, userEmail: string) => Promise<void>;
  deleteProject: (projectId: string, userEmail: string) => Promise<void>;
};

let libraryBootstrapPromise: Promise<void> | null = null;

function applySnapshot(snapshot: ComposerLibrarySnapshot) {
  useComposerLibraryStore.setState((state) => ({
    ...state,
    projects: (snapshot.projects ?? []) as ComposerProjectRecord[],
    favoriteTrackIdsByUser: snapshot.favoriteTrackIdsByUser ?? {},
    bootstrapStatus: 'ready',
    bootstrapError: null,
  }));
}

export const useComposerLibraryStore = create<ComposerLibraryState>()(
  persist(
    (set, get) => ({
      projects: [],
      favoriteTrackIdsByUser: {},
      bootstrapStatus: 'idle',
      bootstrapError: null,
      seedLibrary: async (force = false) => {
        if (!force && get().bootstrapStatus === 'ready') {
          return;
        }

        if (!force && libraryBootstrapPromise) {
          return libraryBootstrapPromise;
        }

        set((state) => ({
          ...state,
          bootstrapStatus: 'loading',
          bootstrapError: null,
        }));

        const nextPromise = fetchComposerLibraryBootstrap()
          .then((snapshot) => {
            applySnapshot(snapshot);
          })
          .catch((error) => {
            set((state) => ({
              ...state,
              bootstrapStatus: 'error',
              bootstrapError:
                error instanceof Error
                  ? error.message
                  : '작곡 저장 목록을 서버에서 불러오지 못했습니다.',
            }));
            throw error;
          })
          .finally(() => {
            libraryBootstrapPromise = null;
          });

        libraryBootstrapPromise = nextPromise;
        return nextPromise;
      },
      applyServerSnapshot: (snapshot) => {
        applySnapshot(snapshot);
      },
      saveProject: async (payload) => {
        const response = await saveComposerProjectOnServer(payload as unknown as Record<string, unknown>);
        applySnapshot(response.snapshot);
        return response.projectId;
      },
      shareProject: async (payload) => {
        const response = await shareComposerProjectOnServer(payload as unknown as Record<string, unknown>);
        applySnapshot(response.snapshot);
        if (response.snapshot.share) {
          useMusicShareStore.getState().applyServerSnapshot(response.snapshot.share);
        }
        return response.projectId;
      },
      toggleFavoriteTrack: async (trackId, userEmail) => {
        const response = await toggleFavoriteTrackOnServer({ trackId, userEmail });
        applySnapshot(response.snapshot);
      },
      deleteProject: async (projectId, userEmail) => {
        const response = await deleteComposerProjectOnServer({ projectId, userEmail });
        applySnapshot(response.snapshot.composer);
      },
    }),
    {
      name: 'song-maker-composer-library',
      partialize: (state) => ({
        projects: state.projects,
        favoriteTrackIdsByUser: state.favoriteTrackIdsByUser,
      }),
    }
  )
);
