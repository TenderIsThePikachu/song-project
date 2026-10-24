import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShortComment, ShortItem, ShortTone, ShortVisibility } from '../types/shorts';
import {
  addShortCommentOnServer,
  createShortOnServer,
  deleteShortOnServer,
  fetchShortsBootstrap,
  recordShortViewOnServer,
  toggleShortLikeOnServer,
  updateShortOnServer,
  type ShortsSnapshot,
} from '../utils/shortsApi';

type CreateShortPayload = Omit<
  ShortItem,
  'id' | 'createdAt' | 'likeCount' | 'viewCount' | 'likedBy'
>;

type UpdateShortPayload = Partial<CreateShortPayload> & {
  shortId: string;
  creatorEmail?: string;
};

type AddCommentPayload = {
  shortId: string;
  authorName: string;
  authorEmail: string;
  content: string;
};

type ShortsState = {
  shorts: ShortItem[];
  comments: ShortComment[];
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  bootstrapError: string | null;
  seedShorts: (force?: boolean) => Promise<void>;
  applyServerSnapshot: (snapshot: ShortsSnapshot) => void;
  createShort: (payload: CreateShortPayload) => Promise<string>;
  updateShort: (payload: UpdateShortPayload) => Promise<void>;
  deleteShort: (shortId: string, userEmail: string) => Promise<void>;
  toggleLike: (shortId: string, userEmail: string) => Promise<void>;
  addComment: (payload: AddCommentPayload) => Promise<string>;
  recordView: (shortId: string) => Promise<void>;
};

let shortsBootstrapPromise: Promise<void> | null = null;

const SHORT_TONES = new Set<ShortTone>(['lime', 'cyan', 'violet', 'amber']);
const SHORT_VISIBILITIES = new Set<ShortVisibility>(['public', 'private']);

function normalizeShort(short: Partial<ShortItem> & { id?: string }, index: number): ShortItem {
  const tags = Array.isArray(short.tags) ? short.tags.filter(Boolean) : [];
  const likedBy = Array.isArray(short.likedBy) ? short.likedBy.filter(Boolean) : [];
  const tone = SHORT_TONES.has(short.tone as ShortTone) ? (short.tone as ShortTone) : 'lime';
  const visibility = SHORT_VISIBILITIES.has(short.visibility as ShortVisibility)
    ? (short.visibility as ShortVisibility)
    : 'public';

  return {
    id: short.id ?? `short-${index}`,
    title: short.title ?? 'Untitled Short',
    description: short.description ?? '',
    creatorName: short.creatorName ?? 'composer',
    creatorEmail: short.creatorEmail ?? '',
    genre: short.genre?.trim() || '기타',
    tags,
    createdAt: Number.isFinite(short.createdAt) ? Number(short.createdAt) : Date.now(),
    durationLabel: short.durationLabel ?? '0:15',
    likeCount: Number.isFinite(short.likeCount) ? Number(short.likeCount) : likedBy.length,
    viewCount: Number.isFinite(short.viewCount) ? Number(short.viewCount) : 0,
    visibility,
    tone,
    likedBy,
    videoUrl: short.videoUrl,
    videoStorageKey: short.videoStorageKey,
    videoFileName: short.videoFileName,
    videoSizeBytes: short.videoSizeBytes,
    audioUrl: short.audioUrl,
    audioStorageKey: short.audioStorageKey,
    audioFileName: short.audioFileName,
    audioSizeBytes: short.audioSizeBytes,
    musicProjectId: short.musicProjectId,
    musicProjectTitle: short.musicProjectTitle,
    musicShareTrackId: short.musicShareTrackId,
  };
}

function normalizeComment(comment: Partial<ShortComment> & { id?: string }, index: number): ShortComment {
  return {
    id: comment.id ?? `short-comment-${index}`,
    shortId: comment.shortId ?? '',
    authorName: comment.authorName ?? 'composer',
    authorEmail: comment.authorEmail ?? '',
    content: comment.content ?? '',
    createdAt: Number.isFinite(comment.createdAt) ? Number(comment.createdAt) : Date.now(),
  };
}

function applySnapshot(snapshot: ShortsSnapshot) {
  useShortsStore.setState((state) => ({
    ...state,
    shorts: (snapshot.shorts ?? []).map((short, index) =>
      normalizeShort(short as Partial<ShortItem>, index)
    ),
    comments: (snapshot.comments ?? [])
      .map((comment, index) => normalizeComment(comment as Partial<ShortComment>, index))
      .filter((comment) => comment.shortId),
    bootstrapStatus: 'ready',
    bootstrapError: null,
  }));
}

export const useShortsStore = create<ShortsState>()(
  persist(
    (set, get) => ({
      shorts: [],
      comments: [],
      bootstrapStatus: 'idle',
      bootstrapError: null,
      seedShorts: async (force = false) => {
        if (!force && get().bootstrapStatus === 'ready') {
          return;
        }

        if (!force && shortsBootstrapPromise) {
          return shortsBootstrapPromise;
        }

        set((state) => ({
          ...state,
          bootstrapStatus: 'loading',
          bootstrapError: null,
        }));

        const nextPromise = fetchShortsBootstrap()
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
                  : '숏폼 데이터를 서버에서 불러오지 못했습니다.',
            }));
            throw error;
          })
          .finally(() => {
            shortsBootstrapPromise = null;
          });

        shortsBootstrapPromise = nextPromise;
        return nextPromise;
      },
      applyServerSnapshot: (snapshot) => {
        applySnapshot(snapshot);
      },
      createShort: async (payload) => {
        const response = await createShortOnServer(payload as unknown as Record<string, unknown>);
        applySnapshot(response.snapshot);
        return response.shortId;
      },
      updateShort: async ({ shortId, ...payload }) => {
        const response = await updateShortOnServer({
          shortId,
          ...payload,
        } as Record<string, unknown> & { shortId: string });
        applySnapshot(response.snapshot);
      },
      deleteShort: async (shortId, userEmail) => {
        const response = await deleteShortOnServer({ shortId, userEmail });
        applySnapshot(response.snapshot);
      },
      toggleLike: async (shortId, userEmail) => {
        const response = await toggleShortLikeOnServer({ shortId, userEmail });
        applySnapshot(response.snapshot);
      },
      addComment: async ({ shortId, authorName, authorEmail, content }) => {
        const response = await addShortCommentOnServer({
          shortId,
          authorName,
          authorEmail,
          content,
        });
        applySnapshot(response.snapshot);
        return '';
      },
      recordView: async (shortId) => {
        const response = await recordShortViewOnServer({ shortId });
        applySnapshot(response.snapshot);
      },
    }),
    {
      name: 'song-maker-shorts',
      partialize: (state) => ({
        shorts: state.shorts,
        comments: state.comments,
      }),
    }
  )
);
