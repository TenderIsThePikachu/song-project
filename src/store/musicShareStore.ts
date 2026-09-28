import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addTrackCommentOnServer,
  fetchMusicShareBootstrap,
  recordTrackDownloadOnServer,
  recordTrackOpenOnServer,
  recordTrackViewOnServer,
  toggleTrackLikeOnServer,
  deleteTrackOnServer,
  type MusicShareSnapshot,
} from '../utils/libraryApi';
import type { MusicShareTrackCard } from '../dummy/musicShareLibrary';
import type { SongProject } from './songStore';

export type MusicShareComment = {
  id: string;
  trackId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: number;
};

export type MusicShareMetrics = {
  likeCount: number;
  viewCount: number;
  downloadCount: number;
};

type AddTrackCommentPayload = {
  trackId: string;
  authorName: string;
  authorEmail: string;
  content: string;
};

type MusicShareState = {
  tracks: MusicShareTrackCard[];
  likedTrackIdsByUser: Record<string, string[]>;
  recentOpenedTrackIdsByUser: Record<string, string[]>;
  trackMetricsById: Record<string, MusicShareMetrics>;
  comments: MusicShareComment[];
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  bootstrapError: string | null;
  seedMusicShare: (force?: boolean) => Promise<void>;
  applyServerSnapshot: (snapshot: MusicShareSnapshot) => void;
  toggleTrackLike: (trackId: string, userEmail: string) => Promise<void>;
  addTrackComment: (payload: AddTrackCommentPayload) => Promise<string>;
  recordTrackView: (trackId: string, userEmail?: string) => Promise<void>;
  recordTrackDownload: (trackId: string, userEmail?: string) => Promise<void>;
  recordTrackOpen: (trackId: string, userEmail: string) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
};

let musicShareBootstrapPromise: Promise<void> | null = null;
const trackLikeMutationVersions = new Map<string, number>();

function isBaseTrack(trackId: string) {
  return trackId.startsWith('share-base-');
}

function getLocalMetrics(metrics?: MusicShareMetrics): MusicShareMetrics {
  return {
    likeCount: metrics?.likeCount ?? 0,
    viewCount: metrics?.viewCount ?? 0,
    downloadCount: metrics?.downloadCount ?? 0,
  };
}

