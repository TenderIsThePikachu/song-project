import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playBassPreview, playMelodyPreview } from '../audio/engine.ts';
import {
  BASS_CHORD_MAP,
  BASS_NOTES,
  MELODY_CHORD_MAP,
  MELODY_PIANO_ROW_HEIGHT,
  MELODY_NOTES,
  PIANO_ROW_HEIGHT,
  PIANO_STEP_WIDTH,
} from '../constants/composer.ts';
import { useSongStore } from '../store/songStore.ts';
import { useUIStore } from '../store/uiStore.ts';
import {
  getBarInfoAtStep,
  getBeatSteps,
  formatTimeSignature,
  getPrimaryBeatSteps,
  getStepsPerBar,
  getTimeSignatureAtStep,
  type TimeSignature,
  type TimeSignatureChange,
} from '../utils/timeSignature.ts';
import './PianoRoll.css';

const MELODY_ACCENTS = [
  '#7dff12',
  '#6ff40e',
  '#68e6d7',
  '#7dff12',
  '#6be0cf',
  '#7dff12',
  '#68e6d7',
  '#6ff40e',
];

const GUITAR_ACCENTS = [
  '#f59e0b',
  '#fb923c',
  '#f6ad55',
  '#f59e0b',
  '#fbbf24',
  '#fb923c',
  '#f59e0b',
  '#fcd34d',
];

const GUITAR_DISPLAY_NOTES = [
  'E5',
  'D#5',
  'D5',
  'C#5',
  'C5',
  'B4',
  'A#4',
  'A4',
  'G#4',
  'G4',
  'F#4',
  'F4',
  'E4',
  'D#4',
  'D4',
  'C#4',
  'C4',
  'B3',
  'A#3',
  'A3',
  'G#3',
  'G3',
  'F#3',
  'F3',
  'E3',
  'D#3',
  'D3',
  'C#3',
] as const;

const BASS_ACCENTS = ['#f6d28a', '#e7b869', '#d49a58', '#b37b43'];
const PIANO_GRID_GAP = 8;
const PIANO_HEADER_HEIGHT = 36;
const PIANO_HEADER_MARGIN = 8;
const PIANO_BODY_TOP_PADDING = 8;
const MELODY_CONTROL_BAR_HEIGHT = 28;
const SHOW_LEGACY_EDITOR_ASSIST_CONTROLS = false;
const EMPTY_COLLAB_NOTE_COLORS: Record<string, string> = {};

const BASE_MELODY_NOTE_LENGTH_OPTIONS = [
  { label: '1/16', steps: 1 },
  { label: '1/8', steps: 2 },
  { label: '1/4', steps: 4 },
  { label: '1/2', steps: 8 },
] as const;

const MELODY_CHORD_OPTIONS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;

type MelodyNoteLengthSteps = number;
type PianoEditTool = 'select' | 'pencil' | 'eraser' | 'marquee' | 'zoom';
type PianoRollInstrument =
  | 'melody'
  | 'violin'
  | 'saxophone'
  | 'guitar'
  | 'bass'
  | 'glockenspiel'
  | 'piccolo'
  | 'supportingPiano'
  | 'chicagoStreet'
  | 'studioAltoSax';

type CollabBarLockState = {
  mine: boolean;
  name: string;
  color?: string;
};

type PianoRollProps = {
  instrument?: PianoRollInstrument;
  grid?: boolean[][];
  noteLengths?: number[][];
  noteLabels?: readonly string[];
  accentColors?: readonly string[];
  scrollKey?: string;
  onToggleNote?: (
    row: number,
    col: number,
    length: number
  ) => void | Promise<void>;
  onResizeNote?: (row: number, col: number, length: number) => void | Promise<void>;
  onDropChord?: (chord: string, col: number) => void | Promise<void>;
  getCollabNoteKey?: (row: number, col: number) => string;
  editTool?: PianoEditTool;
  stepWidth?: number;
  sidebarWidth?: number | string;
  noteLengthSteps?: MelodyNoteLengthSteps;
  onNoteLengthChange?: (steps: MelodyNoteLengthSteps) => void;
  onRequestZoom?: (direction: -1 | 1) => void;
  loopRange?: { start: number; end: number } | null;
  onStepHeaderSelect?: (col: number) => void;
  collabBarLocks?: Record<number, CollabBarLockState>;
  collabNoteColors?: Record<string, string>;
  collabNoteAuthors?: Record<string, string>;
  canEditCollab?: boolean;
  requestCollabBarLock?: (instrument: 'melody' | 'bass', barIndex: number) => Promise<boolean>;
  releaseCollabBarLock?: (instrument: 'melody' | 'bass', barIndex: number) => void;
  onCommitMelodyOperation?: (payload: {
    row: number;
    col: number;
    length: number;
    barIndex: number;
  }) => void;
  onCommitChordOperation?: (payload: {
    chord: string;
    col: number;
    isBass: boolean;
    rows: number[];
    barIndex: number;
  }) => void;
  tutorialGhostNotes?: Array<{
    row: number;
    col: number;
    length: number;
    completed?: boolean;
    highlight?: boolean;
    label?: string;
  }>;
  onHelpZoneEnter?: (
    zone: 'length' | 'chords',
    event: ReactMouseEvent<HTMLElement>
  ) => void;
  onHelpZoneMove?: (
    zone: 'length' | 'chords',
    event: ReactMouseEvent<HTMLElement>
  ) => void;
  onHelpZoneLeave?: (zone: 'length' | 'chords') => void;
};

