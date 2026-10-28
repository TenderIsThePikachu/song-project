import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import { loadCollabMysqlState, saveCollabMysqlState } from './mysqlTables.mjs';
import {
  AuthServiceError,
  getUserProfile,
  loginUser,
  logoutUserSession,
  requestPasswordReset,
  requireSessionUser,
  restoreUserSession,
  signupUser,
  updateUserAvatar,
  updateUserProfile,
} from './authService.mjs';
import { getSettings, updateSettings } from './settingsService.mjs';
import {
  addFriend,
  createDirectThread,
  createGroupThread,
  getMessagesBootstrap,
  markThreadRead,
  removeFriend,
  sendMessage,
} from './messagesService.mjs';
import {
  addTrackComment,
  deleteComposerProject,
  getComposerLibrarySnapshot,
  getMusicShareSnapshot,
  recordTrackDownload,
  recordTrackOpen,
  recordTrackView,
  saveMusicShareAudioFile,
  saveMusicShareImageFile,
  saveComposerVocalAudioFile,
  saveComposerProject,
  shareComposerProject,
  serveMusicShareUpload,
  serveComposerVocalUpload,
  toggleFavoriteTrack,
  toggleTrackLike,
  updateMusicShareTrack,
} from './libraryService.mjs';
import {
  addCommunityComment,
  createCommunityPost,
  deleteCommunityComment,
  deleteCommunityPost,
  getCommunitySnapshot,
  moderateCommunityPost,
  recordCommunityView,
  replyCommunityComment,
  reportCommunityPost,
  toggleCommunityBookmark,
  toggleCommunityLike,
  updateCommunityComment,
  updateCommunityPost,
} from './communityService.mjs';
import {
  answerLearnQuiz,
  getLearnProgressSnapshot,
  toggleLearnCompleted,
  toggleLearnFavorite,
} from './learnService.mjs';
import {
  addShortComment,
  createShort,
  deleteShort,
  getShortsSnapshot,
  recordShortView,
  saveShortAudioFile,
  saveShortVideoFile,
  serveShortAudioUpload,
  serveShortUpload,
  toggleShortLike,
  updateShort,
} from './shortsService.mjs';
import {
  applySessionRecruitPost,
  createSessionRecruitPost,
  deleteSessionRecruitPost,
  getSessionRecruitSnapshot,
  linkSessionRecruitCollab,
  reviewSessionRecruitApplication,
  setSessionRecruitStatus,
  updateSessionRecruitPost,
} from './sessionRecruitService.mjs';
import {
  createMarketItem,
  deleteMarketItem,
  getMarketSnapshot,
  recordMarketView,
  saveMarketImageFile,
  serveMarketUpload,
  toggleMarketFavorite,
  updateMarketItem,
} from './marketService.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = Number(process.env.COLLAB_PORT || 8788);
const PRESENCE_TIMEOUT_MS = 20_000;
const COMPOSER_LOCK_TIMEOUT_MS = 15_000;
const DEFAULT_COMPOSER_STEPS = 32;
const DEFAULT_COMPOSER_BPM = 100;
const DEFAULT_MELODY_ROWS = 28;
const DEFAULT_DRUM_ROWS = 4;
const DEFAULT_BASS_ROWS = 10;
const MELODY_LENGTH_PRESETS = [1, 2, 4, 8, 16];
const COLLAB_LEGACY_DATA_PATH = join(__dirname, 'collab-data.json');

function getRequestSessionToken(request) {
  const authorization = request.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme?.toLowerCase() === 'bearer' && token) {
    return token.trim();
  }

  return '';
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProjectRecord(project) {
  const hasSnapshot = Boolean(project.snapshot);

  return {
    ...project,
    snapshotRevision:
      typeof project.snapshotRevision === 'number'
        ? project.snapshotRevision
        : hasSnapshot
          ? 1
          : 0,
    snapshotUpdatedByEmail:
      typeof project.snapshotUpdatedByEmail === 'string'
        ? project.snapshotUpdatedByEmail
        : hasSnapshot
          ? project.ownerEmail ?? null
          : null,
    snapshotUpdatedBySessionId:
      typeof project.snapshotUpdatedBySessionId === 'string'
        ? project.snapshotUpdatedBySessionId
        : null,
  };
}

function createSeedState() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return {
    version: now,
    projects: [
      {
        id: 'collab-money-hook',
        title: '머니코드 훅 다듬기',
        summary: '후렴 멜로디와 베이스 움직임을 같이 다듬는 협업 세션입니다.',
        genre: 'Pop',
        bpm: 124,
        steps: 32,
        status: 'working',
        createdAt: now - 6 * day,
        updatedAt: now - 3 * 60 * 60 * 1000,
        ownerEmail: 'muse@example.com',
        ownerName: 'muse',
        sourceProjectId: null,
        snapshotRevision: 0,
        snapshotUpdatedByEmail: null,
        snapshotUpdatedBySessionId: null,
        members: [
          {
            email: 'muse@example.com',
            name: 'muse',
            role: 'owner',
            joinedAt: now - 6 * day,
          },
          {
            email: 'groove@example.com',
            name: 'groove',
            role: 'editor',
            joinedAt: now - 5 * day,
          },
        ],
        tags: ['hook', 'money-code', 'topline'],
      },
      {
        id: 'collab-lofi-night',
        title: 'Lo-fi 야간 세션',
        summary: '드럼 텍스처와 코드 패드를 더 부드럽게 만드는 피드백 단계입니다.',
        genre: 'Lo-fi',
        bpm: 88,
        steps: 32,
        status: 'feedback',
        createdAt: now - 10 * day,
        updatedAt: now - 8 * 60 * 60 * 1000,
        ownerEmail: 'nightowl@example.com',
        ownerName: 'nightowl',
        sourceProjectId: null,
        snapshotRevision: 0,
        snapshotUpdatedByEmail: null,
        snapshotUpdatedBySessionId: null,
        members: [
          {
            email: 'nightowl@example.com',
            name: 'nightowl',
            role: 'owner',
            joinedAt: now - 10 * day,
          },
          {
            email: 'pianofox@example.com',
            name: 'pianofox',
            role: 'editor',
            joinedAt: now - 9 * day,
          },
          {
            email: 'mixbear@example.com',
            name: 'mixbear',
            role: 'viewer',
            joinedAt: now - 7 * day,
          },
        ],
        tags: ['lofi', 'mix', 'feedback'],
      },
    ],
    messages: [
      {
        id: 'collab-message-1',
        projectId: 'collab-money-hook',
        authorEmail: 'muse@example.com',
        authorName: 'muse',
        content: '후렴 첫 박 멜로디 길이를 조금 더 길게 늘려보면 좋겠어요.',
        createdAt: now - 2 * 60 * 60 * 1000,
      },
      {
        id: 'collab-message-2',
        projectId: 'collab-money-hook',
        authorEmail: 'groove@example.com',
        authorName: 'groove',
        content: '베이스는 2마디째만 한 단계 내려가게 테스트해볼게요.',
        createdAt: now - 80 * 60 * 1000,
      },
      {
        id: 'collab-message-3',
        projectId: 'collab-lofi-night',
        authorEmail: 'mixbear@example.com',
        authorName: 'mixbear',
        content: '킥이 조금 센 편이라 버스 컴프 전에 볼륨만 살짝 줄이면 좋겠습니다.',
        createdAt: now - 5 * 60 * 60 * 1000,
      },
    ],
    tasks: [
      {
        id: 'collab-task-1',
        projectId: 'collab-money-hook',
        content: '후렴 멜로디 길이 다시 정리',
        completed: false,
        assigneeName: 'muse',
        createdAt: now - day,
      },
      {
        id: 'collab-task-2',
        projectId: 'collab-money-hook',
        content: '베이스 루트 2안 비교',
        completed: true,
        assigneeName: 'groove',
        createdAt: now - day,
      },
      {
        id: 'collab-task-3',
        projectId: 'collab-lofi-night',
        content: '킥 레벨 미세조정',
        completed: false,
        assigneeName: 'mixbear',
        createdAt: now - 2 * day,
      },
    ],
  };
}

