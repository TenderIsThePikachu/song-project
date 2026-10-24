import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import { loadShortsMysqlState, saveShortsMysqlState } from './mysqlTables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SHORTS_LEGACY_DATA_PATH = join(__dirname, 'shorts-data.json');
const SHORTS_UPLOAD_DIR = join(__dirname, 'uploads', 'shorts');
const SHORTS_AUDIO_UPLOAD_DIR = join(__dirname, 'uploads', 'shorts-audio');

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureDirs() {
  const dataDir = dirname(SHORTS_UPLOAD_DIR);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (!existsSync(SHORTS_UPLOAD_DIR)) {
    mkdirSync(SHORTS_UPLOAD_DIR, { recursive: true });
  }

  if (!existsSync(SHORTS_AUDIO_UPLOAD_DIR)) {
    mkdirSync(SHORTS_AUDIO_UPLOAD_DIR, { recursive: true });
  }
}

function createSeedState() {
  return {
    shorts: [
      {
        id: 'short-demo-1',
        title: '머니 코드 15초 스케치',
        description: 'I-V-vi-IV 진행 위에 멜로디 아이디어를 짧게 얹어본 숏폼입니다.',
        creatorName: 'loopmaker',
        creatorEmail: 'loopmaker@songmaker.app',
        genre: '팝',
        tags: ['머니코드', '멜로디', '입문'],
        createdAt: new Date('2026-03-20T20:20:00+09:00').getTime(),
        durationLabel: '0:15',
        likeCount: 92,
        viewCount: 1840,
        visibility: 'public',
        tone: 'lime',
        likedBy: [],
      },
      {
        id: 'short-demo-2',
        title: '비트 위에 맞는 베이스 라인',
        description: '드럼 그루브에 루트 연주로 베이스를 붙이는 과정을 빠르게 보여줍니다.',
        creatorName: 'groovepark',
        creatorEmail: 'groovepark@songmaker.app',
        genre: '힙합',
        tags: ['베이스', '그루브', '작업팁'],
        createdAt: new Date('2026-03-20T17:40:00+09:00').getTime(),
        durationLabel: '0:22',
        likeCount: 61,
        viewCount: 1206,
        visibility: 'public',
        tone: 'cyan',
        likedBy: [],
      },
      {
        id: 'short-demo-3',
        title: '서브파트 감정 전환',
        description: '후렴 직전의 분위기를 바꾸는 코드 전환 아이디어를 정리했습니다.',
        creatorName: 'chordnote',
        creatorEmail: 'chordnote@songmaker.app',
        genre: '발라드',
        tags: ['화성', '코드진행', '후렴'],
        createdAt: new Date('2026-03-19T22:10:00+09:00').getTime(),
        durationLabel: '0:18',
        likeCount: 48,
        viewCount: 934,
        visibility: 'public',
        tone: 'violet',
        likedBy: [],
      },
    ],
    comments: [
      {
        id: 'short-comment-1',
        shortId: 'short-demo-1',
        authorName: 'musicnew92',
        authorEmail: 'musicnew92@songmaker.app',
        content: '후렴 앞에 바로 붙이기 좋겠네요. 멜로디 무드도 잘 어울려요.',
        createdAt: new Date('2026-03-20T21:10:00+09:00').getTime(),
      },
      {
        id: 'short-comment-2',
        shortId: 'short-demo-1',
        authorName: 'chordnote',
        authorEmail: 'chordnote@songmaker.app',
        content: '이 진행 앞에 보컬 샘플을 얹으면 발라드 느낌도 잘 나올 것 같아요.',
        createdAt: new Date('2026-03-20T21:24:00+09:00').getTime(),
      },
    ],
  };
}

