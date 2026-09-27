import { create } from 'zustand';
import type { SongProject } from './songStore';
import { useSongStore, buildSongProjectSnapshot } from './songStore'; 
import { db } from '../firebase'; 
import { createRandomCollabMemberColor } from '../utils/collabMemberColor';
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, increment, arrayUnion, query, orderBy, limit, writeBatch
} from 'firebase/firestore';

// ============================================================================
// 🔥 0. 기존 Composer.tsx 호환용 에러 클래스 (Error 1, 2, 3 해결)
// ============================================================================
export class CollabRequestError extends Error {
  statusCode: number;
  payload?: any;
  constructor(message: string, statusCode: number = 500, payload?: any) {
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

export type CollabMember = { email: string; name: string; role: CollabRole; joinedAt: number; };
export type CollabProject = {
  id: string; title: string; summary: string; genre: string; bpm: number; steps: number;
  status: CollabStatus; createdAt: number; updatedAt: number; ownerEmail: string; ownerName: string;
  sourceProjectId: string | null; snapshot?: SongProject; snapshotRevision: number;
  snapshotUpdatedByEmail: string | null; snapshotUpdatedBySessionId: string | null;
  members: CollabMember[]; tags: string[]; noteColors?: Record<string, string>;
};
export type CollabMessage = { id: string; projectId: string; authorEmail: string; authorName: string; authorColor?: string; content: string; createdAt: number; };
export type CollabTask = { id: string; projectId: string; content: string; completed: boolean; assigneeName: string; createdAt: number; };
export type CollabPresence = { sessionId: string; projectId: string; email: string; name: string; color?: string; focus?: string; lastSeenAt: number; };
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
  | { type: 'set-melody-note'; row: number; col: number; length: number; barIndex: number; }
  | { type: 'toggle-violin-step'; row: number; col: number; nextValue: boolean; barIndex: number; }
  | { type: 'toggle-saxophone-step'; row: number; col: number; nextValue: boolean; barIndex: number; }
  | { type: 'toggle-guitar-step'; row: number; col: number; nextValue: boolean; barIndex: number; }
  | { type: 'toggle-drum-step'; row: number; col: number; nextValue: boolean; barIndex: number; }
  | { type: 'toggle-bass-step'; row: number; col: number; nextValue: boolean; barIndex: number; }
  | { type: 'set-track-note'; instrument: CollabComposerInstrument; trackId?: string; row: number; col: number; nextValue: boolean; barIndex: number; }
  | { type: 'apply-chord'; chord: string; col: number; isBass: boolean; rows: number[]; barIndex: number; }
  | { type: 'set-volume'; instrument: CollabComposerInstrument; volume: number; };

type ApplyComposerOperationPayload = { operation: CollabComposerOperation; email: string; name: string; color?: string; sessionId?: string; baseRevision?: number; };
type ComposerLockPayload = { instrument: CollabComposerInstrument; barIndex: number; email?: string; name?: string; color?: string; sessionId?: string; lock: boolean; };

type CollabState = {
  version: number; projects: CollabProject[]; messages: CollabMessage[]; tasks: CollabTask[];
  presenceByProject: Record<string, CollabPresence[]>; composerLocksByProject: Record<string, CollabComposerLock[]>; composerHistoryByProject: Record<string, CollabComposerHistoryEntry[]>;
  connectionStatus: CollabConnectionStatus; connectionError: string | null;
  initializeRealtime: () => Promise<void>;
  createFromComposerProject: (payload: CreateCollabFromComposerPayload) => Promise<string>;
  joinProject: (projectId: string, payload: { email: string; name: string }) => Promise<void>;
  addMessage: (projectId: string, payload: { email: string; name: string; color?: string; content: string }) => Promise<void>;
  addTask: (projectId: string, payload: { content: string; assigneeName: string }) => Promise<void>;
  toggleTask: (projectId: string, taskId: string) => Promise<void>;
  setStatus: (projectId: string, status: CollabStatus) => Promise<void>;
  updateComposerSnapshot: (projectId: string, payload: UpdateComposerPayload) => Promise<number>;
  applyComposerOperation: (projectId: string, payload: ApplyComposerOperationPayload) => Promise<number>;
  setComposerLock: (projectId: string, payload: ComposerLockPayload) => Promise<void>;
  touchPresence: (projectId: string, payload: { email: string; name: string; color?: string; focus?: string }) => Promise<void>;
  leavePresence: (projectId: string) => Promise<void>;

  deleteProject: (projectId: string) => Promise<void>;
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
    case 'toggle-violin-step':
    case 'toggle-saxophone-step':
    case 'toggle-guitar-step':
    case 'toggle-drum-step':
    case 'toggle-bass-step': {
      const instrument = operation.type.replace('toggle-', '').replace('-step', '') as CollabComposerInstrument;
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
    case 'set-volume':
      return `${operation.instrument} 볼륨을 조정했습니다.`;
    default:
      return `${operation.barIndex + 1}마디 ${operation.type.replaceAll('-', ' ')} 작업을 수정했습니다.`;
  }
}

async function addComposerHistoryEntry(entry: Omit<CollabComposerHistoryEntry, 'id' | 'createdAt'>) {
  const historyRef = doc(collection(db, 'collab_history'));
  await setDoc(historyRef, {
    id: historyRef.id,
    createdAt: Date.now(),
    ...entry,
  });
}

// ============================================================================
// 🔥 2. 파이어베이스 2차원 배열 에러 방지용 "마법의 번역기"
// ============================================================================
function sanitizeForFirestore(data: any): any {
  if (Array.isArray(data)) {
    if (data.some(Array.isArray)) return { _isSerializedArray: true, data: JSON.stringify(data) };
    return data.map(sanitizeForFirestore);
  } else if (data !== null && typeof data === 'object') {
    const res: any = {};
    for (const key of Object.keys(data)) res[key] = sanitizeForFirestore(data[key]);
    return res;
  }
  return data;
}

// 꺼낼 때: 포장된 문자열을 발견하면 원래의 2차원 배열로 완벽하게 복구합니다.
function restoreFromFirestore(data: any): any {
  // ★ 수정됨: 배열(Array)인지 가장 먼저 확인해야 합니다!
  if (Array.isArray(data)) {
    return data.map(restoreFromFirestore);
  } 
  // 그 다음 일반 객체(Object)인지 확인합니다.
  else if (data !== null && typeof data === 'object') {
    if (data._isSerializedArray) {
      try {
        return JSON.parse(data.data);
      } catch (e) {
        return [];
      }
    }
    const res: any = {};
    for (const key of Object.keys(data)) {
      res[key] = restoreFromFirestore(data[key]);
    }
    return res;
  }
  return data;
}

// ============================================================================
// 🔥 3. 파이어베이스 실시간 스토어 구현
// ============================================================================
let unsubscribes: (() => void)[] = [];

// ✅ Error 4 해결: get 변수를 제거했습니다.
export const useCollabStore = create<CollabState>((set, get) => ({
  version: 0, projects: [], messages: [], tasks: [], presenceByProject: {}, composerLocksByProject: {}, composerHistoryByProject: {},
  connectionStatus: 'idle', connectionError: null,

  initializeRealtime: async () => {
    if (typeof window === 'undefined' || unsubscribes.length > 0) return;
    set({ connectionStatus: 'connecting', connectionError: null });

    try {
      unsubscribes.push(onSnapshot(query(collection(db, 'collab_projects'), orderBy('updatedAt', 'desc'), limit(80)), (snap) => {
        const projects = snap.docs.map(d => restoreFromFirestore({ id: d.id, ...d.data() }));
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

    } catch (error) {
      set({ connectionStatus: 'error', connectionError: '파이어베이스 실시간 연결에 실패했습니다.' });
    }
  },

  createFromComposerProject: async (payload) => {
    const projectId = doc(collection(db, 'collab_projects')).id;
    const newProject = {
      id: projectId, title: payload.title, summary: payload.summary, genre: payload.genre, bpm: payload.bpm, steps: payload.steps,
      status: 'planning', createdAt: Date.now(), updatedAt: Date.now(), ownerEmail: payload.ownerEmail, ownerName: payload.ownerName,
      sourceProjectId: payload.sourceProjectId, snapshotRevision: 1, snapshotUpdatedByEmail: payload.ownerEmail, snapshotUpdatedBySessionId: payload.sessionId || COLLAB_SESSION_ID,
      members: [{ email: payload.ownerEmail, name: payload.ownerName, role: 'owner', joinedAt: Date.now() }], tags: [], noteColors: {},
      snapshot: sanitizeForFirestore(payload.snapshot)
    };
    await setDoc(doc(db, 'collab_projects', projectId), newProject);
    return projectId;
  },

  joinProject: async (projectId, payload) => {
    await updateDoc(doc(db, 'collab_projects', projectId), {
      members: arrayUnion({ email: payload.email, name: payload.name, role: 'editor', joinedAt: Date.now() })
    });
  },

  addMessage: async (projectId, payload) => {
    const msgRef = doc(collection(db, 'collab_messages'));
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(msgRef, { id: msgRef.id, projectId, authorEmail: payload.email, authorName: payload.name, authorColor: payload.color || COLLAB_SESSION_COLOR.accent, content: payload.content, createdAt: now });
    batch.update(doc(db, 'collab_projects', projectId), { updatedAt: now });
    await batch.commit();
  },

  addTask: async (projectId, payload) => {
    const taskRef = doc(collection(db, 'collab_tasks'));
    const now = Date.now();
    const batch = writeBatch(db);
    batch.set(taskRef, { id: taskRef.id, projectId, content: payload.content, completed: false, assigneeName: payload.assigneeName, createdAt: now });
    batch.update(doc(db, 'collab_projects', projectId), { updatedAt: now });
    await batch.commit();
  },

  // ✅ Error 5 해결: 사용하지 않는 projectId에 밑줄(_)을 추가해 경고를 무시합니다.
  toggleTask: async (_projectId, taskId) => {
    const taskRef = doc(db, 'collab_tasks', taskId);
    const task = get().tasks.find((item) => item.id === taskId);
    if (task) await updateDoc(taskRef, { completed: !task.completed });
  },

  setStatus: async (projectId, status) => {
    await updateDoc(doc(db, 'collab_projects', projectId), { status, updatedAt: Date.now() });
  },

  updateComposerSnapshot: async (projectId, payload) => {
    const revision = (payload.baseRevision ?? 0) + 1;
    await updateDoc(doc(db, 'collab_projects', projectId), {
      snapshot: sanitizeForFirestore(payload.snapshot),
      snapshotRevision: increment(1),
      snapshotUpdatedByEmail: payload.email,
      snapshotUpdatedBySessionId: payload.sessionId || COLLAB_SESSION_ID,
      updatedAt: Date.now()
    });
    await addComposerHistoryEntry({
      projectId,
      instrument: 'transport',
      barIndex: null,
      authorEmail: payload.email,
      authorName: payload.name,
      action: 'snapshot-update',
      summary: '작곡 화면 변경사항을 저장했습니다.',
      revision,
    });
    return revision;
  },

  applyComposerOperation: async (projectId, payload) => {
    const currentSongState = useSongStore.getState();
    const currentSnapshot = buildSongProjectSnapshot(currentSongState);
    const revision = (payload.baseRevision ?? 0) + 1;
    if (currentSnapshot) {
      const operationColor = payload.color || COLLAB_SESSION_COLOR.accent;
      const currentProject = get().projects.find((project) => project.id === projectId);
      const noteColors = { ...(currentProject?.noteColors ?? {}) };
      getOperationNoteColorChanges(payload.operation, operationColor).forEach((change) => {
        if (change.color) {
          noteColors[change.key] = change.color;
        } else {
          delete noteColors[change.key];
        }
      });
      await updateDoc(doc(db, 'collab_projects', projectId), {
        snapshot: sanitizeForFirestore(currentSnapshot),
        noteColors,
        snapshotRevision: increment(1),
        snapshotUpdatedByEmail: payload.email,
        updatedAt: Date.now()
      });
      await addComposerHistoryEntry({
        projectId,
        instrument:
          payload.operation.type === 'apply-chord'
            ? payload.operation.isBass
              ? 'bass'
              : 'melody'
            : payload.operation.type === 'set-track-note'
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
    }
    return revision;
  },

  setComposerLock: async (projectId, payload) => {
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
    const presenceId = `${projectId}_${COLLAB_SESSION_ID}`;
    await setDoc(doc(db, 'collab_presence', presenceId), {
      projectId, sessionId: COLLAB_SESSION_ID, email: payload.email, name: payload.name, color: payload.color || COLLAB_SESSION_COLOR.accent, focus: payload.focus || '', lastSeenAt: Date.now()
    }, { merge: true });
  },

  leavePresence: async (projectId) => {
    const presenceId = `${projectId}_${COLLAB_SESSION_ID}`;
    await deleteDoc(doc(db, 'collab_presence', presenceId));
  },

  deleteProject: async (projectId) => {
    await deleteDoc(doc(db, 'collab_projects', projectId));
  },
  
}));
