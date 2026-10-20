import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import { loadLibraryMysqlState, saveLibraryMysqlState } from './mysqlTables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LIBRARY_LEGACY_DATA_PATH = join(__dirname, 'library-data.json');
const MUSIC_SHARE_UPLOAD_DIR = join(__dirname, 'uploads', 'music-share');
const MUSIC_SHARE_TRACK_IMAGES = {
  'share-base-1': '/seed-images/music/canon.svg',
  'share-base-2': '/seed-images/music/let-it-be.svg',
  'share-base-3': '/seed-images/music/stand-by-me.svg',
  'share-base-4': '/seed-images/music/jazz-standard.svg',
  'share-base-5': '/seed-images/music/plastic-love.svg',
  'share-base-6': '/seed-images/music/film-ost.svg',
  'share-base-7': '/seed-images/music/anime-ending.svg',
  'share-base-8': '/seed-images/music/game-theme.svg',
};
const MUSIC_SHARE_DEFAULT_IMAGES = {
  classic: '/seed-images/music/classic.svg',
  pop: '/seed-images/music/pop.svg',
  ballad: '/seed-images/music/pop.svg',
  jazz: '/seed-images/music/jazz.svg',
  citypop: '/seed-images/music/citypop.svg',
  ost: '/seed-images/music/screen.svg',
  anime: '/seed-images/music/screen.svg',
  game: '/seed-images/music/screen.svg',
  rock: '/seed-images/music/pop.svg',
};

const INITIAL_TRACK_METRICS = {
  'share-base-1': { likeCount: 128, viewCount: 1824, downloadCount: 72 },
  'share-base-2': { likeCount: 94, viewCount: 1533, downloadCount: 58 },
  'share-base-3': { likeCount: 82, viewCount: 1288, downloadCount: 49 },
  'share-base-4': { likeCount: 41, viewCount: 804, downloadCount: 23 },
  'share-base-5': { likeCount: 76, viewCount: 1168, downloadCount: 44 },
  'share-base-6': { likeCount: 63, viewCount: 972, downloadCount: 36 },
  'share-base-7': { likeCount: 58, viewCount: 892, downloadCount: 28 },
  'share-base-8': { likeCount: 49, viewCount: 756, downloadCount: 18 },
};