async function loadLegacyState() {
  ensureDirs();
  return await loadSqlState('shorts', createSeedState, {
    legacyFilePath: SHORTS_LEGACY_DATA_PATH,
    normalize: (parsed) => ({
      shorts: Array.isArray(parsed.shorts) ? parsed.shorts : createSeedState().shorts,
      comments: Array.isArray(parsed.comments) ? parsed.comments : createSeedState().comments,
    }),
  });
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadShortsMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

let state = await loadState();

function saveState() {
  ensureDirs();

  if (getSqlDriver() === 'mysql') {
    saveShortsMysqlState(state);
    return;
  }

  saveSqlState('shorts', state);
}

function normalizeText(value, fallback = '') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function buildUploadUrl(baseUrl, fileName) {
  return `${baseUrl}/uploads/shorts/${encodeURIComponent(fileName)}`;
}

function buildAudioUploadUrl(baseUrl, fileName) {
  return `${baseUrl}/uploads/shorts-audio/${encodeURIComponent(fileName)}`;
}

function deleteUploadIfManaged(storageKey, uploadDir = SHORTS_UPLOAD_DIR) {
  const key = normalizeText(storageKey);
  if (!key) {
    return;
  }

  const filePath = join(uploadDir, key);
  if (existsSync(filePath)) {
    try {
      unlinkSync(filePath);
    } catch {
      // ignore cleanup failures in demo server
    }
  }
}

export function getShortsSnapshot() {
  return {
    shorts: state.shorts,
    comments: state.comments,
  };
}

export function saveShortVideoFile(payload) {
  ensureDirs();
  const ext = extname(payload.fileName || '').toLowerCase() || '.mp4';
  const safeExt = ['.mp4', '.mov', '.webm'].includes(ext) ? ext : '.mp4';
  const storageKey = `${createId('short-video')}${safeExt}`;
  const filePath = join(SHORTS_UPLOAD_DIR, storageKey);

  writeFileSync(filePath, payload.buffer);

  return {
    videoUrl: buildUploadUrl(payload.baseUrl, storageKey),
    videoStorageKey: storageKey,
    videoFileName: payload.fileName || storageKey,
    videoSizeBytes: payload.buffer.length,
  };
}

export function saveShortAudioFile(payload) {
  ensureDirs();
  const ext = extname(payload.fileName || '').toLowerCase();
  const safeExt = ext === '.mp3' ? ext : '.mp3';
  const storageKey = `${createId('short-audio')}${safeExt}`;
  const filePath = join(SHORTS_AUDIO_UPLOAD_DIR, storageKey);

  writeFileSync(filePath, payload.buffer);

  return {
    audioUrl: buildAudioUploadUrl(payload.baseUrl, storageKey),
    audioStorageKey: storageKey,
    audioFileName: payload.fileName || storageKey,
    audioSizeBytes: payload.buffer.length,
  };
}

export function createShort(payload) {
  const short = {
    id: createId('short'),
    title: normalizeText(payload.title, '새 숏폼'),
    description: normalizeText(payload.description),
    creatorName: normalizeText(payload.creatorName, 'guest'),
    creatorEmail: normalizeEmail(payload.creatorEmail) || 'guest@songmaker.local',
    genre: normalizeText(payload.genre, '기타'),
    tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean).slice(0, 5) : [],
    createdAt: Date.now(),
    durationLabel: normalizeText(payload.durationLabel, '0:15'),
    likeCount: 0,
    viewCount: 0,
    visibility: payload.visibility === 'private' ? 'private' : 'public',
    tone: ['lime', 'cyan', 'violet', 'amber'].includes(payload.tone) ? payload.tone : 'lime',
    likedBy: [],
    videoUrl: payload.videoUrl,
    videoStorageKey: payload.videoStorageKey,
    videoFileName: payload.videoFileName,
    videoSizeBytes: payload.videoSizeBytes,
    audioUrl: payload.audioUrl,
    audioStorageKey: payload.audioStorageKey,
    audioFileName: payload.audioFileName,
    audioSizeBytes: payload.audioSizeBytes,
    musicProjectId: payload.musicProjectId,
    musicProjectTitle: payload.musicProjectTitle,
    musicShareTrackId: payload.musicShareTrackId,
  };

  state = {
    ...state,
    shorts: [short, ...state.shorts],
  };
  saveState();

  return {
    shortId: short.id,
    snapshot: getShortsSnapshot(),
  };
}

export function updateShort(shortId, payload) {
  const existingShort = state.shorts.find((short) => short.id === shortId);

  state = {
    ...state,
    shorts: state.shorts.map((short) =>
      short.id === shortId
        ? {
            ...short,
            title: normalizeText(payload.title, short.title),
            description: normalizeText(payload.description, short.description),
            genre: normalizeText(payload.genre, short.genre || '기타'),
            tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean).slice(0, 5) : short.tags,
            durationLabel: normalizeText(payload.durationLabel, short.durationLabel),
            visibility: payload.visibility === 'private' ? 'private' : 'public',
            tone: ['lime', 'cyan', 'violet', 'amber'].includes(payload.tone) ? payload.tone : short.tone,
            videoUrl: payload.videoUrl ?? short.videoUrl,
            videoStorageKey: payload.videoStorageKey ?? short.videoStorageKey,
            videoFileName: payload.videoFileName ?? short.videoFileName,
            videoSizeBytes: payload.videoSizeBytes ?? short.videoSizeBytes,
            audioUrl: payload.audioUrl ?? short.audioUrl,
            audioStorageKey: payload.audioStorageKey ?? short.audioStorageKey,
            audioFileName: payload.audioFileName ?? short.audioFileName,
            audioSizeBytes: payload.audioSizeBytes ?? short.audioSizeBytes,
            musicProjectId: payload.musicProjectId ?? short.musicProjectId,
            musicProjectTitle: payload.musicProjectTitle ?? short.musicProjectTitle,
            musicShareTrackId: payload.musicShareTrackId ?? short.musicShareTrackId,
          }
        : short
    ),
  };

  if (
    existingShort?.videoStorageKey &&
    payload.videoStorageKey &&
    existingShort.videoStorageKey !== payload.videoStorageKey
  ) {
    deleteUploadIfManaged(existingShort.videoStorageKey);
  }

  if (
    existingShort?.audioStorageKey &&
    payload.audioStorageKey &&
    existingShort.audioStorageKey !== payload.audioStorageKey
  ) {
    deleteUploadIfManaged(existingShort.audioStorageKey, SHORTS_AUDIO_UPLOAD_DIR);
  }

  saveState();
  return getShortsSnapshot();
}

