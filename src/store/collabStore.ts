import { create } from 'zustand';
import type { SongProject } from './songStore';
import { useSongStore, buildSongProjectSnapshot } from './songStore'; 
import { db } from '../firebase'; 
import { createRandomCollabMemberColor } from '../utils/collabMemberColor';
import { isLocalDevelopmentHost } from '../utils/localEnvironment';
import { APP_SERVER_URL } from '../utils/serverApi';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, increment, query, where, orderBy, limit, writeBatch
} from 'firebase/firestore';

// ============================================================================
// 🔥 0. 기존 Composer.tsx 호환용 에러 클래스 (Error 1, 2, 3 해결)
// ============================================================================
export class CollabRequestError extends Error {
  statusCode: number;
  payload?: unknown;
  constructor(message: string, statusCode: number = 500, payload?: unknown) {
    super(message);
    this.name = 'CollabRequestError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

// ============================================================================
// 1. 타입 정의
// ============================================================================
export type CollabStatus = 'planning' | 'working' | 'feedback';
export type CollabRole = 'owner' | 'editor' | 'viewer';
export type CollabConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type CollabMember = { email: string; name: string; role: CollabRole; joinedAt: number; color?: string; };
export type CollabProject = {
  id: string; title: string; summary: string; genre: string; bpm: number; steps: number;
  status: CollabStatus; createdAt: number; updatedAt: number; ownerEmail: string; ownerName: string;
  sourceProjectId: string | null; snapshot?: SongProject; snapshotRevision: number;
  snapshotUpdatedByEmail: string | null; snapshotUpdatedBySessionId: string | null;
  members: CollabMember[]; tags: string[]; noteColors?: Record<string, string>;
  noteAuthors?: Record<string, string>;
};
export type CollabMessage = { id: string; projectId: string; authorEmail: string; authorName: string; authorColor?: string; content: string; createdAt: number; };
export type CollabTask = { id: string; projectId: string; content: string; completed: boolean; assigneeName: string; createdAt: number; };
export type CollabCursorPosition = { x: number; y: number; updatedAt: number; };
export type CollabPresence = { sessionId: string; projectId: string; email: string; name: string; color?: string; focus?: string; cursor?: CollabCursorPosition | null; lastSeenAt: number; };
export type CollabComposerInstrument =
  | 'melody'
  | 'violin'
  | 'saxophone'
  | 'guitar'
  | 'glockenspiel'
  | 'piccolo'
  | 'supportingPiano'
  | 'chicagoStreet'
  | 'studioAltoSax'
  | 'drums'
  | 'bass';
export type CollabComposerLock = { projectId: string; instrument: CollabComposerInstrument; barIndex: number; sessionId: string; email: string; name: string; color?: string; lockedAt: number; expiresAt: number; };
export type CollabComposerHistoryEntry = { id: string; projectId: string; instrument: CollabComposerInstrument | 'transport'; barIndex: number | null; authorEmail: string; authorName: string; authorColor?: string; action: string; summary: string; createdAt: number; revision: number; };

type CreateCollabFromComposerPayload = { sourceProjectId: string; title: string; summary: string; genre: string; bpm: number; steps: number; ownerEmail: string; ownerName: string; snapshot: SongProject; sessionId?: string; };
type UpdateComposerPayload = { snapshot: SongProject; email: string; name: string; sessionId?: string; baseRevision?: number; };
export type CollabComposerOperation = 
  | { type: 'set-melody-note'; row: number; col: number; length: number; note?: string; barIndex: number; }
  | { type: 'toggle-violin-step'; row: number; col: number; nextValue: boolean; note?: string; length?: number; barIndex: number; }
  | { type: 'toggle-saxophone-step'; row: number; col: number; nextValue: boolean; note?: string; length?: number; barIndex: number; }
  | { type: 'toggle-guitar-step'; row: number; col: number; nextValue: boolean; note?: string; length?: number; barIndex: number; }
  | { type: 'toggle-drum-step'; row: number; col: number; nextValue: boolean; note?: string; barIndex: number; }
  | { type: 'toggle-bass-step'; row: number; col: number; nextValue: boolean; note?: string; length?: number; barIndex: number; }
  | { type: 'set-track-note'; instrument: CollabComposerInstrument; trackId?: string; row: number; col: number; nextValue: boolean; note?: string; length?: number; barIndex: number; }
  | { type: 'set-track-chord'; instrument: CollabComposerInstrument; trackId?: string; chord: string; rows: number[]; notes?: string[]; length?: number; col: number; barIndex: number; }
  | { type: 'apply-chord'; chord: string; col: number; isBass: boolean; rows: number[]; notes?: string[]; length?: number; barIndex: number; }
  | { type: 'set-volume'; instrument: CollabComposerInstrument; volume: number; };

type ApplyComposerOperationPayload = { operation: CollabComposerOperation; email: string; name: string; color?: string; sessionId?: string; baseRevision?: number; };
type ComposerLockPayload = { instrument: CollabComposerInstrument; barIndex: number; email?: string; name?: string; color?: string; sessionId?: string; lock: boolean; };

type CollabSnapshot = Pick<
  CollabState,
  | 'version'
  | 'projects'
  | 'messages'
  | 'tasks'
  | 'presenceByProject'
  | 'composerLocksByProject'
  | 'composerHistoryByProject'
>;

type CollabState = {
  version: number; projects: CollabProject[]; messages: CollabMessage[]; tasks: CollabTask[];
  presenceByProject: Record<string, CollabPresence[]>; composerLocksByProject: Record<string, CollabComposerLock[]>; composerHistoryByProject: Record<string, CollabComposerHistoryEntry[]>;
  connectionStatus: CollabConnectionStatus; connectionError: string | null;
  initializeRealtime: () => Promise<void>;
  createFromComposerProject: (payload: CreateCollabFromComposerPayload) => Promise<string>;
  joinProject: (projectId: string, payload: { email: string; name: string }) => Promise<void>;
  setMemberColor: (projectId: string, email: string, color: string) => Promise<void>;
  addMessage: (projectId: string, payload: { email: string; name: string; color?: string; content: string }) => Promise<void>;
  addTask: (projectId: string, payload: { content: string; assigneeName: string }) => Promise<void>;
  toggleTask: (projectId: string, taskId: string) => Promise<void>;
  setStatus: (projectId: string, status: CollabStatus) => Promise<void>;
  updateComposerSnapshot: (projectId: string, payload: UpdateComposerPayload) => Promise<number>;
  applyComposerOperation: (projectId: string, payload: ApplyComposerOperationPayload) => Promise<number>;
  setComposerLock: (projectId: string, payload: ComposerLockPayload) => Promise<void>;
  touchPresence: (projectId: string, payload: { email: string; name: string; color?: string; focus?: string }) => Promise<void>;
  updateCursor: (projectId: string, payload: { email: string; name: string; color?: string; x: number | null; y: number | null }) => Promise<void>;
  leavePresence: (projectId: string) => Promise<void>;
  renameProject: (projectId: string, userEmail: string, title: string) => Promise<void>;
  deleteProject: (projectId: string, userEmail: string) => Promise<void>;
};

export const COLLAB_PRESENCE_TIMEOUT_MS = 20_000;
export const COLLAB_PRESENCE_PING_INTERVAL_MS = 8_000;

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `${prefix}-${randomId}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const COLLAB_SESSION_ID = createId('collab-session');
export const COLLAB_SESSION_COLOR = createRandomCollabMemberColor();

export function getCollabNoteColorKey(
  instrument: CollabComposerInstrument,
  row: number,
  col: number,
  trackId?: string
) {
  return `${trackId || instrument}:${row}:${col}`;
}

function getOperationNoteColorChanges(operation: CollabComposerOperation, color: string) {
  const changes: Array<{ key: string; color: string | null }> = [];

  switch (operation.type) {
    case 'set-melody-note':
      changes.push({
        key: getCollabNoteColorKey('melody', operation.row, operation.col),
        color: operation.length > 0 ? color : null,
      });
      break;
    case 'apply-chord':
      operation.rows.forEach((row) => {
        changes.push({
          key: getCollabNoteColorKey(operation.isBass ? 'bass' : 'melody', row, operation.col),
          color,
        });
      });
      break;
    case 'set-track-note':
      changes.push({
        key: getCollabNoteColorKey(operation.instrument, operation.row, operation.col, operation.trackId),
        color: operation.nextValue ? color : null,
      });
      break;
    case 'set-track-chord':
      operation.rows.forEach((row) => {
        changes.push({
          key: getCollabNoteColorKey(operation.instrument, row, operation.col, operation.trackId),
          color,
        });
      });
      break;
    case 'toggle-violin-step':
    case 'toggle-saxophone-step':
    case 'toggle-guitar-step':
    case 'toggle-drum-step':
    case 'toggle-bass-step': {
      const rawInstrument = operation.type.replace('toggle-', '').replace('-step', '');
      const instrument = (rawInstrument === 'drum' ? 'drums' : rawInstrument) as CollabComposerInstrument;
      changes.push({
        key: getCollabNoteColorKey(instrument, operation.row, operation.col),
        color: operation.nextValue ? color : null,
      });
      break;
    }
    default:
      break;
  }

  return changes;
}

function getOperationSummary(operation: CollabComposerOperation) {
  switch (operation.type) {
    case 'set-melody-note':
      return `${operation.barIndex + 1}마디 멜로디 음을 수정했습니다.`;
    case 'apply-chord':
      return `${operation.barIndex + 1}마디에 ${operation.chord} 코드를 적용했습니다.`;
    case 'set-track-chord':
      return `${operation.barIndex + 1}마디에 ${operation.chord} 코드를 적용했습니다.`;
    case 'set-volume':
      return `${operation.instrument} 볼륨을 조정했습니다.`;
    default:
      return `${operation.barIndex + 1}마디 ${operation.type.replaceAll('-', ' ')} 작업을 수정했습니다.`;
  }
}

// ============================================================================
// 🔥 2. 파이어베이스 2차원 배열 에러 방지용 "마법의 번역기"
// ============================================================================
function sanitizeForFirestore(data: unknown): unknown {
  if (Array.isArray(data)) {
    if (data.some(Array.isArray)) return { _isSerializedArray: true, data: JSON.stringify(data) };
    return data.map(sanitizeForFirestore);
  } else if (data !== null && typeof data === 'object') {
    const source = data as Record<string, unknown>;
    const res: Record<string, unknown> = {};
    for (const key of Object.keys(source)) res[key] = sanitizeForFirestore(source[key]);
    return res;
  }
  return data;
}

// 꺼낼 때: 포장된 문자열을 발견하면 원래의 2차원 배열로 완벽하게 복구합니다.
function restoreFromFirestore(data: unknown): unknown {
  // ★ 수정됨: 배열(Array)인지 가장 먼저 확인해야 합니다!
  if (Array.isArray(data)) {
    return data.map(restoreFromFirestore);
  } 
  // 그 다음 일반 객체(Object)인지 확인합니다.
  else if (data !== null && typeof data === 'object') {
    const source = data as Record<string, unknown>;
    if (source._isSerializedArray) {
      try {
        return JSON.parse(String(source.data));
      } catch {
        return [];
      }
    }
    const res: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      res[key] = restoreFromFirestore(source[key]);
    }
    return res;
  }
  return data;
}

// ============================================================================
// 🔥 3. 파이어베이스 실시간 스토어 구현
// ============================================================================
const unsubscribes: (() => void)[] = [];
let localEventSource: EventSource | null = null;
let localInitPromise: Promise<void> | null = null;

async function fetchLocalCollabJson<T>(path: string, init?: RequestInit) {
  let response: Response;
  try {
    response = await fetch(`${APP_SERVER_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new Error('로컬 협업 서버에 연결하지 못했습니다. npm.cmd run dev 실행 상태를 확인해주세요.');
  }

  const payload = await response.json().catch(() => null) as ({ error?: string } & Record<string, unknown>) | null;
  if (!response.ok) {
    throw new CollabRequestError(payload?.error || '협업 서버 요청이 실패했습니다.', response.status, payload);
  }
  return payload as T;
}

function applyLocalSnapshot(snapshot: CollabSnapshot) {
  useCollabStore.setState({
    ...snapshot,
    connectionStatus: 'connected',
    connectionError: null,
  });
}

// ✅ Error 4 해결: get 변수를 제거했습니다.
export const useCollabStore = create<CollabState>((set, get) => ({
  version: 0, projects: [], messages: [], tasks: [], presenceByProject: {}, composerLocksByProject: {}, composerHistoryByProject: {},
  connectionStatus: 'idle', connectionError: null,

  initializeRealtime: async () => {
    if (typeof window === 'undefined') return;

    if (isLocalDevelopmentHost()) {
      if (localInitPromise) return localInitPromise;
      if (localEventSource?.readyState === EventSource.OPEN) return;

      set({ connectionStatus: 'connecting', connectionError: null });
      localInitPromise = (async () => {
        try {
          const snapshot = await fetchLocalCollabJson<CollabSnapshot>('/api/collab/bootstrap');
          applyLocalSnapshot(snapshot);

          localEventSource?.close();
          localEventSource = new EventSource(`${APP_SERVER_URL}/api/collab/stream`);
          localEventSource.addEventListener('snapshot', (event) => {
            applyLocalSnapshot(JSON.parse((event as MessageEvent<string>).data) as CollabSnapshot);
          });
          localEventSource.onopen = () => set({ connectionStatus: 'connected', connectionError: null });
          localEventSource.onerror = () => set({
            connectionStatus: 'error',
            connectionError: '로컬 협업 서버 연결이 끊겼습니다.',
          });
        } catch (error) {
          set({
            connectionStatus: 'error',
            connectionError: error instanceof Error ? error.message : '로컬 협업 서버 연결에 실패했습니다.',
          });
          throw error;
        } finally {
          localInitPromise = null;
        }
      })();
      return localInitPromise;
    }

    if (unsubscribes.length > 0) return;
    set({ connectionStatus: 'connecting', connectionError: null });

    try {
      unsubscribes.push(onSnapshot(query(collection(db, 'collab_projects'), orderBy('updatedAt', 'desc'), limit(80)), (snap) => {
        const projects = snap.docs.map(
          d => restoreFromFirestore({ id: d.id, ...d.data() }) as CollabProject
        );
        set({ projects, connectionStatus: 'connected' });
      }));

      unsubscribes.push(onSnapshot(query(collection(db, 'collab_messages'), orderBy('createdAt', 'desc'), limit(160)), (snap) => {
        const messages = snap.docs.map(d => ({ id: d.id, ...d.data() } as CollabMessage));
        set({ messages });
      }));

      unsubscribes.push(onSnapshot(query(collection(db, 'collab_tasks'), orderBy('createdAt', 'desc'), limit(240)), (snap) => {
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as CollabTask));
        set({ tasks });
      }));

      unsubscribes.push(onSnapshot(collection(db, 'collab_presence'), (snap) => {
        const presenceList = snap.docs.map(d => d.data() as CollabPresence);
        const presenceByProject: Record<string, CollabPresence[]> = {};
        presenceList.forEach(p => {
          if (!presenceByProject[p.projectId]) presenceByProject[p.projectId] = [];
          presenceByProject[p.projectId].push(p);
        });
        set({ presenceByProject });
      }));

      unsubscribes.push(onSnapshot(collection(db, 'collab_locks'), (snap) => {
        const locksList = snap.docs.map(d => d.data() as CollabComposerLock);
        const composerLocksByProject: Record<string, CollabComposerLock[]> = {};
        locksList.forEach(l => {
          if (!composerLocksByProject[l.projectId]) composerLocksByProject[l.projectId] = [];
          composerLocksByProject[l.projectId].push(l);
        });
        set({ composerLocksByProject });
      }));

      unsubscribes.push(onSnapshot(query(collection(db, 'collab_history'), orderBy('createdAt', 'desc'), limit(160)), (snap) => {
        const historyList = snap.docs.map(d => ({ id: d.id, ...d.data() } as CollabComposerHistoryEntry));
        const composerHistoryByProject: Record<string, CollabComposerHistoryEntry[]> = {};
        historyList.forEach(entry => {
          if (!composerHistoryByProject[entry.projectId]) composerHistoryByProject[entry.projectId] = [];
          composerHistoryByProject[entry.projectId].push(entry);
        });
        Object.values(composerHistoryByProject).forEach(entries => {
          entries.sort((left, right) => right.createdAt - left.createdAt);
        });
        set({ composerHistoryByProject });
      }));

    } catch {
      set({ connectionStatus: 'error', connectionError: '파이어베이스 실시간 연결에 실패했습니다.' });
    }
  },

  createFromComposerProject: async (payload) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ projectId: string; snapshot: CollabSnapshot }>(
        '/api/collab/projects/from-composer',
        {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            color: COLLAB_SESSION_COLOR.accent,
            sessionId: payload.sessionId || COLLAB_SESSION_ID,
          }),
        }
      );
      applyLocalSnapshot(response.snapshot);
      return response.projectId;
    }

    const projectId = doc(collection(db, 'collab_projects')).id;
    const newProject = {
      id: projectId, title: payload.title, summary: payload.summary, genre: payload.genre, bpm: payload.bpm, steps: payload.steps,
      status: 'planning', createdAt: Date.now(), updatedAt: Date.now(), ownerEmail: payload.ownerEmail, ownerName: payload.ownerName,
      sourceProjectId: payload.sourceProjectId, snapshotRevision: 1, snapshotUpdatedByEmail: payload.ownerEmail, snapshotUpdatedBySessionId: payload.sessionId || COLLAB_SESSION_ID,
      members: [{ email: payload.ownerEmail, name: payload.ownerName, role: 'owner', joinedAt: Date.now(), color: COLLAB_SESSION_COLOR.accent }], tags: [], noteColors: {}, noteAuthors: {},
      snapshot: sanitizeForFirestore(payload.snapshot)
    };
    await setDoc(doc(db, 'collab_projects', projectId), newProject);
    return projectId;
  },

  joinProject: async (projectId, payload) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ snapshot: CollabSnapshot }>(
        `/api/collab/projects/${projectId}/join`,
        { method: 'POST', body: JSON.stringify({ ...payload, color: createRandomCollabMemberColor().accent }) }
      );
      applyLocalSnapshot(response.snapshot);
      return;
    }
    const projectRef = doc(db, 'collab_projects', projectId);
    const projectSnapshot = await getDoc(projectRef);
    if (!projectSnapshot.exists()) {
      throw new CollabRequestError('작업실을 찾을 수 없습니다.', 404);
    }

    const project = restoreFromFirestore({ id: projectSnapshot.id, ...projectSnapshot.data() }) as CollabProject;
    const email = payload.email.trim().toLowerCase();
    if (project.members.some((member) => member.email.trim().toLowerCase() === email)) {
      return;
    }

    await updateDoc(projectRef, {
      members: [
        ...project.members,
        {
          email: payload.email,
          name: payload.name,
          role: 'editor',
          joinedAt: Date.now(),
          color: createRandomCollabMemberColor().accent,
        },
      ],
      updatedAt: Date.now(),
    });
  },

  setMemberColor: async (projectId, email, color) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ snapshot: CollabSnapshot }>(
        `/api/collab/projects/${projectId}/member-color`,
        { method: 'POST', body: JSON.stringify({ email, color }) }
      );
      applyLocalSnapshot(response.snapshot);
      return;
    }
    const project = get().projects.find((item) => item.id === projectId);
    if (!project) return;

    const normalizedEmail = email.trim().toLowerCase();
    const previousColor = project.members.find(
      (member) => member.email.trim().toLowerCase() === normalizedEmail
    )?.color;
    const members = project.members.map((member) =>
      member.email.trim().toLowerCase() === normalizedEmail ? { ...member, color } : member
    );
    const noteColors = { ...(project.noteColors ?? {}) };
    const noteAuthors = { ...(project.noteAuthors ?? {}) };

    Object.entries(noteColors).forEach(([key, noteColor]) => {
      const authorEmail = noteAuthors[key]?.trim().toLowerCase();
      const isOwnedNote = authorEmail === normalizedEmail;
      const isLegacyOwnedNote = !authorEmail && Boolean(previousColor) && noteColor === previousColor;
      if (isOwnedNote || isLegacyOwnedNote) {
        noteColors[key] = color;
        noteAuthors[key] = normalizedEmail;
      }
    });

    set((state) => ({
      projects: state.projects.map((item) =>
        item.id === projectId ? { ...item, members, noteColors, noteAuthors } : item
      ),
    }));
    await updateDoc(doc(db, 'collab_projects', projectId), {
      members,
      noteColors,
      noteAuthors,
      updatedAt: Date.now(),
    });
  },

  addMessage: async (projectId, payload) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ snapshot: CollabSnapshot }>(
        `/api/collab/projects/${projectId}/messages`,
        { method: 'POST', body: JSON.stringify(payload) }
      );
      applyLocalSnapshot(response.snapshot);
      return;
    }
    const msgRef = doc(collection(db, 'collab_messages'));
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(msgRef, { id: msgRef.id, projectId, authorEmail: payload.email, authorName: payload.name, authorColor: payload.color || COLLAB_SESSION_COLOR.accent, content: payload.content, createdAt: now });
    batch.update(doc(db, 'collab_projects', projectId), { updatedAt: now });
    await batch.commit();
  },

  addTask: async (projectId, payload) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ snapshot: CollabSnapshot }>(
        `/api/collab/projects/${projectId}/tasks`,
        { method: 'POST', body: JSON.stringify(payload) }
      );
      applyLocalSnapshot(response.snapshot);
      return;
    }
    const taskRef = doc(collection(db, 'collab_tasks'));
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(taskRef, { id: taskRef.id, projectId, content: payload.content, completed: false, assigneeName: payload.assigneeName, createdAt: now });
    batch.update(doc(db, 'collab_projects', projectId), { updatedAt: now });
    await batch.commit();
  },

  // ✅ Error 5 해결: 사용하지 않는 projectId에 밑줄(_)을 추가해 경고를 무시합니다.
  toggleTask: async (_projectId, taskId) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ snapshot: CollabSnapshot }>(
        `/api/collab/projects/${_projectId}/tasks/${taskId}/toggle`,
        { method: 'POST' }
      );
      applyLocalSnapshot(response.snapshot);
      return;
    }
    const taskRef = doc(db, 'collab_tasks', taskId);
    const task = get().tasks.find((item) => item.id === taskId);
    if (task) await updateDoc(taskRef, { completed: !task.completed });
  },

  setStatus: async (projectId, status) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ snapshot: CollabSnapshot }>(
        `/api/collab/projects/${projectId}/status`,
        { method: 'POST', body: JSON.stringify({ status }) }
      );
      applyLocalSnapshot(response.snapshot);
      return;
    }
    await updateDoc(doc(db, 'collab_projects', projectId), { status, updatedAt: Date.now() });
  },

  updateComposerSnapshot: async (projectId, payload) => {
    if (isLocalDevelopmentHost()) {
      try {
        const response = await fetchLocalCollabJson<{ revision: number; snapshot: CollabSnapshot }>(
          `/api/collab/projects/${projectId}/composer-snapshot`,
          { method: 'POST', body: JSON.stringify({ ...payload, sessionId: payload.sessionId || COLLAB_SESSION_ID }) }
        );
        applyLocalSnapshot(response.snapshot);
        return response.revision;
      } catch (error) {
        if (error instanceof CollabRequestError) {
          const snapshot = (error.payload as { snapshot?: CollabSnapshot } | undefined)?.snapshot;
          if (snapshot) applyLocalSnapshot(snapshot);
        }
        throw error;
      }
    }
    const revision = (payload.baseRevision ?? 0) + 1;
    const updatedAt = Date.now();
    const projectRef = doc(db, 'collab_projects', projectId);
    const historyRef = doc(collection(db, 'collab_history'));
    const batch = writeBatch(db);
    batch.update(projectRef, {
      snapshot: sanitizeForFirestore(payload.snapshot),
      snapshotRevision: increment(1),
      snapshotUpdatedByEmail: payload.email,
      snapshotUpdatedBySessionId: payload.sessionId || COLLAB_SESSION_ID,
      updatedAt,
    });
    batch.set(historyRef, {
      id: historyRef.id,
      createdAt: updatedAt,
      projectId,
      instrument: 'transport',
      barIndex: null,
      authorEmail: payload.email,
      authorName: payload.name,
      action: 'snapshot-update',
      summary: '작곡 화면 변경사항을 저장했습니다.',
      revision,
    });
    await batch.commit();
    return revision;
  },

  applyComposerOperation: async (projectId, payload) => {
    if (isLocalDevelopmentHost()) {
      try {
        const response = await fetchLocalCollabJson<{ revision: number; snapshot: CollabSnapshot }>(
          `/api/collab/projects/${projectId}/composer-operation`,
          { method: 'POST', body: JSON.stringify({ ...payload, sessionId: payload.sessionId || COLLAB_SESSION_ID }) }
        );
        applyLocalSnapshot(response.snapshot);
        return response.revision;
      } catch (error) {
        if (error instanceof CollabRequestError) {
          const snapshot = (error.payload as { snapshot?: CollabSnapshot } | undefined)?.snapshot;
          if (snapshot) applyLocalSnapshot(snapshot);
        }
        throw error;
      }
    }
    const currentSongState = useSongStore.getState();
    const currentSnapshot = buildSongProjectSnapshot(currentSongState);
    const revision = (payload.baseRevision ?? 0) + 1;
    if (currentSnapshot) {
      const operationColor = payload.color || COLLAB_SESSION_COLOR.accent;
      const currentProject = get().projects.find((project) => project.id === projectId);
      const noteColors = { ...(currentProject?.noteColors ?? {}) };
      const noteAuthors = { ...(currentProject?.noteAuthors ?? {}) };
      const normalizedAuthorEmail = payload.email.trim().toLowerCase();
      getOperationNoteColorChanges(payload.operation, operationColor).forEach((change) => {
        if (change.color) {
          noteColors[change.key] = change.color;
          noteAuthors[change.key] = normalizedAuthorEmail;
        } else {
          delete noteColors[change.key];
          delete noteAuthors[change.key];
        }
      });
      const updatedAt = Date.now();
      const projectRef = doc(db, 'collab_projects', projectId);
      const historyRef = doc(collection(db, 'collab_history'));
      const batch = writeBatch(db);
      batch.update(projectRef, {
        snapshot: sanitizeForFirestore(currentSnapshot),
        noteColors,
        noteAuthors,
        snapshotRevision: increment(1),
        snapshotUpdatedByEmail: payload.email,
        snapshotUpdatedBySessionId: payload.sessionId || COLLAB_SESSION_ID,
        updatedAt,
      });
      batch.set(historyRef, {
        id: historyRef.id,
        createdAt: updatedAt,
        projectId,
        instrument:
          payload.operation.type === 'apply-chord'
            ? payload.operation.isBass
              ? 'bass'
              : 'melody'
            : payload.operation.type === 'set-track-note' || payload.operation.type === 'set-track-chord'
              ? payload.operation.instrument
            : payload.operation.type === 'set-volume'
              ? payload.operation.instrument
              : payload.operation.type.includes('drum')
                ? 'drums'
                : payload.operation.type.includes('bass')
                  ? 'bass'
                  : payload.operation.type.includes('guitar')
                    ? 'guitar'
                    : payload.operation.type.includes('saxophone')
                      ? 'saxophone'
                      : payload.operation.type.includes('violin')
                        ? 'violin'
                        : 'melody',
        barIndex: 'barIndex' in payload.operation ? payload.operation.barIndex : null,
        authorEmail: payload.email,
        authorName: payload.name,
        authorColor: operationColor,
        action: payload.operation.type,
        summary: getOperationSummary(payload.operation),
        revision,
      });
      await batch.commit();
    }
    return revision;
  },

  setComposerLock: async (projectId, payload) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ snapshot: CollabSnapshot }>(
        `/api/collab/projects/${projectId}/composer-lock`,
        {
          method: 'POST',
          body: JSON.stringify({ ...payload, projectId, sessionId: payload.sessionId || COLLAB_SESSION_ID }),
        }
      );
      applyLocalSnapshot(response.snapshot);
      return;
    }
    const lockId = `${projectId}_${payload.instrument}_${payload.sessionId || COLLAB_SESSION_ID}`;
    const lockRef = doc(db, 'collab_locks', lockId);
    if (payload.lock) {
      await setDoc(lockRef, {
        projectId, instrument: payload.instrument, barIndex: payload.barIndex, sessionId: payload.sessionId || COLLAB_SESSION_ID,
        email: payload.email || '', name: payload.name || '', color: payload.color || COLLAB_SESSION_COLOR.accent, lockedAt: Date.now(), expiresAt: Date.now() + 60000
      });
    } else {
      await deleteDoc(lockRef);
    }
  },

  touchPresence: async (projectId, payload) => {
    if (isLocalDevelopmentHost()) {
      await fetchLocalCollabJson('/api/collab/presence/ping', {
        method: 'POST',
        body: JSON.stringify({ ...payload, projectId, sessionId: COLLAB_SESSION_ID }),
      });
      return;
    }
    const presenceId = `${projectId}_${COLLAB_SESSION_ID}`;
    await setDoc(doc(db, 'collab_presence', presenceId), {
      projectId, sessionId: COLLAB_SESSION_ID, email: payload.email, name: payload.name, color: payload.color || COLLAB_SESSION_COLOR.accent, focus: payload.focus || '', lastSeenAt: Date.now()
    }, { merge: true });
  },

  updateCursor: async (projectId, payload) => {
    if (isLocalDevelopmentHost()) {
      await fetchLocalCollabJson('/api/collab/presence/ping', {
        method: 'POST',
        body: JSON.stringify({ ...payload, projectId, sessionId: COLLAB_SESSION_ID }),
      });
      return;
    }
    const presenceId = `${projectId}_${COLLAB_SESSION_ID}`;
    const now = Date.now();
    const hasPosition = payload.x !== null && payload.y !== null;
    await setDoc(doc(db, 'collab_presence', presenceId), {
      projectId,
      sessionId: COLLAB_SESSION_ID,
      email: payload.email,
      name: payload.name,
      color: payload.color || COLLAB_SESSION_COLOR.accent,
      cursor: hasPosition
        ? {
            x: Math.max(0, Math.min(1, payload.x as number)),
            y: Math.max(0, Math.min(1, payload.y as number)),
            updatedAt: now,
          }
        : null,
      lastSeenAt: now,
    }, { merge: true });
  },

  leavePresence: async (projectId) => {
    if (isLocalDevelopmentHost()) {
      await fetchLocalCollabJson('/api/collab/presence/leave', {
        method: 'POST',
        body: JSON.stringify({ projectId, sessionId: COLLAB_SESSION_ID }),
      });
      return;
    }
    const presenceId = `${projectId}_${COLLAB_SESSION_ID}`;
    await deleteDoc(doc(db, 'collab_presence', presenceId));
  },

  renameProject: async (projectId, userEmail, title) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ snapshot: CollabSnapshot }>(
        `/api/collab/projects/${projectId}/rename`,
        { method: 'POST', body: JSON.stringify({ userEmail, title }) }
      );
      applyLocalSnapshot(response.snapshot);
      return;
    }
    const nextTitle = title.trim();
    if (!nextTitle) {
      throw new CollabRequestError('작업실 이름을 입력해주세요.', 400);
    }

    const projectRef = doc(db, 'collab_projects', projectId);
    const projectSnapshot = await getDoc(projectRef);
    if (!projectSnapshot.exists()) {
      throw new CollabRequestError('작업실을 찾을 수 없습니다.', 404);
    }

    const project = projectSnapshot.data() as CollabProject;
    if (project.ownerEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      throw new CollabRequestError('작업실을 만든 사람만 이름을 변경할 수 있습니다.', 403);
    }

    await updateDoc(projectRef, { title: nextTitle, updatedAt: Date.now() });
  },

  deleteProject: async (projectId, userEmail) => {
    if (isLocalDevelopmentHost()) {
      const response = await fetchLocalCollabJson<{ snapshot: CollabSnapshot }>(
        `/api/collab/projects/${projectId}/delete`,
        { method: 'POST', body: JSON.stringify({ userEmail }) }
      );
      applyLocalSnapshot(response.snapshot);
      return;
    }
    const projectRef = doc(db, 'collab_projects', projectId);
    const projectSnapshot = await getDoc(projectRef);
    if (!projectSnapshot.exists()) {
      throw new CollabRequestError('작업실을 찾을 수 없습니다.', 404);
    }

    const project = projectSnapshot.data() as CollabProject;
    if (project.ownerEmail.trim().toLowerCase() !== userEmail.trim().toLowerCase()) {
      throw new CollabRequestError('작업실을 만든 사람만 삭제할 수 있습니다.', 403);
    }

    const relatedCollections = [
      'collab_messages',
      'collab_tasks',
      'collab_presence',
      'collab_locks',
      'collab_history',
    ];
    const relatedSnapshots = await Promise.all(
      relatedCollections.map((collectionName) =>
        getDocs(query(collection(db, collectionName), where('projectId', '==', projectId)))
      )
    );

    await Promise.all(
      relatedSnapshots.flatMap((snapshot) => snapshot.docs.map((document) => deleteDoc(document.ref)))
    );
    await deleteDoc(projectRef);
  },
  
}));