const MUSIC_SHARE_CATEGORIES = new Set([
  'classic',
  'pop',
  'ballad',
  'jazz',
  'citypop',
  'ost',
  'anime',
  'game',
  'rock',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function normalizeIdMap(value: unknown): Record<string, string[]> {
  const record = asRecord(value);
  if (!record) return {};

  return Object.fromEntries(
    Object.entries(record).map(([key, ids]) => [key, asStringArray(ids)])
  );
}

function normalizeProject(value: unknown): SongProject | undefined {
  const project = asRecord(value);
  const tracks = asRecord(project?.tracks);
  if (!project || !tracks) return undefined;
  return value as SongProject;
}

export function normalizeMusicShareTrack(
  value: unknown,
  index = 0
): MusicShareTrackCard | null {
  const track = asRecord(value);
  if (!track) return null;

  const id = asString(track.id, `server-track-${index}`);
  const rawCategory = asString(track.category, 'pop').toLowerCase();
  const category = MUSIC_SHARE_CATEGORIES.has(rawCategory) ? rawCategory : 'pop';
  const tags = asStringArray(track.tags);
  const project = normalizeProject(track.project);

  return {
    id,
    title: asString(track.title, '제목 없는 공유곡'),
    progression: asString(track.progression, '진행 정보 없음'),
    reference: asString(track.reference, '레퍼런스 정보 없음'),
    category: category as MusicShareTrackCard['category'],
    tags: tags.length ? tags : ['공유곡'],
    palette: asString(
      track.palette,
      'linear-gradient(180deg, rgba(57, 72, 87, 0.96), rgba(24, 30, 39, 0.98))'
    ),
    createdAt: asNumber(track.createdAt, Date.now() - index),
    creatorName: asString(track.creatorName, '익명 작곡가'),
    isSharedProject: Boolean(track.isSharedProject),
    projectId: asString(track.projectId) || undefined,
    creatorEmail: asString(track.creatorEmail) || undefined,
    imageUrl: asString(track.imageUrl) || undefined,
    project,
  };
}

function normalizeComment(value: unknown, index: number): MusicShareComment | null {
  const comment = asRecord(value);
  if (!comment) return null;

  return {
    id: asString(comment.id, `server-comment-${index}`),
    trackId: asString(comment.trackId),
    authorName: asString(comment.authorName, '익명'),
    authorEmail: asString(comment.authorEmail),
    content: asString(comment.content),
    createdAt: asNumber(comment.createdAt, Date.now() - index),
  };
}

function normalizeMetrics(value: unknown): Record<string, MusicShareMetrics> {
  const record = asRecord(value);
  if (!record) return {};

  return Object.fromEntries(
    Object.entries(record).map(([trackId, rawMetrics]) => {
      const metrics = asRecord(rawMetrics);
      return [
        trackId,
        {
          likeCount: Math.max(0, asNumber(metrics?.likeCount)),
          viewCount: Math.max(0, asNumber(metrics?.viewCount)),
          downloadCount: Math.max(0, asNumber(metrics?.downloadCount)),
        },
      ];
    })
  );
}

function applySnapshot(snapshot: MusicShareSnapshot) {
  const tracks = (Array.isArray(snapshot?.tracks) ? snapshot.tracks : [])
    .map(normalizeMusicShareTrack)
    .filter((track): track is MusicShareTrackCard => Boolean(track));
  const comments = (Array.isArray(snapshot?.comments) ? snapshot.comments : [])
    .map(normalizeComment)
    .filter((comment): comment is MusicShareComment => Boolean(comment?.trackId));

  useMusicShareStore.setState((state) => ({
    ...state,
    tracks,
    likedTrackIdsByUser: normalizeIdMap(snapshot?.likedTrackIdsByUser),
    recentOpenedTrackIdsByUser: normalizeIdMap(snapshot?.recentOpenedTrackIdsByUser),
    trackMetricsById: normalizeMetrics(snapshot?.trackMetricsById),
    comments,
    bootstrapStatus: 'ready',
    bootstrapError: null,
  }));
}

export const useMusicShareStore = create<MusicShareState>()(
  persist(
    (set, get) => ({
      likedTrackIdsByUser: {},
      tracks: [],
      recentOpenedTrackIdsByUser: {},
      trackMetricsById: {},
      comments: [],
      bootstrapStatus: 'idle',
      bootstrapError: null,
      seedMusicShare: async (force = false) => {
        if (!force && get().bootstrapStatus === 'ready') {
          return;
        }

        if (!force && musicShareBootstrapPromise) {
          return musicShareBootstrapPromise;
        }

        set((state) => ({
          ...state,
          bootstrapStatus: 'loading',
          bootstrapError: null,
        }));

        const nextPromise = fetchMusicShareBootstrap()
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
                  : '음악 공유 데이터를 서버에서 불러오지 못했습니다.',
            }));
            throw error;
          })
          .finally(() => {
            musicShareBootstrapPromise = null;
          });

        musicShareBootstrapPromise = nextPromise;
        return nextPromise;
      },
      applyServerSnapshot: (snapshot) => {
        applySnapshot(snapshot);
      },
      toggleTrackLike: async (trackId, userEmail) => {
        const previousState = get();
        const previousLikedTrackIds = previousState.likedTrackIdsByUser[userEmail] ?? [];
        const wasLiked = previousLikedTrackIds.includes(trackId);
        const previousMetrics = getLocalMetrics(previousState.trackMetricsById[trackId]);
        const nextLiked = !wasLiked;

        set((state) => ({
          ...state,
          likedTrackIdsByUser: {
            ...state.likedTrackIdsByUser,
            [userEmail]: nextLiked
              ? [...new Set([...(state.likedTrackIdsByUser[userEmail] ?? []), trackId])]
              : (state.likedTrackIdsByUser[userEmail] ?? []).filter((id) => id !== trackId),
          },
          trackMetricsById: {
            ...state.trackMetricsById,
            [trackId]: {
              ...getLocalMetrics(state.trackMetricsById[trackId]),
              likeCount: Math.max(0, previousMetrics.likeCount + (nextLiked ? 1 : -1)),
            },
          },
        }));

        if (isBaseTrack(trackId)) {
          return;
        }

        const mutationKey = `${userEmail}:${trackId}`;
        const mutationVersion = (trackLikeMutationVersions.get(mutationKey) ?? 0) + 1;
        trackLikeMutationVersions.set(mutationKey, mutationVersion);

        try {
          const response = await toggleTrackLikeOnServer({ trackId, userEmail });

          if (trackLikeMutationVersions.get(mutationKey) !== mutationVersion) return;

          const serverMetrics = response.snapshot.trackMetricsById?.[trackId];
          set((state) => {
            const currentLikedTrackIds = state.likedTrackIdsByUser[userEmail] ?? [];
            return {
              ...state,
              likedTrackIdsByUser: {
                ...state.likedTrackIdsByUser,
                [userEmail]: response.liked
                  ? [...new Set([...currentLikedTrackIds, trackId])]
                  : currentLikedTrackIds.filter((id) => id !== trackId),
              },
              trackMetricsById: serverMetrics
                ? {
                    ...state.trackMetricsById,
                    [trackId]: getLocalMetrics(serverMetrics),
                  }
                : state.trackMetricsById,
            };
          });
        } catch (error) {
          if (trackLikeMutationVersions.get(mutationKey) === mutationVersion) {
            set((state) => {
              const currentLikedTrackIds = state.likedTrackIdsByUser[userEmail] ?? [];
              return {
                ...state,
                likedTrackIdsByUser: {
                  ...state.likedTrackIdsByUser,
                  [userEmail]: wasLiked
                    ? [...new Set([...currentLikedTrackIds, trackId])]
                    : currentLikedTrackIds.filter((id) => id !== trackId),
                },
                trackMetricsById: {
                  ...state.trackMetricsById,
                  [trackId]: previousMetrics,
                },
              };
            });
          }
          throw error;
        } finally {
          if (trackLikeMutationVersions.get(mutationKey) === mutationVersion) {
            trackLikeMutationVersions.delete(mutationKey);
          }
        }
      },
      addTrackComment: async ({ trackId, authorName, authorEmail, content }) => {
        if (isBaseTrack(trackId)) {
          const commentId = `local-comment-${Date.now()}`;
          set((state) => ({
            ...state,
            comments: [
              ...state.comments,
              {
                id: commentId,
                trackId,
                authorName,
                authorEmail,
                content,
                createdAt: Date.now(),
              },
            ],
          }));
          return commentId;
        }

        const response = await addTrackCommentOnServer({
          trackId,
          authorName,
          authorEmail,
          content,
        });
        applySnapshot(response.snapshot);
        return '';
      },
      recordTrackView: async (trackId, userEmail) => {
        if (isBaseTrack(trackId)) {
          set((state) => {
            const metrics = getLocalMetrics(state.trackMetricsById[trackId]);
            return {
              ...state,
              trackMetricsById: {
                ...state.trackMetricsById,
                [trackId]: {
                  ...metrics,
                  viewCount: metrics.viewCount + 1,
                },
              },
            };
          });
          return;
        }

        const response = await recordTrackViewOnServer({ trackId, userEmail });
        applySnapshot(response.snapshot);
      },
      recordTrackDownload: async (trackId, userEmail) => {
        if (isBaseTrack(trackId)) {
          set((state) => {
            const metrics = getLocalMetrics(state.trackMetricsById[trackId]);
            return {
              ...state,
              trackMetricsById: {
                ...state.trackMetricsById,
                [trackId]: {
                  ...metrics,
                  downloadCount: metrics.downloadCount + 1,
                },
              },
            };
          });
          return;
        }

        const response = await recordTrackDownloadOnServer({ trackId, userEmail });
        applySnapshot(response.snapshot);
      },
      recordTrackOpen: async (trackId, userEmail) => {
        if (isBaseTrack(trackId)) {
          set((state) => {
            const recentTrackIds = state.recentOpenedTrackIdsByUser[userEmail] ?? [];
            return {
              ...state,
              recentOpenedTrackIdsByUser: {
                ...state.recentOpenedTrackIdsByUser,
                [userEmail]: [trackId, ...recentTrackIds.filter((id) => id !== trackId)].slice(
                  0,
                  20
                ),
              },
            };
          });
          return;
        }

        const response = await recordTrackOpenOnServer({ trackId, userEmail });
        applySnapshot(response.snapshot);
      },
      deleteTrack: async (trackId) => {
        const response = await deleteTrackOnServer({ trackId });
        applySnapshot(response.snapshot);
      },
    }),
    {
      name: 'song-maker-music-share',
      merge: (persistedState, currentState) => {
        const persisted = asRecord(persistedState);
        const tracks = (Array.isArray(persisted?.tracks) ? persisted.tracks : [])
          .map(normalizeMusicShareTrack)
          .filter((track): track is MusicShareTrackCard => Boolean(track));
        const comments = (Array.isArray(persisted?.comments) ? persisted.comments : [])
          .map(normalizeComment)
          .filter((comment): comment is MusicShareComment => Boolean(comment?.trackId));

        return {
          ...currentState,
          ...persisted,
          tracks,
          comments,
          likedTrackIdsByUser: normalizeIdMap(persisted?.likedTrackIdsByUser),
          recentOpenedTrackIdsByUser: normalizeIdMap(persisted?.recentOpenedTrackIdsByUser),
          trackMetricsById: normalizeMetrics(persisted?.trackMetricsById),
        } as MusicShareState;
      },
      partialize: (state) => ({
        likedTrackIdsByUser: state.likedTrackIdsByUser,
        tracks: state.tracks,
        recentOpenedTrackIdsByUser: state.recentOpenedTrackIdsByUser,
        trackMetricsById: state.trackMetricsById,
        comments: state.comments,
      }),
    }
  )
);


