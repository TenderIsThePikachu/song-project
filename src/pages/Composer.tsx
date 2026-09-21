import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type {
  DragEvent as ReactDragEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { PianoRoll } from '../components/PianoRoll.tsx';
import { TransportBar } from '../components/TransportBar.tsx';
import {
  initTransport,
  preloadPlaybackEngine,
  playBassPreview,
  playDrumPreview,
  playGuitarPreview,
  playMelodyPreview,
  playSampledInstrumentPreview,
  releaseInstrumentSounds,
  playSaxophonePreview,
  playViolinPreview,
} from '../audio/engine.ts';
import {
  COMPOSER_GUIDE_STEPS,
  type ComposerGuideFocus,
} from '../constants/composerGuide.ts';
import {
  COMPOSER_TUTORIAL_BASS_TARGETS,
  COMPOSER_TUTORIAL_CHORD_TARGETS,
  COMPOSER_TUTORIAL_DRUM_TARGETS,
  COMPOSER_TUTORIAL_MELODY_TARGETS,
  type ComposerTutorialCellTarget,
  type ComposerTutorialChordTarget,
  type ComposerTutorialNoteTarget,
} from '../constants/composerTutorialGame.ts';
import {
  BASS_CHORD_MAP,
  BASS_NOTES,
  CHICAGO_STREET_NOTES,
  DRUM_STEP_WIDTH,
  GLOCKENSPIEL_NOTES,
  GUITAR_ROWS,
  GUITAR_TRACK_LABELS,
  MELODY_NOTES,
  MELODY_PIANO_ROW_HEIGHT,
  MELODY_ROWS,
  PICCOLO_NOTES,
  SAXOPHONE_NOTES,
  SAXOPHONE_ROWS,
  STUDIO_ALTO_SAX_NOTES,
  SUPPORTING_PIANO_NOTES,
  VIOLIN_NOTES,
  VIOLIN_ROWS,
} from '../constants/composer.ts';
import { useAuthStore } from '../store/authStore.ts';
import {
  COLLAB_PRESENCE_PING_INTERVAL_MS,
  CollabRequestError,
  COLLAB_SESSION_ID,
  type CollabComposerHistoryEntry,
  type CollabComposerInstrument,
  type CollabComposerOperation,
  useCollabStore,
} from '../store/collabStore.ts';
import {
  DRUM_ROWS,
  buildSongProjectSnapshot,
  type ExtraInstrumentTrack,
  type InstrumentKey,
  useSongStore,
} from '../store/songStore.ts';
import { useComposerLibraryStore } from '../store/composerLibraryStore.ts';
import {
  useUIStore,
  type ComposerTabKey,
  type MelodyInstrument,
} from '../store/uiStore.ts';
import './Composer.css';

type ComposerTab = ComposerTabKey;
type TabPickerOption = ComposerTab | 'airInstrument' | 'videoOverlay';
type TabPickerGroup = {
  title: string;
  options: TabPickerOption[];
};

const chordOptions = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const melodyNoteLengthOptions = [
  { label: '1/16', steps: 1 },
  { label: '1/8', steps: 2 },
  { label: '1/4', steps: 4 },
  { label: '1/2', steps: 8 },
  { label: '1 Bar', steps: 16 },
] as const;
type MelodyNoteLengthSteps = (typeof melodyNoteLengthOptions)[number]['steps'];
type ComposerNotepadMode = 'lyrics' | 'memo';
type PianoEditTool = 'select' | 'pencil' | 'eraser' | 'marquee' | 'zoom';
type PianoSelection = {
  scrollKey: string;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};
type ArrangementClipLayout = {
  start: number;
  length: number;
};
type ArrangementClipPreview = {
  hasAudio: boolean;
  activityRanges: Array<{ start: number; width: number }>;
  pitchSegments: string[];
};

const COMPOSER_NOTEPAD_STORAGE_KEY = 'song-maker-composer-notepad';

function readComposerNotepadDraft() {
  if (typeof window === 'undefined') {
    return { title: '', lyrics: '', memo: '' };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMPOSER_NOTEPAD_STORAGE_KEY) ?? '{}');
    return {
      title: typeof parsed.title === 'string' ? parsed.title : '',
      lyrics: typeof parsed.lyrics === 'string' ? parsed.lyrics : '',
      memo: typeof parsed.memo === 'string' ? parsed.memo : '',
    };
  } catch {
    return { title: '', lyrics: '', memo: '' };
  }
}

const tabLabels: Record<ComposerTab, string> = {
  melody: '멜로디',
  lyrics: '작사',
  violin: '바이올린',
  saxophone: '색소폰',
  guitar: '통기타',
  glockenspiel: '글로켄슈필',
  piccolo: '피콜로',
  supportingPiano: '서포팅 캐스트 피아노',
  chicagoStreet: '시카고 스트리트',
  studioAltoSax: '알토 색소폰',
  drums: '드럼',
  bass: '베이스',
};

const tabPickerLabels: Record<ComposerTab, string> = {
  melody: '멜로디',
  lyrics: '작사',
  violin: '바이올린',
  saxophone: '색소폰',
  guitar: '통기타',
  glockenspiel: '글로켄슈필',
  piccolo: '피콜로',
  supportingPiano: '서포팅 캐스트 피아노',
  chicagoStreet: '시카고 스트리트',
  studioAltoSax: '알토 색소폰',
  drums: '드럼',
  bass: '베이스',
};

const composerInstrumentLabels: Record<ComposerTab, string> = {
  melody: '멜로디',
  lyrics: '작사',
  violin: '바이올린',
  saxophone: '색소폰',
  guitar: '기타',
  glockenspiel: '글로켄슈필',
  piccolo: '피콜로',
  supportingPiano: '서포팅 캐스트 피아노',
  chicagoStreet: '시카고 스트리트',
  studioAltoSax: '알토 색소폰',
  drums: '드럼',
  bass: '베이스',
};

type ComposerHelpZone = 'length' | 'chords' | 'instruments';
type LyricsViewMode = 'notes' | 'full';

const composerHelpPanels: Record<
  ComposerHelpZone,
  {
    title: string;
    description: string;
    gif: string;
  }
> = {
  length: {
    title: '음 길이 선택',
    description: '1/16, 1/8, 1/4, 1/2, 1 Bar 버튼으로 새로 찍는 음의 길이를 정해요.',
    gif: '/help/note-grid.gif?v=4',
  },
  chords: {
    title: '코드 버튼 사용',
    description: 'C D E F G A B 버튼을 드래그해서 코드 음을 빠르게 넣어요.',
    gif: '/help/chord-buttons.gif?v=3',
  },
  instruments: {
    title: '악기 추가',
    description: '+ 버튼을 눌러 통기타, 베이스, 에어 악기 같은 악기를 추가해요.',
    gif: '/help/note-length.gif?v=4',
  },
};

const tabOrder: ComposerTab[] = [
  'melody',
  'lyrics',
  'guitar',
  'glockenspiel',
  'piccolo',
  'supportingPiano',
  'chicagoStreet',
  'studioAltoSax',
  'drums',
  'bass',
];
const DEFAULT_OPEN_TABS: ComposerTab[] = ['melody', 'drums', 'bass'];

function includeDefaultComposerTabs(tabs: ComposerTab[]) {
  return tabOrder.filter((tab) => DEFAULT_OPEN_TABS.includes(tab) || tabs.includes(tab));
}

const tabPickerGroups: TabPickerGroup[] = [
  {
    title: '기본 파트',
    options: ['melody', 'lyrics', 'drums', 'bass'],
  },
  {
    title: '악기 트랙',
    options: [
      'guitar',
      'glockenspiel',
      'piccolo',
      'supportingPiano',
      'chicagoStreet',
      'studioAltoSax',
    ],
  },
  {
    title: '영상 · 라이브',
    options: ['videoOverlay', 'airInstrument'],
  },
];
const COLLAB_BAR_LENGTH = 16;

function getCollabInstrumentForTab(tab: ComposerTab): CollabComposerInstrument {
  if (tab === 'lyrics') {
    return 'melody';
  }

  return tab;
}

function getVolumeInstrumentForTab(tab: ComposerTab): InstrumentKey {
  if (tab === 'lyrics') {
    return 'melody';
  }

  return tab;
}

function getMelodyInstrumentForTab(tab: ComposerTab): MelodyInstrument | null {
  if (tab === 'melody') {
    return 'piano';
  }

  return null;
}

function clampGuideStepIndex(value: number) {
  const safeValue = Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(COMPOSER_GUIDE_STEPS.length - 1, Math.max(0, safeValue));
}

function findMelodyNoteForTutorial(
  melodyRow: boolean[],
  melodyLengthRow: number[],
  col: number
) {
  for (let start = 0; start <= col; start += 1) {
    if (!melodyRow[start]) {
      continue;
    }

    const length = Math.max(1, melodyLengthRow[start] ?? 1);
    if (col < start + length) {
      return { start, length };
    }
  }

  return null;
}

function countMatchedChordTargets(
  melody: boolean[][],
  targets: ComposerTutorialChordTarget[]
) {
  return targets.filter((target) => target.rows.every((row) => melody[row]?.[target.col])).length;
}

function countMatchedMelodyTargets(
  melody: boolean[][],
  melodyLengths: number[][],
  targets: ComposerTutorialNoteTarget[]
) {
  return targets.filter((target) => {
    const noteInfo = findMelodyNoteForTutorial(
      melody[target.row] ?? [],
      melodyLengths[target.row] ?? [],
      target.col
    );

    return Boolean(noteInfo && noteInfo.start === target.col && noteInfo.length >= target.length);
  }).length;
}

function countMatchedCellTargets(grid: boolean[][], targets: ComposerTutorialCellTarget[]) {
  return targets.filter((target) => grid[target.row]?.[target.col]).length;
}

function hasAnyGridNotes(grid: boolean[][]) {
  return grid.some((row) => row.some(Boolean));
}

function hasOnlyMelodyTrackData(state: ReturnType<typeof useSongStore.getState>) {
  return (
    hasAnyGridNotes(state.melody) &&
    !hasAnyGridNotes(state.violin) &&
    !hasAnyGridNotes(state.saxophone) &&
    !hasAnyGridNotes(state.guitar) &&
    !hasAnyGridNotes(state.drums) &&
    !hasAnyGridNotes(state.bass) &&
    !state.extraTracks.some((track) => hasAnyGridNotes(track.grid))
  );
}

const drumTracks = [
  { name: 'Kick', hint: 'Low-end pulse', tone: 'kick' },
  { name: 'Snare', hint: 'Backbeat snap', tone: 'snare' },
  { name: 'Hi-Hat', hint: 'Fast groove', tone: 'hat' },
  { name: 'Clap', hint: 'Accent layer', tone: 'clap' },
  { name: 'Percussion', hint: 'Extra groove', tone: 'perc' },
] as const;

const melodyLaneColors = [
  '#60a5fa',
  '#34d399',
  '#a78bfa',
  '#f472b6',
  '#38bdf8',
  '#facc15',
] as const;

const bassLaneColors = [
  '#fb7185',
  '#f59e0b',
  '#4ade80',
  '#22d3ee',
  '#818cf8',
  '#c084fc',
  '#38bdf8',
  '#f97316',
  '#34d399',
  '#facc15',
] as const;

const guitarLaneColors = ['#f59e0b', '#fb923c', '#fbbf24', '#fdba74', '#f97316', '#fcd34d'] as const;
const violinLaneColors = ['#fb7185', '#f472b6', '#c084fc', '#f9a8d4', '#fb7185', '#c084fc'] as const;
const saxophoneLaneColors = ['#facc15', '#f59e0b', '#f97316', '#fcd34d', '#fbbf24', '#f59e0b'] as const;
const glockenspielLaneColors = ['#7dd3fc', '#38bdf8', '#a7f3d0', '#67e8f9', '#93c5fd', '#5eead4'] as const;
const piccoloLaneColors = ['#bbf7d0', '#86efac', '#c4b5fd', '#a7f3d0', '#93c5fd', '#5eead4'] as const;
const supportingPianoLaneColors = ['#cbd5e1', '#94a3b8', '#e5e7eb', '#a5b4fc', '#bae6fd', '#d1d5db'] as const;
const chicagoStreetLaneColors = ['#fda4af', '#fb7185', '#f0abfc', '#f9a8d4', '#fca5a5', '#e879f9'] as const;
const studioAltoSaxLaneColors = ['#fde68a', '#fbbf24', '#f59e0b', '#fcd34d', '#fdba74', '#facc15'] as const;

type SampledInstrumentKey =
  | 'glockenspiel'
  | 'piccolo'
  | 'supportingPiano'
  | 'chicagoStreet'
  | 'studioAltoSax';
type PitchedTab = 'melody' | 'violin' | 'saxophone' | 'guitar' | 'bass' | SampledInstrumentKey;
type InstrumentComposerTab = Exclude<ComposerTab, 'lyrics'>;
type ComposerTabItem = {
  id: string;
  tab: ComposerTab;
  label: string;
  trackId?: string;
};
type MelodyLyricNote = {
  row: number;
  col: number;
  note: string;
  length: number;
  lyric: string;
};
type MelodySequencerOptions = {
  scrollKey?: string;
  melodyLengths?: number[][];
  noteLengthSteps?: MelodyNoteLengthSteps;
  onNoteLengthChange?: (steps: MelodyNoteLengthSteps) => void;
  showNoteLengthControls?: boolean;
  showChordControls?: boolean;
  chordChipClassName?: string;
};

type ArrangementTrackDefinition = {
  id: string;
  key?: string;
  trackId?: string;
  label: string;
  icon: string;
  tab: InstrumentComposerTab;
  tone: 'mint' | 'blue' | 'violet' | 'coral' | 'gold';
};

const arrangementTrackDefinitions: ArrangementTrackDefinition[] = [
  { id: 'melody', label: '멜로디', icon: '♪', tab: 'melody', tone: 'mint' },
  { id: 'piano', label: '피아노', icon: '♬', tab: 'supportingPiano', tone: 'blue' },
  { id: 'support', label: '서포트 캐스트', icon: '≋', tab: 'glockenspiel', tone: 'violet' },
  { id: 'drums', label: '드럼', icon: '◉', tab: 'drums', tone: 'coral' },
  { id: 'bass', label: '베이스', icon: '⌁', tab: 'bass', tone: 'gold' },
];

function getDefaultArrangementClipLayout(
  trackIndex: number,
  section: 'first' | 'second'
): ArrangementClipLayout {
  const firstStarts = [1.4, 5, 8, 8, 8];
  const firstLengths = [36, 37, 41, 38, 38];
  const secondStarts = [43, 50, 58, 50, 50];
  const secondLengths = [48, 47, 39, 42, 42];
  const index = trackIndex % firstStarts.length;

  return section === 'first'
    ? { start: firstStarts[index], length: firstLengths[index] }
    : { start: secondStarts[index], length: secondLengths[index] };
}

function buildArrangementClipPreview(
  grid: boolean[][],
  lengths: number[][] | undefined,
  startStep: number,
  endStep: number
): ArrangementClipPreview {
  const safeStart = Math.max(0, Math.floor(startStep));
  const safeEnd = Math.max(safeStart + 1, Math.ceil(endStep));
  const span = safeEnd - safeStart;
  const pitches: Array<number | null> = [];

  for (let col = safeStart; col < safeEnd; col += 1) {
    const activeRows: number[] = [];
    grid.forEach((rowValues, row) => {
      let active = Boolean(rowValues[col]);
      if (!active && lengths?.[row]) {
        for (let noteStart = 0; noteStart < col; noteStart += 1) {
          if (
            rowValues[noteStart] &&
            noteStart + Math.max(1, lengths[row]?.[noteStart] ?? 1) > col
          ) {
            active = true;
            break;
          }
        }
      }
      if (active) activeRows.push(row);
    });

    pitches.push(
      activeRows.length
        ? activeRows.reduce((sum, row) => sum + row, 0) / activeRows.length
        : null
    );
  }

  const activityRanges: Array<{ start: number; width: number }> = [];
  let rangeStart: number | null = null;
  pitches.forEach((pitch, index) => {
    if (pitch !== null && rangeStart === null) rangeStart = index;
    const isRangeEnd = rangeStart !== null && (pitch === null || index === pitches.length - 1);
    if (!isRangeEnd || rangeStart === null) return;
    const exclusiveEnd = pitch === null ? index : index + 1;
    activityRanges.push({
      start: (rangeStart / span) * 100,
      width: Math.max(1.2, ((exclusiveEnd - rangeStart) / span) * 100),
    });
    rangeStart = null;
  });

  const pitchSegments: string[] = [];
  let segment: string[] = [];
  pitches.forEach((pitch, index) => {
    if (pitch === null) {
      if (segment.length) pitchSegments.push(segment.join(' '));
      segment = [];
      return;
    }

    const x = ((index + 0.5) / span) * 100;
    const y = grid.length > 1 ? 3 + (pitch / (grid.length - 1)) * 18 : 12;
    if (!segment.length) {
      segment.push(`${Math.max(0, x - 0.4).toFixed(2)},${y.toFixed(2)}`);
    }
    segment.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });
  if (segment.length) pitchSegments.push(segment.join(' '));

  return {
    hasAudio: pitches.some((pitch) => pitch !== null),
    activityRanges,
    pitchSegments,
  };
}

function getArrangementTrackTone(tab: InstrumentComposerTab): ArrangementTrackDefinition['tone'] {
  if (tab === 'drums') return 'coral';
  if (tab === 'bass') return 'gold';
  if (tab === 'supportingPiano' || tab === 'guitar') return 'blue';
  if (tab === 'glockenspiel' || tab === 'piccolo') return 'violet';
  return 'mint';
}

const COMPOSER_TAB_STORAGE_KEY = 'song-maker-composer-tabs';

function isComposerTab(value: unknown): value is ComposerTab {
  return typeof value === 'string' && (tabOrder as readonly string[]).includes(value);
}

function isSampledInstrumentTab(tab: ComposerTab): tab is SampledInstrumentKey {
  return (
    tab === 'glockenspiel' ||
    tab === 'piccolo' ||
    tab === 'supportingPiano' ||
    tab === 'chicagoStreet' ||
    tab === 'studioAltoSax'
  );
}

function isPitchedTab(tab: ComposerTab): tab is PitchedTab {
  return tab !== 'lyrics' && tab !== 'drums';
}