function getSubdivisionClassName(
  col: number,
  timeSignatureChanges: readonly TimeSignatureChange[],
  timeSignature: TimeSignature
) {
  const bar = getBarInfoAtStep(timeSignatureChanges, timeSignature, col);
  const stepsPerBar = bar.length;
  const beatSteps = getBeatSteps(bar.timeSignature);
  const primaryBeatSteps = getPrimaryBeatSteps(bar.timeSignature);
  const offset = col - bar.start;
  const hasMidBarGroup = stepsPerBar >= primaryBeatSteps * 4;
  return `${offset % beatSteps === 0 ? ' is-eighth' : ''}${offset % primaryBeatSteps === 0 ? ' is-quarter' : ''}${
    hasMidBarGroup && offset % (primaryBeatSteps * 2) === 0 ? ' is-half' : ''
  }${offset === 0 ? ' is-bar' : ''}`;
}

function getAccentColor(index: number, isBass: boolean, isGuitar: boolean) {
  const palette = isBass ? BASS_ACCENTS : isGuitar ? GUITAR_ACCENTS : MELODY_ACCENTS;
  return palette[index % palette.length];
}

function isSharpNote(note: unknown) {
  return typeof note === 'string' && note.includes('#');
}

function findMelodyNoteInfo(melodyRow: boolean[], melodyLengthRow: number[], col: number) {
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

export const PianoRoll = ({
  instrument,
  grid,
  noteLengths,
  noteLabels,
  accentColors,
  scrollKey,
  onToggleNote,
  onResizeNote,
  onDropChord,
  getCollabNoteKey,
  editTool = 'pencil',
  stepWidth: requestedStepWidth,
  sidebarWidth,
  noteLengthSteps: controlledNoteLengthSteps,
  onNoteLengthChange,
  onRequestZoom,
  loopRange = null,
  onStepHeaderSelect,
  collabBarLocks = {},
  collabNoteColors = EMPTY_COLLAB_NOTE_COLORS,
  collabNoteAuthors = EMPTY_COLLAB_NOTE_COLORS,
  canEditCollab = true,
  requestCollabBarLock,
  releaseCollabBarLock,
  onCommitMelodyOperation,
  onCommitChordOperation,
  tutorialGhostNotes = [],
  onHelpZoneEnter,
  onHelpZoneMove,
  onHelpZoneLeave,
}: PianoRollProps) => {
  const { activeTab } = useUIStore();
  const resolvedInstrument = instrument ?? (activeTab === 'bass' ? 'bass' : activeTab === 'guitar' ? 'guitar' : 'melody');
  const isExternalGrid = Boolean(grid);
  const isBass = resolvedInstrument === 'bass' && !isExternalGrid;
  const isGuitar = resolvedInstrument === 'guitar';
  const melody = useSongStore((state) => state.melody);
  const melodyLengths = useSongStore((state) => state.melodyLengths);
  const bass = useSongStore((state) => state.bass);
  const bassLengths = useSongStore((state) => state.bassLengths);
  const isPlaying = useSongStore((state) => state.isPlaying);
  const steps = useSongStore((state) => state.steps);
  const timeSignature = useSongStore((state) => state.timeSignature);
  const timeSignatureChanges = useSongStore((state) => state.timeSignatureChanges);
  const activeTimeSignatureKey = useSongStore((state) => {
    const meter = getTimeSignatureAtStep(
      state.timeSignatureChanges,
      state.timeSignature,
      state.currentStep
    );
    return `${meter.beats}/${meter.beatType}`;
  });
  const toggleMelody = useSongStore((state) => state.toggleMelody);
  const toggleBass = useSongStore((state) => state.toggleBass);
  const applyChord = useSongStore((state) => state.applyChord);
  const [activeBeats, activeBeatType] = activeTimeSignatureKey.split('/').map(Number);
  const activeTimeSignature = {
    beats: activeBeats,
    beatType: activeBeatType,
  } as TimeSignature;
  const stepsPerBar = getStepsPerBar(activeTimeSignature);
  const beatSteps = getBeatSteps(activeTimeSignature);
  const primaryBeatSteps = getPrimaryBeatSteps(activeTimeSignature);
  const groupSteps = stepsPerBar >= primaryBeatSteps * 4 ? primaryBeatSteps * 2 : stepsPerBar;
  const melodyNoteLengthOptions = useMemo(
    () => [
      ...BASE_MELODY_NOTE_LENGTH_OPTIONS.filter((option) => option.steps !== stepsPerBar),
      { label: '1 Bar', steps: stepsPerBar },
    ],
    [stepsPerBar]
  );

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawValue, setDrawValue] = useState<boolean | null>(null);
  const [dragMelodyOrigin, setDragMelodyOrigin] = useState<{ row: number; col: number } | null>(
    null
  );
  const [dragMelodyPreviewLength, setDragMelodyPreviewLength] = useState<number | null>(null);
  const [internalNoteLengthSteps, setInternalNoteLengthSteps] =
    useState<MelodyNoteLengthSteps>(4);
  const melodyNoteLengthSteps = controlledNoteLengthSteps ?? internalNoteLengthSteps;
  const setMelodyNoteLengthSteps = (stepsValue: MelodyNoteLengthSteps) => {
    setInternalNoteLengthSteps(stepsValue);
    onNoteLengthChange?.(stepsValue);
  };
  const [selectedRange, setSelectedRange] = useState<{
    startRow: number;
    endRow: number;
    startCol: number;
    endCol: number;
  } | null>(null);
  const [marqueeOrigin, setMarqueeOrigin] = useState<{ row: number; col: number } | null>(null);
  const [melodyViewport, setMelodyViewport] = useState({
    scrollLeft: 0,
    scrollTop: 0,
    width: 1600,
    height: 720,
  });
  const melodyViewportRef = useRef(melodyViewport);

  const pendingMelodyCommitRef = useRef<{ row: number; col: number; barIndex: number } | null>(
    null
  );
  const activeLockRef = useRef<{ instrument: 'melody' | 'bass'; barIndex: number } | null>(null);
  const melodyScrollerRef = useRef<HTMLDivElement | null>(null);
  const melodyHeaderRef = useRef<HTMLDivElement | null>(null);
  const initialStepRef = useRef(useSongStore.getState().currentStep);
  const scrollSyncFrameRef = useRef<number | null>(null);
  const pendingScrollLeftRef = useRef(0);
  const lastDrawCellRef = useRef<string | null>(null);
  const lastMelodyDragLengthRef = useRef<number | null>(null);
  const hasMelodyDragMovedRef = useRef(false);

  useEffect(() => {
    if (editTool === 'select' || editTool === 'marquee') {
      return;
    }

    setSelectedRange(null);
    setMarqueeOrigin(null);
  }, [editTool]);

  useEffect(() => {
    if (melodyScrollerRef.current) {
      const scroller = melodyScrollerRef.current;
      const nextViewport = {
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
        width: scroller.clientWidth,
        height: scroller.clientHeight,
      };
      melodyViewportRef.current = nextViewport;
      setMelodyViewport(nextViewport);
    }

    const handleGoToFirstBar = () => {
      if (melodyScrollerRef.current) {
        melodyScrollerRef.current.scrollLeft = 0;
      }

      if (melodyHeaderRef.current) {
        melodyHeaderRef.current.style.transform = 'translateX(0px)';
      }
      const nextViewport = { ...melodyViewportRef.current, scrollLeft: 0 };
      melodyViewportRef.current = nextViewport;
      setMelodyViewport(nextViewport);
    };

    window.addEventListener('composer-go-to-first-bar', handleGoToFirstBar);
    return () => {
      window.removeEventListener('composer-go-to-first-bar', handleGoToFirstBar);
      if (scrollSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollSyncFrameRef.current);
        scrollSyncFrameRef.current = null;
      }
    };
  }, []);

  const syncMelodyScrollLeft = (scroller: HTMLDivElement) => {
    pendingScrollLeftRef.current = scroller.scrollLeft;

    const isPlaybackScrolling = useSongStore.getState().isPlaying;
    if (isPlaybackScrolling) {
      const current = melodyViewportRef.current;
      const nextScrollLeft = scroller.scrollLeft;
      const horizontalChanged = Math.abs(nextScrollLeft - current.scrollLeft) >= colSpan * 4;
      const verticalChanged = Math.abs(scroller.scrollTop - current.scrollTop) >= rowSpan * 3;
      const sizeChanged =
        scroller.clientWidth !== current.width || scroller.clientHeight !== current.height;

      if (horizontalChanged || verticalChanged || sizeChanged) {
        const nextViewport = {
          scrollLeft: nextScrollLeft,
          scrollTop: scroller.scrollTop,
          width: scroller.clientWidth,
          height: scroller.clientHeight,
        };
        melodyViewportRef.current = nextViewport;
        setMelodyViewport(nextViewport);
      }
      return;
    }

    if (scrollSyncFrameRef.current !== null) {
      return;
    }

    scrollSyncFrameRef.current = window.requestAnimationFrame(() => {
      scrollSyncFrameRef.current = null;
      const nextScrollLeft = pendingScrollLeftRef.current;
      if (melodyHeaderRef.current) {
        melodyHeaderRef.current.style.transform = `translateX(-${nextScrollLeft}px)`;
      }

      const current = melodyViewportRef.current;
      const horizontalChanged = Math.abs(nextScrollLeft - current.scrollLeft) >= colSpan * 2;
      const verticalChanged = Math.abs(scroller.scrollTop - current.scrollTop) >= rowSpan * 2;
      const sizeChanged =
        scroller.clientWidth !== current.width || scroller.clientHeight !== current.height;

      if (!horizontalChanged && !verticalChanged && !sizeChanged) {
        return;
      }

      const nextViewport = {
        scrollLeft: nextScrollLeft,
        scrollTop: scroller.scrollTop,
        width: scroller.clientWidth,
        height: scroller.clientHeight,
      };
      melodyViewportRef.current = nextViewport;
      setMelodyViewport(nextViewport);
    });
  };

  const tutorialGhostNoteMap = useMemo(
    () =>
      tutorialGhostNotes.reduce<
        Record<
          string,
          {
            row: number;
            col: number;
            length: number;
            completed?: boolean;
            highlight?: boolean;
            label?: string;
          }
        >
      >((map, note) => {
        map[`${note.row}-${note.col}`] = note;
        return map;
      }, {}),
    [tutorialGhostNotes]
  );

  const currentGrid = grid ?? (isBass ? bass : melody);
  const currentLengths = noteLengths ?? (isBass ? bassLengths : melodyLengths);
  const currentLabels = noteLabels ?? (
    isBass ? BASS_NOTES : isGuitar ? GUITAR_DISPLAY_NOTES : MELODY_NOTES
  );
  const modeClass = isBass ? 'bass' : 'melody';
  const getRowAccent = useCallback(
    (row: number) =>
      accentColors?.[row % accentColors.length] ?? getAccentColor(row, isBass, isGuitar),
    [accentColors, isBass, isGuitar]
  );
  const rowCount = currentGrid.length;
  const gridGap = isBass ? PIANO_GRID_GAP : 2;
  const rowHeight = isBass ? PIANO_ROW_HEIGHT : MELODY_PIANO_ROW_HEIGHT;
  const stepWidth = requestedStepWidth ?? (isBass ? PIANO_STEP_WIDTH : 64);
  const headerHeight = isBass ? PIANO_HEADER_HEIGHT : 24;
  const headerMargin = isBass ? PIANO_HEADER_MARGIN : 8;
  const bodyTopPadding = isBass ? PIANO_BODY_TOP_PADDING : 8;
  const controlBarHeight = isBass || !SHOW_LEGACY_EDITOR_ASSIST_CONTROLS ? 0 : MELODY_CONTROL_BAR_HEIGHT;
  const sidebarTopOffset = bodyTopPadding + controlBarHeight + headerHeight + headerMargin;
  const rowSpan = rowHeight + gridGap;
  const colSpan = stepWidth + gridGap;
  const virtualRowPadding = isPlaying ? 5 : 3;
  const virtualColPadding = isPlaying ? 10 : 4;
  const visibleRowStart = isBass
    ? 0
    : Math.max(0, Math.floor(melodyViewport.scrollTop / rowSpan) - virtualRowPadding);
  const visibleRowEnd = isBass
    ? rowCount - 1
    : Math.min(
        rowCount - 1,
        Math.ceil((melodyViewport.scrollTop + melodyViewport.height) / rowSpan) +
          virtualRowPadding
      );
  const visibleColStart = Math.max(
    0,
    Math.floor(melodyViewport.scrollLeft / colSpan) - virtualColPadding
  );
  const visibleColEnd = Math.min(
    steps - 1,
    Math.ceil((melodyViewport.scrollLeft + melodyViewport.width) / colSpan) +
      virtualColPadding
  );

  const columnMeta = useMemo(
    () =>
      Array.from({ length: steps }, (_, col) => {
        const barInfo = getBarInfoAtStep(timeSignatureChanges, timeSignature, col);
        return {
          barInfo,
          meterChange: timeSignatureChanges.find((change) => change.bar === barInfo.index),
          subdivisionClassName: getSubdivisionClassName(
            col,
            timeSignatureChanges,
            timeSignature
          ),
        };
      }),
    [steps, timeSignature, timeSignatureChanges]
  );

  const melodyNoteInfoMap = useMemo(() => {
    if (isBass) {
      return [] as Array<Array<{ start: number; length: number } | null>>;
    }

    return currentGrid.map((row, rowIndex) => {
      const lengthRow = currentLengths[rowIndex] ?? [];
      const infoRow = Array.from({ length: steps }, () => null as { start: number; length: number } | null);

      row.forEach((active, start) => {
        if (!active) {
          return;
        }

        const length = Math.max(1, lengthRow[start] ?? 1);
        const end = Math.min(steps, start + length);

        for (let col = start; col < end; col += 1) {
          infoRow[col] = { start, length };
        }
      });

      return infoRow;
    });
  }, [currentGrid, currentLengths, isBass, steps]);

  const releaseActiveLock = useCallback(() => {
    if (!activeLockRef.current) {
      return;
    }

    releaseCollabBarLock?.(activeLockRef.current.instrument, activeLockRef.current.barIndex);
    activeLockRef.current = null;
  }, [releaseCollabBarLock]);

  const finalizeMelodyDraw = () => {
    if (!pendingMelodyCommitRef.current) {
      setIsDrawing(false);
      setDrawValue(null);
      setDragMelodyOrigin(null);
      setDragMelodyPreviewLength(null);
      lastDrawCellRef.current = null;
      lastMelodyDragLengthRef.current = null;
      hasMelodyDragMovedRef.current = false;
      releaseActiveLock();
      return;
    }

    const { row, col, barIndex } = pendingMelodyCommitRef.current;
    if (dragMelodyPreviewLength !== null) {
      const currentLength = isExternalGrid
        ? currentLengths[row]?.[col] ?? 1
        : useSongStore.getState().melodyLengths[row]?.[col] ?? 1;
      if (currentLength !== dragMelodyPreviewLength) {
        if (isExternalGrid && onResizeNote) {
          void onResizeNote(row, col, dragMelodyPreviewLength);
        } else {
          toggleMelody(row, col, dragMelodyPreviewLength, false);
        }
      }
    }

    const liveMelody = isExternalGrid ? currentGrid : useSongStore.getState().melody;
    const liveMelodyLengths = isExternalGrid
      ? currentLengths
      : useSongStore.getState().melodyLengths;
    const noteInfo = findMelodyNoteInfo(liveMelody[row] ?? [], liveMelodyLengths[row] ?? [], col);

    onCommitMelodyOperation?.({
      row,
      col,
      length: noteInfo?.start === col ? noteInfo.length : 0,
      barIndex,
    });

    pendingMelodyCommitRef.current = null;
    setIsDrawing(false);
    setDrawValue(null);
    setDragMelodyOrigin(null);
    setDragMelodyPreviewLength(null);
    lastDrawCellRef.current = null;
    lastMelodyDragLengthRef.current = null;
    hasMelodyDragMovedRef.current = false;
    releaseActiveLock();
  };

  const handleCellChange = useCallback((row: number, col: number, nextValue: boolean) => {
    if (isExternalGrid && onToggleNote) {
      const noteInfo = findMelodyNoteInfo(
        currentGrid[row] ?? [],
        currentLengths[row] ?? [],
        col
      );
      const sourceCol = noteInfo?.start ?? col;
      const isCurrentlyActive = Boolean(noteInfo || currentGrid[row]?.[sourceCol]);
      if (isCurrentlyActive === nextValue) return;
      void onToggleNote(
        row,
        sourceCol,
        nextValue ? melodyNoteLengthSteps : noteInfo?.length ?? 1
      );
      return;
    }

    if (isBass) {
      const liveGrid = useSongStore.getState().bass;
      if (liveGrid[row]?.[col] === nextValue) {
        return;
      }

      toggleBass(row, col);
      if (nextValue) {
        void playBassPreview(row);
      }
      return;
    }

    const liveMelody = useSongStore.getState().melody;
    const liveMelodyLengths = useSongStore.getState().melodyLengths;
    const noteInfo = findMelodyNoteInfo(liveMelody[row] ?? [], liveMelodyLengths[row] ?? [], col);
    const sourceCol = noteInfo?.start ?? col;

    if (!nextValue && !noteInfo && !liveMelody[row]?.[sourceCol]) {
      return;
    }

    toggleMelody(row, sourceCol, nextValue ? melodyNoteLengthSteps : 1);

    if (nextValue) {
      void playMelodyPreview(row, melodyNoteLengthSteps);
    }
  }, [
    currentGrid,
    currentLengths,
    isBass,
    isExternalGrid,
    melodyNoteLengthSteps,
    onToggleNote,
    toggleBass,
    toggleMelody,
  ]);

  const pianoRollStyle = {
    '--piano-grid-gap': `${gridGap}px`,
    '--piano-header-height': `${headerHeight}px`,
    '--piano-header-margin': `${headerMargin}px`,
    '--piano-body-top-padding': `${bodyTopPadding}px`,
    '--piano-control-bar-height': `${controlBarHeight}px`,
    '--piano-step-width': `${stepWidth}px`,
    '--piano-step-span': `calc(${stepWidth}px + ${gridGap}px)`,
    '--piano-unit-span': `${colSpan * beatSteps}px`,
    '--piano-beat-span': `${colSpan * primaryBeatSteps}px`,
    '--piano-group-span': `${colSpan * groupSteps}px`,
    '--piano-bar-span': `${colSpan * stepsPerBar}px`,
    '--piano-row-height': `${rowHeight}px`,
    '--piano-row-span': `calc(${rowHeight}px + ${gridGap}px)`,
    '--piano-row-count': `${rowCount}`,
    '--piano-sidebar-offset': `${sidebarTopOffset}px`,
    '--piano-sidebar-width':
      typeof sidebarWidth === 'number'
        ? `${sidebarWidth}px`
        : sidebarWidth ?? `${isBass ? 102 : 68}px`,
  } as CSSProperties;

  const sidebarNotes = useMemo(
    () =>
      currentLabels.map((note, row) => {
        const noteStyle = {
          '--key-accent': getRowAccent(row),
        } as CSSProperties;

        return (
          <div
            key={`label-${modeClass}-${note}`}
            className={`piano-roll-key is-${modeClass}${
              !isBass && isSharpNote(note) ? ' is-sharp' : ' is-natural'
            }`}
            style={noteStyle}
          >
            {note}
          </div>
        );
      }),
    [currentLabels, getRowAccent, isBass, modeClass]
  );

  const stepHeaderButtons = useMemo(() => Array.from({ length: steps }, (_, col) => {
    const { barInfo, meterChange, subdivisionClassName } = columnMeta[col];
    const barLock = collabBarLocks[barInfo.index];
    const isLocked = Boolean(barLock && !barLock.mine);

    return (
      <button
        key={`step-${col}`}
        type="button"
        data-playhead-step={col}
        className={`piano-roll-step-number${subdivisionClassName}${isLocked ? ' is-locked' : ''}${
          loopRange && col >= loopRange.start && col <= loopRange.end ? ' is-loop-active' : ''
        }${loopRange?.end === col ? ' is-loop-end' : ''}`}
        style={{
          '--collab-member-color': barLock?.color,
        } as CSSProperties}
        onClick={() => onStepHeaderSelect?.(col)}
        aria-label={`${col + 1}번 위치까지 반복`}
        title={`${col + 1}번 위치까지 반복`}
      >
        {barInfo.offset === 0 ? (
          <span className="piano-roll-bar-number" aria-hidden="true">
            {barInfo.index + 1}
            {barInfo.index > 0 && meterChange ? (
              <small>{formatTimeSignature(meterChange)}</small>
            ) : null}
          </span>
        ) : null}
        <span className="sr-only">{col + 1}</span>
      </button>
    );
  }), [
    collabBarLocks,
    columnMeta,
    loopRange,
    onStepHeaderSelect,
    steps,
  ]);

  const gridCells = useMemo(() => {
    const rowsToRender = Array.from(
      { length: Math.max(0, visibleRowEnd - visibleRowStart + 1) },
      (_, index) => visibleRowStart + index
    );
    const colsToRender = Array.from(
      { length: Math.max(0, visibleColEnd - visibleColStart + 1) },
      (_, index) => visibleColStart + index
    );

    return rowsToRender.flatMap((row) =>
      colsToRender.map((col) => {
      const melodyNoteInfo = !isBass ? melodyNoteInfoMap[row]?.[col] ?? null : null;
      const isNoteStart = Boolean(melodyNoteInfo && melodyNoteInfo.start === col);
      const isNoteTail = Boolean(melodyNoteInfo && melodyNoteInfo.start !== col);
      const active = isBass ? bass[row]?.[col] : isNoteStart;
      const collabNoteKey = getCollabNoteKey?.(row, col) ?? `${resolvedInstrument}:${row}:${col}`;
      const collabNoteColor = active ? collabNoteColors[collabNoteKey] : undefined;
      const collabNoteAuthor = active ? collabNoteAuthors[collabNoteKey] : undefined;
      const isSelected = Boolean(
        selectedRange &&
          row >= Math.min(selectedRange.startRow, selectedRange.endRow) &&
          row <= Math.max(selectedRange.startRow, selectedRange.endRow) &&
          col >= Math.min(selectedRange.startCol, selectedRange.endCol) &&
          col <= Math.max(selectedRange.startCol, selectedRange.endCol)
      );
      const { barInfo, subdivisionClassName } = columnMeta[col];
      const barIndex = barInfo.index;
      const barLock = collabBarLocks[barIndex];
      const isLocked = Boolean(barLock && !barLock.mine);
      const tutorialGhostNote = !isBass ? tutorialGhostNoteMap[`${row}-${col}`] : null;
      const cellStyle = {
        '--cell-accent': getRowAccent(row),
        '--collab-member-color': barLock?.color,
        '--collab-note-color': collabNoteColor,
        ...(isBass
          ? {
              gridColumnStart: col + 1,
              gridRowStart: row + 1,
            }
          : {
              left: `${col * colSpan}px`,
              top: `${row * rowSpan}px`,
              width: `${stepWidth}px`,
              height: `${rowHeight}px`,
            }),
        ...(!isBass && melodyNoteInfo
          ? {
              '--note-span-steps': `${
                dragMelodyOrigin?.row === row &&
                dragMelodyOrigin.col === melodyNoteInfo.start &&
                dragMelodyPreviewLength !== null
                  ? dragMelodyPreviewLength
                  : melodyNoteInfo.length
              }`,
            }
          : {}),
      } as unknown as CSSProperties;

      return (
        <div
          key={`${modeClass}-${row}-${col}`}
          role="button"
          tabIndex={isLocked || !canEditCollab ? -1 : 0}
          data-playhead-step={col}
          className={`piano-roll-cell is-${modeClass}${active ? ' is-active' : ''}${subdivisionClassName}${
            !isBass && isSharpNote(currentLabels[row]) ? ' is-sharp' : ''
          }${!isBass && isNoteStart ? ' is-note-start' : ''}${
            !isBass && isNoteTail ? ' is-note-tail' : ''
          }${collabNoteColor ? ' is-collab-authored' : ''}${isLocked ? ' is-locked' : ''}${!canEditCollab ? ' is-readonly' : ''}${
            isSelected ? ' is-tool-selected' : ''
          }`}
          style={cellStyle}
          title={collabNoteAuthor ? `작성자: ${collabNoteAuthor}` : undefined}
          aria-label={collabNoteAuthor ? `${currentLabels[row]} 노트, 작성자 ${collabNoteAuthor}` : undefined}
          onMouseDown={async (event) => {
            if (editTool === 'zoom') {
              onRequestZoom?.(event.shiftKey ? -1 : 1);
              return;
            }

            if (editTool === 'select') {
              setSelectedRange({
                startRow: row,
                endRow: row,
                startCol: melodyNoteInfo?.start ?? col,
                endCol: melodyNoteInfo
                  ? melodyNoteInfo.start + melodyNoteInfo.length - 1
                  : col,
              });
              return;
            }

            if (editTool === 'marquee') {
              setMarqueeOrigin({ row, col });
              setSelectedRange({ startRow: row, endRow: row, startCol: col, endCol: col });
              return;
            }

            if (isLocked || !canEditCollab) {
              return;
            }

            if (isBass) {
              if (!(await requestCollabBarLock?.('bass', barIndex) ?? true)) {
                return;
              }

              activeLockRef.current = { instrument: 'bass', barIndex };
              const target = !(currentGrid[row]?.[col] ?? false);
              handleCellChange(row, col, target);
              releaseActiveLock();
              setIsDrawing(true);
              setDrawValue(target);
              lastDrawCellRef.current = `${row}-${col}`;
              return;
            }

            const liveMelody = isExternalGrid ? currentGrid : useSongStore.getState().melody;
            const liveMelodyLengths = isExternalGrid
              ? currentLengths
              : useSongStore.getState().melodyLengths;
            const existingNote = findMelodyNoteInfo(
              liveMelody[row] ?? [],
              liveMelodyLengths[row] ?? [],
              col
            );
            const originBarIndex = getBarInfoAtStep(
              timeSignatureChanges,
              timeSignature,
              existingNote?.start ?? col
            ).index;

            if (!(await requestCollabBarLock?.('melody', originBarIndex) ?? true)) {
              return;
            }

            activeLockRef.current = { instrument: 'melody', barIndex: originBarIndex };

            if (existingNote) {
              setSelectedRange(null);
              setMarqueeOrigin(null);
              if (isExternalGrid && onToggleNote) {
                await onToggleNote(row, existingNote.start, existingNote.length);
              } else {
                toggleMelody(row, existingNote.start, 0);
              }
              onCommitMelodyOperation?.({
                row,
                col: existingNote.start,
                length: 0,
                barIndex: originBarIndex,
              });
              pendingMelodyCommitRef.current = null;
              setIsDrawing(false);
              setDrawValue(null);
              setDragMelodyOrigin(null);
              setDragMelodyPreviewLength(null);
              lastDrawCellRef.current = null;
              lastMelodyDragLengthRef.current = null;
              hasMelodyDragMovedRef.current = false;
              releaseActiveLock();
              return;
            }

            if (isExternalGrid && onToggleNote) {
              await onToggleNote(row, col, melodyNoteLengthSteps);
            } else {
              toggleMelody(row, col, melodyNoteLengthSteps);
              void playMelodyPreview(row, melodyNoteLengthSteps);
            }
            setIsDrawing(true);
            setDrawValue(true);
            setDragMelodyOrigin({ row, col });
            setDragMelodyPreviewLength(melodyNoteLengthSteps);
            lastDrawCellRef.current = `${row}-${col}`;
            lastMelodyDragLengthRef.current = melodyNoteLengthSteps;
            hasMelodyDragMovedRef.current = false;
            pendingMelodyCommitRef.current = {
              row,
              col,
              barIndex: originBarIndex,
            };
          }}
          onMouseMove={() => {
            if (editTool === 'marquee' && marqueeOrigin) {
              setSelectedRange({
                startRow: marqueeOrigin.row,
                endRow: row,
                startCol: marqueeOrigin.col,
                endCol: col,
              });
              return;
            }

            if (!isDrawing || drawValue === null) {
              return;
            }

            if (!isBass && drawValue && dragMelodyOrigin) {
              if (dragMelodyOrigin.row !== row || col < dragMelodyOrigin.col) {
                return;
              }

              if (!hasMelodyDragMovedRef.current && col === dragMelodyOrigin.col) {
                return;
              }

              if (
                columnMeta[col].barInfo.index !==
                columnMeta[dragMelodyOrigin.col].barInfo.index
              ) {
                return;
              }

              hasMelodyDragMovedRef.current = true;
              const nextLength = col - dragMelodyOrigin.col + 1;
              if (lastMelodyDragLengthRef.current === nextLength) {
                return;
              }

              lastMelodyDragLengthRef.current = nextLength;
              setDragMelodyPreviewLength(nextLength);
              return;
            }

            if (isBass) {
              const drawCellKey = `${row}-${col}`;
              if (lastDrawCellRef.current === drawCellKey) {
                return;
              }

              lastDrawCellRef.current = drawCellKey;
              handleCellChange(row, col, drawValue);
            }
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={async (event) => {
            event.preventDefault();
            if (isLocked || !canEditCollab) {
              return;
            }

            const chord = event.dataTransfer.getData('text/plain');
            if (!chord) {
              return;
            }

            if (!(await requestCollabBarLock?.(isBass ? 'bass' : 'melody', barIndex) ?? true)) {
              return;
            }

            activeLockRef.current = {
              instrument: isBass ? 'bass' : 'melody',
              barIndex,
            };
            if (isExternalGrid && onDropChord) {
              await onDropChord(chord, col);
            } else {
              applyChord(chord, col, isBass, melodyNoteLengthSteps);
            }
            onCommitChordOperation?.({
              chord,
              col,
              isBass,
              rows: [...((isBass ? BASS_CHORD_MAP : MELODY_CHORD_MAP)[chord] ?? [])],
              barIndex,
            });
            releaseActiveLock();
          }}
        >
          {!isBass && isNoteStart ? (
            <span className="piano-roll-note-block" aria-hidden="true" />
          ) : null}
          {!isBass && tutorialGhostNote ? (
            <span
              className={`piano-roll-ghost-note-block${
                tutorialGhostNote.completed ? ' is-complete' : ''
              }${tutorialGhostNote.highlight ? ' is-highlight' : ''}`}
              style={
                {
                  '--note-span-steps': `${tutorialGhostNote.length}`,
                } as CSSProperties
              }
              aria-hidden="true"
            >
              {tutorialGhostNote.label ? (
                <span className="piano-roll-ghost-label">{tutorialGhostNote.label}</span>
              ) : null}
            </span>
          ) : null}
        </div>
      );
      })
    );
  }, [
    applyChord,
    bass,
    canEditCollab,
    collabBarLocks,
    collabNoteColors,
    collabNoteAuthors,
    colSpan,
    columnMeta,
    currentGrid,
    currentLabels,
    currentLengths,
    dragMelodyOrigin,
    dragMelodyPreviewLength,
    drawValue,
    editTool,
    handleCellChange,
    getCollabNoteKey,
    getRowAccent,
    isBass,
    isDrawing,
    isExternalGrid,
    melodyNoteInfoMap,
    melodyNoteLengthSteps,
    modeClass,
    marqueeOrigin,
    onCommitChordOperation,
    onCommitMelodyOperation,
    onDropChord,
    onRequestZoom,
    onToggleNote,
    requestCollabBarLock,
    releaseActiveLock,
    resolvedInstrument,
    rowHeight,
    rowSpan,
    selectedRange,
    stepWidth,
    timeSignature,
    timeSignatureChanges,
    toggleMelody,
    tutorialGhostNoteMap,
    visibleColEnd,
    visibleColStart,
    visibleRowEnd,
    visibleRowStart,
  ]);

  if (!isBass) {
    return (
      <div
        className={`piano-roll piano-roll--melody piano-roll--melody-detached${
          isGuitar ? ' piano-roll--guitar' : ''
        } piano-roll--${resolvedInstrument}`}
        data-scroll-key={scrollKey ?? resolvedInstrument}
        style={pianoRollStyle}
        onMouseUp={() => {
          setMarqueeOrigin(null);
          finalizeMelodyDraw();
        }}
        onMouseLeave={() => {
          setMarqueeOrigin(null);
          finalizeMelodyDraw();
        }}
      >
        {SHOW_LEGACY_EDITOR_ASSIST_CONTROLS ? <div className="piano-roll-melody-topbar">
          <div className="piano-roll-melody-corner" aria-hidden="true" />
          <div
            className="piano-roll-length-bar"
            aria-label={isGuitar ? 'Guitar note length' : 'Melody note length'}
          >
            <div
              className="piano-roll-length-controls"
              onMouseEnter={(event) => onHelpZoneEnter?.('length', event)}
              onMouseMove={(event) => onHelpZoneMove?.('length', event)}
              onMouseLeave={() => onHelpZoneLeave?.('length')}
            >
              {melodyNoteLengthOptions.map((option) => (
                <button
                  key={option.steps}
                  type="button"
                  className={`piano-roll-length-button${
                    melodyNoteLengthSteps === option.steps ? ' is-active' : ''
                  }`}
                  onClick={() => setMelodyNoteLengthSteps(option.steps)}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div
              className="piano-roll-chord-actions"
              aria-label={isGuitar ? 'Guitar chords' : 'Melody chords'}
              onMouseEnter={(event) => onHelpZoneEnter?.('chords', event)}
              onMouseMove={(event) => onHelpZoneMove?.('chords', event)}
              onMouseLeave={() => onHelpZoneLeave?.('chords')}
            >
              {MELODY_CHORD_OPTIONS.map((chord) => (
                <button
                  key={chord}
                  type="button"
                  className={`piano-roll-chord-chip${isGuitar ? ' is-guitar' : ''}`}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', chord);
                  }}
                >
                  {chord}
                </button>
              ))}
            </div>
          </div>
        </div> : null}

        <div className="piano-roll-melody-header-row">
          <div className="piano-roll-melody-corner piano-roll-melody-corner--header" aria-hidden="true" />
          <div className="piano-roll-step-header-viewport">
            <div
              ref={melodyHeaderRef}
              className="piano-roll-step-header piano-roll-step-header--melody"
              style={{
                gridTemplateColumns: `repeat(${steps}, ${stepWidth}px)`,
              } as CSSProperties}
            >
              {stepHeaderButtons}
            </div>
          </div>
        </div>

        <div
          ref={melodyScrollerRef}
          className="piano-roll-melody-scroller"
          onScroll={(event) => {
            syncMelodyScrollLeft(event.currentTarget);
          }}
        >
          <div className="piano-roll-sidebar">
            <div
              className="piano-roll-sidebar-notes"
              style={{ gridTemplateRows: `repeat(${rowCount}, ${rowHeight}px)` }}
            >
              {sidebarNotes}
            </div>
          </div>

          <div className="piano-roll-body">
            <div className="piano-roll-content">
              <div
                className="piano-roll-playhead piano-roll-playhead--detached"
                style={
                  {
                    '--piano-step-index': `${initialStepRef.current}`,
                  } as CSSProperties
                }
              />

              <div
                className="piano-roll-grid piano-roll-grid--melody piano-roll-grid--virtualized"
                style={{
                  width: `${steps * colSpan - gridGap}px`,
                  height: `${rowCount * rowSpan - gridGap}px`,
                }}
              >
                {gridCells}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={melodyScrollerRef}
      className="piano-roll piano-roll--bass"
      style={pianoRollStyle}
      onScroll={(event) => {
        syncMelodyScrollLeft(event.currentTarget);
      }}
      onMouseUp={() => {
        setMarqueeOrigin(null);
        finalizeMelodyDraw();
      }}
      onMouseLeave={() => {
        setMarqueeOrigin(null);
        finalizeMelodyDraw();
      }}
    >
      <div className="piano-roll-sidebar">
        <div
          className="piano-roll-sidebar-notes"
          style={{ gridTemplateRows: `repeat(${rowCount}, ${rowHeight}px)` }}
        >
          {sidebarNotes}
        </div>
      </div>

      <div className="piano-roll-body">
        <div className="piano-roll-content">
          <div
            className="piano-roll-playhead"
            style={
              {
                '--piano-step-index': `${initialStepRef.current}`,
              } as CSSProperties
            }
          />

          <div
            className="piano-roll-step-header piano-roll-step-header--bass"
            style={{ gridTemplateColumns: `repeat(${steps}, ${stepWidth}px)` }}
          >
            {stepHeaderButtons}
          </div>

          <div
            className="piano-roll-grid piano-roll-grid--bass"
            style={{
              gridTemplateColumns: `repeat(${steps}, ${stepWidth}px)`,
              gridTemplateRows: `repeat(${rowCount}, ${rowHeight}px)`,
              width: `${steps * colSpan - gridGap}px`,
            }}
          >
            {gridCells}
          </div>
        </div>
      </div>
    </div>
  );
};