export function deleteShort(shortId) {
  const target = state.shorts.find((short) => short.id === shortId);
  if (target?.videoStorageKey) {
    deleteUploadIfManaged(target.videoStorageKey);
  }
  if (target?.audioStorageKey) {
    deleteUploadIfManaged(target.audioStorageKey, SHORTS_AUDIO_UPLOAD_DIR);
  }

  state = {
    ...state,
    shorts: state.shorts.filter((short) => short.id !== shortId),
    comments: state.comments.filter((comment) => comment.shortId !== shortId),
  };
  saveState();
  return getShortsSnapshot();
}

export function toggleShortLike(payload) {
  const shortId = normalizeText(payload.shortId);
  const userEmail = normalizeEmail(payload.userEmail);

  state = {
    ...state,
    shorts: state.shorts.map((short) => {
      if (short.id !== shortId) {
        return short;
      }

      const alreadyLiked = short.likedBy.includes(userEmail);
      const likedBy = alreadyLiked
        ? short.likedBy.filter((email) => email !== userEmail)
        : [...short.likedBy, userEmail];

      return {
        ...short,
        likedBy,
        likeCount: Math.max(0, short.likeCount + (alreadyLiked ? -1 : 1)),
      };
    }),
  };
  saveState();
  return getShortsSnapshot();
}

export function addShortComment(payload) {
  const comment = {
    id: createId('short-comment'),
    shortId: normalizeText(payload.shortId),
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
  return getShortsSnapshot();
}

export function recordShortView(payload) {
  const shortId = normalizeText(payload.shortId);

  state = {
    ...state,
    shorts: state.shorts.map((short) =>
      short.id === shortId
        ? {
            ...short,
            viewCount: short.viewCount + 1,
          }
        : short
    ),
  };
  saveState();
  return getShortsSnapshot();
}

function getContentType(fileName) {
  const ext = extname(fileName).toLowerCase();

  if (ext === '.webm') {
    return 'video/webm';
  }

  if (ext === '.mov') {
    return 'video/quicktime';
  }

  return 'video/mp4';
}

export function serveShortUpload(request, response, fileName) {
  const filePath = join(SHORTS_UPLOAD_DIR, fileName);
  if (!existsSync(filePath)) {
    return false;
  }

  const stats = statSync(filePath);
  const range = request.headers.range;
  const contentType = getContentType(fileName);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Type', contentType);

  if (range) {
    const [startText, endText] = range.replace(/bytes=/, '').split('-');
    const start = Number(startText || 0);
    const end = endText ? Number(endText) : stats.size - 1;
    const stream = createReadStream(filePath, { start, end });

    response.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Content-Length': end - start + 1,
    });
    stream.pipe(response);
    return true;
  }

  response.writeHead(200, {
    'Content-Length': stats.size,
  });
  createReadStream(filePath).pipe(response);
  return true;
}

export function serveShortAudioUpload(request, response, fileName) {
  const filePath = join(SHORTS_AUDIO_UPLOAD_DIR, fileName);
  if (!existsSync(filePath)) {
    return false;
  }

  const stats = statSync(filePath);
  const range = request.headers.range;

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Type', 'audio/mpeg');

  if (range) {
    const [startText, endText] = range.replace(/bytes=/, '').split('-');
    const start = Number(startText || 0);
    const end = endText ? Number(endText) : stats.size - 1;
    const stream = createReadStream(filePath, { start, end });

    response.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Content-Length': end - start + 1,
    });
    stream.pipe(response);
    return true;
  }

  response.writeHead(200, {
    'Content-Length': stats.size,
  });
  createReadStream(filePath).pipe(response);
  return true;
}