function readComposerTabDraft() {
  if (typeof window === 'undefined') {
    return {
      openTabs: DEFAULT_OPEN_TABS,
      openExtraTrackIds: [] as string[],
      activeTrackId: null as string | null,
    };
  }

  try {
    const rawValue = window.localStorage.getItem(COMPOSER_TAB_STORAGE_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : null;

    const openTabs = Array.isArray(parsed?.openTabs)
      ? parsed.openTabs.filter(isComposerTab)
      : [];

    return {
      openTabs: includeDefaultComposerTabs(openTabs),
      openExtraTrackIds: Array.isArray(parsed?.openExtraTrackIds)
        ? parsed.openExtraTrackIds.filter((value: unknown): value is string => typeof value === 'string')
        : [],
      activeTrackId:
        typeof parsed?.activeTrackId === 'string' ? parsed.activeTrackId : null,
    };
  } catch {
    return {
      openTabs: DEFAULT_OPEN_TABS,
      openExtraTrackIds: [] as string[],
      activeTrackId: null as string | null,
    };
  }
}

function getSubdivisionClassName(col: number) {
  return `${col % 2 === 0 ? ' is-eighth' : ''}${col % 4 === 0 ? ' is-quarter' : ''}${
    col % 8 === 0 ? ' is-half' : ''
  }${col % 16 === 0 ? ' is-bar' : ''}`;
}

function isSharpNote(note: unknown) {
  return typeof note === 'string' && (note.includes('#') || note.includes('_sharp'));
}

export function Composer() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const tutorialCompletedByEmail = useAuthStore(
    (state) => state.profilesByEmail[user?.email ?? '']?.composerTutorialCompleted ?? false
  );
  const markComposerTutorialCompleted = useAuthStore((state) => state.markComposerTutorialCompleted);
  const {
    compositionMode,
    bpm,
    tempoAutomation,
    steps,
    noteLyrics,
    melody,
    melodyLengths,
    melodyVelocities,
    violin,
    violinLengths,
    saxophone,
    saxophoneLengths,
    guitar,
    guitarLengths,
    drums,
    bass,
    bassLengths,
    extraTracks,
    isPlaying,
    volumes,
    setInstrumentVolume,
    addInstrumentTrack,
    duplicateInstrumentTrack,
    removeInstrumentTrack,
    clearInstrument,
    toggleExtraTrackCell,
    applyExtraTrackChord,
    setExtraTrackVolume,
    toggleViolin,
    toggleSaxophone,
    toggleGuitar,
    toggleDrum,
    toggleBass,
    applyChord,
    currentStep,
    setCurrentStep,
    setBpm,
    setSteps,
    setMelodyLyric,
    loopRange,
    setLoopRange,
    loadProject,
    applyRemoteProject,
    projectLoadRevision,
    clear,
  } = useSongStore();
  const { activeTab, setActiveTab, setInstrument } = useUIStore();
  const projects = useCollabStore((state) => state.projects);
  const connectionStatus = useCollabStore((state) => state.connectionStatus);
  const connectionError = useCollabStore((state) => state.connectionError);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const updateComposerSnapshot = useCollabStore((state) => state.updateComposerSnapshot);
  const applyComposerOperation = useCollabStore((state) => state.applyComposerOperation);
  const setComposerLock = useCollabStore((state) => state.setComposerLock);
  const touchPresence = useCollabStore((state) => state.touchPresence);
  const leavePresence = useCollabStore((state) => state.leavePresence);
  const presenceByProject = useCollabStore((state) => state.presenceByProject);
  const composerLocksByProject = useCollabStore((state) => state.composerLocksByProject);
  const composerHistoryByProject = useCollabStore((state) => state.composerHistoryByProject);
  const libraryProjects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const collabId = searchParams.get('collab');
  const projectId = searchParams.get('project');
  const newProjectRequested = searchParams.get('new') === '1';
  const tutorialRequested = false;
  const requestedGuideStep = Number(searchParams.get('guideStep') ?? '0');
  const collabProject = useMemo(
    () => (collabId ? projects.find((project) => project.id === collabId) ?? null : null),
    [collabId, projects]
  );
  const loadedLibraryProject = useMemo(
    () => (projectId ? libraryProjects.find((project) => project.id === projectId) ?? null : null),
    [libraryProjects, projectId]
  );
  const collabMember = useMemo(
    () =>
      collabProject && user
        ? collabProject.members.find((member) => member.email === user.email) ?? null
        : null,
    [collabProject, user]
  );
  const canSyncCollab = Boolean(collabMember && collabMember.role !== 'viewer');
  const lastAppliedRevisionRef = useRef(0);
  const lastSentSignatureRef = useRef('');
  const hasLoadedCollabRef = useRef(false);
  const isApplyingRemoteRef = useRef(false);
  const syncTimeoutRef = useRef<number | null>(null);
  const conflictTimeoutRef = useRef<number | null>(null);
  const pendingOperationSignatureRef = useRef<string | null>(null);
  const operationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const heldBarLocksRef = useRef(new Set<string>());
  const loadedProjectIdRef = useRef<string | null>(null);
  const followScrollFrameRef = useRef<number | null>(null);
  const livePlayheadRef = useRef({ step: 0, bpm: 120, receivedAt: 0 });
  const liveVisualStepRef = useRef(-1);
  const isPlayingRef = useRef(false);
  const liveStepElementsRef = useRef<HTMLElement[]>([]);
  const liveStepElementCacheRef = useRef(new Map<number, HTMLElement[]>());
  const livePianoPlayheadsRef = useRef<HTMLElement[]>([]);
  const liveSequencerPlayheadsRef = useRef<HTMLElement[]>([]);
  const liveArrangementPlayheadsRef = useRef<HTMLElement[]>([]);
  const liveScrollerPairsRef = useRef<
    Array<{ scroller: HTMLElement; header: HTMLElement | null; stepSpan: number }>
  >([]);
  const liveDrumScrollersRef = useRef<HTMLElement[]>([]);
  const [conflictNotice, setConflictNotice] = useState('');
  const [collabSyncTick, setCollabSyncTick] = useState(0);
  const tutorialCompleted = Boolean(user?.email && tutorialCompletedByEmail);
  const isGuideOpen = tutorialRequested && !tutorialCompleted;
  const guideStepIndex = clampGuideStepIndex(
    Number.isFinite(requestedGuideStep) ? requestedGuideStep : 0
  );
  const [visitedTabs, setVisitedTabs] = useState<ComposerTab[]>([]);
  const [openTabsState, setOpenTabsState] = useState<ComposerTab[]>(
    () => (newProjectRequested ? DEFAULT_OPEN_TABS : readComposerTabDraft().openTabs)
  );

  useEffect(() => {
    if (compositionMode === 'soloPiano') return;

    setOpenTabsState((current) => {
      const next = includeDefaultComposerTabs(current);
      return next.length === current.length && next.every((tab, index) => tab === current[index])
        ? current
        : next;
    });
  }, [compositionMode]);

  const [openExtraTrackIds, setOpenExtraTrackIds] = useState<string[]>(
    () => (newProjectRequested ? [] : readComposerTabDraft().openExtraTrackIds)
  );
  const [activeTrackId, setActiveTrackId] = useState<string | null>(
    () => (newProjectRequested ? null : readComposerTabDraft().activeTrackId)
  );
  const [mutedArrangementTracks, setMutedArrangementTracks] = useState<Set<string>>(
    () => new Set()
  );
  const [soloArrangementTrack, setSoloArrangementTrack] = useState<string | null>(null);
  const [openTrackMenuId, setOpenTrackMenuId] = useState<string | null>(null);
  const [hiddenArrangementTrackIds, setHiddenArrangementTrackIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isArrangementCollapsed, setIsArrangementCollapsed] = useState(false);
  const [pianoEditTool, setPianoEditTool] = useState<PianoEditTool>('select');
  const [pianoZoom, setPianoZoom] = useState(1);
  const [pianoToolFeedback, setPianoToolFeedback] = useState('');
  const [arrangementClipLayouts, setArrangementClipLayouts] = useState<
    Record<string, ArrangementClipLayout>
  >({});
  const [selectedArrangementClip, setSelectedArrangementClip] = useState<string | null>(null);
  const [draggingArrangementClip, setDraggingArrangementClip] = useState<string | null>(null);
  const [pianoSelection, setPianoSelection] = useState<PianoSelection | null>(null);
  const [pianoMarqueeOrigin, setPianoMarqueeOrigin] = useState<{
    scrollKey: string;
    row: number;
    col: number;
  } | null>(null);
  const mutedVolumeSnapshotRef = useRef<Record<string, number>>({});
  const soloVolumeSnapshotRef = useRef<Record<string, number> | null>(null);
  const pianoToolFeedbackTimerRef = useRef<number | null>(null);
  const [extraTrackNoteLengths, setExtraTrackNoteLengths] = useState<Record<string, MelodyNoteLengthSteps>>({});
  const [primaryTrackNoteLengths, setPrimaryTrackNoteLengths] = useState<
    Record<PitchedTab, MelodyNoteLengthSteps>
  >({
    melody: 4,
    violin: 4,
    saxophone: 4,
    guitar: 4,
    glockenspiel: 4,
    piccolo: 4,
    supportingPiano: 4,
    chicagoStreet: 4,
    studioAltoSax: 4,
    bass: 4,
  });

  useEffect(() => {
    if (bpm === 92 || bpm === 100) {
      setBpm(172);
    }
  }, [bpm, setBpm]);

  const showPianoToolFeedback = useCallback((message: string) => {
    setPianoToolFeedback(message);
    if (pianoToolFeedbackTimerRef.current !== null) {
      window.clearTimeout(pianoToolFeedbackTimerRef.current);
    }
    pianoToolFeedbackTimerRef.current = window.setTimeout(() => {
      setPianoToolFeedback('');
      pianoToolFeedbackTimerRef.current = null;
    }, 1600);
  }, []);

  useEffect(
    () => () => {
      if (pianoToolFeedbackTimerRef.current !== null) {
        window.clearTimeout(pianoToolFeedbackTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!openTrackMenuId) return undefined;

    const handleTrackMenuOutsideClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('.composer-track-context-menu') || target.closest('.composer-track-more')) {
        return;
      }
      setOpenTrackMenuId(null);
    };

    window.addEventListener('mousedown', handleTrackMenuOutsideClick);
    return () => window.removeEventListener('mousedown', handleTrackMenuOutsideClick);
  }, [openTrackMenuId]);
  const [isTabPickerOpen, setIsTabPickerOpen] = useState(false);
  const [videoOverlay, setVideoOverlay] = useState<{ url: string; name: string } | null>(null);
  const [videoOverlayVolume, setVideoOverlayVolume] = useState(1);
  const [isVideoOverlayMuted, setIsVideoOverlayMuted] = useState(false);
  const [videoOverlayAudioMessage, setVideoOverlayAudioMessage] = useState('');
  const [isMediaOverlayCompact, setIsMediaOverlayCompact] = useState(false);
  const [isHelpOverlayEnabled, setIsHelpOverlayEnabled] = useState(false);
  const [activeHelpZone, setActiveHelpZone] = useState<ComposerHelpZone | null>(null);
  const [lyricsViewMode, setLyricsViewMode] = useState<LyricsViewMode>('notes');
  const [isNotepadOpen, setIsNotepadOpen] = useState(true);
  const [notepadMode, setNotepadMode] = useState<ComposerNotepadMode>('lyrics');
  const [notepadDraft, setNotepadDraft] = useState(readComposerNotepadDraft);
  const [helpOverlayPosition, setHelpOverlayPosition] = useState({ x: 18, y: 126 });
  const [playedTutorialOnce, setPlayedTutorialOnce] = useState(false);
  const [tabPickerMenuPosition, setTabPickerMenuPosition] = useState<{
    top: number;
    left: number;
    minWidth: number;
    maxHeight: number;
  } | null>(null);
  const [pitchedRollScrollLeft, setPitchedRollScrollLeft] = useState<Record<string, number>>({
    melody: 0,
    violin: 0,
    saxophone: 0,
    guitar: 0,
    bass: 0,
  });
  const arrangementBarCount = Math.max(1, Math.ceil(steps / COLLAB_BAR_LENGTH));
  const arrangementTimelineBars = useMemo(
    () =>
      Array.from(
        { length: Math.ceil(arrangementBarCount / 4) },
        (_, index) => index * 4 + 1
      ),
    [arrangementBarCount]
  );
  const [pitchedRollScrollTop, setPitchedRollScrollTop] = useState<Record<string, number>>({});
  const tutorialAdvanceTimeoutRef = useRef<number | null>(null);
  const lastAutoAdvancedStepRef = useRef<number | null>(null);
  const tutorialCameraTimeoutRef = useRef<number | null>(null);
  const tabStripRef = useRef<HTMLDivElement | null>(null);
  const tabPickerRef = useRef<HTMLDivElement | null>(null);
  const tabAddButtonRef = useRef<HTMLButtonElement | null>(null);
  const videoOverlayInputRef = useRef<HTMLInputElement | null>(null);
  const videoOverlayPlayerRef = useRef<HTMLVideoElement | null>(null);
  const videoOverlayUrlRef = useRef('');
  const mixerStripRef = useRef<HTMLDivElement | null>(null);
  const mainViewportRef = useRef<HTMLElement | null>(null);
  const melodyChordBarRef = useRef<HTMLElement | null>(null);
  const melodyRollRef = useRef<HTMLElement | null>(null);
  const drumShellRef = useRef<HTMLElement | null>(null);
  const bassShellRef = useRef<HTMLElement | null>(null);
  const footerRef = useRef<HTMLElement | null>(null);
  const openTabs = useMemo(() => {
    if (tutorialRequested) {
      return [...tabOrder];
    }

    return tabOrder.filter((tab) => openTabsState.includes(tab));
  }, [openTabsState, tutorialRequested]);
  const getExtraTrackDisplayLabel = useCallback(
    (track: ExtraInstrumentTrack) => {
      const sameInstrumentTracks = extraTracks.filter((item) => item.instrument === track.instrument);
      const trackIndex = sameInstrumentTracks.findIndex((item) => item.id === track.id);
      const hasPrimaryTrack = ['melody', 'violin', 'saxophone', 'guitar', 'drums', 'bass'].includes(
        track.instrument
      );
      const labelNumber = trackIndex + (hasPrimaryTrack ? 2 : 1);
      const baseLabel = tabPickerLabels[track.instrument as ComposerTab] ?? track.label;

      return labelNumber === 1 ? baseLabel : `${baseLabel} ${labelNumber}`;
    },
    [extraTracks]
  );

  useEffect(() => {
    if (!newProjectRequested) {
      return;
    }

    clear();
    window.localStorage.setItem(
      COMPOSER_TAB_STORAGE_KEY,
      JSON.stringify({
        openTabs: DEFAULT_OPEN_TABS,
        openExtraTrackIds: [],
        activeTrackId: null,
      })
    );
    setOpenTabsState(DEFAULT_OPEN_TABS);
    setOpenExtraTrackIds([]);
    setActiveTrackId(null);
    setVisitedTabs([]);
    navigate('/composer', { replace: true });
  }, [clear, navigate, newProjectRequested]);

  const isActivePrimaryTabOpen = !activeTrackId && openTabsState.includes(activeTab);
  const openTabItems = useMemo<ComposerTabItem[]>(() => {
    return tabOrder.flatMap((tab) => {
      const items: ComposerTabItem[] = [];

      if (openTabs.includes(tab)) {
        items.push({
          id: `primary-${tab}`,
          tab,
          label: tabLabels[tab],
        });
      }

      if (tab !== 'lyrics') {
        extraTracks
          .filter((track) => track.instrument === tab && openExtraTrackIds.includes(track.id))
          .forEach((track) => {
            items.push({
              id: `extra-${track.id}`,
              tab,
              trackId: track.id,
              label: getExtraTrackDisplayLabel(track),
            });
          });
      }

      return items;
    });
  }, [extraTracks, getExtraTrackDisplayLabel, openExtraTrackIds, openTabs]);
  const arrangementVisibleTracks = useMemo<ArrangementTrackDefinition[]>(() => {
    const representedItemIds = new Set<string>();
    const baseTracks = arrangementTrackDefinitions.filter(
      (track) => {
        if (hiddenArrangementTrackIds.has(track.id)) return false;
        if (track.id === 'piano' || track.id === 'support') {
          return openTabItems.some((item) => item.tab === track.tab && Boolean(item.trackId));
        }
        return openTabsState.includes(track.tab);
      }
    ).map((track) => {
      const usesExtraTrackAsBase = track.id === 'piano' || track.id === 'support';
      const matchingItem = usesExtraTrackAsBase
        ? openTabItems.find(
            (item) => item.tab === track.tab && Boolean(item.trackId) && !representedItemIds.has(item.id)
          )
        : undefined;
      if (matchingItem) representedItemIds.add(matchingItem.id);

      return {
        ...track,
        key: `base-${track.id}`,
        trackId: matchingItem?.trackId,
      };
    });

    const dynamicTracks = openTabItems
      .filter((item) => {
        if (item.tab === 'lyrics' || representedItemIds.has(item.id)) return false;
        return !['primary-melody', 'primary-drums', 'primary-bass'].includes(item.id);
      })
      .map((item) => ({
        id: `added-${item.id}`,
        key: `added-${item.id}`,
        trackId: item.trackId,
        label: item.label,
        icon: item.tab === 'drums' ? '◉' : item.tab === 'bass' ? '⌁' : '♫',
        tab: item.tab as InstrumentComposerTab,
        tone: getArrangementTrackTone(item.tab as InstrumentComposerTab),
      }));

    return [...baseTracks, ...dynamicTracks];
  }, [hiddenArrangementTrackIds, openTabItems, openTabsState]);
  const activeExtraTrack = useMemo(
    () => extraTracks.find((track) => track.id === activeTrackId) ?? null,
    [activeTrackId, extraTracks]
  );
  const getArrangementTrackData = useCallback(
    (track: ArrangementTrackDefinition) => {
      const extraTrack = track.trackId
        ? extraTracks.find((item) => item.id === track.trackId)
        : isSampledInstrumentTab(track.tab)
          ? extraTracks.find((item) => item.instrument === track.tab)
          : null;
      if (extraTrack) {
        return { grid: extraTrack.grid, lengths: extraTrack.melodyLengths };
      }

      switch (track.tab) {
        case 'melody':
          return { grid: melody, lengths: melodyLengths };
        case 'violin':
          return { grid: violin, lengths: violinLengths };
        case 'saxophone':
          return { grid: saxophone, lengths: saxophoneLengths };
        case 'guitar':
          return { grid: guitar, lengths: guitarLengths };
        case 'drums':
          return { grid: drums, lengths: undefined };
        case 'bass':
          return { grid: bass, lengths: bassLengths };
        default:
          return { grid: [] as boolean[][], lengths: undefined };
      }
    },
    [
      bass,
      bassLengths,
      drums,
      extraTracks,
      guitar,
      guitarLengths,
      melody,
      melodyLengths,
      saxophone,
      saxophoneLengths,
      violin,
      violinLengths,
    ]
  );

  const melodyLyricNotes = useMemo(() => {
    const items: MelodyLyricNote[] = [];

    melody.forEach((rowValues, row) => {
      rowValues.forEach((active, col) => {
        if (!active) {
          return;
        }

        items.push({
          row,
          col,
          note: MELODY_NOTES[row] ?? '',
          length: melodyLengths[row]?.[col] ?? 1,
          lyric: noteLyrics[`${row}-${col}`] ?? '',
        });
      });
    });

    return items.sort((left, right) => left.col - right.col || left.row - right.row);
  }, [melody, melodyLengths, noteLyrics]);
  const activeHelpPanel = activeHelpZone ? composerHelpPanels[activeHelpZone] : null;
  const getTabPickerLabel = (tab: TabPickerOption) => {
    if (tab === 'airInstrument') {
      return '에어 악기';
    }

    if (tab === 'videoOverlay') {
      return videoOverlay ? `영상 · ${videoOverlay.name}` : '영상 오버레이';
    }

    const openCount =
      (openTabs.includes(tab) ? 1 : 0) +
      (tab === 'lyrics' ? 0 : extraTracks.filter((track) => track.instrument === tab).length);

    return openCount > 1 ? `${tabPickerLabels[tab]} ${openCount}개` : tabPickerLabels[tab];
  };

  useEffect(() => {
    return () => {
      if (videoOverlayUrlRef.current) {
        URL.revokeObjectURL(videoOverlayUrlRef.current);
      }
    };
  }, []);

  const handleSelectVideoOverlay = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!file.type.startsWith('video/')) {
      window.alert('영상 파일을 선택해주세요.');
      return;
    }

    if (videoOverlayUrlRef.current) {
      URL.revokeObjectURL(videoOverlayUrlRef.current);
    }

    const url = URL.createObjectURL(file);
    videoOverlayUrlRef.current = url;
    setVideoOverlay({ url, name: file.name });
    setVideoOverlayVolume(1);
    setIsVideoOverlayMuted(false);
    setVideoOverlayAudioMessage('');
    setIsMediaOverlayCompact(false);
  };

  const handleVideoOverlayVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextVolume = Number(event.target.value);
    setVideoOverlayVolume(nextVolume);
    setIsVideoOverlayMuted(nextVolume === 0);
  };

  const handleToggleVideoOverlayMute = () => {
    setIsVideoOverlayMuted((current) => !current);
  };

  const applyVideoOverlayAudioSettings = useCallback(
    (video: HTMLVideoElement) => {
      video.defaultMuted = false;
      video.removeAttribute('muted');
      video.muted = isVideoOverlayMuted;
      video.volume = videoOverlayVolume;
    },
    [isVideoOverlayMuted, videoOverlayVolume]
  );

  useEffect(() => {
    const player = videoOverlayPlayerRef.current;
    if (!player) {
      return;
    }

    applyVideoOverlayAudioSettings(player);
  }, [applyVideoOverlayAudioSettings, videoOverlay]);

  const handleVideoOverlayPlay = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    applyVideoOverlayAudioSettings(event.currentTarget);
  };

  const handlePlayVideoOverlayWithSound = async () => {
    const video = videoOverlayPlayerRef.current;
    if (!video) {
      return;
    }

    setIsVideoOverlayMuted(false);
    setVideoOverlayVolume(1);
    video.defaultMuted = false;
    video.removeAttribute('muted');
    video.muted = false;
    video.volume = 1;

    try {
      await video.play();
      window.setTimeout(() => {
        const media = video as HTMLVideoElement & {
          webkitAudioDecodedByteCount?: number;
          audioTracks?: { length: number };
        };
        const hasKnownAudioTrack =
          (media.audioTracks?.length ?? 0) > 0 ||
          (media.webkitAudioDecodedByteCount ?? 0) > 0;

        setVideoOverlayAudioMessage(
          hasKnownAudioTrack
            ? '영상 소리가 켜졌습니다.'
            : '이 MP4에서 재생 가능한 오디오 트랙을 찾지 못했습니다.'
        );
      }, 1200);
    } catch {
      setVideoOverlayAudioMessage('브라우저가 영상 소리 재생을 차단했습니다. 다시 눌러주세요.');
    }
  };

  const handleCloseVideoOverlay = useCallback(() => {
    if (videoOverlayUrlRef.current) {
      URL.revokeObjectURL(videoOverlayUrlRef.current);
      videoOverlayUrlRef.current = '';
    }

    setVideoOverlay(null);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      COMPOSER_TAB_STORAGE_KEY,
      JSON.stringify({
        openTabs: openTabsState,
        openExtraTrackIds,
        activeTrackId,
      })
    );
  }, [activeTrackId, openExtraTrackIds, openTabsState]);

  useEffect(() => {
    window.localStorage.setItem(COMPOSER_NOTEPAD_STORAGE_KEY, JSON.stringify(notepadDraft));
  }, [notepadDraft]);

  const updateHelpOverlayPosition = (event: { clientX: number; clientY: number }) => {
    const cardWidth = 460;
    const cardHeight = 410;
    const gap = 14;
    const padding = 12;
    const maxX = Math.max(padding, window.innerWidth - cardWidth - padding);
    const belowY = event.clientY + gap;
    const aboveY = event.clientY - cardHeight - gap;

    setHelpOverlayPosition({
      x: Math.min(Math.max(padding, event.clientX), maxX),
      y:
        belowY + cardHeight <= window.innerHeight - padding
          ? belowY
          : Math.max(padding, aboveY),
    });
  };

  const handleHelpZoneEnter = (
    zone: ComposerHelpZone,
    event?: { clientX: number; clientY: number }
  ) => {
    if (!isHelpOverlayEnabled) {
      return;
    }

    if (event) {
      updateHelpOverlayPosition(event);
    }
    setActiveHelpZone(zone);
  };

  const handleHelpZoneMove = (
    zone: ComposerHelpZone,
    event: { clientX: number; clientY: number }
  ) => {
    if (!isHelpOverlayEnabled || activeHelpZone !== zone) {
      return;
    }

    updateHelpOverlayPosition(event);
  };

  const handleHelpZoneLeave = (zone: ComposerHelpZone) => {
    setActiveHelpZone((current) => (current === zone ? null : current));
  };

  useEffect(() => {
    if (!extraTracks.length) {
      setOpenExtraTrackIds([]);
      setActiveTrackId(null);
      return;
    }

    setOpenExtraTrackIds((current) => {
      const existingIds = new Set(extraTracks.map((track) => track.id));
      const keptIds = current.filter((id) => existingIds.has(id));
      const missingIds = extraTracks
        .map((track) => track.id)
        .filter((id) => !keptIds.includes(id));

      return [...keptIds, ...missingIds];
    });

    if (activeTrackId && !extraTracks.some((track) => track.id === activeTrackId)) {
      setActiveTrackId(null);
    }
  }, [activeTrackId, extraTracks]);

  useEffect(() => {
    if (
      melody.length !== MELODY_ROWS ||
      melodyLengths.length !== MELODY_ROWS ||
      violin.length !== VIOLIN_ROWS ||
      saxophone.length !== SAXOPHONE_ROWS ||
      guitar.length !== GUITAR_ROWS
    ) {
      setSteps(steps);
    }
  }, [
    guitar.length,
    melody.length,
    melodyLengths.length,
    saxophone.length,
    setSteps,
    steps,
    violin.length,
  ]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;

    if (!isPlaying && followScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(followScrollFrameRef.current);
      followScrollFrameRef.current = null;
    }

    if (!isPlaying) {
      liveVisualStepRef.current = -1;
      livePianoPlayheadsRef.current = [];
      liveSequencerPlayheadsRef.current = [];
      liveArrangementPlayheadsRef.current = [];
      liveScrollerPairsRef.current = [];
      liveDrumScrollersRef.current = [];
      liveStepElementsRef.current.forEach((element) => {
        element.classList.remove('is-current-live');
      });
      liveStepElementsRef.current = [];
      liveStepElementCacheRef.current.clear();

      const exactScrollPositions: Record<string, number> = {};
      document
        .querySelectorAll<HTMLElement>('.piano-roll[data-scroll-key]')
        .forEach((roll) => {
          const scrollKey = roll.dataset.scrollKey;
          const scroller = roll.querySelector<HTMLElement>('.piano-roll-melody-scroller');
          if (scrollKey && scroller) exactScrollPositions[scrollKey] = scroller.scrollLeft;
        });
      if (Object.keys(exactScrollPositions).length) {
        setPitchedRollScrollLeft((current) => ({ ...current, ...exactScrollPositions }));
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    const renderLivePlayhead = () => {
      followScrollFrameRef.current = null;

      if (!isPlayingRef.current) {
        return;
      }

      const liveStepCount = useSongStore.getState().steps;
      const playheadAnchor = livePlayheadRef.current;
      const stepDurationMs = 60_000 / Math.max(1, playheadAnchor.bpm) / 4;
      const stepProgress = Math.min(
        0.999,
        Math.max(0, (window.performance.now() - playheadAnchor.receivedAt) / stepDurationMs)
      );
      const smoothStep = Math.min(
        Math.max(0, liveStepCount - 1),
        Math.max(0, playheadAnchor.step + stepProgress)
      );
      const visualStep = Math.min(
        Math.max(0, liveStepCount - 1),
        Math.max(0, Math.floor(smoothStep))
      );
      const didVisualStepChange = liveVisualStepRef.current !== visualStep;

      if (didVisualStepChange) {
        liveStepElementsRef.current.forEach((element) => {
          element.classList.remove('is-current-live');
        });
        const cachedLiveElements = liveStepElementCacheRef.current.get(visualStep);
        const nextLiveElements =
          cachedLiveElements ??
          [
            ...document.querySelectorAll<HTMLElement>(
              `.piano-roll-step-number[data-playhead-step="${visualStep}"], .composer-drum-step-number[data-playhead-step="${visualStep}"]`
            ),
          ];

        if (!cachedLiveElements) {
          liveStepElementCacheRef.current.set(visualStep, nextLiveElements);
        }
        nextLiveElements.forEach((element) => {
          element.classList.add('is-current-live');
        });
        liveStepElementsRef.current = nextLiveElements;
        liveVisualStepRef.current = visualStep;
      }

      livePianoPlayheadsRef.current.forEach((playhead) => {
        playhead.style.setProperty('--piano-step-index', `${smoothStep}`);
      });

      liveSequencerPlayheadsRef.current.forEach((playhead) => {
        playhead.style.setProperty('--sequencer-step-index', `${smoothStep}`);
      });

      const arrangementProgress =
        (Math.min(Math.max(smoothStep, 0), Math.max(0, liveStepCount - 1)) /
          Math.max(1, liveStepCount - 1)) * 100;
      liveArrangementPlayheadsRef.current.forEach((playhead) => {
        playhead.style.setProperty('--arrangement-progress', `${arrangementProgress}%`);
      });

      liveScrollerPairsRef.current.forEach(({ scroller, header, stepSpan }) => {
        const playheadLeft = smoothStep * stepSpan + stepSpan / 2;
        const targetLeft = Math.max(0, playheadLeft - scroller.clientWidth * 0.42);
        scroller.scrollLeft = targetLeft;

        if (header) {
          header.style.transform = `translateX(-${targetLeft}px)`;
        }
      });

      liveDrumScrollersRef.current.forEach((scroller) => {
        const stepSpan = DRUM_STEP_WIDTH + 10;
        const playheadLeft = smoothStep * stepSpan + stepSpan / 2;
        scroller.scrollLeft = Math.max(0, playheadLeft - scroller.clientWidth * 0.42);
      });

      followScrollFrameRef.current = window.requestAnimationFrame(renderLivePlayhead);
    };

    const handlePlayheadStep = (event: Event) => {
      if (!isPlayingRef.current) {
        return;
      }

      const detail = (event as CustomEvent<{ step?: number; bpm?: number }>).detail;
      const step = detail?.step;

      if (typeof step !== 'number') {
        return;
      }

      const playbackDomChanged =
        livePianoPlayheadsRef.current.some((element) => !element.isConnected) ||
        liveSequencerPlayheadsRef.current.some((element) => !element.isConnected) ||
        liveArrangementPlayheadsRef.current.some((element) => !element.isConnected) ||
        liveScrollerPairsRef.current.some(({ scroller }) => !scroller.isConnected) ||
        liveDrumScrollersRef.current.some((element) => !element.isConnected);
      const hasDrumEditor = Boolean(document.querySelector('.composer-sequencer-playhead'));

      if (
        playbackDomChanged ||
        (hasDrumEditor && !liveSequencerPlayheadsRef.current.length) ||
        (hasDrumEditor && !liveDrumScrollersRef.current.length) ||
        (!livePianoPlayheadsRef.current.length &&
          !liveScrollerPairsRef.current.length &&
          !liveArrangementPlayheadsRef.current.length)
      ) {
        livePianoPlayheadsRef.current = [
          ...document.querySelectorAll<HTMLElement>('.piano-roll-playhead'),
        ];
        liveSequencerPlayheadsRef.current = [
          ...document.querySelectorAll<HTMLElement>('.composer-sequencer-playhead'),
        ];
        liveArrangementPlayheadsRef.current = [
          ...document.querySelectorAll<HTMLElement>('.composer-arrangement-playhead'),
        ];
        liveScrollerPairsRef.current = [
          ...document.querySelectorAll<HTMLElement>('.piano-roll-melody-scroller'),
        ].map((scroller) => {
          const roll = scroller.closest<HTMLElement>('.piano-roll');
          const rollStyle = roll ? window.getComputedStyle(roll) : null;
          const stepWidth = Number.parseFloat(
            rollStyle?.getPropertyValue('--piano-step-width') ?? ''
          ) || 64;
          const gridGap = Number.parseFloat(
            rollStyle?.getPropertyValue('--piano-grid-gap') ?? ''
          ) || 2;
          return {
            scroller,
            header: roll?.querySelector<HTMLElement>('.piano-roll-step-header--melody') ?? null,
            stepSpan: stepWidth + gridGap,
          };
        });
        liveDrumScrollersRef.current = [
          ...document.querySelectorAll<HTMLElement>('.composer-drums-wrap'),
        ];
      }

      const previousLiveStep = livePlayheadRef.current.step;
      livePlayheadRef.current = {
        step,
        bpm: typeof detail.bpm === 'number' ? detail.bpm : useSongStore.getState().bpm,
        receivedAt: window.performance.now(),
      };

      if (step < previousLiveStep) {
        liveScrollerPairsRef.current.forEach(({ scroller, header, stepSpan }) => {
          const targetLeft = Math.max(
            0,
            step * stepSpan + stepSpan / 2 - scroller.clientWidth * 0.42
          );
          scroller.scrollLeft = targetLeft;
          if (header) header.style.transform = `translateX(-${targetLeft}px)`;
        });
        liveDrumScrollersRef.current.forEach((scroller) => {
          const stepSpan = DRUM_STEP_WIDTH + 10;
          scroller.scrollLeft = Math.max(
            0,
            step * stepSpan + stepSpan / 2 - scroller.clientWidth * 0.42
          );
        });
      }

      if (followScrollFrameRef.current === null) {
        followScrollFrameRef.current = window.requestAnimationFrame(renderLivePlayhead);
      }
    };

    window.addEventListener('composer-playhead-step', handlePlayheadStep);
    return () => {
      window.removeEventListener('composer-playhead-step', handlePlayheadStep);
      if (followScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(followScrollFrameRef.current);
        followScrollFrameRef.current = null;
      }
    };
  }, []);

  const projectSnapshot = useMemo(
    () =>
      buildSongProjectSnapshot({
        compositionMode,
        bpm,
        tempoAutomation,
        steps,
        noteLyrics,
        volumes,
        melody,
        melodyLengths,
        melodyVelocities,
        violin,
        violinLengths,
        saxophone,
        saxophoneLengths,
        guitar,
        guitarLengths,
        drums,
        bass,
        bassLengths,
        extraTracks,
      }),
    [
      bass,
      bassLengths,
      bpm,
      compositionMode,
      tempoAutomation,
      drums,
      extraTracks,
      guitar,
      guitarLengths,
      melody,
      melodyLengths,
      melodyVelocities,
      saxophone,
      saxophoneLengths,
      steps,
      violin,
      violinLengths,
      volumes,
    ]
  );
  const projectSignature = useMemo(() => JSON.stringify(projectSnapshot), [projectSnapshot]);

  const collabStatusLabel = useMemo(() => {
    if (!collabId) {
      return '';
    }

    if (connectionStatus === 'connected') {
      return canSyncCollab ? '실시간 공동 편집 연결됨' : '작업방 읽기 전용으로 연결됨';
    }

    if (connectionStatus === 'connecting') {
      return '실시간 작업 서버에 연결 중입니다.';
    }

    if (connectionStatus === 'error') {
      return connectionError || '작업 서버 연결을 확인해 주세요.';
    }

    return '작업방 연결을 준비하고 있습니다.';
  }, [canSyncCollab, collabId, connectionError, connectionStatus]);
  const activeEditorsLabel = useMemo(() => {
    if (!collabId || !user) {
      return '';
    }

    const entries = presenceByProject[collabId] ?? [];
    const activeEditors = entries
      .filter((entry) => entry.email !== user.email && entry.focus)
      .map((entry) => `${entry.name} - ${entry.focus}`);

    return activeEditors.join(', ');
  }, [collabId, presenceByProject, user]);
  const activeComposerLocks = useMemo(
    () => (collabId ? composerLocksByProject[collabId] ?? [] : []),
    [collabId, composerLocksByProject]
  );
  const currentTabLockMap = useMemo(() => {
    const currentCollabInstrument = getCollabInstrumentForTab(activeTab);

    return activeComposerLocks.reduce<Record<number, { mine: boolean; name: string }>>(
      (map, lock) => {
        if (lock.instrument !== currentCollabInstrument) {
          return map;
        }

        map[lock.barIndex] = {
          mine: lock.sessionId === COLLAB_SESSION_ID,
          name: lock.name,
        };
        return map;
      },
      {}
    );
  }, [activeComposerLocks, activeTab]);
  const visibleComposerLocks = useMemo(
    () =>
      activeComposerLocks
        .filter((lock) => lock.sessionId !== COLLAB_SESSION_ID)
        .slice(0, 4),
    [activeComposerLocks]
  );
  const recentComposerHistory = useMemo<CollabComposerHistoryEntry[]>(
    () => (collabId ? (composerHistoryByProject[collabId] ?? []).slice(0, 4) : []),
    [collabId, composerHistoryByProject]
  );
  const activeGuideStep = COMPOSER_GUIDE_STEPS[guideStepIndex];
  const matchedChordTargets = useMemo(
    () => countMatchedChordTargets(melody, COMPOSER_TUTORIAL_CHORD_TARGETS),
    [melody]
  );
  const matchedMelodyTargets = useMemo(
    () => countMatchedMelodyTargets(melody, melodyLengths, COMPOSER_TUTORIAL_MELODY_TARGETS),
    [melody, melodyLengths]
  );
  const matchedDrumTargets = useMemo(
    () => countMatchedCellTargets(drums, COMPOSER_TUTORIAL_DRUM_TARGETS),
    [drums]
  );
  const matchedBassTargets = useMemo(
    () => countMatchedCellTargets(bass, COMPOSER_TUTORIAL_BASS_TARGETS),
    [bass]
  );
  const melodyNoteCount = useMemo(
    () => melody.reduce((sum, row) => sum + row.filter(Boolean).length, 0),
    [melody]
  );
  const melodyLongNoteCount = useMemo(
    () =>
      melodyLengths.reduce(
        (sum, row) => sum + row.filter((length) => Number(length) > 1).length,
        0
      ),
    [melodyLengths]
  );
  const melodyChordColumnCount = useMemo(() => {
    const columns = new Set<number>();

    for (let col = 0; col < steps; col += 1) {
      let activeInColumn = 0;

      for (let row = 0; row < melody.length; row += 1) {
        if (melody[row]?.[col]) {
          activeInColumn += 1;
        }
      }

      if (activeInColumn >= 3) {
        columns.add(col);
      }
    }

    return columns.size;
  }, [melody, steps]);
  const drumHitCount = useMemo(
    () => drums.reduce((sum, row) => sum + row.filter(Boolean).length, 0),
    [drums]
  );
  const kickHitCount = drums[0]?.filter(Boolean).length ?? 0;
  const snareHitCount = drums[1]?.filter(Boolean).length ?? 0;
  const bassHitCount = useMemo(
    () => bass.reduce((sum, row) => sum + row.filter(Boolean).length, 0),
    [bass]
  );
  const tutorialQuests = useMemo(
    () => [
      {
        id: 'tabs',
        stepIndex: 0,
        title: '탭 둘러보기',
        goal: '멜로디, 드럼, 베이스 탭을 한 번씩 열어보세요.',
        done: visitedTabs.length >= 3,
        progress: `${visitedTabs.length}/3 탭 확인`,
      },
      {
        id: 'melody-chords',
        stepIndex: 1,
        title: '코드 놓기',
        goal: '코드 칩으로 멜로디 영역에 첫 진행을 만들어보세요.',
        done: melodyChordColumnCount >= 1,
        progress:
          melodyChordColumnCount >= 1
            ? `${melodyChordColumnCount}개 코드 시작점 생성`
            : '아직 코드 음이 없습니다.',
      },
      {
        id: 'melody-roll',
        stepIndex: 2,
        title: '멜로디 만들기',
        goal: '멜로디 음을 4개 이상 찍고, 긴 음도 1개 이상 만들어보세요.',
        done: melodyNoteCount >= 4 && melodyLongNoteCount >= 1,
        progress: `음 ${melodyNoteCount}개 · 긴 음 ${melodyLongNoteCount}개`,
      },
      {
        id: 'drums-grid',
        stepIndex: 3,
        title: '드럼 채우기',
        goal: '킥과 스네어를 포함해서 드럼 히트를 6개 이상 넣어보세요.',
        done: drumHitCount >= 6 && kickHitCount >= 1 && snareHitCount >= 1,
        progress: `전체 ${drumHitCount}개 · 킥 ${kickHitCount}개 · 스네어 ${snareHitCount}개`,
      },
      {
        id: 'bass-grid',
        stepIndex: 4,
        title: '베이스 루트 넣기',
        goal: '베이스 음을 2개 이상 넣어서 곡의 바닥을 만들어보세요.',
        done: bassHitCount >= 2,
        progress: `베이스 음 ${bassHitCount}개`,
      },
      {
        id: 'transport',
        stepIndex: 5,
        title: '곡 들어보기',
        goal: '재생 버튼을 눌러 지금 만든 곡을 직접 들어보세요.',
        done: playedTutorialOnce,
        progress: playedTutorialOnce ? '재생 확인 완료' : '아직 재생 전입니다.',
      },
    ],
    [
      bassHitCount,
      drumHitCount,
      kickHitCount,
      melodyChordColumnCount,
      melodyLongNoteCount,
      melodyNoteCount,
      playedTutorialOnce,
      snareHitCount,
      visitedTabs.length,
    ]
  );
  const liveTutorialQuests = useMemo(
    () => [
      {
        id: 'tabs',
        stepIndex: 0,
        title: '탭부터 둘러보기',
        goal: '위 탭에서 MELODY, DRUMS, BASS를 한 번씩 눌러보세요.',
        done: visitedTabs.length >= 3,
        progress: `${visitedTabs.length}/3 탭 확인`,
        pattern: ['MELODY 탭 누르기', 'DRUMS 탭 누르기', 'BASS 탭 누르기'],
      },
      {
        id: 'melody-chords',
        stepIndex: 1,
        title: '코드 뼈대 놓기',
        goal: '코드 칩을 드래그해서 1마디 진행을 먼저 맞춰보세요.',
        done: matchedChordTargets === COMPOSER_TUTORIAL_CHORD_TARGETS.length,
        progress: `${matchedChordTargets}/${COMPOSER_TUTORIAL_CHORD_TARGETS.length} 코드 위치 맞춤`,
        pattern: COMPOSER_TUTORIAL_CHORD_TARGETS.map((target) => target.label),
      },
      {
        id: 'melody-roll',
        stepIndex: 2,
        title: '멜로디 따라 찍기',
        goal: '보이는 가이드 블록대로 첫 1마디 멜로디를 찍어보세요.',
        done: matchedMelodyTargets === COMPOSER_TUTORIAL_MELODY_TARGETS.length,
        progress: `${matchedMelodyTargets}/${COMPOSER_TUTORIAL_MELODY_TARGETS.length} 멜로디 맞춤`,
        pattern: COMPOSER_TUTORIAL_MELODY_TARGETS.map((target) => target.label),
      },
      {
        id: 'drums-grid',
        stepIndex: 3,
        title: '드럼 박자 복사하기',
        goal: '킥, 스네어, 하이햇 위치를 그대로 채워서 리듬을 완성해보세요.',
        done: matchedDrumTargets === COMPOSER_TUTORIAL_DRUM_TARGETS.length,
        progress: `${matchedDrumTargets}/${COMPOSER_TUTORIAL_DRUM_TARGETS.length} 드럼 칸 맞춤`,
        pattern: [
          'Kick: 1칸, 9칸',
          'Snare: 5칸, 13칸',
          'Hi-Hat: 1, 3, 5, 7, 9, 11, 13, 15칸',
        ],
      },
      {
        id: 'bass-grid',
        stepIndex: 4,
        title: '베이스 루트 넣기',
        goal: '코드 아래에 맞는 루트 음을 찍어 곡의 바닥을 완성해보세요.',
        done: matchedBassTargets === COMPOSER_TUTORIAL_BASS_TARGETS.length,
        progress: `${matchedBassTargets}/${COMPOSER_TUTORIAL_BASS_TARGETS.length} 베이스 칸 맞춤`,
        pattern: COMPOSER_TUTORIAL_BASS_TARGETS.map((target) => target.label),
      },
      {
        id: 'transport',
        stepIndex: 5,
        title: '곡 들어보기',
        goal: '재생 버튼을 눌러 방금 만든 1마디 곡이 실제로 들리는지 확인해보세요.',
        done: playedTutorialOnce,
        progress: playedTutorialOnce ? '재생 확인 완료' : '아직 재생 전입니다.',
        pattern: ['하단 재생 버튼 누르기', '소리 확인하기'],
      },
    ],
    [
      matchedBassTargets,
      matchedChordTargets,
      matchedDrumTargets,
      matchedMelodyTargets,
      playedTutorialOnce,
      visitedTabs.length,
    ]
  );
  const liveCompletedQuestCount = liveTutorialQuests.filter((quest) => quest.done).length;
  const liveTutorialProgress = Math.round((liveCompletedQuestCount / tutorialQuests.length) * 100);
  const activeGuideQuest = liveTutorialQuests[guideStepIndex] ?? liveTutorialQuests[0];
  const nextChordTutorialTarget = useMemo(
    () =>
      COMPOSER_TUTORIAL_CHORD_TARGETS.find(
        (target) => !target.rows.every((row) => Boolean(melody[row]?.[target.col]))
      ) ?? null,
    [melody]
  );
  const nextMelodyTutorialTarget = useMemo(
    () =>
      COMPOSER_TUTORIAL_MELODY_TARGETS.find((target) => {
        const noteInfo = findMelodyNoteForTutorial(
          melody[target.row] ?? [],
          melodyLengths[target.row] ?? [],
          target.col
        );

        return !(noteInfo && noteInfo.start === target.col && noteInfo.length >= target.length);
      }) ?? null,
    [melody, melodyLengths]
  );
  const nextDrumTutorialTarget = useMemo(
    () => COMPOSER_TUTORIAL_DRUM_TARGETS.find((target) => !drums[target.row]?.[target.col]) ?? null,
    [drums]
  );
  const melodyTutorialGhostNotes = useMemo(() => {
    if (!isGuideOpen || activeTab !== 'melody') {
      return [];
    }

    if (guideStepIndex === 1) {
      return COMPOSER_TUTORIAL_CHORD_TARGETS.flatMap((target) =>
        target.rows.map((row, index) => ({
          row,
          col: target.col,
          length: 1,
          completed: Boolean(melody[row]?.[target.col]),
          highlight: nextChordTutorialTarget?.chord === target.chord && nextChordTutorialTarget.col === target.col,
          label:
            nextChordTutorialTarget?.chord === target.chord &&
            nextChordTutorialTarget.col === target.col &&
            index === 0
              ? `${target.chord} 코드 놓기`
              : undefined,
        }))
      );
    }

    if (guideStepIndex === 2) {
      return COMPOSER_TUTORIAL_MELODY_TARGETS.map((target) => {
        const noteInfo = findMelodyNoteForTutorial(
          melody[target.row] ?? [],
          melodyLengths[target.row] ?? [],
          target.col
        );

        return {
          row: target.row,
          col: target.col,
          length: target.length,
          completed: Boolean(
            noteInfo && noteInfo.start === target.col && noteInfo.length >= target.length
          ),
          highlight:
            nextMelodyTutorialTarget?.row === target.row &&
            nextMelodyTutorialTarget.col === target.col,
          label:
            nextMelodyTutorialTarget?.row === target.row &&
            nextMelodyTutorialTarget.col === target.col
              ? '멜로디 찍기'
              : undefined,
        };
      });
    }

    return [];
  }, [
    activeTab,
    guideStepIndex,
    isGuideOpen,
    melody,
    melodyLengths,
    nextChordTutorialTarget,
    nextMelodyTutorialTarget,
  ]);
  const drumTutorialTargetMap = useMemo(
    () =>
      guideStepIndex === 3 && isGuideOpen
        ? COMPOSER_TUTORIAL_DRUM_TARGETS.reduce<Record<string, boolean>>((map, target) => {
            map[`${target.row}-${target.col}`] = Boolean(drums[target.row]?.[target.col]);
            return map;
          }, {})
        : {},
    [drums, guideStepIndex, isGuideOpen]
  );
  const getGuideHighlightClass = (...focuses: ComposerGuideFocus[]) =>
    isGuideOpen && activeGuideStep && focuses.includes(activeGuideStep.focus)
      ? ' composer-guide-highlight'
      : '';
  const getGuideFocusElement = useCallback(() => {
    if (!isGuideOpen || !activeGuideStep) {
      return null;
    }

    switch (activeGuideStep.focus) {
      case 'tabs':
        return tabStripRef.current;
      case 'mixer':
        return mixerStripRef.current;
      case 'melody-chords':
        return melodyChordBarRef.current;
      case 'melody-roll':
        return melodyRollRef.current;
      case 'drums-grid':
        return drumShellRef.current;
      case 'bass-grid':
        return bassShellRef.current;
      case 'transport':
        return footerRef.current;
      default:
        return null;
    }
  }, [activeGuideStep, isGuideOpen]);

  const showCollabNotice = (message: string) => {
    setConflictNotice(message);

    if (conflictTimeoutRef.current) {
      window.clearTimeout(conflictTimeoutRef.current);
    }

    conflictTimeoutRef.current = window.setTimeout(() => {
      setConflictNotice('');
      conflictTimeoutRef.current = null;
    }, 4000);
  };

  const markVisitedTab = useCallback((tab: ComposerTab) => {
    setVisitedTabs((current) => (current.includes(tab) ? current : [...current, tab]));
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!tabPickerRef.current) {
        return;
      }

      if (!tabPickerRef.current.contains(event.target as Node)) {
        setIsTabPickerOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  const updateTabPickerMenuPosition = useCallback(() => {
    if (!tabAddButtonRef.current) {
      return;
    }

    const rect = tabAddButtonRef.current.getBoundingClientRect();
    const minWidth = 188;
    const viewportPadding = 12;
    const maxLeft = Math.max(viewportPadding, window.innerWidth - minWidth - viewportPadding);
    const top = rect.bottom + 8;
    const maxHeight = Math.max(220, window.innerHeight - top - viewportPadding);

    setTabPickerMenuPosition({
      top,
      left: Math.min(Math.max(viewportPadding, rect.left), maxLeft),
      minWidth,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!isTabPickerOpen || !tabAddButtonRef.current) {
      if (!isTabPickerOpen) {
        setTabPickerMenuPosition(null);
      }
      return;
    }

    updateTabPickerMenuPosition();
    window.addEventListener('resize', updateTabPickerMenuPosition);
    window.addEventListener('scroll', updateTabPickerMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateTabPickerMenuPosition);
      window.removeEventListener('scroll', updateTabPickerMenuPosition, true);
    };
  }, [isTabPickerOpen, updateTabPickerMenuPosition]);

  useEffect(() => {
    const nextInstrument = getMelodyInstrumentForTab(activeTab);
    if (!nextInstrument) {
      return;
    }

    setInstrument(nextInstrument);
  }, [activeTab, setInstrument]);

  useEffect(() => {
    livePianoPlayheadsRef.current = [];
    liveSequencerPlayheadsRef.current = [];
    liveArrangementPlayheadsRef.current = [];
    liveScrollerPairsRef.current = [];
    liveDrumScrollersRef.current = [];
    liveStepElementCacheRef.current.clear();
  }, [activeTab, activeTrackId]);

  const syncGuideQuery = useCallback(
    (open: boolean, stepIndex = guideStepIndex) => {
      const nextParams = new URLSearchParams(searchParams);

      if (open) {
        nextParams.set('tutorial', '1');
        nextParams.set('guideStep', String(clampGuideStepIndex(stepIndex)));
      } else {
        nextParams.delete('tutorial');
        nextParams.delete('guideStep');
      }

      navigate(
        {
          pathname: '/composer',
          search: nextParams.toString() ? `?${nextParams.toString()}` : '',
        },
        { replace: true }
      );
    },
    [guideStepIndex, navigate, searchParams]
  );

  const openGuideAt = useCallback(
    (stepIndex: number) => {
      const nextStepIndex = clampGuideStepIndex(stepIndex);
      const stepTab = COMPOSER_GUIDE_STEPS[nextStepIndex]?.tab;
      if (stepTab) {
        markVisitedTab(stepTab);
        setActiveTab(stepTab);
      }
      syncGuideQuery(true, nextStepIndex);
    },
    [markVisitedTab, setActiveTab, syncGuideQuery]
  );

  useEffect(() => {
    if (!tutorialCompleted || !tutorialRequested) {
      return;
    }

    syncGuideQuery(false);
  }, [syncGuideQuery, tutorialCompleted, tutorialRequested]);

  const handleTabPickerToggle = useCallback(() => {
    setIsTabPickerOpen((current) => {
      const nextOpen = !current;

      if (nextOpen) {
        updateTabPickerMenuPosition();
      } else {
        setTabPickerMenuPosition(null);
      }

      return nextOpen;
    });
  }, [updateTabPickerMenuPosition]);

  const activateTab = useCallback(
    (tab: ComposerTab, trackId: string | null = null) => {
      markVisitedTab(tab);
      setActiveTab(tab);
      setActiveTrackId(trackId);
      const nextInstrument = getMelodyInstrumentForTab(tab);
      if (nextInstrument) {
        setInstrument(nextInstrument);
      }
    },
    [markVisitedTab, setActiveTab, setInstrument]
  );

  const handleSendNotepadLyrics = useCallback(() => {
    const lyricTokens = notepadDraft.lyrics.trim().split(/\s+/).filter(Boolean);
    if (!melodyLyricNotes.length || !lyricTokens.length) {
      setOpenTabsState((current) => tabOrder.filter((tab) => tab === 'lyrics' || current.includes(tab)));
      activateTab('lyrics');
      return;
    }

    melodyLyricNotes.forEach((item, index) => {
      setMelodyLyric(item.row, item.col, lyricTokens[index] ?? '');
    });
    setOpenTabsState((current) => tabOrder.filter((tab) => tab === 'lyrics' || current.includes(tab)));
    setLyricsViewMode('notes');
    activateTab('lyrics');
  }, [activateTab, melodyLyricNotes, notepadDraft.lyrics, setMelodyLyric]);

  const handleExportNotepad = useCallback(() => {
    const activeText = notepadMode === 'lyrics' ? notepadDraft.lyrics : notepadDraft.memo;
    const heading = notepadDraft.title.trim() || '새 곡';
    const section = notepadMode === 'lyrics' ? '가사' : '메모';
    const blob = new Blob([`${heading}\n\n[${section}]\n${activeText}`], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${heading.replace(/[\\/:*?"<>|]/g, '_')}-${section}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [notepadDraft, notepadMode]);

  const syncTabsToLoadedProject = useCallback(() => {
    const state = useSongStore.getState();
    const hasMelodyOnlyResult = hasOnlyMelodyTrackData(state);
    const primaryTabs = tabOrder.filter((tab) => {
      switch (tab) {
        case 'lyrics':
          return Object.keys(state.noteLyrics).length > 0;
        case 'melody':
          return hasAnyGridNotes(state.melody);
        case 'violin':
          return hasAnyGridNotes(state.violin);
        case 'saxophone':
          return hasAnyGridNotes(state.saxophone);
        case 'guitar':
          return hasAnyGridNotes(state.guitar);
        case 'drums':
          return hasAnyGridNotes(state.drums);
        case 'bass':
          return hasAnyGridNotes(state.bass);
        default:
          return false;
      }
    });
    const extraTrackIds = state.extraTracks.map((track) => track.id);
    const nextPrimaryTabs: ComposerTab[] = hasMelodyOnlyResult
      ? (primaryTabs.includes('melody') ? ['melody'] : [])
      : primaryTabs;

    setOpenTabsState(nextPrimaryTabs);
    setOpenExtraTrackIds(extraTrackIds);

    if (nextPrimaryTabs.length) {
      activateTab(nextPrimaryTabs[0]);
      return;
    }

    const firstExtraTrack = state.extraTracks[0];
    if (firstExtraTrack) {
      activateTab(firstExtraTrack.instrument as ComposerTab, firstExtraTrack.id);
    }
  }, [activateTab]);

  useEffect(() => {
    if (projectLoadRevision <= 0) {
      return;
    }

    syncTabsToLoadedProject();
  }, [projectLoadRevision, syncTabsToLoadedProject]);

  useEffect(() => {
    const handleGoToFirstBar = () => {
      document.querySelectorAll<HTMLElement>('.piano-roll-melody-scroller').forEach((scroller) => {
        scroller.scrollLeft = 0;
      });
      document.querySelectorAll<HTMLElement>('.composer-drums-wrap').forEach((scroller) => {
        scroller.scrollLeft = 0;
      });
      document.querySelectorAll<HTMLElement>('.composer-sequencer-playhead').forEach((playhead) => {
        playhead.style.setProperty('--sequencer-step-index', '0');
      });

      setPitchedRollScrollLeft({});
    };

    window.addEventListener('composer-go-to-first-bar', handleGoToFirstBar);
    return () => {
      window.removeEventListener('composer-go-to-first-bar', handleGoToFirstBar);
    };
  }, []);

  const handleOpenTab = useCallback(
    (tab: TabPickerOption, allowDuplicateTrack = true) => {
      if (tab === 'videoOverlay') {
        setIsTabPickerOpen(false);
        videoOverlayInputRef.current?.click();
        return;
      }

      if (tab === 'airInstrument') {
        setIsTabPickerOpen(false);
        navigate('/air-guitar');
        return;
      }

      if (isSampledInstrumentTab(tab)) {
        const trackId = addInstrumentTrack(tab);
        setOpenExtraTrackIds((current) => [...current, trackId]);
        activateTab(tab, trackId);
        setIsTabPickerOpen(false);
        return;
      }

      const primaryAlreadyOpen = openTabsState.includes(tab);

      if (primaryAlreadyOpen) {
        if (tab === 'lyrics' || !allowDuplicateTrack) {
          activateTab(tab);
        } else {
          const trackId = addInstrumentTrack(tab);
          setOpenExtraTrackIds((current) => [...current, trackId]);
          activateTab(tab, trackId);
        }
      } else {
        setOpenTabsState((current) =>
          tabOrder.filter((candidate) => candidate === tab || current.includes(candidate))
        );
        activateTab(tab);
      }

      setIsTabPickerOpen(false);
    },
    [activateTab, addInstrumentTrack, navigate, openTabsState]
  );

  const handleTrackPickerOpen = useCallback(
    (tab: TabPickerOption) => {
      const baseTrackId =
        tab === 'melody' || tab === 'drums' || tab === 'bass'
          ? tab
          : tab === 'supportingPiano'
            ? 'piano'
            : tab === 'glockenspiel'
              ? 'support'
              : null;
      const isRestoringBaseTrack = Boolean(baseTrackId && hiddenArrangementTrackIds.has(baseTrackId));

      if (baseTrackId) {
        setHiddenArrangementTrackIds((current) => {
          if (!current.has(baseTrackId)) return current;
          const next = new Set(current);
          next.delete(baseTrackId);
          return next;
        });
      }

      handleOpenTab(tab, !isRestoringBaseTrack);
    },
    [handleOpenTab, hiddenArrangementTrackIds]
  );

  const handleDuplicateArrangementTrack = useCallback(
    (track: ArrangementTrackDefinition) => {
      const trackId = duplicateInstrumentTrack(track.tab, track.trackId);
      setOpenExtraTrackIds((current) => [...current, trackId]);

      const sourceLength = track.trackId
        ? extraTrackNoteLengths[track.trackId]
        : isPitchedTab(track.tab)
          ? primaryTrackNoteLengths[track.tab]
          : undefined;
      if (sourceLength) {
        setExtraTrackNoteLengths((current) => ({ ...current, [trackId]: sourceLength }));
      }

      activateTab(track.tab, trackId);
      setOpenTrackMenuId(null);
    },
    [
      activateTab,
      duplicateInstrumentTrack,
      extraTrackNoteLengths,
      primaryTrackNoteLengths,
    ]
  );

  const handleArrangementTrackSelect = useCallback(
    (track: ArrangementTrackDefinition) => {
      if (track.trackId) {
        setOpenExtraTrackIds((current) =>
          current.includes(track.trackId as string) ? current : [...current, track.trackId as string]
        );
        activateTab(track.tab, track.trackId);
        return;
      }

      if (isSampledInstrumentTab(track.tab)) {
        const existingTrack = extraTracks.find((item) => item.instrument === track.tab);
        if (existingTrack) {
          setOpenExtraTrackIds((current) =>
            current.includes(existingTrack.id) ? current : [...current, existingTrack.id]
          );
          activateTab(track.tab, existingTrack.id);
          return;
        }
      }

      handleOpenTab(track.tab, false);
    },
    [activateTab, extraTracks, handleOpenTab]
  );

  const handleArrangementTrackDelete = useCallback(
    (track: ArrangementTrackDefinition) => {
      const isAddedTrack = track.id.startsWith('added-');

      if (isAddedTrack) {
        if (track.trackId) {
          removeInstrumentTrack(track.trackId);
          setOpenExtraTrackIds((current) => current.filter((id) => id !== track.trackId));
        } else {
          setOpenTabsState((current) => current.filter((tab) => tab !== track.tab));
        }
      } else {
        if (track.trackId) {
          removeInstrumentTrack(track.trackId);
          setOpenExtraTrackIds((current) => current.filter((id) => id !== track.trackId));
        } else {
          clearInstrument(track.tab);
        }
        setHiddenArrangementTrackIds((current) => new Set(current).add(track.id));
      }

      releaseInstrumentSounds(track.tab);
      if (activeTab === track.tab && (!activeTrackId || activeTrackId === track.trackId)) {
        const fallbackTrack = arrangementVisibleTracks.find(
          (item) => (item.key ?? item.id) !== (track.key ?? track.id)
        );
        if (fallbackTrack) activateTab(fallbackTrack.tab, fallbackTrack.trackId ?? null);
      }
      setOpenTrackMenuId(null);
    },
    [
      activeTab,
      activeTrackId,
      activateTab,
      arrangementVisibleTracks,
      clearInstrument,
      removeInstrumentTrack,
    ]
  );

  const handleArrangementProgressSelect = useCallback(
    (progressPercent: number) => {
      const safeProgress = Math.min(100, Math.max(0, progressPercent));
      const timelineStep = Math.round((safeProgress / 100) * Math.max(0, steps - 1));
      setCurrentStep(timelineStep);

      const focusLowerEditor = (attempt = 0) => {
        const main = document.querySelector<HTMLElement>('.composer-main');
        if (!main) return;

        const pitchedScroller = main.querySelector<HTMLElement>('.piano-roll-melody-scroller');
        if (pitchedScroller) {
          const roll = pitchedScroller.closest<HTMLElement>('.piano-roll');
          const rollStyle = roll ? window.getComputedStyle(roll) : null;
          const stepWidth = Number.parseFloat(
            rollStyle?.getPropertyValue('--piano-step-width') ?? ''
          ) || Math.round(64 * pianoZoom);
          const gridGap = Number.parseFloat(
            rollStyle?.getPropertyValue('--piano-grid-gap') ?? ''
          ) || 2;
          const sidebarWidth = Number.parseFloat(
            rollStyle?.getPropertyValue('--piano-sidebar-width') ?? ''
          ) || 68;
          const targetLeft =
            timelineStep * (stepWidth + gridGap) -
            Math.max(0, pitchedScroller.clientWidth - sidebarWidth) / 2 +
            stepWidth / 2;
          pitchedScroller.scrollLeft = Math.max(0, targetLeft);
          pitchedScroller.dispatchEvent(new Event('scroll', { bubbles: true }));
          return;
        }

        const drumScroller = main.querySelector<HTMLElement>('.composer-drums-wrap');
        if (drumScroller) {
          const targetLeft =
            timelineStep * (DRUM_STEP_WIDTH + 10) - drumScroller.clientWidth / 2;
          drumScroller.scrollLeft = Math.max(0, targetLeft);
          drumScroller.dispatchEvent(new Event('scroll', { bubbles: true }));
          return;
        }

        if (attempt < 4) {
          window.setTimeout(() => focusLowerEditor(attempt + 1), 40);
        }
      };

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => focusLowerEditor());
      });
      return {
        step: timelineStep,
        bar: Math.min(64, Math.max(1, Math.round((safeProgress / 100) * 63) + 1)),
      };
    },
    [pianoZoom, setCurrentStep, steps]
  );

  const handleArrangementPointerSelect = useCallback(
    (clientX: number, timelineElement: HTMLElement) => {
      const bounds = timelineElement.getBoundingClientRect();
      const progress = ((clientX - bounds.left) / Math.max(1, bounds.width)) * 100;
      return handleArrangementProgressSelect(progress);
    },
    [handleArrangementProgressSelect]
  );

  const updateArrangementClipLayout = useCallback(
    (clipKey: string, nextLayout: ArrangementClipLayout) => {
      const length = Math.min(100, Math.max(4, nextLayout.length));
      const start = Math.min(100 - length, Math.max(0, nextLayout.start));
      setArrangementClipLayouts((current) => ({
        ...current,
        [clipKey]: { start, length },
      }));
    },
    []
  );

  const handleArrangementClipDrop = useCallback(
    (
      event: ReactDragEvent<HTMLDivElement>,
      trackKey: string
    ) => {
      event.preventDefault();
      const rawPayload = event.dataTransfer.getData('application/x-composer-clip');
      if (!rawPayload) return;

      try {
        const payload = JSON.parse(rawPayload) as {
          clipKey: string;
          trackKey: string;
          offsetPercent: number;
          length: number;
        };
        if (payload.trackKey !== trackKey) return;

        const bounds = event.currentTarget.getBoundingClientRect();
        const pointerPercent = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100;
        const start = pointerPercent - payload.offsetPercent;
        updateArrangementClipLayout(payload.clipKey, { start, length: payload.length });
        const { bar } = handleArrangementProgressSelect(start);
        showPianoToolFeedback(`구간 이동 · ${bar}마디`);
      } catch {
        return;
      } finally {
        setDraggingArrangementClip(null);
      }
    },
    [handleArrangementProgressSelect, showPianoToolFeedback, updateArrangementClipLayout]
  );

  const handleArrangementClipResizeStart = useCallback(
    (
      event: ReactPointerEvent<HTMLSpanElement>,
      clipKey: string,
      layout: ArrangementClipLayout,
      edge: 'start' | 'end'
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const lane = event.currentTarget.closest<HTMLElement>('.composer-arrangement-lane');
      if (!lane) return;

      const laneWidth = Math.max(1, lane.getBoundingClientRect().width);
      const pointerStart = event.clientX;
      setSelectedArrangementClip(clipKey);

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = ((moveEvent.clientX - pointerStart) / laneWidth) * 100;
        if (edge === 'start') {
          const nextStart = Math.min(layout.start + layout.length - 4, layout.start + delta);
          updateArrangementClipLayout(clipKey, {
            start: nextStart,
            length: layout.length - (nextStart - layout.start),
          });
          return;
        }

        updateArrangementClipLayout(clipKey, {
          start: layout.start,
          length: layout.length + delta,
        });
      };

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        showPianoToolFeedback('구간 길이 조절 완료');
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [showPianoToolFeedback, updateArrangementClipLayout]
  );

  const handleArrangementMute = useCallback(
    (track: ArrangementTrackDefinition) => {
      if (soloArrangementTrack) return;

      const instrument = track.tab as InstrumentKey;
      const isMuted = mutedArrangementTracks.has(track.id);
      const extraTrack = track.trackId
        ? extraTracks.find((item) => item.id === track.trackId)
        : null;
      const currentVolume = extraTrack?.volume ?? volumes[instrument] ?? 80;
      if (isMuted) {
        const restoredVolume = mutedVolumeSnapshotRef.current[track.id] ?? 80;
        if (track.trackId) setExtraTrackVolume(track.trackId, restoredVolume);
        else setInstrumentVolume(instrument, restoredVolume);
      } else {
        mutedVolumeSnapshotRef.current[track.id] = currentVolume;
        if (track.trackId) setExtraTrackVolume(track.trackId, 0);
        else setInstrumentVolume(instrument, 0);
        releaseInstrumentSounds(track.tab);
      }

      setMutedArrangementTracks((current) => {
        const next = new Set(current);
        if (isMuted) next.delete(track.id);
        else next.add(track.id);
        return next;
      });
    },
    [
      extraTracks,
      mutedArrangementTracks,
      setExtraTrackVolume,
      setInstrumentVolume,
      soloArrangementTrack,
      volumes,
    ]
  );

  const handleArrangementVolumeChange = useCallback(
    (track: ArrangementTrackDefinition, nextVolume: number) => {
      const instrument = track.tab as InstrumentKey;
      const extraTrack = track.trackId
        ? extraTracks.find((item) => item.id === track.trackId)
        : null;
      const currentVolume = extraTrack?.volume ?? volumes[instrument] ?? 80;

      if (nextVolume === 0 && currentVolume > 0) {
        mutedVolumeSnapshotRef.current[track.id] = currentVolume;
        releaseInstrumentSounds(track.tab);
      } else if (nextVolume > 0) {
        mutedVolumeSnapshotRef.current[track.id] = nextVolume;
      }

      if (track.trackId) setExtraTrackVolume(track.trackId, nextVolume);
      else setInstrumentVolume(instrument, nextVolume);

      setMutedArrangementTracks((current) => {
        const next = new Set(current);
        if (nextVolume === 0) next.add(track.id);
        else next.delete(track.id);
        return next;
      });
    },
    [extraTracks, setExtraTrackVolume, setInstrumentVolume, volumes]
  );

  const handleArrangementSolo = useCallback(
    (track: ArrangementTrackDefinition) => {
      const shouldDisableSolo = soloArrangementTrack === track.id;
      if (shouldDisableSolo) {
        const snapshot = soloVolumeSnapshotRef.current;
        if (snapshot) {
          arrangementVisibleTracks.forEach((item) => {
            setInstrumentVolume(item.tab as InstrumentKey, snapshot[item.id] ?? 80);
          });
        }
        soloVolumeSnapshotRef.current = null;
        setSoloArrangementTrack(null);
        return;
      }

      const snapshot =
        soloVolumeSnapshotRef.current ??
        Object.fromEntries(
          arrangementVisibleTracks.map((item) => [
            item.id,
            volumes[item.tab as InstrumentKey] ?? 80,
          ])
        );
      soloVolumeSnapshotRef.current = snapshot;

      arrangementVisibleTracks.forEach((item) => {
        setInstrumentVolume(
          item.tab as InstrumentKey,
          item.id === track.id ? snapshot[item.id] ?? 80 : 0
        );
      });
      setSoloArrangementTrack(track.id);
    },
    [arrangementVisibleTracks, setInstrumentVolume, soloArrangementTrack, volumes]
  );

  useEffect(() => {
    const requestedTab = searchParams.get('tab');

    if (isComposerTab(requestedTab)) {
      handleOpenTab(requestedTab, false);
    }
  }, [handleOpenTab, searchParams]);

  const handleCloseTab = useCallback(
    (item: ComposerTabItem) => {
      if (item.trackId) {
        const nextItems = openTabItems.filter((candidate) => candidate.id !== item.id);
        removeInstrumentTrack(item.trackId);
        releaseInstrumentSounds(item.tab as InstrumentComposerTab);
        setOpenExtraTrackIds((current) => current.filter((id) => id !== item.trackId));
        setIsTabPickerOpen(false);

        if (activeTrackId === item.trackId) {
          const fallbackItem = [...nextItems].reverse()[0] ?? {
            id: 'primary-melody',
            tab: 'melody' as ComposerTab,
            label: tabLabels.melody,
          };
          activateTab(fallbackItem.tab, fallbackItem.trackId ?? null);
        }

        return;
      }

      const tab = item.tab;
      if (DEFAULT_OPEN_TABS.includes(tab)) {
        return;
      }

      const remainingTabs = tabOrder.filter(
        (candidate) =>
          candidate !== tab &&
          openTabsState.includes(candidate)
      );

      if (tab !== 'lyrics') {
        clearInstrument(tab as InstrumentComposerTab);
        releaseInstrumentSounds(tab as InstrumentComposerTab);
      }
      setOpenTabsState(remainingTabs);
      setIsTabPickerOpen(false);

      if (activeTab === tab && !activeTrackId) {
        const fallbackTab = [...remainingTabs].reverse().find((candidate) => candidate !== tab);
        if (fallbackTab) {
          activateTab(fallbackTab);
        } else {
          setActiveTrackId(null);
        }
      }
    },
    [activateTab, activeTab, activeTrackId, clearInstrument, openTabItems, openTabsState, removeInstrumentTrack]
  );

  const handleStepLoopSelect = useCallback(
    (col: number) => {
      const sameLoop = loopRange?.start === 0 && loopRange.end === col;
      setLoopRange(sameLoop ? null : { start: 0, end: col });
      setCurrentStep(0);
    },
    [loopRange, setCurrentStep, setLoopRange]
  );

  const getDrumTutorialCellClass = (row: number, col: number) => {
    if (!isGuideOpen || guideStepIndex !== 3) {
      return '';
    }

    if (
      nextDrumTutorialTarget &&
      nextDrumTutorialTarget.row === row &&
      nextDrumTutorialTarget.col === col
    ) {
      return ' is-tutorial-next';
    }

    const targetState = drumTutorialTargetMap[`${row}-${col}`];

    if (typeof targetState !== 'boolean') {
      return '';
    }

    return targetState ? ' is-tutorial-complete' : ' is-tutorial-target';
  };

  const getDrumTutorialCellGuideLabel = (row: number, col: number) =>
    isGuideOpen &&
    guideStepIndex === 3 &&
    nextDrumTutorialTarget &&
    nextDrumTutorialTarget.row === row &&
    nextDrumTutorialTarget.col === col
      ? '여기'
      : '';

  const getTutorialTabClass = (tab: ComposerTab) => {
    if (!isGuideOpen || guideStepIndex !== 0) {
      return '';
    }

    if (!visitedTabs.includes(tab)) {
      return ' is-tutorial-target';
    }

    return ' is-tutorial-complete';
  };

  const getProjectSignatureFromStore = () =>
    JSON.stringify(
      buildSongProjectSnapshot({
        compositionMode: useSongStore.getState().compositionMode,
        bpm: useSongStore.getState().bpm,
        tempoAutomation: useSongStore.getState().tempoAutomation,
        steps: useSongStore.getState().steps,
        noteLyrics: useSongStore.getState().noteLyrics,
        volumes: useSongStore.getState().volumes,
        melody: useSongStore.getState().melody,
        melodyLengths: useSongStore.getState().melodyLengths,
        melodyVelocities: useSongStore.getState().melodyVelocities,
        violin: useSongStore.getState().violin,
        violinLengths: useSongStore.getState().violinLengths,
        saxophone: useSongStore.getState().saxophone,
        saxophoneLengths: useSongStore.getState().saxophoneLengths,
        guitar: useSongStore.getState().guitar,
        guitarLengths: useSongStore.getState().guitarLengths,
        drums: useSongStore.getState().drums,
        bass: useSongStore.getState().bass,
        bassLengths: useSongStore.getState().bassLengths,
        extraTracks: useSongStore.getState().extraTracks,
      })
    );

  const getLockKey = (instrument: CollabComposerInstrument, barIndex: number) =>
    `${instrument}:${barIndex}`;

  const requestComposerBarLock = async (
    instrument: CollabComposerInstrument,
    barIndex: number
  ) => {
    if (!collabId || !user || !canSyncCollab) {
      return !collabId;
    }

    const key = getLockKey(instrument, barIndex);
    if (heldBarLocksRef.current.has(key)) {
      return true;
    }

    const existingLock = activeComposerLocks.find(
      (lock) =>
        lock.instrument === instrument &&
        lock.barIndex === barIndex &&
        lock.sessionId !== COLLAB_SESSION_ID
    );

    if (existingLock) {
      showCollabNotice(
        `${existingLock.name}님이 ${composerInstrumentLabels[instrument]} ${
          barIndex + 1
        }마디를 편집 중입니다.`
      );
      return false;
    }

    try {
      await setComposerLock(collabId, {
        instrument,
        barIndex,
        email: user.email,
        name: user.name,
        sessionId: COLLAB_SESSION_ID,
        lock: true,
      });
      heldBarLocksRef.current.add(key);
      return true;
    } catch (error) {
      if (error instanceof Error) {
        showCollabNotice(error.message);
      }
      return false;
    }
  };

  const releaseComposerBarLock = (instrument: CollabComposerInstrument, barIndex: number) => {
    if (!collabId) {
      return;
    }

    const key = getLockKey(instrument, barIndex);
    if (!heldBarLocksRef.current.has(key)) {
      return;
    }

    heldBarLocksRef.current.delete(key);
    void setComposerLock(collabId, {
      instrument,
      barIndex,
      sessionId: COLLAB_SESSION_ID,
      lock: false,
    }).catch((error) => {
      console.error(error);
    });
  };

  const queueComposerOperation = (operation: CollabComposerOperation) => {
    if (!collabId || !user || !canSyncCollab) {
      return;
    }

    pendingOperationSignatureRef.current = getProjectSignatureFromStore();

    operationQueueRef.current = operationQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const revision = await applyComposerOperation(collabId, {
            operation,
            email: user.email,
            name: user.name,
            sessionId: COLLAB_SESSION_ID,
            baseRevision: lastAppliedRevisionRef.current,
          });
          lastAppliedRevisionRef.current = Math.max(lastAppliedRevisionRef.current, revision);
          setConflictNotice('');
        } catch (error) {
          console.error(error);
          pendingOperationSignatureRef.current = null;

          if (error instanceof CollabRequestError && error.statusCode === 409) {
            showCollabNotice(error.message);
          } else if (error instanceof Error) {
            showCollabNotice(error.message);
          }

          setCollabSyncTick((tick) => tick + 1);
          throw error;
        }
      });
  };

  useEffect(() => {
    initTransport();
    const scheduleIdle = window.requestIdleCallback ?? ((callback: IdleRequestCallback) =>
      window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 8 }), 250));
    const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
    const idleId = scheduleIdle(() => {
      void preloadPlaybackEngine().catch((error) => {
        console.warn('Playback preload skipped:', error);
      });
    });

    return () => cancelIdle(idleId);
  }, []);

  useEffect(() => {
    if (!isGuideOpen || !activeGuideStep?.tab || activeTab === activeGuideStep.tab) {
      return;
    }

    setActiveTab(activeGuideStep.tab);
  }, [activeGuideStep, activeTab, isGuideOpen, setActiveTab]);

  useEffect(() => {
    if (tutorialCameraTimeoutRef.current) {
      window.clearTimeout(tutorialCameraTimeoutRef.current);
      tutorialCameraTimeoutRef.current = null;
    }

    if (!isGuideOpen) {
      return;
    }

    tutorialCameraTimeoutRef.current = window.setTimeout(() => {
      const target = getGuideFocusElement();
      const mainViewport = mainViewportRef.current;

      if (
        target &&
        mainViewport &&
        mainViewport.contains(target) &&
        activeGuideStep?.focus !== 'transport'
      ) {
        const targetRect = target.getBoundingClientRect();
        const mainRect = mainViewport.getBoundingClientRect();
        const nextTop = mainViewport.scrollTop + (targetRect.top - mainRect.top) - 12;

        mainViewport.scrollTo({
          top: Math.max(0, nextTop),
          behavior: 'smooth',
        });
      } else {
        target?.scrollIntoView({
          behavior: 'smooth',
          block: activeGuideStep?.focus === 'transport' ? 'end' : 'nearest',
          inline: 'center',
        });
      }
      tutorialCameraTimeoutRef.current = null;
    }, 180);

    return () => {
      if (tutorialCameraTimeoutRef.current) {
        window.clearTimeout(tutorialCameraTimeoutRef.current);
        tutorialCameraTimeoutRef.current = null;
      }
    };
  }, [activeGuideStep?.focus, activeTab, getGuideFocusElement, isGuideOpen]);

  useEffect(() => {
    if (tutorialAdvanceTimeoutRef.current) {
      window.clearTimeout(tutorialAdvanceTimeoutRef.current);
      tutorialAdvanceTimeoutRef.current = null;
    }

    if (!isGuideOpen || !activeGuideQuest?.done) {
      return;
    }

    if (guideStepIndex >= liveTutorialQuests.length - 1) {
      return;
    }

    if (lastAutoAdvancedStepRef.current === guideStepIndex) {
      return;
    }

    lastAutoAdvancedStepRef.current = guideStepIndex;
    tutorialAdvanceTimeoutRef.current = window.setTimeout(() => {
      openGuideAt(guideStepIndex + 1);
      tutorialAdvanceTimeoutRef.current = null;
    }, 850);

    return () => {
      if (tutorialAdvanceTimeoutRef.current) {
        window.clearTimeout(tutorialAdvanceTimeoutRef.current);
        tutorialAdvanceTimeoutRef.current = null;
      }
    };
  }, [activeGuideQuest?.done, guideStepIndex, isGuideOpen, liveTutorialQuests.length, openGuideAt]);

  useEffect(() => {
    if (!user?.email || tutorialCompleted || liveTutorialProgress < 100) {
      return;
    }

    markComposerTutorialCompleted(user.email);
    syncGuideQuery(false);
  }, [
    liveTutorialProgress,
    markComposerTutorialCompleted,
    syncGuideQuery,
    tutorialCompleted,
    user?.email,
  ]);

  useEffect(() => {
    if (!collabId) {
      hasLoadedCollabRef.current = false;
      lastAppliedRevisionRef.current = 0;
      lastSentSignatureRef.current = '';
      pendingOperationSignatureRef.current = null;
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
      return;
    }

    void initializeRealtime().catch((error) => {
      console.error(error);
    });
  }, [collabId, initializeRealtime]);

  useEffect(() => {
    if (!projectId || collabId) {
      loadedProjectIdRef.current = null;
      return;
    }

    void seedLibrary().catch((error) => {
      console.error(error);
    });
  }, [collabId, projectId, seedLibrary]);

  useEffect(() => {
    if (!projectId || collabId || !loadedLibraryProject) {
      return;
    }

    if (loadedProjectIdRef.current === projectId) {
      return;
    }

    loadedProjectIdRef.current = projectId;
    loadProject(loadedLibraryProject.project);
  }, [collabId, loadedLibraryProject, loadProject, projectId]);

  useEffect(() => {
    if (!collabId || !collabProject?.snapshot) {
      return;
    }

    const incomingRevision = collabProject.snapshotRevision ?? 0;
    const incomingSignature = JSON.stringify(collabProject.snapshot);

    if (!hasLoadedCollabRef.current) {
      hasLoadedCollabRef.current = true;
      lastAppliedRevisionRef.current = incomingRevision;
      lastSentSignatureRef.current = incomingSignature;
      isApplyingRemoteRef.current = true;
      loadProject(collabProject.snapshot);
      window.setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 0);
      return;
    }

    if (incomingRevision <= lastAppliedRevisionRef.current) {
      return;
    }

    lastAppliedRevisionRef.current = incomingRevision;
    lastSentSignatureRef.current = incomingSignature;
    if (pendingOperationSignatureRef.current === incomingSignature) {
      pendingOperationSignatureRef.current = null;
    }

    if (collabProject.snapshotUpdatedBySessionId === COLLAB_SESSION_ID) {
      return;
    }

    isApplyingRemoteRef.current = true;
    applyRemoteProject(collabProject.snapshot);
    window.setTimeout(() => {
      isApplyingRemoteRef.current = false;
    }, 0);
  }, [applyRemoteProject, collabId, collabProject, loadProject]);

  useEffect(() => {
    if (!collabId || !collabProject || !user || !canSyncCollab || !hasLoadedCollabRef.current) {
      return;
    }

    if (
      isApplyingRemoteRef.current ||
      projectSignature === lastSentSignatureRef.current ||
      pendingOperationSignatureRef.current === projectSignature
    ) {
      return;
    }

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      void updateComposerSnapshot(collabId, {
        snapshot: projectSnapshot,
        email: user.email,
        name: user.name,
        sessionId: COLLAB_SESSION_ID,
        baseRevision: lastAppliedRevisionRef.current,
      })
        .then((revision) => {
          lastAppliedRevisionRef.current = Math.max(lastAppliedRevisionRef.current, revision);
          lastSentSignatureRef.current = projectSignature;
          setConflictNotice('');
        })
        .catch((error) => {
          console.error(error);
          if (error instanceof CollabRequestError && error.statusCode === 409) {
            setConflictNotice(
              '다른 사용자의 최신 변경이 먼저 저장되어 최신 버전으로 다시 맞췄습니다.'
            );

            if (conflictTimeoutRef.current) {
              window.clearTimeout(conflictTimeoutRef.current);
            }

            conflictTimeoutRef.current = window.setTimeout(() => {
              setConflictNotice('');
              conflictTimeoutRef.current = null;
            }, 4000);
          }
        });
    }, 400);

    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, [
    canSyncCollab,
    collabId,
    collabProject,
    projectSignature,
    projectSnapshot,
    updateComposerSnapshot,
    user,
    collabSyncTick,
  ]);

  useEffect(
    () => () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
      if (conflictTimeoutRef.current) {
        window.clearTimeout(conflictTimeoutRef.current);
      }
    },
    []
  );

  useEffect(
    () => () => {
      if (!collabId || !heldBarLocksRef.current.size) {
        return;
      }

      const heldLocks = [...heldBarLocksRef.current];
      heldBarLocksRef.current.clear();

      heldLocks.forEach((entry) => {
        const [instrument, barIndexValue] = entry.split(':');
        void setComposerLock(collabId, {
          instrument: instrument as CollabComposerInstrument,
          barIndex: Number(barIndexValue),
          sessionId: COLLAB_SESSION_ID,
          lock: false,
        }).catch((error) => {
          console.error(error);
        });
      });
    },
    [collabId, setComposerLock]
  );

  useEffect(() => {
    if (!collabId || !user) {
      return;
    }

    const focus = `composer:${getCollabInstrumentForTab(activeTab)}`;

    void touchPresence(collabId, {
      email: user.email,
      name: user.name,
      focus,
    }).catch((error) => {
      console.error(error);
    });

    const timer = window.setInterval(() => {
      void touchPresence(collabId, {
        email: user.email,
        name: user.name,
        focus,
      }).catch((error) => {
        console.error(error);
      });
    }, COLLAB_PRESENCE_PING_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      void leavePresence(collabId).catch((error) => {
        console.error(error);
      });
    };
  }, [activeTab, collabId, leavePresence, touchPresence, user]);

  const handleMixerChange = (tab: ComposerTab, volume: number) => {
    if (tab === 'lyrics') {
      return;
    }

    const instrument = getVolumeInstrumentForTab(tab);

    setInstrumentVolume(instrument, volume);

    if (!collabId || !canSyncCollab) {
      return;
    }

    queueComposerOperation({
      type: 'set-volume',
      instrument,
      volume,
    });
  };

  const handleTrackMixerChange = (item: ComposerTabItem, volume: number) => {
    if (item.trackId) {
      setExtraTrackVolume(item.trackId, volume);
      return;
    }

    handleMixerChange(item.tab, volume);
  };

  const handleMelodyOperationCommit = (payload: {
    row: number;
    col: number;
    length: number;
    barIndex: number;
  }) => {
    queueComposerOperation({
      type: 'set-melody-note',
      ...payload,
    });
  };

  const handleChordOperationCommit = (payload: {
    chord: string;
    col: number;
    isBass: boolean;
    rows: number[];
    barIndex: number;
  }) => {
    if (!payload.chord) {
      return;
    }

    queueComposerOperation({
      type: 'apply-chord',
      ...payload,
    });
  };

  const shouldAddTimedNote = (grid: boolean[][], lengths: number[][], row: number, col: number) =>
    !findMelodyNoteForTutorial(grid[row] ?? [], lengths[row] ?? [], col);

  const handleBassCellToggle = async (
    row: number,
    col: number,
    lengthSteps = primaryTrackNoteLengths.bass
  ) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('bass', barIndex))) {
      return;
    }

    const state = useSongStore.getState();
    const nextValue = shouldAddTimedNote(state.bass, state.bassLengths, row, col);
    toggleBass(row, col, lengthSteps);
    if (nextValue) {
      void playBassPreview(row, lengthSteps);
    }
    queueComposerOperation({
      type: 'toggle-bass-step',
      row,
      col,
      nextValue,
      barIndex,
    });
    releaseComposerBarLock('bass', barIndex);
  };

  const handleViolinCellToggle = async (
    row: number,
    col: number,
    lengthSteps = primaryTrackNoteLengths.violin
  ) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('violin', barIndex))) {
      return;
    }

    const state = useSongStore.getState();
    const nextValue = shouldAddTimedNote(state.violin, state.violinLengths, row, col);
    toggleViolin(row, col, lengthSteps);

    if (nextValue) {
      void playViolinPreview(row, lengthSteps);
    }

    queueComposerOperation({
      type: 'toggle-violin-step',
      row,
      col,
      nextValue,
      barIndex,
    });
    releaseComposerBarLock('violin', barIndex);
  };

  const handleSaxophoneCellToggle = async (
    row: number,
    col: number,
    lengthSteps = primaryTrackNoteLengths.saxophone
  ) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('saxophone', barIndex))) {
      return;
    }

    const state = useSongStore.getState();
    const nextValue = shouldAddTimedNote(state.saxophone, state.saxophoneLengths, row, col);
    toggleSaxophone(row, col, lengthSteps);

    if (nextValue) {
      void playSaxophonePreview(row, lengthSteps);
    }

    queueComposerOperation({
      type: 'toggle-saxophone-step',
      row,
      col,
      nextValue,
      barIndex,
    });
    releaseComposerBarLock('saxophone', barIndex);
  };

  const handleGuitarCellToggle = async (
    row: number,
    col: number,
    lengthSteps = primaryTrackNoteLengths.guitar
  ) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('guitar', barIndex))) {
      return;
    }

    const state = useSongStore.getState();
    const nextValue = shouldAddTimedNote(state.guitar, state.guitarLengths, row, col);
    toggleGuitar(row, col, lengthSteps);

    if (nextValue) {
      void playGuitarPreview(row, lengthSteps);
    }

    queueComposerOperation({
      type: 'toggle-guitar-step',
      row,
      col,
      nextValue,
      barIndex,
    });
    releaseComposerBarLock('guitar', barIndex);
  };

  const handleBassChordDrop = async (
    chord: string,
    col: number,
    lengthSteps = primaryTrackNoteLengths.bass
  ) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('bass', barIndex))) {
      return;
    }

    applyChord(chord, col, true, lengthSteps);
    queueComposerOperation({
      type: 'apply-chord',
      chord,
      col,
      isBass: true,
      rows: [...(BASS_CHORD_MAP[chord] ?? [])],
      barIndex,
    });
    releaseComposerBarLock('bass', barIndex);
  };

  const getChordRowsForNotes = (notes: readonly string[], chord: string) => {
    const chordNotes: Record<string, readonly string[]> = {
      C: ['C4', 'E4', 'G4'],
      D: ['D4', 'F#4', 'A4'],
      E: ['E4', 'G#4', 'B4'],
      F: ['F4', 'A4', 'C4'],
      G: ['G4', 'B4', 'D4'],
      A: ['A4', 'C#4', 'E4'],
      B: ['B4', 'D#4', 'F#4'],
    };

    return (chordNotes[chord] ?? [])
      .map((note) => notes.indexOf(note))
      .filter((row) => row >= 0);
  };

  const handlePrimaryPitchedChordDrop = async (
    instrument: 'violin' | 'saxophone' | 'guitar',
    chord: string,
    col: number,
    lengthSteps = primaryTrackNoteLengths[instrument]
  ) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock(instrument, barIndex))) {
      return;
    }

    const state = useSongStore.getState();
    const config =
      instrument === 'violin'
        ? {
            notes: VIOLIN_NOTES,
            grid: state.violin,
            lengths: state.violinLengths,
            toggle: toggleViolin,
            preview: playViolinPreview,
            operationType: 'toggle-violin-step' as const,
          }
        : instrument === 'saxophone'
          ? {
              notes: SAXOPHONE_NOTES,
              grid: state.saxophone,
              lengths: state.saxophoneLengths,
              toggle: toggleSaxophone,
              preview: playSaxophonePreview,
              operationType: 'toggle-saxophone-step' as const,
            }
          : {
              notes: GUITAR_TRACK_LABELS,
              grid: state.guitar,
              lengths: state.guitarLengths,
              toggle: toggleGuitar,
              preview: playGuitarPreview,
              operationType: 'toggle-guitar-step' as const,
            };

    getChordRowsForNotes(config.notes, chord).forEach((row) => {
      if (!shouldAddTimedNote(config.grid, config.lengths, row, col)) {
        return;
      }

      config.toggle(row, col, lengthSteps);
      void config.preview(row, lengthSteps);
      queueComposerOperation({
        type: config.operationType,
        row,
        col,
        nextValue: true,
        barIndex,
      });
    });

    releaseComposerBarLock(instrument, barIndex);
  };

  const handleDrumCellToggle = async (row: number, col: number) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock('drums', barIndex))) {
      return;
    }

    const nextValue = !(useSongStore.getState().drums[row]?.[col] ?? false);
    toggleDrum(row, col);
    void playDrumPreview(row);
    queueComposerOperation({
      type: 'toggle-drum-step',
      row,
      col,
      nextValue,
      barIndex,
    });
    releaseComposerBarLock('drums', barIndex);
  };

  const getExtraTrackNotes = (instrument: InstrumentKey): readonly string[] => {
    switch (instrument) {
      case 'melody':
        return MELODY_NOTES;
      case 'violin':
        return VIOLIN_NOTES;
      case 'saxophone':
        return SAXOPHONE_NOTES;
      case 'guitar':
        return GUITAR_TRACK_LABELS;
      case 'glockenspiel':
        return GLOCKENSPIEL_NOTES;
      case 'piccolo':
        return PICCOLO_NOTES;
      case 'supportingPiano':
        return SUPPORTING_PIANO_NOTES;
      case 'chicagoStreet':
        return CHICAGO_STREET_NOTES;
      case 'studioAltoSax':
        return STUDIO_ALTO_SAX_NOTES;
      case 'bass':
        return BASS_NOTES;
      case 'drums':
        return drumTracks.map((track) => track.name);
      default:
        return MELODY_NOTES;
    }
  };

  const getExtraTrackColors = (instrument: InstrumentKey): readonly string[] => {
    switch (instrument) {
      case 'melody':
        return melodyLaneColors;
      case 'violin':
        return violinLaneColors;
      case 'saxophone':
        return saxophoneLaneColors;
      case 'guitar':
        return guitarLaneColors;
      case 'glockenspiel':
        return glockenspielLaneColors;
      case 'piccolo':
        return piccoloLaneColors;
      case 'supportingPiano':
        return supportingPianoLaneColors;
      case 'chicagoStreet':
        return chicagoStreetLaneColors;
      case 'studioAltoSax':
        return studioAltoSaxLaneColors;
      case 'bass':
        return bassLaneColors;
      case 'drums':
        return ['#f97316', '#38bdf8', '#facc15', '#fb7185', '#a78bfa'];
      default:
        return melodyLaneColors;
    }
  };

  const playExtraTrackPreview = (
    instrument: InstrumentKey,
    row: number,
    lengthSteps: MelodyNoteLengthSteps = 4
  ) => {
    switch (instrument) {
      case 'melody':
        void playMelodyPreview(row, lengthSteps);
        break;
      case 'violin':
        void playViolinPreview(row, lengthSteps);
        break;
      case 'saxophone':
        void playSaxophonePreview(row, lengthSteps);
        break;
      case 'guitar':
        void playGuitarPreview(row, lengthSteps);
        break;
      case 'glockenspiel':
      case 'piccolo':
      case 'supportingPiano':
      case 'chicagoStreet':
      case 'studioAltoSax':
        void playSampledInstrumentPreview(instrument, row, lengthSteps);
        break;
      case 'bass':
        void playBassPreview(row, lengthSteps);
        break;
      case 'drums':
        void playDrumPreview(row);
        break;
      default:
        break;
    }
  };

  const handleExtraTrackCellToggle = async (
    track: ExtraInstrumentTrack,
    row: number,
    col: number,
    lengthSteps?: MelodyNoteLengthSteps
  ) => {
    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock(track.instrument, barIndex))) {
      return;
    }

    const liveTrack = useSongStore.getState().extraTracks.find((item) => item.id === track.id);
    const nextValue =
      track.instrument === 'drums'
        ? !(liveTrack?.grid[row]?.[col] ?? false)
        : shouldAddTimedNote(liveTrack?.grid ?? track.grid, liveTrack?.melodyLengths ?? [], row, col);
    toggleExtraTrackCell(track.id, row, col, track.instrument === 'drums' ? undefined : lengthSteps ?? 4);

    if (nextValue) {
      playExtraTrackPreview(track.instrument, row, lengthSteps ?? 4);
    }

    releaseComposerBarLock(track.instrument, barIndex);
  };

  const handleExtraTrackChordDrop = async (
    track: ExtraInstrumentTrack,
    chord: string,
    col: number,
    lengthSteps = extraTrackNoteLengths[track.id] ?? 4
  ) => {
    if (track.instrument === 'drums') {
      return;
    }

    const barIndex = Math.floor(col / COLLAB_BAR_LENGTH);
    if (!(await requestComposerBarLock(track.instrument, barIndex))) {
      return;
    }

    applyExtraTrackChord(track.id, chord, col, lengthSteps);
    releaseComposerBarLock(track.instrument, barIndex);
  };

  const getTabVolume = (item: ComposerTabItem) =>
    item.tab === 'lyrics'
      ? 100
      : item.trackId
      ? extraTracks.find((track) => track.id === item.trackId)?.volume ?? 80
      : volumes[getVolumeInstrumentForTab(item.tab)] ?? 80;

  const activePianoGridSteps =
    activeExtraTrack && activeExtraTrack.instrument !== 'drums'
      ? extraTrackNoteLengths[activeExtraTrack.id] ?? 4
      : isPitchedTab(activeTab)
        ? primaryTrackNoteLengths[activeTab]
        : 4;

  const handlePianoGridChange = (stepsValue: MelodyNoteLengthSteps) => {
    const selectedOption = melodyNoteLengthOptions.find((option) => option.steps === stepsValue);
    showPianoToolFeedback(`노트 길이 ${selectedOption?.label ?? '1/4'}`);
    if (activeExtraTrack && activeExtraTrack.instrument !== 'drums') {
      setExtraTrackNoteLengths((current) => ({
        ...current,
        [activeExtraTrack.id]: stepsValue,
      }));
      return;
    }

    if (isPitchedTab(activeTab)) {
      setPrimaryTrackNoteLengths((current) => ({ ...current, [activeTab]: stepsValue }));
    }
  };

  const changePianoZoom = (direction: -1 | 1) => {
    setPianoZoom((current) => {
      const next = Math.min(1.75, Math.max(0.5, current + direction * 0.25));
      showPianoToolFeedback(`${direction > 0 ? '확대' : '축소'} ${Math.round(next * 100)}%`);
      return next;
    });
  };

  const selectPianoEditTool = (tool: PianoEditTool, label: string) => {
    setPianoEditTool(tool);
    if (tool !== 'select' && tool !== 'marquee') {
      setPianoSelection(null);
      setPianoMarqueeOrigin(null);
    }
    showPianoToolFeedback(label);
  };

  const renderMelodyLikeSequencer = (
    instrument: PitchedTab,
    notes: readonly string[],
    grid: boolean[][],
    colors: readonly string[],
    onToggle: (row: number, col: number, lengthSteps?: MelodyNoteLengthSteps) => void | Promise<void>,
    onChordDrop?: (chord: string, col: number) => void | Promise<void>,
    options: MelodySequencerOptions = {}
  ) => {
    const scrollKey = options.scrollKey ?? instrument;
    const gridGap = 2;
    const rowHeight = MELODY_PIANO_ROW_HEIGHT;
    const stepWidth = Math.round(64 * pianoZoom);
    const headerHeight = 24;
    const headerMargin = 8;
    const bodyTopPadding = 8;
    const sidebarWidth = 68;
    const scrollLeft = pitchedRollScrollLeft[scrollKey] ?? 0;
    const scrollTop = pitchedRollScrollTop[scrollKey] ?? 0;
    const stepSpan = stepWidth + gridGap;
    const rowSpan = rowHeight + gridGap;
    const viewportStepCount = Math.ceil(
      Math.max(1280, typeof window === 'undefined' ? 1920 : window.innerWidth) / stepSpan
    );
    const firstVisibleStep = Math.floor(scrollLeft / stepSpan);
    const visibleStepStart = Math.max(0, firstVisibleStep - 24);
    const visibleStepEnd = Math.min(steps, firstVisibleStep + viewportStepCount + 24);
    const visibleSteps = Array.from(
      { length: Math.max(0, visibleStepEnd - visibleStepStart) },
      (_, index) => visibleStepStart + index
    );
    const viewportRowCount = Math.ceil(
      Math.max(600, typeof window === 'undefined' ? 900 : window.innerHeight) / rowSpan
    );
    const firstVisibleRow = Math.floor(scrollTop / rowSpan);
    const visibleRowStart = Math.max(0, firstVisibleRow - 5);
    const visibleRowEnd = Math.min(notes.length, firstVisibleRow + viewportRowCount + 5);
    const visibleRows = Array.from(
      { length: Math.max(0, visibleRowEnd - visibleRowStart) },
      (_, index) => visibleRowStart + index
    );
    const showTopbar = false;
    const noteLengthSteps = options.noteLengthSteps ?? 4;
    const rollStyle = {
      '--piano-grid-gap': `${gridGap}px`,
      '--piano-header-height': `${headerHeight}px`,
      '--piano-header-margin': `${headerMargin}px`,
      '--piano-body-top-padding': `${bodyTopPadding}px`,
      '--piano-control-bar-height': '0px',
      '--piano-step-width': `${stepWidth}px`,
      '--piano-step-span': `calc(${stepWidth}px + ${gridGap}px)`,
      '--piano-row-height': `${rowHeight}px`,
      '--piano-row-span': `calc(${rowHeight}px + ${gridGap}px)`,
      '--piano-row-count': `${notes.length}`,
      '--piano-sidebar-offset': `${bodyTopPadding + headerHeight + headerMargin}px`,
      '--piano-sidebar-width': `${sidebarWidth}px`,
    } as CSSProperties;

    return (
      <section
        className={`composer-roll-shell composer-roll-shell--melody is-tool-${pianoEditTool}`}
        key={`${scrollKey}-melody-like`}
        onMouseUp={() => setPianoMarqueeOrigin(null)}
        onMouseLeave={() => setPianoMarqueeOrigin(null)}
      >
        <div
          className={`piano-roll piano-roll--melody piano-roll--melody-detached piano-roll--${instrument}`}
          data-scroll-key={scrollKey}
          style={rollStyle}
        >
          {showTopbar ? (
            <div className="piano-roll-melody-topbar">
              <div className="piano-roll-melody-corner" aria-hidden="true" />
              <div className="piano-roll-length-bar">
                {options.showNoteLengthControls ? (
                  <div
                    className="piano-roll-length-controls"
                    onMouseEnter={(event) => handleHelpZoneEnter('length', event)}
                    onMouseMove={(event) => handleHelpZoneMove('length', event)}
                    onMouseLeave={() => handleHelpZoneLeave('length')}
                  >
                    {melodyNoteLengthOptions.map((option) => (
                      <button
                        key={option.steps}
                        type="button"
                        className={`piano-roll-length-button${
                          noteLengthSteps === option.steps ? ' is-active' : ''
                        }`}
                        onClick={() => options.onNoteLengthChange?.(option.steps)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                {options.showChordControls ? (
                  <div
                    className="piano-roll-chord-actions"
                    onMouseEnter={(event) => handleHelpZoneEnter('chords', event)}
                    onMouseMove={(event) => handleHelpZoneMove('chords', event)}
                    onMouseLeave={() => handleHelpZoneLeave('chords')}
                  >
                    {chordOptions.map((chord) => (
                      <button
                        key={chord}
                        type="button"
                        className={`piano-roll-chord-chip${options.chordChipClassName ?? ''}`}
                        draggable
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', chord);
                        }}
                      >
                        {chord}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="piano-roll-melody-header-row">
            <div className="piano-roll-melody-corner piano-roll-melody-corner--header" aria-hidden="true" />
            <div className="piano-roll-step-header-viewport">
              <div
                className="piano-roll-step-header piano-roll-step-header--melody"
                style={{
                  gridTemplateColumns: `repeat(${steps}, ${stepWidth}px)`,
                  transform: isPlaying ? undefined : `translateX(-${scrollLeft}px)`,
                } as CSSProperties}
              >
                {Array.from({ length: steps }).map((_, col) => (
                  <button
                    key={`${scrollKey}-header-${col}`}
                    type="button"
                    data-playhead-step={col}
                    className={`piano-roll-step-number${
                      col === currentStep ? ' is-current' : ''
                    }${getSubdivisionClassName(col)}${
                      loopRange && col >= loopRange.start && col <= loopRange.end
                        ? ' is-loop-active'
                        : ''
                    }${loopRange?.end === col ? ' is-loop-end' : ''}`}
                    onClick={() => handleStepLoopSelect(col)}
                    aria-label={`${col + 1}번 위치까지 반복`}
                    title={`${col + 1}번 위치까지 반복`}
                  >
                    {col % COLLAB_BAR_LENGTH === 0 ? (
                      <span className="piano-roll-bar-number" aria-hidden="true">
                        {Math.floor(col / COLLAB_BAR_LENGTH) + 1}
                      </span>
                    ) : null}
                    <span className="sr-only">{col + 1}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div
            className="piano-roll-melody-scroller"
            onScroll={(event) => {
              const nextScrollLeft = event.currentTarget.scrollLeft;
              setPitchedRollScrollLeft((current) => {
                const nextStoredScrollLeft = isPlayingRef.current
                  ? Math.floor(nextScrollLeft / (stepSpan * 16)) * stepSpan * 16
                  : nextScrollLeft;

                if ((current[scrollKey] ?? 0) === nextStoredScrollLeft) {
                  return current;
                }

                return {
                  ...current,
                  [scrollKey]: nextStoredScrollLeft,
                };
              });
              const nextScrollTop = event.currentTarget.scrollTop;
              setPitchedRollScrollTop((current) => {
                const nextStoredScrollTop = Math.floor(nextScrollTop / (rowSpan * 3)) * rowSpan * 3;
                if ((current[scrollKey] ?? 0) === nextStoredScrollTop) {
                  return current;
                }

                return {
                  ...current,
                  [scrollKey]: nextStoredScrollTop,
                };
              });
            }}
          >
            <div className="piano-roll-sidebar">
              <div
                className="piano-roll-sidebar-notes"
                style={{ gridTemplateRows: `repeat(${notes.length}, ${rowHeight}px)` }}
              >
                {notes.map((note, row) => {
                  const accentStyle = {
                    '--key-accent': colors[row % colors.length],
                  } as CSSProperties;

                  return (
                    <div
                      key={`${scrollKey}-key-${note}`}
                      className={`piano-roll-key is-melody${
                        isSharpNote(note) ? ' is-sharp' : ' is-natural'
                      }`}
                      style={accentStyle}
                    >
                      {note}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="piano-roll-body">
              <div className="piano-roll-content">
                <div
                  className="piano-roll-playhead piano-roll-playhead--detached"
                  style={
                    isPlaying
                      ? undefined
                      : ({ '--piano-step-index': `${currentStep}` } as CSSProperties)
                  }
                />

                <div
                  className="piano-roll-grid piano-roll-grid--melody piano-roll-grid--virtualized"
                  style={{
                    width: `${steps * stepSpan - gridGap}px`,
                    height: `${notes.length * rowSpan - gridGap}px`,
                  }}
                >
                  {visibleRows.flatMap((row) => {
                    const note = notes[row];
                    return (
                    visibleSteps.map((col) => {
                      const noteInfo = options.melodyLengths
                        ? findMelodyNoteForTutorial(
                            grid[row] ?? [],
                            options.melodyLengths[row] ?? [],
                            col
                          )
                        : null;
                      const isNoteStart = Boolean(noteInfo && noteInfo.start === col);
                      const isNoteTail = Boolean(noteInfo && noteInfo.start !== col);
                      const active = noteInfo ? isNoteStart : grid[row]?.[col];
                      const hasNote = Boolean(active || isNoteTail);
                      const isCurrent = col === currentStep;
                      const isSelected = Boolean(
                        pianoSelection &&
                          pianoSelection.scrollKey === scrollKey &&
                          row >= Math.min(pianoSelection.startRow, pianoSelection.endRow) &&
                          row <= Math.max(pianoSelection.startRow, pianoSelection.endRow) &&
                          col >= Math.min(pianoSelection.startCol, pianoSelection.endCol) &&
                          col <= Math.max(pianoSelection.startCol, pianoSelection.endCol)
                      );
                      const lock = currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)];
                      const isLocked = Boolean(lock && !lock.mine);
                      const cellStyle = {
                        '--cell-accent': colors[row % colors.length],
                        '--note-span-steps': `${noteInfo?.length ?? 1}`,
                        left: `${col * stepSpan}px`,
                        top: `${row * rowSpan}px`,
                        width: `${stepWidth}px`,
                        height: `${rowHeight}px`,
                      } as CSSProperties;

                      return (
                        <button
                          key={`${scrollKey}-${note}-${col}`}
                          type="button"
                          data-playhead-step={col}
                          className={`piano-roll-cell is-melody${active ? ' is-active is-note-start' : ''}${
                            isCurrent ? ' is-current' : ''
                          }${getSubdivisionClassName(col)}${isSharpNote(note) ? ' is-sharp' : ''}${
                            isNoteTail ? ' is-note-tail' : ''
                          }${
                            isLocked ? ' is-locked' : ''
                          }${collabId && !canSyncCollab ? ' is-readonly' : ''}${
                            isSelected ? ' is-tool-selected' : ''
                          }`}
                          style={cellStyle}
                          disabled={isLocked || Boolean(collabId && !canSyncCollab)}
                          onMouseDown={(event) => {
                            if (pianoEditTool === 'zoom') {
                              changePianoZoom(event.shiftKey ? -1 : 1);
                              return;
                            }

                            if (pianoEditTool === 'select') {
                              setPianoSelection({
                                scrollKey,
                                startRow: row,
                                endRow: row,
                                startCol: noteInfo?.start ?? col,
                                endCol: noteInfo ? noteInfo.start + noteInfo.length - 1 : col,
                              });
                              return;
                            }

                            if (pianoEditTool === 'marquee') {
                              setPianoMarqueeOrigin({ scrollKey, row, col });
                              setPianoSelection({
                                scrollKey,
                                startRow: row,
                                endRow: row,
                                startCol: col,
                                endCol: col,
                              });
                              return;
                            }

                            if (pianoEditTool === 'pencil' && hasNote) return;
                            if (pianoEditTool === 'eraser' && !hasNote) return;
                            if (hasNote) {
                              setPianoSelection(null);
                              setPianoMarqueeOrigin(null);
                            }
                            void onToggle(row, noteInfo?.start ?? col, noteLengthSteps);
                          }}
                          onMouseMove={() => {
                            if (
                              pianoEditTool !== 'marquee' ||
                              !pianoMarqueeOrigin ||
                              pianoMarqueeOrigin.scrollKey !== scrollKey
                            ) {
                              return;
                            }
                            setPianoSelection({
                              scrollKey,
                              startRow: pianoMarqueeOrigin.row,
                              endRow: row,
                              startCol: pianoMarqueeOrigin.col,
                              endCol: col,
                            });
                          }}
                          onDragOver={onChordDrop ? (event) => event.preventDefault() : undefined}
                          onDrop={
                            onChordDrop
                              ? (event) => {
                                  event.preventDefault();
                                  const chord = event.dataTransfer.getData('text/plain');
                                  if (chord) {
                                    void onChordDrop(chord, col);
                                  }
                                }
                              : undefined
                          }
                        >
                          {active ? <span className="piano-roll-note-block" aria-hidden="true" /> : null}
                        </button>
                      );
                    })
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderExtraDrumSequencer = (track: ExtraInstrumentTrack) => (
    <section className="composer-drum-shell" key={`${track.id}-drums`}>
      <div className="composer-drum-panel">
        <div className="composer-drums-wrap">
          <div className="composer-sequencer-body">
            <div
              className="composer-sequencer-playhead"
              style={
                isPlaying
                  ? undefined
                  : ({ '--sequencer-step-index': `${currentStep}` } as CSSProperties)
              }
              aria-hidden="true"
            />
            <div className="composer-sequencer-header">
              <div className="composer-drum-step-spacer">Pattern</div>

              <div
                className="composer-step-grid"
                style={{
                  gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                  ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                }}
              >
                {Array.from({ length: steps }).map((_, col) => (
                  <button
                    key={`${track.id}-drum-header-${col}`}
                    type="button"
                    data-playhead-step={col}
                    className={`composer-drum-step-number${
                      col === currentStep ? ' is-current' : ''
                    }${getSubdivisionClassName(col)}${
                      loopRange && col >= loopRange.start && col <= loopRange.end
                        ? ' is-loop-active'
                        : ''
                    }${loopRange?.end === col ? ' is-loop-end' : ''}`}
                    onClick={() => handleStepLoopSelect(col)}
                    aria-label={`${col + 1}번 위치까지 반복`}
                    title={`${col + 1}번 위치까지 반복`}
                  >
                    <span className="sr-only">{col + 1}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="composer-sequencer-rows">
              {drumTracks.slice(0, DRUM_ROWS).map((drumTrack, row) => (
                <div key={`${track.id}-${drumTrack.name}`} className="composer-drum-row">
                  <div className={`composer-drum-track is-${drumTrack.tone}`}>
                    <strong>{drumTrack.name}</strong>
                    <span>{drumTrack.hint}</span>
                  </div>

                  <div
                    className="composer-drum-row-grid"
                    style={{
                      gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                      ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                    }}
                  >
                    {Array.from({ length: steps }).map((_, col) => {
                      const active = track.grid[row]?.[col];
                      const lock = currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)];
                      const isLocked = Boolean(lock && !lock.mine);

                      return (
                        <button
                          key={`${track.id}-${drumTrack.name}-${col}`}
                          type="button"
                          data-playhead-step={col}
                          className={`composer-drum-cell is-${drumTrack.tone}${
                            active ? ' is-active' : ''
                          }${col === currentStep ? ' is-current' : ''}${getSubdivisionClassName(
                            col
                          )}${lock?.mine ? ' is-own-locked' : isLocked ? ' is-locked' : ''}`}
                          onClick={() => {
                            void handleExtraTrackCellToggle(track, row, col);
                          }}
                          disabled={isLocked || Boolean(collabId && !canSyncCollab)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  return (
    <div
      className={`composer-page composer-page--${activeTab}${
        isGuideOpen ? ' composer-page--guide-open' : ''
      }${isHelpOverlayEnabled ? ' is-help-enabled' : ''}${isPlaying ? ' is-playing' : ''}`}
    >
      <SiteHeader activeSection="composer" />
      <input
        ref={videoOverlayInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={handleSelectVideoOverlay}
      />

      <div className="composer-workbar">
        <div className="composer-project-meta" aria-label="작곡 도움말">
          <button
            type="button"
            className={`composer-help-toggle-button${isHelpOverlayEnabled ? ' is-active' : ''}`}
            onClick={() => {
              setIsHelpOverlayEnabled((enabled) => {
                const nextEnabled = !enabled;
                if (!nextEnabled) {
                  setActiveHelpZone(null);
                }

                return nextEnabled;
              });
            }}
            aria-pressed={isHelpOverlayEnabled}
          >
            {isHelpOverlayEnabled ? '도움말 켜짐' : '도움말'}
          </button>
        </div>

        <div className="composer-workbar-controls">
          <div
            ref={mixerStripRef}
            className={`composer-tab-stack${getGuideHighlightClass('mixer')}`}
          >
            <div
              ref={tabStripRef}
              className={`composer-tab-strip${getGuideHighlightClass('tabs')}`}
              role="tablist"
              aria-label="악기 탭"
            >
              {openTabItems.map((item) => {
                const tab = item.tab;
                const isActive = item.trackId ? activeTrackId === item.trackId : activeTab === tab && !activeTrackId;
                const tabVolume = getTabVolume(item);

                return (
                <div
                  key={item.id}
                  className={`composer-tab-card is-${tab}${
                    isActive ? ' is-active' : ''
                  }${
                    item.trackId ? ' is-duplicate' : ''
                  }${getTutorialTabClass(tab)}`}
                  style={{ ['--composer-tab-volume' as string]: `${tabVolume}%` }}
                >
                  <button
                    type="button"
                    className="composer-tab-button"
                    onClick={() => {
                      activateTab(tab, item.trackId ?? null);
                    }}
                    aria-pressed={isActive}
                  >
                    <span className="composer-tab-button-inner">
                      <span className="composer-tab-label">{item.label}</span>
                      {!tutorialRequested && !DEFAULT_OPEN_TABS.includes(tab) ? (
                        <span
                          role="button"
                          tabIndex={0}
                          className="composer-tab-close"
                          aria-label={`${item.label} 닫기`}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleCloseTab(item);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              handleCloseTab(item);
                            }
                          }}
                        >
                          ×
                        </span>
                      ) : null}
                    </span>
                  </button>

                  {tab !== 'lyrics' ? (
                    <label className="composer-tab-volume">
                      <span className="sr-only">{`${item.label} volume`}</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={tabVolume}
                        onChange={(event) => handleTrackMixerChange(item, Number(event.target.value))}
                      />
                    </label>
                  ) : null}
                </div>
                );
              })}

              <div
                ref={tabPickerRef}
                className="composer-tab-picker"
                onMouseEnter={(event) => handleHelpZoneEnter('instruments', event)}
                onMouseMove={(event) => handleHelpZoneMove('instruments', event)}
                onMouseLeave={() => handleHelpZoneLeave('instruments')}
              >
                <button
                  ref={tabAddButtonRef}
                  type="button"
                  className={`composer-tab-add-button${isTabPickerOpen ? ' is-open' : ''}`}
                  onClick={handleTabPickerToggle}
                  aria-label="악기 선택"
                  aria-expanded={isTabPickerOpen}
                  aria-haspopup="menu"
                >
                  +
                </button>

                {isTabPickerOpen && tabPickerMenuPosition ? (
                  <div
                    className="composer-tab-picker-menu"
                    role="menu"
                    aria-label="선택 가능한 악기"
                    style={{
                      top: `${tabPickerMenuPosition.top}px`,
                      left: `${tabPickerMenuPosition.left}px`,
                      minWidth: `${tabPickerMenuPosition.minWidth}px`,
                      maxHeight: `${tabPickerMenuPosition.maxHeight}px`,
                    }}
                  >
                    {tabPickerGroups.map((group) => (
                      <div key={group.title} className="composer-tab-picker-section">
                        <div className="composer-tab-picker-section-title">{group.title}</div>
                        {group.options.map((tab) => {
                          const isAirInstrument = tab === 'airInstrument';
                          const isVideoOverlay = tab === 'videoOverlay';
                          const isMediaOption = isAirInstrument || isVideoOverlay;
                          const isOpen =
                            isAirInstrument
                              ? false
                              : isVideoOverlay
                                ? Boolean(videoOverlay)
                                : openTabs.includes(tab);
                          const isActive =
                            !isMediaOption && activeTab === tab && !activeTrackId;

                          return (
                            <button
                              key={tab}
                              type="button"
                              className={`composer-tab-picker-item is-${tab}${
                                isActive ? ' is-active' : ''
                              }${isOpen ? ' is-opened' : ''}`}
                              onClick={() => handleOpenTab(tab)}
                            >
                              <span>{getTabPickerLabel(tab)}</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

            </div>

          </div>
        </div>
      </div>

      {videoOverlay ? (
        <aside
          className={`composer-media-overlay composer-video-overlay${
            isMediaOverlayCompact ? ' is-compact' : ''
          }`}
          aria-label="영상 오버레이"
        >
          <div className="composer-media-overlay-head">
            <div>
              <span>VIDEO OVERLAY</span>
              <strong>{videoOverlay.name}</strong>
            </div>
            <div className="composer-media-overlay-actions">
              <button
                type="button"
                className="composer-video-sound-play"
                onClick={handlePlayVideoOverlayWithSound}
              >
                소리 켜고 재생
              </button>
              <div className="composer-video-volume-control">
                <button
                  type="button"
                  onClick={handleToggleVideoOverlayMute}
                  aria-label={isVideoOverlayMuted ? '영상 소리 켜기' : '영상 음소거'}
                  title={isVideoOverlayMuted ? '소리 켜기' : '음소거'}
                >
                  {isVideoOverlayMuted || videoOverlayVolume === 0 ? '🔇' : '🔊'}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isVideoOverlayMuted ? 0 : videoOverlayVolume}
                  onChange={handleVideoOverlayVolumeChange}
                  aria-label="영상 음량"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsMediaOverlayCompact((current) => !current)}
                aria-label={isMediaOverlayCompact ? '영상 크게 보기' : '영상 작게 보기'}
              >
                {isMediaOverlayCompact ? '□' : '—'}
              </button>
              <button type="button" onClick={handleCloseVideoOverlay} aria-label="영상 닫기">
                ×
              </button>
            </div>
          </div>
          <video
            key={videoOverlay.url}
            ref={videoOverlayPlayerRef}
            src={videoOverlay.url}
            controls
            playsInline
            loop
            preload="auto"
            onLoadedMetadata={(event) => applyVideoOverlayAudioSettings(event.currentTarget)}
            onLoadedData={(event) => applyVideoOverlayAudioSettings(event.currentTarget)}
            onCanPlay={(event) => applyVideoOverlayAudioSettings(event.currentTarget)}
            onPlay={handleVideoOverlayPlay}
          />
          {videoOverlayAudioMessage ? (
            <div
              className={`composer-video-audio-message${
                videoOverlayAudioMessage.includes('찾지 못했습니다') ? ' is-error' : ''
              }`}
            >
              {videoOverlayAudioMessage}
            </div>
          ) : null}
        </aside>
      ) : null}

      {collabId ? (
        <section className={`composer-collab-banner is-${connectionStatus}`}>
          <div className="composer-collab-copy">
            <strong>{collabProject?.title ?? '작업 프로젝트 불러오는 중'}</strong>
            <span>{collabStatusLabel}</span>
          </div>

          <div className="composer-collab-side">
            <div className="composer-collab-actions">
            <span className="composer-collab-chip">
              {canSyncCollab ? '공동 편집' : '읽기 전용'}
            </span>
            {activeEditorsLabel ? (
              <span className="composer-collab-chip">{activeEditorsLabel}</span>
            ) : null}
            {visibleComposerLocks.map((lock) => (
              <span
                key={`${lock.instrument}-${lock.barIndex}-${lock.sessionId}`}
                className="composer-collab-chip composer-collab-chip--lock"
              >
                {lock.name} - {composerInstrumentLabels[lock.instrument]} {lock.barIndex + 1}마디
              </span>
            ))}
            {conflictNotice ? (
              <span className="composer-collab-chip composer-collab-chip--warning">
                {conflictNotice}
              </span>
            ) : null}
            <button
              type="button"
              className="composer-collab-button"
              onClick={() => navigate(collabProject ? `/collab/${collabProject.id}` : '/collab')}
            >
              작업방으로
            </button>
          </div>
            {recentComposerHistory.length ? (
              <div className="composer-collab-history">
                {recentComposerHistory.map((entry) => (
                  <span key={entry.id} className="composer-collab-history-item">
                    <strong>{entry.authorName}</strong>
                    <span>{entry.summary}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <aside
        className={`composer-notepad${isNotepadOpen ? ' is-open' : ' is-collapsed'}`}
        aria-label="가사와 메모"
      >
        <div className="composer-notepad-head">
          {isNotepadOpen ? <strong>가사 · 메모</strong> : <span>가사 · 메모</span>}
          <button
            type="button"
            className="composer-notepad-toggle"
            onClick={() => setIsNotepadOpen((current) => !current)}
            aria-label={isNotepadOpen ? '가사 메모 접기' : '가사 메모 펼치기'}
            title={isNotepadOpen ? '접기' : '펼치기'}
          >
            {isNotepadOpen ? '›' : '‹'}
          </button>
        </div>

        {isNotepadOpen ? (
          <div className="composer-notepad-body">
            <div className="composer-notepad-tabs" role="tablist" aria-label="작성 종류">
              <button
                type="button"
                className={notepadMode === 'lyrics' ? 'is-active' : ''}
                onClick={() => setNotepadMode('lyrics')}
                role="tab"
                aria-selected={notepadMode === 'lyrics'}
              >
                가사
              </button>
              <button
                type="button"
                className={notepadMode === 'memo' ? 'is-active' : ''}
                onClick={() => setNotepadMode('memo')}
                role="tab"
                aria-selected={notepadMode === 'memo'}
              >
                메모
              </button>
            </div>

            <input
              className="composer-notepad-title"
              value={notepadDraft.title}
              onChange={(event) =>
                setNotepadDraft((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="곡 제목"
              maxLength={80}
            />

            <textarea
              className="composer-notepad-editor"
              value={notepadMode === 'lyrics' ? notepadDraft.lyrics : notepadDraft.memo}
              onChange={(event) => {
                const value = event.target.value;
                setNotepadDraft((current) => ({
                  ...current,
                  [notepadMode]: value,
                }));
              }}
              placeholder={
                notepadMode === 'lyrics'
                  ? '떠오르는 가사를 자유롭게 적어두세요.'
                  : '곡의 분위기, 코드, 편곡 아이디어를 기록하세요.'
              }
            />

            <div className="composer-notepad-actions">
              {notepadMode === 'lyrics' ? (
                <button type="button" onClick={handleSendNotepadLyrics}>
                  작사 탭으로 보내기
                </button>
              ) : (
                <button type="button" onClick={() => setNotepadMode('lyrics')}>
                  가사로 전환
                </button>
              )}
              <button type="button" onClick={handleExportNotepad}>
                내보내기
              </button>
            </div>
          </div>
        ) : null}
      </aside>

      <div
        className={`composer-studio-layout${isArrangementCollapsed ? ' is-arrangement-collapsed' : ''}`}
        style={{
          ['--arrangement-panel-height' as string]: `${
            52 + Math.min(arrangementVisibleTracks.length, 7) * 58
          }px`,
        }}
      >
        <aside className="composer-track-panel" aria-label="트랙 목록">
          <div className="composer-track-panel-head">
            <strong>트랙 ({arrangementVisibleTracks.length})</strong>
            <div ref={tabPickerRef} className="composer-track-add-wrap">
              <button
                ref={tabAddButtonRef}
                type="button"
                className="composer-track-add"
                onClick={() => setIsTabPickerOpen((open) => !open)}
                aria-label="트랙 추가"
                aria-expanded={isTabPickerOpen}
              >
                +
              </button>
              {isTabPickerOpen ? (
                <div className="composer-track-add-menu" role="menu" aria-label="추가할 트랙">
                  {tabPickerGroups.map((group) => (
                    <div key={group.title} className="composer-track-add-group">
                      <span>{group.title}</span>
                      {group.options.map((tab) => (
                        <button key={tab} type="button" onClick={() => handleTrackPickerOpen(tab)}>
                          {getTabPickerLabel(tab)}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className={`composer-track-list${
              arrangementVisibleTracks.length > 7 ? ' has-overflow' : ''
            }`}
          >
            {arrangementVisibleTracks.map((track, index) => {
              const isActive =
                activeTab === track.tab &&
                (track.trackId ? activeTrackId === track.trackId : !activeTrackId);
              const isMuted = mutedArrangementTracks.has(track.id);
              const isSolo = soloArrangementTrack === track.id;
              const trackVolume = track.trackId
                ? extraTracks.find((item) => item.id === track.trackId)?.volume ?? 80
                : volumes[track.tab as InstrumentKey] ?? 80;

              return (
                <div
                  key={track.key ?? track.id}
                  className={`composer-track-row is-${track.tone}${isActive ? ' is-active' : ''}${
                    isMuted ? ' is-muted' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="composer-track-select"
                    onClick={() => handleArrangementTrackSelect(track)}
                    aria-pressed={isActive}
                  >
                    <span className="composer-track-number">{index + 1}</span>
                    <span
                      className={`composer-track-icon${isMuted ? ' is-muted' : ''}`}
                      aria-hidden="true"
                    >
                      {track.icon}
                    </span>
                    <span className="composer-track-name">{track.label}</span>
                  </button>
                  <div className="composer-track-toggles">
                    <button
                      type="button"
                      className={isMuted ? 'is-active' : ''}
                      onClick={() => handleArrangementMute(track)}
                      aria-pressed={isMuted}
                      aria-label={
                        isMuted
                          ? `${track.label} 음소거 해제. 이 트랙의 소리를 다시 켭니다.`
                          : `${track.label} 음소거. 이 트랙의 소리만 끕니다.`
                      }
                      title={
                        isMuted
                          ? `${track.label} 음소거 해제 (M) · 이 트랙의 소리를 다시 켭니다.`
                          : `${track.label} 음소거 (M) · 이 트랙의 소리만 끕니다.`
                      }
                      disabled={Boolean(soloArrangementTrack)}
                    >
                      M
                    </button>
                    <button
                      type="button"
                      className={isSolo ? 'is-active' : ''}
                      onClick={() => handleArrangementSolo(track)}
                      aria-pressed={isSolo}
                      aria-label={
                        isSolo
                          ? `${track.label} 솔로 해제. 모든 트랙을 원래 소리로 되돌립니다.`
                          : `${track.label} 솔로 재생. 다른 트랙을 끄고 이 트랙만 듣습니다.`
                      }
                      title={
                        isSolo
                          ? `${track.label} 솔로 해제 (S) · 모든 트랙을 원래 소리로 되돌립니다.`
                          : `${track.label} 솔로 재생 (S) · 다른 트랙을 끄고 이 트랙만 듣습니다.`
                      }
                    >
                      S
                    </button>
                  </div>
                  <button
                    type="button"
                    className="composer-track-more"
                    aria-label={`${track.label} 메뉴`}
                    aria-expanded={openTrackMenuId === (track.key ?? track.id)}
                    onClick={() =>
                      setOpenTrackMenuId((current) =>
                        current === (track.key ?? track.id) ? null : (track.key ?? track.id)
                      )
                    }
                  >
                    ⋮
                  </button>
                  {openTrackMenuId === (track.key ?? track.id) ? (
                    <div className="composer-track-context-menu" role="menu" aria-label={`${track.label} 작업`}>
                      <div className="composer-track-volume-control">
                        <span>
                          볼륨 <strong>{trackVolume}</strong>
                        </span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={trackVolume}
                          aria-label={`${track.label} 볼륨`}
                          onChange={(event) =>
                            handleArrangementVolumeChange(track, Number(event.target.value))
                          }
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          handleDuplicateArrangementTrack(track);
                        }}
                      >
                        트랙 복제
                      </button>
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => handleArrangementTrackDelete(track)}
                      >
                        트랙 삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="composer-arrangement-stage">
          <div
            className="composer-arrangement-overview"
            aria-label="편곡 타임라인"
            style={
              {
                '--arrangement-label-count': `${arrangementTimelineBars.length}`,
                '--arrangement-major-span': `${Math.min(100, (4 / arrangementBarCount) * 100)}%`,
                '--arrangement-minor-span': `${100 / arrangementBarCount}%`,
              } as CSSProperties
            }
          >
            <div
              className="composer-arrangement-ruler"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('.composer-arrangement-tools')) return;
                const timeline = event.currentTarget.parentElement?.querySelector<HTMLElement>(
                  '.composer-arrangement-lanes'
                );
                if (timeline) handleArrangementPointerSelect(event.clientX, timeline);
              }}
            >
              {arrangementTimelineBars.map((bar) => (
                <button key={bar} type="button">
                  {bar}
                </button>
              ))}
              <div className="composer-arrangement-tools" aria-label="타임라인 보기 도구">
                <button
                  type="button"
                  aria-label="전체 화면"
                  title="전체 화면"
                  onClick={() => {
                    const stage = document.querySelector<HTMLElement>('.composer-arrangement-stage');
                    if (!stage) return;

                    if (document.fullscreenElement) {
                      void document.exitFullscreen();
                      return;
                    }

                    void stage.requestFullscreen();
                  }}
                >
                  ⛶
                </button>
              </div>
            </div>
            <div
              className="composer-arrangement-lanes"
              style={{
                ['--arrangement-track-count' as string]: `${arrangementVisibleTracks.length}`,
              }}
            >
              {arrangementVisibleTracks.map((track, index) => {
                const trackKey = track.key ?? track.id;
                const renderClip = (section: 'first' | 'second', clipNumber: number) => {
                  const clipKey = `${trackKey}-${section}`;
                  const layout =
                    arrangementClipLayouts[clipKey] ??
                    getDefaultArrangementClipLayout(index, section);
                  const trackData = getArrangementTrackData(track);
                  const preview = buildArrangementClipPreview(
                    trackData.grid,
                    trackData.lengths,
                    (layout.start / 100) * steps,
                    ((layout.start + layout.length) / 100) * steps
                  );
                  const isSelected = selectedArrangementClip === clipKey;
                  const isDragging = draggingArrangementClip === clipKey;
                  const isActiveTrack =
                    activeTab === track.tab &&
                    (track.trackId ? activeTrackId === track.trackId : !activeTrackId);

                  return (
                    <button
                      key={clipKey}
                      type="button"
                      draggable
                      className={`composer-clip${preview.hasAudio ? ' has-audio' : ' is-empty'}${
                        isSelected ? ' is-selected' : ''
                      }${isDragging ? ' is-dragging' : ''}${isActiveTrack ? ' is-active-track' : ''}`}
                      style={{ left: `${layout.start}%`, width: `${layout.length}%` }}
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedArrangementClip(clipKey);
                        handleArrangementTrackSelect(track);
                        const lane = event.currentTarget.closest<HTMLElement>(
                          '.composer-arrangement-lane'
                        );
                        const { bar } = lane
                          ? handleArrangementPointerSelect(event.clientX, lane)
                          : handleArrangementProgressSelect(layout.start);
                        showPianoToolFeedback(`${track.label} ${String(clipNumber).padStart(2, '0')} · ${bar}마디`);
                      }}
                      onDragStart={(event) => {
                        const lane = event.currentTarget.closest<HTMLElement>('.composer-arrangement-lane');
                        if (!lane) return;
                        const clipBounds = event.currentTarget.getBoundingClientRect();
                        const laneBounds = lane.getBoundingClientRect();
                        const offsetPercent =
                          ((event.clientX - clipBounds.left) / Math.max(1, laneBounds.width)) * 100;
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData(
                          'application/x-composer-clip',
                          JSON.stringify({ clipKey, trackKey, offsetPercent, length: layout.length })
                        );
                        setSelectedArrangementClip(clipKey);
                        setDraggingArrangementClip(clipKey);
                      }}
                      onDragEnd={() => setDraggingArrangementClip(null)}
                    >
                      <span
                        className="composer-clip-resize is-start"
                        onPointerDown={(event) =>
                          handleArrangementClipResizeStart(event, clipKey, layout, 'start')
                        }
                        aria-hidden="true"
                      />
                      <strong>{track.label} {String(clipNumber).padStart(2, '0')}</strong>
                      <span className="composer-clip-activity" aria-hidden="true">
                        {preview.activityRanges.map((range, rangeIndex) => (
                          <span
                            key={`${clipKey}-activity-${rangeIndex}`}
                            style={{ left: `${range.start}%`, width: `${range.width}%` }}
                          />
                        ))}
                      </span>
                      <svg
                        className="composer-clip-pitch-line"
                        viewBox="0 0 100 24"
                        preserveAspectRatio="none"
                        aria-hidden="true"
                      >
                        {preview.pitchSegments.map((points, segmentIndex) => (
                          <polyline
                            key={`${clipKey}-pitch-${segmentIndex}`}
                            points={points}
                            vectorEffect="non-scaling-stroke"
                          />
                        ))}
                      </svg>
                      <span
                        className="composer-clip-resize is-end"
                        onPointerDown={(event) =>
                          handleArrangementClipResizeStart(event, clipKey, layout, 'end')
                        }
                        aria-hidden="true"
                      />
                    </button>
                  );
                };

                return (
                  <div
                    key={trackKey}
                    className={`composer-arrangement-lane is-${track.tone}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(event) => handleArrangementClipDrop(event, trackKey)}
                    onClick={(event) => {
                      if (event.target !== event.currentTarget) return;
                      const bounds = event.currentTarget.getBoundingClientRect();
                      const percent = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * 100;
                      handleArrangementTrackSelect(track);
                      handleArrangementProgressSelect(percent);
                      setSelectedArrangementClip(null);
                    }}
                  >
                    {renderClip('first', 1)}
                    {renderClip('second', 2)}
                  </div>
                );
              })}
              <div
                className="composer-arrangement-playhead"
                style={
                  isPlaying
                    ? undefined
                    : ({
                        ['--arrangement-progress' as string]: `${Math.min(100, Math.max(0, (currentStep / Math.max(1, steps - 1)) * 100))}%`,
                      } as CSSProperties)
                }
                aria-hidden="true"
              />
            </div>
          </div>

          <div className="composer-detail-toolbar">
            <button
              type="button"
              className="composer-split-handle"
              aria-label={isArrangementCollapsed ? '편곡 영역 펼치기' : '편곡 영역 접기'}
              aria-expanded={!isArrangementCollapsed}
              onClick={() =>
                setIsArrangementCollapsed((collapsed) => {
                  showPianoToolFeedback(collapsed ? '편곡 영역 펼치기' : '편곡 영역 접기');
                  return !collapsed;
                })
              }
            >
              <span
                className={`composer-split-chevron${
                  isArrangementCollapsed ? ' is-down' : ' is-up'
                }`}
                aria-hidden="true"
              />
            </button>
            {pianoToolFeedback ? (
              <output className="composer-tool-feedback" role="status">
                {pianoToolFeedback}
              </output>
            ) : null}
            <div className="composer-detail-tabs">
              <button type="button" className="is-active">
                {(activeExtraTrack
                  ? activeExtraTrack.instrument === 'drums'
                  : activeTab === 'drums')
                  ? '드럼 패드'
                  : '피아노롤'}
              </button>
            </div>
            {(activeExtraTrack
              ? activeExtraTrack.instrument !== 'drums'
              : activeTab !== 'drums') ? (
              <div className="composer-detail-tools" aria-label="피아노롤 편집 도구">
                <div className="composer-edit-tool-group">
                  <button
                    type="button"
                    className={pianoEditTool === 'select' ? 'is-active' : ''}
                    aria-label="선택 도구"
                    aria-pressed={pianoEditTool === 'select'}
                    title="선택"
                    onClick={() => selectPianoEditTool('select', '선택 도구')}
                  >↖</button>
                  <button
                    type="button"
                    className={pianoEditTool === 'pencil' ? 'is-active' : ''}
                    aria-label="연필 도구"
                    aria-pressed={pianoEditTool === 'pencil'}
                    title="노트 그리기"
                    onClick={() => selectPianoEditTool('pencil', '노트 그리기')}
                  >✎</button>
                  <button
                    type="button"
                    className={pianoEditTool === 'eraser' ? 'is-active' : ''}
                    aria-label="지우개 도구"
                    aria-pressed={pianoEditTool === 'eraser'}
                    title="노트 지우기"
                    onClick={() => selectPianoEditTool('eraser', '노트 지우기')}
                  >◇</button>
                  <button
                    type="button"
                    className={pianoEditTool === 'zoom' ? 'is-active' : ''}
                    aria-label="확대 도구"
                    aria-pressed={pianoEditTool === 'zoom'}
                    title="확대 (Shift+클릭: 축소)"
                    onClick={() => selectPianoEditTool('zoom', '확대 도구 · Shift+클릭 시 축소')}
                  >⌕</button>
                </div>
                <div className="composer-note-zoom">
                  <button
                    type="button"
                    aria-label="축소"
                    title="피아노롤 축소"
                    onClick={() => changePianoZoom(-1)}
                    disabled={pianoZoom <= 0.5}
                  >−</button>
                  <button
                    type="button"
                    aria-label="확대"
                    title="피아노롤 확대"
                    onClick={() => changePianoZoom(1)}
                    disabled={pianoZoom >= 1.75}
                  >+</button>
                  <select
                    className="composer-grid-value"
                    value={activePianoGridSteps}
                    onChange={(event) =>
                      handlePianoGridChange(Number(event.target.value) as MelodyNoteLengthSteps)
                    }
                    aria-label="노트 그리드 간격"
                    title="새 노트 길이"
                  >
                    {melodyNoteLengthOptions.map((option) => (
                      <option key={option.steps} value={option.steps}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
          </div>

      <main
        ref={mainViewportRef}
        className={`composer-main composer-main--${activeTab}`}
      >
        {activeExtraTrack ? (
          activeExtraTrack.instrument === 'drums' ? (
            renderExtraDrumSequencer(activeExtraTrack)
          ) : (
            renderMelodyLikeSequencer(
              activeExtraTrack.instrument as PitchedTab,
              getExtraTrackNotes(activeExtraTrack.instrument),
              activeExtraTrack.grid,
              getExtraTrackColors(activeExtraTrack.instrument),
              (row, col, lengthSteps) =>
                handleExtraTrackCellToggle(activeExtraTrack, row, col, lengthSteps),
              (chord, col) => handleExtraTrackChordDrop(activeExtraTrack, chord, col),
              {
                scrollKey: activeExtraTrack.id,
                melodyLengths: activeExtraTrack.melodyLengths,
                noteLengthSteps: extraTrackNoteLengths[activeExtraTrack.id] ?? 4,
                onNoteLengthChange: (lengthSteps) =>
                  setExtraTrackNoteLengths((current) => ({
                    ...current,
                    [activeExtraTrack.id]: lengthSteps,
                  })),
                showNoteLengthControls: true,
                showChordControls: true,
                chordChipClassName: '',
              }
            )
          )
        ) : (
          <>
        {!activeExtraTrack && !isActivePrimaryTabOpen ? (
          <section className="composer-empty-tab-panel">
            <strong>열린 악기가 없습니다</strong>
            <span>위의 + 버튼을 눌러 멜로디, 작사, 악기를 추가하세요.</span>
          </section>
        ) : null}

        {activeTab === 'melody' && isActivePrimaryTabOpen && (
          <>
            <section
              ref={melodyRollRef}
              className={`composer-roll-shell composer-roll-shell--melody is-tool-${pianoEditTool}${getGuideHighlightClass(
                'melody-roll'
              )}`}
            >
              <PianoRoll
                editTool={pianoEditTool}
                stepWidth={Math.round(64 * pianoZoom)}
                noteLengthSteps={primaryTrackNoteLengths.melody}
                onNoteLengthChange={(stepsValue) =>
                  setPrimaryTrackNoteLengths((current) => ({
                    ...current,
                    melody: stepsValue,
                  }))
                }
                onRequestZoom={changePianoZoom}
                loopRange={loopRange}
                onStepHeaderSelect={handleStepLoopSelect}
                collabBarLocks={currentTabLockMap}
                canEditCollab={!collabId || canSyncCollab}
                requestCollabBarLock={requestComposerBarLock}
                releaseCollabBarLock={releaseComposerBarLock}
                onCommitMelodyOperation={handleMelodyOperationCommit}
                onCommitChordOperation={handleChordOperationCommit}
                tutorialGhostNotes={melodyTutorialGhostNotes}
                onHelpZoneEnter={handleHelpZoneEnter}
                onHelpZoneMove={handleHelpZoneMove}
                onHelpZoneLeave={handleHelpZoneLeave}
              />
            </section>
          </>
        )}

        {activeTab === 'lyrics' && isActivePrimaryTabOpen && (
          <section className="composer-lyrics-tab-panel">
            <div className="composer-lyrics-tab-head">
              <span>LYRICS</span>
              <strong>작사</strong>
              <p>멜로디에 찍힌 음 순서대로 가사를 붙일 수 있습니다.</p>
            </div>

            <div className="composer-lyrics-view-tabs">
              {[
                ['notes', '음별 입력'],
                ['full', '전체 가사'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  className={lyricsViewMode === mode ? 'is-active' : ''}
                  onClick={() => setLyricsViewMode(mode as LyricsViewMode)}
                >
                  {label}
                </button>
              ))}
            </div>

            {melodyLyricNotes.length && lyricsViewMode === 'notes' ? (
              <div className="composer-lyrics-note-list">
                {melodyLyricNotes.map((item, index) => (
                  <label key={`${item.row}-${item.col}`} className="composer-lyrics-note-row">
                    <span className="composer-lyrics-note-index">{index + 1}</span>
                    <span className="composer-lyrics-note-meta">
                      {item.note} · {item.col + 1} step · {item.length}칸
                    </span>
                    <input
                      style={{ ['--lyrics-note-span' as string]: `${Math.max(1, item.length)}` }}
                      value={item.lyric}
                      onChange={(event) => setMelodyLyric(item.row, item.col, event.target.value)}
                      placeholder="가사"
                      maxLength={18}
                    />
                  </label>
                ))}
              </div>
            ) : null}

            {melodyLyricNotes.length && lyricsViewMode === 'full' ? (
              <div className="composer-lyrics-full-view">
                {melodyLyricNotes
                  .map((item) => item.lyric)
                  .filter(Boolean)
                  .join(' ') || '아직 입력된 가사가 없습니다.'}
              </div>
            ) : null}

            {!melodyLyricNotes.length ? (
              <div className="composer-lyrics-empty">
                멜로디 탭에서 음을 먼저 찍으면 여기에서 가사를 입력할 수 있습니다.
              </div>
            ) : (
              null
            )}
          </section>
        )}

        {activeTab === 'violin' && isActivePrimaryTabOpen &&
          renderMelodyLikeSequencer(
            'violin',
            VIOLIN_NOTES,
            violin,
            violinLaneColors,
            handleViolinCellToggle,
            (chord, col) => handlePrimaryPitchedChordDrop('violin', chord, col),
            {
              melodyLengths: violinLengths,
              noteLengthSteps: primaryTrackNoteLengths.violin,
              onNoteLengthChange: (lengthSteps) =>
                setPrimaryTrackNoteLengths((current) => ({ ...current, violin: lengthSteps })),
              showNoteLengthControls: true,
              showChordControls: true,
            }
          )}

        {activeTab === 'saxophone' && isActivePrimaryTabOpen &&
          renderMelodyLikeSequencer(
            'saxophone',
            SAXOPHONE_NOTES,
            saxophone,
            saxophoneLaneColors,
            handleSaxophoneCellToggle,
            (chord, col) => handlePrimaryPitchedChordDrop('saxophone', chord, col),
            {
              melodyLengths: saxophoneLengths,
              noteLengthSteps: primaryTrackNoteLengths.saxophone,
              onNoteLengthChange: (lengthSteps) =>
                setPrimaryTrackNoteLengths((current) => ({ ...current, saxophone: lengthSteps })),
              showNoteLengthControls: true,
              showChordControls: true,
            }
          )}

        {activeTab === 'guitar' && isActivePrimaryTabOpen &&
          renderMelodyLikeSequencer(
            'guitar',
            GUITAR_TRACK_LABELS,
            guitar,
            guitarLaneColors,
            handleGuitarCellToggle,
            (chord, col) => handlePrimaryPitchedChordDrop('guitar', chord, col),
            {
              melodyLengths: guitarLengths,
              noteLengthSteps: primaryTrackNoteLengths.guitar,
              onNoteLengthChange: (lengthSteps) =>
                setPrimaryTrackNoteLengths((current) => ({ ...current, guitar: lengthSteps })),
              showNoteLengthControls: true,
              showChordControls: true,
              chordChipClassName: '',
            }
          )}

        {activeTab === 'bass' && isActivePrimaryTabOpen && (
          <>
            <section ref={bassShellRef} className={getGuideHighlightClass('bass-grid')}>
              {renderMelodyLikeSequencer(
                'bass',
                BASS_NOTES,
                bass,
                bassLaneColors,
                handleBassCellToggle,
                handleBassChordDrop,
                {
                  melodyLengths: bassLengths,
                  noteLengthSteps: primaryTrackNoteLengths.bass,
                  onNoteLengthChange: (lengthSteps) =>
                    setPrimaryTrackNoteLengths((current) => ({ ...current, bass: lengthSteps })),
                  showNoteLengthControls: false,
                }
              )}
            </section>
          </>
        )}

        {activeTab === 'drums' && isActivePrimaryTabOpen && (
          <section
            ref={drumShellRef}
            className={`composer-drum-shell${getGuideHighlightClass('drums-grid')}`}
          >
            <div className="composer-drum-panel">
              <div className="composer-drums-wrap">
                <div className="composer-sequencer-body">
                  <div
                    className="composer-sequencer-playhead"
                    style={
                      isPlaying
                        ? undefined
                        : ({ '--sequencer-step-index': `${currentStep}` } as CSSProperties)
                    }
                    aria-hidden="true"
                  />
                  <div className="composer-sequencer-header">
                    <div className="composer-drum-step-spacer">Pattern</div>

                    <div
                      className="composer-step-grid"
                      style={{
                        gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                        ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                      }}
                      >
                        {Array.from({ length: steps }).map((_, col) => (
                        <button
                          key={`drum-header-${col}`}
                          type="button"
                          data-playhead-step={col}
                          className={`composer-drum-step-number${
                            col === currentStep ? ' is-current' : ''
                          }${getSubdivisionClassName(col)}${
                            loopRange && col >= loopRange.start && col <= loopRange.end
                              ? ' is-loop-active'
                              : ''
                          }${loopRange?.end === col ? ' is-loop-end' : ''}`}
                          onClick={() => handleStepLoopSelect(col)}
                          aria-label={`${col + 1}번 위치까지 반복`}
                          title={`${col + 1}번 위치까지 반복`}
                        >
                          <span className="sr-only">{col + 1}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="composer-sequencer-rows">
                    {drumTracks.slice(0, DRUM_ROWS).map((track, row) => (
                      <div key={track.name} className="composer-drum-row">
                        <div className={`composer-drum-track is-${track.tone}`}>
                          <strong>{track.name}</strong>
                          <span>{track.hint}</span>
                        </div>

                        <div
                          className="composer-drum-row-grid"
                          style={{
                            gridTemplateColumns: `repeat(${steps}, ${DRUM_STEP_WIDTH}px)`,
                            ['--sequencer-step-span' as string]: `calc(${DRUM_STEP_WIDTH}px + 10px)`,
                          }}
                        >
                          {Array.from({ length: steps }).map((_, col) => {
                            const active = drums[row]?.[col];
                            const isCurrent = col === currentStep;

                            return (
                              <button
                                key={`${track.name}-${col}`}
                                type="button"
                                data-playhead-step={col}
                                className={`composer-drum-cell is-${track.tone}${
                                  active ? ' is-active' : ''
                                }${isCurrent ? ' is-current' : ''}${getSubdivisionClassName(
                                  col
                                )}${getDrumTutorialCellClass(row, col)}${
                                  currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)]?.mine
                                    ? ' is-own-locked'
                                    : currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)]
                                      ? ' is-locked'
                                      : ''
                                }`}
                                onClick={() => {
                                  void handleDrumCellToggle(row, col);
                                }}
                                disabled={
                                  Boolean(
                                    currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)] &&
                                      !currentTabLockMap[Math.floor(col / COLLAB_BAR_LENGTH)].mine
                                  ) || Boolean(collabId && !canSyncCollab)
                                }
                              >
                                {getDrumTutorialCellGuideLabel(row, col) ? (
                                  <span className="composer-cell-guide-pill">
                                    {getDrumTutorialCellGuideLabel(row, col)}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
          </>
        )}
      </main>
        </section>
      </div>

      {activeHelpPanel ? (
        <div
          className={`composer-help-overlay is-${activeHelpZone}`}
          aria-live="polite"
          style={
            {
              '--composer-help-left': `${helpOverlayPosition.x}px`,
              '--composer-help-top': `${helpOverlayPosition.y}px`,
            } as CSSProperties
          }
        >
          <div className="composer-help-overlay-card">
            <div className="composer-help-overlay-copy">
              <span>HELP</span>
              <strong>{activeHelpPanel.title}</strong>
              <p>{activeHelpPanel.description}</p>
            </div>
            <img
              className="composer-help-gif"
              src={activeHelpPanel.gif}
              alt={`${activeHelpPanel.title} 도움말 GIF`}
            />
          </div>
        </div>
      ) : null}

      <footer
        ref={footerRef}
        className={`composer-footer${getGuideHighlightClass('transport')}`}
      >
        <TransportBar onPlayStarted={() => setPlayedTutorialOnce(true)} />
      </footer>
    </div>
  );
}