const INITIAL_SHARED_TRACKS = [
  {
    id: 'share-base-1',
    title: '머니 코드 메모',
    progression: 'I - V - vi - IV',
    reference: 'Johann Pachelbel - Canon',
    category: 'classic',
    tags: ['입문', '감성'],
    palette: 'linear-gradient(180deg, rgba(95,95,99,0.92) 0%, rgba(55,55,58,0.96) 100%)',
    createdAt: new Date('2026-03-17T10:20:00+09:00').getTime(),
    creatorName: 'loopmaker',
    creatorEmail: 'loopmaker@songmaker.app',
    imageUrl: '/seed-images/music/canon.svg',
  },
  {
    id: 'share-base-2',
    title: '비트 중심 무드 진행',
    progression: 'I - V - vi - IV',
    reference: 'The Beatles - Let It Be',
    category: 'pop',
    tags: ['발라드', '감성'],
    palette: 'linear-gradient(180deg, rgba(89,89,94,0.92) 0%, rgba(51,51,54,0.96) 100%)',
    createdAt: new Date('2026-03-18T08:10:00+09:00').getTime(),
    creatorName: 'chordnote',
    creatorEmail: 'chordnote@songmaker.app',
    imageUrl: '/seed-images/music/let-it-be.svg',
  },
  {
    id: 'share-base-3',
    title: '루트 중심 진행',
    progression: 'I - vi - IV - V',
    reference: 'Ben E. King - Stand By Me',
    category: 'pop',
    tags: ['감성', '입문'],
    palette: 'linear-gradient(180deg, rgba(94,94,98,0.92) 0%, rgba(53,53,57,0.96) 100%)',
    createdAt: new Date('2026-03-18T19:45:00+09:00').getTime(),
    creatorName: 'groovepark',
    creatorEmail: 'groovepark@songmaker.app',
    imageUrl: '/seed-images/music/stand-by-me.svg',
  },
  {
    id: 'share-base-4',
    title: '재즈 발라드 루프',
    progression: 'ii - V - I',
    reference: 'Jazz Standard',
    category: 'jazz',
    tags: ['재즈', '입문'],
    palette: 'linear-gradient(180deg, rgba(91,91,96,0.92) 0%, rgba(50,50,55,0.96) 100%)',
    createdAt: new Date('2026-03-19T11:05:00+09:00').getTime(),
    creatorName: 'bluekeys',
    creatorEmail: 'bluekeys@songmaker.app',
    imageUrl: '/seed-images/music/jazz-standard.svg',
  },
  {
    id: 'share-base-5',
    title: '시티팝 브리지',
    progression: 'I - V - vi - iii - IV - I - IV - V',
    reference: 'Plastic Love',
    category: 'citypop',
    tags: ['시티팝', '감성'],
    palette: 'linear-gradient(180deg, rgba(96,96,101,0.92) 0%, rgba(54,54,58,0.96) 100%)',
    createdAt: new Date('2026-03-19T20:10:00+09:00').getTime(),
    creatorName: 'nightsynth',
    creatorEmail: 'nightsynth@songmaker.app',
    imageUrl: '/seed-images/music/plastic-love.svg',
  },
  {
    id: 'share-base-6',
    title: '영화 OST 루프',
    progression: 'vi - IV - I - V',
    reference: 'Film OST',
    category: 'ost',
    tags: ['OST', '감성'],
    palette: 'linear-gradient(180deg, rgba(95,95,100,0.92) 0%, rgba(52,52,56,0.96) 100%)',
    createdAt: new Date('2026-03-20T09:00:00+09:00').getTime(),
    creatorName: 'scenecomposer',
    creatorEmail: 'scenecomposer@songmaker.app',
    imageUrl: '/seed-images/music/film-ost.svg',
  },
  {
    id: 'share-base-7',
    title: '애니 엔딩 무드',
    progression: 'vi - IV - V - IV',
    reference: 'Anime Ending',
    category: 'anime',
    tags: ['애니', 'OST'],
    palette: 'linear-gradient(180deg, rgba(92,92,96,0.92) 0%, rgba(50,50,54,0.96) 100%)',
    createdAt: new Date('2026-03-20T16:35:00+09:00').getTime(),
    creatorName: 'animechord',
    creatorEmail: 'animechord@songmaker.app',
    imageUrl: '/seed-images/music/anime-ending.svg',
  },
  {
    id: 'share-base-8',
    title: '게임 메인 테마',
    progression: 'I - vi - ii - V',
    reference: 'Game Theme',
    category: 'game',
    tags: ['게임', 'OST'],
    palette: 'linear-gradient(180deg, rgba(87,87,90,0.92) 0%, rgba(48,48,52,0.96) 100%)',
    createdAt: new Date('2026-03-20T23:15:00+09:00').getTime(),
    creatorName: 'arcadescore',
    creatorEmail: 'arcadescore@songmaker.app',
    imageUrl: '/seed-images/music/game-theme.svg',
  },
];

const INITIAL_COMMENTS = [
  {
    id: 'track-comment-1',
    trackId: 'share-base-1',
    authorName: 'groovepark',
    authorEmail: 'groovepark@songmaker.app',
    content: '입문용으로 설명하기 좋은 진행이라 연습곡으로 자주 꺼내게 돼요.',
    createdAt: new Date('2026-03-21T10:20:00+09:00').getTime(),
  },
  {
    id: 'track-comment-2',
    trackId: 'share-base-2',
    authorName: 'loopmaker',
    authorEmail: 'loopmaker@songmaker.app',
    content: '후렴으로 옮길 때 멜로디를 얹기 편해서 자주 켜두고 참고하고 있습니다.',
    createdAt: new Date('2026-03-21T11:45:00+09:00').getTime(),
  },
];

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSeedState() {
  return {
    projects: [],
    sharedTracks: INITIAL_SHARED_TRACKS,
    favoriteTrackIdsByUser: {},
    likedTrackIdsByUser: {},
    recentOpenedTrackIdsByUser: {},
    trackMetricsById: INITIAL_TRACK_METRICS,
    comments: INITIAL_COMMENTS,
  };
}

function ensureUploadDirs() {
  const dataDir = dirname(MUSIC_SHARE_UPLOAD_DIR);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (!existsSync(MUSIC_SHARE_UPLOAD_DIR)) {
    mkdirSync(MUSIC_SHARE_UPLOAD_DIR, { recursive: true });
  }
}