async function loadLegacyState() {
  return await loadSqlState('collab', createSeedState, {
    legacyFilePath: COLLAB_LEGACY_DATA_PATH,
    normalize: (parsed) => ({
      version: parsed.version || Date.now(),
      projects: (parsed.projects || []).map(normalizeProjectRecord),
      messages: parsed.messages || [],
      tasks: parsed.tasks || [],
    }),
  });
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadCollabMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

let state = await loadState();
let presenceByProject = {};
let composerLocksByProject = {};
let composerHistoryByProject = {};
const clients = new Set();
const messageClientsByOwner = new Map();

function saveState() {
  if (getSqlDriver() === 'mysql') {
    saveCollabMysqlState(state);
    return;
  }

  saveSqlState('collab', state);
}

function createSnapshot() {
  return {
    version: state.version,
    projects: state.projects,
    messages: state.messages,
    tasks: state.tasks,
    presenceByProject,
    composerLocksByProject,
    composerHistoryByProject,
  };
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

function writeNoContent(response) {
  response.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  response.end();
}

function createServerError(statusCode, message, payload = undefined) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (payload) {
    error.payload = payload;
  }
  return error;
}

function broadcastSnapshot() {
  const payload = `event: snapshot\ndata: ${JSON.stringify(createSnapshot())}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}

function broadcastMessageSnapshot(ownerEmail) {
  const clients = messageClientsByOwner.get(ownerEmail);
  if (!clients?.size) {
    return;
  }

  const payload = `event: snapshot\ndata: ${JSON.stringify(
    getMessagesBootstrap({
      ownerEmail,
      ownerName: ownerEmail,
    })
  )}\n\n`;

  for (const client of clients) {
    client.write(payload);
  }
}

function prunePresence() {
  const now = Date.now();
  let changed = false;
  const nextPresence = {};

  for (const [projectId, entries] of Object.entries(presenceByProject)) {
    const liveEntries = entries.filter((entry) => now - entry.lastSeenAt <= PRESENCE_TIMEOUT_MS);
    if (liveEntries.length) {
      nextPresence[projectId] = liveEntries;
    }
    if (liveEntries.length !== entries.length) {
      changed = true;
    }
  }

  if (changed) {
    presenceByProject = nextPresence;
    broadcastSnapshot();
  }
}

function pruneComposerLocks() {
  const now = Date.now();
  let changed = false;
  const nextLocksByProject = {};

  for (const [projectId, entries] of Object.entries(composerLocksByProject)) {
    const liveEntries = entries.filter((entry) => now < entry.expiresAt);
    if (liveEntries.length) {
      nextLocksByProject[projectId] = liveEntries;
    }

    if (liveEntries.length !== entries.length) {
      changed = true;
    }
  }

  if (changed) {
    composerLocksByProject = nextLocksByProject;
  }

  return changed;
}

setInterval(prunePresence, 5_000);
setInterval(() => {
  if (pruneComposerLocks()) {
    broadcastSnapshot();
  }
}, 4_000);

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function readBuffer(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function maybeRequireSession(request, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (
    !normalizedEmail ||
    normalizedEmail === 'guest' ||
    normalizedEmail.endsWith('@songmaker.local')
  ) {
    return null;
  }

  return requireSessionUser(getRequestSessionToken(request), normalizedEmail);
}

function touchProject(projectId) {
  state = {
    ...state,
    version: Date.now(),
    projects: state.projects.map((project) =>
      project.id === projectId ? { ...project, updatedAt: Date.now() } : project
    ),
  };
}

function createEmptyMatrix(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => false));
}

function createEmptyLengthMatrix(rows, cols) {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
}

function clampVolume(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value) || 0)));
}

function normalizeMatrix(matrix, rows, cols) {
  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: cols }, (_, colIndex) => Boolean(matrix?.[rowIndex]?.[colIndex]))
  );
}

function normalizeLengthMatrix(matrix, rows, cols) {
  return Array.from({ length: rows }, (_, rowIndex) =>
    Array.from({ length: cols }, (_, colIndex) => {
      const value = Number(matrix?.[rowIndex]?.[colIndex] || 0);
      return value > 0 ? Math.floor(value) : 0;
    })
  );
}

function getMatrixRowCount(matrix, fallback) {
  return Math.max(fallback, Array.isArray(matrix) ? matrix.length : 0);
}

function ensureComposerSnapshot(project) {
  const snapshot = project.snapshot || {};
  if (isVersionTwoComposerSnapshot(snapshot)) {
    return cloneVersionTwoComposerSnapshot(snapshot);
  }

  const steps = Math.max(
    1,
    Math.floor(Number(snapshot.steps || project.steps || DEFAULT_COMPOSER_STEPS))
  );
  const melodyRows = getMatrixRowCount(snapshot.melody, DEFAULT_MELODY_ROWS);
  const drumRows = getMatrixRowCount(snapshot.drums, DEFAULT_DRUM_ROWS);
  const bassRows = getMatrixRowCount(snapshot.bass, DEFAULT_BASS_ROWS);

  return {
    version: 1,
    bpm: Math.max(1, Math.floor(Number(snapshot.bpm || project.bpm || DEFAULT_COMPOSER_BPM))),
    steps,
    volumes: {
      melody: clampVolume(snapshot.volumes?.melody ?? 82),
      drums: clampVolume(snapshot.volumes?.drums ?? 78),
      bass: clampVolume(snapshot.volumes?.bass ?? 84),
    },
    melody: normalizeMatrix(snapshot.melody, melodyRows, steps),
    melodyLengths: normalizeLengthMatrix(snapshot.melodyLengths, melodyRows, steps),
    drums: normalizeMatrix(snapshot.drums, drumRows, steps),
    bass: normalizeMatrix(snapshot.bass, bassRows, steps),
  };
}

function findMelodyNoteAt(melodyRow, melodyLengthRow, col) {
  for (let start = 0; start <= col; start += 1) {
    if (!melodyRow?.[start]) {
      continue;
    }

    const length = Math.max(1, melodyLengthRow?.[start] ?? 1);
    if (col < start + length) {
      return { start, length };
    }
  }

  return null;
}

function clearMelodyNote(melodyRow, melodyLengthRow, start) {
  if (!melodyRow || !melodyLengthRow || start < 0 || start >= melodyRow.length) {
    return;
  }

  melodyRow[start] = false;
  melodyLengthRow[start] = 0;
}

function rangesOverlap(startA, lengthA, startB, lengthB) {
  return startA < startB + lengthB && startB < startA + lengthA;
}

function snapMelodyLength(length, maxLength) {
  const safeMaxLength = Math.max(1, Math.floor(maxLength));
  const safeLength = Math.max(1, Math.floor(length));
  const allowedPresets = MELODY_LENGTH_PRESETS.filter((preset) => preset <= safeMaxLength);
  const fallbackPreset = allowedPresets[allowedPresets.length - 1] ?? 1;

  return allowedPresets.reduce((closest, preset) => {
    const presetDistance = Math.abs(preset - safeLength);
    const closestDistance = Math.abs(closest - safeLength);

    if (presetDistance < closestDistance) {
      return preset;
    }

    if (presetDistance === closestDistance && preset > closest) {
      return preset;
    }

    return closest;
  }, fallbackPreset);
}

function getComposerLockKey(instrument, barIndex) {
  return `${instrument}:${barIndex}`;
}

function findComposerLock(projectId, instrument, barIndex) {
  pruneComposerLocks();

  return (composerLocksByProject[projectId] || []).find(
    (entry) => entry.instrument === instrument && entry.barIndex === barIndex
  );
}

function appendComposerHistory(projectId, entry) {
  const currentEntries = composerHistoryByProject[projectId] || [];
  composerHistoryByProject = {
    ...composerHistoryByProject,
    [projectId]: [entry, ...currentEntries].slice(0, 24),
  };
}

function getInstrumentLabel(instrument) {
  if (instrument === 'melody') {
    return '멜로디';
  }

  if (instrument === 'drums') {
    return '드럼';
  }

  if (instrument === 'bass') {
    return '베이스';
  }

  return '작곡';
}

function ensureComposerLockOwner(projectId, instrument, barIndex, sessionId) {
  if (barIndex == null || !instrument) {
    return;
  }

  const existingLock = findComposerLock(projectId, instrument, barIndex);
  if (!existingLock || existingLock.sessionId === sessionId) {
    return;
  }

  throw createServerError(
    409,
    `${getInstrumentLabel(instrument)} ${barIndex + 1}마디는 ${existingLock.name} 님이 편집 중입니다.`,
    {
      conflict: true,
      revision:
        state.projects.find((entry) => entry.id === projectId)?.snapshotRevision ?? 0,
      snapshot: createSnapshot(),
      lock: existingLock,
    }
  );
}

function isVersionTwoComposerSnapshot(snapshot) {
  return snapshot?.version === 2 && snapshot.tracks && typeof snapshot.tracks === 'object';
}

function cloneVersionTwoComposerSnapshot(snapshot) {
  return {
    ...snapshot,
    volumes: { ...(snapshot.volumes || {}) },
    tracks: Object.fromEntries(
      Object.entries(snapshot.tracks || {}).map(([key, events]) => [
        key,
        Array.isArray(events) ? events.map((event) => ({ ...event })) : [],
      ])
    ),
    extraTracks: Array.isArray(snapshot.extraTracks)
      ? snapshot.extraTracks.map((track) => ({
          ...track,
          events: Array.isArray(track.events) ? track.events.map((event) => ({ ...event })) : [],
        }))
      : [],
  };
}

function updateVersionTwoEvents(events, { note, col, duration, active }) {
  if (!note || !Number.isFinite(col)) return events;

  const start = Math.max(0, Math.floor(Number(col)));
  const length = Math.max(1, Math.floor(Number(duration) || 1));
  const nextEvents = events.filter((event) => {
    if (event.note !== note) return true;
    const eventStart = Math.max(0, Math.floor(Number(event.start) || 0));
    const eventLength = Math.max(1, Math.floor(Number(event.duration) || 1));
    return active
      ? !rangesOverlap(eventStart, eventLength, start, length)
      : !(start >= eventStart && start < eventStart + eventLength);
  });

  if (active) nextEvents.push({ note, start, duration: length });
  nextEvents.sort((left, right) => Number(left.start) - Number(right.start));
  return nextEvents;
}

function getVersionTwoEventTarget(snapshot, instrument, trackId) {
  if (trackId) {
    const track = snapshot.extraTracks.find((entry) => entry.id === trackId);
    return track ? { owner: track, key: 'events' } : null;
  }

  const key = instrument === 'drum' ? 'drums' : instrument;
  return Array.isArray(snapshot.tracks[key]) ? { owner: snapshot.tracks, key } : null;
}

function applyVersionTwoComposerOperation(snapshot, operation) {
  const nextSnapshot = cloneVersionTwoComposerSnapshot(snapshot);
  const updateTarget = (instrument, trackId, note, active, duration = 1) => {
    const target = getVersionTwoEventTarget(nextSnapshot, instrument, trackId);
    if (!target) return;
    target.owner[target.key] = updateVersionTwoEvents(target.owner[target.key], {
      note,
      col: Number(operation.col),
      duration,
      active,
    });
  };

  if (operation.type === 'set-volume') {
    nextSnapshot.volumes[operation.instrument] = clampVolume(operation.volume);
    return { snapshot: nextSnapshot, summary: `${getInstrumentLabel(operation.instrument)} 볼륨을 조절했습니다.` };
  }

  if (operation.type === 'set-melody-note') {
    updateTarget('melody', undefined, operation.note, Number(operation.length) > 0, operation.length);
    return { snapshot: nextSnapshot, summary: `${operation.barIndex + 1}마디 멜로디 노트를 수정했습니다.` };
  }

  if (operation.type === 'apply-chord' || operation.type === 'set-track-chord') {
    const instrument = operation.type === 'apply-chord'
      ? operation.isBass ? 'bass' : 'melody'
      : operation.instrument;
    const trackId = operation.type === 'set-track-chord' ? operation.trackId : undefined;
    for (const note of operation.notes || []) {
      updateTarget(instrument, trackId, note, true, operation.length);
    }
    return { snapshot: nextSnapshot, summary: `${operation.barIndex + 1}마디에 ${operation.chord} 코드를 적용했습니다.` };
  }

  if (operation.type === 'set-track-note') {
    updateTarget(operation.instrument, operation.trackId, operation.note, Boolean(operation.nextValue), operation.length);
    return { snapshot: nextSnapshot, summary: `${operation.barIndex + 1}마디 노트를 수정했습니다.` };
  }

  const toggleInstrumentByType = {
    'toggle-violin-step': 'violin',
    'toggle-saxophone-step': 'saxophone',
    'toggle-guitar-step': 'guitar',
    'toggle-drum-step': 'drums',
    'toggle-bass-step': 'bass',
  };
  const instrument = toggleInstrumentByType[operation.type];
  if (instrument) {
    updateTarget(instrument, undefined, operation.note, Boolean(operation.nextValue), operation.length);
    return { snapshot: nextSnapshot, summary: `${operation.barIndex + 1}마디 노트를 수정했습니다.` };
  }

  return { snapshot: nextSnapshot, summary: '작곡 설정을 변경했습니다.' };
}

function applyComposerOperationToSnapshot(snapshot, operation) {
  if (isVersionTwoComposerSnapshot(snapshot)) {
    return applyVersionTwoComposerOperation(snapshot, operation);
  }

  const nextSnapshot = {
    ...snapshot,
    volumes: {
      melody: clampVolume(snapshot.volumes?.melody ?? 82),
      drums: clampVolume(snapshot.volumes?.drums ?? 78),
      bass: clampVolume(snapshot.volumes?.bass ?? 84),
    },
    melody: snapshot.melody.map((row) => [...row]),
    melodyLengths: snapshot.melodyLengths.map((row) => [...row]),
    drums: snapshot.drums.map((row) => [...row]),
    bass: snapshot.bass.map((row) => [...row]),
  };

  if (operation.type === 'set-melody-note') {
    const row = Number(operation.row);
    const col = Number(operation.col);
    if (!nextSnapshot.melody[row] || col < 0 || col >= nextSnapshot.steps) {
      return { snapshot: nextSnapshot, summary: '멜로디 변경' };
    }

    const melodyRow = nextSnapshot.melody[row];
    const melodyLengthRow = nextSnapshot.melodyLengths[row];
    const existingNote = findMelodyNoteAt(melodyRow, melodyLengthRow, col);
    const requestedLength = Math.floor(Number(operation.length) || 0);

    if (requestedLength <= 0) {
      if (existingNote) {
        clearMelodyNote(melodyRow, melodyLengthRow, existingNote.start);
      } else if (melodyRow[col]) {
        clearMelodyNote(melodyRow, melodyLengthRow, col);
      }

      return {
        snapshot: nextSnapshot,
        summary: `${operation.barIndex + 1}마디 멜로디 노트를 지웠습니다.`,
      };
    }

    const nextLength = snapMelodyLength(requestedLength, nextSnapshot.steps - col);

    if (existingNote) {
      clearMelodyNote(melodyRow, melodyLengthRow, existingNote.start);
    }

    for (let start = 0; start < nextSnapshot.steps; start += 1) {
      if (!melodyRow[start]) {
        continue;
      }

      const noteLength = melodyLengthRow[start] ?? 1;
      if (rangesOverlap(start, noteLength, col, nextLength)) {
        clearMelodyNote(melodyRow, melodyLengthRow, start);
      }
    }

    melodyRow[col] = true;
    melodyLengthRow[col] = nextLength;

    return {
      snapshot: nextSnapshot,
      summary: `${operation.barIndex + 1}마디 멜로디 길이를 ${nextLength}칸으로 맞췄습니다.`,
    };
  }

  if (operation.type === 'toggle-drum-step') {
    const row = Number(operation.row);
    const col = Number(operation.col);
    if (nextSnapshot.drums[row] && col >= 0 && col < nextSnapshot.steps) {
      nextSnapshot.drums[row][col] = Boolean(operation.nextValue);
    }

    return {
      snapshot: nextSnapshot,
      summary: `${operation.barIndex + 1}마디 드럼 스텝을 ${
        operation.nextValue ? '추가' : '해제'
      }했습니다.`,
    };
  }

  if (operation.type === 'toggle-bass-step') {
    const row = Number(operation.row);
    const col = Number(operation.col);
    if (nextSnapshot.bass[row] && col >= 0 && col < nextSnapshot.steps) {
      nextSnapshot.bass[row][col] = Boolean(operation.nextValue);
    }

    return {
      snapshot: nextSnapshot,
      summary: `${operation.barIndex + 1}마디 베이스 스텝을 ${
        operation.nextValue ? '추가' : '해제'
      }했습니다.`,
    };
  }

  if (operation.type === 'apply-chord') {
    const col = Number(operation.col);
    const targetGrid = operation.isBass ? nextSnapshot.bass : nextSnapshot.melody;
    const targetLengths = nextSnapshot.melodyLengths;

    for (const row of operation.rows || []) {
      if (!targetGrid[row] || col < 0 || col >= nextSnapshot.steps) {
        continue;
      }

      if (!operation.isBass) {
        const existingNote = findMelodyNoteAt(targetGrid[row], targetLengths[row], col);
        if (existingNote) {
          clearMelodyNote(targetGrid[row], targetLengths[row], existingNote.start);
        }
      }

      targetGrid[row][col] = true;
      if (!operation.isBass) {
        targetLengths[row][col] = 1;
      }
    }

    return {
      snapshot: nextSnapshot,
      summary: `${operation.barIndex + 1}마디에 ${operation.chord} 코드를 올렸습니다.`,
    };
  }

  if (operation.type === 'set-volume') {
    nextSnapshot.volumes[operation.instrument] = clampVolume(operation.volume);

    return {
      snapshot: nextSnapshot,
      summary: `${getInstrumentLabel(operation.instrument)} 볼륨을 조절했습니다.`,
    };
  }

  return { snapshot: nextSnapshot, summary: '작곡 설정을 바꿨습니다.' };
}

function handleCreateProject(payload) {
  const existingProject = state.projects.find(
    (project) =>
      project.sourceProjectId === payload.sourceProjectId &&
      project.ownerEmail === payload.ownerEmail
  );

  if (existingProject) {
    return existingProject.id;
  }

  const timestamp = Date.now();
  const projectId = createId('collab');

  state = {
    version: timestamp,
    projects: [
      {
        id: projectId,
        title: payload.title,
        summary: payload.summary || '작곡 프로젝트를 협업 작업실로 옮겼습니다.',
        genre: payload.genre || '미정',
        bpm: payload.bpm,
        steps: payload.steps,
        status: 'planning',
        createdAt: timestamp,
        updatedAt: timestamp,
        ownerEmail: payload.ownerEmail,
        ownerName: payload.ownerName,
        sourceProjectId: payload.sourceProjectId,
        snapshot: payload.snapshot,
        snapshotRevision: payload.snapshot ? 1 : 0,
        snapshotUpdatedByEmail: payload.snapshot ? payload.ownerEmail : null,
        snapshotUpdatedBySessionId: payload.snapshot ? payload.sessionId ?? null : null,
        members: [
          {
            email: payload.ownerEmail,
            name: payload.ownerName,
            role: 'owner',
            joinedAt: timestamp,
            color: payload.color,
          },
        ],
        tags: ['new-collab', payload.genre || 'draft'],
        noteColors: {},
        noteAuthors: {},
      },
      ...state.projects,
    ],
    messages: [
      {
        id: createId('collab-message'),
        projectId,
        authorEmail: payload.ownerEmail,
        authorName: payload.ownerName,
        content: '협업 작업실이 시작됐어요. 수정 방향을 같이 적어보세요.',
        createdAt: timestamp,
      },
      ...state.messages,
    ],
    tasks: state.tasks,
  };

  saveState();
  broadcastSnapshot();
  return projectId;
}

function handleUpdateComposerSnapshot(projectId, payload) {
  const timestamp = Date.now();
  const project = state.projects.find((entry) => entry.id === projectId);

  if (!project) {
    throw createServerError(404, '협업 프로젝트를 찾을 수 없습니다.');
  }

  const currentRevision = project.snapshotRevision || 0;
  const hasBaseRevision = Number.isFinite(payload.baseRevision);
  const baseRevision = hasBaseRevision ? Number(payload.baseRevision) : currentRevision;
  const isSameSession =
    Boolean(payload.sessionId) && project.snapshotUpdatedBySessionId === payload.sessionId;

  if (baseRevision !== currentRevision && !isSameSession) {
    throw createServerError(
      409,
      '다른 사용자의 최신 편집이 먼저 저장되어 현재 작업과 충돌했습니다.',
      {
        conflict: true,
        revision: currentRevision,
        snapshot: createSnapshot(),
      }
    );
  }

  const revision = currentRevision + 1;

  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((entry) =>
      entry.id === projectId
        ? {
            ...entry,
            bpm: payload.snapshot?.bpm ?? entry.bpm,
            steps: payload.snapshot?.steps ?? entry.steps,
            snapshot: payload.snapshot,
            snapshotRevision: revision,
            snapshotUpdatedByEmail: payload.email ?? null,
            snapshotUpdatedBySessionId: payload.sessionId ?? null,
            updatedAt: timestamp,
          }
        : entry
    ),
  };

  saveState();
  broadcastSnapshot();
  return revision;
}

function handleSetComposerLock(projectId, payload) {
  const instrument = String(payload.instrument || '');
  const barIndex = Math.max(0, Math.floor(Number(payload.barIndex) || 0));
  const sessionId = String(payload.sessionId || '').trim();

  if (!sessionId || !instrument) {
    throw createServerError(400, '잠금 요청 정보가 올바르지 않습니다.');
  }

  pruneComposerLocks();

  const currentLocks = composerLocksByProject[projectId] || [];
  const lockKey = getComposerLockKey(instrument, barIndex);
  const conflictingLock = currentLocks.find(
    (entry) =>
      getComposerLockKey(entry.instrument, entry.barIndex) === lockKey &&
      entry.sessionId !== sessionId
  );

  if (payload.lock && conflictingLock) {
    throw createServerError(
      409,
      `${getInstrumentLabel(instrument)} ${barIndex + 1}마디는 ${conflictingLock.name} 님이 편집 중입니다.`,
      {
        conflict: true,
        snapshot: createSnapshot(),
        lock: conflictingLock,
      }
    );
  }

  const filteredLocks = currentLocks.filter(
    (entry) =>
      !(
        entry.sessionId === sessionId &&
        entry.instrument === instrument &&
        entry.barIndex === barIndex
      )
  );

  if (payload.lock) {
    filteredLocks.push({
      projectId,
      instrument,
      barIndex,
      sessionId,
      email: payload.email ?? 'guest@songmaker.local',
      name: payload.name ?? 'guest',
      lockedAt: Date.now(),
      expiresAt: Date.now() + COMPOSER_LOCK_TIMEOUT_MS,
    });
  }

  composerLocksByProject = {
    ...composerLocksByProject,
    [projectId]: filteredLocks,
  };

  if (!filteredLocks.length) {
    const nextLocks = { ...composerLocksByProject };
    delete nextLocks[projectId];
    composerLocksByProject = nextLocks;
  }

  broadcastSnapshot();
}

function handleApplyComposerOperation(projectId, payload) {
  const timestamp = Date.now();
  const project = state.projects.find((entry) => entry.id === projectId);

  if (!project) {
    throw createServerError(404, '협업 프로젝트를 찾을 수 없습니다.');
  }

  const currentRevision = project.snapshotRevision || 0;
  const hasBaseRevision = Number.isFinite(payload.baseRevision);
  const baseRevision = hasBaseRevision ? Number(payload.baseRevision) : currentRevision;
  const isSameSession =
    Boolean(payload.sessionId) && project.snapshotUpdatedBySessionId === payload.sessionId;

  if (baseRevision !== currentRevision && !isSameSession) {
    throw createServerError(
      409,
      '다른 사용자의 최신 편집이 먼저 반영되어 현재 작업과 충돌했습니다.',
      {
        conflict: true,
        revision: currentRevision,
        snapshot: createSnapshot(),
      }
    );
  }

  const operation = payload.operation || {};
  const targetInstrument =
    operation.type === 'toggle-drum-step'
      ? 'drums'
      : operation.type === 'toggle-bass-step'
        ? 'bass'
        : operation.type === 'set-melody-note' || operation.type === 'apply-chord'
          ? operation.isBass
            ? 'bass'
            : 'melody'
          : operation.type === 'set-volume'
            ? operation.instrument
            : null;
  const requiresLock =
    (operation.type === 'set-melody-note' ||
      operation.type === 'toggle-drum-step' ||
      operation.type === 'toggle-bass-step' ||
      operation.type === 'apply-chord') &&
    targetInstrument &&
    Number.isFinite(operation.barIndex);

  if (requiresLock) {
    ensureComposerLockOwner(
      projectId,
      targetInstrument,
      Math.floor(Number(operation.barIndex)),
      payload.sessionId
    );
  }

  const currentSnapshot = ensureComposerSnapshot(project);
  const { snapshot: nextSnapshot, summary } = applyComposerOperationToSnapshot(
    currentSnapshot,
    operation
  );
  const revision = currentRevision + 1;
  const noteColors = { ...(project.noteColors || {}) };
  const noteAuthors = { ...(project.noteAuthors || {}) };
  const authorEmail = String(payload.email || 'guest@songmaker.local').trim().toLowerCase();
  const authorColor = payload.color || '#14b88f';
  const setNoteAuthor = (instrument, row, col, active, trackId) => {
    const key = `${trackId || instrument}:${row}:${col}`;
    if (active) {
      noteColors[key] = authorColor;
      noteAuthors[key] = authorEmail;
    } else {
      delete noteColors[key];
      delete noteAuthors[key];
    }
  };

  if (operation.type === 'set-melody-note') {
    setNoteAuthor('melody', operation.row, operation.col, Number(operation.length) > 0);
  } else if (operation.type === 'apply-chord') {
    for (const row of operation.rows || []) {
      setNoteAuthor(operation.isBass ? 'bass' : 'melody', row, operation.col, true);
    }
  } else if (operation.type === 'set-track-note') {
    setNoteAuthor(
      operation.instrument,
      operation.row,
      operation.col,
      Boolean(operation.nextValue),
      operation.trackId
    );
  } else if (operation.type === 'set-track-chord') {
    for (const row of operation.rows || []) {
      setNoteAuthor(operation.instrument, row, operation.col, true, operation.trackId);
    }
  } else if (operation.type?.startsWith('toggle-') && operation.type?.endsWith('-step')) {
    const rawInstrument = operation.type.replace('toggle-', '').replace('-step', '');
    const instrument = rawInstrument === 'drum' ? 'drums' : rawInstrument;
    setNoteAuthor(instrument, operation.row, operation.col, Boolean(operation.nextValue));
  }

  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((entry) =>
      entry.id === projectId
        ? {
            ...entry,
            bpm: nextSnapshot.bpm ?? entry.bpm,
            steps: nextSnapshot.steps ?? entry.steps,
            snapshot: nextSnapshot,
            noteColors,
            noteAuthors,
            snapshotRevision: revision,
            snapshotUpdatedByEmail: payload.email ?? null,
            snapshotUpdatedBySessionId: payload.sessionId ?? null,
            updatedAt: timestamp,
          }
        : entry
    ),
  };

  appendComposerHistory(projectId, {
    id: createId('collab-history'),
    projectId,
    instrument: targetInstrument ?? 'transport',
    barIndex: Number.isFinite(operation.barIndex) ? Math.floor(Number(operation.barIndex)) : null,
    authorEmail: payload.email ?? 'guest@songmaker.local',
    authorName: payload.name ?? 'guest',
    action: operation.type ?? 'update',
    summary,
    createdAt: timestamp,
    revision,
  });

  saveState();
  broadcastSnapshot();
  return revision;
}

function handleJoinProject(projectId, payload) {
  const timestamp = Date.now();
  let joined = false;

  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((project) => {
      if (project.id !== projectId) {
        return project;
      }

      if (project.members.some((member) => member.email === payload.email)) {
        return project;
      }

      joined = true;

      return {
        ...project,
        updatedAt: timestamp,
        members: [
          ...project.members,
          {
            email: payload.email,
            name: payload.name,
            role: 'editor',
            joinedAt: timestamp,
          },
        ],
      };
    }),
    messages: joined
      ? [
          {
            id: createId('collab-message'),
            projectId,
            authorEmail: payload.email,
            authorName: payload.name,
            content: '협업에 참여했어요.',
            createdAt: timestamp,
          },
          ...state.messages,
        ]
      : state.messages,
  };

  if (joined) {
    saveState();
    broadcastSnapshot();
  }

  return joined;
}

function addApprovedRecruitMembers(post) {
  if (!post?.collabProjectId || !Array.isArray(post.applicants)) {
    return;
  }

  post.applicants
    .filter((applicant) => applicant.status === 'approved')
    .forEach((applicant) => {
      handleJoinProject(post.collabProjectId, {
        email: applicant.email,
        name: applicant.name,
      });
    });
}

function handleAddMessage(projectId, payload) {
  const content = String(payload.content || '').trim();
  if (!content) {
    return;
  }

  const timestamp = Date.now();

  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((project) =>
      project.id === projectId ? { ...project, updatedAt: timestamp } : project
    ),
    messages: [
      {
        id: createId('collab-message'),
        projectId,
        authorEmail: payload.email,
        authorName: payload.name,
        content,
        createdAt: timestamp,
      },
      ...state.messages,
    ],
  };

  saveState();
  broadcastSnapshot();
}

function handleAddTask(projectId, payload) {
  const content = String(payload.content || '').trim();
  if (!content) {
    return;
  }

  const timestamp = Date.now();

  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((project) =>
      project.id === projectId ? { ...project, updatedAt: timestamp } : project
    ),
    tasks: [
      {
        id: createId('collab-task'),
        projectId,
        content,
        completed: false,
        assigneeName: String(payload.assigneeName || '').trim() || '담당 미정',
        createdAt: timestamp,
      },
      ...state.tasks,
    ],
  };

  saveState();
  broadcastSnapshot();
}

function handleToggleTask(projectId, taskId) {
  const timestamp = Date.now();

  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((project) =>
      project.id === projectId ? { ...project, updatedAt: timestamp } : project
    ),
    tasks: state.tasks.map((task) =>
      task.id === taskId && task.projectId === projectId
        ? { ...task, completed: !task.completed }
        : task
    ),
  };

  saveState();
  broadcastSnapshot();
}

function handleDeleteTask(projectId, taskId) {
  const taskExists = state.tasks.some(
    (task) => task.id === taskId && task.projectId === projectId
  );
  if (!taskExists) {
    throw createServerError(404, '삭제할 작업을 찾을 수 없습니다.');
  }

  const timestamp = Date.now();
  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((project) =>
      project.id === projectId ? { ...project, updatedAt: timestamp } : project
    ),
    tasks: state.tasks.filter(
      (task) => task.id !== taskId || task.projectId !== projectId
    ),
  };

  saveState();
  broadcastSnapshot();
}

function handleSetStatus(projectId, status) {
  const timestamp = Date.now();

  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((project) =>
      project.id === projectId ? { ...project, status, updatedAt: timestamp } : project
    ),
  };

  saveState();
  broadcastSnapshot();
}

function handleSetMemberColor(projectId, payload) {
  const normalizedEmail = String(payload.email || '').trim().toLowerCase();
  const color = String(payload.color || '').trim();
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) throw createServerError(404, '협업 프로젝트를 찾을 수 없습니다.');
  if (!normalizedEmail || !/^#[0-9a-f]{6}$/i.test(color)) {
    throw createServerError(400, '협업 색상 정보가 올바르지 않습니다.');
  }

  const previousColor = project.members.find(
    (member) => String(member.email || '').trim().toLowerCase() === normalizedEmail
  )?.color;
  const noteColors = { ...(project.noteColors || {}) };
  const noteAuthors = { ...(project.noteAuthors || {}) };
  Object.entries(noteColors).forEach(([key, noteColor]) => {
    const authorEmail = String(noteAuthors[key] || '').trim().toLowerCase();
    if (authorEmail === normalizedEmail || (!authorEmail && previousColor && noteColor === previousColor)) {
      noteColors[key] = color;
      noteAuthors[key] = normalizedEmail;
    }
  });

  const timestamp = Date.now();
  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((entry) =>
      entry.id === projectId
        ? {
            ...entry,
            updatedAt: timestamp,
            members: entry.members.map((member) =>
              String(member.email || '').trim().toLowerCase() === normalizedEmail
                ? { ...member, color }
                : member
            ),
            noteColors,
            noteAuthors,
          }
        : entry
    ),
  };
  saveState();
  broadcastSnapshot();
}

function handleRenameProject(projectId, payload) {
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) throw createServerError(404, '작업실을 찾을 수 없습니다.');
  if (String(project.ownerEmail).trim().toLowerCase() !== String(payload.userEmail).trim().toLowerCase()) {
    throw createServerError(403, '작업실을 만든 사람만 이름을 변경할 수 있습니다.');
  }
  const title = String(payload.title || '').trim();
  if (!title) throw createServerError(400, '작업실 이름을 입력해주세요.');
  const timestamp = Date.now();
  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((entry) =>
      entry.id === projectId ? { ...entry, title, updatedAt: timestamp } : entry
    ),
  };
  saveState();
  broadcastSnapshot();
}

function handleUpdateCollabProject(projectId, payload) {
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) throw createServerError(404, '작업실을 찾을 수 없습니다.');
  if (String(project.ownerEmail).trim().toLowerCase() !== String(payload.userEmail).trim().toLowerCase()) {
    throw createServerError(403, '방장만 작업실 정보를 수정할 수 있습니다.');
  }

  const title = String(payload.title || '').trim();
  if (!title) throw createServerError(400, '작업실 이름을 입력해주세요.');
  const bpm = Math.max(40, Math.min(240, Math.round(Number(payload.bpm) || project.bpm)));
  const timestamp = Date.now();
  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((entry) =>
      entry.id === projectId
        ? {
            ...entry,
            title,
            summary: String(payload.summary || '').trim(),
            genre: String(payload.genre || '').trim(),
            bpm,
            updatedAt: timestamp,
          }
        : entry
    ),
  };
  saveState();
  broadcastSnapshot();
}

function handleManageCollabMember(projectId, payload) {
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) throw createServerError(404, '작업실을 찾을 수 없습니다.');
  const ownerEmail = String(project.ownerEmail).trim().toLowerCase();
  const userEmail = String(payload.userEmail).trim().toLowerCase();
  const memberEmail = String(payload.memberEmail).trim().toLowerCase();
  if (ownerEmail !== userEmail) throw createServerError(403, '방장만 멤버를 관리할 수 있습니다.');
  if (ownerEmail === memberEmail) throw createServerError(400, '방장은 강퇴하거나 권한을 변경할 수 없습니다.');
  if (!project.members.some((member) => String(member.email).trim().toLowerCase() === memberEmail)) {
    throw createServerError(404, '멤버를 찾을 수 없습니다.');
  }

  const action = String(payload.action || '');
  const role = payload.role === 'viewer' ? 'viewer' : 'editor';
  const timestamp = Date.now();
  state = {
    ...state,
    version: timestamp,
    projects: state.projects.map((entry) => {
      if (entry.id !== projectId) return entry;
      return {
        ...entry,
        updatedAt: timestamp,
        members: action === 'remove'
          ? entry.members.filter((member) => String(member.email).trim().toLowerCase() !== memberEmail)
          : entry.members.map((member) =>
              String(member.email).trim().toLowerCase() === memberEmail
                ? { ...member, role }
                : member
            ),
      };
    }),
  };
  saveState();
  broadcastSnapshot();
}

function handleDeleteCollabProject(projectId, payload) {
  const project = state.projects.find((entry) => entry.id === projectId);
  if (!project) throw createServerError(404, '작업실을 찾을 수 없습니다.');
  if (String(project.ownerEmail).trim().toLowerCase() !== String(payload.userEmail).trim().toLowerCase()) {
    throw createServerError(403, '작업실을 만든 사람만 삭제할 수 있습니다.');
  }
  const timestamp = Date.now();
  state = {
    ...state,
    version: timestamp,
    projects: state.projects.filter((entry) => entry.id !== projectId),
    messages: state.messages.filter((entry) => entry.projectId !== projectId),
    tasks: state.tasks.filter((entry) => entry.projectId !== projectId),
  };
  delete presenceByProject[projectId];
  delete composerLocksByProject[projectId];
  delete composerHistoryByProject[projectId];
  saveState();
  broadcastSnapshot();
}

function handlePresencePing(payload) {
  const entry = {
    sessionId: payload.sessionId,
    projectId: payload.projectId,
    email: payload.email,
    name: payload.name,
    color: payload.color,
    focus: payload.focus || undefined,
    cursor:
      payload.x === null || payload.y === null || payload.x === undefined || payload.y === undefined
        ? payload.cursor ?? null
        : {
            x: Math.max(0, Math.min(1, Number(payload.x) || 0)),
            y: Math.max(0, Math.min(1, Number(payload.y) || 0)),
            updatedAt: Date.now(),
          },
    lastSeenAt: Date.now(),
  };

  const currentEntries = presenceByProject[payload.projectId] || [];
  const nextEntries = currentEntries.filter((item) => item.sessionId !== payload.sessionId);
  presenceByProject = {
    ...presenceByProject,
    [payload.projectId]: [...nextEntries, entry],
  };

  broadcastSnapshot();
}

function handlePresenceLeave(payload) {
  const currentEntries = presenceByProject[payload.projectId] || [];
  const nextEntries = currentEntries.filter((item) => item.sessionId !== payload.sessionId);

  if (nextEntries.length) {
    presenceByProject = {
      ...presenceByProject,
      [payload.projectId]: nextEntries,
    };
  } else {
    const nextPresence = { ...presenceByProject };
    delete nextPresence[payload.projectId];
    presenceByProject = nextPresence;
  }

  const currentLocks = composerLocksByProject[payload.projectId] || [];
  const nextLocks = currentLocks.filter((entry) => entry.sessionId !== payload.sessionId);
  if (nextLocks.length) {
    composerLocksByProject = {
      ...composerLocksByProject,
      [payload.projectId]: nextLocks,
    };
  } else if (currentLocks.length) {
    const nextLocksByProject = { ...composerLocksByProject };
    delete nextLocksByProject[payload.projectId];
    composerLocksByProject = nextLocksByProject;
  }

  broadcastSnapshot();
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const pathname = url.pathname;

  if (request.method === 'OPTIONS') {
    writeNoContent(response);
    return;
  }

  if (request.method === 'GET' && pathname === '/health') {
    writeJson(response, 200, { ok: true, port: PORT });
    return;
  }

  if (request.method === 'GET' && pathname === '/api/collab/bootstrap') {
    writeJson(response, 200, createSnapshot());
    return;
  }

  const shortUploadMatch = pathname.match(/^\/uploads\/shorts\/([^/]+)$/);
  if (request.method === 'GET' && shortUploadMatch) {
    const served = serveShortUpload(request, response, decodeURIComponent(shortUploadMatch[1]));
    if (!served) {
      writeJson(response, 404, { error: '업로드한 숏폼 영상을 찾을 수 없습니다.' });
    }
    return;
  }

  const shortAudioUploadMatch = pathname.match(/^\/uploads\/shorts-audio\/([^/]+)$/);
  if (request.method === 'GET' && shortAudioUploadMatch) {
    const served = serveShortAudioUpload(
      request,
      response,
      decodeURIComponent(shortAudioUploadMatch[1])
    );
    if (!served) {
      writeJson(response, 404, { error: '업로드한 숏폼 오디오를 찾을 수 없습니다.' });
    }
    return;
  }

  const musicShareUploadMatch = pathname.match(/^\/uploads\/music-share\/([^/]+)$/);
  if (request.method === 'GET' && musicShareUploadMatch) {
    const served = serveMusicShareUpload(
      request,
      response,
      decodeURIComponent(musicShareUploadMatch[1])
    );
    if (!served) {
      writeJson(response, 404, { error: '???? ?? ?? ???? ?? ? ????.' });
    }
    return;
  }

  const composerVocalUploadMatch = pathname.match(/^\/uploads\/composer-vocals\/([^/]+)$/);
  if (request.method === 'GET' && composerVocalUploadMatch) {
    const served = serveComposerVocalUpload(
      request,
      response,
      decodeURIComponent(composerVocalUploadMatch[1])
    );
    if (!served) {
      writeJson(response, 404, { error: '저장된 AI 보컬 음원을 찾을 수 없습니다.' });
    }
    return;
  }

  const marketUploadMatch = pathname.match(/^\/uploads\/market\/([^/]+)$/);
  if (request.method === 'GET' && marketUploadMatch) {
    const served = serveMarketUpload(request, response, decodeURIComponent(marketUploadMatch[1]));
    if (!served) {
      writeJson(response, 404, { error: '???? ???? ???? ?? ? ????.' });
    }
    return;
  }

  if (request.method === 'GET' && pathname === '/api/profile') {
    try {
      const email = url.searchParams.get('email');
      requireSessionUser(getRequestSessionToken(request), email);
      const user = getUserProfile(email);
      writeJson(response, 200, { user });
    } catch (error) {
      const statusCode = error instanceof AuthServiceError ? error.statusCode : 500;
      writeJson(response, statusCode, {
        error: error instanceof Error ? error.message : '프로필을 불러오지 못했습니다.',
      });
    }
    return;
  }

  if (request.method === 'GET' && pathname === '/api/settings') {
    try {
      const email = url.searchParams.get('email');
      requireSessionUser(getRequestSessionToken(request), email);
      const settings = getSettings(email);
      writeJson(response, 200, { settings });
    } catch (error) {
      const statusCode = error instanceof AuthServiceError ? error.statusCode : 500;
      writeJson(response, statusCode, {
        error: error instanceof Error ? error.message : '설정을 불러오지 못했습니다.',
      });
    }
    return;
  }

  if (request.method === 'GET' && pathname === '/api/messages/bootstrap') {
    try {
      requireSessionUser(
        getRequestSessionToken(request),
        url.searchParams.get('ownerEmail')
      );
      const snapshot = getMessagesBootstrap({
        ownerEmail: url.searchParams.get('ownerEmail'),
        ownerName: url.searchParams.get('ownerName'),
      });
      writeJson(response, 200, snapshot);
    } catch (error) {
      const statusCode = error instanceof AuthServiceError ? error.statusCode : 500;
      writeJson(response, statusCode, {
        error: error instanceof Error ? error.message : '메시지를 불러오지 못했습니다.',
      });
    }
    return;
  }

  if (request.method === 'GET' && pathname === '/api/community/bootstrap') {
    writeJson(response, 200, getCommunitySnapshot());
    return;
  }

  if (request.method === 'GET' && pathname === '/api/learn-progress') {
    try {
      const userKey = url.searchParams.get('userKey') || 'guest';
      maybeRequireSession(request, userKey);
      writeJson(response, 200, getLearnProgressSnapshot(userKey));
    } catch (error) {
      const statusCode = error instanceof AuthServiceError ? error.statusCode : 500;
      writeJson(response, statusCode, {
        error: error instanceof Error ? error.message : '학습 진행도를 불러오지 못했습니다.',
      });
    }
    return;
  }

  if (request.method === 'GET' && pathname === '/api/composer-library') {
    writeJson(response, 200, getComposerLibrarySnapshot());
    return;
  }

  if (request.method === 'GET' && pathname === '/api/music-share') {
    writeJson(response, 200, getMusicShareSnapshot());
    return;
  }

  if (request.method === 'GET' && pathname === '/api/market') {
    writeJson(response, 200, getMarketSnapshot());
    return;
  }

  if (request.method === 'GET' && pathname === '/api/shorts/bootstrap') {
    writeJson(response, 200, getShortsSnapshot());
    return;
  }

  if (request.method === 'GET' && pathname === '/api/sessions/bootstrap') {
    writeJson(response, 200, getSessionRecruitSnapshot());
    return;
  }

  if (request.method === 'GET' && pathname === '/api/messages/stream') {
    try {
      const ownerEmail = url.searchParams.get('ownerEmail');
      const sessionUser = requireSessionUser(
        url.searchParams.get('sessionToken'),
        ownerEmail
      );

      response.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const ownerClients = messageClientsByOwner.get(sessionUser.email) ?? new Set();
      ownerClients.add(response);
      messageClientsByOwner.set(sessionUser.email, ownerClients);

      response.write(
        `event: snapshot\ndata: ${JSON.stringify(
          getMessagesBootstrap({
            ownerEmail: sessionUser.email,
            ownerName: sessionUser.name,
          })
        )}\n\n`
      );

      const heartbeat = setInterval(() => {
        response.write(`event: ping\ndata: ${Date.now()}\n\n`);
      }, 15000);

      request.on('close', () => {
        clearInterval(heartbeat);
        const nextClients = messageClientsByOwner.get(sessionUser.email);
        nextClients?.delete(response);
        if (!nextClients?.size) {
          messageClientsByOwner.delete(sessionUser.email);
        }
      });
    } catch (error) {
      writeJson(response, error instanceof AuthServiceError ? error.statusCode : 500, {
        error: error instanceof Error ? error.message : '메시지 실시간 연결에 실패했습니다.',
      });
    }
    return;
  }

  if (request.method === 'GET' && pathname === '/api/collab/stream') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    response.write(`event: snapshot\ndata: ${JSON.stringify(createSnapshot())}\n\n`);
    const heartbeat = setInterval(() => {
      response.write(`event: ping\ndata: ${Date.now()}\n\n`);
    }, 15_000);

    clients.add(response);
    request.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(response);
    });
    return;
  }

  try {
    if (request.method === 'POST' && pathname === '/api/auth/signup') {
      const body = await readBody(request);
      const result = signupUser({
        email: body.email,
        password: body.password,
        name: body.name,
      });
      writeJson(response, 201, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readBody(request);
      const result = loginUser({
        email: body.email,
        password: body.password,
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'GET' && pathname === '/api/auth/session') {
      const result = restoreUserSession({
        sessionToken: getRequestSessionToken(request),
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/auth/logout') {
      const result = logoutUserSession({
        sessionToken: getRequestSessionToken(request),
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/auth/forgot-password') {
      const body = await readBody(request);
      const result = requestPasswordReset({
        email: body.email,
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/profile/update') {
      const body = await readBody(request);
      requireSessionUser(getRequestSessionToken(request), body.email);
      const user = updateUserProfile({
        email: body.email,
        name: body.name,
      });
      writeJson(response, 200, { user });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/profile/avatar') {
      const body = await readBody(request);
      requireSessionUser(getRequestSessionToken(request), body.email);
      const user = updateUserAvatar({
        email: body.email,
        avatarUrl: body.avatarUrl,
      });
      writeJson(response, 200, { user });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/settings/update') {
      const body = await readBody(request);
      requireSessionUser(getRequestSessionToken(request), body.email);
      const settings = updateSettings({
        email: body.email,
        patch: body.patch,
      });
      writeJson(response, 200, { settings });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/messages/friends') {
      const body = await readBody(request);
      requireSessionUser(getRequestSessionToken(request), body.ownerEmail);
      const snapshot = addFriend(body);
      broadcastMessageSnapshot(body.ownerEmail);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/messages/friends/remove') {
      const body = await readBody(request);
      requireSessionUser(getRequestSessionToken(request), body.ownerEmail);
      const snapshot = removeFriend(body);
      broadcastMessageSnapshot(body.ownerEmail);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/messages/threads/direct') {
      const body = await readBody(request);
      requireSessionUser(getRequestSessionToken(request), body.ownerEmail);
      const result = createDirectThread(body);
      broadcastMessageSnapshot(body.ownerEmail);
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/messages/threads/group') {
      const body = await readBody(request);
      requireSessionUser(getRequestSessionToken(request), body.ownerEmail);
      const result = createGroupThread(body);
      broadcastMessageSnapshot(body.ownerEmail);
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/community/posts') {
      const body = await readBody(request);
      maybeRequireSession(request, body.authorEmail);
      const result = createCommunityPost(body);
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/learn-progress/completed') {
      const body = await readBody(request);
      maybeRequireSession(request, body.userKey);
      const snapshot = toggleLearnCompleted(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/learn-progress/favorite') {
      const body = await readBody(request);
      maybeRequireSession(request, body.userKey);
      const snapshot = toggleLearnFavorite(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/learn-progress/answer') {
      const body = await readBody(request);
      maybeRequireSession(request, body.userKey);
      const snapshot = answerLearnQuiz(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/composer-library/projects/save') {
      const body = await readBody(request);
      maybeRequireSession(request, body.creatorEmail);
      const result = saveComposerProject(body);
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/composer-library/projects/share') {
      const body = await readBody(request);
      maybeRequireSession(request, body.creatorEmail);
      const result = shareComposerProject(body);
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/music-share/upload') {
      const fileName = url.searchParams.get('fileName') || 'music-share-cover.jpg';
      const creatorEmail =
        url.searchParams.get('creatorEmail') || url.searchParams.get('email');
      maybeRequireSession(request, creatorEmail);
      const buffer = await readBuffer(request);
      const result = saveMusicShareImageFile({
        buffer,
        fileName,
        baseUrl: `http://${request.headers.host}`,
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/music-share/audio-upload') {
      const fileName = url.searchParams.get('fileName') || 'shared-track.mp3';
      const creatorEmail =
        url.searchParams.get('creatorEmail') || url.searchParams.get('email');
      maybeRequireSession(request, creatorEmail);
      const buffer = await readBuffer(request);
      const result = saveMusicShareAudioFile({
        buffer,
        fileName,
        baseUrl: `http://${request.headers.host}`,
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/composer/vocal-upload') {
      const fileName = url.searchParams.get('fileName') || 'ai-vocal.wav';
      const creatorEmail =
        url.searchParams.get('creatorEmail') || url.searchParams.get('email');
      maybeRequireSession(request, creatorEmail);
      const buffer = await readBuffer(request);
      const result = saveComposerVocalAudioFile({
        buffer,
        fileName,
        baseUrl: `http://${request.headers.host}`,
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/composer-library/favorites/toggle') {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = toggleFavoriteTrack(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/music-share/like') {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = toggleTrackLike(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/music-share/comments') {
      const body = await readBody(request);
      maybeRequireSession(request, body.authorEmail);
      const snapshot = addTrackComment(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/music-share/view') {
      const body = await readBody(request);
      const snapshot = recordTrackView(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/music-share/download') {
      const body = await readBody(request);
      const snapshot = recordTrackDownload(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/music-share/open') {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = recordTrackOpen(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    const musicShareUpdateMatch = pathname.match(/^\/api\/music-share\/tracks\/([^/]+)\/update$/);
    if (request.method === 'POST' && musicShareUpdateMatch) {
      const body = await readBody(request);
      body.trackId = decodeURIComponent(musicShareUpdateMatch[1]);
      maybeRequireSession(request, body.creatorEmail);
      const snapshot = updateMusicShareTrack(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/market/items') {
      const body = await readBody(request);
      maybeRequireSession(request, body.sellerEmail);
      const result = createMarketItem(body);
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/market/upload') {
      const fileName = url.searchParams.get('fileName') || 'market-image.jpg';
      const sellerEmail =
        url.searchParams.get('sellerEmail') || url.searchParams.get('email');
      maybeRequireSession(request, sellerEmail);
      const buffer = await readBuffer(request);
      const result = saveMarketImageFile({
        buffer,
        fileName,
        baseUrl: `http://${request.headers.host}`,
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/market/favorites/toggle') {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const result = toggleMarketFavorite(body);
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/market/view') {
      const body = await readBody(request);
      const snapshot = recordMarketView(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/shorts/upload') {
      const fileName = url.searchParams.get('fileName') || 'short-video.mp4';
      const buffer = await readBuffer(request);
      const baseUrl = `http://${request.headers.host}`;
      const result = saveShortVideoFile({
        buffer,
        fileName,
        baseUrl,
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/shorts/upload-audio') {
      const fileName = url.searchParams.get('fileName') || 'short-audio.mp3';
      const buffer = await readBuffer(request);
      const baseUrl = `http://${request.headers.host}`;
      const result = saveShortAudioFile({
        buffer,
        fileName,
        baseUrl,
      });
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/shorts') {
      const body = await readBody(request);
      const result = createShort(body);
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/shorts/comments') {
      const body = await readBody(request);
      const snapshot = addShortComment(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/shorts/like') {
      const body = await readBody(request);
      const snapshot = toggleShortLike(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/shorts/view') {
      const body = await readBody(request);
      const snapshot = recordShortView(body);
      writeJson(response, 200, { snapshot });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/sessions') {
      const body = await readBody(request);
      maybeRequireSession(request, body.hostEmail);
      const result = createSessionRecruitPost(body);
      writeJson(response, 200, result);
      return;
    }

    const sessionUpdateMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/update$/);
    if (request.method === 'POST' && sessionUpdateMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const result = updateSessionRecruitPost(sessionUpdateMatch[1], body);
      writeJson(response, 200, result);
      return;
    }

    const sessionDeleteMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/delete$/);
    if (request.method === 'POST' && sessionDeleteMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const result = deleteSessionRecruitPost(sessionDeleteMatch[1], body.userEmail);
      writeJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && pathname === '/api/collab/projects/from-composer') {
      const body = await readBody(request);
      const projectId = handleCreateProject(body);
      writeJson(response, 200, { projectId, snapshot: createSnapshot() });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/collab/presence/ping') {
      const body = await readBody(request);
      handlePresencePing(body);
      writeJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/collab/presence/leave') {
      const body = await readBody(request);
      handlePresenceLeave(body);
      writeJson(response, 200, { ok: true });
      return;
    }

    const joinMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/join$/);
    if (request.method === 'POST' && joinMatch) {
      const body = await readBody(request);
      handleJoinProject(joinMatch[1], body);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const statusMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/status$/);
    if (request.method === 'POST' && statusMatch) {
      const body = await readBody(request);
      handleSetStatus(statusMatch[1], body.status);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const sessionApplyMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/apply$/);
    if (request.method === 'POST' && sessionApplyMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.email);
      const result = applySessionRecruitPost(sessionApplyMatch[1], body);
      writeJson(response, 200, result);
      return;
    }

    const sessionReviewMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/review$/);
    if (request.method === 'POST' && sessionReviewMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const result = reviewSessionRecruitApplication(sessionReviewMatch[1], body);
      if (body.status === 'approved') {
        addApprovedRecruitMembers(
          result.snapshot.posts.find((post) => post.id === sessionReviewMatch[1])
        );
      }
      writeJson(response, 200, result);
      return;
    }

    const sessionLinkMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/link-collab$/);
    if (request.method === 'POST' && sessionLinkMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const result = linkSessionRecruitCollab(sessionLinkMatch[1], body);
      addApprovedRecruitMembers(
        result.snapshot.posts.find((post) => post.id === sessionLinkMatch[1])
      );
      writeJson(response, 200, result);
      return;
    }

    const sessionStatusMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/status$/);
    if (request.method === 'POST' && sessionStatusMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const result = setSessionRecruitStatus(sessionStatusMatch[1], body);
      writeJson(response, 200, result);
      return;
    }

    const memberColorMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/member-color$/);
    if (request.method === 'POST' && memberColorMatch) {
      const body = await readBody(request);
      handleSetMemberColor(memberColorMatch[1], body);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const renameCollabMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/rename$/);
    if (request.method === 'POST' && renameCollabMatch) {
      const body = await readBody(request);
      handleRenameProject(renameCollabMatch[1], body);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const updateCollabMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/update$/);
    if (request.method === 'POST' && updateCollabMatch) {
      const body = await readBody(request);
      handleUpdateCollabProject(updateCollabMatch[1], body);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const manageCollabMemberMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/members\/manage$/);
    if (request.method === 'POST' && manageCollabMemberMatch) {
      const body = await readBody(request);
      handleManageCollabMember(manageCollabMemberMatch[1], body);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const deleteCollabMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/delete$/);
    if (request.method === 'POST' && deleteCollabMatch) {
      const body = await readBody(request);
      handleDeleteCollabProject(deleteCollabMatch[1], body);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const composerSnapshotMatch = pathname.match(
      /^\/api\/collab\/projects\/([^/]+)\/composer-snapshot$/
    );
    if (request.method === 'POST' && composerSnapshotMatch) {
      const body = await readBody(request);
      const revision = handleUpdateComposerSnapshot(composerSnapshotMatch[1], body);
      writeJson(response, 200, { ok: true, revision, snapshot: createSnapshot() });
      return;
    }

    const composerOperationMatch = pathname.match(
      /^\/api\/collab\/projects\/([^/]+)\/composer-operation$/
    );
    if (request.method === 'POST' && composerOperationMatch) {
      const body = await readBody(request);
      const revision = handleApplyComposerOperation(composerOperationMatch[1], body);
      writeJson(response, 200, { ok: true, revision, snapshot: createSnapshot() });
      return;
    }

    const composerLockMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/composer-lock$/);
    if (request.method === 'POST' && composerLockMatch) {
      const body = await readBody(request);
      handleSetComposerLock(composerLockMatch[1], body);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const messagesMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/messages$/);
    if (request.method === 'POST' && messagesMatch) {
      const body = await readBody(request);
      handleAddMessage(messagesMatch[1], body);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const updateCommunityPostMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/update$/);
    if (request.method === 'POST' && updateCommunityPostMatch) {
      const body = await readBody(request);
      const snapshot = updateCommunityPost({
        ...body,
        postId: updateCommunityPostMatch[1],
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const deleteCommunityPostMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/delete$/);
    if (request.method === 'POST' && deleteCommunityPostMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = deleteCommunityPost({
        postId: deleteCommunityPostMatch[1],
        userEmail: body.userEmail,
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const moderateCommunityPostMatch = pathname.match(
      /^\/api\/community\/posts\/([^/]+)\/moderate$/
    );
    if (request.method === 'POST' && moderateCommunityPostMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = moderateCommunityPost({
        postId: moderateCommunityPostMatch[1],
        userEmail: body.userEmail,
        action: body.action,
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const recordCommunityViewMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/view$/);
    if (request.method === 'POST' && recordCommunityViewMatch) {
      const snapshot = recordCommunityView({
        postId: recordCommunityViewMatch[1],
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const toggleCommunityLikeMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/like$/);
    if (request.method === 'POST' && toggleCommunityLikeMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = toggleCommunityLike({
        postId: toggleCommunityLikeMatch[1],
        userEmail: body.userEmail,
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const toggleCommunityBookmarkMatch = pathname.match(
      /^\/api\/community\/posts\/([^/]+)\/bookmark$/
    );
    if (request.method === 'POST' && toggleCommunityBookmarkMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = toggleCommunityBookmark({
        postId: toggleCommunityBookmarkMatch[1],
        userEmail: body.userEmail,
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const reportCommunityPostMatch = pathname.match(/^\/api\/community\/posts\/([^/]+)\/report$/);
    if (request.method === 'POST' && reportCommunityPostMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = reportCommunityPost({
        postId: reportCommunityPostMatch[1],
        userEmail: body.userEmail,
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const addCommunityCommentMatch = pathname.match(
      /^\/api\/community\/posts\/([^/]+)\/comments$/
    );
    if (request.method === 'POST' && addCommunityCommentMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.authorEmail);
      const snapshot = addCommunityComment({
        ...body,
        postId: addCommunityCommentMatch[1],
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const replyCommunityCommentMatch = pathname.match(
      /^\/api\/community\/comments\/([^/]+)\/reply$/
    );
    if (request.method === 'POST' && replyCommunityCommentMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.authorEmail);
      const snapshot = replyCommunityComment({
        ...body,
        commentId: replyCommunityCommentMatch[1],
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const updateCommunityCommentMatch = pathname.match(
      /^\/api\/community\/comments\/([^/]+)\/update$/
    );
    if (request.method === 'POST' && updateCommunityCommentMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = updateCommunityComment({
        ...body,
        commentId: updateCommunityCommentMatch[1],
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const deleteCommunityCommentMatch = pathname.match(
      /^\/api\/community\/comments\/([^/]+)\/delete$/
    );
    if (request.method === 'POST' && deleteCommunityCommentMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = deleteCommunityComment({
        commentId: deleteCommunityCommentMatch[1],
        userEmail: body.userEmail,
      });
      writeJson(response, 200, snapshot);
      return;
    }

    const deleteProjectMatch = pathname.match(/^\/api\/composer-library\/projects\/([^/]+)\/delete$/);
    if (request.method === 'POST' && deleteProjectMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.userEmail);
      const snapshot = deleteComposerProject({
        projectId: deleteProjectMatch[1],
        userEmail: body.userEmail,
      });
      writeJson(response, 200, { snapshot });
      return;
    }

    const updateMarketItemMatch = pathname.match(/^\/api\/market\/items\/([^/]+)\/update$/);
    if (request.method === 'POST' && updateMarketItemMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.sellerEmail);
      const snapshot = updateMarketItem({
        ...body,
        itemId: updateMarketItemMatch[1],
      });
      writeJson(response, 200, { snapshot });
      return;
    }

    const deleteMarketItemMatch = pathname.match(/^\/api\/market\/items\/([^/]+)\/delete$/);
    if (request.method === 'POST' && deleteMarketItemMatch) {
      const body = await readBody(request);
      maybeRequireSession(request, body.sellerEmail);
      const snapshot = deleteMarketItem({
        itemId: deleteMarketItemMatch[1],
        sellerEmail: body.sellerEmail,
      });
      writeJson(response, 200, { snapshot });
      return;
    }

    const updateShortMatch = pathname.match(/^\/api\/shorts\/([^/]+)\/update$/);
    if (request.method === 'POST' && updateShortMatch) {
      const body = await readBody(request);
      const snapshot = updateShort(updateShortMatch[1], body);
      writeJson(response, 200, { snapshot });
      return;
    }

    const deleteShortMatch = pathname.match(/^\/api\/shorts\/([^/]+)\/delete$/);
    if (request.method === 'POST' && deleteShortMatch) {
      await readBody(request);
      const snapshot = deleteShort(deleteShortMatch[1]);
      writeJson(response, 200, { snapshot });
      return;
    }

    const tasksMatch = pathname.match(/^\/api\/collab\/projects\/([^/]+)\/tasks$/);
    if (request.method === 'POST' && tasksMatch) {
      const body = await readBody(request);
      handleAddTask(tasksMatch[1], body);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const taskToggleMatch = pathname.match(
      /^\/api\/collab\/projects\/([^/]+)\/tasks\/([^/]+)\/toggle$/
    );
    if (request.method === 'POST' && taskToggleMatch) {
      handleToggleTask(taskToggleMatch[1], taskToggleMatch[2]);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const taskDeleteMatch = pathname.match(
      /^\/api\/collab\/projects\/([^/]+)\/tasks\/([^/]+)\/delete$/
    );
    if (request.method === 'POST' && taskDeleteMatch) {
      handleDeleteTask(taskDeleteMatch[1], taskDeleteMatch[2]);
      writeJson(response, 200, { ok: true, snapshot: createSnapshot() });
      return;
    }

    const messageSendMatch = pathname.match(/^\/api\/messages\/threads\/([^/]+)\/messages$/);
    if (request.method === 'POST' && messageSendMatch) {
      const body = await readBody(request);
       requireSessionUser(getRequestSessionToken(request), body.ownerEmail);
      const snapshot = sendMessage({
        ...body,
        threadId: messageSendMatch[1],
      });
      broadcastMessageSnapshot(body.ownerEmail);
      writeJson(response, 200, { snapshot });
      return;
    }

    const messageReadMatch = pathname.match(/^\/api\/messages\/threads\/([^/]+)\/read$/);
    if (request.method === 'POST' && messageReadMatch) {
      const body = await readBody(request);
      requireSessionUser(getRequestSessionToken(request), body.readerEmail);
      const snapshot = markThreadRead({
        threadId: messageReadMatch[1],
        readerEmail: body.readerEmail,
      });
      broadcastMessageSnapshot(body.readerEmail);
      writeJson(response, 200, { snapshot });
      return;
    }
  } catch (error) {
    const statusCode =
      error instanceof AuthServiceError
        ? error.statusCode
        : typeof error?.statusCode === 'number'
          ? error.statusCode
          : 500;
    writeJson(response, statusCode, {
      ...(typeof error?.payload === 'object' && error.payload ? error.payload : {}),
      error: error instanceof Error ? error.message : '협업 서버 오류가 발생했습니다.',
    });
    return;
  }

  writeJson(response, 404, { error: 'Not Found' });
});

server.listen(PORT, () => {
  console.log(`[collab] realtime server running on http://localhost:${PORT}`);
});