async function loadLegacyState() {
  return await loadSqlState('library', createSeedState, {
    legacyFilePath: LIBRARY_LEGACY_DATA_PATH,
    normalize: (parsed) => ({
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      sharedTracks: Array.isArray(parsed.sharedTracks) ? parsed.sharedTracks : INITIAL_SHARED_TRACKS,
      favoriteTrackIdsByUser:
        parsed && typeof parsed.favoriteTrackIdsByUser === 'object' && parsed.favoriteTrackIdsByUser
          ? parsed.favoriteTrackIdsByUser
          : {},
      likedTrackIdsByUser:
        parsed && typeof parsed.likedTrackIdsByUser === 'object' && parsed.likedTrackIdsByUser
          ? parsed.likedTrackIdsByUser
          : {},
      recentOpenedTrackIdsByUser:
        parsed &&
        typeof parsed.recentOpenedTrackIdsByUser === 'object' &&
        parsed.recentOpenedTrackIdsByUser
          ? parsed.recentOpenedTrackIdsByUser
          : {},
      trackMetricsById:
        parsed && typeof parsed.trackMetricsById === 'object' && parsed.trackMetricsById
          ? parsed.trackMetricsById
          : INITIAL_TRACK_METRICS,
      comments: Array.isArray(parsed.comments) ? parsed.comments : INITIAL_COMMENTS,
    }),
  });
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadLibraryMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

let state = await loadState();

function saveState() {
  if (getSqlDriver() === 'mysql') {
    saveLibraryMysqlState(state);
    return;
  }

  saveSqlState('library', state);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeText(value, fallback = '') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function buildUploadUrl(baseUrl, fileName) {
  return `${baseUrl}/uploads/music-share/${encodeURIComponent(fileName)}`;
}

function createEmptyMetrics() {
  return {
    likeCount: 0,
    viewCount: 0,
    downloadCount: 0,
  };
}

function getDefaultTrackImage(track) {
  if (MUSIC_SHARE_TRACK_IMAGES[track.id]) {
    return MUSIC_SHARE_TRACK_IMAGES[track.id];
  }
  return MUSIC_SHARE_DEFAULT_IMAGES[track.category] ?? '/seed-images/music/pop.svg';
}

export function getComposerLibrarySnapshot() {
  return {
    projects: state.projects,
    favoriteTrackIdsByUser: state.favoriteTrackIdsByUser,
  };
}

export function saveComposerProject(payload) {
  const timestamp = Date.now();
  const requestedProjectId = normalizeText(payload.id);
  const creatorEmail = normalizeEmail(payload.creatorEmail) || 'guest@songmaker.local';
  const requestedProject = requestedProjectId
    ? state.projects.find((project) => project.id === requestedProjectId)
    : null;

  if (requestedProject && normalizeEmail(requestedProject.creatorEmail) !== creatorEmail) {
    throw new Error('본인이 만든 프로젝트만 저장할 수 있습니다.');
  }

  const existingProject = requestedProject ?? null;
  const projectId = existingProject?.id || createId('project');

  const nextProject = {
    ...existingProject,
    id: projectId,
    title: normalizeText(payload.title, '새 프로젝트'),
    description: normalizeText(payload.description),
    genre: normalizeText(payload.genre, '미정'),
    bpm: Number(payload.bpm) || 120,
    steps: Number(payload.steps) || 32,
    createdAt: existingProject?.createdAt ?? timestamp,
    updatedAt: timestamp,
    creatorName: normalizeText(payload.creatorName, 'guest'),
    creatorEmail,
    project: payload.project,
    exportFormat: payload.exportFormat === 'mp3' || payload.exportFormat === 'flac' ? payload.exportFormat : 'wav',
    isShared: existingProject?.isShared ?? false,
    shareVisibility: existingProject?.shareVisibility ?? 'private',
    shareMidiEnabled: existingProject?.shareMidiEnabled ?? false,
  };

  state = {
    ...state,
    projects: [nextProject, ...state.projects.filter((project) => project.id !== projectId)],
  };
  saveState();

  return {
    projectId,
    snapshot: getComposerLibrarySnapshot(),
  };
}

export function shareComposerProject(payload) {
  const timestamp = Date.now();
  const projectId = createId('project');

  const nextProject = {
    id: projectId,
    title: normalizeText(payload.title, '공유 프로젝트'),
    description: normalizeText(payload.description),
    genre: normalizeText(payload.genre, '미정'),
    bpm: Number(payload.bpm) || 120,
    steps: Number(payload.steps) || 32,
    createdAt: timestamp,
    updatedAt: timestamp,
    creatorName: normalizeText(payload.creatorName, 'guest'),
    creatorEmail: normalizeEmail(payload.creatorEmail) || 'guest@songmaker.local',
    project: payload.project,
    exportFormat: 'wav',
    isShared: true,
    shareVisibility: payload.shareVisibility === 'private' ? 'private' : 'public',
    shareMidiEnabled: Boolean(payload.shareMidiEnabled),
    coverImageUrl: payload.coverImageUrl,
    coverImageStorageKey: payload.coverImageStorageKey,
    coverImageFileName: payload.coverImageFileName,
    audioUrl: payload.audioUrl,
    audioStorageKey: payload.audioStorageKey,
    audioFileName: payload.audioFileName,
  };

  state = {
    ...state,
    projects: [nextProject, ...state.projects],
  };
  saveState();

  return {
    projectId,
    snapshot: getComposerLibrarySnapshot(),
  };
}

export function toggleFavoriteTrack(payload) {
  const userEmail = normalizeEmail(payload.userEmail);
  const trackId = normalizeText(payload.trackId);
  const currentIds = state.favoriteTrackIdsByUser[userEmail] ?? [];
  const hasTrack = currentIds.includes(trackId);

  state = {
    ...state,
    favoriteTrackIdsByUser: {
      ...state.favoriteTrackIdsByUser,
      [userEmail]: hasTrack
        ? currentIds.filter((id) => id !== trackId)
        : [trackId, ...currentIds],
    },
  };
  saveState();

  return getComposerLibrarySnapshot();
}

export function deleteComposerProject(payload) {
  const ownerEmail = normalizeEmail(payload.userEmail);
  const projectId = normalizeText(payload.projectId);

  state = {
    ...state,
    projects: state.projects.filter(
      (project) => !(project.id === projectId && project.creatorEmail === ownerEmail)
    ),
    favoriteTrackIdsByUser: Object.fromEntries(
      Object.entries(state.favoriteTrackIdsByUser).map(([email, ids]) => [
        email,
        ids.filter((id) => id !== projectId),
      ])
    ),
    likedTrackIdsByUser: Object.fromEntries(
      Object.entries(state.likedTrackIdsByUser).map(([email, ids]) => [
        email,
        ids.filter((id) => id !== projectId),
      ])
    ),
    recentOpenedTrackIdsByUser: Object.fromEntries(
      Object.entries(state.recentOpenedTrackIdsByUser).map(([email, ids]) => [
        email,
        ids.filter((id) => id !== projectId),
      ])
    ),
    comments: state.comments.filter((comment) => comment.trackId !== projectId),
  };
  saveState();

  return {
    composer: getComposerLibrarySnapshot(),
    music: getMusicShareSnapshot(),
  };
}

export function getMusicShareSnapshot() {
  return {
    tracks: state.sharedTracks,
    likedTrackIdsByUser: state.likedTrackIdsByUser,
    recentOpenedTrackIdsByUser: state.recentOpenedTrackIdsByUser,
    trackMetricsById: state.trackMetricsById,
    comments: state.comments,
  };
}

export function updateMusicShareTrack(payload) {
  const trackId = normalizeText(payload.trackId);
  const creatorEmail = normalizeEmail(payload.creatorEmail);
  const existingTrack = state.sharedTracks.find((item) => item.id === trackId);
  const sharedProject = state.projects.find((item) => item.id === trackId && item.isShared);
  const track = existingTrack ?? (sharedProject ? {
    id: sharedProject.id,
    title: sharedProject.title,
    progression: `${sharedProject.steps} steps · ${sharedProject.bpm} BPM`,
    reference: `${sharedProject.creatorName} 공유`,
    category: 'pop',
    tags: ['공유곡'],
    palette: 'linear-gradient(180deg, rgba(57, 72, 87, 0.96), rgba(24, 30, 39, 0.98))',
    createdAt: sharedProject.createdAt,
    creatorName: sharedProject.creatorName,
    creatorEmail: sharedProject.creatorEmail,
    isSharedProject: true,
    projectId: sharedProject.id,
    project: sharedProject.project,
    imageUrl: sharedProject.coverImageUrl,
  } : null);

  if (!track) throw new Error('수정할 공유곡을 찾을 수 없습니다.');
  if (!creatorEmail || normalizeEmail(track.creatorEmail) !== creatorEmail) {
    throw new Error('본인이 올린 공유곡만 수정할 수 있습니다.');
  }

  const allowedCategories = new Set(Object.keys(MUSIC_SHARE_DEFAULT_IMAGES));
  const category = normalizeText(payload.category, track.category);
  const nextTrack = {
    ...track,
    title: normalizeText(payload.title, track.title),
    reference: normalizeText(payload.reference),
    progression: normalizeText(payload.progression),
    category: allowedCategories.has(category) ? category : track.category,
    tags: Array.isArray(payload.tags)
      ? payload.tags.map((tag) => normalizeText(tag)).filter(Boolean).slice(0, 10)
      : track.tags,
    youtubeUrl: normalizeText(payload.youtubeUrl),
    imageUrl:
      payload.imageUrl === undefined
        ? track.imageUrl
        : normalizeText(payload.imageUrl),
    updatedAt: Date.now(),
  };

  state = {
    ...state,
    sharedTracks: [nextTrack, ...state.sharedTracks.filter((item) => item.id !== trackId)],
  };
  saveState();
  return getMusicShareSnapshot();
}

export function saveMusicShareImageFile(payload) {
  ensureUploadDirs();
  const ext = extname(payload.fileName || '').toLowerCase() || '.jpg';
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
  const storageKey = `${createId('music-cover')}${safeExt}`;
  const filePath = join(MUSIC_SHARE_UPLOAD_DIR, storageKey);

  writeFileSync(filePath, payload.buffer);

  return {
    imageUrl: buildUploadUrl(payload.baseUrl, storageKey),
    imageStorageKey: storageKey,
    imageFileName: payload.fileName || storageKey,
  };
}

export function saveMusicShareAudioFile(payload) {
  ensureUploadDirs();
  const storageKey = `${createId('music-audio')}.mp3`;
  const filePath = join(MUSIC_SHARE_UPLOAD_DIR, storageKey);

  writeFileSync(filePath, payload.buffer);

  return {
    audioUrl: buildUploadUrl(payload.baseUrl, storageKey),
    audioStorageKey: storageKey,
    audioFileName: payload.fileName || storageKey,
  };
}

export function serveMusicShareUpload(request, response, fileName) {
  const filePath = join(MUSIC_SHARE_UPLOAD_DIR, fileName);
  if (!existsSync(filePath)) {
    return false;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType =
    ext === '.mp3'
      ? 'audio/mpeg'
      : ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : 'image/jpeg';
  const stat = statSync(filePath);

  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  });

  createReadStream(filePath).pipe(response);
  return true;
}

export function toggleTrackLike(payload) {
  const userEmail = normalizeEmail(payload.userEmail);
  const trackId = normalizeText(payload.trackId);
  const currentIds = state.likedTrackIdsByUser[userEmail] ?? [];
  const alreadyLiked = currentIds.includes(trackId);
  const currentMetrics = state.trackMetricsById[trackId] ?? createEmptyMetrics();

  state = {
    ...state,
    likedTrackIdsByUser: {
      ...state.likedTrackIdsByUser,
      [userEmail]: alreadyLiked
        ? currentIds.filter((id) => id !== trackId)
        : [trackId, ...currentIds],
    },
    trackMetricsById: {
      ...state.trackMetricsById,
      [trackId]: {
        ...currentMetrics,
        likeCount: Math.max(0, currentMetrics.likeCount + (alreadyLiked ? -1 : 1)),
      },
    },
  };
  saveState();

  return getMusicShareSnapshot();
}

export function addTrackComment(payload) {
  const trackId = normalizeText(payload.trackId);
  const comment = {
    id: createId('track-comment'),
    trackId,
    authorName: normalizeText(payload.authorName, 'guest'),
    authorEmail: normalizeEmail(payload.authorEmail) || 'guest@songmaker.local',
    content: normalizeText(payload.content),
    createdAt: Date.now(),
  };

  state = {
    ...state,
    comments: [comment, ...state.comments],
  };
  saveState();

  return getMusicShareSnapshot();
}

export function recordTrackView(payload) {
  const trackId = normalizeText(payload.trackId);
  const currentMetrics = state.trackMetricsById[trackId] ?? createEmptyMetrics();

  state = {
    ...state,
    trackMetricsById: {
      ...state.trackMetricsById,
      [trackId]: {
        ...currentMetrics,
        viewCount: currentMetrics.viewCount + 1,
      },
    },
  };
  saveState();

  return getMusicShareSnapshot();
}

export function recordTrackDownload(payload) {
  const trackId = normalizeText(payload.trackId);
  const currentMetrics = state.trackMetricsById[trackId] ?? createEmptyMetrics();

  state = {
    ...state,
    trackMetricsById: {
      ...state.trackMetricsById,
      [trackId]: {
        ...currentMetrics,
        downloadCount: currentMetrics.downloadCount + 1,
      },
    },
  };
  saveState();

  return getMusicShareSnapshot();
}

export function recordTrackOpen(payload) {
  const trackId = normalizeText(payload.trackId);
  const userEmail = normalizeEmail(payload.userEmail);
  const currentIds = state.recentOpenedTrackIdsByUser[userEmail] ?? [];
  const nextIds = [trackId, ...currentIds.filter((id) => id !== trackId)].slice(0, 10);

  state = {
    ...state,
    recentOpenedTrackIdsByUser: {
      ...state.recentOpenedTrackIdsByUser,
      [userEmail]: nextIds,
    },
  };
  saveState();

  return getMusicShareSnapshot();
}
