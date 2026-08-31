import {
  BASS_NOTES,
  CHICAGO_STREET_NOTES,
  DRUM_TRACK_LABELS,
  GLOCKENSPIEL_NOTES,
  GUITAR_TRACK_LABELS,
  MELODY_NOTES,
  PICCOLO_NOTES,
  SAXOPHONE_NOTES,
  STUDIO_ALTO_SAX_NOTES,
  SUPPORTING_PIANO_NOTES,
  VIOLIN_NOTES,
} from '../constants/composer.ts';
import type { InstrumentKey, MusicEvent, SerializedExtraInstrumentTrack, SongProject } from '../store/songStore.ts';

const TOTAL_STEPS = 640;
const BAR_LENGTH = 16;
const BAR_COUNT = TOTAL_STEPS / BAR_LENGTH;

type ChordName = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B';
type Genre = 'ballad' | 'lofi' | 'citypop' | 'dance' | 'jazz' | 'rock' | 'default';
type Mood = 'bright' | 'warm' | 'sad' | 'dreamy' | 'energetic' | 'calm';
type Theme =
  | 'christmas'
  | 'winter'
  | 'summerSea'
  | 'summerNight'
  | 'spring'
  | 'night'
  | 'calm'
  | 'rainyNight'
  | 'breakup'
  | 'cafeLofi'
  | 'kpopDance'
  | 'gameBgm'
  | 'cinematic'
  | 'study'
  | 'default';

type PromptAnalysis = {
  bpm: number;
  genre: Genre;
  mood: Mood;
  progression: ChordName[];
  secondaryProgression: ChordName[];
  density: number;
  swing: boolean;
  theme: Theme;
  styleId: string;
  variation: number;
  promptSeed: number;
  instruments: Record<InstrumentKey, boolean>;
};

type ChordToneSet = {
  bass: string;
  melody: string[];
  guitar: string[];
  passing: string[];
};

type ExtraInstrumentKey = Extract<
  InstrumentKey,
  | 'glockenspiel'
  | 'piccolo'
  | 'supportingPiano'
  | 'chicagoStreet'
  | 'studioAltoSax'
>;

const CHORD_TONES: Record<ChordName, ChordToneSet> = {
  C: {
    bass: 'C2',
    melody: ['C4', 'E4', 'G4', 'C5', 'E5'],
    guitar: ['C4', 'E4', 'G4'],
    passing: ['D4', 'A4', 'B4'],
  },
  D: {
    bass: 'D2',
    melody: ['D4', 'F4', 'A4', 'D5', 'F5'],
    guitar: ['D4', 'F4', 'A4'],
    passing: ['E4', 'G4', 'C5'],
  },
  E: {
    bass: 'E2',
    melody: ['E4', 'G4', 'B4', 'E5', 'G5'],
    guitar: ['E4', 'G4', 'B4'],
    passing: ['F4', 'A4', 'D5'],
  },
  F: {
    bass: 'F2',
    melody: ['F4', 'A4', 'C5', 'F5', 'A5'],
    guitar: ['F4', 'A4', 'C5'],
    passing: ['E4', 'G4', 'D5'],
  },
  G: {
    bass: 'G2',
    melody: ['G4', 'B4', 'D5', 'G5', 'B5'],
    guitar: ['G4', 'B4', 'D5'],
    passing: ['A4', 'C5', 'E5'],
  },
  A: {
    bass: 'A2',
    melody: ['A4', 'C5', 'E5', 'A5', 'C6'],
    guitar: ['A3', 'C4', 'E4'],
    passing: ['G4', 'B4', 'D5'],
  },
  B: {
    bass: 'B2',
    melody: ['B4', 'D5', 'F5', 'B5'],
    guitar: ['B3', 'D4', 'F4'],
    passing: ['A4', 'C5', 'E5'],
  },
};

const PROGRESSIONS: Record<Genre, ChordName[][]> = {
  ballad: [
    ['C', 'G', 'A', 'F'],
    ['F', 'G', 'E', 'A'],
    ['A', 'F', 'C', 'G'],
    ['C', 'A', 'F', 'G'],
    ['F', 'C', 'D', 'G'],
  ],
  lofi: [
    ['A', 'F', 'C', 'G'],
    ['F', 'E', 'A', 'G'],
    ['C', 'G', 'A', 'F'],
    ['A', 'G', 'F', 'C'],
    ['D', 'G', 'C', 'A'],
  ],
  citypop: [
    ['F', 'G', 'E', 'A'],
    ['C', 'G', 'E', 'A'],
    ['A', 'F', 'G', 'C'],
    ['F', 'C', 'G', 'E'],
    ['D', 'G', 'E', 'A'],
    ['F', 'G', 'C', 'A'],
  ],
  dance: [
    ['A', 'F', 'C', 'G'],
    ['C', 'G', 'A', 'F'],
    ['F', 'G', 'A', 'C'],
    ['A', 'G', 'F', 'G'],
  ],
  jazz: [
    ['D', 'G', 'C', 'A'],
    ['F', 'E', 'A', 'D'],
    ['C', 'A', 'D', 'G'],
    ['F', 'G', 'E', 'A'],
  ],
  rock: [
    ['A', 'G', 'F', 'G'],
    ['C', 'G', 'F', 'C'],
    ['A', 'F', 'C', 'G'],
    ['F', 'C', 'G', 'A'],
  ],
  default: [
    ['C', 'G', 'A', 'F'],
    ['A', 'F', 'C', 'G'],
    ['F', 'C', 'G', 'A'],
    ['G', 'A', 'F', 'C'],
    ['C', 'A', 'F', 'G'],
    ['F', 'G', 'E', 'A'],
    ['D', 'G', 'C', 'A'],
  ],
};

const GENRE_DEFAULT_BPM: Record<Genre, number> = {
  ballad: 78,
  lofi: 86,
  citypop: 104,
  dance: 124,
  jazz: 96,
  rock: 116,
  default: 100,
};

const THEME_PROGRESSIONS: Partial<Record<Theme, ChordName[][]>> = {
  christmas: [
    ['C', 'G', 'C', 'F'],
    ['C', 'F', 'G', 'C'],
    ['F', 'C', 'G', 'C'],
    ['C', 'F', 'C', 'G'],
    ['G', 'C', 'F', 'G'],
    ['F', 'G', 'C', 'C'],
    ['C', 'C', 'F', 'G'],
    ['G', 'F', 'C', 'G'],
  ],
  winter: [
    ['A', 'F', 'C', 'G'],
    ['F', 'C', 'G', 'A'],
    ['C', 'A', 'F', 'G'],
  ],
  summerSea: [
    ['C', 'G', 'F', 'G'],
    ['F', 'G', 'C', 'G'],
    ['G', 'C', 'F', 'C'],
  ],
  spring: [
    ['C', 'F', 'G', 'C'],
    ['F', 'C', 'G', 'C'],
    ['G', 'C', 'F', 'G'],
  ],
  night: [
    ['A', 'F', 'C', 'G'],
    ['F', 'E', 'A', 'G'],
  ],
  calm: [
    ['C', 'F', 'C', 'G'],
    ['F', 'C', 'F', 'G'],
    ['C', 'G', 'F', 'C'],
    ['G', 'C', 'F', 'C'],
  ],
  rainyNight: [
    ['A', 'F', 'C', 'G'],
    ['F', 'C', 'G', 'A'],
    ['A', 'G', 'F', 'C'],
    ['C', 'A', 'F', 'G'],
  ],
  breakup: [
    ['A', 'F', 'C', 'G'],
    ['F', 'G', 'E', 'A'],
    ['C', 'G', 'A', 'F'],
  ],
  summerNight: [
    ['F', 'G', 'E', 'A'],
    ['C', 'G', 'A', 'F'],
    ['F', 'G', 'C', 'A'],
    ['A', 'F', 'G', 'E'],
  ],
  cafeLofi: [
    ['A', 'F', 'C', 'G'],
    ['C', 'G', 'A', 'F'],
    ['F', 'E', 'A', 'G'],
    ['G', 'A', 'F', 'C'],
  ],
  kpopDance: [
    ['A', 'F', 'C', 'G'],
    ['F', 'G', 'E', 'A'],
    ['C', 'G', 'A', 'F'],
  ],
  gameBgm: [
    ['C', 'G', 'A', 'F'],
    ['F', 'G', 'C', 'G'],
    ['A', 'G', 'F', 'G'],
  ],
  cinematic: [
    ['A', 'F', 'C', 'G'],
    ['F', 'C', 'G', 'A'],
    ['C', 'G', 'F', 'A'],
  ],
  study: [
    ['A', 'F', 'C', 'G'],
    ['C', 'G', 'A', 'F'],
  ],
};

const SAFE_NOTE_ROOTS = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

const LEAD_MELODY_TONES: Record<ChordName, string[]> = {
  C: ['C3', 'E3', 'G3', 'C4', 'E4', 'G4', 'C5'],
  D: ['D3', 'F3', 'A3', 'D4', 'F4', 'A4', 'D5'],
  E: ['E3', 'G3', 'B3', 'E4', 'G4', 'B4'],
  F: ['C3', 'F3', 'A3', 'C4', 'F4', 'A4', 'C5'],
  G: ['D3', 'G3', 'B3', 'D4', 'G4', 'B4', 'D5'],
  A: ['C3', 'E3', 'A3', 'C4', 'E4', 'A4', 'C5'],
  B: ['D3', 'F3', 'B3', 'D4', 'F4', 'B4'],
};

const NOTE_TO_MIDI: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const MIDI_TO_NOTE_ROOT = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

function createSeed(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(items: readonly T[], random: () => number) {
  return items[Math.floor(random() * items.length)] ?? items[0];
}

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function isSoftIntent(text: string) {
  return includesAny(text, [
    '잔잔',
    '차분',
    '편안',
    '조용',
    '고요',
    '부드럽',
    '느린',
    '힐링',
    '휴식',
    '미니멀',
    '평화로운',
    '포근한',
    '따뜻한',
    '부드러운',
    '새벽',
    '심야',
    'calm',
    'peaceful',
    'soft',
    'slow',
    'minimal',
  ]);
}

function isEnergeticIntent(text: string) {
  return includesAny(text, [
    '신나는',
    '강한',
    '빠른',
    '댄스',
    'edm',
    '클럽',
    '터지는',
    '축제',
    '디스코',
    '펑크',
    '벅차오르는',
    '희망찬',
    '밝은',
    'energetic',
    'fast',
    'dance',
    'club',
  ]);
}

type PromptStyleProfile = {
  genre?: Genre;
  mood?: Mood;
  theme?: Theme;
  styleId?: string;
  bpm?: number;
  density?: number;
  swing?: boolean;
  progressions?: ChordName[][];
  instruments?: Partial<Record<InstrumentKey, boolean>>;
};

function mergeProfile(base: PromptStyleProfile, next: PromptStyleProfile): PromptStyleProfile {
  return {
    ...base,
    ...next,
    instruments: {
      ...(base.instruments ?? {}),
      ...(next.instruments ?? {}),
    },
  };
}

function hasPromptWord(text: string, keywords: readonly string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasPromptWords(text: string, keywords: readonly string[]) {
  return keywords.every((keyword) => text.includes(keyword));
}

function getReliablePromptStyleProfile(text: string): PromptStyleProfile {
  const winter = '\uaca8\uc6b8';
  const spring = '\ubd04';
  const summer = '\uc5ec\ub984';
  const autumn = '\uac00\uc744';
  const christmas = '\ud06c\ub9ac\uc2a4\ub9c8\uc2a4';
  const carol = '\uce90\ub7f4';
  const cityPop = '\uc2dc\ud2f0\ud31d';
  const dreamy = '\ubabd\ud658';
  const mystic = '\uc2e0\ube44';
  const calm = '\uc794\uc794';
  const piano = '\ud53c\uc544\ub178';
  const lofi = '\ub85c\ud30c\uc774';
  const jazz = '\uc7ac\uc988';
  const bossa = '\ubcf4\uc0ac\ub178\ubc14';
  const ballad = '\ubc1c\ub77c\ub4dc';
  const sad = '\uc2ac\ud508';
  const lonely = '\uc4f8\uc4f8';
  const bright = '\ubc1d\uc740';
  const fresh = '\uccad\ub7c9';
  const drive = '\ub4dc\ub77c\uc774\ube0c';
  const beach = '\ud574\ubcc0';
  const sea = '\ubc14\ub2e4';
  const rain = '\ube44';
  const cafe = '\uce74\ud398';
  const night = '\ubc24';
  const cherryBlossom = '\ubc9a\uaf43';
  const firstLove = '\uccab\uc0ac\ub791';
  const acoustic = '\uc5b4\ucfe0\uc2a4\ud2f1';
  const edm = 'edm';
  const dance = '\ub304\uc2a4';
  const disco = '\ub514\uc2a4\ucf54';
  const funk = '\ud391\ud06c';
  const synth = '\uc2e0\uc2a4';
  const cinematic = '\uc2dc\ub124\ub9c8\ud2f1';
  const epic = '\uc6c5\uc7a5';
  const horror = '\ud638\ub7ec';
  const dark = '\uc5b4\ub450';
  const game = '\uac8c\uc784';
  const chiptune = '\uce69\ud29c';
  const empty = '\uacf5\ud5c8';
  const gloomy = '\uc6b0\uc6b8';
  const faint = '\uc544\ub828';
  const cold = '\ucc28\uac00\uc6b4';
  const quiet = '\uc870\uc6a9';
  const peaceful = '\ud3c9\ud654';
  const comfortable = '\ud3b8\uc548';
  const warm = '\ub530\ub73b';
  const cozy = '\ud3ec\uadfc';
  const neon = '\ub124\uc628';
  const dawn = '\uc0c8\ubcbd';
  const city = '\ub3c4\uc2dc';
  const pianoProfile = (): PromptStyleProfile => {
    const localSeed = createSeed(text || 'piano');
    const fallbackPianoModes = ['calmPianoLyrical', 'calmPiano', 'calmPianoNight', 'calmPianoBright', 'calmPianoSad', 'calmPianoRain'] as const;
    const fallbackStyleId = fallbackPianoModes[localSeed % fallbackPianoModes.length];
    const isLyricalPiano = hasPromptWord(text, [
      '\ud50c\ub77c\uc6cc',
      '\ud50c\ub77c\uc6cc \ub304\uc2a4',
      'flower',
      'flower dance',
      '\uc720\ud29c\ube0c',
      '\ub274\uc5d0\uc774\uc9c0',
      'new age',
      'ost',
      'reminiscence',
      'talesweaver',
      'tales weaver',
      'canon',
      'pachelbel',
      '캐논',
      '케논',
      '파헬벨',
      '테일즈위버',
      '레미니센스',
      '\uac10\uc131 \ud53c\uc544\ub178',
      '\uc11c\uc815',
      '\uc11c\uc815\uc801',
      '\uc544\ub984\ub2e4\uc6b4',
      '\ub9d1\uc740',
    ]);
    const isNewAgePiano = hasPromptWord(text, ['new age', '\ub274\uc5d0\uc774\uc9c0', '\ud53c\uc544\ub178 \uc5f0\uc8fc\uace1', '\ud3b8\uc548\ud55c \ud53c\uc544\ub178']);
    const isCalmSoloPiano = hasPromptWord(text, ['\uc794\uc794\ud55c \ud53c\uc544\ub178', '\uc870\uc6a9\ud55c \ud53c\uc544\ub178', '\uc794\uc794\ud55c \ud53c\uc544\ub178\uace1', '\uc870\uc6a9\ud55c \ud53c\uc544\ub178\uace1']);
    const isSadPiano = hasPromptWord(text, [sad, faint, lonely, gloomy, '\uc544\ub828', '\uc2ac\ud508', '\uc678\ub85c', '\uadf8\ub9ac\uc6b4']);
    const isNightPiano = hasPromptWord(text, [night, dawn, neon, '\ubc24', '\uc0c8\ubcbd', '\uc57c\uacbd']);
    const isRainPiano = hasPromptWord(text, [rain, '\ube44', '\uc7a5\ub9c8']);
    const isWinterPiano = hasPromptWord(text, [winter, cold, '\ub208', '\ucc28\uac00\uc6b4']);
    const isBrightPiano = hasPromptWord(text, [bright, fresh, firstLove, '\ubd04', '\ud76c\ub9dd', '\uc124\ub808']);
    const isDreamPiano = hasPromptWord(text, [dreamy, mystic, '\ubabd\ud658', '\uc2e0\ube44', '\uafc8']);
    const isCanonPiano = hasPromptWord(text, ['canon', 'pachelbel', '\uce90\ub17c', '\ucf00\ub17c', '\ud30c\ud5ec\ubca8']);
    const isRpgOstPiano = hasPromptWord(text, ['reminiscence', 'talesweaver', 'tales weaver', 'ost', '\ud14c\uc77c\uc988\uc704\ubc84', '\ub808\ubbf8\ub2c8\uc13c\uc2a4']);
    const isFallbackSad = fallbackStyleId === 'calmPianoSad';
    const isFallbackNight = fallbackStyleId === 'calmPianoNight';
    const isFallbackRain = fallbackStyleId === 'calmPianoRain';
    const isFallbackBright = fallbackStyleId === 'calmPianoBright';
    const pianoStyleId =
      isCanonPiano
        ? 'calmPianoCanon'
        : isRpgOstPiano
          ? 'calmPianoRpgOst'
          : isNewAgePiano
            ? 'calmPianoNewAge'
            : isCalmSoloPiano
              ? 'calmPianoSoft'
      : isLyricalPiano
        ? 'calmPianoLyrical'
        : isSadPiano
        ? 'calmPianoSad'
        : isNightPiano || isDreamPiano
          ? 'calmPianoNight'
          : isRainPiano
            ? 'calmPianoRain'
            : isWinterPiano
              ? 'calmPianoWinter'
              : isBrightPiano
                ? 'calmPianoBright'
                : fallbackStyleId;
    const finalSadPiano = isSadPiano || (!isNightPiano && !isRainPiano && !isWinterPiano && !isBrightPiano && !isDreamPiano && isFallbackSad);
    const finalNightPiano = isNightPiano || isDreamPiano || (!isSadPiano && !isRainPiano && !isWinterPiano && !isBrightPiano && isFallbackNight);
    const finalRainPiano = isRainPiano || (!isSadPiano && !isNightPiano && !isWinterPiano && !isBrightPiano && !isDreamPiano && isFallbackRain);
    const finalBrightPiano = isBrightPiano || (!isSadPiano && !isNightPiano && !isRainPiano && !isWinterPiano && !isDreamPiano && isFallbackBright);

    return {
      styleId: pianoStyleId,
      genre: 'default' as const,
      mood: isCanonPiano ? 'warm' as const : isRpgOstPiano || isLyricalPiano ? 'dreamy' as const : finalSadPiano ? 'sad' as const : finalBrightPiano ? 'bright' as const : finalNightPiano ? 'dreamy' as const : 'calm' as const,
      theme: isRpgOstPiano ? 'cinematic' as const : finalRainPiano ? 'rainyNight' as const : isWinterPiano ? 'winter' as const : finalNightPiano ? 'night' as const : 'calm' as const,
      bpm: isCanonPiano ? 84 : isRpgOstPiano ? 78 : isLyricalPiano ? 88 : finalSadPiano ? 68 : finalRainPiano ? 72 : isWinterPiano ? 70 : finalBrightPiano ? 86 : finalNightPiano ? 76 : 72,
      density: isCanonPiano ? 0.82 : isRpgOstPiano ? 0.74 : isLyricalPiano ? 0.78 : finalBrightPiano ? 0.72 : finalNightPiano ? 0.66 : finalSadPiano || finalRainPiano || isWinterPiano ? 0.58 : 0.64,
      progressions: isCanonPiano
        ? [['C', 'G', 'A', 'E'], ['F', 'C', 'F', 'G'], ['C', 'G', 'A', 'E'], ['F', 'C', 'F', 'G']]
        : isRpgOstPiano
          ? [['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'A'], ['C', 'G', 'A', 'F'], ['F', 'G', 'E', 'A'], ['D', 'G', 'C', 'A']]
        : isLyricalPiano
        ? [['A', 'F', 'C', 'G'], ['F', 'G', 'E', 'A'], ['C', 'G', 'A', 'F'], ['F', 'C', 'G', 'A'], ['D', 'G', 'C', 'A']]
        : finalSadPiano
        ? [['A', 'F', 'C', 'G'], ['F', 'G', 'E', 'A'], ['A', 'G', 'F', 'C'], ['F', 'C', 'G', 'A']]
        : finalNightPiano
          ? [['A', 'G', 'F', 'C'], ['F', 'C', 'A', 'G'], ['C', 'G', 'A', 'F'], ['F', 'G', 'E', 'A']]
          : finalRainPiano
            ? [['F', 'C', 'G', 'A'], ['A', 'F', 'C', 'G'], ['C', 'F', 'G', 'C'], ['F', 'E', 'A', 'G']]
            : isWinterPiano
              ? [['A', 'F', 'C', 'G'], ['C', 'A', 'F', 'G'], ['F', 'C', 'G', 'A'], ['C', 'G', 'F', 'C']]
              : finalBrightPiano
                ? [['C', 'G', 'A', 'F'], ['C', 'F', 'G', 'C'], ['F', 'G', 'C', 'A'], ['G', 'C', 'F', 'G']]
                : [['C', 'F', 'C', 'G'], ['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'C'], ['C', 'G', 'A', 'F'], ['D', 'G', 'C', 'A']],
      instruments: { drums: false, bass: false, guitar: false, violin: false, saxophone: false, glockenspiel: false, piccolo: false, supportingPiano: true, chicagoStreet: false, studioAltoSax: false },
    };
  };

  const hasSadIntent = hasPromptWord(text, [sad, lonely, empty, gloomy, faint, '\uc678\ub85c', '\uadf8\ub9ac\uc6b4', '\ub099\uc5fd', '\ucd94\uc5b5']);
  const hasDarkIntent = hasPromptWord(text, [dark, horror, cold, '\ubb34\uc11c', '\uae34\uc7a5', '\uc5bc\uc5b4\ubd99', '\ub2e4\ud06c']);
  const hasCalmIntent = hasPromptWord(text, [calm, quiet, peaceful, comfortable, '\uace0\uc694', '\ubd80\ub4dc\ub7ec', '\uc0b4\uc0b4']);
  const hasDreamyIntent = hasPromptWord(text, [dreamy, mystic, '\uafc8', '\uc2e0\ube44\ub85c\uc6b4', '\ud76c\ubbf8', '\uacf5\uac04\uac10']);
  const hasBrightIntent = hasPromptWord(text, [bright, fresh, '\uc2e0\ub098', '\ud589\ubcf5', '\uc124\ub808', '\ud76c\ub9dd', '\ubc85\ucc28']);

  if (hasSadIntent && !hasBrightIntent) {
    return {
      styleId: hasPromptWord(text, [winter]) ? 'lonelyWinterBallad' : hasPromptWord(text, [cityPop, city, neon]) ? 'melancholyCityPop' : 'lonelyBallad',
      genre: hasPromptWord(text, [cityPop, city, neon]) ? 'citypop' : 'ballad',
      mood: 'sad',
      theme: hasPromptWord(text, [winter, cold]) ? 'winter' : hasPromptWord(text, [rain, cafe]) ? 'rainyNight' : 'breakup',
      bpm: hasPromptWord(text, [cityPop, city, neon]) ? 90 : 72,
      density: hasPromptWord(text, [empty, gloomy]) ? 0.26 : 0.38,
      progressions: [['A', 'F', 'C', 'G'], ['A', 'G', 'F', 'C'], ['F', 'C', 'G', 'A'], ['F', 'G', 'E', 'A']],
      instruments: { drums: false, bass: !hasPromptWord(text, [empty]), guitar: hasPromptWord(text, [acoustic, cityPop]), violin: true, saxophone: false, glockenspiel: false, piccolo: false, supportingPiano: true, chicagoStreet: false, studioAltoSax: hasPromptWord(text, [cityPop]) },
    };
  }

  if (hasDarkIntent && !hasBrightIntent) {
    return {
      styleId: hasPromptWord(text, [horror, '\ubb34\uc11c']) ? 'scaryFeeling' : 'darkFeeling',
      genre: 'default',
      mood: 'sad',
      theme: 'cinematic',
      bpm: hasPromptWord(text, ['\uae34\uc7a5', epic]) ? 92 : 68,
      density: hasPromptWord(text, ['\uae34\uc7a5', epic]) ? 0.44 : 0.24,
      progressions: [['A', 'F', 'A', 'G'], ['F', 'A', 'G', 'A'], ['A', 'G', 'F', 'C']],
      instruments: { drums: false, bass: hasPromptWord(text, ['\uae34\uc7a5', epic]), guitar: false, violin: true, saxophone: false, glockenspiel: false, piccolo: false, supportingPiano: true, chicagoStreet: false, studioAltoSax: false },
    };
  }

  if (hasCalmIntent && !hasBrightIntent && !hasPromptWord(text, [cityPop, disco, funk, edm, dance])) {
    if (hasPromptWord(text, [piano, '\ud53c\uc544\ub178\uace1', 'piano solo', 'solo piano'])) {
      return pianoProfile();
    }

    return {
      styleId: hasPromptWords(text, [calm, piano]) ? 'calmPiano' : hasPromptWord(text, [warm, cozy]) ? 'cozyFeeling' : 'comfortableFeeling',
      genre: 'default',
      mood: 'calm',
      theme: hasPromptWord(text, [rain]) ? 'rainyNight' : 'calm',
      bpm: 72,
      density: 0.3,
      progressions: [['C', 'F', 'C', 'G'], ['F', 'C', 'F', 'G'], ['A', 'F', 'C', 'G']],
      instruments: { drums: false, bass: false, guitar: hasPromptWord(text, [acoustic, warm, cozy]), violin: hasPromptWord(text, [warm, cozy]) ? false : true, saxophone: false, glockenspiel: false, piccolo: false, supportingPiano: true, chicagoStreet: false, studioAltoSax: false },
    };
  }

  if (hasDreamyIntent && !hasBrightIntent && !hasPromptWord(text, [cityPop])) {
    return {
      styleId: hasPromptWord(text, [mystic]) ? 'mysticFeeling' : 'dreamyFeeling',
      genre: 'lofi',
      mood: 'dreamy',
      theme: hasPromptWord(text, [night, dawn, neon]) ? 'night' : hasPromptWord(text, [winter, cold]) ? 'winter' : 'calm',
      bpm: 78,
      density: 0.34,
      progressions: [['A', 'F', 'C', 'G'], ['F', 'C', 'A', 'G'], ['A', 'G', 'F', 'C']],
      instruments: { drums: false, bass: true, guitar: false, violin: true, glockenspiel: hasPromptWord(text, [mystic, winter]), piccolo: false, supportingPiano: true, chicagoStreet: false, studioAltoSax: false },
    };
  }

  if (hasPromptWords(text, [summer, cityPop])) {
    const isNight = hasPromptWord(text, [night, '\uc57c\uac04', '\uc57c\uacbd', neon, dawn]);
    const isDreamy = hasDreamyIntent || isNight;
    return {
      styleId: isDreamy ? 'summerNightCityPop' : 'summerCityPop',
      genre: 'citypop',
      mood: isDreamy ? 'dreamy' : 'bright',
      theme: isDreamy ? 'summerNight' : 'summerSea',
      bpm: isDreamy ? 98 : 112,
      density: isDreamy ? 0.58 : 0.76,
      swing: true,
      progressions: isDreamy
        ? [['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'E'], ['C', 'G', 'E', 'A'], ['F', 'C', 'G', 'A']]
        : [['F', 'G', 'E', 'A'], ['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'G'], ['A', 'F', 'G', 'E']],
      instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, studioAltoSax: true, glockenspiel: true, chicagoStreet: false },
    };
  }

  if (
    hasPromptWords(text, [calm, piano]) ||
    (
      hasPromptWord(text, [piano, '\ud53c\uc544\ub178\uace1', '\uc720\ud29c\ube0c \ud53c\uc544\ub178', '\uac10\uc131 \ud53c\uc544\ub178', 'solo piano', 'piano solo']) &&
      !hasPromptWord(text, [cityPop, jazz, '\ub4dc\ub7fc', '\ubca0\uc774\uc2a4', '\uae30\ud0c0', 'drum', 'bass', 'guitar', edm, dance, funk, disco])
    ) ||
    hasPromptWord(text, ['new age', '\ub274\uc5d0\uc774\uc9c0', '\ud3b8\uc548\ud55c \ud53c\uc544\ub178'])
  ) {
    return pianoProfile();
  }

  if (hasPromptWords(text, [christmas, jazz]) || hasPromptWords(text, [carol, jazz])) {
    return {
      styleId: 'christmasJazz',
      genre: 'jazz',
      mood: 'warm',
      theme: 'christmas',
      bpm: 100,
      density: 0.6,
      swing: true,
      progressions: [['C', 'F', 'D', 'G'], ['F', 'C', 'D', 'G'], ['C', 'G', 'C', 'F']],
      instruments: { drums: true, bass: true, guitar: true, saxophone: true, studioAltoSax: true, supportingPiano: true, glockenspiel: true },
    };
  }

  if (hasPromptWord(text, [christmas, carol, 'xmas'])) {
    return {
      styleId: 'carolPop',
      genre: 'default',
      mood: 'bright',
      theme: 'christmas',
      bpm: 112,
      density: 0.72,
      progressions: [['C', 'G', 'F', 'G'], ['C', 'F', 'C', 'G'], ['F', 'G', 'C', 'G']],
      instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, glockenspiel: true, piccolo: false },
    };
  }

  if (hasPromptWords(text, [winter, cityPop])) {
    return {
      styleId: 'winterCityPop',
      genre: 'citypop',
      mood: 'dreamy',
      theme: 'winter',
      bpm: 98,
      density: 0.62,
      progressions: [['A', 'F', 'G', 'E'], ['F', 'C', 'G', 'A'], ['C', 'G', 'E', 'A']],
      instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, studioAltoSax: true, glockenspiel: true },
    };
  }

  if (hasPromptWords(text, [dreamy, cityPop]) || hasPromptWords(text, [night, cityPop])) {
    return {
      styleId: 'nightDrive',
      genre: 'citypop',
      mood: 'dreamy',
      theme: 'night',
      bpm: 102,
      density: 0.64,
      progressions: [['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'E'], ['C', 'G', 'E', 'A']],
      instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, studioAltoSax: true, glockenspiel: false },
    };
  }

  if (hasPromptWord(text, [dreamy])) {
    return {
      styleId: 'dreamyFeeling',
      genre: 'lofi',
      mood: 'dreamy',
      theme: hasPromptWord(text, [night, '\uc57c\uacbd', '\ub124\uc628']) ? 'night' : 'calm',
      bpm: 80,
      density: 0.42,
      progressions: [['A', 'F', 'C', 'G'], ['F', 'C', 'A', 'G'], ['A', 'G', 'F', 'C']],
      instruments: { drums: false, bass: true, guitar: false, violin: true, glockenspiel: true, supportingPiano: true, piccolo: false },
    };
  }

  if (hasPromptWord(text, [mystic])) {
    return {
      styleId: 'mysticFeeling',
      genre: 'default',
      mood: 'dreamy',
      theme: 'cinematic',
      bpm: 70,
      density: 0.34,
      progressions: [['A', 'F', 'A', 'G'], ['F', 'A', 'G', 'A'], ['A', 'G', 'F', 'C']],
      instruments: { drums: false, bass: false, guitar: false, violin: true, glockenspiel: true, supportingPiano: true, piccolo: false },
    };
  }

  if (hasPromptWord(text, [cherryBlossom, spring, firstLove])) {
    return {
      styleId: hasPromptWord(text, [firstLove]) ? 'firstLoveFlutter' : 'cherryBlossomMood',
      genre: 'default',
      mood: 'bright',
      theme: 'spring',
      bpm: hasPromptWord(text, [firstLove]) ? 104 : 96,
      density: hasPromptWord(text, [firstLove]) ? 0.66 : 0.58,
      progressions: [['C', 'G', 'A', 'F'], ['F', 'C', 'G', 'C'], ['C', 'F', 'G', 'C']],
      instruments: { drums: hasPromptWord(text, [firstLove, bright]), bass: true, guitar: true, glockenspiel: true, supportingPiano: true },
    };
  }

  if (hasPromptWords(text, [summer, night]) || hasPromptWord(text, ['\uc5ec\ub984\ubc24'])) {
    return {
      styleId: hasPromptWord(text, ['\uc2dc\uc6d0', '\uccad\ub7c9', fresh]) ? 'coolSummerNight' : 'summerNightMood',
      genre: 'citypop',
      mood: hasPromptWord(text, ['\uc2dc\uc6d0', '\uccad\ub7c9', fresh]) ? 'bright' : 'dreamy',
      theme: 'summerNight',
      bpm: hasPromptWord(text, ['\uc2dc\uc6d0', '\uccad\ub7c9', fresh]) ? 106 : 98,
      density: hasPromptWord(text, ['\uc2dc\uc6d0', '\uccad\ub7c9', fresh]) ? 0.64 : 0.58,
      progressions: hasPromptWord(text, ['\uc2dc\uc6d0', '\uccad\ub7c9', fresh])
        ? [['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'A'], ['F', 'G', 'E', 'A']]
        : [['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'E'], ['C', 'G', 'A', 'F']],
      instruments: { drums: true, bass: true, guitar: true, violin: false, saxophone: false, glockenspiel: true, piccolo: false, supportingPiano: true, chicagoStreet: false, studioAltoSax: true },
    };
  }

  if (hasPromptWord(text, [fresh, beach, sea, drive]) || hasPromptWords(text, [summer, cityPop])) {
    return {
      styleId: hasPromptWord(text, [drive]) ? 'beachDrive' : 'refreshingCityPop',
      genre: 'citypop',
      mood: 'bright',
      theme: 'summerSea',
      bpm: hasPromptWord(text, [drive]) ? 116 : 112,
      density: 0.74,
      progressions: [['C', 'G', 'F', 'G'], ['F', 'G', 'E', 'A'], ['F', 'G', 'C', 'G']],
      instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, studioAltoSax: true, glockenspiel: true },
    };
  }

  if (hasPromptWord(text, [rain, cafe, lofi]) && !hasPromptWord(text, [edm, dance])) {
    return {
      styleId: hasPromptWord(text, [rain]) ? 'rainCafe' : 'midnightLofi',
      genre: 'lofi',
      mood: 'calm',
      theme: hasPromptWord(text, [rain]) ? 'rainyNight' : 'cafeLofi',
      bpm: 82,
      density: 0.44,
      swing: true,
      progressions: [['A', 'F', 'C', 'G'], ['F', 'E', 'A', 'G'], ['C', 'G', 'A', 'F']],
      instruments: { drums: true, bass: true, guitar: false, supportingPiano: true, studioAltoSax: hasPromptWord(text, [cafe]) },
    };
  }

  if (hasPromptWord(text, [sad, lonely, ballad, autumn])) {
    return {
      styleId: hasPromptWord(text, [winter]) ? 'lonelyWinterBallad' : 'lonelyBallad',
      genre: 'ballad',
      mood: 'sad',
      theme: hasPromptWord(text, [winter]) ? 'winter' : 'breakup',
      bpm: 72,
      density: 0.42,
      progressions: [['A', 'F', 'C', 'G'], ['A', 'G', 'F', 'C'], ['F', 'C', 'G', 'A']],
      instruments: { drums: false, bass: true, guitar: hasPromptWord(text, [acoustic, autumn]), violin: true, saxophone: false, supportingPiano: true, glockenspiel: false },
    };
  }

  if (hasPromptWord(text, [jazz, bossa, '\ub77c\uc6b4\uc9c0'])) {
    return {
      styleId: hasPromptWord(text, [bossa]) ? 'resortBossa' : 'warmJazz',
      genre: 'jazz',
      mood: 'warm',
      theme: hasPromptWord(text, [summer, beach, sea]) ? 'summerSea' : 'default',
      bpm: hasPromptWord(text, [bossa]) ? 94 : 88,
      density: 0.56,
      swing: true,
      progressions: [['D', 'G', 'C', 'A'], ['F', 'E', 'A', 'D'], ['C', 'F', 'D', 'G']],
      instruments: { drums: true, bass: true, guitar: true, saxophone: true, studioAltoSax: true, supportingPiano: true },
    };
  }

  if (hasPromptWord(text, [edm, dance, disco, funk])) {
    return {
      styleId: hasPromptWord(text, [disco, funk]) ? 'funkDiscoParty' : 'summerFestivalEdm',
      genre: 'dance',
      mood: 'energetic',
      theme: hasPromptWord(text, [summer, beach, sea]) ? 'summerSea' : 'default',
      bpm: hasPromptWord(text, [disco, funk]) ? 122 : 126,
      density: 0.88,
      progressions: [['A', 'F', 'C', 'G'], ['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'G']],
      instruments: { drums: true, bass: true, guitar: hasPromptWord(text, [funk, disco]), supportingPiano: true, chicagoStreet: true, glockenspiel: true },
    };
  }

  if (hasPromptWord(text, [synth])) {
    return {
      styleId: 'coldSynthPop',
      genre: 'citypop',
      mood: 'dreamy',
      theme: hasPromptWord(text, [winter]) ? 'winter' : 'night',
      bpm: 110,
      density: 0.64,
      progressions: [['A', 'G', 'F', 'G'], ['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'C']],
      instruments: { drums: true, bass: true, guitar: false, supportingPiano: true, chicagoStreet: true, glockenspiel: true },
    };
  }

  if (hasPromptWord(text, [cinematic, epic, horror, dark])) {
    return {
      styleId: hasPromptWord(text, [horror, dark]) ? 'scaryFeeling' : 'grandFeeling',
      genre: 'ballad',
      mood: hasPromptWord(text, [horror, dark]) ? 'sad' : 'dreamy',
      theme: 'cinematic',
      bpm: hasPromptWord(text, [epic]) ? 100 : 76,
      density: hasPromptWord(text, [epic]) ? 0.62 : 0.34,
      progressions: hasPromptWord(text, [horror, dark]) ? [['A', 'F', 'A', 'G'], ['F', 'A', 'G', 'A']] : [['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'A']],
      instruments: { drums: hasPromptWord(text, [epic]), bass: hasPromptWord(text, [epic]), violin: true, glockenspiel: !hasPromptWord(text, [horror, dark]), supportingPiano: true },
    };
  }

  if (hasPromptWord(text, [game, chiptune, '8bit', '8\ube44\ud2b8'])) {
    return {
      styleId: 'gameBgm',
      genre: 'dance',
      mood: 'bright',
      theme: 'gameBgm',
      bpm: 118,
      density: 0.8,
      progressions: [['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'G'], ['A', 'G', 'F', 'G']],
      instruments: { drums: true, bass: true, glockenspiel: true, piccolo: true, supportingPiano: true },
    };
  }

  return {};
}

function getReadablePromptStyleProfile(text: string): PromptStyleProfile {
  const has = (keywords: readonly string[]) => keywords.some((keyword) => text.includes(keyword));
  const hasAll = (keywords: readonly string[]) => keywords.every((keyword) => text.includes(keyword));

  const words = {
    piano: '\ud53c\uc544\ub178',
    pianoSong: '\ud53c\uc544\ub178\uace1',
    youtube: '\uc720\ud29c\ube0c',
    flower: '\ud50c\ub77c\uc6cc',
    emotional: '\uac10\uc131',
    lyrical: '\uc11c\uc815',
    calm: '\uc794\uc794',
    quiet: '\uc870\uc6a9',
    dreamy: '\ubabd\ud658',
    mystic: '\uc2e0\ube44',
    cityPop: '\uc2dc\ud2f0\ud31d',
    dreamPop: '\ub4dc\ub9bc\ud31d',
    lofi: '\ub85c\ud30c\uc774',
    jazz: '\uc7ac\uc988',
    bossa: '\ubcf4\uc0ac\ub178\ubc14',
    ballad: '\ubc1c\ub77c\ub4dc',
    acoustic: '\uc5b4\ucfe0\uc2a4\ud2f1',
    ambient: '\uc570\ube44\uc5b8\ud2b8',
    synthPop: '\uc2e0\uc2a4\ud31d',
    synthwave: '\uc2e0\uc2a4\uc6e8\uc774\ube0c',
    disco: '\ub514\uc2a4\ucf54',
    funk: '\ud391\ud06c',
    edm: 'edm',
    spring: '\ubd04',
    cherry: '\ubc9a\uaf43',
    summer: '\uc5ec\ub984',
    autumn: '\uac00\uc744',
    winter: '\uaca8\uc6b8',
    christmas: '\ud06c\ub9ac\uc2a4\ub9c8\uc2a4',
    carol: '\uce90\ub7f4',
    night: '\ubc24',
    dawn: '\uc0c8\ubcbd',
    neon: '\ub124\uc628',
    city: '\ub3c4\uc2dc',
    drive: '\ub4dc\ub77c\uc774\ube0c',
    rain: '\ube44',
    cafe: '\uce74\ud398',
    sea: '\ubc14\ub2e4',
    beach: '\ud574\ubcc0',
    warm: '\ub530\ub73b',
    cozy: '\ud3ec\uadfc',
    bright: '\ubc1d\uc740',
    fresh: '\uccad\ub7c9',
    exciting: '\uc2e0\ub098',
    sad: '\uc2ac\ud508',
    lonely: '\uc4f8\uc4f8',
    gloomy: '\uc6b0\uc6b8',
    faint: '\uc544\ub828',
    cold: '\ucc28\uac00\uc6b4',
    dark: '\uc5b4\ub450',
    horror: '\ubb34\uc11c',
    grand: '\uc6c5\uc7a5',
  };

  const hasCanonRequest = has(['canon', 'pachelbel', '\uce90\ub17c', '\ucf00\ub17c', '\ud30c\ud5ec\ubca8']);
  const soloPianoIntent =
    hasCanonRequest ||
    has([words.pianoSong, words.youtube, words.flower, 'flower dance', 'new age', '\ub274\uc5d0\uc774\uc9c0', 'ost', 'reminiscence', 'talesweaver', 'tales weaver', 'canon', 'pachelbel', '캐논', '케논', '파헬벨', '테일즈위버', '레미니센스']) ||
    (has([words.piano]) && has([words.calm, words.lyrical, words.emotional, words.quiet]) && !has(['\ub4dc\ub7fc', '\ubca0\uc774\uc2a4', '\uae30\ud0c0', 'drum', 'bass', 'guitar', words.cityPop]));

  if (soloPianoIntent) {
    const canonPiano = hasCanonRequest;
    const rpgOstPiano = has(['reminiscence', 'talesweaver', 'tales weaver', 'ost', '\ud14c\uc77c\uc988\uc704\ubc84', '\ub808\ubbf8\ub2c8\uc13c\uc2a4']);
    const sadPiano = has([words.sad, words.lonely, words.gloomy, words.faint, words.autumn, words.winter]);
    const dreamPiano = has([words.dreamy, words.mystic, words.night, words.dawn, words.rain]);
    const quietPiano = has([words.quiet]);
    const emotionalPiano = has([words.emotional, words.lyrical]);
    const calmPiano = has([words.calm]) && !emotionalPiano && !quietPiano;
    const brightPiano = has([words.spring, words.cherry, words.bright, words.fresh]);
    return {
      styleId: canonPiano ? 'calmPianoCanon' : rpgOstPiano ? 'calmPianoRpgOst' : quietPiano ? 'calmPianoQuiet' : emotionalPiano ? 'calmPianoEmotional' : calmPiano ? 'calmPianoCalm' : sadPiano ? 'calmPianoSad' : dreamPiano ? 'calmPianoNight' : brightPiano ? 'calmPianoBright' : 'calmPianoLyrical',
      genre: 'default',
      mood: canonPiano ? 'warm' : rpgOstPiano ? 'dreamy' : sadPiano ? 'sad' : dreamPiano ? 'dreamy' : brightPiano ? 'bright' : 'calm',
      theme: rpgOstPiano ? 'cinematic' : has([words.winter]) ? 'winter' : has([words.rain]) ? 'rainyNight' : has([words.night, words.dawn]) ? 'night' : 'calm',
      bpm: canonPiano ? 84 : rpgOstPiano ? 78 : quietPiano ? 68 : emotionalPiano ? 74 : calmPiano ? 72 : sadPiano ? 68 : dreamPiano ? 76 : brightPiano ? 86 : 82,
      density: canonPiano ? 0.82 : rpgOstPiano ? 0.74 : quietPiano ? 0.48 : emotionalPiano ? 0.76 : calmPiano ? 0.62 : sadPiano ? 0.62 : dreamPiano ? 0.68 : brightPiano ? 0.74 : 0.7,
      progressions: canonPiano
        ? [['C', 'G', 'A', 'E'], ['F', 'C', 'F', 'G'], ['C', 'G', 'A', 'E']]
        : rpgOstPiano
          ? [['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'A'], ['C', 'G', 'A', 'F'], ['F', 'G', 'E', 'A']]
        : quietPiano
        ? [['C', 'F', 'C', 'G'], ['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'C']]
        : emotionalPiano
        ? [['A', 'F', 'C', 'G'], ['F', 'G', 'E', 'A'], ['F', 'C', 'G', 'A'], ['D', 'G', 'C', 'A']]
        : calmPiano
        ? [['C', 'F', 'C', 'G'], ['F', 'C', 'G', 'C'], ['C', 'G', 'A', 'F']]
        : sadPiano
        ? [['A', 'F', 'C', 'G'], ['F', 'G', 'E', 'A'], ['A', 'G', 'F', 'C']]
        : dreamPiano
          ? [['A', 'G', 'F', 'C'], ['F', 'C', 'A', 'G'], ['C', 'G', 'A', 'F']]
          : [['C', 'G', 'A', 'F'], ['F', 'C', 'G', 'A'], ['A', 'F', 'C', 'G']],
      instruments: { drums: false, bass: false, guitar: false, violin: false, saxophone: false, glockenspiel: false, piccolo: false, supportingPiano: true, chicagoStreet: false, studioAltoSax: false },
    };
  }

  if (hasAll([words.summer, words.cityPop]) || hasAll([words.night, words.cityPop]) || hasAll([words.neon, words.cityPop])) {
    const dreamyNight = has([words.dreamy, words.dreamPop, words.night, words.neon, words.dawn]);
    return {
      styleId: dreamyNight ? 'summerNightCityPop' : 'summerCityPop',
      genre: 'citypop',
      mood: dreamyNight ? 'dreamy' : 'bright',
      theme: has([words.summer, '\uc5ec\ub984\ubc24']) ? (dreamyNight ? 'summerNight' : 'summerSea') : 'night',
      bpm: dreamyNight ? 96 : 112,
      density: dreamyNight ? 0.62 : 0.76,
      swing: true,
      progressions: dreamyNight
        ? [['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'E'], ['C', 'G', 'E', 'A']]
        : [['F', 'G', 'E', 'A'], ['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'G']],
      instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, studioAltoSax: true, glockenspiel: false, chicagoStreet: false },
    };
  }

  if (has([words.christmas, words.carol])) {
    const jazzy = has([words.jazz, words.bossa]);
    return {
      styleId: jazzy ? 'christmasJazz' : 'carolPop',
      genre: jazzy ? 'jazz' : 'default',
      mood: jazzy ? 'warm' : 'bright',
      theme: 'christmas',
      bpm: jazzy ? 98 : 112,
      density: jazzy ? 0.62 : 0.72,
      swing: jazzy,
      progressions: jazzy
        ? [['C', 'F', 'D', 'G'], ['F', 'C', 'D', 'G'], ['C', 'G', 'C', 'F']]
        : [['C', 'G', 'F', 'G'], ['C', 'F', 'C', 'G'], ['F', 'G', 'C', 'G']],
      instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, glockenspiel: true, studioAltoSax: jazzy },
    };
  }

  if (has([words.dreamPop, words.dreamy, words.mystic]) && !has([words.cityPop])) {
    return {
      styleId: has([words.mystic]) ? 'mysticFeeling' : 'dreamyFeeling',
      genre: has([words.dreamPop]) ? 'lofi' : 'default',
      mood: 'dreamy',
      theme: has([words.night, words.dawn, words.neon]) ? 'night' : has([words.winter, words.cold]) ? 'winter' : 'calm',
      bpm: 78,
      density: has([words.mystic]) ? 0.34 : 0.46,
      progressions: [['A', 'F', 'C', 'G'], ['F', 'C', 'A', 'G'], ['A', 'G', 'F', 'C']],
      instruments: { drums: false, bass: true, guitar: false, violin: true, glockenspiel: true, supportingPiano: true, chicagoStreet: false, studioAltoSax: false },
    };
  }

  if (has([words.sad, words.lonely, words.gloomy, words.faint, words.ballad]) && !has([words.bright, words.exciting])) {
    return {
      styleId: has([words.winter]) ? 'lonelyWinterBallad' : 'lonelyBallad',
      genre: 'ballad',
      mood: 'sad',
      theme: has([words.rain, words.cafe]) ? 'rainyNight' : has([words.winter]) ? 'winter' : 'breakup',
      bpm: 72,
      density: 0.42,
      progressions: [['A', 'F', 'C', 'G'], ['A', 'G', 'F', 'C'], ['F', 'C', 'G', 'A']],
      instruments: { drums: false, bass: true, guitar: has([words.acoustic]), violin: true, supportingPiano: true, glockenspiel: false, studioAltoSax: false },
    };
  }

  if (has([words.calm, words.quiet, words.ambient]) && !has([words.bright, words.exciting, words.cityPop])) {
    const quietSong = has([words.quiet]);
    const pureCalmSong = has([words.calm, words.quiet]) && !has([words.ambient, words.rain, words.jazz, words.bossa, words.lofi]);
    return {
      styleId: has([words.ambient]) ? 'frozenForestAmbient' : quietSong ? 'calmPianoQuiet' : pureCalmSong ? 'calmPianoCalm' : 'comfortableFeeling',
      genre: 'default',
      mood: 'calm',
      theme: has([words.rain]) ? 'rainyNight' : 'calm',
      bpm: has([words.ambient]) ? 66 : quietSong ? 68 : pureCalmSong ? 76 : 74,
      density: has([words.ambient]) ? 0.24 : quietSong ? 0.48 : pureCalmSong ? 0.62 : 0.34,
      progressions: quietSong
        ? [['C', 'F', 'C', 'G'], ['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'C']]
        : pureCalmSong
        ? [['C', 'F', 'C', 'G'], ['F', 'C', 'G', 'C'], ['C', 'G', 'A', 'F']]
        : [['C', 'F', 'C', 'G'], ['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'C']],
      instruments: {
        drums: false,
        bass: false,
        guitar: pureCalmSong ? false : has([words.acoustic, words.warm, words.cozy]),
        violin: has([words.ambient]),
        supportingPiano: true,
        glockenspiel: has([words.mystic]),
        piccolo: false,
        chicagoStreet: false,
        studioAltoSax: false,
      },
    };
  }

  if (has([words.jazz, words.bossa])) {
    return {
      styleId: has([words.bossa]) ? 'resortBossa' : 'warmJazz',
      genre: 'jazz',
      mood: 'warm',
      theme: has([words.summer, words.sea, words.beach]) ? 'summerSea' : 'default',
      bpm: has([words.bossa]) ? 94 : 88,
      density: 0.56,
      swing: true,
      progressions: [['D', 'G', 'C', 'A'], ['F', 'E', 'A', 'D'], ['C', 'F', 'D', 'G']],
      instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, studioAltoSax: true },
    };
  }

  if (has([words.edm, words.disco, words.funk])) {
    return {
      styleId: has([words.disco, words.funk]) ? 'funkDiscoParty' : 'summerFestivalEdm',
      genre: 'dance',
      mood: 'energetic',
      theme: has([words.summer, words.sea, words.beach]) ? 'summerSea' : 'default',
      bpm: has([words.disco, words.funk]) ? 122 : 126,
      density: 0.88,
      progressions: [['A', 'F', 'C', 'G'], ['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'G']],
      instruments: { drums: true, bass: true, guitar: has([words.funk, words.disco]), supportingPiano: true, chicagoStreet: true, glockenspiel: true },
    };
  }

  if (has([words.emotional])) {
    return {
      styleId: 'emotionalPop',
      genre: 'ballad',
      mood: has([words.sad, words.lonely, words.faint]) ? 'sad' : 'warm',
      theme: has([words.night]) ? 'night' : has([words.winter]) ? 'winter' : 'default',
      bpm: 82,
      density: 0.5,
      progressions: [['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'A'], ['C', 'G', 'A', 'F']],
      instruments: { drums: false, bass: true, guitar: true, violin: true, supportingPiano: true },
    };
  }

  return {};
}

function getPromptEmotionOverride(text: string): PromptStyleProfile {
  if (includesAny(text, ['무서운', '공포', '호러', '불안', '긴장', '섬뜩', '어두운', '다크'])) {
    return {
      genre: 'default',
      mood: 'sad',
      theme: 'cinematic',
      bpm: 76,
      density: 0.34,
      instruments: { drums: false, bass: false, guitar: false, glockenspiel: false, piccolo: false, violin: true, supportingPiano: true },
    };
  }

  if (includesAny(text, ['슬픈', '쓸쓸한', '우울한', '외로운', '아련한', '공허한', '그리운', '이별', '눈물'])) {
    return {
      genre: 'ballad',
      mood: 'sad',
      theme: 'breakup',
      bpm: 72,
      density: 0.36,
      instruments: { drums: false, bass: true, guitar: false, violin: true, saxophone: false, glockenspiel: false, piccolo: false, supportingPiano: true },
    };
  }

  if (includesAny(text, ['몽환', '꿈속', '신비로운', '흐릿한', '공간감', '안개', '우주', '환상'])) {
    return {
      genre: 'lofi',
      mood: 'dreamy',
      theme: includesAny(text, ['밤', '야경', '네온']) ? 'night' : 'calm',
      bpm: 82,
      density: 0.38,
      instruments: { drums: false, bass: true, guitar: false, violin: true, glockenspiel: true, piccolo: false, supportingPiano: true },
    };
  }

  if (includesAny(text, ['잔잔', '차분', '편안', '조용', '고요', '평화로운', '휴식', '힐링'])) {
    return {
      genre: 'default',
      mood: 'calm',
      theme: 'calm',
      bpm: 74,
      density: 0.32,
      instruments: { drums: false, bass: false, guitar: false, violin: false, saxophone: false, glockenspiel: false, piccolo: false, supportingPiano: true },
    };
  }

  if (includesAny(text, ['차가운', '얼어붙은', '겨울 새벽', '눈 오는 밤', '눈 내리는 밤'])) {
    return {
      genre: 'lofi',
      mood: 'dreamy',
      theme: 'winter',
      bpm: 78,
      density: 0.38,
      instruments: { drums: false, bass: true, guitar: false, violin: true, glockenspiel: true, piccolo: false, supportingPiano: true },
    };
  }

  return {};
}

function getHybridPromptBlendProfile(text: string): PromptStyleProfile {
  const has = (keywords: readonly string[]) => hasPromptWord(text, keywords);
  const hasAll = (keywords: readonly string[]) => hasPromptWords(text, keywords);

  const words = {
    winter: '\uaca8\uc6b8',
    spring: '\ubd04',
    summer: '\uc5ec\ub984',
    autumn: '\uac00\uc744',
    night: '\ubc24',
    dawn: '\uc0c8\ubcbd',
    city: '\ub3c4\uc2dc',
    neon: '\ub124\uc628',
    drive: '\ub4dc\ub77c\uc774\ube0c',
    rain: '\ube44',
    cafe: '\uce74\ud398',
    sea: '\ubc14\ub2e4',
    beach: '\ud574\ubcc0',
    christmas: '\ud06c\ub9ac\uc2a4\ub9c8\uc2a4',
    carol: '\uce90\ub7f4',
    cityPop: '\uc2dc\ud2f0\ud31d',
    lofi: '\ub85c\ud30c\uc774',
    jazz: '\uc7ac\uc988',
    bossa: '\ubcf4\uc0ac\ub178\ubc14',
    ballad: '\ubc1c\ub77c\ub4dc',
    acoustic: '\uc5b4\ucfe0\uc2a4\ud2f1',
    synth: '\uc2e0\uc2a4',
    disco: '\ub514\uc2a4\ucf54',
    funk: '\ud391\ud06c',
    ambient: '\uc570\ube44\uc5b8\ud2b8',
    dreamy: '\ubabd\ud658',
    mystic: '\uc2e0\ube44',
    calm: '\uc794\uc794',
    quiet: '\uc870\uc6a9',
    warm: '\ub530\ub73b',
    cozy: '\ud3ec\uadfc',
    bright: '\ubc1d\uc740',
    fresh: '\uccad\ub7c9',
    happy: '\ud589\ubcf5',
    exciting: '\uc2e0\ub098',
    hope: '\ud76c\ub9dd',
    sad: '\uc2ac\ud508',
    lonely: '\uc4f8\uc4f8',
    gloomy: '\uc6b0\uc6b8',
    faint: '\uc544\ub828',
    empty: '\uacf5\ud5c8',
    cold: '\ucc28\uac00\uc6b4',
    dark: '\uc5b4\ub450',
    tense: '\uae34\uc7a5',
    scary: '\ubb34\uc11c',
    grand: '\uc6c5\uc7a5',
  };

  const genre: Genre | undefined =
    has([words.cityPop, 'citypop', 'city pop']) ? 'citypop' :
    has([words.lofi, 'lofi', 'lo-fi']) ? 'lofi' :
    has([words.jazz, words.bossa, '\ub77c\uc6b4\uc9c0', 'jazz', 'bossa']) ? 'jazz' :
    has([words.disco, words.funk, 'edm', '\ub304\uc2a4', '\ud558\uc6b0\uc2a4']) ? 'dance' :
    has([words.ballad]) ? 'ballad' :
    has([words.synth]) ? 'citypop' :
    has([words.acoustic]) ? 'ballad' :
    has([words.ambient]) ? 'default' :
    undefined;

  const mood: Mood | undefined =
    has([words.scary, words.dark, words.tense]) ? 'sad' :
    has([words.sad, words.lonely, words.gloomy, words.faint, words.empty, '\uc678\ub85c', '\uadf8\ub9ac\uc6b4']) ? 'sad' :
    has([words.dreamy, words.mystic, '\uafc8', '\ud76c\ubbf8']) ? 'dreamy' :
    has([words.calm, words.quiet, '\ud3b8\uc548', '\ud3c9\ud654', '\uace0\uc694']) ? 'calm' :
    has([words.exciting, words.hope, words.grand, 'edm', '\ub304\uc2a4']) ? 'energetic' :
    has([words.warm, words.cozy]) ? 'warm' :
    has([words.bright, words.fresh, words.happy]) ? 'bright' :
    undefined;

  const theme: Theme | undefined =
    has([words.christmas, words.carol, 'xmas']) ? 'christmas' :
    hasAll([words.summer, words.night]) || has(['\uc5ec\ub984\ubc24']) ? 'summerNight' :
    has([words.sea, words.beach]) || has([words.summer]) ? 'summerSea' :
    has([words.winter, words.cold, '\ub208', '\uccab\ub208']) ? 'winter' :
    has([words.spring, '\ubc9a\uaf43', '\uccab\uc0ac\ub791']) ? 'spring' :
    has([words.rain]) ? 'rainyNight' :
    has([words.cafe]) ? 'cafeLofi' :
    has([words.night, words.dawn, words.neon, words.city, words.drive]) ? 'night' :
    has([words.ambient]) ? 'calm' :
    undefined;

  const dimensionCount = [genre, mood, theme].filter(Boolean).length;
  if (dimensionCount < 2) return {};

  const isSad = mood === 'sad';
  const isCalm = mood === 'calm';
  const isDreamy = mood === 'dreamy';
  const isEnergetic = mood === 'energetic';
  const isBright = mood === 'bright';
  const selectedGenre = genre ?? (isSad ? 'ballad' : isCalm || isDreamy ? 'lofi' : 'default');
  const selectedTheme = theme ?? (selectedGenre === 'citypop' ? 'night' : isCalm ? 'calm' : 'default');
  const selectedMood = mood ?? (selectedTheme === 'winter' || selectedTheme === 'night' ? 'dreamy' : selectedTheme === 'summerSea' || selectedTheme === 'spring' ? 'bright' : 'warm');
  const hasCity = selectedGenre === 'citypop' || has([words.city, words.neon, words.drive]);
  const hasSoft = isSad || isCalm || isDreamy;
  const hasJazzColor = selectedGenre === 'jazz';
  const hasSeasonColor = selectedTheme === 'winter' || selectedTheme === 'spring' || selectedTheme === 'summerSea' || selectedTheme === 'summerNight';

  let bpm =
    selectedGenre === 'dance' ? 124 :
    selectedGenre === 'citypop' ? 104 :
    selectedGenre === 'jazz' ? 90 :
    selectedGenre === 'lofi' ? 82 :
    selectedGenre === 'ballad' ? 74 :
    92;
  if (isSad) bpm -= hasCity ? 10 : 4;
  if (isCalm) bpm -= hasCity ? 12 : 8;
  if (isDreamy) bpm -= 6;
  if (selectedTheme === 'summerSea' && (isBright || isEnergetic)) bpm += 8;
  if (selectedTheme === 'winter' || selectedTheme === 'rainyNight') bpm -= 4;
  bpm = Math.max(62, Math.min(132, bpm));

  let density =
    selectedGenre === 'dance' || isEnergetic ? 0.82 :
    selectedGenre === 'citypop' ? 0.62 :
    selectedGenre === 'jazz' ? 0.52 :
    selectedGenre === 'lofi' ? 0.42 :
    selectedGenre === 'ballad' ? 0.36 :
    0.48;
  if (isSad) density -= 0.12;
  if (isCalm) density -= 0.16;
  if (isDreamy) density -= 0.08;
  if (isBright && selectedTheme === 'summerSea') density += 0.12;
  density = Math.max(0.22, Math.min(0.86, density));

  const progressions: ChordName[][] =
    selectedTheme === 'christmas'
      ? [['C', 'F', 'G', 'C'], ['C', 'G', 'C', 'F'], ['F', 'G', 'C', 'C']]
      : isSad && hasCity
        ? [['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'E'], ['A', 'G', 'F', 'C']]
        : isSad
          ? [['A', 'F', 'C', 'G'], ['A', 'G', 'F', 'C'], ['F', 'C', 'G', 'A']]
          : isCalm
            ? [['C', 'F', 'C', 'G'], ['A', 'F', 'C', 'G'], ['F', 'C', 'F', 'G']]
            : isDreamy || hasCity
              ? [['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'E'], ['C', 'G', 'E', 'A'], ['A', 'F', 'C', 'G']]
              : hasJazzColor
                ? [['D', 'G', 'C', 'A'], ['F', 'E', 'A', 'D'], ['C', 'F', 'D', 'G']]
                : [['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'G'], ['A', 'F', 'C', 'G']];

  const styleParts = [
    selectedMood,
    selectedTheme,
    selectedGenre,
    has([words.rain]) ? 'rain' : '',
    has([words.neon]) ? 'neon' : '',
    has([words.cafe]) ? 'cafe' : '',
  ].filter(Boolean);
  const hybridStyleId =
    selectedGenre === 'citypop' && selectedTheme === 'summerNight'
      ? 'summerNightCityPop'
      : selectedGenre === 'citypop' && selectedTheme === 'summerSea'
        ? 'summerCityPop'
        : selectedGenre === 'citypop' && selectedTheme === 'winter'
          ? 'winterCityPop'
          : `hybrid-${styleParts.join('-')}`;

  return {
    styleId: hybridStyleId,
    genre: selectedGenre,
    mood: selectedMood,
    theme: selectedTheme,
    bpm,
    density,
    swing: selectedGenre === 'jazz' || selectedGenre === 'lofi' || selectedGenre === 'citypop',
    progressions,
    instruments: {
      drums: !hasSoft && (selectedGenre === 'dance' || selectedGenre === 'citypop' || selectedTheme === 'summerSea' || selectedTheme === 'spring'),
      bass: !isCalm && !has([words.empty]) && (selectedGenre !== 'default' || selectedTheme !== 'calm'),
      guitar: selectedGenre === 'citypop' || has([words.acoustic]) || (selectedTheme === 'spring' && !isSad),
      violin: isSad || isDreamy || selectedTheme === 'winter',
      saxophone: hasJazzColor,
      glockenspiel: selectedTheme === 'christmas' || (hasSeasonColor && !isSad && !isCalm) || has([words.mystic]),
      piccolo: selectedTheme === 'spring' && !hasSoft,
      supportingPiano: true,
      chicagoStreet: selectedGenre === 'dance' && !hasSoft,
      studioAltoSax: hasCity || hasJazzColor,
    },
  };
}

function getPromptStyleProfile(text: string): PromptStyleProfile {
  let profile: PromptStyleProfile = {};
  const apply = (keywords: string[], next: PromptStyleProfile) => {
    if (includesAny(text, keywords)) {
      profile = mergeProfile(profile, next);
    }
  };

  apply(['벚꽃 감성'], { styleId: 'cherryBlossomMood', genre: 'default', mood: 'bright', theme: 'spring', bpm: 96, density: 0.54, progressions: [['C', 'G', 'A', 'F'], ['F', 'C', 'G', 'C']], instruments: { drums: false, bass: true, guitar: true, glockenspiel: true, supportingPiano: true } });
  apply(['따뜻한 햇살'], { styleId: 'warmSunshine', genre: 'default', mood: 'warm', theme: 'spring', bpm: 94, density: 0.48, progressions: [['C', 'F', 'G', 'C'], ['F', 'C', 'G', 'C']], instruments: { drums: false, bass: true, guitar: true, supportingPiano: true } });
  apply(['설레는 첫사랑'], { styleId: 'firstLoveFlutter', genre: 'default', mood: 'bright', theme: 'spring', bpm: 104, density: 0.62, progressions: [['C', 'G', 'F', 'G'], ['F', 'G', 'C', 'A']], instruments: { drums: true, bass: true, guitar: true, glockenspiel: true, supportingPiano: true } });
  apply(['산뜻한 어쿠스틱'], { styleId: 'freshAcoustic', genre: 'ballad', mood: 'bright', theme: 'spring', bpm: 98, density: 0.5, progressions: [['C', 'G', 'F', 'C'], ['F', 'C', 'G', 'C']], instruments: { drums: false, bass: true, guitar: true, supportingPiano: true } });
  apply(['밝은 인디팝'], { styleId: 'brightIndiePop', genre: 'default', mood: 'bright', theme: 'spring', bpm: 112, density: 0.68, progressions: [['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'G']], instruments: { drums: true, bass: true, guitar: true, glockenspiel: true } });
  apply(['피크닉 음악'], { styleId: 'picnicMusic', genre: 'default', mood: 'bright', theme: 'spring', bpm: 100, density: 0.56, progressions: [['C', 'F', 'G', 'C'], ['G', 'C', 'F', 'G']], instruments: { drums: true, bass: true, guitar: true, glockenspiel: true } });
  apply(['새 학기 청춘 음악'], { styleId: 'newSemesterYouth', genre: 'default', mood: 'energetic', theme: 'spring', bpm: 116, density: 0.72, progressions: [['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'A']], instruments: { drums: true, bass: true, guitar: true, supportingPiano: true } });
  apply(['봄비 로파이'], { styleId: 'springRainLofi', genre: 'lofi', mood: 'calm', theme: 'rainyNight', bpm: 82, density: 0.38, swing: true, progressions: [['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'A']], instruments: { drums: true, bass: true, supportingPiano: true, glockenspiel: false } });

  apply(['청량한 시티팝'], { styleId: 'refreshingCityPop', genre: 'citypop', mood: 'bright', theme: 'summerSea', bpm: 112, density: 0.7, progressions: [['F', 'G', 'E', 'A'], ['C', 'G', 'A', 'F']], instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, studioAltoSax: true } });
  apply(['해변 드라이브'], { styleId: 'beachDrive', genre: 'citypop', mood: 'bright', theme: 'summerSea', bpm: 116, density: 0.74, progressions: [['C', 'G', 'F', 'G'], ['F', 'G', 'C', 'G']], instruments: { drums: true, bass: true, guitar: true, glockenspiel: true } });
  apply(['트로피컬 하우스'], { styleId: 'tropicalHouse', genre: 'dance', mood: 'bright', theme: 'summerSea', bpm: 124, density: 0.82, progressions: [['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'G']], instruments: { drums: true, bass: true, glockenspiel: true, supportingPiano: true, chicagoStreet: true } });
  apply(['여름밤 감성'], { styleId: 'summerNightMood', genre: 'citypop', mood: 'dreamy', theme: 'summerNight', bpm: 98, density: 0.54, progressions: [['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'E']], instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, studioAltoSax: true } });
  apply(['휴양지 보사노바'], { styleId: 'resortBossa', genre: 'jazz', mood: 'warm', theme: 'summerSea', bpm: 94, density: 0.5, swing: true, progressions: [['D', 'G', 'C', 'A'], ['F', 'E', 'A', 'D']], instruments: { drums: true, bass: true, guitar: true, studioAltoSax: true, supportingPiano: true } });
  apply(['신나는 펑크', '신나는 펑크·디스코', '펑크·디스코'], { styleId: 'funkDiscoParty', genre: 'dance', mood: 'energetic', theme: 'summerSea', bpm: 122, density: 0.86, progressions: [['A', 'F', 'C', 'G'], ['C', 'G', 'A', 'F']], instruments: { drums: true, bass: true, guitar: true, chicagoStreet: true, studioAltoSax: true } });
  apply(['바다 인디팝'], { styleId: 'seaIndiePop', genre: 'default', mood: 'bright', theme: 'summerSea', bpm: 108, density: 0.64, progressions: [['C', 'G', 'F', 'C'], ['F', 'G', 'C', 'A']], instruments: { drums: true, bass: true, guitar: true, glockenspiel: true } });
  apply(['여름 축제 EDM'], { styleId: 'summerFestivalEdm', genre: 'dance', mood: 'energetic', theme: 'summerSea', bpm: 128, density: 0.9, progressions: [['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'G']], instruments: { drums: true, bass: true, supportingPiano: true, glockenspiel: true, chicagoStreet: true } });
  apply(['장마 로파이'], { styleId: 'monsoonLofi', genre: 'lofi', mood: 'calm', theme: 'rainyNight', bpm: 80, density: 0.36, swing: true, progressions: [['A', 'F', 'C', 'G'], ['F', 'E', 'A', 'G']], instruments: { drums: true, bass: true, supportingPiano: true } });

  apply(['쓸쓸한 발라드'], { styleId: 'lonelyBallad', genre: 'ballad', mood: 'sad', theme: 'breakup', bpm: 72, density: 0.34, progressions: [['A', 'F', 'C', 'G'], ['A', 'G', 'F', 'C']], instruments: { drums: false, bass: true, violin: true, supportingPiano: true } });
  apply(['낙엽 감성'], { styleId: 'fallenLeavesMood', genre: 'ballad', mood: 'sad', theme: 'breakup', bpm: 78, density: 0.4, progressions: [['F', 'C', 'G', 'A'], ['A', 'F', 'C', 'G']], instruments: { drums: false, bass: true, guitar: true, violin: true, supportingPiano: true } });
  apply(['어쿠스틱 기타'], { styleId: 'acousticGuitar', genre: 'ballad', mood: 'warm', theme: 'default', bpm: 84, density: 0.42, progressions: [['C', 'G', 'F', 'C'], ['A', 'F', 'C', 'G']], instruments: { drums: false, bass: true, guitar: true, supportingPiano: false } });
  apply(['따뜻한 재즈'], { styleId: 'warmJazz', genre: 'jazz', mood: 'warm', theme: 'default', bpm: 88, density: 0.5, swing: true, progressions: [['D', 'G', 'C', 'A'], ['F', 'E', 'A', 'D']], instruments: { drums: true, bass: true, guitar: true, saxophone: true, supportingPiano: true } });
  apply(['추억과 회상'], { styleId: 'memoryRecall', genre: 'ballad', mood: 'sad', theme: 'breakup', bpm: 76, density: 0.38, progressions: [['F', 'G', 'E', 'A'], ['C', 'G', 'A', 'F']], instruments: { drums: false, bass: true, guitar: true, violin: true, supportingPiano: true } });
  apply(['늦가을 드라이브'], { styleId: 'lateAutumnDrive', genre: 'citypop', mood: 'sad', theme: 'night', bpm: 94, density: 0.52, progressions: [['A', 'F', 'G', 'E'], ['F', 'C', 'G', 'A']], instruments: { drums: true, bass: true, guitar: true, supportingPiano: true } });
  apply(['비 오는 카페'], { styleId: 'rainCafe', genre: 'lofi', mood: 'calm', theme: 'rainyNight', bpm: 82, density: 0.38, swing: true, progressions: [['A', 'F', 'C', 'G'], ['F', 'E', 'A', 'G']], instruments: { drums: true, bass: true, guitar: false, supportingPiano: true, studioAltoSax: true } });
  apply(['잔잔한 피아노'], { styleId: 'calmPiano', genre: 'default', mood: 'calm', theme: 'calm', bpm: 72, density: 0.52, progressions: [['C', 'F', 'C', 'G'], ['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'C']], instruments: { drums: false, bass: false, guitar: false, violin: false, saxophone: false, supportingPiano: true } });

  apply(['아침'], { styleId: 'morningFresh', mood: 'bright', bpm: 96, density: 0.54, instruments: { guitar: true, drums: false, bass: true } });
  apply(['낮'], { styleId: 'dayBright', mood: 'bright', bpm: 108, density: 0.66, instruments: { drums: true, bass: true, guitar: true } });
  apply(['노을'], { styleId: 'sunsetMood', theme: 'night', mood: 'warm', genre: 'citypop', bpm: 96, density: 0.54, progressions: [['A', 'F', 'G', 'E'], ['F', 'C', 'G', 'A']] });
  apply(['저녁'], { styleId: 'eveningLounge', mood: 'warm', genre: 'jazz', bpm: 90, density: 0.5, swing: true, instruments: { drums: true, bass: true, guitar: true, saxophone: true, supportingPiano: true } });
  apply(['밤'], { styleId: 'nightCity', theme: 'night', mood: 'dreamy', genre: 'citypop', bpm: 98, density: 0.56, progressions: [['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'E']] });
  apply(['심야'], { styleId: 'midnightLofi', theme: 'cafeLofi', mood: 'calm', genre: 'lofi', bpm: 76, density: 0.34, swing: true });
  apply(['새벽'], { styleId: 'dawnAmbient', theme: 'calm', mood: 'calm', genre: 'default', bpm: 68, density: 0.26, instruments: { drums: false, bass: false, supportingPiano: true, violin: true } });

  apply(['네온빛 도시'], { styleId: 'neonCity', genre: 'citypop', mood: 'dreamy', theme: 'night', bpm: 108, density: 0.64, instruments: { drums: true, bass: true, supportingPiano: true, chicagoStreet: true } });
  apply(['야간 드라이브'], { styleId: 'nightDrive', genre: 'citypop', mood: 'dreamy', theme: 'night', bpm: 104, density: 0.6, instruments: { drums: true, bass: true, guitar: true, supportingPiano: true } });
  apply(['눈 오는 거리'], { styleId: 'snowStreet', genre: 'lofi', mood: 'dreamy', theme: 'winter', bpm: 80, density: 0.38, instruments: { drums: false, bass: true, violin: true, supportingPiano: true, glockenspiel: true } });
  apply(['조용한 도서관'], { styleId: 'quietLibrary', genre: 'default', mood: 'calm', theme: 'study', bpm: 68, density: 0.22, instruments: { drums: false, bass: false, supportingPiano: true } });
  apply(['따뜻한 방'], { styleId: 'warmRoom', genre: 'ballad', mood: 'warm', bpm: 78, density: 0.34, instruments: { drums: false, bass: false, guitar: true, supportingPiano: true } });
  apply(['크리스마스 거리'], { styleId: 'christmasStreet', genre: 'default', mood: 'bright', theme: 'christmas', bpm: 110, density: 0.66, instruments: { drums: true, bass: true, guitar: true, glockenspiel: true, supportingPiano: true } });
  apply(['겨울 기차역'], { styleId: 'winterStation', genre: 'lofi', mood: 'sad', theme: 'winter', bpm: 76, density: 0.34, instruments: { drums: false, bass: true, violin: true, supportingPiano: true } });
  apply(['한적한 골목'], { styleId: 'quietAlley', genre: 'lofi', mood: 'calm', theme: 'night', bpm: 78, density: 0.32, instruments: { drums: false, bass: true, supportingPiano: true } });
  apply(['옥상에서 보는 야경'], { styleId: 'rooftopNightView', genre: 'citypop', mood: 'dreamy', theme: 'night', bpm: 96, density: 0.5, instruments: { drums: true, bass: true, supportingPiano: true, studioAltoSax: true } });
  apply(['바닷가'], { styleId: 'seaside', genre: 'default', mood: 'bright', theme: 'summerSea', bpm: 104, density: 0.58, instruments: { drums: true, bass: true, guitar: true, glockenspiel: true } });
  apply(['휴양지'], { styleId: 'resort', genre: 'jazz', mood: 'warm', theme: 'summerSea', bpm: 94, density: 0.5, swing: true, instruments: { drums: true, bass: true, guitar: true, studioAltoSax: true } });
  apply(['숲속 오두막'], { styleId: 'forestCabin', genre: 'default', mood: 'calm', theme: 'calm', bpm: 72, density: 0.3, instruments: { drums: false, bass: false, guitar: true, violin: true, supportingPiano: true } });
  apply(['오래된 레코드 가게'], { styleId: 'oldRecordShop', genre: 'lofi', mood: 'warm', theme: 'cafeLofi', bpm: 84, density: 0.44, swing: true, instruments: { drums: true, bass: true, guitar: true, supportingPiano: true } });
  apply(['고급 호텔 라운지'], { styleId: 'hotelLounge', genre: 'jazz', mood: 'warm', bpm: 86, density: 0.48, swing: true, instruments: { drums: true, bass: true, guitar: true, saxophone: true, supportingPiano: true } });
  apply(['놀이공원'], { styleId: 'amusementPark', genre: 'default', mood: 'bright', bpm: 118, density: 0.72, instruments: { drums: true, bass: true, glockenspiel: true, piccolo: true, supportingPiano: true } });
  apply(['우주 정거장'], { styleId: 'spaceStation', genre: 'default', mood: 'dreamy', theme: 'cinematic', bpm: 76, density: 0.3, instruments: { drums: false, bass: false, glockenspiel: true, violin: true, supportingPiano: true } });
  apply(['사이버펑크 도시'], { styleId: 'cyberpunkCity', genre: 'citypop', mood: 'dreamy', theme: 'night', bpm: 118, density: 0.72, instruments: { drums: true, bass: true, chicagoStreet: true, supportingPiano: true } });
  apply(['중세 마을'], { styleId: 'medievalVillage', genre: 'default', mood: 'warm', theme: 'cinematic', bpm: 82, density: 0.38, instruments: { drums: false, bass: false, violin: true, glockenspiel: true, supportingPiano: true } });
  apply(['전쟁터', '보스전'], { styleId: 'battleBoss', genre: 'dance', mood: 'energetic', theme: 'cinematic', bpm: 124, density: 0.78, instruments: { drums: true, bass: true, violin: true, supportingPiano: true } });

  apply(['따뜻한'], { styleId: 'warmFeeling', mood: 'warm', bpm: 86, density: 0.42, progressions: [['C', 'F', 'G', 'C'], ['F', 'C', 'G', 'C']], instruments: { drums: false, bass: true, guitar: true, supportingPiano: true } });
  apply(['포근한'], { styleId: 'cozyFeeling', mood: 'warm', bpm: 78, density: 0.36, progressions: [['C', 'F', 'C', 'G'], ['F', 'C', 'G', 'C']], instruments: { drums: false, bass: false, guitar: true, supportingPiano: true } });
  apply(['청량한'], { styleId: 'refreshingFeeling', mood: 'bright', theme: 'summerSea', bpm: 112, density: 0.66, instruments: { drums: true, bass: true, guitar: true, glockenspiel: true } });
  apply(['설레는'], { styleId: 'flutterFeeling', mood: 'bright', theme: 'spring', bpm: 104, density: 0.6, instruments: { drums: true, bass: true, guitar: true, glockenspiel: true } });
  apply(['사랑스러운'], { styleId: 'lovelyFeeling', mood: 'warm', theme: 'spring', bpm: 96, density: 0.5, instruments: { drums: false, bass: true, guitar: true, glockenspiel: true, supportingPiano: true } });
  apply(['행복한'], { styleId: 'happyFeeling', mood: 'bright', bpm: 112, density: 0.66, instruments: { drums: true, bass: true, guitar: true, glockenspiel: true } });
  apply(['신나는'], { styleId: 'excitingFeeling', genre: 'dance', mood: 'energetic', bpm: 124, density: 0.82, instruments: { drums: true, bass: true, guitar: true, chicagoStreet: true } });
  apply(['희망찬'], { styleId: 'hopefulFeeling', mood: 'energetic', theme: 'cinematic', bpm: 112, density: 0.68, instruments: { drums: true, bass: true, guitar: true, violin: true, supportingPiano: true } });
  apply(['벅차오르는'], { styleId: 'risingFeeling', mood: 'energetic', theme: 'cinematic', bpm: 116, density: 0.72, instruments: { drums: true, bass: true, violin: true, supportingPiano: true } });
  apply(['평화로운'], { styleId: 'peacefulFeeling', mood: 'calm', theme: 'calm', bpm: 72, density: 0.28, instruments: { drums: false, bass: false, supportingPiano: true, violin: true } });
  apply(['편안한'], { styleId: 'comfortableFeeling', mood: 'calm', theme: 'calm', bpm: 76, density: 0.32, instruments: { drums: false, bass: false, guitar: true, supportingPiano: true } });
  apply(['몽환적인', '몽환적', '드림팝', '꿈속 같은'], {
    styleId: 'dreamyFeeling',
    genre: 'lofi',
    mood: 'dreamy',
    theme: 'night',
    bpm: 76,
    density: 0.3,
    progressions: [['A', 'F', 'C', 'G'], ['F', 'C', 'A', 'G'], ['A', 'G', 'F', 'C']],
    instruments: { drums: false, bass: true, guitar: false, violin: true, glockenspiel: false, piccolo: false, supportingPiano: true, chicagoStreet: false, studioAltoSax: false },
  });
  apply(['신비로운', '신비', '미스터리', '마법', '환상적인'], {
    styleId: 'mysticFeeling',
    genre: 'default',
    mood: 'dreamy',
    theme: 'cinematic',
    bpm: 70,
    density: 0.26,
    progressions: [['A', 'F', 'A', 'G'], ['F', 'A', 'G', 'A'], ['A', 'G', 'F', 'C']],
    instruments: { drums: false, bass: false, guitar: false, violin: true, glockenspiel: false, piccolo: false, supportingPiano: true, chicagoStreet: false, studioAltoSax: false },
  });
  apply(['그리운'], { styleId: 'nostalgicFeeling', genre: 'ballad', mood: 'sad', theme: 'breakup', bpm: 76, density: 0.38, instruments: { drums: false, bass: true, guitar: true, violin: true, supportingPiano: true } });
  apply(['복고적인'], { styleId: 'retroFeeling', genre: 'citypop', mood: 'warm', theme: 'night', bpm: 104, density: 0.6, instruments: { drums: true, bass: true, guitar: true, supportingPiano: true } });
  apply(['외로운'], { styleId: 'lonelyFeeling', genre: 'ballad', mood: 'sad', theme: 'breakup', bpm: 70, density: 0.3, instruments: { drums: false, bass: false, violin: true, supportingPiano: true } });
  apply(['쓸쓸한'], { styleId: 'melancholyFeeling', genre: 'ballad', mood: 'sad', theme: 'breakup', bpm: 74, density: 0.34, instruments: { drums: false, bass: true, violin: true, supportingPiano: true } });
  apply(['우울한'], { styleId: 'depressedFeeling', genre: 'ballad', mood: 'sad', theme: 'breakup', bpm: 68, density: 0.28, instruments: { drums: false, bass: false, violin: true, supportingPiano: true } });
  apply(['아련한'], { styleId: 'faintMemoryFeeling', genre: 'ballad', mood: 'sad', theme: 'breakup', bpm: 78, density: 0.36, instruments: { drums: false, bass: true, guitar: true, violin: true, supportingPiano: true } });
  apply(['슬픈'], { styleId: 'sadFeeling', genre: 'ballad', mood: 'sad', theme: 'breakup', bpm: 72, density: 0.34, instruments: { drums: false, bass: true, violin: true, supportingPiano: true } });
  apply(['공허한'], { styleId: 'emptyFeeling', genre: 'default', mood: 'sad', theme: 'calm', bpm: 64, density: 0.22, instruments: { drums: false, bass: false, violin: true, supportingPiano: true } });
  apply(['차가운'], { styleId: 'coldFeeling', genre: 'lofi', mood: 'dreamy', theme: 'winter', bpm: 78, density: 0.34, instruments: { drums: false, bass: true, violin: true, glockenspiel: true, supportingPiano: true } });
  apply(['어두운'], { styleId: 'darkFeeling', genre: 'default', mood: 'sad', theme: 'cinematic', bpm: 76, density: 0.32, instruments: { drums: false, bass: true, violin: true, supportingPiano: true } });
  apply(['긴장되는'], { styleId: 'tenseFeeling', genre: 'default', mood: 'sad', theme: 'cinematic', bpm: 94, density: 0.48, instruments: { drums: true, bass: true, violin: true, supportingPiano: true } });
  apply(['무서운'], { styleId: 'scaryFeeling', genre: 'default', mood: 'sad', theme: 'cinematic', bpm: 72, density: 0.26, instruments: { drums: false, bass: false, violin: true, supportingPiano: true } });
  apply(['웅장한'], { styleId: 'grandFeeling', genre: 'ballad', mood: 'dreamy', theme: 'cinematic', bpm: 96, density: 0.58, instruments: { drums: true, bass: true, violin: true, supportingPiano: true } });
  apply(['비장한'], { styleId: 'tragicHeroicFeeling', genre: 'ballad', mood: 'sad', theme: 'cinematic', bpm: 92, density: 0.54, instruments: { drums: true, bass: true, violin: true, supportingPiano: true } });

  apply(['겨울 시티팝'], {
    styleId: 'winterCityPop', genre: 'citypop', mood: 'dreamy', theme: 'winter', bpm: 98, density: 0.58,
    progressions: [['A', 'F', 'G', 'E'], ['F', 'C', 'G', 'A'], ['C', 'G', 'E', 'A']],
    instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, glockenspiel: true, studioAltoSax: true },
  });
  apply(['눈 오는 밤 드림팝', '눈오는 밤 드림팝'], {
    styleId: 'snowNightDreamPop', genre: 'lofi', mood: 'dreamy', theme: 'winter', bpm: 82, density: 0.36,
    progressions: [['A', 'F', 'C', 'G'], ['C', 'A', 'F', 'G'], ['F', 'C', 'A', 'G']],
    instruments: { drums: false, bass: true, guitar: false, violin: true, glockenspiel: true, supportingPiano: true },
  });
  apply(['따뜻한 겨울 재즈'], {
    styleId: 'warmWinterJazz', genre: 'jazz', mood: 'warm', theme: 'winter', bpm: 88, density: 0.5, swing: true,
    progressions: [['D', 'G', 'C', 'A'], ['F', 'E', 'A', 'D'], ['C', 'F', 'D', 'G']],
    instruments: { drums: true, bass: true, guitar: true, saxophone: true, studioAltoSax: true, supportingPiano: true, glockenspiel: false },
  });
  apply(['겨울 새벽 로파이'], {
    styleId: 'winterDawnLofi', genre: 'lofi', mood: 'calm', theme: 'cafeLofi', bpm: 76, density: 0.34, swing: true,
    progressions: [['A', 'F', 'C', 'G'], ['F', 'E', 'A', 'G'], ['C', 'G', 'A', 'F']],
    instruments: { drums: true, bass: true, guitar: false, supportingPiano: true, glockenspiel: false },
  });
  apply(['크리스마스 재즈'], {
    styleId: 'christmasJazz', genre: 'jazz', mood: 'warm', theme: 'christmas', bpm: 100, density: 0.54, swing: true,
    progressions: [['C', 'F', 'D', 'G'], ['F', 'C', 'D', 'G'], ['G', 'C', 'F', 'C']],
    instruments: { drums: true, bass: true, guitar: true, saxophone: true, supportingPiano: true, glockenspiel: true },
  });
  apply(['캐럴 팝', '캐롤 팝'], {
    styleId: 'carolPop', genre: 'default', mood: 'bright', theme: 'christmas', bpm: 112, density: 0.68,
    progressions: [['C', 'G', 'F', 'G'], ['C', 'F', 'C', 'G'], ['F', 'G', 'C', 'G']],
    instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, glockenspiel: true },
  });
  apply(['눈 내리는 피아노'], {
    styleId: 'snowPiano', genre: 'default', mood: 'calm', theme: 'winter', bpm: 70, density: 0.28,
    progressions: [['C', 'F', 'C', 'G'], ['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'C']],
    instruments: { drums: false, bass: false, guitar: false, violin: false, glockenspiel: true, supportingPiano: true },
  });
  apply(['차가운 신스팝'], {
    styleId: 'coldSynthPop', genre: 'citypop', mood: 'dreamy', theme: 'night', bpm: 110, density: 0.62,
    progressions: [['A', 'G', 'F', 'G'], ['F', 'G', 'E', 'A'], ['A', 'F', 'G', 'C']],
    instruments: { drums: true, bass: true, guitar: false, supportingPiano: true, chicagoStreet: true, glockenspiel: true },
  });
  apply(['쓸쓸한 겨울 발라드'], {
    styleId: 'lonelyWinterBallad', genre: 'ballad', mood: 'sad', theme: 'winter', bpm: 72, density: 0.34,
    progressions: [['A', 'F', 'C', 'G'], ['A', 'G', 'F', 'C'], ['F', 'C', 'G', 'A']],
    instruments: { drums: false, bass: true, guitar: false, violin: true, glockenspiel: false, supportingPiano: true },
  });
  apply(['벽난로 어쿠스틱'], {
    styleId: 'fireplaceAcoustic', genre: 'ballad', mood: 'warm', theme: 'winter', bpm: 84, density: 0.44,
    progressions: [['C', 'G', 'F', 'C'], ['F', 'C', 'G', 'C'], ['C', 'F', 'A', 'G']],
    instruments: { drums: false, bass: true, guitar: true, violin: false, glockenspiel: false, supportingPiano: true },
  });
  apply(['겨울 카페 보사노바'], {
    styleId: 'winterCafeBossa', genre: 'jazz', mood: 'warm', theme: 'winter', bpm: 92, density: 0.52, swing: true,
    progressions: [['D', 'G', 'C', 'A'], ['F', 'E', 'A', 'D'], ['C', 'F', 'D', 'G']],
    instruments: { drums: true, bass: true, guitar: true, saxophone: false, studioAltoSax: true, supportingPiano: true },
  });
  apply(['얼어붙은 숲 앰비언트'], {
    styleId: 'frozenForestAmbient', genre: 'default', mood: 'calm', theme: 'cinematic', bpm: 64, density: 0.22,
    progressions: [['A', 'F', 'A', 'G'], ['F', 'C', 'A', 'F'], ['A', 'G', 'F', 'C']],
    instruments: { drums: false, bass: false, guitar: false, violin: true, glockenspiel: false, supportingPiano: true },
  });
  apply(['연말의 추억'], {
    styleId: 'yearEndMemory', genre: 'ballad', mood: 'sad', theme: 'winter', bpm: 78, density: 0.4,
    progressions: [['F', 'G', 'E', 'A'], ['C', 'G', 'A', 'F'], ['A', 'F', 'C', 'G']],
    instruments: { drums: false, bass: true, guitar: true, violin: true, supportingPiano: true, glockenspiel: false },
  });
  apply(['첫눈 로맨스'], {
    styleId: 'firstSnowRomance', genre: 'ballad', mood: 'warm', theme: 'winter', bpm: 86, density: 0.48,
    progressions: [['C', 'G', 'A', 'F'], ['F', 'G', 'C', 'A'], ['C', 'F', 'G', 'C']],
    instruments: { drums: false, bass: true, guitar: true, violin: true, glockenspiel: true, supportingPiano: true },
  });
  apply(['새해 희망 음악'], {
    styleId: 'newYearHope', genre: 'default', mood: 'energetic', theme: 'cinematic', bpm: 112, density: 0.66,
    progressions: [['C', 'G', 'F', 'C'], ['F', 'G', 'C', 'G'], ['C', 'F', 'G', 'C']],
    instruments: { drums: true, bass: true, guitar: true, violin: true, glockenspiel: true, supportingPiano: true },
  });

  apply(['시티팝', '도시의 밤', '네온사인', '네온', '야간 드라이브', '드라이브', '레트로', 'citypop', 'city pop'], {
    genre: 'citypop', mood: 'dreamy', theme: 'night', bpm: 104, density: 0.66,
    instruments: { drums: true, bass: true, guitar: true, supportingPiano: true, studioAltoSax: true },
  });
  apply(['드림팝', '꿈속', '몽환', '몽환적인', 'dream pop', 'dreampop'], {
    genre: 'lofi', mood: 'dreamy', bpm: 88, density: 0.44,
    instruments: { drums: false, bass: true, guitar: true, glockenspiel: true, supportingPiano: true },
  });
  apply(['인디팝', '청춘', '담백', '피크닉', '새 학기', 'indie pop'], {
    genre: 'default', mood: 'bright', theme: 'spring', bpm: 102, density: 0.62,
    instruments: { drums: true, bass: true, guitar: true, glockenspiel: true },
  });
  apply(['로파이', 'lofi', 'lo-fi', '공부방', '공부', '빗소리', '장마 로파이', '봄비 로파이'], {
    genre: 'lofi', mood: 'calm', theme: includesAny(text, ['비', '빗소리', '장마']) ? 'rainyNight' : 'cafeLofi',
    bpm: 84, density: 0.42, swing: true,
    instruments: { drums: true, bass: true, supportingPiano: true, glockenspiel: false },
  });
  apply(['칠팝', '편안하고 부드러운 팝', 'chill pop', 'chillpop'], {
    genre: 'default', mood: 'calm', bpm: 92, density: 0.48,
    instruments: { drums: true, bass: true, guitar: true, supportingPiano: true },
  });
  apply(['어쿠스틱 팝', '어쿠스틱', '통기타', '벽난로', '산뜻한 어쿠스틱', 'acoustic'], {
    genre: 'ballad', mood: 'warm', bpm: 86, density: 0.48,
    instruments: { drums: false, bass: true, guitar: true, supportingPiano: true },
  });
  apply(['발라드', '슬픈 노래', '감성 발라드', '쓸쓸한 발라드', 'ballad'], {
    genre: 'ballad', mood: 'sad', bpm: 76, density: 0.44,
    instruments: { drums: false, bass: true, violin: true, supportingPiano: true },
  });
  apply(['뉴에이지', '피아노 위주', '피아노 연주곡', '눈 내리는 피아노', '잔잔한 피아노', 'new age'], {
    genre: 'default', mood: 'calm', bpm: 74, density: 0.34,
    instruments: { drums: false, bass: false, guitar: false, supportingPiano: true },
  });
  apply(['앰비언트', '공간감', '배경음악', '호러 앰비언트', '얼어붙은 숲', 'ambient'], {
    genre: 'default', mood: includesAny(text, ['호러', '무서운', '어두운']) ? 'sad' : 'calm',
    theme: includesAny(text, ['호러', '무서운']) ? 'cinematic' : 'calm', bpm: 68, density: 0.28,
    instruments: { drums: false, bass: false, violin: true, supportingPiano: true },
  });
  apply(['신스팝', '신스웨이브', '사이버펑크', '베이퍼웨이브', '네온 도시', '미래 도시', 'synthpop', 'synthwave', 'vaporwave', 'cyberpunk'], {
    genre: 'citypop', mood: 'dreamy', theme: 'night',
    bpm: includesAny(text, ['베이퍼웨이브', 'vaporwave']) ? 82 : 112,
    density: includesAny(text, ['베이퍼웨이브', 'vaporwave']) ? 0.44 : 0.72,
    instruments: { drums: true, bass: true, supportingPiano: true, chicagoStreet: true, glockenspiel: true },
  });
  apply(['디스코', '누디스코', '퓨처 펑크', 'funk', '펑크', 'disco', 'nu disco', 'future funk'], {
    genre: 'dance', mood: 'energetic', bpm: 122, density: 0.86,
    instruments: { drums: true, bass: true, guitar: true, chicagoStreet: true, studioAltoSax: true },
  });
  apply(['재즈팝', '스무스 재즈', '보사노바', '라운지', '호텔', '고급 카페', '고급 호텔', 'jazz pop', 'smooth jazz', 'bossa', 'lounge'], {
    genre: 'jazz', mood: 'warm', bpm: includesAny(text, ['보사노바', 'bossa']) ? 94 : 88, density: 0.54, swing: true,
    instruments: { drums: true, bass: true, guitar: true, saxophone: true, studioAltoSax: true, supportingPiano: true },
  });
  apply(['소울', 'r&b', '알앤비', '네오소울', 'neo soul', 'soul'], {
    genre: 'jazz', mood: 'warm', bpm: 84, density: 0.5, swing: true,
    instruments: { drums: true, bass: true, saxophone: true, supportingPiano: true, studioAltoSax: true },
  });
  apply(['edm', '하우스', '딥하우스', '트로피컬 하우스', '퓨처 베이스', 'uk 개러지', '드럼 앤 베이스', '트랜스', '테크노', '여름 축제'], {
    genre: 'dance', mood: includesAny(text, ['딥하우스', '트랜스']) ? 'dreamy' : 'energetic',
    theme: includesAny(text, ['트로피컬', '여름', '해변']) ? 'summerSea' : 'default',
    bpm: includesAny(text, ['드럼 앤 베이스']) ? 160 : includesAny(text, ['트랜스', '테크노']) ? 132 : 124,
    density: 0.88,
    instruments: { drums: true, bass: true, supportingPiano: true, chicagoStreet: true, glockenspiel: true },
  });
  apply(['붐뱁', '트랩', '감성 힙합', '재즈 힙합', '칠힙합', '클라우드 랩', 'hiphop', 'hip hop', 'trap', 'boombap'], {
    genre: 'lofi', mood: includesAny(text, ['감성', '칠', '클라우드', '슬픈']) ? 'sad' : 'calm',
    theme: includesAny(text, ['밤', '드라이브']) ? 'night' : 'cafeLofi',
    bpm: includesAny(text, ['트랩', 'trap']) ? 140 : 88,
    density: includesAny(text, ['트랩', 'trap']) ? 0.74 : 0.56,
    instruments: { drums: true, bass: true, supportingPiano: true, saxophone: includesAny(text, ['재즈']) },
  });
  apply(['팝록', '인디록', '얼터너티브 록', '펑크록', '슈게이즈', '포스트록', '메탈', 'rock', 'metal', 'shoegaze', 'post rock'], {
    genre: 'rock', mood: includesAny(text, ['슈게이즈', '포스트록']) ? 'dreamy' : 'energetic',
    bpm: includesAny(text, ['메탈', '펑크록']) ? 136 : 116, density: 0.78,
    instruments: { drums: true, bass: true, guitar: true, violin: includesAny(text, ['포스트록']) },
  });
  apply(['시네마틱', '오케스트라', '에픽', '판타지', '다크 판타지', '전투', '보스전', '영웅', '중세', '영화 예고편'], {
    genre: 'ballad', mood: includesAny(text, ['다크', '전투', '보스', '비장']) ? 'sad' : 'dreamy',
    theme: 'cinematic', bpm: includesAny(text, ['전투', '보스']) ? 118 : 88,
    density: includesAny(text, ['전투', '보스']) ? 0.72 : 0.54,
    instruments: { drums: includesAny(text, ['전투', '보스']), bass: true, violin: true, supportingPiano: true, glockenspiel: includesAny(text, ['판타지', '마법']) },
  });
  apply(['8비트', '칩튠', '오락실', '게임', 'rpg', '브금', 'chiptune', '8bit'], {
    genre: 'dance', mood: 'bright', theme: 'gameBgm', bpm: 118, density: 0.78,
    instruments: { drums: true, bass: true, glockenspiel: true, piccolo: true, supportingPiano: true },
  });

  apply(['봄', '벚꽃', '첫사랑', '피크닉', '새 학기'], { theme: 'spring', mood: 'bright', bpm: 102, density: 0.62 });
  apply(['여름밤', '여름 밤'], { theme: 'summerNight', mood: 'dreamy', genre: 'citypop', bpm: 104, density: 0.66 });
  apply(['여름', '해변', '바닷가', '바다', '휴양지'], { theme: 'summerSea', mood: 'bright', genre: 'citypop', bpm: 112, density: 0.72 });
  apply(['가을', '낙엽', '추억', '회상', '늦가을'], { theme: 'breakup', mood: 'sad', genre: 'ballad', bpm: 78, density: 0.46 });
  apply(['겨울', '눈 오는', '눈 내리는', '첫눈', '차가운', '연말'], { theme: 'winter', mood: 'dreamy', bpm: 80, density: 0.46 });
  apply(['크리스마스', '캐롤', '캐럴', '성탄', 'christmas', 'carol', 'xmas'], { theme: 'christmas', mood: 'bright', genre: 'ballad', bpm: 108, density: 0.64 });
  apply(['아침'], { mood: 'bright', bpm: 96, density: 0.54, instruments: { guitar: true } });
  apply(['낮'], { mood: 'bright', bpm: 108, density: 0.66 });
  apply(['노을'], { theme: 'night', mood: 'warm', genre: 'citypop', bpm: 96, density: 0.58 });
  apply(['저녁'], { mood: 'warm', genre: 'jazz', bpm: 90, density: 0.52 });
  apply(['밤', '야경', '옥상'], { theme: 'night', mood: 'dreamy', genre: 'citypop', bpm: 98, density: 0.58 });
  apply(['심야', '새벽'], { theme: 'cafeLofi', mood: 'calm', genre: 'lofi', bpm: 78, density: 0.38 });
  apply(['따뜻한', '포근한', '사랑스러운', '행복한'], { mood: 'warm', density: 0.54 });
  apply(['청량한', '산뜻한', '설레는'], { mood: 'bright', density: 0.64 });
  apply(['몽환적인', '신비로운', '흐릿한'], { mood: 'dreamy', density: 0.46 });
  apply(['외로운', '쓸쓸한', '우울한', '아련한', '슬픈', '공허한', '그리운'], { mood: 'sad', genre: 'ballad', bpm: 76, density: 0.42 });
  apply(['어두운', '긴장되는', '무서운', '비장한'], { mood: 'sad', theme: 'cinematic', bpm: 86, density: 0.52 });
  apply(['웅장한', '에픽', '벅차오르는', '희망찬'], { mood: 'energetic', theme: 'cinematic', bpm: 112, density: 0.74 });

  const reliableProfile = getReliablePromptStyleProfile(text);
  const readableProfile = getReadablePromptStyleProfile(text);
  const emotionProfile = includesAny(text, ['잔잔한 피아노']) || reliableProfile.styleId?.startsWith('calmPiano') || readableProfile.styleId?.startsWith('calmPiano') ? {} : getPromptEmotionOverride(text);
  const hybridProfile = getHybridPromptBlendProfile(text);
  const mergedProfile = mergeProfile(mergeProfile(mergeProfile(mergeProfile(profile, emotionProfile), reliableProfile), hybridProfile), readableProfile);

  if (includesAny(text, ['잔잔한 피아노'])) {
    return mergeProfile(mergedProfile, {
      styleId: 'calmPiano',
      genre: 'default',
      mood: 'calm',
      theme: 'calm',
      bpm: 72,
      density: 0.56,
      progressions: [['C', 'F', 'C', 'G'], ['A', 'F', 'C', 'G'], ['F', 'C', 'G', 'C']],
      instruments: { drums: false, bass: false, guitar: false, violin: false, saxophone: false, glockenspiel: false, piccolo: false, supportingPiano: true },
    });
  }

  return mergedProfile;
}

function normalizeDiatonicNote(note: string) {
  const normalized = note.replace('_sharp', '#');
  const match = /^([A-G])(#?)(-?\d+)$/.exec(normalized);
  if (!match) return note;

  const root = match[1];
  const accidental = match[2] ?? '';
  const octave = match[3];
  return SAFE_NOTE_ROOTS.has(root) ? `${root}${accidental}${octave}` : note;
}

function noteToMidi(note: string) {
  const normalized = normalizeDiatonicNote(note);
  const match = /^([A-G])(#?)(-?\d+)$/.exec(normalized);
  if (!match) return 60;

  return (Number(match[3]) + 1) * 12 + (NOTE_TO_MIDI[match[1]] ?? 0) + (match[2] === '#' ? 1 : 0);
}

function midiToMelodyNote(midi: number) {
  const clampedMidi = Math.max(21, Math.min(108, Math.round(midi)));
  const root = MIDI_TO_NOTE_ROOT[((clampedMidi % 12) + 12) % 12];
  const octave = Math.floor(clampedMidi / 12) - 1;
  return `${root}${octave}`;
}

function getPitchClass(note: string) {
  return ((noteToMidi(note) % 12) + 12) % 12;
}

function findNearestMidiWithPitchClass(targetMidi: number, pitchClasses: number[], minMidi: number, maxMidi: number) {
  let bestMidi = Math.max(minMidi, Math.min(maxMidi, Math.round(targetMidi)));
  let bestScore = Number.POSITIVE_INFINITY;

  for (let midi = minMidi; midi <= maxMidi; midi += 1) {
    if (!pitchClasses.includes(((midi % 12) + 12) % 12)) continue;
    const score = Math.abs(midi - targetMidi);
    if (score < bestScore) {
      bestScore = score;
      bestMidi = midi;
    }
  }

  return bestMidi;
}

function chooseConnectedMelodyNote(palette: string[], preferredDegree: number, previousNote: string | null) {
  const fallback = palette[preferredDegree % palette.length] ?? palette[0];
  if (!previousNote) return fallback;

  const previousMidi = noteToMidi(previousNote);
  const preferredRoot = fallback.replace(/-?\d+$/, '');

  const sorted = [...palette]
    .sort((a, b) => {
      const aRootBonus = a.startsWith(preferredRoot) ? -2 : 0;
      const bRootBonus = b.startsWith(preferredRoot) ? -2 : 0;
      return Math.abs(noteToMidi(a) - previousMidi) + aRootBonus - (Math.abs(noteToMidi(b) - previousMidi) + bRootBonus);
    });

  return sorted.find((note) => note !== previousNote) ?? sorted[0] ?? fallback;
}

function chooseMovingMelodyNote(palette: string[], preferredDegree: number, previousNote: string | null, index: number) {
  if (!previousNote) {
    return palette[preferredDegree % palette.length] ?? palette[0];
  }

  const previousMidi = noteToMidi(previousNote);
  const direction = index % 2 === 0 ? 1 : -1;
  const candidates = [...palette]
    .filter((note) => note !== previousNote)
    .filter((note) => {
      const distance = noteToMidi(note) - previousMidi;
      const absDistance = Math.abs(distance);
      return absDistance <= 5 && (direction > 0 ? distance > 0 : distance < 0);
    })
    .sort((a, b) => {
      const aDistance = Math.abs(noteToMidi(a) - previousMidi);
      const bDistance = Math.abs(noteToMidi(b) - previousMidi);
      return aDistance - bDistance;
    });

  return candidates[0] ?? chooseConnectedMelodyNote(palette, preferredDegree, previousNote);
}

function getConstrainedLeadPalette(chord: ChordName, analysis: PromptAnalysis, previousNote: string | null) {
  const basePalette = getLeadMelodyTonePalette(chord, analysis);
  const minMidi =
    isSoloPianoStyle(analysis)
      ? getSoloPianoVariant(analysis) === 'sad' || getSoloPianoVariant(analysis) === 'winter'
        ? 48
        : getSoloPianoVariant(analysis) === 'bright'
          ? 60
          : 52
      : analysis.styleId === 'summerNightCityPop' || analysis.mood === 'dreamy'
      ? 62
      : analysis.mood === 'sad' || analysis.mood === 'calm'
        ? 57
        : 60;
  const maxMidi =
    isSoloPianoStyle(analysis)
      ? getSoloPianoVariant(analysis) === 'sad' || getSoloPianoVariant(analysis) === 'winter'
        ? 88
        : getSoloPianoVariant(analysis) === 'bright'
          ? 103
          : 96
      : analysis.styleId === 'summerNightCityPop'
      ? 100
      : analysis.mood === 'dreamy'
        ? 100
        : analysis.mood === 'sad' || analysis.mood === 'calm'
          ? 91
          : 103;
  const ranged = basePalette.filter((note) => {
    const midi = noteToMidi(note);
    return midi >= minMidi && midi <= maxMidi;
  });
  const limited = previousNote
    ? ranged.filter((note) => Math.abs(noteToMidi(note) - noteToMidi(previousNote)) <= (isSoloPianoStyle(analysis) ? 12 : 7))
    : ranged;

  return limited.length > 0 ? limited : ranged.length > 0 ? ranged : basePalette;
}

function getLeadMelodyTonePalette(chord: ChordName, analysis?: PromptAnalysis) {
  if (!analysis) return LEAD_MELODY_TONES[chord];

  const chordRoots = new Set([
    ...CHORD_TONES[chord].melody,
    ...CHORD_TONES[chord].passing,
  ].map(getNoteRoot));
  const pianoTones = uniqueNotes((MELODY_NOTES as readonly string[]).map(normalizeDiatonicNote))
    .filter((note) => chordRoots.has(getNoteRoot(note)))
    .sort((a, b) => noteToMidi(a) - noteToMidi(b));

  return pianoTones.length > 0 ? pianoTones : LEAD_MELODY_TONES[chord];
}

function findNearestPaletteDegree(palette: string[], targetNote: string, previousNote: string | null) {
  if (palette.length === 0) return 0;

  const targetMidi = noteToMidi(targetNote);
  const previousMidi = previousNote ? noteToMidi(previousNote) : targetMidi;
  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;

  palette.forEach((note, index) => {
    const pitchScore = Math.abs(noteToMidi(note) - targetMidi);
    const motionScore = previousNote ? Math.abs(noteToMidi(note) - previousMidi) * 0.45 : 0;
    const repeatPenalty = previousNote && note === previousNote ? 2 : 0;
    const score = pitchScore + motionScore + repeatPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function chooseNearestPaletteNote(palette: string[], targetNote: string, previousNote: string | null) {
  return chooseConnectedMelodyNote(palette, findNearestPaletteDegree(palette, targetNote, previousNote), previousNote);
}

function isDreamCityPopPrompt(analysis: PromptAnalysis) {
  return (
    analysis.styleId === 'summerNightCityPop' ||
    (analysis.genre === 'citypop' && (analysis.theme === 'summerNight' || analysis.theme === 'night') && analysis.mood === 'dreamy')
  );
}

function isSoloPianoStyle(analysis: PromptAnalysis) {
  return analysis.styleId.startsWith('calmPiano');
}

function getSoloPianoVariant(analysis: PromptAnalysis) {
  const variant = analysis.styleId.replace('calmPiano', '').toLowerCase();
  if (variant.includes('canon')) return 'canon';
  if (variant.includes('rpgost')) return 'rpgost';
  if (variant.includes('newage')) return 'newage';
  if (variant.includes('soft')) return 'soft';
  if (variant.includes('sad')) return 'sad';
  if (variant.includes('night')) return 'night';
  if (variant.includes('rain')) return 'rain';
  if (variant.includes('winter')) return 'winter';
  if (variant.includes('bright')) return 'bright';
  if (variant.includes('emotional')) return 'emotional';
  if (variant.includes('calm')) return 'calm';
  if (variant.includes('lyrical')) return 'lyrical';
  if (variant.includes('quiet')) return 'quiet';
  return 'plain';
}

function createRuntimeSoloPianoAnalysis(analysis: PromptAnalysis, prompt: string): PromptAnalysis {
  if (!isSoloPianoStyle(analysis)) return analysis;

  const currentVariant = getSoloPianoVariant(analysis);
  if (currentVariant === 'canon' || currentVariant === 'rpgost') return analysis;

  const text = prompt.toLowerCase();
  const hasSpecificMood =
    text.includes('\uc794\uc794') ||
    text.includes('\uc870\uc6a9') ||
    text.includes('\uac10\uc131') ||
    text.includes('\uc11c\uc815') ||
    text.includes('\uc2ac\ud508') ||
    text.includes('\uc4f8\uc4f8') ||
    text.includes('\ubc24') ||
    text.includes('\uc0c8\ubcbd') ||
    text.includes('\ube44') ||
    text.includes('\ubd04') ||
    text.includes('\ubc1d') ||
    text.includes('calm') ||
    text.includes('quiet') ||
    text.includes('emotional') ||
    text.includes('sad') ||
    text.includes('night');
  const runtimeSeed = createSeed(`${prompt}:${Date.now()}:${Math.random()}`);
  const genericProfiles: Array<{
    styleId: string;
    mood: Mood;
    theme: Theme;
    bpm: number;
    density: number;
    progressions: ChordName[][];
  }> = [
    {
      styleId: 'calmPianoLyrical',
      mood: 'dreamy' as const,
      theme: 'calm' as const,
      bpm: 82,
      density: 0.76,
      progressions: [['A', 'F', 'C', 'G'], ['F', 'G', 'E', 'A'], ['D', 'G', 'C', 'A'], ['F', 'C', 'G', 'A']],
    },
    {
      styleId: 'calmPianoNight',
      mood: 'dreamy' as const,
      theme: 'night' as const,
      bpm: 76,
      density: 0.66,
      progressions: [['A', 'G', 'F', 'C'], ['F', 'C', 'A', 'G'], ['C', 'G', 'E', 'A'], ['F', 'G', 'E', 'A']],
    },
    {
      styleId: 'calmPianoEmotional',
      mood: 'sad' as const,
      theme: 'breakup' as const,
      bpm: 72,
      density: 0.72,
      progressions: [['A', 'F', 'C', 'G'], ['F', 'G', 'E', 'A'], ['A', 'G', 'F', 'C'], ['F', 'C', 'G', 'A']],
    },
    {
      styleId: 'calmPianoBright',
      mood: 'bright' as const,
      theme: 'spring' as const,
      bpm: 90,
      density: 0.78,
      progressions: [['C', 'G', 'A', 'F'], ['C', 'F', 'G', 'C'], ['F', 'G', 'C', 'A'], ['G', 'C', 'F', 'G']],
    },
    {
      styleId: 'calmPianoRain',
      mood: 'calm' as const,
      theme: 'rainyNight' as const,
      bpm: 70,
      density: 0.56,
      progressions: [['F', 'C', 'G', 'A'], ['A', 'F', 'C', 'G'], ['C', 'F', 'G', 'C'], ['F', 'E', 'A', 'G']],
    },
    {
      styleId: 'calmPianoSad',
      mood: 'sad' as const,
      theme: 'winter' as const,
      bpm: 68,
      density: 0.58,
      progressions: [['A', 'F', 'C', 'G'], ['C', 'A', 'F', 'G'], ['F', 'C', 'G', 'A'], ['A', 'G', 'F', 'C']],
    },
  ];
  const compatibleProfiles = hasSpecificMood
    ? genericProfiles.filter((profile) =>
        currentVariant === 'quiet' || currentVariant === 'calm'
          ? profile.mood === 'calm' || profile.styleId === 'calmPianoRain' || profile.styleId === 'calmPianoLyrical'
          : currentVariant === 'emotional' || currentVariant === 'sad'
            ? profile.mood === 'sad' || profile.styleId === 'calmPianoLyrical'
            : currentVariant === 'night' || currentVariant === 'rain'
              ? profile.theme === 'night' || profile.theme === 'rainyNight' || profile.styleId === 'calmPianoLyrical'
              : currentVariant === 'bright'
                ? profile.mood === 'bright' || profile.styleId === 'calmPianoLyrical'
                : true
      )
    : genericProfiles;
  const profile = compatibleProfiles[runtimeSeed % Math.max(1, compatibleProfiles.length)] ?? genericProfiles[0];
  const progression = profile.progressions[Math.floor((runtimeSeed / 7) % profile.progressions.length)] ?? profile.progressions[0];
  const secondaryProgression = profile.progressions[Math.floor((runtimeSeed / 17) % profile.progressions.length)] ?? progression;

  return {
    ...analysis,
    styleId: profile.styleId,
    mood: profile.mood,
    theme: profile.theme,
    bpm: profile.bpm + ((runtimeSeed % 5) - 2),
    density: Math.max(0.42, Math.min(0.9, profile.density + (((runtimeSeed >> 3) % 9) - 4) / 100)),
    progression,
    secondaryProgression,
    variation: (analysis.variation + (runtimeSeed % 24)) % 24,
    promptSeed: (analysis.promptSeed ^ runtimeSeed) >>> 0,
  };
}

function getSoloPianoLeadRegisterRange(analysis: PromptAnalysis, bar: number) {
  const variant = getSoloPianoVariant(analysis);
  const phrase = Math.floor(bar / 4);
  const seedBand = (analysis.promptSeed + phrase * 7 + analysis.variation * 11 + bar) % 6;
  const isChorus = isChorusBar(bar);
  const isBridge = isBridgeBar(bar);

  if (variant === 'sad' || variant === 'winter') {
    if (isBridge) return { min: 57, max: 79 };
    if (isChorus) return { min: 60, max: 96 };
    if (seedBand <= 1) return { min: 60, max: 84 };
    if (seedBand <= 3) return { min: 64, max: 91 };
    return { min: 67, max: 96 };
  }

  if (variant === 'bright') {
    if (isChorus) return { min: 72, max: 108 };
    if (seedBand <= 1) return { min: 67, max: 96 };
    if (seedBand <= 3) return { min: 72, max: 103 };
    return { min: 76, max: 108 };
  }

  if (variant === 'lyrical') {
    if (isBridge) return { min: 60, max: 88 };
    if (isChorus) return { min: 67, max: 108 };
    if (seedBand <= 1) return { min: 64, max: 96 };
    if (seedBand <= 3) return { min: 67, max: 103 };
    return { min: 72, max: 108 };
  }

  if (variant === 'emotional') {
    if (isBridge) return { min: 55, max: 84 };
    if (isChorus) return { min: 64, max: 108 };
    if (seedBand <= 1) return { min: 57, max: 91 };
    if (seedBand <= 3) return { min: 60, max: 100 };
    return { min: 67, max: 108 };
  }

  if (variant === 'calm') {
    if (isBridge) return { min: 52, max: 76 };
    if (isChorus) return { min: 57, max: 88 };
    if (seedBand <= 2) return { min: 52, max: 79 };
    return { min: 57, max: 84 };
  }

  if (variant === 'quiet') {
    if (isBridge) return { min: 48, max: 72 };
    if (isChorus) return { min: 52, max: 84 };
    if (seedBand <= 1) return { min: 45, max: 72 };
    if (seedBand <= 3) return { min: 52, max: 79 };
    return { min: 57, max: 84 };
  }

  if (variant === 'night' || variant === 'rain') {
    if (isBridge) return { min: 60, max: 84 };
    if (isChorus) return { min: 67, max: 103 };
    if (seedBand <= 1) return { min: 60, max: 91 };
    if (seedBand <= 3) return { min: 64, max: 96 };
    return { min: 72, max: 103 };
  }

  if (isChorus) return { min: 67, max: 103 };
  if (seedBand <= 1) return { min: 60, max: 91 };
  if (seedBand <= 3) return { min: 64, max: 96 };
  return { min: 72, max: 103 };
}

function getSoloPianoChordPitchClasses(chord: ChordName, includePassing = true) {
  return uniqueNotes([
    ...CHORD_TONES[chord].melody,
    ...CHORD_TONES[chord].guitar,
    ...(includePassing ? CHORD_TONES[chord].passing : []),
  ]).map(getPitchClass);
}

function chooseSoloPianoAnchorMidi(chord: ChordName, analysis: PromptAnalysis, bar: number, minMidi: number, maxMidi: number) {
  const chordPitchClasses = getSoloPianoChordPitchClasses(chord, false);
  const phrase = Math.floor(bar / 4);
  const registerBand = (analysis.promptSeed + analysis.variation * 13 + phrase * 11 + bar * 5) % 5;
  if (registerBand === 0) {
    return findNearestMidiWithPitchClass(minMidi + 7 + ((analysis.promptSeed + bar) % 9), chordPitchClasses, minMidi, maxMidi);
  }
  if (registerBand === 4) {
    return findNearestMidiWithPitchClass(maxMidi - 12 - ((analysis.promptSeed + bar) % 10), chordPitchClasses, minMidi, maxMidi);
  }
  const center =
    getSoloPianoVariant(analysis) === 'sad' || getSoloPianoVariant(analysis) === 'winter'
      ? minMidi + Math.round((maxMidi - minMidi) * 0.42)
      : getSoloPianoVariant(analysis) === 'bright'
        ? minMidi + Math.round((maxMidi - minMidi) * 0.58)
        : minMidi + Math.round((maxMidi - minMidi) * 0.5);
  const promptOffset = (((analysis.promptSeed >> (bar % 13)) + analysis.variation * 5 + phrase * 3) % 15) - 7;
  return findNearestMidiWithPitchClass(center + promptOffset, chordPitchClasses, minMidi, maxMidi);
}

function getSoloPianoMotifPattern(analysis: PromptAnalysis, bar: number) {
  const variant = getSoloPianoVariant(analysis);
  const motifBank = {
    sad: [
      { offsets: [0, 2, 4, 7, 10, 12, 14], intervals: [0, 3, 7, 5, 3, -2, 0], durations: [2, 1, 2, 1, 2, 1, 2] },
      { offsets: [0, 3, 5, 8, 10, 13, 15], intervals: [7, 5, 3, 0, -2, 0, 3], durations: [2, 1, 1, 2, 1, 1, 1] },
      { offsets: [0, 4, 6, 9, 12, 14], intervals: [0, -2, 3, 5, 3, 0], durations: [3, 1, 2, 1, 2, 2] },
    ],
    winter: [
      { offsets: [0, 2, 5, 7, 10, 12, 15], intervals: [0, 4, 7, 11, 7, 4, 0], durations: [2, 1, 1, 2, 1, 2, 1] },
      { offsets: [0, 3, 6, 8, 11, 13, 15], intervals: [7, 4, 2, 0, 4, 7, 12], durations: [2, 1, 2, 1, 1, 1, 1] },
      { offsets: [0, 4, 5, 8, 10, 12, 14], intervals: [0, 7, 9, 7, 4, 2, 0], durations: [3, 1, 1, 2, 1, 1, 2] },
    ],
    rain: [
      { offsets: [0, 1, 3, 5, 8, 10, 12, 14], intervals: [0, 2, 3, 7, 5, 3, 2, 0], durations: [1, 1, 1, 2, 1, 1, 1, 2] },
      { offsets: [0, 2, 4, 6, 9, 11, 13, 15], intervals: [3, 0, 2, 5, 7, 5, 3, 2], durations: [1, 1, 1, 1, 2, 1, 1, 1] },
      { offsets: [0, 1, 4, 7, 8, 11, 12, 15], intervals: [7, 5, 3, 2, 0, 2, 3, 0], durations: [1, 1, 2, 1, 1, 1, 2, 1] },
    ],
    night: [
      { offsets: [0, 2, 4, 7, 9, 11, 12, 14], intervals: [0, 4, 7, 11, 9, 7, 4, 2], durations: [2, 1, 2, 1, 1, 1, 1, 2] },
      { offsets: [0, 3, 5, 6, 8, 10, 13, 15], intervals: [7, 9, 11, 7, 4, 2, 4, 7], durations: [2, 1, 1, 1, 2, 1, 1, 1] },
      { offsets: [0, 2, 5, 8, 10, 12, 13, 15], intervals: [3, 7, 9, 11, 7, 5, 4, 2], durations: [1, 2, 1, 2, 1, 1, 1, 1] },
    ],
    bright: [
      { offsets: [0, 1, 2, 4, 6, 8, 9, 10, 12, 14], intervals: [0, 2, 4, 7, 9, 12, 11, 9, 7, 4], durations: [1, 1, 1, 2, 1, 1, 1, 1, 2, 1] },
      { offsets: [0, 2, 3, 5, 7, 8, 10, 12, 13, 15], intervals: [7, 9, 12, 14, 12, 9, 7, 4, 2, 0], durations: [1, 1, 1, 1, 1, 2, 1, 1, 1, 1] },
      { offsets: [0, 1, 4, 5, 8, 9, 11, 12, 14, 15], intervals: [0, 4, 7, 9, 12, 14, 12, 9, 7, 4], durations: [1, 1, 2, 1, 1, 1, 1, 2, 1, 1] },
    ],
    lyrical: [
      { offsets: [0, 1, 2, 4, 6, 8, 9, 11, 12, 14], intervals: [0, 4, 7, 12, 9, 7, 4, 7, 12, 11], durations: [1, 1, 2, 2, 1, 1, 1, 1, 2, 2] },
      { offsets: [0, 2, 3, 5, 7, 8, 10, 12, 13, 15], intervals: [7, 9, 12, 14, 12, 9, 7, 4, 2, 0], durations: [2, 1, 1, 1, 2, 1, 1, 2, 1, 1] },
      { offsets: [0, 1, 4, 5, 7, 8, 10, 11, 12, 14], intervals: [4, 7, 12, 11, 9, 7, 5, 4, 7, 12], durations: [1, 1, 2, 1, 1, 2, 1, 1, 2, 2] },
      { offsets: [0, 2, 4, 5, 6, 8, 10, 12, 13, 15], intervals: [12, 11, 9, 7, 4, 7, 9, 12, 14, 12], durations: [2, 1, 1, 1, 1, 2, 1, 1, 1, 1] },
    ],
    quiet: [
      { offsets: [0, 4, 8, 12], intervals: [0, 4, 7, 4], durations: [4, 3, 4, 4] },
      { offsets: [0, 5, 9, 13], intervals: [7, 4, 2, 0], durations: [4, 3, 3, 3] },
      { offsets: [0, 6, 10, 14], intervals: [0, -2, 3, 0], durations: [5, 3, 3, 2] },
      { offsets: [2, 6, 10, 12], intervals: [4, 7, 5, 4], durations: [3, 3, 2, 4] },
    ],
    plain: [
      { offsets: [0, 2, 4, 6, 8, 10, 12, 14], intervals: [0, 4, 7, 5, 3, 5, 7, 4], durations: [2, 1, 2, 1, 2, 1, 2, 1] },
      { offsets: [0, 3, 4, 7, 8, 11, 12, 15], intervals: [7, 5, 4, 2, 0, 2, 4, 7], durations: [2, 1, 1, 2, 1, 1, 2, 1] },
      { offsets: [0, 2, 5, 6, 8, 10, 13, 14], intervals: [0, 2, 4, 7, 9, 7, 5, 4], durations: [1, 1, 2, 1, 2, 1, 1, 2] },
    ],
  } as const;

  const motifKey: keyof typeof motifBank =
    variant === 'calm' || variant === 'emotional' || variant === 'canon' || variant === 'rpgost'
      ? 'plain'
      : variant === 'newage'
        ? 'lyrical'
        : variant === 'soft'
          ? 'quiet'
      : variant;
  const bank = motifBank[motifKey] ?? motifBank.plain;
  return bank[(analysis.promptSeed + analysis.variation + Math.floor(bar / 2) + bar) % bank.length];
}

function getMainMelodyRegisterRange(analysis: PromptAnalysis, bar: number) {
  const sectionLift = isChorusBar(bar) ? 7 : isBridgeBar(bar) ? -5 : bar % 8 >= 6 ? 4 : 0;
  const promptBand = (analysis.promptSeed + analysis.variation * 9 + Math.floor(bar / 4) * 5 + bar) % 4;

  if (isSoloPianoStyle(analysis)) {
    const pianoRange = getSoloPianoLeadRegisterRange(analysis, bar);
    return {
      min: Math.max(48, pianoRange.min + (promptBand === 0 ? 0 : 5)),
      max: Math.min(108, pianoRange.max + sectionLift + (promptBand === 3 ? 7 : 0)),
    };
  }

  if (analysis.mood === 'calm' || analysis.mood === 'sad') {
    if (analysis.styleId === 'calmSong' || analysis.theme === 'calm') {
      if (isChorusBar(bar)) return { min: 60, max: 79 };
      return { min: 57, max: 76 };
    }
    if (promptBand === 0) return { min: 60, max: 84 + sectionLift };
    if (promptBand === 1) return { min: 64, max: 91 + sectionLift };
    return { min: 67, max: 96 + sectionLift };
  }

  if (analysis.mood === 'dreamy' || analysis.genre === 'citypop' || analysis.theme === 'night' || analysis.theme === 'summerNight') {
    if (promptBand === 0) return { min: 62, max: 91 + sectionLift };
    if (promptBand === 1) return { min: 67, max: 100 + sectionLift };
    return { min: 72, max: 108 };
  }

  if (analysis.mood === 'bright' || analysis.mood === 'energetic' || analysis.theme === 'spring' || analysis.theme === 'summerSea') {
    if (promptBand === 0) return { min: 67, max: 100 };
    return { min: 72, max: 108 };
  }

  return { min: 62, max: 96 + sectionLift };
}

function liftMelodyNoteToMainRegister(note: string, chord: ChordName, analysis: PromptAnalysis, bar: number) {
  const range = getMainMelodyRegisterRange(analysis, bar);
  const chordPitchClasses = getSoloPianoChordPitchClasses(chord, true);
  const noteMidi = noteToMidi(note);
  const pitchClass = ((noteMidi % 12) + 12) % 12;
  const usablePitchClasses = chordPitchClasses.includes(pitchClass) ? [pitchClass] : chordPitchClasses;

  if (noteMidi >= range.min && noteMidi <= range.max && isValidMelodyNote(note)) return note;

  return midiToMelodyNote(findNearestMidiWithPitchClass(noteMidi, usablePitchClasses, range.min, Math.min(108, range.max)));
}

function getFullRangeMelodyBand(analysis: PromptAnalysis, bar: number, offset: number) {
  const phrase = Math.floor(bar / 4);
  const bandSeed = (analysis.promptSeed + analysis.variation * 17 + phrase * 13 + bar * 7 + offset) % 12;
  const isPeak = isChorusBar(bar) || bar % 8 >= 6;
  const wantsWidePiano = isSoloPianoStyle(analysis) || analysis.mood === 'dreamy' || analysis.mood === 'bright';

  if (!wantsWidePiano) {
    if (isPeak || bandSeed >= 9) return { min: 72, max: 108 };
    if (bandSeed <= 1) return { min: 52, max: 72 };
    return { min: 60, max: 96 };
  }

  if (offset === 0 && bar % 2 === 0) return { min: 40, max: 64 };
  if (offset === 8 && bandSeed <= 3) return { min: 45, max: 69 };
  if (isPeak && bandSeed >= 4) return { min: 76, max: 108 };
  if (bandSeed <= 2) return { min: 52, max: 76 };
  if (bandSeed >= 8) return { min: 72, max: 108 };
  return { min: 60, max: 96 };
}

function moveMelodyNoteToBand(note: string, chord: ChordName, analysis: PromptAnalysis, bar: number, offset: number) {
  const band = getFullRangeMelodyBand(analysis, bar, offset);
  const chordPitchClasses = getSoloPianoChordPitchClasses(chord, offset === 0 || offset === 4 || offset === 8 || offset === 12);
  const originalMidi = noteToMidi(note);
  const originalPitchClass = ((originalMidi % 12) + 12) % 12;
  const pitchClasses = chordPitchClasses.includes(originalPitchClass) ? [originalPitchClass] : chordPitchClasses;
  return midiToMelodyNote(findNearestMidiWithPitchClass(originalMidi, pitchClasses, band.min, band.max));
}

function expandMelodyAcrossFullKeyboard(events: MusicEvent[], analysis: PromptAnalysis) {
  if ((analysis.mood === 'calm' || analysis.styleId === 'calmSong') && !isSoloPianoStyle(analysis)) {
    return polishEvents(events);
  }

  const soloPianoVariant = isSoloPianoStyle(analysis) ? getSoloPianoVariant(analysis) : '';
  const expanded = polishEvents(events).map((event, index) => {
    const bar = Math.floor(event.start / BAR_LENGTH);
    const offset = event.start % BAR_LENGTH;
    const chord = getChordForBar(analysis, bar);
    const shouldExpand =
      (isSoloPianoStyle(analysis) && soloPianoVariant !== 'quiet') ||
      analysis.mood === 'dreamy' ||
      analysis.mood === 'bright' ||
      index % 3 === 0;

    if (!shouldExpand) return event;

    return {
      ...event,
      note: moveMelodyNoteToBand(event.note ?? CHORD_TONES[chord].melody[0], chord, analysis, bar, offset),
    };
  });

  const occupied = new Set(expanded.map((event) => `${event.start}:${event.note}`));
  const addExpandedNote = (note: string, start: number, duration: number) => {
    const safeNote = normalizeDiatonicNote(note);
    const key = `${start}:${safeNote}`;
    if (occupied.has(key)) return;
    occupied.add(key);
    addNote(expanded, safeNote, start, duration, isValidMelodyNote);
  };

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const chordClasses = getSoloPianoChordPitchClasses(chord, false);
    const nextClasses = getSoloPianoChordPitchClasses(nextChord, false);
    const lowAnchor = findNearestMidiWithPitchClass(42 + ((analysis.promptSeed + bar * 5) % 14), chordClasses, 33, 57);
    const midAnswer = findNearestMidiWithPitchClass(62 + ((analysis.promptSeed + bar * 3) % 19), chordClasses, 55, 84);
    const highSpark = findNearestMidiWithPitchClass(84 + ((analysis.promptSeed + bar * 7) % 20), bar % 4 === 3 ? nextClasses : chordClasses, 76, 108);

    if (soloPianoVariant === 'quiet' ? bar % 4 === 0 : bar % 2 === 0 || isSoloPianoStyle(analysis)) {
      addExpandedNote(midiToMelodyNote(lowAnchor), base, isSoloPianoStyle(analysis) ? 2 : 1);
    }

    if (soloPianoVariant === 'quiet' ? bar % 4 === 2 : bar % 3 === 1 || isChorusBar(bar)) {
      addExpandedNote(midiToMelodyNote(midAnswer), base + 6, soloPianoVariant === 'quiet' ? 2 : 1);
    }

    if (soloPianoVariant !== 'quiet' && (bar % 2 === 1 || isChorusBar(bar) || analysis.mood === 'bright' || analysis.mood === 'dreamy')) {
      addExpandedNote(midiToMelodyNote(highSpark), base + 14, 1);
    }
  }

  return expanded;
}

function createDreamCityPopLeadMelody(analysis: PromptAnalysis): MusicEvent[] {
  const events: MusicEvent[] = [];
  let previousNote: string | null = null;
  const phraseSeed = createSeed(`${analysis.styleId}:dream-citypop-lead:${analysis.variation}:${analysis.promptSeed}`);

  const motifs = [
    [
      { offset: 0, duration: 1, degree: 1 },
      { offset: 2, duration: 1, degree: 2 },
      { offset: 4, duration: 2, degree: 3 },
      { offset: 8, duration: 1, degree: 2 },
      { offset: 10, duration: 2, degree: 4 },
      { offset: 14, duration: 2, degree: 1 },
    ],
    [
      { offset: 0, duration: 2, degree: 2 },
      { offset: 2, duration: 1, degree: 1 },
      { offset: 4, duration: 1, degree: 3 },
      { offset: 6, duration: 2, degree: 4 },
      { offset: 10, duration: 1, degree: 2 },
      { offset: 14, duration: 2, degree: 3 },
    ],
    [
      { offset: 2, duration: 1, degree: 3 },
      { offset: 4, duration: 2, degree: 2 },
      { offset: 6, duration: 1, degree: 4 },
      { offset: 8, duration: 1, degree: 5 },
      { offset: 12, duration: 2, degree: 3 },
      { offset: 14, duration: 1, degree: 2 },
    ],
    [
      { offset: 0, duration: 2, degree: 4 },
      { offset: 4, duration: 1, degree: 3 },
      { offset: 6, duration: 2, degree: 1 },
      { offset: 10, duration: 1, degree: 2 },
      { offset: 12, duration: 2, degree: 0 },
      { offset: 14, duration: 1, degree: 1 },
    ],
  ];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const base = bar * BAR_LENGTH;
    const palette = getConstrainedLeadPalette(chord, analysis, previousNote);
    const sectionShift = getMelodySectionShift(analysis, bar);
    const promptMotifShift = (analysis.promptSeed >> (bar % 16)) % motifs.length;
    const motifIndex = (Math.floor(bar / 2) + analysis.variation + sectionShift + phraseSeed + promptMotifShift) % motifs.length;
    const motif = motifs[motifIndex];
    const isAnswerBar = bar % 4 === 1 || bar % 4 === 3;
    const isChorus = isChorusBar(bar);

    motif.forEach((step, index) => {
      if (bar < 2 && index > 3) return;
      if (!isChorus && isAnswerBar && index === 1) return;

      const phraseLift = isChorus ? 1 : bar % 8 >= 6 ? 2 : 0;
      const answerDrop = isAnswerBar && index >= motif.length - 2 ? -1 : 0;
      const degree = step.degree + phraseLift + answerDrop + Math.floor(bar / 8) + index + (analysis.promptSeed % 5);
      const note = chooseMovingMelodyNote(palette, degree, previousNote, base + step.offset);
      const start = base + Math.min(BAR_LENGTH - 1, step.offset);
      const duration = Math.max(1, Math.min(step.duration, BAR_LENGTH - (start % BAR_LENGTH)));

      addNote(events, note, start, duration, isValidMelodyNote);
      previousNote = note;
    });

    if (bar % 4 === 3) {
      const resolvePalette = getConstrainedLeadPalette(chord, analysis, previousNote);
      const resolveNote = chooseNearestPaletteNote(resolvePalette, CHORD_TONES[chord].melody[1] ?? CHORD_TONES[chord].melody[0], previousNote);
      addNote(events, resolveNote, base + 14, 2, isValidMelodyNote);
      previousNote = resolveNote;
    }
  }

  return events;
}

function createExpressivePianoLeadMelody(analysis: PromptAnalysis): MusicEvent[] {
  const events: MusicEvent[] = [];
  let previousNote: string | null = null;
  const pianoVariant = getSoloPianoVariant(analysis);

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const register = getSoloPianoLeadRegisterRange(analysis, bar);
    const nextRegister = getSoloPianoLeadRegisterRange(analysis, bar + 1);
    const motif = getSoloPianoMotifPattern(analysis, bar);
    const isChorus = isChorusBar(bar);
    const isBridge = isBridgeBar(bar);
    const anchorMidi = chooseSoloPianoAnchorMidi(chord, analysis, bar, register.min, register.max);
    const nextAnchorMidi = chooseSoloPianoAnchorMidi(nextChord, analysis, bar + 1, nextRegister.min, nextRegister.max);
    const chordPitchClasses = getSoloPianoChordPitchClasses(chord, true);
    const strictChordPitchClasses = getSoloPianoChordPitchClasses(chord, false);
    const nextChordPitchClasses = getSoloPianoChordPitchClasses(nextChord, true);
    const contourLift = isChorus ? 7 : isBridge ? -5 : bar % 8 >= 6 ? 3 : 0;
    const phraseAnswerDrop = bar % 4 === 3 ? -5 : bar % 4 === 1 ? -2 : 0;

    motif.offsets.forEach((offset, index) => {
      const useNextChord = offset >= 12;
      const activeRegister = useNextChord ? nextRegister : register;
      const activeAnchor = useNextChord ? nextAnchorMidi : anchorMidi;
      const activePitchClasses = useNextChord ? nextChordPitchClasses : chordPitchClasses;
      const activeStrictPitchClasses = useNextChord ? getSoloPianoChordPitchClasses(nextChord, false) : strictChordPitchClasses;
      const phraseHumanShift = (((analysis.promptSeed >> ((bar + index) % 17)) + index + bar) % 3) - 1;
      const rawMidi =
        activeAnchor +
        motif.intervals[index] +
        contourLift +
        phraseAnswerDrop +
        phraseHumanShift;
      const shouldResolveToChordTone = offset === 0 || offset === 4 || offset === 8 || offset === 12 || offset >= 14;
      let resolvedMidi = findNearestMidiWithPitchClass(
        rawMidi,
        shouldResolveToChordTone ? activeStrictPitchClasses : activePitchClasses,
        activeRegister.min,
        activeRegister.max
      );

      if (previousNote) {
        const previousMidi = noteToMidi(previousNote);
        const maxLeap = isChorus ? 17 : 12;
        if (Math.abs(resolvedMidi - previousMidi) > maxLeap) {
          resolvedMidi = findNearestMidiWithPitchClass(
            previousMidi + Math.sign(resolvedMidi - previousMidi) * maxLeap,
            shouldResolveToChordTone ? activeStrictPitchClasses : activePitchClasses,
            activeRegister.min,
            activeRegister.max
          );
        }
      }

      const note = midiToMelodyNote(resolvedMidi);
      const duration = motif.durations[index] ?? 1;
      addNote(events, note, base + offset, duration, isValidMelodyNote);

      if (pianoVariant !== 'quiet' && (pianoVariant === 'bright' || pianoVariant === 'lyrical' || isChorus) && index % 3 === 1) {
        const upperMidi = findNearestMidiWithPitchClass(resolvedMidi + 7, activeStrictPitchClasses, activeRegister.min, activeRegister.max);
        addNote(events, midiToMelodyNote(upperMidi), base + offset, 1, isValidMelodyNote);
      }

      if ((pianoVariant === 'sad' || pianoVariant === 'winter' || pianoVariant === 'night') && index % 4 === 0) {
        const lowerMidi = findNearestMidiWithPitchClass(resolvedMidi - 5, activeStrictPitchClasses, activeRegister.min, activeRegister.max);
        if (Math.abs(lowerMidi - resolvedMidi) >= 3) {
          addNote(events, midiToMelodyNote(lowerMidi), base + offset, Math.min(duration, 2), isValidMelodyNote);
        }
      }

      if (pianoVariant !== 'quiet' && index > 0 && offset > 0 && offset < 15 && (pianoVariant === 'rain' || pianoVariant === 'night' || pianoVariant === 'lyrical' || isChorus)) {
        const approachDirection = ((analysis.promptSeed + bar + index) % 2 === 0 ? -1 : 1);
        const approachMidi = findNearestMidiWithPitchClass(resolvedMidi + approachDirection * 2, activePitchClasses, activeRegister.min, activeRegister.max);
        if (approachMidi !== resolvedMidi) {
          addNote(events, midiToMelodyNote(approachMidi), base + Math.max(0, offset - 1), 1, isValidMelodyNote);
        }
      }

      previousNote = note;
    });

    const highRegister = {
      min: pianoVariant === 'sad' || pianoVariant === 'winter' ? 72 : 76,
      max: pianoVariant === 'bright' ? 108 : 103,
    };
    const highAnchor = chooseSoloPianoAnchorMidi(chord, analysis, bar + 31, highRegister.min, highRegister.max);
    const highAnswer = findNearestMidiWithPitchClass(
      highAnchor + (bar % 2 === 0 ? 4 : -3),
      chordPitchClasses,
      highRegister.min,
      highRegister.max
    );

    if (!isBridge && (bar % 2 === 1 || isChorus || pianoVariant === 'lyrical')) {
      addNote(events, midiToMelodyNote(highAnchor), base + 6, 1, isValidMelodyNote);
      addNote(events, midiToMelodyNote(highAnswer), base + 14, 1, isValidMelodyNote);
    }

    if (bar % 4 === 3) {
      const resolutionMidi = findNearestMidiWithPitchClass(
        nextAnchorMidi,
        getSoloPianoChordPitchClasses(nextChord, false),
        nextRegister.min,
        nextRegister.max
      );
      addNote(events, midiToMelodyNote(resolutionMidi), base + 14, 2, isValidMelodyNote);
      previousNote = midiToMelodyNote(resolutionMidi);
    }
  }

  return events;
}

function getMelodyStackNotes(palette: string[], leadNote: string, bar: number, index: number, variation: number) {
  const leadMidi = noteToMidi(leadNote);
  const below = palette
    .filter((note) => note !== leadNote)
    .filter((note) => {
      const distance = leadMidi - noteToMidi(note);
      return distance >= 3 && distance <= 12;
    })
    .sort((a, b) => Math.abs(leadMidi - noteToMidi(a)) - Math.abs(leadMidi - noteToMidi(b)));
  const above = palette
    .filter((note) => note !== leadNote)
    .filter((note) => {
      const distance = noteToMidi(note) - leadMidi;
      return distance >= 3 && distance <= 12;
    })
    .sort((a, b) => Math.abs(leadMidi - noteToMidi(a)) - Math.abs(leadMidi - noteToMidi(b)));

  const firstSupport = below[(bar + variation) % Math.max(1, below.length)] ?? above[0];
  const secondSupport = (bar + index + variation) % 4 === 0 ? above[0] : undefined;

  return uniqueNotes([firstSupport, secondSupport].filter((note): note is string => Boolean(note))).slice(0, 2);
}

function getOpeningMelodyNote(analysis: PromptAnalysis, chord: ChordName) {
  const styleOpenings: Record<string, Partial<Record<ChordName, string[]>>> = {
    winterCityPop: { A: ['C5', 'E4'], F: ['A4', 'C5'], C: ['G4', 'E5'], G: ['B4', 'D5'], E: ['G4', 'B4'] },
    snowNightDreamPop: { A: ['E4', 'C4'], F: ['C4', 'A4'], C: ['E4', 'G4'], G: ['D4', 'B4'] },
    warmWinterJazz: { D: ['F4', 'A4'], G: ['B4', 'D5'], C: ['E4', 'G4'], A: ['C5', 'E4'], F: ['A4', 'C5'] },
    winterDawnLofi: { A: ['C4', 'E4'], F: ['A3', 'C4'], C: ['E4', 'C4'], G: ['B3', 'D4'], E: ['G3', 'B3'] },
    christmasJazz: { C: ['E4', 'G4'], F: ['A4', 'C5'], D: ['F4', 'A4'], G: ['B4', 'D5'] },
    carolPop: { C: ['G4', 'C5'], F: ['A4', 'F4'], G: ['D5', 'B4'] },
    snowPiano: { C: ['C4', 'E4'], F: ['F4', 'A3'], A: ['C4', 'E4'], G: ['D4', 'G3'] },
    coldSynthPop: { A: ['A4', 'C5'], G: ['B4', 'D5'], F: ['C5', 'A4'], E: ['B4', 'G4'] },
    lonelyWinterBallad: { A: ['E4', 'C4'], F: ['A4', 'F4'], C: ['G4', 'E4'], G: ['D4', 'B3'] },
    fireplaceAcoustic: { C: ['E4', 'G4'], G: ['D4', 'B3'], F: ['A3', 'C4'], A: ['C4', 'E4'] },
    winterCafeBossa: { D: ['A4', 'F4'], G: ['B4', 'D5'], C: ['G4', 'E4'], A: ['E4', 'C5'] },
    frozenForestAmbient: { A: ['C4', 'A3'], F: ['C4', 'F3'], G: ['D4', 'G3'], C: ['E4', 'C4'] },
    yearEndMemory: { F: ['A4', 'C5'], G: ['B4', 'D5'], E: ['G4', 'B4'], A: ['C5', 'E4'], C: ['E4', 'G4'] },
    firstSnowRomance: { C: ['G4', 'E4'], G: ['B4', 'D5'], A: ['C5', 'E4'], F: ['A4', 'C5'] },
    newYearHope: { C: ['C5', 'G4'], G: ['D5', 'B4'], F: ['C5', 'A4'] },
    cherryBlossomMood: { C: ['E5', 'G4'], G: ['D5', 'B4'], A: ['C5', 'E4'], F: ['A4', 'C5'] },
    firstLoveFlutter: { C: ['G4', 'C5'], G: ['B4', 'D5'], F: ['A4', 'C5'] },
    springRainLofi: { A: ['C4', 'E4'], F: ['A3', 'C4'], C: ['E4', 'G4'], G: ['D4', 'B3'] },
    beachDrive: { C: ['E4', 'G4'], G: ['B4', 'D5'], F: ['C5', 'A4'] },
    summerCityPop: { F: ['A4', 'C5'], G: ['B4', 'D5'], E: ['G4', 'B4'], A: ['C5', 'E5'], C: ['G4', 'E5'] },
    summerNightCityPop: { F: ['C4', 'A4'], G: ['D4', 'B4'], E: ['G4', 'B4'], A: ['C5', 'E4'], C: ['E4', 'G4'] },
    tropicalHouse: { C: ['G4', 'E5'], A: ['E5', 'C5'], F: ['C5', 'A4'], G: ['D5', 'B4'] },
    summerNightMood: { F: ['C4', 'A4'], G: ['D4', 'B4'], E: ['G4', 'B4'], A: ['C5', 'E4'] },
    monsoonLofi: { A: ['E4', 'C4'], F: ['C4', 'A3'], C: ['G3', 'E4'], G: ['D4', 'B3'] },
    fallenLeavesMood: { A: ['C4', 'E4'], F: ['A4', 'F4'], C: ['E4', 'G4'], G: ['D4', 'B3'] },
    rainCafe: { A: ['C4', 'E4'], F: ['C4', 'A3'], C: ['E4', 'G4'], G: ['B3', 'D4'] },
    nightDrive: { F: ['A4', 'C5'], G: ['B4', 'D5'], E: ['G4', 'B4'], A: ['C5', 'E4'] },
    spaceStation: { A: ['E4', 'C5'], F: ['C5', 'A4'], C: ['G4', 'E5'], G: ['D5', 'B4'] },
    battleBoss: { A: ['A4', 'E5'], G: ['G4', 'D5'], F: ['F4', 'C5'], C: ['C5', 'G4'] },
    dreamyFeeling: { A: ['C4', 'E4'], F: ['A3', 'C4'], C: ['E4', 'G3'], G: ['D4', 'B3'] },
    mysticFeeling: { A: ['A3', 'C4'], F: ['F3', 'C4'], G: ['G3', 'D4'], C: ['C4', 'E4'] },
  };
  const directStyleCandidates = styleOpenings[analysis.styleId]?.[chord];
  if (!directStyleCandidates && isSoloPianoStyle(analysis)) {
    const pianoOpeningPalette = getConstrainedLeadPalette(chord, analysis, null);
    const lowerThird = pianoOpeningPalette.filter((note) => noteToMidi(note) <= 72);
    const upperThird = pianoOpeningPalette.filter((note) => noteToMidi(note) >= 72);
    const expressiveCandidates =
      getSoloPianoVariant(analysis) === 'sad' || getSoloPianoVariant(analysis) === 'winter'
        ? lowerThird
        : getSoloPianoVariant(analysis) === 'bright'
          ? upperThird
          : pianoOpeningPalette;
    const promptOpeningShift = (analysis.promptSeed >> 4) % Math.max(1, expressiveCandidates.length);
    return expressiveCandidates[(analysis.variation + promptOpeningShift) % expressiveCandidates.length] ?? pianoOpeningPalette[0] ?? LEAD_MELODY_TONES[chord][0];
  }
  const styleCandidates =
    directStyleCandidates ??
    (analysis.styleId !== analysis.theme
      ? LEAD_MELODY_TONES[chord].slice((createSeed(analysis.styleId) + analysis.variation) % 3, ((createSeed(analysis.styleId) + analysis.variation) % 3) + 4)
      : undefined);
  if (styleCandidates) {
    return styleCandidates[analysis.variation % styleCandidates.length] ?? styleCandidates[0];
  }

  const themeOpenings: Partial<Record<Theme, Partial<Record<ChordName, string[]>>>> = {
    christmas: {
      C: ['G4', 'E4', 'C5', 'C4'],
      D: ['A4', 'F4', 'D5'],
      E: ['B4', 'G4', 'E5'],
      F: ['A4', 'F4', 'C5', 'F5'],
      G: ['B4', 'G4', 'D5', 'G5'],
      A: ['C5', 'E4', 'A4'],
      B: ['D5', 'F4', 'B4'],
    },
    winter: {
      A: ['E4', 'C4'],
      F: ['C4', 'F4'],
      C: ['E4', 'G4'],
    },
    spring: {
      C: ['G4', 'E4'],
      F: ['A4', 'C4'],
      G: ['B4', 'D4'],
    },
    calm: {
      C: ['C4', 'E4'],
      F: ['F4', 'C4'],
      G: ['G4', 'D4'],
    },
    summerSea: {
      C: ['E4', 'G4'],
      F: ['A4', 'C4'],
      G: ['B4', 'G4'],
    },
    summerNight: {
      F: ['C4', 'A4'],
      A: ['C4', 'E4'],
      C: ['E4', 'G4'],
    },
    rainyNight: {
      A: ['C4', 'E4'],
      F: ['C4', 'F4'],
      G: ['D4', 'G4'],
    },
    breakup: {
      A: ['E4', 'C4'],
      F: ['A4', 'F4'],
      C: ['G4', 'E4'],
    },
    cafeLofi: {
      A: ['C4', 'E4'],
      C: ['E4', 'G4'],
      F: ['C4', 'A4'],
    },
    kpopDance: {
      A: ['A4', 'E4'],
      F: ['A4', 'C4'],
      C: ['G4', 'E4'],
    },
    gameBgm: {
      C: ['G4', 'C4'],
      F: ['F4', 'A4'],
      A: ['E4', 'A4'],
    },
    cinematic: {
      A: ['C4', 'E4'],
      C: ['G4', 'E4'],
      F: ['C4', 'F4'],
    },
  };
  const candidates = themeOpenings[analysis.theme]?.[chord] ?? getLeadMelodyTonePalette(chord, analysis);
  const promptOpeningShift = (analysis.promptSeed >> 3) % Math.max(1, candidates.length);
  return candidates[(analysis.variation + promptOpeningShift) % candidates.length] ?? getLeadMelodyTonePalette(chord, analysis)[(analysis.variation + promptOpeningShift) % 3];
}

function createPromptIntentText(prompt: string) {
  const userPromptOnly = prompt
    .replace(/프로젝트 설정:[\s\S]*$/i, '')
    .replace(/\?꾨줈\?앺듃 \?ㅼ젙:[\s\S]*$/i, '');

  const meaningfulLabels = new Set([
    '분위기',
    '참고곡',
    '사용 악기',
    '악기',
    '리듬 무드',
    '리듬',
    '멜로디/베이스 구분',
    '멜로디',
    '베이스',
    '강조하고 싶은 요소',
    '강조',
    '상세 요청',
    '한 줄 요약',
  ]);

  return userPromptOnly
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^(?:[-*•]\s*)?([^:：]+)[:：]\s*(.*)$/);
      if (!match) return line;

      const label = match[1]?.trim() ?? '';
      const value = match[2]?.trim() ?? '';
      if (!value) return '';
      return meaningfulLabels.has(label) ? `${label} ${value}` : value;
    })
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function createPromptIntentTextLegacy(prompt: string) {
  const userPromptOnly = prompt.split(/프로젝트 설정:/i)[0] ?? prompt;

  return userPromptOnly
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^[-•]?\s*([^:：]+)[:：]\s*(.*)$/);
      if (!match) return line;

      const value = match[2]?.trim() ?? '';
      return value;
    })
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

void createPromptIntentTextLegacy;

function normalizePromptTextForAi(prompt: string) {
  return prompt
    .replace(/\r/g, '\n')
    .replace(/\u3000/g, ' ')
    .normalize('NFKC');
}

function createPromptIntentTextReadable(prompt: string) {
  const normalized = normalizePromptTextForAi(prompt)
    .replace(/\ub300\ud654\s*\uc774\ub825\s*:[\s\S]*$/i, '')
    .replace(/\ud504\ub85c\uc81d\ud2b8\s*\uc124\uc815\s*:[\s\S]*$/i, '')
    .replace(/project\s*settings\s*:[\s\S]*$/i, '');

  const meaningfulLabels = [
    '\ubd84\uc704\uae30',
    '\ucc38\uace0\uace1',
    '\uc0ac\uc6a9 \uc545\uae30',
    '\uc545\uae30',
    '\ub9ac\ub4ec \ubb34\ub4dc',
    '\ub9ac\ub4ec',
    '\uba5c\ub85c\ub514/\ubca0\uc774\uc2a4 \uad6c\ubd84',
    '\uba5c\ub85c\ub514',
    '\ubca0\uc774\uc2a4',
    '\uac15\uc870\ud558\uace0 \uc2f6\uc740 \uc694\uc18c',
    '\uac15\uc870',
    '\uc0c1\uc138 \uc694\uccad',
    '\ud55c \uc904 \uc694\uc57d',
    '\uc694\uc57d',
    'mood',
    'reference',
    'references',
    'instrument',
    'instruments',
    'rhythm',
    'melody',
    'bass',
    'emphasis',
    'detail',
    'details',
    'summary',
  ];

  return normalized
    .split(/\n/)
    .map((line) => line.trim().replace(/^[\-*•\s]+/, '').trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^([^:：]+)[:：]\s*(.*)$/);
      if (!match) return line;

      const label = (match[1] ?? '').trim().toLowerCase();
      const value = (match[2] ?? '').trim();
      if (!value) return '';
      const keepLabel = meaningfulLabels.some((keyword) => label.includes(keyword));
      return keepLabel ? `${label} ${value}` : value;
    })
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasNegatedInstrument(text: string, keywords: string[]) {
  return keywords.some((keyword) =>
    [
      `${keyword} 없이`,
      `${keyword} 빼고`,
      `${keyword} 제외`,
      `${keyword} 넣지`,
      `${keyword} 쓰지`,
      `no ${keyword}`,
      `without ${keyword}`,
    ].some((phrase) => text.includes(phrase))
  );
}

function detectTheme(intentText: string): Theme {
  if (includesAny(intentText, ['크리스마스', '캐롤', '성탄', 'christmas', 'carol', 'xmas'])) return 'christmas';
  if (includesAny(intentText, ['겨울', '눈', '차가운', '서리', 'winter', 'snow'])) return 'winter';
  if (includesAny(intentText, ['여름 밤', '여름밤', 'summer night'])) return 'summerNight';
  if (includesAny(intentText, ['여름 바다', '바다', '해변', '파도', '서핑', 'summer sea', 'beach', 'ocean'])) return 'summerSea';
  if (includesAny(intentText, ['봄', '벚꽃', '봄날', 'spring'])) return 'spring';
  if (includesAny(intentText, ['비 오는', '비오는', '빗소리', '장마', 'rain', 'rainy'])) return 'rainyNight';
  if (includesAny(intentText, ['이별', '헤어진', '그리운', '눈물', '슬픈 발라드', 'breakup'])) return 'breakup';
  if (includesAny(intentText, ['카페', '로파이', 'lofi', 'lo-fi', '공부', '작업'])) return 'cafeLofi';
  if (includesAny(intentText, ['영화', '시네마틱', '웅장', '오케스트라', 'ost', '드라마틱', 'cinematic'])) return 'cinematic';
  if (includesAny(intentText, ['케이팝', 'k-pop', 'kpop', '아이돌', '댄스곡', '후렴 터지는', '후렴이 터지는'])) return 'kpopDance';
  if (includesAny(intentText, ['게임', 'game', 'rpg', '브금', 'bgm', '전투', '스테이지'])) return 'gameBgm';
  if (includesAny(intentText, ['밤', '야경', '새벽', 'night'])) return 'night';
  if (isSoftIntent(intentText) && !isEnergeticIntent(intentText)) return 'calm';
  if (includesAny(intentText, ['케이팝', 'k-pop', 'kpop', '아이돌', '댄스곡', '후렴 터지는', '후렴이 터지는'])) return 'kpopDance';
  if (includesAny(intentText, ['게임', 'game', 'rpg', '브금', 'bgm', '전투', '스테이지'])) return 'gameBgm';
  if (includesAny(intentText, ['영화', '시네마틱', '웅장', '오케스트라', 'ost', '드라마틱', 'cinematic'])) return 'cinematic';
  if (includesAny(intentText, ['이별', '헤어진', '그리움', '눈물', '슬픈 발라드', 'breakup'])) return 'breakup';
  if (includesAny(intentText, ['비 오는', '비오는', '빗소리', '장마', 'rain', 'rainy'])) return 'rainyNight';
  if (includesAny(intentText, ['카페', '로파이', 'lofi', 'lo-fi', '공부', '작업'])) return 'cafeLofi';
  if (includesAny(intentText, ['크리스마스', '캐롤', '성탄', 'christmas', 'carol', 'xmas'])) return 'christmas';
  if (includesAny(intentText, ['여름 밤', '여름밤', 'summer night'])) return 'summerNight';
  if (includesAny(intentText, ['겨울', '눈', '차가운', '서리', 'winter', 'snow'])) return 'winter';
  if (includesAny(intentText, ['여름 바다', '바다', '해변', '파도', '서핑', 'summer sea', 'beach', 'ocean'])) return 'summerSea';
  if (includesAny(intentText, ['봄', '벚꽃', 'spring'])) return 'spring';
  if (includesAny(intentText, ['밤', '새벽', '야경', 'night'])) return 'night';
  if (includesAny(intentText, ['공부', '작업', '카페', 'study'])) return 'study';
  if (includesAny(intentText, ['잔잔', '차분', '편안', '조용', 'calm', 'peaceful', 'soft'])) return 'calm';
  return 'default';
}

function createInstrumentPlan(intentText: string, genre: Genre, mood: Mood, theme: Theme): Record<InstrumentKey, boolean> {
  const keywordMap: Record<InstrumentKey, string[]> = {
    melody: ['멜로디', '리드', 'lead', 'topline', '탑라인'],
    drums: ['드럼', '비트', '킥', '스네어', '하이햇', 'beat', 'drum'],
    bass: ['베이스', 'bass', '저음'],
    guitar: ['기타', 'guitar', '어쿠스틱', '일렉'],
    violin: ['바이올린', '현악', '스트링', 'string', 'violin'],
    saxophone: ['색소폰', '섹소폰', 'sax', 'saxophone'],
    glockenspiel: ['글로켄', '글로켄슈필', '벨', 'bell', '반짝'],
    piccolo: ['피콜로', 'piccolo', '휘파람', '높은음'],
    supportingPiano: ['피아노', 'piano', '건반'],
    chicagoStreet: ['시카고', 'street', '거리', '힙합', 'groove', '그루브'],
    studioAltoSax: ['알토', 'alto', '브라스', 'brass'],
  };

  const mentioned: Record<InstrumentKey, boolean> = {
    melody: includesAny(intentText, keywordMap.melody),
    drums: includesAny(intentText, keywordMap.drums),
    bass: includesAny(intentText, keywordMap.bass),
    guitar: includesAny(intentText, keywordMap.guitar),
    violin: includesAny(intentText, keywordMap.violin),
    saxophone: includesAny(intentText, keywordMap.saxophone),
    glockenspiel: includesAny(intentText, keywordMap.glockenspiel),
    piccolo: includesAny(intentText, keywordMap.piccolo),
    supportingPiano: includesAny(intentText, keywordMap.supportingPiano),
    chicagoStreet: includesAny(intentText, keywordMap.chicagoStreet),
    studioAltoSax: includesAny(intentText, keywordMap.studioAltoSax),
  };
  const excluded: Record<InstrumentKey, boolean> = {
    melody: hasNegatedInstrument(intentText, keywordMap.melody),
    drums: hasNegatedInstrument(intentText, keywordMap.drums),
    bass: hasNegatedInstrument(intentText, keywordMap.bass),
    guitar: hasNegatedInstrument(intentText, keywordMap.guitar),
    violin: hasNegatedInstrument(intentText, keywordMap.violin),
    saxophone: hasNegatedInstrument(intentText, keywordMap.saxophone),
    glockenspiel: hasNegatedInstrument(intentText, keywordMap.glockenspiel),
    piccolo: hasNegatedInstrument(intentText, keywordMap.piccolo),
    supportingPiano: hasNegatedInstrument(intentText, keywordMap.supportingPiano),
    chicagoStreet: hasNegatedInstrument(intentText, keywordMap.chicagoStreet),
    studioAltoSax: hasNegatedInstrument(intentText, keywordMap.studioAltoSax),
  };
  const hasExplicitInstrument = Object.values(mentioned).some(Boolean);
  const onlyRequested =
    hasExplicitInstrument &&
    includesAny(intentText, ['만', 'only', '위주', '중심']) &&
    !includesAny(intentText, ['같이', '함께', '추가', '섞', '레이어']);

  const plan: Record<InstrumentKey, boolean> = {
    melody: true,
    drums: mentioned.drums || genre === 'dance' || genre === 'rock' || genre === 'citypop',
    bass: mentioned.bass || genre === 'dance' || genre === 'rock' || genre === 'citypop' || genre === 'lofi',
    guitar: mentioned.guitar || genre === 'rock' || genre === 'citypop',
    violin: mentioned.violin || genre === 'ballad' || theme === 'winter' || theme === 'christmas',
    saxophone: mentioned.saxophone || genre === 'jazz',
    glockenspiel: mentioned.glockenspiel || theme === 'christmas' || theme === 'winter' || theme === 'summerSea',
    piccolo: mentioned.piccolo || theme === 'christmas' || theme === 'summerSea',
    supportingPiano: mentioned.supportingPiano || genre === 'ballad' || genre === 'lofi' || mood === 'calm',
    chicagoStreet: mentioned.chicagoStreet || genre === 'dance' || genre === 'rock',
    studioAltoSax: mentioned.studioAltoSax || genre === 'jazz',
  };

  if (genre === 'default' && theme === 'default' && !hasExplicitInstrument) {
    plan.drums = !includesAny(intentText, ['잔잔', '차분', '조용', '몽환']);
    plan.bass = true;
    plan.guitar = false;
    plan.violin = mood === 'sad' || mood === 'dreamy';
    plan.saxophone = false;
    plan.glockenspiel = mood === 'bright' || mood === 'dreamy';
    plan.piccolo = false;
    plan.supportingPiano = mood === 'calm' || mood === 'dreamy';
    plan.chicagoStreet = false;
    plan.studioAltoSax = false;
  }

  if (!hasExplicitInstrument) {
    if (theme === 'christmas') {
      plan.drums = true;
      plan.bass = true;
      plan.guitar = false;
      plan.violin = false;
      plan.saxophone = false;
      plan.glockenspiel = true;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
      plan.studioAltoSax = false;
    }

    if (theme === 'winter') {
      plan.drums = false;
      plan.bass = true;
      plan.guitar = false;
      plan.violin = true;
      plan.saxophone = false;
      plan.glockenspiel = true;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
      plan.studioAltoSax = false;
    }

    if (theme === 'summerSea') {
      plan.drums = true;
      plan.bass = true;
      plan.guitar = true;
      plan.violin = false;
      plan.saxophone = genre === 'citypop';
      plan.glockenspiel = true;
      plan.piccolo = true;
      plan.supportingPiano = false;
      plan.chicagoStreet = false;
      plan.studioAltoSax = false;
    }

    if (theme === 'spring') {
      plan.drums = true;
      plan.bass = true;
      plan.guitar = true;
      plan.violin = false;
      plan.saxophone = false;
      plan.glockenspiel = true;
      plan.piccolo = true;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
      plan.studioAltoSax = false;
    }

    if (theme === 'rainyNight') {
      plan.drums = false;
      plan.bass = true;
      plan.guitar = false;
      plan.violin = true;
      plan.saxophone = false;
      plan.glockenspiel = true;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
      plan.studioAltoSax = false;
    }

    if (theme === 'breakup') {
      plan.drums = false;
      plan.bass = true;
      plan.guitar = false;
      plan.violin = true;
      plan.saxophone = false;
      plan.glockenspiel = false;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
      plan.studioAltoSax = false;
    }

    if (theme === 'cafeLofi') {
      plan.drums = true;
      plan.bass = true;
      plan.guitar = false;
      plan.violin = false;
      plan.saxophone = false;
      plan.glockenspiel = true;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
      plan.studioAltoSax = false;
    }

    if (theme === 'kpopDance') {
      plan.drums = true;
      plan.bass = true;
      plan.guitar = true;
      plan.violin = false;
      plan.saxophone = false;
      plan.glockenspiel = true;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = true;
      plan.studioAltoSax = false;
    }

    if (theme === 'gameBgm') {
      plan.drums = true;
      plan.bass = true;
      plan.guitar = false;
      plan.violin = false;
      plan.saxophone = false;
      plan.glockenspiel = true;
      plan.piccolo = true;
      plan.supportingPiano = true;
      plan.chicagoStreet = true;
      plan.studioAltoSax = false;
    }

    if (theme === 'cinematic') {
      plan.drums = false;
      plan.bass = true;
      plan.guitar = false;
      plan.violin = true;
      plan.saxophone = false;
      plan.glockenspiel = false;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
      plan.studioAltoSax = false;
    }

    if (theme === 'summerNight') {
      plan.drums = true;
      plan.bass = true;
      plan.guitar = true;
      plan.violin = false;
      plan.saxophone = genre === 'citypop';
      plan.glockenspiel = true;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
      plan.studioAltoSax = genre === 'jazz';
    }

    if (theme === 'night') {
      plan.guitar = genre === 'citypop';
      plan.violin = true;
      plan.glockenspiel = true;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
    }

    if (theme === 'calm') {
      plan.drums = false;
      plan.bass = true;
      plan.guitar = false;
      plan.violin = false;
      plan.saxophone = false;
      plan.glockenspiel = false;
      plan.piccolo = false;
      plan.supportingPiano = true;
      plan.chicagoStreet = false;
      plan.studioAltoSax = false;
    }
  }

  if (hasExplicitInstrument) {
    plan.guitar = mentioned.guitar || (genre === 'rock' && !mentioned.supportingPiano);
    plan.violin = mentioned.violin || (genre === 'ballad' && mood === 'sad');
    plan.saxophone = mentioned.saxophone || genre === 'jazz';
    plan.glockenspiel = mentioned.glockenspiel || (mood === 'bright' && genre !== 'rock');
    plan.piccolo = mentioned.piccolo;
    plan.supportingPiano = mentioned.supportingPiano || genre === 'ballad' || genre === 'lofi';
    plan.chicagoStreet = mentioned.chicagoStreet || genre === 'dance';
    plan.studioAltoSax = mentioned.studioAltoSax || (mentioned.saxophone && genre === 'jazz');
  }

  if (onlyRequested) {
    (Object.keys(plan) as InstrumentKey[]).forEach((instrument) => {
      plan[instrument] = mentioned[instrument];
    });
    plan.melody = true;
  }

  if (includesAny(intentText, ['잔잔', '차분', '미니멀', 'minimal', '조용'])) {
    plan.piccolo = mentioned.piccolo;
    plan.chicagoStreet = mentioned.chicagoStreet;
    plan.studioAltoSax = mentioned.studioAltoSax || genre === 'jazz';
  }

  if (isSoftIntent(intentText) && !isEnergeticIntent(intentText)) {
    plan.drums = mentioned.drums;
    plan.bass = true;
    plan.guitar = mentioned.guitar || genre === 'citypop';
    plan.violin = mentioned.violin || mood === 'sad' || theme === 'winter';
    plan.saxophone = mentioned.saxophone || genre === 'jazz';
    plan.glockenspiel = mentioned.glockenspiel || theme === 'winter' || mood === 'dreamy';
    plan.piccolo = mentioned.piccolo;
    plan.supportingPiano = true;
    plan.chicagoStreet = mentioned.chicagoStreet;
    plan.studioAltoSax = mentioned.studioAltoSax;
  }

  const hasDarkOrSadIntent = includesAny(intentText, [
    '\uc2ac\ud508',
    '\uc4f8\uc4f8',
    '\uc6b0\uc6b8',
    '\uc544\ub828',
    '\uacf5\ud5c8',
    '\uc678\ub85c',
    '\uadf8\ub9ac\uc6b4',
    '\uc5b4\ub450',
    '\ucc28\uac00\uc6b4',
    '\ubb34\uc11c',
    '\uae34\uc7a5',
    '\uc5bc\uc5b4\ubd99',
  ]);
  const hasQuietDreamIntent = includesAny(intentText, [
    '\uc794\uc794',
    '\uc870\uc6a9',
    '\ud3b8\uc548',
    '\ud3c9\ud654',
    '\ubabd\ud658',
    '\uc2e0\ube44',
    '\uace0\uc694',
    '\uc0c8\ubcbd',
  ]);
  const hasBrightOrEnergeticIntent = includesAny(intentText, [
    '\ubc1d\uc740',
    '\uccad\ub7c9',
    '\uc2e0\ub098',
    '\ud589\ubcf5',
    '\uc124\ub808',
    '\ud76c\ub9dd',
    '\ubc85\ucc28',
    'edm',
    '\ub304\uc2a4',
    '\ub514\uc2a4\ucf54',
  ]);

  if ((hasDarkOrSadIntent || hasQuietDreamIntent || mood === 'sad' || mood === 'calm') && !hasBrightOrEnergeticIntent) {
    plan.drums = mentioned.drums || (genre === 'lofi' && !hasDarkOrSadIntent && theme !== 'calm');
    plan.bass = mentioned.bass || (!hasQuietDreamIntent && theme !== 'calm');
    plan.guitar = mentioned.guitar || (genre === 'citypop' && !hasDarkOrSadIntent);
    plan.violin = mentioned.violin || mood === 'sad' || hasDarkOrSadIntent || theme === 'winter';
    plan.saxophone = mentioned.saxophone || (genre === 'jazz' && !hasDarkOrSadIntent);
    plan.glockenspiel = mentioned.glockenspiel || (theme === 'winter' && hasQuietDreamIntent && !hasDarkOrSadIntent);
    plan.piccolo = mentioned.piccolo;
    plan.supportingPiano = true;
    plan.chicagoStreet = mentioned.chicagoStreet && !hasDarkOrSadIntent;
    plan.studioAltoSax = mentioned.studioAltoSax || (genre === 'citypop' && mood === 'dreamy' && !hasDarkOrSadIntent);
  }

  (Object.keys(plan) as InstrumentKey[]).forEach((instrument) => {
    if (excluded[instrument]) {
      plan[instrument] = false;
    }
  });
  plan.melody = !excluded.melody;

  return plan;
}

function buildExplicitInstrumentPlanFromText(sourceText: string): Partial<Record<InstrumentKey, boolean>> | null {
  const source = normalizePromptTextForAi(sourceText).toLowerCase();
  const has = (keywords: string[]) => keywords.some((keyword) => source.includes(keyword));
  const requested = {
    melody: has(['\uba5c\ub85c\ub514', '\ub9ac\ub4dc', 'lead', 'topline']),
    drums: has(['\ub4dc\ub7fc', '\ube44\ud2b8', '\ub9ac\ub4ec', 'drum', 'beat']),
    bass: has(['\ubca0\uc774\uc2a4', 'bass']),
    guitar: has(['\ud1b5\uae30\ud0c0', '\uae30\ud0c0', '\uc5b4\ucfe0\uc2a4\ud2f1', 'guitar', 'acoustic']),
    violin: has(['\ubc14\uc774\uc62c\ub9b0', '\ud604\uc545', '\uc2a4\ud2b8\ub9c1', 'string', 'violin']),
    saxophone: has(['\uc0c9\uc18c\ud3f0', '\uc0c9\uc18c\ud3f0', '\uc54c\ud1a0 \uc0c9\uc18c\ud3f0', 'sax', 'saxophone', 'alto sax']),
    glockenspiel: has(['\uae00\ub85c\ucf04\uc288\ud544', '\uae00\ub85c\ucf04', '\ubca8', '\uc885\uc18c\ub9ac', 'glockenspiel', 'bell']),
    piccolo: has(['\ud53c\ucf5c\ub85c', 'piccolo']),
    supportingPiano: has(['\uc11c\ud3ec\ud305 \uce90\uc2a4\ud2b8 \ud53c\uc544\ub178', '\uc11c\ud3ec\ud305', '\ud53c\uc544\ub178', '\uac74\ubc18', 'piano']),
    chicagoStreet: has(['\uc2dc\uce74\uace0 \uc2a4\ud2b8\ub9bf', '\uc2a4\ud2b8\ub9bf', 'chicago', 'street', 'groove']),
    studioAltoSax: has(['\uc2a4\ud29c\ub514\uc624 \uc54c\ud1a0 \uc0c9\uc18c\ud3f0', '\uc54c\ud1a0', '\ube0c\ub77c\uc2a4', 'studio alto', 'alto', 'brass']),
  };

  if (!Object.values(requested).some(Boolean)) return null;

  return {
    melody: true,
    drums: requested.drums,
    bass: requested.bass,
    guitar: requested.guitar,
    violin: requested.violin,
    saxophone: false,
    glockenspiel: requested.glockenspiel,
    piccolo: requested.piccolo,
    supportingPiano: requested.supportingPiano,
    chicagoStreet: requested.chicagoStreet,
    studioAltoSax: requested.studioAltoSax || requested.saxophone,
  };
}

function getReadableExplicitInstrumentPlan(promptText: string): Partial<Record<InstrumentKey, boolean>> | null {
  const normalizedText = normalizePromptTextForAi(promptText);
  const instrumentLine = normalizedText
    .split(/\n/)
    .map((line) => line.trim())
    .find((line) =>
      /^(\uc0ac\uc6a9\s*)?\uc545\uae30\s*[:：]/i.test(line) ||
      /^\uc0ac\uc6a9\s*\uc545\uae30\s*[:：]/i.test(line) ||
      /^instruments?\s*[:：]/i.test(line)
    );

  if (instrumentLine) {
    const value = instrumentLine.replace(/^([^:：]+)[:：]\s*/, '');
    return buildExplicitInstrumentPlanFromText(value);
  }

  return null;
}

function getExplicitInstrumentPlan(promptText: string): Partial<Record<InstrumentKey, boolean>> | null {
  const intentText = promptText.toLowerCase();
  const match = intentText.match(/(?:\uc0ac\uc6a9\s*\uc545\uae30|\uc545\uae30)\s*[:：]\s*([^\n]+)/i);
  const source = match?.[1]?.toLowerCase();
  if (!source) return null;

  const has = (keywords: string[]) => keywords.some((keyword) => source.includes(keyword));
  const requested = {
    melody: has(['\uba5c\ub85c\ub514', 'lead', 'topline']),
    drums: has(['\ub4dc\ub7fc', '\ube44\ud2b8', 'drum', 'beat']),
    bass: has(['\ubca0\uc774\uc2a4', 'bass']),
    guitar: has(['\uae30\ud0c0', 'guitar', 'acoustic']),
    violin: has(['\ubc14\uc774\uc62c\ub9b0', '\ud604\uc545', 'string', 'violin']),
    saxophone: has(['\uc0c9\uc18c\ud3f0', '\uc0c9\uc18c\ud3f0', 'sax', 'saxophone']),
    glockenspiel: has(['\uae00\ub85c\ucf04', '\uae00\ub85c\ucf04\uc288\ud544', '\ubca8', 'bell']),
    piccolo: has(['\ud53c\ucf5c\ub85c', 'piccolo']),
    supportingPiano: has(['\ud53c\uc544\ub178', '\uac74\ubc18', 'piano']),
    chicagoStreet: has(['\uc2a4\ud2b8\ub9bf', 'street', 'groove', '\uadf8\ub8e8\ube0c']),
    studioAltoSax: has(['\uc54c\ud1a0', 'alto', '\ube0c\ub77c\uc2a4', 'brass']),
  };

  const hasAnyRequested = Object.values(requested).some(Boolean);
  if (!hasAnyRequested) return null;

  return {
    melody: true,
    drums: requested.drums,
    bass: requested.bass,
    guitar: requested.guitar,
    violin: requested.violin,
    saxophone: requested.saxophone,
    glockenspiel: requested.glockenspiel,
    piccolo: requested.piccolo,
    supportingPiano: requested.supportingPiano,
    chicagoStreet: requested.chicagoStreet,
    studioAltoSax: requested.studioAltoSax,
  };
}

function getExplicitInstrumentPlanFromPrompt(promptText: string): Partial<Record<InstrumentKey, boolean>> | null {
  const normalizedText = promptText.toLowerCase();
  const instrumentLine = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) =>
      (line.includes('\uc0ac\uc6a9') && line.includes('\uc545\uae30') && line.includes(':')) ||
      (line.includes('instrument') && line.includes(':'))
    );

  if (!instrumentLine) return null;

  const source = instrumentLine.slice(instrumentLine.indexOf(':') + 1);
  const has = (keywords: string[]) => keywords.some((keyword) => source.includes(keyword));
  const requested = {
    melody: has(['\uba5c\ub85c\ub514', 'lead', 'topline']),
    drums: has(['\ub4dc\ub7fc', '\ube44\ud2b8', 'drum', 'beat']),
    bass: has(['\ubca0\uc774\uc2a4', 'bass']),
    guitar: has(['\uae30\ud0c0', 'guitar', 'acoustic']),
    violin: has(['\ubc14\uc774\uc62c\ub9b0', '\ud604\uc545', 'string', 'violin']),
    saxophone: has(['\uc0c9\uc18c\ud3f0', 'sax', 'saxophone']),
    glockenspiel: has(['\uae00\ub85c\ucf04', '\uae00\ub85c\ucf04\uc288\ud544', '\ubca8', 'bell']),
    piccolo: has(['\ud53c\ucf5c\ub85c', 'piccolo']),
    supportingPiano: has(['\ud53c\uc544\ub178', '\uac74\ubc18', 'piano']),
    chicagoStreet: has(['\uc2a4\ud2b8\ub9bf', 'street', 'groove', '\uadf8\ub8e8\ube0c']),
    studioAltoSax: has(['\uc54c\ud1a0', 'alto', '\ube0c\ub77c\uc2a4', 'brass']),
  };

  if (!Object.values(requested).some(Boolean)) return null;

  return {
    melody: true,
    drums: requested.drums,
    bass: requested.bass,
    guitar: requested.guitar,
    violin: requested.violin,
    saxophone: false,
    glockenspiel: requested.glockenspiel,
    piccolo: requested.piccolo,
    supportingPiano: requested.supportingPiano,
    chicagoStreet: requested.chicagoStreet,
    studioAltoSax: requested.studioAltoSax || requested.saxophone,
  };
}

function normalizeAiInstrumentPlanToComposerMenu(instruments: Record<InstrumentKey, boolean>) {
  if (instruments.saxophone) {
    instruments.studioAltoSax = true;
  }

  instruments.violin = false;
  instruments.saxophone = false;
}

function parsePrompt(prompt: string): PromptAnalysis {
  const intentText = createPromptIntentTextReadable(prompt) || createPromptIntentText(prompt);
  const promptSeed = createSeed(intentText || prompt);
  const bpmMatch = intentText.match(/(\d{2,3})\s*(?:bpm|비피엠|템포)?/);
  const requestedBpm = bpmMatch ? Number(bpmMatch[1]) : undefined;
  const styleProfile = getPromptStyleProfile(intentText);
  let theme = styleProfile.theme ?? detectTheme(intentText);
  const softIntent = isSoftIntent(intentText) && !isEnergeticIntent(intentText);

  let genre: Genre = 'default';
  if (includesAny(intentText, ['발라드', '감성'])) genre = 'ballad';
  if (includesAny(intentText, ['로파이', 'lofi', 'lo-fi', '공부'])) genre = 'lofi';
  if (includesAny(intentText, ['시티팝', 'city pop', 'citypop', '도시'])) genre = 'citypop';
  if (includesAny(intentText, ['댄스', 'edm', '신나는', '클럽'])) genre = 'dance';
  if (includesAny(intentText, ['재즈', 'jazz'])) genre = 'jazz';
  if (includesAny(intentText, ['락', '록', 'rock', '밴드'])) genre = 'rock';
  if (includesAny(intentText, ['발라드', 'ballad', '감성', '슬픈'])) genre = 'ballad';
  if (includesAny(intentText, ['lofi', 'lo-fi', '로파이', '잔잔', '공부'])) genre = 'lofi';
  if (includesAny(intentText, ['시티팝', 'city', '도시', '네온'])) genre = 'citypop';
  if (includesAny(intentText, ['댄스', 'edm', '신나는', 'club', '클럽'])) genre = 'dance';
  if (includesAny(intentText, ['재즈', 'jazz', '스윙'])) genre = 'jazz';
  if (includesAny(intentText, ['락', 'rock', '밴드'])) genre = 'rock';
  if (theme === 'kpopDance') genre = 'dance';
  if (theme === 'gameBgm') genre = 'dance';
  if (theme === 'cafeLofi') genre = 'lofi';
  if (theme === 'breakup' || theme === 'cinematic') genre = 'ballad';
  if (theme === 'rainyNight' && genre === 'default') genre = 'lofi';
  if (softIntent && theme === 'default') theme = 'calm';
  if (theme === 'calm' && genre !== 'citypop' && genre !== 'jazz') genre = 'default';
  if (theme === 'christmas' && genre === 'default') genre = 'ballad';
  if (theme === 'winter' && genre === 'default') genre = 'lofi';
  if (theme === 'summerSea' && genre === 'default') genre = 'citypop';
  if (theme === 'summerNight' && genre === 'default') genre = 'citypop';
  if (styleProfile.genre) genre = styleProfile.genre;

  let mood: Mood = 'warm';
  if (includesAny(intentText, ['밝은', '상큼', '기분 좋은', 'happy', 'bright'])) mood = 'bright';
  if (includesAny(intentText, ['슬픈', '우울', 'sad', '이별'])) mood = 'sad';
  if (includesAny(intentText, ['몽환', 'dream', '야경', '새벽'])) mood = 'dreamy';
  if (isEnergeticIntent(intentText)) mood = 'energetic';
  if (softIntent) mood = 'calm';
  if (includesAny(intentText, ['밝', '상큼', '기쁜', 'happy', 'bright'])) mood = 'bright';
  if (includesAny(intentText, ['슬픈', '우울', 'sad', '이별'])) mood = 'sad';
  if (includesAny(intentText, ['몽환', 'dream', '밤', '새벽'])) mood = 'dreamy';
  if (includesAny(intentText, ['신나는', '강한', 'energetic', '빠른'])) mood = 'energetic';
  if (includesAny(intentText, ['잔잔', '차분', 'calm', '따뜻'])) mood = 'calm';
  if (theme === 'kpopDance' || theme === 'gameBgm') mood = 'energetic';
  if (theme === 'breakup' || theme === 'rainyNight') mood = 'sad';
  if (theme === 'cafeLofi') mood = 'calm';
  if (theme === 'calm') mood = 'calm';
  if (theme === 'cinematic') mood = 'dreamy';
  if (theme === 'christmas') mood = 'bright';
  if (theme === 'winter' && mood === 'warm') mood = 'dreamy';
  if (theme === 'summerSea' && mood === 'warm') mood = 'bright';
  if (theme === 'summerNight' && mood === 'warm') mood = 'dreamy';
  if (theme === 'spring' && mood === 'warm') mood = 'bright';
  if (styleProfile.mood) mood = styleProfile.mood;

  const random = createRandom(promptSeed);
  const moodProgressions: ChordName[][] | null =
    mood === 'sad'
      ? [
          ['A', 'F', 'C', 'G'],
          ['A', 'G', 'F', 'C'],
          ['F', 'C', 'G', 'A'],
        ]
      : mood === 'calm'
        ? [
            ['C', 'F', 'C', 'G'],
            ['F', 'C', 'F', 'G'],
            ['A', 'F', 'C', 'G'],
          ]
        : mood === 'dreamy'
          ? [
              ['A', 'F', 'C', 'G'],
              ['F', 'A', 'G', 'A'],
              ['A', 'G', 'F', 'C'],
            ]
          : null;
  const genreProgressions = styleProfile.progressions ?? moodProgressions ?? THEME_PROGRESSIONS[theme] ?? PROGRESSIONS[genre];
  const progression = pick(genreProgressions, random);
  const secondaryProgression =
    genreProgressions.find((candidate) => candidate.join('-') !== progression.join('-')) ??
    pick(PROGRESSIONS.default, random);
  let density =
    mood === 'energetic' || genre === 'dance'
      ? 0.82
      : mood === 'calm' || genre === 'ballad'
        ? 0.55
        : 0.68;
  if (theme === 'winter') density = 0.48;
  if (theme === 'christmas') density = 0.62;
  if (theme === 'summerSea') density = 0.78;
  if (theme === 'summerNight') density = 0.7;
  if (theme === 'spring') density = 0.72;
  if (theme === 'rainyNight') density = 0.46;
  if (theme === 'breakup') density = 0.5;
  if (theme === 'cafeLofi') density = 0.6;
  if (theme === 'kpopDance') density = 0.88;
  if (theme === 'gameBgm') density = 0.82;
  if (theme === 'cinematic') density = 0.54;
  if (theme === 'calm') density = 0.42;
  if (softIntent) density = Math.min(density, genre === 'citypop' ? 0.5 : 0.38);
  if (typeof styleProfile.density === 'number') density = styleProfile.density;

  const baseBpm =
    theme === 'christmas'
      ? 108
      : theme === 'kpopDance'
        ? 124
        : theme === 'gameBgm'
          ? 118
          : theme === 'cafeLofi'
            ? 86
            : theme === 'breakup'
              ? 74
              : theme === 'rainyNight'
                ? 82
                : theme === 'cinematic'
                  ? 88
                  : theme === 'calm'
                    ? 76
                    : theme === 'winter'
                      ? 78
                      : theme === 'summerSea'
                        ? 112
                        : theme === 'summerNight'
                          ? 104
                          : theme === 'spring'
                            ? 102
                            : GENRE_DEFAULT_BPM[genre];
  const profiledBpm = styleProfile.bpm ?? baseBpm;
  const arrangedBpm = softIntent && !requestedBpm ? Math.min(profiledBpm, genre === 'citypop' ? 92 : 82) : profiledBpm;
  const bpm = Math.min(160, Math.max(60, requestedBpm || arrangedBpm));
  const instruments = createInstrumentPlan(intentText, genre, mood, theme);
  if (styleProfile.instruments) {
    (Object.keys(styleProfile.instruments) as InstrumentKey[]).forEach((instrument) => {
      const enabled = styleProfile.instruments?.[instrument];
      if (typeof enabled === 'boolean') {
        instruments[instrument] = enabled;
      }
    });
  }
  const explicitInstrumentPlan =
    getReadableExplicitInstrumentPlan(prompt) ??
    getReadableExplicitInstrumentPlan(intentText) ??
    getExplicitInstrumentPlanFromPrompt(prompt) ??
    getExplicitInstrumentPlan(intentText);
  if (explicitInstrumentPlan) {
    (Object.keys(explicitInstrumentPlan) as InstrumentKey[]).forEach((instrument) => {
      const enabled = explicitInstrumentPlan[instrument];
      if (typeof enabled === 'boolean') {
        instruments[instrument] = enabled;
      }
    });
  }
  normalizeAiInstrumentPlanToComposerMenu(instruments);

  return {
    bpm,
    genre,
    mood,
    progression,
    secondaryProgression,
    density,
    swing: styleProfile.swing ?? (genre === 'jazz' || genre === 'lofi' || theme === 'summerNight' || intentText.includes('스윙')),
    theme,
    styleId: styleProfile.styleId ?? theme,
    variation: (Math.floor(random() * (styleProfile.styleId ? 12 : theme === 'christmas' ? 8 : 4)) + (promptSeed % 17)) % 24,
    promptSeed,
    instruments,
  };
}

function createRuntimeArrangementDiversity(analysis: PromptAnalysis, prompt: string): PromptAnalysis {
  const intentText = createPromptIntentTextReadable(prompt) || createPromptIntentText(prompt);
  const runtimeSeed = createSeed(`${intentText || prompt}:${Date.now()}:${Math.random()}:runtime-diversity`);
  const random = createRandom(runtimeSeed);
  const hasFixedBpm = /(\d{2,3})\s*(?:bpm|비피엠|템포)/i.test(intentText);
  const explicitInstrumentPlan =
    getReadableExplicitInstrumentPlan(prompt) ??
    getReadableExplicitInstrumentPlan(intentText) ??
    getExplicitInstrumentPlanFromPrompt(prompt) ??
    getExplicitInstrumentPlan(intentText);
  const progressionPool = [
    analysis.progression,
    analysis.secondaryProgression,
    ...(THEME_PROGRESSIONS[analysis.theme] ?? []),
    ...PROGRESSIONS[analysis.genre],
    ...PROGRESSIONS.default,
  ].filter((candidate) => candidate.length > 0);
  const primary = pick(progressionPool, random);
  const secondary =
    progressionPool.find((candidate) => candidate.join('-') !== primary.join('-')) ??
    rotateProgression(primary, 1);
  const bpmSpread =
    analysis.mood === 'calm' || analysis.mood === 'sad'
      ? 4
      : analysis.genre === 'dance' || analysis.mood === 'energetic'
        ? 8
        : 6;
  const densitySpread = analysis.mood === 'calm' || analysis.mood === 'sad' ? 0.08 : 0.12;
  const nextInstruments: Record<InstrumentKey, boolean> = { ...analysis.instruments };

  if (!explicitInstrumentPlan && !isSoloPianoStyle(analysis)) {
    const flavor = runtimeSeed % 6;
    if (analysis.genre === 'citypop' || analysis.theme === 'summerNight') {
      nextInstruments.guitar = flavor !== 1;
      nextInstruments.studioAltoSax = flavor === 0 || flavor === 3 || analysis.theme === 'summerNight';
      nextInstruments.glockenspiel = flavor === 2 || flavor === 5;
      nextInstruments.supportingPiano = flavor !== 4;
    } else if (analysis.mood === 'calm' || analysis.mood === 'sad') {
      nextInstruments.violin = flavor === 0 || flavor === 2;
      nextInstruments.guitar = flavor === 1 || flavor === 4;
      nextInstruments.glockenspiel = analysis.theme === 'winter' && flavor <= 2;
      nextInstruments.supportingPiano = true;
    } else if (analysis.genre === 'dance' || analysis.mood === 'energetic') {
      nextInstruments.chicagoStreet = flavor === 0 || flavor === 4;
      nextInstruments.glockenspiel = flavor !== 3;
      nextInstruments.supportingPiano = flavor <= 2;
    } else {
      nextInstruments.guitar = flavor !== 2;
      nextInstruments.glockenspiel = flavor === 1 || flavor === 3;
      nextInstruments.supportingPiano = flavor !== 5;
    }
  }

  normalizeAiInstrumentPlanToComposerMenu(nextInstruments);

  return {
    ...analysis,
    bpm: hasFixedBpm
      ? analysis.bpm
      : Math.max(60, Math.min(160, analysis.bpm + Math.round((random() - 0.5) * bpmSpread))),
    density: Math.max(0.18, Math.min(0.94, analysis.density + (random() - 0.5) * densitySpread)),
    progression: rotateProgression(primary, runtimeSeed % Math.max(1, primary.length)),
    secondaryProgression: rotateProgression(secondary, Math.floor(runtimeSeed / 7) % Math.max(1, secondary.length)),
    variation: (analysis.variation + (runtimeSeed % 24)) % 24,
    promptSeed: (analysis.promptSeed ^ runtimeSeed) >>> 0,
    instruments: nextInstruments,
  };
}

function getChordForBar(analysis: PromptAnalysis, bar: number) {
  const primary = analysis.progression;
  const secondary = analysis.secondaryProgression;
  const phrase = Math.floor(bar / 8);
  const promptPhraseShift = (analysis.promptSeed >> (phrase % 12)) % Math.max(1, primary.length);
  const activeProgression =
    phrase === 1 || phrase === 4
      ? rotateProgression(secondary, promptPhraseShift % Math.max(1, secondary.length))
      : phrase === 3
        ? rotateProgression(primary, 1 + promptPhraseShift)
        : phrase >= 2
          ? rotateProgression(primary, promptPhraseShift)
          : rotateProgression(primary, analysis.promptSeed % Math.max(1, primary.length));
  const chordOffset =
    phrase === 2
      ? 1 + (analysis.promptSeed % 2)
      : phrase === 3
        ? (analysis.variation + promptPhraseShift) % Math.max(1, activeProgression.length)
        : phrase >= 4
          ? 2 + (analysis.promptSeed % 2)
          : analysis.promptSeed % Math.max(1, activeProgression.length);
  return activeProgression[(bar + chordOffset) % activeProgression.length];
}

function rotateProgression(progression: ChordName[], amount: number) {
  if (progression.length <= 1) return progression;
  const shift = ((amount % progression.length) + progression.length) % progression.length;
  return [...progression.slice(shift), ...progression.slice(0, shift)];
}

function getBarEnergy(analysis: PromptAnalysis, bar: number) {
  const moodBoost = analysis.mood === 'energetic' ? 0.12 : analysis.mood === 'calm' ? -0.08 : 0;
  const genreBoost = analysis.genre === 'dance' || analysis.genre === 'rock' ? 0.08 : 0;
  const section = getArrangementSection(bar);

  if (analysis.theme === 'calm' || analysis.mood === 'calm') {
    const calmCurve = [0.22, 0.36, 0.48, 0.54, 0.30, 0.42];
    return calmCurve[section] ?? 0.42;
  }

  const curve = [0.36, 0.68, 0.98, 1.14, 0.52, 0.9];
  const phraseLift = bar % 8 >= 6 ? 0.06 : bar % 4 === 3 ? 0.03 : 0;
  return Math.max(0.18, (curve[section] ?? 0.78) + phraseLift + moodBoost + genreBoost);
}

function isChorusBar(bar: number) {
  return bar >= 16 && bar < 32;
}

function isBridgeBar(bar: number) {
  return bar >= 32 && bar < 36;
}

function isTurnaroundBar(bar: number) {
  return bar % 8 === 7 || bar === BAR_COUNT - 1;
}

function getArrangementSection(bar: number) {
  if (bar < 4) return 0;
  if (bar < 16) return 1;
  if (bar < 24) return 2;
  if (bar < 32) return 3;
  if (bar < 36) return 4;
  return 5;
}

function getMelodySectionShift(analysis: PromptAnalysis, bar: number) {
  const section = getArrangementSection(bar);
  const styleSeed = createSeed(analysis.styleId) % 5;
  const promptSeedShift = (analysis.promptSeed >> (section % 8)) % 7;
  const sectionShifts = [0, 1, 3, 5, 2, 4];
  const moodShift =
    analysis.mood === 'sad' || analysis.mood === 'calm'
      ? -1
      : analysis.mood === 'dreamy'
        ? 2
        : analysis.mood === 'energetic'
          ? 3
          : 1;
  return sectionShifts[section] + styleSeed + moodShift + promptSeedShift;
}

function isValidMelodyNote(note: string) {
  return (MELODY_NOTES as readonly string[]).includes(note);
}

function isValidBassNote(note: string) {
  return (BASS_NOTES as readonly string[]).includes(note);
}

function isValidGuitarNote(note: string) {
  return (GUITAR_TRACK_LABELS as readonly string[]).includes(note);
}

function isValidViolinNote(note: string) {
  return (VIOLIN_NOTES as readonly string[]).includes(note);
}

function isValidSaxophoneNote(note: string) {
  return (SAXOPHONE_NOTES as readonly string[]).includes(note);
}

function isValidDrumNote(note: string) {
  return (DRUM_TRACK_LABELS as readonly string[]).includes(note);
}

function createNoteValidator(notes: readonly string[]) {
  const noteSet = new Set(notes);
  return (note: string) => noteSet.has(note);
}

function uniqueNotes(notes: string[]) {
  return Array.from(new Set(notes));
}

function getChordPalette(chord: ChordName, allowedNotes: readonly string[], includePassing = false) {
  const allowed = new Set(allowedNotes);
  const tones = CHORD_TONES[chord];
  const candidates = uniqueNotes([
    ...tones.melody,
    ...tones.guitar,
    ...(includePassing ? tones.passing : []),
  ]);
  const filtered = candidates.filter((note) => allowed.has(note));
  if (filtered.length > 0) return filtered;

  const rootName = chord;
  return allowedNotes.filter((note) => note.startsWith(rootName)).slice(0, 5);
}

function getNoteRoot(note: string) {
  return normalizeDiatonicNote(note).replace(/-?\d+$/, '');
}

function getStackedChordVoicing(chord: ChordName, allowedNotes: readonly string[], bar: number, variation: number) {
  const chordRoots = new Set(CHORD_TONES[chord].guitar.map(getNoteRoot));
  const chordNotes = uniqueNotes(allowedNotes.map(normalizeDiatonicNote))
    .filter((note) => chordRoots.has(getNoteRoot(note)))
    .filter((note) => {
      const midi = noteToMidi(note);
      return midi >= 48 && midi <= 76;
    })
    .sort((a, b) => noteToMidi(a) - noteToMidi(b));

  if (chordNotes.length <= 3) return chordNotes;

  const inversion = (bar + variation) % 3;
  const center = Math.min(chordNotes.length - 3, Math.max(0, 1 + inversion + (bar % 2)));
  const voicing = chordNotes.slice(center, center + 3);

  return (bar + variation) % 4 === 2 ? [voicing[1], voicing[2], voicing[0]].filter(Boolean) : voicing;
}

function getChordNotesInMidiRange(chord: ChordName, allowedNotes: readonly string[], minMidi: number, maxMidi: number) {
  const chordRoots = new Set(CHORD_TONES[chord].guitar.map(getNoteRoot));
  return uniqueNotes(allowedNotes.map(normalizeDiatonicNote))
    .filter((note) => chordRoots.has(getNoteRoot(note)))
    .filter((note) => {
      const midi = noteToMidi(note);
      return midi >= minMidi && midi <= maxMidi;
    })
    .sort((a, b) => noteToMidi(a) - noteToMidi(b));
}

function addNote(
  events: MusicEvent[],
  note: string,
  start: number,
  duration: number,
  validator: (note: string) => boolean
) {
  const safeNote = normalizeDiatonicNote(note);
  if (start < 0 || start >= TOTAL_STEPS || duration <= 0 || !validator(safeNote)) return;
  events.push({
    note: safeNote,
    start,
    duration: Math.min(duration, TOTAL_STEPS - start),
  });
}

function addDrum(events: MusicEvent[], note: string, start: number) {
  if (start < 0 || start >= TOTAL_STEPS || !isValidDrumNote(note)) return;
  events.push({ note, start, duration: 1 });
}

const CHRISTMAS_CAROL_TONES = new Set(['C', 'D', 'E', 'F', 'G', 'A', 'B']);

function isChristmasMelodySafe(note: string, chord: ChordName) {
  const normalized = normalizeDiatonicNote(note);
  const root = getNoteRoot(normalized);
  const midi = noteToMidi(normalized);
  if (!CHRISTMAS_CAROL_TONES.has(root) || midi < 60 || midi > 79) return false;

  const chordSafeRoots: Record<ChordName, string[]> = {
    C: ['C', 'D', 'E', 'G', 'A'],
    D: ['D', 'F', 'A'],
    E: ['E', 'G', 'B'],
    F: ['F', 'G', 'A', 'C', 'D'],
    G: ['G', 'A', 'B', 'D', 'E'],
    A: ['A', 'C', 'E'],
    B: ['B', 'D', 'F'],
  };

  return chordSafeRoots[chord].includes(root);
}

function createChristmasCarolMelody(analysis: PromptAnalysis): MusicEvent[] {
  const events: MusicEvent[] = [];
  const validator = isValidMelodyNote;
  const phraseSet = analysis.variation % 2;
  const phrases = [
    [
      [
        { offset: 0, duration: 1, note: 'G4' },
        { offset: 2, duration: 1, note: 'G4' },
        { offset: 4, duration: 2, note: 'G4' },
        { offset: 8, duration: 1, note: 'E4' },
        { offset: 10, duration: 1, note: 'G4' },
        { offset: 12, duration: 4, note: 'C5' },
      ],
      [
        { offset: 0, duration: 1, note: 'A4' },
        { offset: 2, duration: 1, note: 'A4' },
        { offset: 4, duration: 2, note: 'A4' },
        { offset: 8, duration: 1, note: 'F4' },
        { offset: 10, duration: 1, note: 'A4' },
        { offset: 12, duration: 4, note: 'C5' },
      ],
      [
        { offset: 0, duration: 1, note: 'B4' },
        { offset: 2, duration: 1, note: 'B4' },
        { offset: 4, duration: 2, note: 'B4' },
        { offset: 8, duration: 1, note: 'G4' },
        { offset: 10, duration: 1, note: 'B4' },
        { offset: 12, duration: 4, note: 'D5' },
      ],
      [
        { offset: 0, duration: 1, note: 'C5' },
        { offset: 2, duration: 1, note: 'D5' },
        { offset: 4, duration: 2, note: 'E5' },
        { offset: 8, duration: 1, note: 'D5' },
        { offset: 10, duration: 1, note: 'B4' },
        { offset: 12, duration: 4, note: 'C5' },
      ],
    ],
    [
      [
        { offset: 0, duration: 1, note: 'E4' },
        { offset: 2, duration: 1, note: 'E4' },
        { offset: 4, duration: 2, note: 'G4' },
        { offset: 8, duration: 1, note: 'C5' },
        { offset: 10, duration: 1, note: 'B4' },
        { offset: 12, duration: 4, note: 'G4' },
      ],
      [
        { offset: 0, duration: 1, note: 'F4' },
        { offset: 2, duration: 1, note: 'F4' },
        { offset: 4, duration: 2, note: 'A4' },
        { offset: 8, duration: 1, note: 'C5' },
        { offset: 10, duration: 1, note: 'A4' },
        { offset: 12, duration: 4, note: 'F4' },
      ],
      [
        { offset: 0, duration: 1, note: 'G4' },
        { offset: 2, duration: 1, note: 'G4' },
        { offset: 4, duration: 2, note: 'B4' },
        { offset: 8, duration: 1, note: 'D5' },
        { offset: 10, duration: 1, note: 'E5' },
        { offset: 12, duration: 4, note: 'D5' },
      ],
      [
        { offset: 0, duration: 1, note: 'C5' },
        { offset: 2, duration: 1, note: 'B4' },
        { offset: 4, duration: 2, note: 'A4' },
        { offset: 8, duration: 1, note: 'G4' },
        { offset: 10, duration: 1, note: 'B4' },
        { offset: 12, duration: 4, note: 'C5' },
      ],
    ],
  ];
  const phrase = phrases[phraseSet];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const base = bar * BAR_LENGTH;
    const motif = phrase[bar % phrase.length];
    const chord = getChordForBar(analysis, bar);
    const octaveLift = isChorusBar(bar) && bar % 4 >= 2 ? 0 : 0;

    motif.forEach((step) => {
      const note = octaveLift ? step.note.replace('4', '5') : step.note;
      const safeNote = isChristmasMelodySafe(note, chord) ? note : getSafeMelodyChordTone(note, chord);
      addNote(events, safeNote, base + step.offset, step.duration, validator);
    });
  }

  return events;
}

type MelodyStep = {
  offset: number;
  duration: number;
  degree: number;
};

function getPromptMelodyPatterns(analysis: PromptAnalysis, startOffset: number, startDegree: number): MelodyStep[][] {
  const calmPianoPatterns: MelodyStep[][] = [
    [
      { offset: startOffset, duration: 3, degree: startDegree },
      { offset: 4, duration: 2, degree: startDegree + 1 },
      { offset: 7, duration: 2, degree: startDegree + 2 },
      { offset: 10, duration: 2, degree: startDegree + 1 },
      { offset: 13, duration: 3, degree: startDegree },
    ],
    [
      { offset: startOffset, duration: 4, degree: startDegree + 1 },
      { offset: 6, duration: 2, degree: startDegree },
      { offset: 9, duration: 2, degree: startDegree + 2 },
      { offset: 12, duration: 4, degree: startDegree + 1 },
    ],
  ];

  const dreamyPatterns: MelodyStep[][] = [
    [
      { offset: startOffset, duration: 4, degree: startDegree + 1 },
      { offset: 5, duration: 3, degree: startDegree + 2 },
      { offset: 10, duration: 2, degree: startDegree },
      { offset: 13, duration: 3, degree: startDegree + 1 },
    ],
    [
      { offset: startOffset, duration: 3, degree: startDegree },
      { offset: 6, duration: 3, degree: startDegree + 2 },
      { offset: 11, duration: 2, degree: startDegree + 1 },
      { offset: 14, duration: 2, degree: startDegree },
    ],
  ];

  const sadPatterns: MelodyStep[][] = [
    [
      { offset: startOffset, duration: 4, degree: startDegree + 2 },
      { offset: 6, duration: 3, degree: startDegree + 1 },
      { offset: 11, duration: 5, degree: startDegree },
    ],
    [
      { offset: startOffset, duration: 3, degree: startDegree + 1 },
      { offset: 5, duration: 3, degree: startDegree + 2 },
      { offset: 9, duration: 2, degree: startDegree + 1 },
      { offset: 12, duration: 4, degree: startDegree },
    ],
  ];

  const cityPopPatterns: MelodyStep[][] = [
    [
      { offset: startOffset, duration: 2, degree: startDegree + 1 },
      { offset: 3, duration: 1, degree: startDegree + 3 },
      { offset: 5, duration: 2, degree: startDegree + 2 },
      { offset: 8, duration: 2, degree: startDegree },
      { offset: 11, duration: 1, degree: startDegree + 2 },
      { offset: 13, duration: 2, degree: startDegree + 1 },
    ],
    [
      { offset: startOffset, duration: 1, degree: startDegree + 2 },
      { offset: 2, duration: 2, degree: startDegree + 1 },
      { offset: 6, duration: 2, degree: startDegree + 3 },
      { offset: 9, duration: 1, degree: startDegree },
      { offset: 12, duration: 3, degree: startDegree + 2 },
    ],
  ];

  const brightPatterns: MelodyStep[][] = [
    [
      { offset: startOffset, duration: 2, degree: startDegree },
      { offset: 2, duration: 2, degree: startDegree + 1 },
      { offset: 4, duration: 2, degree: startDegree + 2 },
      { offset: 7, duration: 1, degree: startDegree + 1 },
      { offset: 8, duration: 2, degree: startDegree },
      { offset: 10, duration: 2, degree: startDegree + 2 },
      { offset: 12, duration: 2, degree: startDegree + 1 },
      { offset: 14, duration: 2, degree: startDegree },
    ],
    [
      { offset: startOffset, duration: 2, degree: startDegree + 1 },
      { offset: 3, duration: 1, degree: startDegree },
      { offset: 4, duration: 2, degree: startDegree + 2 },
      { offset: 6, duration: 2, degree: startDegree + 1 },
      { offset: 9, duration: 1, degree: startDegree },
      { offset: 10, duration: 2, degree: startDegree + 1 },
      { offset: 12, duration: 2, degree: startDegree + 2 },
      { offset: 14, duration: 2, degree: startDegree + 1 },
    ],
  ];

  if (isSoloPianoStyle(analysis) || analysis.theme === 'study') return calmPianoPatterns;
  if (analysis.genre === 'citypop' || analysis.theme === 'summerNight' || analysis.theme === 'night') return cityPopPatterns;
  if (analysis.mood === 'dreamy' || analysis.styleId === 'mysticFeeling' || analysis.styleId === 'dreamyFeeling') return dreamyPatterns;
  if (analysis.mood === 'sad' || analysis.theme === 'breakup') return sadPatterns;
  if (analysis.theme === 'spring' || analysis.theme === 'summerSea' || analysis.mood === 'bright' || analysis.mood === 'energetic') return brightPatterns;

  return [
    [
      { offset: startOffset, duration: 2, degree: startDegree },
      { offset: 4, duration: 2, degree: startDegree + 1 },
      { offset: 8, duration: 2, degree: startDegree + 2 },
      { offset: 12, duration: 2, degree: startDegree + 1 },
    ],
    [
      { offset: startOffset, duration: 2, degree: startDegree + 1 },
      { offset: 4, duration: 2, degree: startDegree + 2 },
      { offset: 8, duration: 2, degree: startDegree + 1 },
      { offset: 12, duration: 2, degree: startDegree },
    ],
  ];
}

function createMelody(analysis: PromptAnalysis, random: () => number): MusicEvent[] {
  const events: MusicEvent[] = [];
  if (analysis.theme === 'christmas') {
    return createChristmasCarolMelody(analysis);
  }
  if (isSoloPianoStyle(analysis)) {
    const liveVariationSeed = Math.floor(random() * 1_000_000_000);
    const pianoVariant = getSoloPianoVariant(analysis);
    if (pianoVariant !== 'canon' && pianoVariant !== 'rpgost') {
      return createHighQualitySoloPianoMelody({
        ...analysis,
        variation: (analysis.variation + Math.floor(random() * 24)) % 24,
        promptSeed: (analysis.promptSeed ^ liveVariationSeed) >>> 0,
      });
    }
    return createExpressivePianoLeadMelody({
      ...analysis,
      variation: (analysis.variation + Math.floor(random() * 24)) % 24,
      promptSeed: (analysis.promptSeed ^ liveVariationSeed) >>> 0,
    });
  }
  if (isDreamCityPopPrompt(analysis)) {
    return createDreamCityPopLeadMelody(analysis);
  }
  let previousNote: string | null = null;
  let previousDegree = -1;
  const isSparseTheme =
    analysis.theme === 'calm' ||
    analysis.theme === 'winter' ||
    analysis.theme === 'rainyNight' ||
    analysis.theme === 'breakup' ||
    analysis.theme === 'cinematic';
  const isHookTheme =
    analysis.theme === 'spring' ||
    analysis.theme === 'summerSea' ||
    analysis.theme === 'summerNight' ||
    analysis.theme === 'kpopDance' ||
    analysis.theme === 'gameBgm';
  const startDegreeByTheme: Record<Theme, number> = {
    christmas: 2,
    winter: 1,
    summerSea: 0,
    summerNight: 1,
    spring: 2,
    night: 1,
    calm: 0,
    rainyNight: 1,
    breakup: 2,
    cafeLofi: 0,
    kpopDance: 2,
    gameBgm: 0,
    cinematic: 1,
    study: 0,
    default: analysis.variation % 3,
  };
  const startOffsetByTheme: Record<Theme, number> = {
    christmas: analysis.variation % 3 === 0 ? 0 : analysis.variation % 3 === 1 ? 2 : 4,
    winter: 2,
    summerSea: 0,
    summerNight: 1,
    spring: analysis.variation % 2 === 0 ? 0 : 2,
    night: 2,
    calm: analysis.variation % 2 === 0 ? 0 : 4,
    rainyNight: 2,
    breakup: 0,
    cafeLofi: analysis.variation % 2 === 0 ? 0 : 2,
    kpopDance: 0,
    gameBgm: analysis.variation % 2 === 0 ? 0 : 1,
    cinematic: 2,
    study: 0,
    default: analysis.variation === 2 ? 2 : 0,
  };
  const startDegree = startDegreeByTheme[analysis.theme];
  const startOffset = startOffsetByTheme[analysis.theme];
  const springPatterns = [
    [
      { offset: startOffset, duration: 2, degree: startDegree },
      { offset: 3, duration: 2, degree: (startDegree + 1) % 3 },
      { offset: 6, duration: 2, degree: (startDegree + 2) % 3 },
      { offset: 10, duration: 2, degree: (startDegree + 1) % 3 },
      { offset: 13, duration: 2, degree: startDegree },
    ],
    [
      { offset: startOffset, duration: 2, degree: (startDegree + 1) % 3 },
      { offset: 4, duration: 2, degree: startDegree },
      { offset: 7, duration: 2, degree: (startDegree + 2) % 3 },
      { offset: 11, duration: 2, degree: (startDegree + 1) % 3 },
      { offset: 14, duration: 2, degree: startDegree },
    ],
  ];
  const densePatterns = [
    [
      { offset: startOffset, duration: 2, degree: startDegree },
      { offset: 2, duration: 2, degree: (startDegree + 1) % 3 },
      { offset: 4, duration: 2, degree: (startDegree + 2) % 3 },
      { offset: 7, duration: 1, degree: (startDegree + 1) % 3 },
      { offset: 8, duration: 2, degree: startDegree },
      { offset: 10, duration: 2, degree: (startDegree + 2) % 3 },
      { offset: 12, duration: 2, degree: (startDegree + 1) % 3 },
      { offset: 14, duration: 2, degree: startDegree },
    ],
    [
      { offset: startOffset, duration: 2, degree: (startDegree + 1) % 3 },
      { offset: 3, duration: 1, degree: startDegree },
      { offset: 4, duration: 2, degree: (startDegree + 2) % 3 },
      { offset: 6, duration: 2, degree: (startDegree + 1) % 3 },
      { offset: 9, duration: 1, degree: startDegree },
      { offset: 10, duration: 2, degree: (startDegree + 1) % 3 },
      { offset: 12, duration: 2, degree: (startDegree + 2) % 3 },
      { offset: 14, duration: 2, degree: (startDegree + 1) % 3 },
    ],
  ];
  const sparsePatterns = [
    [
      { offset: startOffset, duration: 4, degree: startDegree },
      { offset: 8, duration: 4, degree: (startDegree + 1) % 3 },
      { offset: 12, duration: 4, degree: startDegree },
    ],
    [
      { offset: startOffset, duration: 4, degree: (startDegree + 1) % 3 },
      { offset: 6, duration: 4, degree: startDegree },
      { offset: 12, duration: 4, degree: (startDegree + 2) % 3 },
    ],
  ];
  const stablePatterns =
    isSparseTheme
      ? sparsePatterns
      : isHookTheme
        ? densePatterns
      : analysis.theme === 'spring'
      ? springPatterns
      : analysis.genre === 'ballad' || analysis.theme === 'winter'
      ? [
          [
            { offset: startOffset, duration: 4, degree: startDegree },
            { offset: 8, duration: 4, degree: (startDegree + 1) % 3 },
            { offset: 12, duration: 4, degree: (startDegree + 2) % 3 },
          ],
          [
            { offset: startOffset, duration: 4, degree: (startDegree + 1) % 3 },
            { offset: 6, duration: 4, degree: (startDegree + 2) % 3 },
            { offset: 12, duration: 4, degree: startDegree },
          ],
        ]
      : [
          [
            { offset: startOffset, duration: 2, degree: startDegree },
            { offset: 4, duration: 2, degree: (startDegree + 1) % 3 },
            { offset: 8, duration: 2, degree: (startDegree + 2) % 3 },
            { offset: 12, duration: 2, degree: (startDegree + 1) % 3 },
          ],
          [
            { offset: startOffset, duration: 2, degree: (startDegree + 1) % 3 },
            { offset: 4, duration: 2, degree: (startDegree + 2) % 3 },
            { offset: 8, duration: 2, degree: (startDegree + 1) % 3 },
            { offset: 12, duration: 2, degree: startDegree },
          ],
        ];

  const promptPatterns = getPromptMelodyPatterns(analysis, startOffset, startDegree);
  const activePatterns =
    analysis.styleId !== analysis.theme || analysis.mood !== 'warm'
      ? promptPatterns
      : stablePatterns;

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const energy = getBarEnergy(analysis, bar);
    const isPhraseEnd = bar % 4 === 3;
    const isLiftBar = isTurnaroundBar(bar);
    const sectionShift = getMelodySectionShift(analysis, bar);
    const phraseVariant = Math.floor(bar / 4);
    const promptMotifShift = (analysis.promptSeed >> (bar % 16)) % Math.max(1, activePatterns.length);
    const motif = activePatterns[(bar + analysis.variation + Math.floor(createSeed(analysis.styleId) % 3) + sectionShift + promptMotifShift) % activePatterns.length];
    const shouldThin =
      !isSoloPianoStyle(analysis) &&
      (bar < 4 || isBridgeBar(bar) || (analysis.theme === 'winter' && analysis.mood !== 'bright'));
    const leadTones = getConstrainedLeadPalette(chord, analysis, previousNote);
    const palette = leadTones;

    motif.forEach((step, index) => {
      if (shouldThin && index % 2 === 1 && !(analysis.theme === 'summerSea' && isChorusBar(bar))) return;
      const keepChance = isChorusBar(bar)
        ? Math.min(0.98, analysis.density * energy + 0.2)
        : isBridgeBar(bar)
          ? Math.min(0.78, analysis.density * energy - 0.08)
          : Math.min(0.95, analysis.density * energy + (isHookTheme ? 0.12 : 0.04));
      if (random() > keepChance && index > (isHookTheme ? 3 : 1)) return;

      const cadenceDrop = isPhraseEnd && index >= motif.length - 1 ? -step.degree : 0;
      const themeShift =
        analysis.theme === 'summerSea' || analysis.theme === 'summerNight'
          ? (isChorusBar(bar) ? 2 : 1)
          : analysis.mood === 'dreamy'
            ? (isBridgeBar(bar) ? -1 : 1)
            : analysis.mood === 'sad' || analysis.mood === 'calm'
              ? (isChorusBar(bar) ? 1 : -1)
              : 0;
      const paletteLimit = Math.max(1, palette.length);
      let degree = (step.degree + cadenceDrop + analysis.variation + bar + index + themeShift + sectionShift + phraseVariant + (analysis.promptSeed % 7)) % paletteLimit;
      if (degree === previousDegree && palette.length > 1) {
        degree = (degree + (index % 2 === 0 ? 2 : 3)) % palette.length;
      }
      const note = bar === 0 && index === 0
        ? getOpeningMelodyNote(analysis, chord)
        : chooseMovingMelodyNote(palette, degree, previousNote, bar + index);
      const mainRegisterNote = liftMelodyNoteToMainRegister(note, chord, analysis, bar);
      const swingOffset = 0;
      const duration = isSoloPianoStyle(analysis)
        ? Math.min(4, step.duration)
        : isSparseTheme
        ? Math.min(4, step.duration)
        : isChorusBar(bar) && (analysis.genre === 'citypop' || analysis.theme === 'summerSea')
          ? Math.min(3, Math.max(1, step.duration))
        : isLiftBar && step.offset >= 12
          ? 2
          : Math.min(2, step.duration);
      const sectionOffset = 0;
      const start = bar * BAR_LENGTH + Math.min(BAR_LENGTH - 1, step.offset + swingOffset + sectionOffset);
      addNote(events, mainRegisterNote, start, duration, isValidMelodyNote);
      const shouldStackMelody =
        duration >= 2 &&
        (isChorusBar(bar) || isSparseTheme || analysis.genre === 'ballad' || analysis.mood === 'dreamy') &&
        (index === 0 || index === motif.length - 1 || (bar + index + analysis.variation) % 3 === 0);
      if (shouldStackMelody) {
        getMelodyStackNotes(palette, mainRegisterNote, bar, index, analysis.variation)
          .forEach((stackNote) => addNote(events, stackNote, start, duration, isValidMelodyNote));
      }
      previousNote = mainRegisterNote;
      previousDegree = degree;
    });

    if ((bar % 8 === 6 || bar % 8 === 7 || bar === BAR_COUNT - 2) && analysis.theme !== 'winter') {
      const fillStart = bar % 8 === 7 ? 10 : 12;
      const liftNote = chooseMovingMelodyNote(leadTones, (analysis.variation + bar + sectionShift + 4) % leadTones.length, previousNote, bar + fillStart);
      const mainLiftNote = liftMelodyNoteToMainRegister(liftNote, chord, analysis, bar);
      addNote(events, mainLiftNote, bar * BAR_LENGTH + fillStart, 2, isValidMelodyNote);
      previousNote = mainLiftNote;
      const settleNote = chooseMovingMelodyNote(leadTones, (analysis.variation + bar + sectionShift + 2) % leadTones.length, previousNote, bar + 14);
      const mainSettleNote = liftMelodyNoteToMainRegister(settleNote, chord, analysis, bar);
      addNote(events, mainSettleNote, bar * BAR_LENGTH + 14, 2, isValidMelodyNote);
      previousNote = mainSettleNote;
    } else if (isChorusBar(bar) && analysis.genre === 'citypop' && bar % 4 === 1) {
      const liftNote = chooseMovingMelodyNote(leadTones, (analysis.variation + sectionShift + bar + 3) % leadTones.length, previousNote, bar + 11);
      const mainLiftNote = liftMelodyNoteToMainRegister(liftNote, chord, analysis, bar);
      addNote(events, mainLiftNote, bar * BAR_LENGTH + 11, 1, isValidMelodyNote);
      previousNote = mainLiftNote;
      const answerNote = chooseMovingMelodyNote(leadTones, (analysis.variation + sectionShift + bar + 5) % leadTones.length, previousNote, bar + 13);
      const mainAnswerNote = liftMelodyNoteToMainRegister(answerNote, chord, analysis, bar);
      addNote(events, mainAnswerNote, bar * BAR_LENGTH + 13, 2, isValidMelodyNote);
      previousNote = mainAnswerNote;
    }

    if (bar === BAR_COUNT - 1) {
      const finalNote = chooseConnectedMelodyNote(leadTones, analysis.variation % Math.max(1, leadTones.length), previousNote);
      addNote(events, liftMelodyNoteToMainRegister(finalNote, chord, analysis, bar), bar * BAR_LENGTH + 8, 8, isValidMelodyNote);
    }
  }

  return events;
}

function createBass(analysis: PromptAnalysis, random: () => number): MusicEvent[] {
  const events: MusicEvent[] = [];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const root = CHORD_TONES[chord].bass;
    const nextRoot = CHORD_TONES[nextChord].bass;
    const base = bar * BAR_LENGTH;
    const energy = getBarEnergy(analysis, bar);
    const sectionShift = getMelodySectionShift(analysis, bar);
    const section = getArrangementSection(bar);

    if (analysis.theme === 'christmas') {
      if (bar < 4) {
        if (bar % 2 === 0) addNote(events, root, base + 8, 4, isValidBassNote);
        continue;
      }
      addNote(events, root, base, bar < 8 ? 4 : 6, isValidBassNote);
      if (bar >= 8 && bar % 2 === 0) addNote(events, root, base + 8, 4, isValidBassNote);
      if (bar >= 16 && isTurnaroundBar(bar)) addNote(events, nextRoot, base + 12, 2, isValidBassNote);
      continue;
    }

    const firstDuration =
      analysis.mood === 'dreamy' || analysis.mood === 'calm'
        ? 3
        : analysis.genre === 'ballad' || bar < 4
          ? 6
          : analysis.genre === 'citypop'
            ? 3
            : 4;
    addNote(events, root, base, firstDuration, isValidBassNote);
    if (analysis.genre === 'citypop' && bar >= 4 && energy > 0.62) {
      addNote(events, root, base + (sectionShift % 2 === 0 ? 6 : 7), 2, isValidBassNote);
    }
    if (energy > 0.55 && analysis.theme !== 'winter') addNote(events, root, base + 8, analysis.genre === 'citypop' ? 3 : 4, isValidBassNote);
    if (analysis.theme === 'winter' && bar % 2 === 0) addNote(events, root, base + 12, 4, isValidBassNote);

    if (analysis.theme !== 'winter' && section !== 4 && ((analysis.genre !== 'ballad' && energy > 0.72) || random() < 0.45)) {
      if (isChorusBar(bar) || analysis.genre === 'dance') addNote(events, root, base + 6, 2, isValidBassNote);
      addNote(events, nextRoot, base + (analysis.genre === 'citypop' && sectionShift % 3 === 0 ? 11 : 12), 2, isValidBassNote);
      addNote(events, root, base + 14, 2, isValidBassNote);
    }
    if (bar >= 8 && (bar % 8 === 7 || bar === 15 || bar === 31)) {
      addNote(events, nextRoot, base + 12, 2, isValidBassNote);
      addNote(events, nextRoot, base + 14, 2, isValidBassNote);
    }
  }

  return events;
}

function createGuitar(analysis: PromptAnalysis, random: () => number): MusicEvent[] {
  const events: MusicEvent[] = [];
  const rhythm = analysis.genre === 'ballad' ? [0, 8] : analysis.genre === 'lofi' ? [0, 6, 10] : [0, 4, 8, 12];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    if (bar < 4 && analysis.genre !== 'rock') continue;
    const chord = getChordForBar(analysis, bar);
    const tones = CHORD_TONES[chord].guitar;
    const energy = getBarEnergy(analysis, bar);

    rhythm.forEach((offset, rhythmIndex) => {
      if (rhythmIndex > 1 && random() > analysis.density * energy) return;
      if (isBridgeBar(bar) && rhythmIndex % 2 === 1) return;
      tones.forEach((note) => {
        addNote(events, note, bar * BAR_LENGTH + offset, analysis.genre === 'ballad' ? 4 : isChorusBar(bar) ? 3 : 2, isValidGuitarNote);
      });
    });
  }

  return events;
}

function createHarmonyLine(
  analysis: PromptAnalysis,
  random: () => number,
  notes: readonly string[],
  validator: (note: string) => boolean,
  options: {
    density: number;
    offsets: number[];
    duration: number;
    restEvery?: number;
  }
) {
  const events: MusicEvent[] = [];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    if (options.restEvery && bar % options.restEvery === options.restEvery - 1) continue;
    const energy = getBarEnergy(analysis, bar);
    if (random() > Math.min(0.95, options.density * energy)) continue;

    const chord = getChordForBar(analysis, bar);
    const palette = getChordPalette(chord, notes);
    if (palette.length === 0) continue;

    options.offsets.forEach((offset, index) => {
      if (isBridgeBar(bar) && index > 0) return;
      const sectionShift = getMelodySectionShift(analysis, bar);
      const note = palette[(bar + index + sectionShift) % palette.length];
      const pushedOffset = analysis.swing && (analysis.genre === 'citypop' || analysis.genre === 'jazz') && index % 2 === 1 ? Math.min(15, offset + 1) : offset;
      addNote(events, note, bar * BAR_LENGTH + pushedOffset, options.duration, validator);
    });
  }

  return events;
}

function createViolin(analysis: PromptAnalysis, random: () => number): MusicEvent[] {
  return createHarmonyLine(analysis, random, VIOLIN_NOTES, isValidViolinNote, {
    density: analysis.theme === 'christmas' ? 0.58 : analysis.genre === 'ballad' || analysis.mood === 'dreamy' ? 0.56 : 0.34,
    offsets: analysis.genre === 'ballad' ? [0, 8] : [4, 12],
    duration: analysis.genre === 'ballad' ? 8 : 4,
    restEvery: analysis.genre === 'dance' ? 4 : undefined,
  });
}

function createSaxophone(analysis: PromptAnalysis, random: () => number): MusicEvent[] {
  return createHarmonyLine(analysis, random, SAXOPHONE_NOTES, isValidSaxophoneNote, {
    density: analysis.genre === 'jazz' || analysis.genre === 'citypop' ? 0.8 : 0.34,
    offsets: analysis.genre === 'jazz' ? [2, 7, 11] : [6, 10],
    duration: 2,
    restEvery: 3,
  });
}

function createDrums(analysis: PromptAnalysis, random: () => number): MusicEvent[] {
  const events: MusicEvent[] = [];

  if (analysis.theme === 'christmas') {
    for (let bar = 0; bar < BAR_COUNT; bar += 1) {
      const base = bar * BAR_LENGTH;
      [0, 2, 4, 6, 8, 10, 12, 14].forEach((offset) => addDrum(events, 'Percussion', base + offset));
      if (bar >= 8) {
        [4, 12].forEach((offset) => addDrum(events, 'HiHat', base + offset));
      }
      if (isChorusBar(bar) && bar % 2 === 0) {
        addDrum(events, 'Percussion', base + 15);
      }
    }

    return events;
  }

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const base = bar * BAR_LENGTH;
    const halfTime = analysis.genre === 'ballad' || analysis.mood === 'calm';
    const softDrums = analysis.theme === 'calm' || analysis.mood === 'calm';
    const energy = getBarEnergy(analysis, bar);
    const section = getArrangementSection(bar);

    const hatStep = softDrums ? 8 : analysis.theme === 'summerSea' && isChorusBar(bar) ? 2 : halfTime || bar < 4 ? 4 : 2;
    for (let offset = 0; offset < BAR_LENGTH; offset += hatStep) {
      if (section === 0 && offset > 8 && !softDrums) continue;
      if (section === 4 && offset % 8 !== 0) continue;
      if (softDrums && bar % 2 === 1 && offset >= 8) continue;
      addDrum(events, 'HiHat', base + offset + (analysis.swing && offset % 4 === 2 ? 1 : 0));
    }

    if (section !== 4 || bar % 2 === 0) addDrum(events, 'Kick', base);
    if (bar >= 4 && !softDrums) addDrum(events, 'Snare', base + 4);
    if (energy > (softDrums ? 0.56 : 0.5)) addDrum(events, 'Kick', base + 8);
    if (bar >= 4) addDrum(events, 'Snare', base + (softDrums ? 12 : 12));

    if (!softDrums && section !== 4 && ((!halfTime && energy > 0.68) || random() < 0.38)) addDrum(events, 'Kick', base + 10);
    if (analysis.theme === 'summerSea') addDrum(events, 'Clap', base + 4);
    if (analysis.theme === 'summerNight' && isChorusBar(bar) && bar % 2 === 0) addDrum(events, 'Clap', base + 12);
    if (!softDrums && (isChorusBar(bar) || analysis.genre === 'dance' || random() < 0.42)) addDrum(events, 'Clap', base + 12);
    if (!softDrums && (analysis.genre === 'lofi' || analysis.genre === 'jazz') && bar >= 4) {
      addDrum(events, 'Percussion', base + 3);
      addDrum(events, 'Percussion', base + 11);
    }
    if (!softDrums && isTurnaroundBar(bar)) {
      addDrum(events, 'Percussion', base + 14);
      addDrum(events, 'Percussion', base + 15);
      addDrum(events, 'Snare', base + 15);
    }
    if (!softDrums && (bar === 15 || bar === 31 || bar === 35)) {
      addDrum(events, 'Percussion', base + 12);
      addDrum(events, 'Percussion', base + 13);
      addDrum(events, 'Percussion', base + 14);
      addDrum(events, 'Snare', base + 15);
    }
  }

  return events;
}

function createSparkleLine(
  analysis: PromptAnalysis,
  random: () => number,
  notes: readonly string[],
  offsets: number[],
  everyBars: number,
  density: number
) {
  const validator = createNoteValidator(notes);
  const events: MusicEvent[] = [];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    if ((analysis.theme !== 'christmas' && bar < 8) || bar % everyBars !== everyBars - 1 || random() > density * getBarEnergy(analysis, bar)) continue;
    const chord = getChordForBar(analysis, bar);
    const palette = getChordPalette(chord, notes);
    if (palette.length === 0) continue;

    offsets.forEach((offset, index) => {
      addNote(events, palette[(index + bar) % palette.length], bar * BAR_LENGTH + offset, 2, validator);
    });
  }

  return events;
}

function createChristmasBellLine(analysis: PromptAnalysis, notes: readonly string[]) {
  const validator = createNoteValidator(notes);
  const events: MusicEvent[] = [];
  const bellVoicings: Record<ChordName, string[]> = {
    C: ['C5', 'E5', 'G5'],
    D: ['D5', 'F5', 'A5'],
    E: ['E5', 'G5', 'B5'],
    F: ['F4', 'A4', 'C5'],
    G: ['G4', 'B4', 'D5'],
    A: ['A4', 'C5', 'E5'],
    B: ['B4', 'D5', 'F5'],
  };
  const offsetsByVariation = [
    [0, 4, 8, 12],
    [0, 6, 8, 14],
    [2, 4, 10, 12],
    [0, 4, 11, 14],
  ];
  const offsets = offsetsByVariation[analysis.variation % offsetsByVariation.length];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    if (bar < 4 && bar % 2 === 1) continue;
    const chord = getChordForBar(analysis, bar);
    const voicing = bellVoicings[chord];
    const base = bar * BAR_LENGTH;

    offsets.forEach((offset, index) => {
      const note = voicing[index % voicing.length];
      addNote(events, note, base + offset, 1, validator);
    });

    if (isChorusBar(bar) && bar % 4 === 3) {
      voicing.forEach((note) => addNote(events, note, base + 12, 2, validator));
    }
  }

  return events;
}

function createChristmasChordBed(analysis: PromptAnalysis, notes: readonly string[]) {
  const validator = createNoteValidator(notes);
  const events: MusicEvent[] = [];
  const chordVoicings: Record<ChordName, string[]> = {
    C: ['C3', 'E3', 'G3'],
    D: ['D3', 'F3', 'A3'],
    E: ['E3', 'G3', 'B3'],
    F: ['F3', 'A3', 'C4'],
    G: ['G3', 'B3', 'D4'],
    A: ['A3', 'C4', 'E4'],
    B: ['B3', 'D4', 'F4'],
  };

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const base = bar * BAR_LENGTH;
    const chord = getChordForBar(analysis, bar);
    const voicing = chordVoicings[chord];
    const duration = isChorusBar(bar) ? 8 : 12;

    voicing.forEach((note) => addNote(events, note, base, duration, validator));
    if (bar >= 8 && bar % 2 === 0) {
      voicing.forEach((note) => addNote(events, note, base + 8, 4, validator));
    }
  }

  return events;
}

function createChordBed(analysis: PromptAnalysis, notes: readonly string[], duration = 8) {
  const validator = createNoteValidator(notes);
  const events: MusicEvent[] = [];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    if (bar < 4 && analysis.genre !== 'ballad' && analysis.genre !== 'lofi') continue;
    const chord = getChordForBar(analysis, bar);
    const palette = getStackedChordVoicing(chord, notes, bar, analysis.variation);
    const base = bar * BAR_LENGTH;
    const energy = getBarEnergy(analysis, bar);
    const primaryOffset =
      analysis.genre === 'citypop'
        ? (bar + analysis.variation) % 2 === 0 ? 0 : 2
        : analysis.theme === 'calm' || analysis.theme === 'winter'
          ? (bar + analysis.variation) % 4 === 1 ? 4 : 0
          : (bar + analysis.variation) % 3 === 1 ? 2 : 0;
    const chordDuration = Math.max(4, Math.min(isBridgeBar(bar) ? 12 : duration, BAR_LENGTH - primaryOffset));

    palette.forEach((note) => addNote(events, note, base + primaryOffset, chordDuration, validator));
    if (analysis.genre !== 'ballad' && energy > 0.68) {
      const secondVoicing = getStackedChordVoicing(getChordForBar(analysis, bar + 1), notes, bar + 1, analysis.variation + 1);
      secondVoicing.forEach((note) => addNote(events, note, base + 8, 4, validator));
    }
  }

  return events;
}

function chooseYoutubePianoMidi(
  chord: ChordName,
  analysis: PromptAnalysis,
  targetMidi: number,
  minMidi: number,
  maxMidi: number,
  previousMidi: number | null,
  strict = false
) {
  const pitchClasses = getSoloPianoChordPitchClasses(chord, !strict);
  let resolvedMidi = findNearestMidiWithPitchClass(targetMidi, pitchClasses, minMidi, maxMidi);

  if (previousMidi !== null) {
    const emotional = getSoloPianoVariant(analysis) === 'emotional';
    const maxLeap = emotional ? (strict ? 19 : 24) : strict ? 12 : 16;
    if (Math.abs(resolvedMidi - previousMidi) > maxLeap) {
      resolvedMidi = findNearestMidiWithPitchClass(
        previousMidi + Math.sign(resolvedMidi - previousMidi) * maxLeap,
        pitchClasses,
        minMidi,
        maxMidi
      );
    }

    if ((resolvedMidi === previousMidi || (emotional && Math.abs(resolvedMidi - previousMidi) <= 2)) && (!strict || emotional)) {
      resolvedMidi = findNearestMidiWithPitchClass(
        previousMidi + (emotional ? (((analysis.promptSeed + targetMidi) % 3 === 0) ? 12 : ((analysis.promptSeed + targetMidi) % 2 === 0) ? 7 : -5) : (((analysis.promptSeed + targetMidi) % 2 === 0) ? 5 : -5)),
        pitchClasses,
        minMidi,
        maxMidi
      );
    }
  }

  return resolvedMidi;
}

function createYoutubeCalmPianoLeadMelody(analysis: PromptAnalysis): MusicEvent[] {
  const events: MusicEvent[] = [];
  let previousMidi: number | null = null;
  const variant = getSoloPianoVariant(analysis);
  const quiet = variant === 'quiet';
  const calm = variant === 'calm';
  const emotional = variant === 'emotional';
  const phraseTemplates: Array<{ offsets: number[]; intervals: number[]; durations: number[] }> =
    quiet
      ? [
        { offsets: [0, 4, 8, 12], intervals: [0, 4, 7, 4], durations: [4, 3, 4, 3] },
        { offsets: [0, 5, 9, 13], intervals: [7, 4, 2, 0], durations: [4, 3, 3, 3] },
        { offsets: [2, 6, 10, 14], intervals: [4, 7, 5, 2], durations: [3, 3, 3, 2] },
      ]
      : calm
        ? [
            { offsets: [0, 3, 6, 8, 12, 14], intervals: [0, 2, 4, 7, 4, 2], durations: [3, 2, 2, 3, 2, 2] },
            { offsets: [0, 4, 7, 10, 12, 15], intervals: [4, 7, 5, 2, 0, 2], durations: [3, 2, 2, 2, 3, 1] },
            { offsets: [2, 5, 8, 11, 13], intervals: [7, 5, 4, 2, 0], durations: [2, 2, 3, 2, 2] },
          ]
      : emotional
        ? [
            { offsets: [0, 1, 3, 5, 8, 10, 12, 15], intervals: [0, 4, 7, 11, 12, 9, 7, 4], durations: [1, 2, 1, 2, 2, 1, 2, 1] },
            { offsets: [0, 2, 4, 7, 9, 11, 13, 15], intervals: [7, 9, 12, 16, 14, 12, 9, 7], durations: [2, 1, 2, 1, 1, 1, 2, 1] },
            { offsets: [1, 3, 4, 6, 8, 11, 12, 14], intervals: [12, 11, 9, 7, 4, 7, 9, 12], durations: [1, 1, 2, 1, 2, 1, 2, 2] },
            { offsets: [0, 3, 5, 6, 8, 10, 13, 15], intervals: [4, 7, 12, 14, 12, 9, 7, 11], durations: [2, 1, 1, 2, 2, 1, 2, 1] },
          ]
    : [
        { offsets: [0, 2, 4, 6, 8, 10, 12, 14], intervals: [0, 4, 7, 9, 12, 9, 7, 4], durations: [2, 1, 2, 1, 2, 1, 2, 2] },
        { offsets: [0, 1, 3, 5, 8, 9, 11, 13, 15], intervals: [7, 9, 12, 14, 12, 9, 7, 5, 4], durations: [1, 1, 2, 1, 2, 1, 1, 1, 1] },
        { offsets: [0, 3, 4, 7, 8, 10, 12, 14], intervals: [4, 7, 9, 7, 5, 4, 2, 0], durations: [2, 1, 2, 1, 2, 1, 2, 2] },
        { offsets: [1, 2, 4, 6, 9, 10, 12, 15], intervals: [12, 11, 9, 7, 4, 7, 9, 12], durations: [1, 2, 1, 2, 1, 1, 2, 1] },
      ];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const phrase = Math.floor(bar / 4);
    const phrasePosition = bar % 4;
    const isChorus = isChorusBar(bar);
    const isBridge = isBridgeBar(bar);
    const register =
      quiet
        ? isBridge
          ? { min: 50, max: 72 }
          : isChorus
            ? { min: 55, max: 84 }
            : { min: 52, max: 79 }
        : calm
          ? isBridge
            ? { min: 52, max: 76 }
            : isChorus
              ? { min: 57, max: 88 }
              : { min: 52, max: 84 }
        : emotional
          ? isBridge
            ? { min: 55, max: 84 }
            : isChorus
              ? { min: 64, max: 108 }
              : phrasePosition >= 2
                ? { min: 60, max: 100 }
                : { min: 57, max: 91 }
        : isBridge
          ? { min: 55, max: 84 }
          : isChorus
            ? { min: 64, max: 108 }
            : phrasePosition >= 2
              ? { min: 60, max: 96 }
              : { min: 57, max: 88 };
    const phraseArc =
      quiet
        ? [0, 2, -2, 0][phrasePosition]
        : calm
          ? [0, 2, 4, 1][phrasePosition]
        : emotional
          ? [0, 7, 12, 5][phrasePosition]
        : [0, 4, 7, phrase % 2 === 0 ? 2 : 9][phrasePosition];
    const styleOffset = quiet ? 1 : calm ? 5 : emotional ? 11 : 17;
    const phraseBase = register.min + 8 + ((analysis.promptSeed + phrase * 13 + analysis.variation * 5 + styleOffset) % Math.max(8, register.max - register.min - 12));
    const anchorMidi = chooseYoutubePianoMidi(
      chord,
      analysis,
      phraseBase + phraseArc,
      register.min,
      register.max,
      previousMidi,
      true
    );
    const template = phraseTemplates[(analysis.promptSeed + analysis.variation + phrase + phrasePosition) % phraseTemplates.length];

    template.offsets.forEach((offset, index) => {
      const activeChord = offset >= 12 && phrasePosition === 3 ? nextChord : chord;
      const targetMidi =
        anchorMidi +
        template.intervals[index] +
        (isChorus && !quiet ? 5 : 0) +
        (isBridge ? -5 : 0) +
        (((analysis.promptSeed >> ((bar + index) % 11)) % 3) - 1);
      const strict = index === 0 || offset === 8 || offset >= 12;
      const midi = chooseYoutubePianoMidi(activeChord, analysis, targetMidi, register.min, register.max, previousMidi, strict);
      const note = midiToMelodyNote(midi);
      addNote(events, note, base + offset, template.durations[index] ?? 1, isValidMelodyNote);

      if (!quiet && !calm && (isChorus || phrasePosition === 3 || emotional) && index % 3 === 1) {
        const harmonyMidi = chooseYoutubePianoMidi(activeChord, analysis, midi - 7, Math.max(45, register.min - 12), register.max, midi, true);
        if (Math.abs(harmonyMidi - midi) >= 5) {
          addNote(events, midiToMelodyNote(harmonyMidi), base + offset, 1, isValidMelodyNote);
        }
      }

      previousMidi = midi;
    });

    if (!quiet && phrasePosition === 3) {
      const resolveMidi = chooseYoutubePianoMidi(
        nextChord,
        analysis,
        anchorMidi + (emotional ? 14 : calm ? 5 : isChorus ? 12 : 7),
        register.min,
        Math.min(108, register.max + 7),
        previousMidi,
        true
      );
      addNote(events, midiToMelodyNote(resolveMidi), base + 14, 2, isValidMelodyNote);
      previousMidi = resolveMidi;
    }
  }

  return events;
}

function getPremiumPianoPitchClasses(chord: ChordName, includePassing = false) {
  const chordRoots = [
    ...CHORD_TONES[chord].melody,
    ...CHORD_TONES[chord].guitar,
    ...(includePassing ? CHORD_TONES[chord].passing : []),
  ].map((note) => getPitchClass(note));

  return [...new Set(chordRoots)];
}

function choosePremiumPianoMidi(
  chord: ChordName,
  targetMidi: number,
  minMidi: number,
  maxMidi: number,
  previousMidi: number | null,
  includePassing = false
) {
  const pitchClasses = getPremiumPianoPitchClasses(chord, includePassing);
  const candidates: number[] = [];

  for (let midi = Math.max(21, minMidi); midi <= Math.min(108, maxMidi); midi += 1) {
    if (pitchClasses.includes(((midi % 12) + 12) % 12)) {
      candidates.push(midi);
    }
  }

  if (!candidates.length) {
    return findNearestMidiWithPitchClass(targetMidi, pitchClasses, minMidi, maxMidi);
  }

  return candidates.sort((a, b) => {
    const aTarget = Math.abs(a - targetMidi);
    const bTarget = Math.abs(b - targetMidi);
    const aMotion = previousMidi === null ? 0 : Math.abs(a - previousMidi) * 0.42;
    const bMotion = previousMidi === null ? 0 : Math.abs(b - previousMidi) * 0.42;
    const aLeapPenalty = previousMidi !== null && Math.abs(a - previousMidi) > 14 ? 8 : 0;
    const bLeapPenalty = previousMidi !== null && Math.abs(b - previousMidi) > 14 ? 8 : 0;
    return aTarget + aMotion + aLeapPenalty - (bTarget + bMotion + bLeapPenalty);
  })[0];
}

function addPremiumPianoNote(events: MusicEvent[], midi: number, start: number, duration: number) {
  addNote(events, midiToMelodyNote(midi), start, duration, isValidMelodyNote);
}

function addHighQualityPianoNote(events: MusicEvent[], midi: number, start: number, duration: number) {
  addNote(events, midiToMelodyNote(midi), start, duration, isValidMelodyNote);
}

function createPremiumYoutubePianoComposition(analysis: PromptAnalysis, variant: string): MusicEvent[] {
  const events: MusicEvent[] = [];
  const seed = (analysis.promptSeed + analysis.variation * 157 + analysis.bpm * 23) >>> 0;
  const newAge = variant === 'newage';
  const soft = variant === 'soft' || variant === 'quiet' || variant === 'calm' || analysis.mood === 'calm';
  const sad = variant === 'sad' || variant === 'winter' || variant === 'rain' || analysis.mood === 'sad';
  const dream = variant === 'night' || analysis.mood === 'dreamy';
  const bright = variant === 'bright' || analysis.mood === 'bright';
  const transposeChoices = newAge ? [-2, 0, 2, 5] : sad ? [-5, -3, 0] : dream ? [-3, 0, 2] : bright ? [0, 2, 5] : [-5, 0, 2];
  const transpose = transposeChoices[seed % transposeChoices.length] ?? 0;
  const profile = Math.floor(seed / 11) % 8;

  type PianoChord = {
    bass: number;
    left: number[];
    right: number[];
    phrase: number[];
  };

  const progressions: PianoChord[][] = newAge
    ? [
        [
          { bass: 48, left: [48, 55, 60, 64], right: [67, 72, 76, 79], phrase: [72, 76, 79, 84, 79, 76, 72, 67] },
          { bass: 55, left: [55, 62, 67, 71], right: [67, 71, 74, 79], phrase: [74, 79, 83, 86, 83, 79, 74, 71] },
          { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 72, 76], phrase: [76, 81, 84, 81, 76, 72, 67, 72] },
          { bass: 53, left: [53, 60, 65, 69], right: [65, 69, 72, 77], phrase: [77, 81, 84, 81, 77, 72, 69, 65] },
        ],
        [
          { bass: 50, left: [50, 57, 62, 65], right: [65, 69, 74, 77], phrase: [69, 74, 77, 81, 86, 81, 77, 74] },
          { bass: 57, left: [57, 64, 69, 73], right: [69, 73, 76, 81], phrase: [76, 81, 85, 88, 85, 81, 76, 73] },
          { bass: 47, left: [47, 54, 59, 62], right: [66, 71, 74, 78], phrase: [74, 78, 83, 86, 83, 78, 74, 71] },
          { bass: 55, left: [55, 62, 67, 71], right: [67, 71, 74, 79], phrase: [79, 83, 86, 83, 79, 74, 71, 67] },
        ],
      ]
    : soft
      ? [
          [
            { bass: 48, left: [48, 55, 60, 64], right: [64, 67, 72, 76], phrase: [67, 72, 76, 72, 67, 64, 67, 72] },
            { bass: 41, left: [41, 48, 53, 57], right: [64, 65, 69, 72], phrase: [65, 69, 72, 69, 65, 64, 65, 69] },
            { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 72, 76], phrase: [64, 67, 72, 76, 72, 67, 64, 67] },
            { bass: 43, left: [43, 50, 55, 59], right: [62, 67, 71, 74], phrase: [62, 67, 71, 67, 62, 67, 69, 67] },
          ],
          [
            { bass: 53, left: [53, 60, 65, 69], right: [65, 69, 72, 77], phrase: [65, 69, 72, 69, 65, 60, 65, 69] },
            { bass: 48, left: [48, 55, 60, 64], right: [64, 67, 72, 76], phrase: [64, 67, 72, 76, 72, 67, 64, 60] },
            { bass: 41, left: [41, 48, 53, 57], right: [64, 65, 69, 72], phrase: [65, 69, 72, 69, 65, 64, 60, 64] },
            { bass: 55, left: [55, 62, 67, 71], right: [67, 71, 74, 79], phrase: [67, 71, 74, 71, 67, 62, 67, 71] },
          ],
        ]
      : sad
    ? [
        [
          { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 72, 76], phrase: [76, 72, 71, 67, 64, 67, 71, 72] },
          { bass: 41, left: [41, 48, 53, 57], right: [64, 65, 69, 72], phrase: [72, 69, 65, 64, 65, 69, 67, 64] },
          { bass: 48, left: [48, 55, 60, 64], right: [64, 67, 72, 76], phrase: [67, 72, 76, 72, 67, 64, 67, 72] },
          { bass: 43, left: [43, 50, 55, 59], right: [62, 67, 71, 74], phrase: [74, 71, 67, 62, 67, 71, 69, 67] },
        ],
      ]
    : dream
      ? [
          [
            { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 71, 72], phrase: [67, 71, 72, 76, 72, 71, 67, 64] },
            { bass: 43, left: [43, 50, 55, 59], right: [62, 67, 71, 74], phrase: [67, 71, 74, 71, 67, 62, 67, 71] },
            { bass: 41, left: [41, 48, 53, 57], right: [64, 65, 69, 72], phrase: [65, 69, 72, 69, 65, 64, 65, 69] },
            { bass: 48, left: [48, 55, 60, 64], right: [64, 67, 72, 76], phrase: [67, 72, 76, 72, 67, 64, 67, 72] },
          ],
          [
            { bass: 53, left: [53, 60, 65, 69], right: [65, 69, 72, 77], phrase: [65, 69, 72, 77, 72, 69, 65, 60] },
            { bass: 48, left: [48, 55, 60, 64], right: [64, 67, 72, 76], phrase: [64, 67, 72, 76, 72, 67, 64, 60] },
            { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 71, 72], phrase: [67, 71, 72, 76, 72, 71, 67, 64] },
            { bass: 43, left: [43, 50, 55, 59], right: [62, 67, 71, 74], phrase: [62, 67, 71, 74, 71, 67, 62, 59] },
          ],
        ]
      : [
          [
            { bass: 48, left: [48, 55, 60, 64], right: [64, 67, 72, 76], phrase: [72, 76, 79, 76, 72, 67, 64, 67] },
            { bass: 43, left: [43, 50, 55, 59], right: [62, 67, 71, 74], phrase: [71, 74, 79, 74, 71, 67, 62, 67] },
            { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 72, 76], phrase: [72, 76, 81, 79, 76, 72, 67, 72] },
            { bass: 41, left: [41, 48, 53, 57], right: [64, 65, 69, 72], phrase: [69, 72, 76, 72, 69, 65, 64, 65] },
          ],
          [
            { bass: 41, left: [41, 48, 53, 57], right: [64, 65, 69, 72], phrase: [72, 69, 65, 69, 72, 76, 72, 69] },
            { bass: 48, left: [48, 55, 60, 64], right: [64, 67, 72, 76], phrase: [76, 72, 67, 64, 67, 72, 76, 79] },
            { bass: 43, left: [43, 50, 55, 59], right: [62, 67, 71, 74], phrase: [74, 71, 67, 71, 74, 79, 74, 71] },
            { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 72, 76], phrase: [76, 72, 67, 64, 67, 72, 71, 67] },
          ],
          [
            { bass: 50, left: [50, 57, 62, 65], right: [65, 69, 74, 77], phrase: [69, 74, 77, 81, 77, 74, 69, 65] },
            { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 72, 76], phrase: [67, 72, 76, 79, 76, 72, 67, 64] },
            { bass: 47, left: [47, 54, 59, 62], right: [62, 66, 71, 74], phrase: [71, 74, 78, 74, 71, 66, 62, 66] },
            { bass: 43, left: [43, 50, 55, 59], right: [62, 67, 71, 74], phrase: [67, 71, 74, 79, 74, 71, 67, 62] },
          ],
          [
            { bass: 40, left: [40, 47, 52, 55], right: [64, 67, 71, 76], phrase: [64, 67, 71, 76, 79, 76, 71, 67] },
            { bass: 47, left: [47, 54, 59, 62], right: [62, 66, 71, 74], phrase: [66, 71, 74, 78, 74, 71, 66, 62] },
            { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 72, 76], phrase: [72, 76, 79, 81, 79, 76, 72, 67] },
            { bass: 48, left: [48, 55, 60, 64], right: [64, 67, 72, 76], phrase: [76, 72, 67, 64, 67, 72, 76, 72] },
          ],
          [
            { bass: 43, left: [43, 50, 55, 59], right: [62, 67, 71, 74], phrase: [74, 71, 67, 62, 67, 71, 74, 79] },
            { bass: 48, left: [48, 55, 60, 64], right: [64, 67, 72, 76], phrase: [76, 79, 84, 79, 76, 72, 67, 72] },
            { bass: 45, left: [45, 52, 57, 60], right: [64, 67, 72, 76], phrase: [72, 67, 64, 67, 72, 76, 79, 76] },
            { bass: 41, left: [41, 48, 53, 57], right: [64, 65, 69, 72], phrase: [69, 72, 76, 72, 69, 65, 64, 65] },
          ],
        ];
  const progression = progressions[profile % progressions.length] ?? progressions[0];
  const leftFlows = soft
    ? [
        [0, 2, 3, 2],
        [0, 1, 2, 3],
        [0, 3, 1, 2],
      ]
    : [
        [0, 1, 2, 3, 2, 1, 3, 2],
        [0, 2, 1, 3, 0, 2, 3, 1],
        [0, 1, 3, 2, 0, 2, 1, 3],
      ];
  const leftOffsets = soft ? [0, 4, 8, 12] : dream ? [0, 4, 8, 12] : newAge ? [0, 2, 4, 6, 8, 10, 12, 14] : [0, 2, 4, 6, 8, 10, 12, 14];
  const melodyOffsets = soft ? [2, 6, 10, 14] : dream ? [2, 5, 9, 13] : newAge ? [0, 3, 5, 7, 10, 12, 14] : [1, 3, 5, 7, 9, 11, 13, 15];
  const answerOffsets = soft ? [5, 11] : dream ? [7, 14] : newAge ? [4, 9, 13] : [6, 10, 14];
  const leftFlow = leftFlows[(profile + Math.floor(seed / 29)) % leftFlows.length] ?? leftFlows[0];
  const motifShift = Math.floor(seed / 43) % 8;
  let previousLead = 72 + transpose;
  const keyRootPitchClass = ((transpose % 12) + 12) % 12;
  const scalePitchClasses = (sad || soft
    ? [0, 2, 3, 5, 7, 8, 10]
    : [0, 2, 4, 5, 7, 9, 11]
  ).map((pitchClass) => (pitchClass + keyRootPitchClass) % 12);

  const snapToScale = (midi: number) => {
    const candidates = [-2, -1, 0, 1, 2]
      .map((offset) => midi + offset)
      .filter((candidate) => scalePitchClasses.includes(((candidate % 12) + 12) % 12));

    return candidates.sort((a, b) => Math.abs(a - midi) - Math.abs(b - midi))[0] ?? midi;
  };

  const fitMidiToRegister = (midi: number, min: number, max: number) => {
    let fitted = snapToScale(midi + transpose);
    while (fitted < min) fitted += 12;
    while (fitted > max) fitted -= 12;
    return snapToScale(Math.max(min, Math.min(max, fitted)));
  };

  const addPiano = (midi: number, start: number, duration: number, min: number, max: number) => {
    addHighQualityPianoNote(events, fitMidiToRegister(midi, min, max), start, duration);
  };

  const chooseLead = (pool: number[], target: number, maxMidi = 96) => {
    const candidates = pool
      .flatMap((midi) => [midi - 12, midi, midi + 12, midi + 24])
      .filter((midi) => midi + transpose >= 60 && midi + transpose <= maxMidi)
      .sort((a, b) => {
        const aMidi = a + transpose;
        const bMidi = b + transpose;
        return Math.abs(aMidi - previousLead) * 0.72 + Math.abs(aMidi - (target + transpose)) * 0.5 - (Math.abs(bMidi - previousLead) * 0.72 + Math.abs(bMidi - (target + transpose)) * 0.5);
      });
    const chosen = candidates[0] ?? target;
    previousLead = chosen + transpose;
    return chosen;
  };

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const base = bar * BAR_LENGTH;
    const section = getArrangementSection(bar);
    const phrase = Math.floor(bar / 4);
    const phrasePos = bar % 4;
    const isIntro = bar < 4;
    const isChorus = isChorusBar(bar);
    const chordShift = section === 2 ? 1 : section === 3 ? 2 : section >= 4 ? 3 : 0;
    const chord = progression[(bar + chordShift) % progression.length];
    const nextChord = progression[(bar + chordShift + 1) % progression.length];
    const lift = dream ? (isChorus ? 5 : 0) : isChorus && !soft ? 12 : section >= 3 ? 5 : 0;
    const basePhrasePool = phrasePos === 3 ? [...chord.phrase.slice(3), ...nextChord.phrase.slice(0, 3)] : chord.phrase;
    const phraseVariant = (profile + phrase + section + Math.floor(bar / 2)) % 6;
    const phrasePool =
      phraseVariant === 0
        ? basePhrasePool
        : phraseVariant === 1
          ? [...basePhrasePool.slice(2), ...basePhrasePool.slice(0, 2)]
          : phraseVariant === 2
            ? [...basePhrasePool].reverse()
            : phraseVariant === 3
              ? [basePhrasePool[0], basePhrasePool[2], basePhrasePool[4], basePhrasePool[6], basePhrasePool[5], basePhrasePool[3], basePhrasePool[1], basePhrasePool[0]]
              : phraseVariant === 4
                ? [basePhrasePool[1], basePhrasePool[3], basePhrasePool[5], basePhrasePool[7], basePhrasePool[6], basePhrasePool[4], basePhrasePool[2], basePhrasePool[1]]
                : [basePhrasePool[2], basePhrasePool[1], basePhrasePool[3], basePhrasePool[5], basePhrasePool[4], basePhrasePool[6], basePhrasePool[7], basePhrasePool[5]];
    const highRegisterMax = dream ? 91 : isChorus || section >= 3 || bright ? 108 : soft ? 96 : 100;
    const sparkleRegisterMin = soft ? 76 : 84;

    leftOffsets.forEach((offset, index) => {
      if (isIntro && soft && index > 1) return;
      const leftMidi = chord.left[leftFlow[index % leftFlow.length]] ?? chord.bass;
      addPiano(leftMidi, base + offset, soft ? 3 : 1, 36, 64);
    });

    if (section >= 2 && !soft && bar % 2 === 0) {
      addPiano(chord.bass - 12, base, 4, 33, 52);
    }

    melodyOffsets.forEach((offset, index) => {
      if (isIntro && soft && index > 1) return;
      const sourceIndex = (index + phrase + profile + motifShift) % phrasePool.length;
      const leadPool = [...chord.right, ...nextChord.right, ...phrasePool].map((midi) => midi + lift);
      const lead = chooseLead(leadPool, phrasePool[sourceIndex] + lift, highRegisterMax);
      addPiano(lead, base + offset, soft ? 3 : offset >= 13 ? 2 : 1, 60, highRegisterMax);

      if (!dream && (isChorus || section >= 3) && index % 4 === 2) {
        addPiano(lead + 12, base + offset, 1, sparkleRegisterMin, 108);
      }
    });

    if (!isIntro && (phrasePos === 1 || phrasePos === 3)) {
      answerOffsets.forEach((offset, index) => {
        const answerPool = nextChord.right.map((midi) => midi + lift);
        const answer = chooseLead(answerPool, nextChord.right[(index + phraseOffset(phrase, profile)) % nextChord.right.length] + lift, highRegisterMax);
        addPiano(answer, base + offset, soft ? 2 : 1, 60, highRegisterMax);
      });
    }

    if ([7, 15, 23, 31, 35].includes(bar)) {
      const cadence = soft || sad ? [nextChord.right[2], nextChord.right[1], nextChord.right[0]] : [nextChord.right[0], nextChord.right[1], nextChord.right[2]];
      [10, 12, 14].forEach((offset, index) => addPiano(cadence[index] + lift + (section >= 3 ? 12 : 0), base + offset, offset === 14 ? 2 : 1, 60, highRegisterMax));
    }
  }

  const endBase = (BAR_COUNT - 1) * BAR_LENGTH;
  const tonic = progression[0];
  addPiano(tonic.bass, endBase, 16, 36, 60);
  addPiano(tonic.right[0], endBase + 8, 8, 60, 84);
  addPiano(tonic.right[2], endBase + 12, 4, 60, 84);

  return finalizeMelodicEvents(cleanPianoConsonance(events), soft ? 2 : 3);
}

function cleanPianoConsonance(events: MusicEvent[]) {
  const cleaned: MusicEvent[] = [];
  const byStart = new Map<number, MusicEvent[]>();

  polishEvents(events).forEach((event) => {
    const bucket = byStart.get(event.start) ?? [];
    bucket.push(event);
    byStart.set(event.start, bucket);
  });

  byStart.forEach((bucket) => {
    const sorted = bucket
      .filter((event) => typeof event.note === 'string')
      .sort((a, b) => noteToMidi(a.note ?? 'C4') - noteToMidi(b.note ?? 'C4'));
    const accepted: MusicEvent[] = [];

    sorted.forEach((event) => {
      const midi = noteToMidi(event.note ?? 'C4');
      const clashes = accepted.some((acceptedEvent) => {
        const interval = Math.abs(midi - noteToMidi(acceptedEvent.note ?? 'C4')) % 12;
        return interval === 1 || interval === 6 || interval === 11;
      });

      if (!clashes && accepted.length < 3) {
        accepted.push(event);
      }
    });

    cleaned.push(...accepted);
  });

  return polishEvents(cleaned);
}

function phraseOffset(phrase: number, profile: number) {
  return (phrase + profile) % 3;
}

function createSafeSoloPianoComposition(analysis: PromptAnalysis, variant: string): MusicEvent[] {
  const events: MusicEvent[] = [];
  const seed = (analysis.promptSeed + analysis.variation * 131 + analysis.bpm * 17) >>> 0;
  const soft = variant === 'quiet' || variant === 'calm' || analysis.mood === 'calm';
  const sad = variant === 'sad' || variant === 'winter' || variant === 'rain' || analysis.mood === 'sad';
  const dream = variant === 'night' || analysis.mood === 'dreamy';
  const bright = variant === 'bright' || analysis.mood === 'bright';
  const keyShifts = sad ? [-3, 0, 2] : dream ? [-2, 0, 5] : bright ? [0, 2, 5] : [-5, 0, 2];
  const transpose = keyShifts[seed % keyShifts.length] ?? 0;
  const profile = Math.floor(seed / 7) % 5;
  const phraseOffset = Math.floor(seed / 19) % 4;
  const add = (midi: number, start: number, duration: number, role: 'left' | 'right' | 'color' = 'right') => {
    const min = role === 'left' ? 36 : role === 'color' ? 55 : 60;
    const max = role === 'left' ? 64 : role === 'color' ? 82 : 96;
    addHighQualityPianoNote(events, Math.max(min, Math.min(max, midi + transpose)), start, duration);
  };

  const progressions = sad
    ? [
        [
          { bass: 45, chord: [45, 52, 57, 60], color: [64, 67, 72, 76], melody: [76, 72, 71, 67, 64, 67, 71, 72] },
          { bass: 41, chord: [41, 48, 53, 57], color: [64, 65, 69, 72], melody: [72, 69, 65, 64, 65, 69, 67, 64] },
          { bass: 48, chord: [48, 55, 60, 64], color: [64, 67, 72, 76], melody: [67, 72, 76, 72, 67, 64, 67, 72] },
          { bass: 43, chord: [43, 50, 55, 59], color: [62, 67, 71, 74], melody: [74, 71, 67, 62, 67, 71, 69, 67] },
        ],
      ]
    : dream
      ? [
          [
            { bass: 45, chord: [45, 52, 57, 60], color: [64, 67, 71, 76], melody: [71, 76, 79, 76, 72, 71, 67, 71] },
            { bass: 43, chord: [43, 50, 55, 59], color: [62, 67, 71, 74], melody: [74, 79, 76, 74, 71, 67, 71, 74] },
            { bass: 41, chord: [41, 48, 53, 57], color: [64, 65, 69, 72], melody: [72, 76, 74, 72, 69, 65, 69, 72] },
            { bass: 48, chord: [48, 55, 60, 64], color: [64, 67, 72, 76], melody: [76, 79, 81, 79, 76, 72, 67, 72] },
          ],
        ]
      : [
          [
            { bass: 48, chord: [48, 55, 60, 64], color: [64, 67, 72, 76], melody: [72, 76, 79, 76, 72, 67, 64, 67] },
            { bass: 43, chord: [43, 50, 55, 59], color: [62, 67, 71, 74], melody: [71, 74, 79, 74, 71, 67, 62, 67] },
            { bass: 45, chord: [45, 52, 57, 60], color: [64, 67, 72, 76], melody: [72, 76, 81, 79, 76, 72, 67, 72] },
            { bass: 41, chord: [41, 48, 53, 57], color: [64, 65, 69, 72], melody: [69, 72, 76, 72, 69, 65, 64, 65] },
          ],
          [
            { bass: 41, chord: [41, 48, 53, 57], color: [64, 65, 69, 72], melody: [72, 69, 65, 69, 72, 76, 72, 69] },
            { bass: 48, chord: [48, 55, 60, 64], color: [64, 67, 72, 76], melody: [76, 72, 67, 64, 67, 72, 76, 79] },
            { bass: 43, chord: [43, 50, 55, 59], color: [62, 67, 71, 74], melody: [74, 71, 67, 71, 74, 79, 74, 71] },
            { bass: 45, chord: [45, 52, 57, 60], color: [64, 67, 72, 76], melody: [76, 72, 67, 64, 67, 72, 71, 67] },
          ],
        ];
  const progression = progressions[profile % progressions.length] ?? progressions[0];
  const rightRhythms = soft
    ? [
        [0, 4, 8, 12],
        [0, 3, 7, 11, 14],
        [2, 5, 8, 12, 15],
      ]
    : [
        [0, 2, 4, 6, 8, 10, 12, 14],
        [0, 3, 4, 7, 8, 11, 12, 15],
        [0, 2, 5, 7, 9, 12, 14, 15],
      ];
  const leftPatterns = soft
    ? [
        [0, 2, 3, 2],
        [0, 1, 2, 3, 2],
        [0, 3, 1, 2],
      ]
    : [
        [0, 1, 2, 3, 2, 1, 3, 2],
        [0, 2, 1, 3, 0, 2, 3, 1],
        [0, 1, 3, 2, 0, 2, 1, 3],
      ];
  const leftOffsets = soft ? [0, 8] : [0, 4, 8, 12];
  const rightRhythm = rightRhythms[(profile + phraseOffset) % rightRhythms.length] ?? rightRhythms[0];
  const leftPattern = leftPatterns[(profile + phraseOffset) % leftPatterns.length] ?? leftPatterns[0];
  let previousRightMidi = 72 + transpose;

  const softenLeadMotion = (targetMidi: number) => {
    const target = targetMidi + transpose;
    const octaveCandidates = [target - 12, target, target + 12].filter((midi) => midi >= 60 && midi <= 96);
    let next = octaveCandidates.sort((a, b) => Math.abs(a - previousRightMidi) - Math.abs(b - previousRightMidi))[0] ?? target;

    if (Math.abs(next - previousRightMidi) > 7) {
      next = previousRightMidi + Math.sign(next - previousRightMidi) * (soft ? 3 : 5);
    }

    previousRightMidi = Math.max(60, Math.min(96, next));
    return previousRightMidi - transpose;
  };

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const base = bar * BAR_LENGTH;
    const section = getArrangementSection(bar);
    const phrase = Math.floor(bar / 4);
    const phrasePos = bar % 4;
    const isIntro = bar < 4;
    const isChorus = isChorusBar(bar);
    const chordShift = section === 2 ? 1 : section === 3 ? 2 : section >= 4 ? 3 : 0;
    const chord = progression[(bar + chordShift) % progression.length];
    const nextChord = progression[(bar + chordShift + 1) % progression.length];
    const melody = phrasePos === 3 ? [...chord.melody.slice(2), ...nextChord.melody.slice(0, 2)] : chord.melody;
    const lift = isChorus && !soft ? 12 : section >= 3 ? 5 : 0;

    leftOffsets.forEach((offset, index) => {
      if (soft && section === 0 && index > 2) return;
      const chordIndex = leftPattern[index % leftPattern.length] ?? 0;
      add(chord.chord[chordIndex] ?? chord.bass, base + offset, soft ? 5 : 2, 'left');
    });

    if (!soft && isChorus) {
      add(chord.bass - 12, base, 4, 'left');
      add(chord.bass - 12, base + 8, 4, 'left');
    }

    if (!soft && section >= 2 && bar % 2 === 0) {
      add(chord.color[1], base + 8, 2, 'color');
    }

    rightRhythm.forEach((offset, index) => {
      if (isIntro && soft && index > 2) return;
      const melodyIndex = (index + phrase + phraseOffset) % melody.length;
      const midi = softenLeadMotion(melody[melodyIndex] + lift);
      add(midi, base + offset, offset >= 12 ? 2 : soft ? 3 : 1, 'right');
    });

    if ([7, 15, 23, 31].includes(bar)) {
      const cadence = sad || soft ? [nextChord.melody[3], nextChord.melody[2], nextChord.melody[1], nextChord.melody[0]] : [nextChord.melody[0], nextChord.melody[1], nextChord.melody[2], nextChord.melody[3]];
      [9, 11, 13, 15].forEach((offset, index) => add(softenLeadMotion(cadence[index] + lift), base + offset, offset === 15 ? 2 : 1, 'right'));
    }
  }

  const endBase = (BAR_COUNT - 1) * BAR_LENGTH;
  const tonic = progression[0];
  add(tonic.bass, endBase, 16, 'left');
  add(tonic.chord[1], endBase + 8, 8, 'color');
  tonic.color.slice(0, 2).forEach((midi) => add(midi, endBase + 12, 4, 'right'));

  return finalizeMelodicEvents(events, soft ? 3 : 4);
}

void createSafeSoloPianoComposition;

function createHighQualitySoloPianoMelody(analysis: PromptAnalysis): MusicEvent[] {
  const events: MusicEvent[] = [];
  const variant = getSoloPianoVariant(analysis);
  if (variant === 'canon') return createPachelbelCanonLeadMelody();
  return createPremiumYoutubePianoComposition(analysis, variant);

  const soft = variant === 'quiet' || variant === 'calm' || analysis.mood === 'calm';
  const sad = variant === 'sad' || variant === 'winter' || variant === 'rain' || analysis.mood === 'sad';
  const bright = variant === 'bright' || analysis.mood === 'bright';
  const dream = variant === 'night' || analysis.mood === 'dreamy';
  const pianoSeed = (analysis.promptSeed + analysis.variation * 97 + analysis.bpm * 13) >>> 0;
  const keyShiftOptions = sad ? [-9, -7, -5, -2, 0] : dream ? [-5, -2, 0, 3, 5] : bright ? [-2, 0, 2, 5, 7] : [-7, -5, -2, 0, 3];
  const keyShift = keyShiftOptions[pianoSeed % keyShiftOptions.length] ?? 0;
  const profile = Math.floor(pianoSeed / 17) % 6;
  const scale = sad || soft ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  const root = 60 + keyShift;
  const chordProgressions = sad
    ? [[0, 5, 3, 4], [5, 3, 0, 4], [0, 2, 5, 4], [3, 4, 0, 0]]
    : dream
      ? [[0, 4, 5, 3], [5, 3, 4, 0], [0, 2, 3, 4], [4, 5, 3, 0]]
      : [[0, 4, 5, 3], [3, 0, 4, 5], [0, 3, 4, 0], [5, 3, 0, 4]];
  const chordPlan = chordProgressions[profile % chordProgressions.length] ?? chordProgressions[0];
  const motifBank = soft
    ? [
        [0, 1, 2, 1, 0, 2, 1, 0],
        [2, 1, 0, 1, 3, 2, 1, 0],
        [1, 2, 4, 3, 2, 1, 0, 1],
        [3, 2, 1, 0, 2, 1, 0, 0],
      ]
    : sad
      ? [
          [2, 1, 0, 1, 2, 3, 1, 0],
          [3, 2, 1, 0, 1, 2, 0, 0],
          [4, 3, 2, 1, 2, 1, 0, 1],
        ]
      : [
          [0, 2, 3, 4, 3, 2, 4, 3],
          [1, 3, 4, 2, 3, 4, 2, 1],
          [2, 4, 3, 1, 2, 3, 4, 2],
        ];
  const rhythmProfiles = soft
    ? [[0, 4, 8, 12], [0, 3, 7, 11, 14], [1, 5, 8, 10, 13], [0, 2, 6, 9, 12, 15]]
    : [[0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 4, 7, 8, 11, 12, 15], [0, 2, 5, 7, 9, 12, 14, 15]];
  const leftRhythmProfiles = soft
    ? [[0, 8], [0, 6, 12], [0, 4, 8, 12]]
    : [[0, 4, 8, 12], [0, 3, 8, 11, 14], [0, 2, 6, 8, 12, 14]];

  const degreeToMidi = (degree: number, octaveOffset = 0) => {
    const normalizedDegree = ((degree % scale.length) + scale.length) % scale.length;
    const octave = Math.floor(degree / scale.length);
    return root + scale[normalizedDegree] + octave * 12 + octaveOffset;
  };

  const buildChord = (degree: number) => {
    const bass = degreeToMidi(degree, -24);
    return {
      bass,
      left: [bass, degreeToMidi(degree + 2, -24), degreeToMidi(degree + 4, -24), degreeToMidi(degree, -12)],
      melody: [degreeToMidi(degree, 0), degreeToMidi(degree + 1, 0), degreeToMidi(degree + 2, 0), degreeToMidi(degree + 4, 0), degreeToMidi(degree + 6, 0)],
    };
  };

  let previousLead = root + 12;

  const chooseSmoothLead = (candidates: number[], target: number) => {
    const sorted = candidates
      .flatMap((midi) => [midi - 12, midi, midi + 12])
      .filter((midi) => midi >= 57 && midi <= 100)
      .sort((a, b) => Math.abs(a - target) + Math.abs(a - previousLead) * 0.8 - (Math.abs(b - target) + Math.abs(b - previousLead) * 0.8));
    const next = sorted[0] ?? target;
    const limited = Math.abs(next - previousLead) > 9 ? previousLead + Math.sign(next - previousLead) * 7 : next;
    previousLead = Math.max(57, Math.min(100, limited));
    return previousLead;
  };

  const addSafePiano = (midi: number, start: number, duration: number) => {
    addHighQualityPianoNote(events, Math.max(28, Math.min(108, midi)), start, duration);
  };

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const base = bar * BAR_LENGTH;
    const phrase = Math.floor(bar / 4);
    const phrasePos = bar % 4;
    const isIntro = bar < 4;
    const isBridge = isBridgeBar(bar);
    const isChorus = isChorusBar(bar);
    const section = getArrangementSection(bar);
    const harmonicShift = section === 2 ? 1 : section === 3 ? 2 : section >= 4 ? 3 : 0;
    const degree = chordPlan[(bar + harmonicShift) % chordPlan.length] ?? 0;
    const nextDegree = chordPlan[(bar + harmonicShift + 1) % chordPlan.length] ?? degree;
    const chord = buildChord(degree);
    const nextChord = buildChord(nextDegree);
    const motif = motifBank[(phrase + profile + phrasePos) % motifBank.length] ?? motifBank[0];
    const melodyRhythm = rhythmProfiles[(profile + phrase) % rhythmProfiles.length] ?? rhythmProfiles[0];
    const leftRhythm = leftRhythmProfiles[(profile + section) % leftRhythmProfiles.length] ?? leftRhythmProfiles[0];
    const leadLift = isChorus && !soft ? 12 : isBridge ? -5 : section >= 3 ? 5 : 0;
    const leftPattern = soft ? [0, 3, 1, 2, 0, 2] : [0, 1, 2, 3, 1, 2];

    leftRhythm.forEach((offset, index) => {
      const leftMidi = chord.left[leftPattern[index % leftPattern.length]] ?? chord.bass;
      addSafePiano(leftMidi, base + offset, offset === 0 ? (soft ? 6 : 4) : soft ? 3 : 2);
    });

    if (!isIntro && section >= 2 && bar % 2 === 0) {
      addSafePiano(chord.left[1] + 12, base + 8, soft ? 4 : 3);
    }

    melodyRhythm.forEach((offset, index) => {
      if (isIntro && soft && index > 3) return;
      const activeChord = offset >= 12 ? nextChord : chord;
      const motifDegree = motif[index % motif.length] ?? 0;
      const target = activeChord.melody[Math.min(activeChord.melody.length - 1, motifDegree)] + leadLift;
      const lead = chooseSmoothLead(activeChord.melody, target);
      addSafePiano(lead, base + offset, offset >= 12 ? 2 : soft ? 2 : 1);

      if (!soft && isChorus && index % 4 === 0) {
        addSafePiano(lead - 12, base + offset, 1);
      }
    });

    if (phrasePos === 3) {
      const resolution = chooseSmoothLead(nextChord.melody, nextChord.melody[soft || sad ? 0 : 2] + leadLift);
      addSafePiano(resolution, base + 14, 2);
    }

    if ([7, 15, 23, 31, 35].includes(bar)) {
      [8, 10, 12, 14].forEach((offset, index) => {
        const line = chooseSmoothLead(nextChord.melody, nextChord.melody[Math.min(nextChord.melody.length - 1, index)] + leadLift);
        addSafePiano(line, base + offset, offset >= 14 ? 2 : 1);
      });
    }
  }

  const endingBase = (BAR_COUNT - 1) * BAR_LENGTH;
  const tonic = buildChord(chordPlan[0] ?? 0);
  addSafePiano(tonic.bass, endingBase, 16);
  addSafePiano(tonic.left[1] + 12, endingBase + 8, 8);
  [tonic.melody[0], tonic.melody[2], tonic.melody[4]].forEach((midi) => addSafePiano(midi, endingBase + 12, 4));

  return finalizeMelodicEvents(events, soft ? 3 : 4);
}

const PACHELBEL_CANON_BASS_NOTES = ['D3', 'A2', 'B2', 'F#2', 'G2', 'D2', 'G2', 'A2'] as const;
const PACHELBEL_CANON_VOICINGS = [
  ['D3', 'A3', 'D4', 'F#4', 'A4'],
  ['A2', 'E3', 'A3', 'C#4', 'E4'],
  ['B2', 'F#3', 'B3', 'D4', 'F#4'],
  ['F#2', 'C#3', 'F#3', 'A3', 'C#4'],
  ['G2', 'D3', 'G3', 'B3', 'D4'],
  ['D2', 'A2', 'D3', 'F#3', 'A3'],
  ['G2', 'D3', 'G3', 'B3', 'D4'],
  ['A2', 'E3', 'A3', 'C#4', 'E4'],
] as const;

function createPachelbelCanonLeadMelody(): MusicEvent[] {
  const events: MusicEvent[] = [];
  const groundBass = ['D3', 'A2', 'B2', 'F#2', 'G2', 'D2', 'G2', 'A2'];
  const canonSubject = ['F#5', 'E5', 'D5', 'C#5', 'B4', 'A4', 'B4', 'C#5'];
  const canonAnswer = ['D5', 'C#5', 'B4', 'A4', 'G4', 'F#4', 'G4', 'E4'];
  const canonDescent = ['F#5', 'G5', 'A5', 'F#5', 'G5', 'A5', 'B5', 'C#6'];
  const canonClimb = ['D6', 'C#6', 'B5', 'A5', 'B5', 'C#6', 'D6', 'A5'];
  const chordArpeggios = [
    ['F#4', 'A4', 'D5', 'A4', 'F#4', 'A4', 'D5', 'A4'],
    ['E4', 'A4', 'C#5', 'A4', 'E4', 'A4', 'C#5', 'A4'],
    ['D4', 'F#4', 'B4', 'F#4', 'D4', 'F#4', 'B4', 'F#4'],
    ['C#4', 'F#4', 'A4', 'F#4', 'C#4', 'F#4', 'A4', 'F#4'],
    ['B3', 'D4', 'G4', 'D4', 'B3', 'D4', 'G4', 'D4'],
    ['A3', 'D4', 'F#4', 'D4', 'A3', 'D4', 'F#4', 'D4'],
    ['B3', 'D4', 'G4', 'D4', 'B3', 'D4', 'G4', 'D4'],
    ['C#4', 'E4', 'A4', 'E4', 'C#4', 'E4', 'A4', 'E4'],
  ];
  const famousFastLines = [
    ['F#5', 'E5', 'D5', 'F#5', 'E5', 'D5', 'C#5', 'E5', 'D5', 'C#5', 'B4', 'D5', 'C#5', 'B4', 'A4', 'C#5'],
    ['D5', 'C#5', 'B4', 'D5', 'C#5', 'B4', 'A4', 'C#5', 'B4', 'A4', 'G4', 'B4', 'A4', 'G4', 'F#4', 'A4'],
    ['B4', 'D5', 'F#5', 'D5', 'B4', 'D5', 'F#5', 'D5', 'A4', 'C#5', 'E5', 'C#5', 'A4', 'C#5', 'E5', 'C#5'],
    ['F#4', 'A4', 'C#5', 'A4', 'F#4', 'A4', 'C#5', 'A4', 'G4', 'B4', 'D5', 'B4', 'G4', 'B4', 'D5', 'B4'],
  ];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const base = bar * BAR_LENGTH;
    const chordIndex = bar % groundBass.length;
    const cycle = Math.floor(bar / PACHELBEL_CANON_BASS_NOTES.length);

    addNote(events, groundBass[chordIndex], base, 8, isValidMelodyNote);
    addNote(events, groundBass[chordIndex], base + 8, 8, isValidMelodyNote);

    if (cycle === 0) {
      addNote(events, canonSubject[chordIndex], base, 8, isValidMelodyNote);
      addNote(events, canonAnswer[chordIndex], base + 8, 8, isValidMelodyNote);
      continue;
    }

    if (cycle === 1) {
      addNote(events, canonSubject[chordIndex], base, 4, isValidMelodyNote);
      addNote(events, canonAnswer[chordIndex], base + 4, 4, isValidMelodyNote);
      addNote(events, canonDescent[chordIndex], base + 8, 4, isValidMelodyNote);
      addNote(events, canonClimb[chordIndex], base + 12, 4, isValidMelodyNote);
      continue;
    }

    const cell = cycle >= 3 ? famousFastLines[(bar + cycle) % famousFastLines.length] : chordArpeggios[chordIndex];
    const stepSize = cycle >= 3 ? 1 : 2;
    const duration = cycle >= 3 ? 1 : 2;
    cell.forEach((note, index) => addNote(events, note, base + index * stepSize, duration, isValidMelodyNote));

    if (cycle >= 3 && bar % 2 === 0) {
      addNote(events, chordArpeggios[chordIndex][2], base + 8, 2, isValidMelodyNote);
    }
  }

  return events;
}

function createPachelbelCanonAccompaniment(notes: readonly string[]): MusicEvent[] {
  const validator = createNoteValidator(notes);
  const events: MusicEvent[] = [];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const base = bar * BAR_LENGTH;
    const root = PACHELBEL_CANON_BASS_NOTES[bar % PACHELBEL_CANON_BASS_NOTES.length];
    const voicing = PACHELBEL_CANON_VOICINGS[bar % PACHELBEL_CANON_VOICINGS.length];
    const pattern = [
      root,
      voicing[1],
      voicing[2],
      voicing[3],
      root,
      voicing[1],
      voicing[2],
      voicing[4],
    ];

    pattern.forEach((note, index) => {
      addNote(events, note, base + index * 2, index === 0 || index === 4 ? 2 : 1, validator);
    });

    if (bar >= 8) {
      addNote(events, voicing[2], base, 4, validator);
      addNote(events, voicing[3], base + 8, 4, validator);
    }
  }

  return events;
}

function createPremiumSoloPianoLeadMelody(analysis: PromptAnalysis): MusicEvent[] {
  const events: MusicEvent[] = [];
  const variant = getSoloPianoVariant(analysis);
  if (variant === 'canon') {
    return createPachelbelCanonLeadMelody();
  }
  let previousMidi: number | null = null;
  const motifBank =
    variant === 'rpgost'
      ? [
          { offsets: [0, 2, 3, 5, 7, 8, 10, 12, 14], steps: [0, 7, 9, 12, 14, 12, 9, 7, 4], durations: [2, 1, 1, 2, 1, 2, 1, 2, 2] },
          { offsets: [0, 1, 3, 5, 8, 9, 11, 13, 15], steps: [12, 11, 9, 7, 4, 7, 9, 12, 16], durations: [1, 1, 2, 1, 2, 1, 1, 2, 1] },
          { offsets: [0, 3, 4, 6, 8, 10, 11, 13, 15], steps: [7, 9, 12, 16, 14, 12, 9, 7, 5], durations: [2, 1, 2, 1, 2, 1, 1, 1, 1] },
        ]
      : [
    { offsets: [0, 2, 3, 5, 8, 10, 12, 15], steps: [0, 4, 7, 9, 12, 9, 7, 4], durations: [2, 1, 2, 1, 2, 1, 2, 1] },
    { offsets: [0, 1, 3, 4, 6, 8, 11, 12, 14], steps: [7, 9, 12, 11, 9, 7, 4, 7, 12], durations: [1, 1, 1, 2, 1, 2, 1, 2, 2] },
    { offsets: [0, 2, 4, 7, 8, 9, 11, 13, 15], steps: [4, 7, 12, 16, 14, 12, 9, 7, 4], durations: [2, 1, 2, 1, 1, 1, 1, 2, 1] },
    { offsets: [1, 2, 4, 5, 7, 9, 10, 12, 14], steps: [12, 11, 9, 7, 4, 7, 9, 12, 16], durations: [1, 2, 1, 1, 2, 1, 1, 2, 2] },
    { offsets: [0, 3, 5, 6, 8, 10, 12, 13, 15], steps: [0, 7, 9, 12, 16, 14, 12, 9, 7], durations: [2, 1, 1, 2, 2, 1, 1, 1, 1] },
  ];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const phrase = Math.floor(bar / 4);
    const phrasePosition = bar % 4;
    const isIntro = bar < 4;
    const isBridge = isBridgeBar(bar);
    const isChorus = isChorusBar(bar);
    const highClimax = isChorus && phrasePosition >= 1;
    const quiet = variant === 'quiet' || variant === 'calm';
    const sad = variant === 'sad' || variant === 'winter' || variant === 'rain';
    const rpgOst = variant === 'rpgost';
    const register =
      isBridge
        ? { min: rpgOst ? 55 : 52, max: rpgOst ? 88 : 81 }
        : highClimax
          ? { min: sad || rpgOst ? 60 : 64, max: quiet ? 88 : 108 }
          : isIntro
            ? { min: quiet ? 50 : 55, max: sad ? 84 : 91 }
            : { min: quiet ? 52 : 57, max: sad ? 96 : 103 };
    const phraseLift = rpgOst ? [0, 7, 12, 5][phrasePosition] : [0, 4, 9, phrase % 2 === 0 ? 5 : 12][phrasePosition];
    const seedLift = ((analysis.promptSeed >> (bar % 13)) % 7) - 3;
    const anchorTarget = register.min + 12 + ((analysis.promptSeed + phrase * 17 + analysis.variation * 11) % Math.max(9, register.max - register.min - 18)) + phraseLift + seedLift;
    const anchor = choosePremiumPianoMidi(chord, anchorTarget, register.min, register.max, previousMidi, false);
    const motif = motifBank[(analysis.promptSeed + analysis.variation + phrase + phrasePosition) % motifBank.length];
    const densitySkip = quiet && !isChorus ? 3 : sad && isIntro ? 4 : 99;

    motif.offsets.forEach((offset, index) => {
      if (index > 0 && densitySkip !== 99 && index % densitySkip === 0) return;
      const activeChord = offset >= 12 && phrasePosition === 3 ? nextChord : chord;
      const target = anchor + motif.steps[index] + (highClimax ? 5 : 0) + (isBridge ? -7 : 0);
      const midi = choosePremiumPianoMidi(activeChord, target, register.min, register.max, previousMidi, index % 3 !== 0);
      addPremiumPianoNote(events, midi, base + offset, motif.durations[index] ?? 1);

      if (!quiet && (highClimax || variant === 'lyrical' || variant === 'emotional') && index % 3 === 1) {
        const lowerHarmony = choosePremiumPianoMidi(activeChord, midi - 7, Math.max(45, register.min - 12), Math.min(96, register.max), midi, false);
        if (Math.abs(midi - lowerHarmony) >= 5) {
          addPremiumPianoNote(events, lowerHarmony, base + offset, Math.min(2, motif.durations[index] ?? 1));
        }
      }

      if (!quiet && highClimax && index % 4 === 2) {
        const octaveSpark = choosePremiumPianoMidi(activeChord, midi + 12, Math.max(72, register.min), 108, midi, false);
        if (octaveSpark > midi) addPremiumPianoNote(events, octaveSpark, base + offset, 1);
      }

      previousMidi = midi;
    });

    if (phrasePosition === 3) {
      const resolveMidi = choosePremiumPianoMidi(nextChord, anchor + (sad ? 7 : 12), register.min, Math.min(108, register.max + 7), previousMidi, false);
      addPremiumPianoNote(events, resolveMidi, base + 14, 2);
      previousMidi = resolveMidi;
    }
  }

  return events;
}

void createPremiumSoloPianoLeadMelody;

function createPremiumSoloPianoAccompaniment(analysis: PromptAnalysis, notes: readonly string[]) {
  const validator = createNoteValidator(notes);
  const events: MusicEvent[] = [];
  const variant = getSoloPianoVariant(analysis);
  if (variant === 'canon') {
    return createPachelbelCanonAccompaniment(notes);
  }
  const quiet = variant === 'quiet' || variant === 'calm';
  const sad = variant === 'sad' || variant === 'winter' || variant === 'rain';
  const rpgOst = variant === 'rpgost';

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const isIntro = bar < 4;
    const isBridge = isBridgeBar(bar);
    const isChorus = isChorusBar(bar);
    const left = getChordNotesInMidiRange(chord, notes, 36, 55);
    const mid = getChordNotesInMidiRange(chord, notes, 52, 72);
    const nextMid = getChordNotesInMidiRange(nextChord, notes, 52, 74);
    const bass = left[0] ?? CHORD_TONES[chord].bass;
    const fifth = left[2] ?? left[1] ?? bass;
    const third = left[1] ?? fifth;
    const mid1 = mid[(bar + analysis.variation) % Math.max(1, mid.length)] ?? third;
    const mid2 = mid[(bar + analysis.variation + 1) % Math.max(1, mid.length)] ?? mid1;
    const mid3 = mid[(bar + analysis.variation + 2) % Math.max(1, mid.length)] ?? mid2;
    const leadIn = nextMid[(bar + analysis.variation + 3) % Math.max(1, nextMid.length)] ?? mid3;
    const arpeggio =
      rpgOst
          ? [
              { offset: 0, note: bass, duration: 4 },
              { offset: 3, note: fifth, duration: 1 },
              { offset: 5, note: third, duration: 2 },
              { offset: 8, note: mid1, duration: 3 },
              { offset: 11, note: fifth, duration: 1 },
              { offset: 13, note: leadIn, duration: 2 },
            ]
        : quiet || isIntro
        ? [
            { offset: 0, note: bass, duration: 4 },
            { offset: 4, note: fifth, duration: 2 },
            { offset: 8, note: third, duration: 2 },
            { offset: 12, note: mid1, duration: 3 },
          ]
        : sad || isBridge
          ? [
              { offset: 0, note: bass, duration: 3 },
              { offset: 3, note: fifth, duration: 1 },
              { offset: 6, note: third, duration: 2 },
              { offset: 9, note: fifth, duration: 1 },
              { offset: 12, note: mid1, duration: 3 },
              { offset: 15, note: third, duration: 1 },
            ]
          : [
              { offset: 0, note: bass, duration: 2 },
              { offset: 2, note: fifth, duration: 1 },
              { offset: 4, note: third, duration: 1 },
              { offset: 6, note: mid1, duration: 1 },
              { offset: 8, note: bass, duration: 2 },
              { offset: 10, note: fifth, duration: 1 },
              { offset: 12, note: mid2, duration: 1 },
              { offset: 14, note: mid3, duration: 1 },
            ];

    arpeggio.forEach((item) => addNote(events, item.note, base + item.offset, item.duration, validator));
    addNote(events, mid1, base, quiet ? 6 : 4, validator);
    if (!quiet || isChorus) addNote(events, mid2, base + 8, isChorus ? 4 : 2, validator);
    if (isChorus && !isBridge) {
      addNote(events, mid3, base + 4, 2, validator);
      addNote(events, leadIn, base + 12, 3, validator);
    }
    if (bar % 4 === 3) {
      addNote(events, leadIn, base + 14, 2, validator);
    }
  }

  return events;
}

function createCalmPianoBed(analysis: PromptAnalysis, notes: readonly string[]) {
  const validator = createNoteValidator(notes);
  const events: MusicEvent[] = [];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const voicing = getStackedChordVoicing(chord, notes, bar, analysis.variation);
    const nextVoicing = getStackedChordVoicing(nextChord, notes, bar + 1, analysis.variation + 1);
    const low = voicing[0];
    const mid = voicing[1] ?? voicing[0];
    const high = voicing[2] ?? voicing[1] ?? voicing[0];
    const response = nextVoicing[1] ?? nextVoicing[0] ?? high;
    const phraseLift = nextVoicing[2] ?? high;

    [low, mid, high].filter(Boolean).forEach((note) => addNote(events, note, base, 8, validator));
    addNote(events, mid, base + 6, 3, validator);
    addNote(events, high, base + 10, 4, validator);

    if (bar >= 4) {
      addNote(events, low, base + 8, 6, validator);
    }

    if (bar % 2 === analysis.variation % 2) {
      addNote(events, response, base + 12, 3, validator);
    }

    if (bar % 4 === 3 || isChorusBar(bar)) {
      addNote(events, phraseLift, base + 14, 2, validator);
    }
  }

  return events;
}

void createCalmPianoBed;

function createExpressiveSoloPiano(analysis: PromptAnalysis, notes: readonly string[]) {
  const validator = createNoteValidator(notes);
  const events: MusicEvent[] = [];
  let previousTop: string | null = null;
  const pianoVariant = getSoloPianoVariant(analysis);
  const variantShift =
    pianoVariant === 'sad' ? 2 :
    pianoVariant === 'night' ? 5 :
    pianoVariant === 'rain' ? 7 :
    pianoVariant === 'winter' ? 11 :
    pianoVariant === 'bright' ? 13 :
    0;

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const energy = getBarEnergy(analysis, bar);
    const leftHand = getChordNotesInMidiRange(chord, notes, 36, 55);
    const rightHand = getChordNotesInMidiRange(chord, notes, pianoVariant === 'lyrical' ? 60 : 57, pianoVariant === 'lyrical' ? 84 : 76);
    const nextRightHand = getChordNotesInMidiRange(nextChord, notes, pianoVariant === 'lyrical' ? 60 : 57, pianoVariant === 'lyrical' ? 84 : 76);
    const bass = leftHand[0] ?? CHORD_TONES[chord].bass;
    const lowThird = leftHand[1] ?? bass;
    const fifth = leftHand[2] ?? lowThird;
    const mid = rightHand[(bar + analysis.variation + variantShift + (analysis.promptSeed % 5)) % Math.max(1, rightHand.length)] ?? CHORD_TONES[chord].melody[0];
    const upperMid = rightHand[(bar + analysis.variation + variantShift + 1) % Math.max(1, rightHand.length)] ?? mid;
    const top = chooseConnectedMelodyNote(rightHand.length ? rightHand : getChordPalette(chord, notes), analysis.variation + bar + variantShift + (analysis.promptSeed % 7), previousTop);
    const answer = chooseConnectedMelodyNote(nextRightHand.length ? nextRightHand : rightHand, analysis.variation + bar + variantShift + 2, top);
    const isSoft = analysis.mood === 'calm' || analysis.mood === 'sad' || analysis.theme === 'winter';
    const isPeak = isChorusBar(bar) && bar % 4 !== 0;
    const isIntro = bar < 4;
    const isBridge = isBridgeBar(bar);
    const harmonyBelow = rightHand[Math.max(0, rightHand.indexOf(top) - 1)] ?? mid;
    const harmonyAbove = rightHand[Math.min(rightHand.length - 1, rightHand.indexOf(top) + 1)] ?? upperMid;
    const top2 = chooseConnectedMelodyNote(rightHand.length ? rightHand : getChordPalette(chord, notes), analysis.variation + bar + variantShift + 3 + (analysis.promptSeed % 9), top);
    const top3 = chooseConnectedMelodyNote(nextRightHand.length ? nextRightHand : rightHand, analysis.variation + bar + variantShift + 5, top2);
    const top4 = chooseConnectedMelodyNote(rightHand.length ? rightHand : getChordPalette(chord, notes), analysis.variation + bar + variantShift + 7, top3);
    const rightFlowBase = [mid, harmonyBelow, top, top2, upperMid, top3, answer, top4];
    const rightFlow =
      pianoVariant === 'sad'
        ? [top, harmonyBelow, mid, top2, answer, harmonyBelow, top3, mid]
        : pianoVariant === 'rain'
          ? [mid, top, mid, harmonyBelow, top2, upperMid, top3, answer]
          : pianoVariant === 'winter'
            ? [harmonyBelow, mid, top, answer, upperMid, top2, harmonyBelow, top3]
            : pianoVariant === 'bright'
              ? [mid, top, upperMid, top2, top3, answer, top4, upperMid]
              : pianoVariant === 'night'
                ? [mid, harmonyBelow, top, answer, top2, upperMid, top3, top4]
                : rightFlowBase;

    const leftPattern =
      pianoVariant === 'lyrical'
        ? [
            { offset: 0, note: bass, duration: 2 },
            { offset: 2, note: fifth, duration: 1 },
            { offset: 4, note: lowThird, duration: 1 },
            { offset: 6, note: fifth, duration: 1 },
            { offset: 8, note: bass, duration: 2 },
            { offset: 10, note: fifth, duration: 1 },
            { offset: 12, note: lowThird, duration: 1 },
            { offset: 14, note: fifth, duration: 1 },
          ]
        :
      pianoVariant === 'rain'
        ? [
            { offset: 0, note: bass, duration: 2 },
            { offset: 3, note: fifth, duration: 1 },
            { offset: 6, note: lowThird, duration: 1 },
            { offset: 9, note: fifth, duration: 1 },
            { offset: 12, note: bass, duration: 2 },
            { offset: 15, note: lowThird, duration: 1 },
          ]
        : pianoVariant === 'sad' || pianoVariant === 'winter'
        ? [
            { offset: 0, note: bass, duration: 4 },
            { offset: 5, note: lowThird, duration: 2 },
            { offset: 9, note: fifth, duration: 2 },
            { offset: 13, note: lowThird, duration: 2 },
          ]
        : pianoVariant === 'bright'
        ? [
            { offset: 0, note: bass, duration: 2 },
            { offset: 2, note: fifth, duration: 1 },
            { offset: 4, note: lowThird, duration: 1 },
            { offset: 6, note: fifth, duration: 1 },
            { offset: 8, note: bass, duration: 2 },
            { offset: 10, note: fifth, duration: 1 },
            { offset: 12, note: lowThird, duration: 1 },
            { offset: 14, note: fifth, duration: 1 },
          ]
        : isBridge
        ? [
            { offset: 0, note: bass, duration: 3 },
            { offset: 4, note: lowThird, duration: 1 },
            { offset: 8, note: fifth, duration: 2 },
            { offset: 12, note: lowThird, duration: 2 },
          ]
        : isIntro
        ? [
            { offset: 0, note: bass, duration: 3 },
            { offset: 2, note: fifth, duration: 1 },
            { offset: 4, note: lowThird, duration: 1 },
            { offset: 6, note: fifth, duration: 1 },
            { offset: 8, note: bass, duration: 2 },
            { offset: 10, note: lowThird, duration: 1 },
            { offset: 12, note: fifth, duration: 1 },
            { offset: 14, note: lowThird, duration: 1 },
          ]
        : isPeak
        ? [
            { offset: 0, note: bass, duration: 2 },
            { offset: 2, note: fifth, duration: 1 },
            { offset: 4, note: lowThird, duration: 1 },
            { offset: 6, note: fifth, duration: 1 },
            { offset: 8, note: bass, duration: 2 },
            { offset: 10, note: lowThird, duration: 1 },
            { offset: 12, note: fifth, duration: 1 },
            { offset: 14, note: lowThird, duration: 1 },
          ]
        : [
            { offset: 0, note: bass, duration: isSoft ? 3 : 2 },
            { offset: 2, note: fifth, duration: 1 },
            { offset: 4, note: lowThird, duration: 1 },
            { offset: 6, note: fifth, duration: 1 },
            { offset: 8, note: bass, duration: 2 },
            { offset: 10, note: lowThird, duration: 1 },
            { offset: 12, note: fifth, duration: 1 },
            { offset: 14, note: lowThird, duration: 1 },
          ];

    leftPattern.forEach((item) => addNote(events, item.note, base + item.offset, item.duration, validator));

    if (!isBridge) {
      const ornamentOffsets =
        pianoVariant === 'sad'
          ? [2, 5, 7, 11, 14]
          : pianoVariant === 'lyrical'
            ? [1, 3, 5, 7, 9, 10, 11, 13, 15]
          : pianoVariant === 'winter'
            ? [1, 4, 7, 10, 13, 15]
            : pianoVariant === 'rain'
              ? [1, 3, 5, 7, 9, 11, 13, 15]
              : pianoVariant === 'bright'
                ? [1, 2, 3, 5, 7, 9, 10, 11, 13, 15]
                : pianoVariant === 'night'
                  ? [1, 3, 6, 8, 11, 13, 15]
                  : isIntro ? [1, 3, 5, 7, 9, 11, 13, 15] : [1, 3, 5, 7, 9, 11, 13, 15];
      ornamentOffsets.forEach((offset, index) => {
        const note = rightFlow[(index + bar + variantShift + (analysis.promptSeed % 5)) % rightFlow.length];
        addNote(events, note, base + offset, 1, validator);
      });
    }

    if (isIntro) {
      addNote(events, mid, base + 4, 2, validator);
      addNote(events, top, base + 8, 2, validator);
      addNote(events, answer, base + 12, 2, validator);
      if (bar % 2 === 1) addNote(events, harmonyBelow, base + 12, 2, validator);
    } else {
      const mainMelodyOffset = isPeak ? 8 : isBridge ? 12 : 8;
      addNote(events, mid, base + 4, 2, validator);
      addNote(events, top, base + mainMelodyOffset, isPeak ? 3 : 2, validator);
      addNote(events, answer, base + 12, 2, validator);
      if (!isBridge) {
        addNote(events, top2, base + 6, 1, validator);
        addNote(events, top3, base + 10, 1, validator);
        addNote(events, top4, base + 14, 1, validator);
      }
    }

    if (!isBridge) {
      [0, 4, 8, 12].forEach((offset, index) => {
        const chordTone = rightFlow[(index * 2 + analysis.variation + bar) % rightFlow.length];
        addNote(events, chordTone, base + offset, offset === 0 ? 2 : 1, validator);
      });
    }

    if (!isIntro && (bar % 4 === 3 || isPeak || energy > 0.7)) {
      addNote(events, answer, base + 14, 2, validator);
    }

    if (rightHand.length >= 3 && !isBridge) {
      if (isPeak) {
        addNote(events, harmonyBelow, base + 8, 2, validator);
        addNote(events, harmonyBelow, base + 12, 2, validator);
        addNote(events, harmonyAbove, base + 14, 1, validator);
      } else if (!isIntro && bar % 2 === 0) {
        addNote(events, harmonyBelow, base + 12, 2, validator);
        addNote(events, harmonyAbove, base + 8, 1, validator);
      }
    }

    if (bar % 8 === 7 && nextRightHand.length > 0) {
      const leadIn = chooseConnectedMelodyNote(nextRightHand, analysis.variation + bar + 4, answer);
      addNote(events, leadIn, base + 14, 2, validator);
      addNote(events, upperMid, base + 14, 1, validator);
    }

    previousTop = answer;
  }

  return events;
}

void createExpressiveSoloPiano;

function enrichLeadMelodyPhrases(events: MusicEvent[], analysis: PromptAnalysis) {
  const enriched = [...events];
  const countsByBar = new Map<number, number>();
  polishEvents(events).forEach((event) => {
    const bar = Math.floor(event.start / BAR_LENGTH);
    countsByBar.set(bar, (countsByBar.get(bar) ?? 0) + 1);
  });

  let previousNote = polishEvents(events).at(-1)?.note ?? null;
  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const currentCount = countsByBar.get(bar) ?? 0;
    const isIntro = bar < 4;
    const isBridge = isBridgeBar(bar);
    const targetNotes =
      isSoloPianoStyle(analysis)
        ? isIntro ? 8 : isBridge ? 5 : isChorusBar(bar) ? 12 : 9
        : analysis.mood === 'calm'
        ? isIntro ? 1 : 2
        : analysis.genre === 'citypop' || analysis.theme === 'summerNight' || analysis.mood === 'dreamy'
          ? isChorusBar(bar) ? 5 : isBridge ? 2 : 3
          : isChorusBar(bar)
            ? 4
            : 2;

    if (currentCount >= targetNotes) continue;

    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const palette = getConstrainedLeadPalette(chord, analysis, previousNote);
    const nextPalette = getConstrainedLeadPalette(nextChord, analysis, previousNote);
    const missing = targetNotes - currentCount;
    const phraseOffsets =
      isSoloPianoStyle(analysis) || analysis.mood === 'calm'
        ? isSoloPianoStyle(analysis)
          ? [0, 4, 8, 10, 12, 14]
          : [8, 12]
        : analysis.genre === 'citypop' || analysis.theme === 'summerNight'
          ? [4, 8, 12, 14]
          : [6, 10, 14];

    phraseOffsets.slice(0, missing).forEach((offset, index) => {
      const activePalette = offset >= 12 ? nextPalette : palette;
      const degree = analysis.variation + bar + index + getMelodySectionShift(analysis, bar);
      const note = chooseMovingMelodyNote(activePalette, degree, previousNote, base + offset);
      addNote(enriched, note, base + offset, offset >= 13 ? 2 : 1, isValidMelodyNote);
      previousNote = note;
    });
  }

  return enriched;
}

function developMelodyWithMotifs(events: MusicEvent[], analysis: PromptAnalysis) {
  const developed = [...events];
  const occupied = new Set(polishEvents(events).map((event) => `${event.start}:${event.note}`));
  let previousNote = polishEvents(events).at(-1)?.note ?? null;

  const addDevelopedNote = (note: string, start: number, duration: number) => {
    const key = `${start}:${note}`;
    if (occupied.has(key)) return;
    occupied.add(key);
    addNote(developed, note, start, duration, isValidMelodyNote);
    previousNote = note;
  };

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const base = bar * BAR_LENGTH;
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const palette = getConstrainedLeadPalette(chord, analysis, previousNote);
    const nextPalette = getConstrainedLeadPalette(nextChord, analysis, previousNote);
    const sectionShift = getMelodySectionShift(analysis, bar);
    const isIntro = bar < 4;
    const isBridge = isBridgeBar(bar);
    const isChorus = isChorusBar(bar);
    const isPhraseAnswer = bar % 4 === 1 || bar % 4 === 2;
    const isPhraseTurnaround = bar % 4 === 3;

    if (isIntro && !isSoloPianoStyle(analysis) && analysis.theme !== 'christmas') continue;

    if (isPhraseAnswer && !isBridge) {
      const answerOffset = analysis.mood === 'calm' || analysis.mood === 'sad' ? 10 : 6;
      const answerNote = chooseMovingMelodyNote(
        palette,
        analysis.variation + bar + sectionShift + (analysis.promptSeed % 5),
        previousNote,
        base + answerOffset
      );
      addDevelopedNote(answerNote, base + answerOffset, isSoloPianoStyle(analysis) ? 2 : 1);
    }

    if (isChorus && !isBridge) {
      const liftOffset = analysis.genre === 'citypop' || analysis.mood === 'bright' || analysis.mood === 'energetic' ? 11 : 12;
      const liftNote = chooseMovingMelodyNote(
        nextPalette,
        analysis.variation + bar + sectionShift + 3 + (analysis.promptSeed % 7),
        previousNote,
        base + liftOffset
      );
      addDevelopedNote(liftNote, base + liftOffset, 1);

      const stack = getMelodyStackNotes(nextPalette, liftNote, bar, 1, analysis.variation)[0];
      if (stack && (analysis.genre === 'citypop' || analysis.theme === 'summerNight' || isSoloPianoStyle(analysis))) {
        addDevelopedNote(stack, base + liftOffset, 1);
      }
    }

    if (isPhraseTurnaround) {
      const pickupOffsets =
        analysis.mood === 'calm' || analysis.mood === 'sad'
          ? [12, 14]
          : analysis.genre === 'dance' || analysis.mood === 'energetic'
            ? [10, 12, 14]
            : [11, 14];

      pickupOffsets.forEach((offset, index) => {
        const pickupNote = chooseMovingMelodyNote(
          nextPalette,
          analysis.variation + sectionShift + bar + index + 2 + (analysis.promptSeed % 9),
          previousNote,
          base + offset
        );
        addDevelopedNote(pickupNote, base + offset, offset >= 14 ? 2 : 1);
      });
    }

    if (isSoloPianoStyle(analysis) && !isBridge && bar % 2 === 0) {
      const ornamentalOffsets = getSoloPianoVariant(analysis) === 'sad' || getSoloPianoVariant(analysis) === 'winter'
        ? [5, 13]
        : [3, 7, 13];
      ornamentalOffsets.forEach((offset, index) => {
        const ornament = chooseConnectedMelodyNote(
          palette,
          analysis.variation + bar + index + sectionShift + (analysis.promptSeed % 11),
          previousNote
        );
        addDevelopedNote(ornament, base + offset, 1);
      });
    }
  }

  return developed;
}

function createPianoCompBed(analysis: PromptAnalysis, notes: readonly string[]) {
  const validator = createNoteValidator(notes);
  const events: MusicEvent[] = [];
  const isDreamCity = analysis.genre === 'citypop' || analysis.theme === 'summerNight' || analysis.theme === 'night';

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    if (bar < 4 && !isDreamCity && !isSoloPianoStyle(analysis)) continue;

    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const voicing = getStackedChordVoicing(chord, notes, bar, analysis.variation);
    const nextVoicing = getStackedChordVoicing(nextChord, notes, bar + 1, analysis.variation + 2);
    const energy = getBarEnergy(analysis, bar);
    const offsets =
      isSoloPianoStyle(analysis) || analysis.mood === 'calm'
        ? [0, 8, 12]
        : isDreamCity
          ? [0, 8]
          : [0, 8];

    offsets.forEach((offset, hitIndex) => {
      if (hitIndex > 1 && energy < 0.7 && bar % 2 === 1) return;
      const activeVoicing = offset >= 9 ? nextVoicing : voicing;
      const duration =
        isSoloPianoStyle(analysis) || analysis.mood === 'calm'
          ? offset === 0 ? 7 : 4
          : isDreamCity
            ? hitIndex === 0 ? 3 : 2
            : 4;

      activeVoicing.slice(0, isDreamCity ? 2 : 2).forEach((note) => {
        addNote(events, note, base + offset, Math.min(duration, BAR_LENGTH - offset), validator);
      });
    });
  }

  return events;
}

function createStudioAltoSaxAnswerLine(analysis: PromptAnalysis, random: () => number) {
  const validator = createNoteValidator(STUDIO_ALTO_SAX_NOTES);
  const events: MusicEvent[] = [];
  let previousNote: string | null = null;

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const shouldAnswer =
      (analysis.genre === 'citypop' || analysis.genre === 'jazz' || analysis.theme === 'summerNight') &&
      (bar % 8 === 3 || bar % 8 === 7 || (isChorusBar(bar) && bar % 4 === 1));
    if (!shouldAnswer || random() > 0.92) continue;

    const chord = getChordForBar(analysis, bar);
    const base = bar * BAR_LENGTH;
    const palette = getChordPalette(chord, STUDIO_ALTO_SAX_NOTES, false);
    if (palette.length === 0) continue;

    [8, 10, 14].forEach((offset, index) => {
      const note = chooseConnectedMelodyNote(palette, analysis.variation + bar + index, previousNote);
      addNote(events, note, base + offset, index === 2 ? 2 : 1, validator);
      previousNote = note;
    });
  }

  return events;
}

function createExtraTrack(
  instrument: ExtraInstrumentKey,
  label: string,
  volume: number,
  events: MusicEvent[]
): SerializedExtraInstrumentTrack {
  return {
    id: `ai-${instrument}`,
    instrument,
    label,
    volume,
    events: polishEvents(events),
  };
}

function createExtraTracks(analysis: PromptAnalysis, random: () => number): SerializedExtraInstrumentTrack[] {
  const tracks: SerializedExtraInstrumentTrack[] = [];
  const christmasPiccoloOffsets = [
    [8, 12],
    [6, 10, 14],
    [4, 11],
    [2, 8, 13],
  ];

  if (analysis.instruments.glockenspiel) {
    tracks.push(createExtraTrack(
      'glockenspiel',
      '글로켄슈필 포인트',
      analysis.theme === 'christmas' ? 78 : analysis.theme === 'spring' ? 66 : analysis.mood === 'bright' || analysis.mood === 'dreamy' ? 74 : 58,
      analysis.theme === 'christmas'
        ? createChristmasBellLine(analysis, GLOCKENSPIEL_NOTES)
        : createSparkleLine(
            analysis,
            random,
            GLOCKENSPIEL_NOTES,
            analysis.theme === 'spring' ? [6, 10, 14] : [10, 12, 14],
            4,
            analysis.theme === 'spring' ? 0.68 : 0.82
          )
    ));
  }

  if (analysis.instruments.piccolo) {
    tracks.push(createExtraTrack(
      'piccolo',
      '피콜로 응답 멜로디',
      analysis.theme === 'christmas' ? 54 : analysis.theme === 'spring' ? 50 : analysis.mood === 'bright' || analysis.genre === 'dance' ? 58 : 42,
      createSparkleLine(analysis, random, PICCOLO_NOTES, analysis.theme === 'christmas' ? christmasPiccoloOffsets[analysis.variation % christmasPiccoloOffsets.length] : analysis.theme === 'spring' ? [10, 14] : [7, 14], 4, analysis.theme === 'spring' ? 0.42 : 0.52)
    ));
  }

  if (analysis.instruments.supportingPiano && !isSoloPianoStyle(analysis)) {
    tracks.push(createExtraTrack(
      'supportingPiano',
      '서포팅 피아노 코드',
      isSoloPianoStyle(analysis) ? 82 : analysis.theme === 'christmas' ? 80 : analysis.genre === 'ballad' || analysis.genre === 'lofi' ? 78 : 62,
      analysis.theme === 'christmas'
        ? createChristmasChordBed(analysis, SUPPORTING_PIANO_NOTES)
        : isSoloPianoStyle(analysis)
          ? createPremiumSoloPianoAccompaniment(analysis, SUPPORTING_PIANO_NOTES)
        : analysis.genre === 'citypop' || analysis.theme === 'summerNight' || analysis.theme === 'night' || analysis.mood === 'dreamy' || analysis.mood === 'calm'
          ? createPianoCompBed(analysis, SUPPORTING_PIANO_NOTES)
        : createChordBed(analysis, SUPPORTING_PIANO_NOTES, analysis.genre === 'ballad' ? 12 : 8)
    ));
  }

  if (analysis.instruments.chicagoStreet) {
    tracks.push(createExtraTrack(
      'chicagoStreet',
      '시카고 스트리트 리듬',
      analysis.genre === 'rock' || analysis.genre === 'dance' ? 70 : 52,
      createHarmonyLine(analysis, random, CHICAGO_STREET_NOTES, createNoteValidator(CHICAGO_STREET_NOTES), {
        density: analysis.genre === 'dance' || analysis.genre === 'rock' ? 0.74 : 0.38,
        offsets: [0, 6, 10, 14],
        duration: 2,
        restEvery: analysis.genre === 'ballad' ? 2 : undefined,
      })
    ));
  }

  if (analysis.instruments.studioAltoSax) {
    tracks.push(createExtraTrack(
      'studioAltoSax',
      '스튜디오 알토 색소폰',
      analysis.genre === 'jazz' || analysis.genre === 'citypop' ? 76 : 50,
      analysis.genre === 'jazz' || analysis.genre === 'citypop' || analysis.theme === 'summerNight'
        ? createStudioAltoSaxAnswerLine(analysis, random)
        : createHarmonyLine(analysis, random, STUDIO_ALTO_SAX_NOTES, createNoteValidator(STUDIO_ALTO_SAX_NOTES), {
            density: 0.32,
            offsets: [3, 7, 12],
            duration: 2,
            restEvery: 4,
          })
    ));
  }

  return tracks.filter((track) => (track.events?.length ?? 0) > 0);
}

function polishEvents(events: MusicEvent[]) {
  const seen = new Set<string>();
  return events
    .filter((event) => {
      const id = `${event.note ?? event.type}-${event.start}-${event.duration ?? 1}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return event.start >= 0 && event.start < TOTAL_STEPS;
    })
    .sort((a, b) => a.start - b.start || String(a.note ?? a.type).localeCompare(String(b.note ?? b.type)));
}

function capEventsPerStep(events: MusicEvent[], maxPerStep: number) {
  const counts = new Map<number, number>();
  return events.filter((event) => {
    const count = counts.get(event.start) ?? 0;
    if (count >= maxPerStep) return false;
    counts.set(event.start, count + 1);
    return true;
  });
}

function finalizeMelodicEvents(events: MusicEvent[], maxPerStep = 3) {
  return capEventsPerStep(polishEvents(events), maxPerStep);
}

function getNearestAllowedChordTone(note: string, chord: ChordName, allowedNotes: readonly string[], includePassing = false) {
  const normalizedNote = normalizeDiatonicNote(note);
  const targetMidi = noteToMidi(normalizedNote);
  const palette = getChordPalette(chord, allowedNotes, includePassing);
  const candidates = palette.length > 0 ? palette : allowedNotes.map(normalizeDiatonicNote);

  return [...candidates].sort((a, b) => {
    const aDistance = Math.abs(noteToMidi(a) - targetMidi);
    const bDistance = Math.abs(noteToMidi(b) - targetMidi);
    return aDistance - bDistance || noteToMidi(a) - noteToMidi(b);
  })[0] ?? normalizedNote;
}

function getNearestAllowedChordToneInRange(
  note: string,
  chord: ChordName,
  allowedNotes: readonly string[],
  minMidi: number,
  maxMidi: number
) {
  const normalizedNote = normalizeDiatonicNote(note);
  const targetMidi = noteToMidi(normalizedNote);
  const chordRoots = new Set(CHORD_TONES[chord].guitar.map(getNoteRoot));
  const rangedCandidates = uniqueNotes(allowedNotes.map(normalizeDiatonicNote))
    .filter((candidate) => chordRoots.has(getNoteRoot(candidate)))
    .filter((candidate) => {
      const midi = noteToMidi(candidate);
      return midi >= minMidi && midi <= maxMidi;
    });
  const candidates = rangedCandidates.length > 0 ? rangedCandidates : getChordPalette(chord, allowedNotes, false);

  return [...candidates].sort((a, b) => {
    const aDistance = Math.abs(noteToMidi(a) - targetMidi);
    const bDistance = Math.abs(noteToMidi(b) - targetMidi);
    return aDistance - bDistance || noteToMidi(a) - noteToMidi(b);
  })[0] ?? normalizedNote;
}

function harmonizeEventsToProgression(
  events: MusicEvent[],
  analysis: PromptAnalysis,
  allowedNotes: readonly string[],
  options: {
    maxPerStep?: number;
    maxPerBar?: number;
    includePassing?: boolean;
    maxDuration?: number;
  } = {}
) {
  const {
    maxPerStep = 1,
    maxPerBar = 8,
    includePassing = false,
    maxDuration = BAR_LENGTH,
  } = options;
  const countsByBar = new Map<number, number>();

  const harmonized = polishEvents(events)
    .map((event) => {
      const bar = Math.floor(event.start / BAR_LENGTH);
      const chord = getChordForBar(analysis, bar);
      const snappedNote = getNearestAllowedChordTone(event.note ?? CHORD_TONES[chord].melody[0], chord, allowedNotes, includePassing);
      const duration = Math.max(1, Math.min(event.duration ?? 1, maxDuration, BAR_LENGTH - (event.start % BAR_LENGTH)));

      return {
        ...event,
        note: snappedNote,
        duration,
      };
    })
    .filter((event) => {
      const bar = Math.floor(event.start / BAR_LENGTH);
      const count = countsByBar.get(bar) ?? 0;
      if (count >= maxPerBar) return false;
      countsByBar.set(bar, count + 1);
      return true;
    });

  return capEventsPerStep(harmonized, maxPerStep);
}

function harmonizeSupportingPianoToProgression(events: MusicEvent[], analysis: PromptAnalysis) {
  const countsByStart = new Map<number, number>();
  const countsByBar = new Map<number, number>();
  const minMidi = isSoloPianoStyle(analysis) ? 36 : 43;
  const maxMidi =
    isSoloPianoStyle(analysis)
      ? getSoloPianoVariant(analysis) === 'emotional'
        ? 88
        : getSoloPianoVariant(analysis) === 'calm'
          ? 80
          : 76
      : analysis.mood === 'sad' || analysis.mood === 'calm' || analysis.mood === 'dreamy'
      ? 67
      : 71;

  return polishEvents(events)
    .map((event) => {
      const bar = Math.floor(event.start / BAR_LENGTH);
      const offset = event.start % BAR_LENGTH;
      const chord = getChordForBar(analysis, bar);
      const snappedNote = getNearestAllowedChordToneInRange(
        event.note ?? CHORD_TONES[chord].guitar[0],
        chord,
        SUPPORTING_PIANO_NOTES,
        minMidi,
        maxMidi
      );

      return {
        ...event,
        note: snappedNote,
        duration: Math.max(1, Math.min(event.duration ?? 1, isSoloPianoStyle(analysis) ? 4 : 6, BAR_LENGTH - offset)),
      };
    })
    .filter((event) => {
      const bar = Math.floor(event.start / BAR_LENGTH);
      const barCount = countsByBar.get(bar) ?? 0;
      const maxPerBar = isSoloPianoStyle(analysis) ? 64 : analysis.mood === 'sad' || analysis.mood === 'calm' ? 8 : 10;
      if (barCount >= maxPerBar) return false;
      countsByBar.set(bar, barCount + 1);

      const startCount = countsByStart.get(event.start) ?? 0;
      const maxStack = isSoloPianoStyle(analysis) ? 8 : 2;
      if (startCount >= maxStack) return false;
      countsByStart.set(event.start, startCount + 1);
      return true;
    });
}

function harmonizeBassEventsToProgression(events: MusicEvent[], analysis: PromptAnalysis) {
  const countsByBar = new Map<number, number>();
  return polishEvents(events)
    .map((event) => {
      const bar = Math.floor(event.start / BAR_LENGTH);
      const chord = getChordForBar(analysis, bar);
      const root = CHORD_TONES[chord].bass;
      const rootName = getNoteRoot(root);
      const bassChoices = BASS_NOTES
        .map(normalizeDiatonicNote)
        .filter((note) => getNoteRoot(note) === rootName)
        .sort((a, b) => Math.abs(noteToMidi(a) - noteToMidi(event.note ?? root)) - Math.abs(noteToMidi(b) - noteToMidi(event.note ?? root)));

      return {
        ...event,
        note: bassChoices[0] ?? root,
        duration: Math.max(1, Math.min(event.duration ?? 1, analysis.mood === 'energetic' ? 4 : 6, BAR_LENGTH - (event.start % BAR_LENGTH))),
      };
    })
    .filter((event) => {
      const bar = Math.floor(event.start / BAR_LENGTH);
      const count = countsByBar.get(bar) ?? 0;
      if (count >= (analysis.mood === 'energetic' ? 4 : 3)) return false;
      countsByBar.set(bar, count + 1);
      return true;
    });
}

function getExtraTrackAllowedNotes(instrument: ExtraInstrumentKey) {
  switch (instrument) {
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
    default:
      return MELODY_NOTES;
  }
}

function getExtraTrackHarmonyOptions(instrument: ExtraInstrumentKey, analysis: PromptAnalysis) {
  if (instrument === 'supportingPiano') {
    return {
      maxPerStep: 3,
      maxPerBar: isSoloPianoStyle(analysis) ? 10 : analysis.mood === 'calm' || analysis.mood === 'sad' ? 6 : 10,
      includePassing: false,
      maxDuration: isSoloPianoStyle(analysis) ? 10 : analysis.mood === 'calm' || analysis.mood === 'sad' ? 8 : 4,
    };
  }

  if (instrument === 'glockenspiel' || instrument === 'piccolo') {
    return {
      maxPerStep: 1,
      maxPerBar: analysis.theme === 'christmas' || analysis.theme === 'spring' ? 6 : 4,
      includePassing: false,
      maxDuration: 2,
    };
  }

  return {
    maxPerStep: 1,
    maxPerBar: analysis.genre === 'jazz' || analysis.genre === 'citypop' ? 5 : 3,
    includePassing: false,
    maxDuration: 2,
  };
}

function getSafeMelodyChordTone(note: string, chord: ChordName, analysis?: PromptAnalysis) {
  const octaveMatch = note.match(/(-?\d+)$/);
  const octave = octaveMatch?.[1] ?? '4';
  const leadTones = getLeadMelodyTonePalette(chord, analysis);
  const chordRoots = new Set(leadTones.map((tone) => tone.replace(/-?\d+$/, '')));
  const root = note.replace(/-?\d+$/, '');

  if (chordRoots.has(root) && leadTones.includes(note)) {
    return note;
  }

  return leadTones.find((tone) => tone.endsWith(octave)) ?? leadTones[0];
}

function getStableMelodyResolution(chord: ChordName, analysis: PromptAnalysis, previousNote: string | null) {
  const palette = getConstrainedLeadPalette(chord, analysis, previousNote);
  const preferredRoot =
    analysis.mood === 'sad' || analysis.mood === 'dreamy' || analysis.mood === 'calm'
      ? CHORD_TONES[chord].melody[1] ?? CHORD_TONES[chord].melody[0]
      : CHORD_TONES[chord].melody[0];
  const preferred = getSafeMelodyChordTone(preferredRoot, chord, analysis);
  const preferredDegree = Math.max(0, palette.indexOf(preferred));
  return chooseConnectedMelodyNote(palette, preferredDegree, previousNote);
}

function harmonizeLeadMelodyToProgression(events: MusicEvent[], analysis: PromptAnalysis) {
  let previousNote: string | null = null;
  const countsByStart = new Map<number, number>();

  return polishEvents(events)
    .map((event) => {
      const bar = Math.floor(event.start / BAR_LENGTH);
      const offset = event.start % BAR_LENGTH;
      const chord = getChordForBar(analysis, bar);
      const palette = getConstrainedLeadPalette(chord, analysis, previousNote);
      const safeNote = getSafeMelodyChordTone(normalizeDiatonicNote(event.note ?? CHORD_TONES[chord].melody[0]), chord, analysis);

      if (isSoloPianoStyle(analysis)) {
        const register = getSoloPianoLeadRegisterRange(analysis, bar);
        const activePitchClasses = getSoloPianoChordPitchClasses(chord, offset === 0 || offset === 4 || offset === 8 || offset === 12);
        const originalNote = normalizeDiatonicNote(event.note ?? CHORD_TONES[chord].melody[0]);
        let midi = noteToMidi(originalNote);
        const originalPitchClass = ((midi % 12) + 12) % 12;
        const isUsableOriginalNote = activePitchClasses.includes(originalPitchClass) && isValidMelodyNote(originalNote);
        if (!isUsableOriginalNote) {
          midi = noteToMidi(safeNote);
        }
        if (midi < register.min || midi > register.max) {
          const isIntentionalLowOrHigh = midi <= 52 || midi >= 72;
          if (!isIntentionalLowOrHigh) {
            midi = findNearestMidiWithPitchClass(midi, activePitchClasses, register.min, register.max);
          }
        }
        if (previousNote && Math.abs(midi - noteToMidi(previousNote)) > 17) {
          const isIntentionalRegisterJump = midi <= 52 || midi >= 72 || noteToMidi(previousNote) <= 52 || noteToMidi(previousNote) >= 72;
          if (!isIntentionalRegisterJump) {
            midi = findNearestMidiWithPitchClass(
              noteToMidi(previousNote) + Math.sign(midi - noteToMidi(previousNote)) * 12,
              activePitchClasses,
              register.min,
              register.max
            );
          }
        }
        const rangedNote = liftMelodyNoteToMainRegister(midiToMelodyNote(midi), chord, analysis, bar);
        previousNote = rangedNote;

        return {
          ...event,
          note: rangedNote,
          duration: Math.max(1, Math.min(event.duration ?? 1, 4, BAR_LENGTH - offset)),
        };
      }

      const preferredDegree = findNearestPaletteDegree(palette, safeNote, previousNote);
      const isPhraseEnd = offset >= 12 || bar % 4 === 3;
      const isOpening = offset <= 1;
      const connectedNote =
        isPhraseEnd || isOpening
          ? getStableMelodyResolution(chord, analysis, previousNote)
          : chooseConnectedMelodyNote(palette, preferredDegree, previousNote);
      const rangedNote = chooseNearestPaletteNote(palette, fitMelodyMoodRange(connectedNote, analysis), previousNote);
      const mainRegisterNote = liftMelodyNoteToMainRegister(rangedNote, chord, analysis, bar);
      const duration = Math.max(1, Math.min(event.duration ?? 1, isSoloPianoStyle(analysis) ? 4 : 3, BAR_LENGTH - offset));
      previousNote = mainRegisterNote;

      return {
        ...event,
        note: mainRegisterNote,
        duration,
      };
    })
    .filter((event) => {
      const count = countsByStart.get(event.start) ?? 0;
      const maxStack = isSoloPianoStyle(analysis) ? 3 : 1;
      if (count >= maxStack) return false;
      countsByStart.set(event.start, count + 1);
      return true;
    });
}

function fitMelodyMoodRange(note: string, analysis: PromptAnalysis) {
  if (isSoloPianoStyle(analysis)) return note;
  if (analysis.theme === 'christmas') return note;

  const midi = noteToMidi(note);
  if ((analysis.styleId === 'mysticFeeling' || analysis.styleId === 'dreamyFeeling') && midi > 69) {
    const lowered = note.replace(/([A-G])(\d+)$/, (_match, root: string, octave: string) => `${root}${Math.max(2, Number(octave) - 1)}`);
    return isValidMelodyNote(lowered) ? lowered : note;
  }
  if ((analysis.mood === 'sad' || analysis.mood === 'calm') && midi > 72) {
    const lowered = note.replace(/([A-G])(\d+)$/, (_match, root: string, octave: string) => `${root}${Math.max(2, Number(octave) - 1)}`);
    return isValidMelodyNote(lowered) ? lowered : note;
  }
  if (analysis.mood === 'dreamy' && midi > 76) {
    const lowered = note.replace(/([A-G])(\d+)$/, (_match, root: string, octave: string) => `${root}${Math.max(2, Number(octave) - 1)}`);
    return isValidMelodyNote(lowered) ? lowered : note;
  }

  return note;
}

function snapMelodyStartToGroove(start: number, analysis: PromptAnalysis) {
  const bar = Math.floor(start / BAR_LENGTH);
  const offset = start % BAR_LENGTH;
  const allowedOffsets =
    isSoloPianoStyle(analysis)
      ? [0, 2, 4, 6, 8, 10, 12, 14]
      : analysis.mood === 'calm'
      ? [0, 4, 8, 12]
      : [0, 2, 4, 6, 8, 10, 12, 14];
  const snappedOffset = allowedOffsets
    .slice()
    .sort((a, b) => Math.abs(a - offset) - Math.abs(b - offset))[0] ?? offset;

  return Math.min(TOTAL_STEPS - 1, bar * BAR_LENGTH + snappedOffset);
}

function evolveMelodySections(events: MusicEvent[], analysis: PromptAnalysis) {
  if (analysis.theme === 'christmas') return events;

  let previousNote: string | null = null;
  const evolved = polishEvents(events).map((event, index) => {
    const bar = Math.floor(event.start / BAR_LENGTH);
    const offset = event.start % BAR_LENGTH;
    const section = getArrangementSection(bar);
    const phrase = Math.floor(bar / 4);
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const palette = getConstrainedLeadPalette(offset >= 12 ? nextChord : chord, analysis, previousNote);
    const shouldVary =
      section >= 1 &&
      !(
        analysis.mood === 'calm' &&
        bar < 8 &&
        index % 3 !== 0
      ) &&
      ((index + phrase + analysis.variation + analysis.promptSeed) % (section >= 3 ? 2 : 3) === 0);
    const rhythmicShift =
      shouldVary && !isSoloPianoStyle(analysis) && offset > 1 && offset < 14
        ? ((analysis.promptSeed + phrase + index) % 3) - 1
        : 0;
    const preferredDegree = findNearestPaletteDegree(palette, event.note ?? 'C4', previousNote);
    const degreeShift =
      !shouldVary
        ? 0
        : section === 1
          ? 1
          : section === 2
            ? -1
            : section === 3
              ? 2
              : phrase % 2 === 0
                ? -2
                : 1;
    const note = shouldVary
      ? chooseMovingMelodyNote(palette, preferredDegree + degreeShift, previousNote, event.start + index)
      : event.note ?? palette[0] ?? 'C4';
    const start = Math.max(0, Math.min(TOTAL_STEPS - 1, event.start + rhythmicShift));
    const duration =
      shouldVary && section >= 3
        ? Math.max(1, Math.min((event.duration ?? 1) + (index % 2 === 0 ? 1 : 0), BAR_LENGTH - (start % BAR_LENGTH)))
        : event.duration;

    previousNote = note;
    return { ...event, start, note, duration };
  });

  return polishEvents(evolved);
}

function finalizeLeadMelody(events: MusicEvent[], analysis: PromptAnalysis) {
  if (isSoloPianoStyle(analysis) && getSoloPianoVariant(analysis) === 'canon') {
    return polishEvents(events);
  }

  let previousEnd = -1;
  let previousNote: string | null = null;
  let previousStart = -1;
  const notesPerStart = new Map<number, number>();

  const finalizedEvents = evolveMelodySections(events, analysis)
    .map((event) => {
      const snappedStart = snapMelodyStartToGroove(event.start, analysis);
      const chord = getChordForBar(analysis, Math.floor(snappedStart / BAR_LENGTH));
      const palette = getConstrainedLeadPalette(chord, analysis, previousNote);
      const normalizedNote = normalizeDiatonicNote(event.note ?? 'C4');
      const safeNote =
        analysis.theme === 'christmas' && isChristmasMelodySafe(normalizedNote, chord)
          ? normalizedNote
          : getSafeMelodyChordTone(normalizedNote, chord, analysis);
      const preferredDegree = findNearestPaletteDegree(palette, safeNote, previousNote);
      const isStackedNote = snappedStart === previousStart;
      const connectedNote = isStackedNote
        ? safeNote
        : analysis.theme === 'christmas'
          ? safeNote
          : analysis.styleId === 'mysticFeeling' || analysis.styleId === 'dreamyFeeling' || analysis.mood === 'sad' || analysis.mood === 'calm'
            ? chooseConnectedMelodyNote(palette, preferredDegree, previousNote)
            : chooseMovingMelodyNote(palette, preferredDegree, previousNote, event.start);
      const maxDuration =
        analysis.theme === 'calm' ||
        analysis.theme === 'winter' ||
        analysis.theme === 'breakup' ||
        analysis.theme === 'cinematic'
          ? 4
          : 2;
      const previousMidi = previousNote ? noteToMidi(previousNote) : noteToMidi(connectedNote);
      const finalNote =
        analysis.theme !== 'christmas' && Math.abs(noteToMidi(connectedNote) - previousMidi) > 12
          ? chooseConnectedMelodyNote(palette, preferredDegree, previousNote)
          : connectedNote;
      const rangedNote = fitMelodyMoodRange(finalNote, analysis);
      const duration = Math.max(1, Math.min(event.duration ?? 1, maxDuration, BAR_LENGTH - (event.start % BAR_LENGTH)));
      if (!isStackedNote) {
        previousNote = rangedNote;
      }
      previousStart = snappedStart;

      return {
        ...event,
        start: snappedStart,
        note: rangedNote,
        duration,
      };
    })
    .filter((event) => {
      const count = notesPerStart.get(event.start) ?? 0;
      if (count >= 3) return false;
      notesPerStart.set(event.start, count + 1);

      if (!isSoloPianoStyle(analysis) && event.start !== previousStart && event.start < previousEnd) {
        return false;
      }

      previousEnd = event.start + (event.duration ?? 1);
      previousStart = event.start;
      return true;
    });

  return expandMelodyAcrossFullKeyboard(
    harmonizeLeadMelodyToProgression(finalizedEvents, analysis),
    analysis
  );
}

function limitAutoArrangement(analysis: PromptAnalysis, tracks: SongProject['tracks'], extraTracks: SerializedExtraInstrumentTrack[]) {
  if (
    analysis.theme === 'christmas' ||
    analysis.theme === 'winter' ||
    analysis.theme === 'summerSea' ||
    analysis.theme === 'summerNight' ||
    analysis.theme === 'spring' ||
    analysis.theme === 'calm' ||
    analysis.theme === 'cafeLofi' ||
    analysis.theme === 'kpopDance' ||
    analysis.theme === 'gameBgm' ||
    analysis.theme === 'cinematic' ||
    analysis.theme === 'rainyNight' ||
    analysis.theme === 'breakup'
  ) {
    return { tracks, extraTracks };
  }

  const hasLeadRequest = analysis.instruments.saxophone || analysis.instruments.violin;
  return {
    tracks: {
      ...tracks,
      violin: hasLeadRequest ? tracks.violin : [],
      saxophone: hasLeadRequest ? tracks.saxophone : [],
    },
    extraTracks: extraTracks.slice(0, 2),
  };
}

function keepEveryNthBar(events: MusicEvent[], n: number) {
  return events.filter((event) => Math.floor(event.start / BAR_LENGTH) % n === 0 || isChorusBar(Math.floor(event.start / BAR_LENGTH)));
}

function simplifyEvents(events: MusicEvent[], maxPerBar: number) {
  const counts = new Map<number, number>();
  return polishEvents(events).filter((event) => {
    const bar = Math.floor(event.start / BAR_LENGTH);
    const count = counts.get(bar) ?? 0;
    if (count >= maxPerBar) return false;
    counts.set(bar, count + 1);
    return true;
  });
}

function duckEventsAgainstMelody(events: MusicEvent[], melodyEvents: MusicEvent[], preserveEveryBars = 4) {
  const melodyStarts = new Set<number>();
  melodyEvents.forEach((event) => {
    const duration = Math.max(1, event.duration ?? 1);
    for (let step = event.start; step < event.start + duration; step += 1) {
      melodyStarts.add(step);
    }
  });

  return polishEvents(events).filter((event) => {
    const bar = Math.floor(event.start / BAR_LENGTH);
    if (bar % preserveEveryBars === preserveEveryBars - 1 || isChorusBar(bar)) return true;

    return !melodyStarts.has(event.start) && !melodyStarts.has(event.start + 1) && !melodyStarts.has(event.start - 1);
  });
}

function cleanPianoAgainstMelody(events: MusicEvent[], melodyEvents: MusicEvent[], analysis: PromptAnalysis) {
  const melodyWindows = new Map<number, number>();
  melodyEvents.forEach((event) => {
    const melodyMidi = noteToMidi(event.note ?? 'C4');
    const duration = Math.max(1, event.duration ?? 1);
    for (let step = event.start; step < event.start + duration; step += 1) {
      melodyWindows.set(step, Math.max(melodyWindows.get(step) ?? 0, melodyMidi));
    }
  });

  const countsByStart = new Map<number, number>();
  return polishEvents(events)
    .filter((event) => {
      const eventMidi = noteToMidi(event.note ?? 'C4');
      const melodyMidi =
        melodyWindows.get(event.start) ??
        melodyWindows.get(event.start + 1) ??
        melodyWindows.get(event.start - 1);

      if (typeof melodyMidi === 'number') {
        const isDreamCity = analysis.genre === 'citypop' || analysis.theme === 'summerNight' || analysis.mood === 'dreamy';
        const tooClose = Math.abs(eventMidi - melodyMidi) <= (isDreamCity ? 5 : 2);
        const aboveMelody = eventMidi >= melodyMidi - (isDreamCity ? 6 : 1);
        if (tooClose || aboveMelody) return false;
      }

      const startCount = countsByStart.get(event.start) ?? 0;
      const maxStack = isSoloPianoStyle(analysis) ? 3 : 2;
      if (startCount >= maxStack) return false;
      countsByStart.set(event.start, startCount + 1);
      return true;
    });
}

function polishLeadSupportAgainstMelody(
  analysis: PromptAnalysis,
  tracks: SongProject['tracks'],
  extraTracks: SerializedExtraInstrumentTrack[]
) {
  if (isSoloPianoStyle(analysis)) {
    return { tracks, extraTracks };
  }

  const shouldDuck =
    analysis.genre !== 'jazz' &&
    analysis.theme !== 'christmas' &&
    analysis.theme !== 'gameBgm' &&
    analysis.mood !== 'energetic';

  if (!shouldDuck) return { tracks, extraTracks };

  return {
    tracks: {
      ...tracks,
      violin: duckEventsAgainstMelody(tracks.violin, tracks.melody, analysis.mood === 'sad' ? 2 : 4),
      saxophone: duckEventsAgainstMelody(tracks.saxophone, tracks.melody, 4),
    },
    extraTracks: extraTracks.map((track) => {
      if (track.instrument === 'supportingPiano') {
        return {
          ...track,
          events: cleanPianoAgainstMelody(track.events ?? [], tracks.melody, analysis),
        };
      }
      if (track.instrument === 'glockenspiel') return track;
      return {
        ...track,
        events: duckEventsAgainstMelody(track.events ?? [], tracks.melody, 4),
      };
    }),
  };
}

function ensurePromptQualityFloor(
  analysis: PromptAnalysis,
  tracks: SongProject['tracks'],
  extraTracks: SerializedExtraInstrumentTrack[]
) {
  const qualityRandom = createRandom(createSeed(`${analysis.styleId}:${analysis.theme}:${analysis.genre}:quality-floor:${analysis.variation}`));
  const nextTracks: SongProject['tracks'] = { ...tracks };
  let nextExtraTracks = [...extraTracks];
  const minimumMelodyNotes =
    isDreamCityPopPrompt(analysis)
      ? 160
      : isSoloPianoStyle(analysis)
      ? 220
      : analysis.theme === 'christmas'
        ? 140
        : analysis.genre === 'dance' || analysis.mood === 'energetic'
          ? 128
          : analysis.mood === 'calm' || analysis.mood === 'sad' || analysis.mood === 'dreamy'
            ? 84
            : 108;

  if (nextTracks.melody.length < minimumMelodyNotes) {
    nextTracks.melody = finalizeLeadMelody(createMelody(analysis, qualityRandom), analysis);
  }

  const supportingPianoIndex = nextExtraTracks.findIndex((track) => track.instrument === 'supportingPiano');
  const minimumPianoNotes =
    isSoloPianoStyle(analysis)
      ? 240
      : analysis.mood === 'calm' || analysis.mood === 'sad' || analysis.mood === 'dreamy'
        ? 120
        : 84;

  if (!isSoloPianoStyle(analysis) && analysis.instruments.supportingPiano && (supportingPianoIndex === -1 || (nextExtraTracks[supportingPianoIndex].events?.length ?? 0) < minimumPianoNotes)) {
    const pianoEvents =
      analysis.theme === 'christmas'
        ? createChristmasChordBed(analysis, SUPPORTING_PIANO_NOTES)
        : isSoloPianoStyle(analysis)
          ? createPremiumSoloPianoAccompaniment(analysis, SUPPORTING_PIANO_NOTES)
          : createChordBed(analysis, SUPPORTING_PIANO_NOTES, analysis.mood === 'calm' || analysis.mood === 'sad' ? 10 : 8);
    const pianoTrack = createExtraTrack(
      'supportingPiano',
      'AI Piano Harmony',
      isSoloPianoStyle(analysis) ? 84 : 74,
      harmonizeSupportingPianoToProgression(pianoEvents, analysis)
    );

    if (supportingPianoIndex === -1) {
      nextExtraTracks.push(pianoTrack);
    } else {
      nextExtraTracks[supportingPianoIndex] = {
        ...nextExtraTracks[supportingPianoIndex],
        volume: Math.max(nextExtraTracks[supportingPianoIndex].volume ?? 0, pianoTrack.volume ?? 0),
        events: mergeTrackEvents(nextExtraTracks[supportingPianoIndex].events, pianoTrack.events, 3),
      };
    }
  }

  if (
    analysis.theme === 'christmas' &&
    analysis.instruments.glockenspiel &&
    !nextExtraTracks.some((track) => track.instrument === 'glockenspiel')
  ) {
    nextExtraTracks.push(createExtraTrack(
      'glockenspiel',
      'AI Carol Bells',
      72,
      harmonizeEventsToProgression(createChristmasBellLine(analysis, GLOCKENSPIEL_NOTES), analysis, GLOCKENSPIEL_NOTES, getExtraTrackHarmonyOptions('glockenspiel', analysis))
    ));
  }

  return {
    tracks: nextTracks,
    extraTracks: nextExtraTracks,
  };
}

function createPremiumLeadPhraseLayer(analysis: PromptAnalysis) {
  if (isSoloPianoStyle(analysis) && ['lyrical', 'quiet', 'calm', 'emotional', 'plain'].includes(getSoloPianoVariant(analysis))) {
    return finalizeLeadMelody(createYoutubeCalmPianoLeadMelody({
      ...analysis,
      variation: (analysis.variation + 7) % 24,
      promptSeed: (analysis.promptSeed ^ createSeed(`${analysis.styleId}:youtube-premium-layer`)) >>> 0,
    }), analysis);
  }

  const events: MusicEvent[] = [];
  const quietPiano = isSoloPianoStyle(analysis) && getSoloPianoVariant(analysis) === 'quiet';
  const phraseOffsets =
    quietPiano
      ? [4, 12]
      : isSoloPianoStyle(analysis)
        ? [2, 4, 7, 10, 12, 14]
        : analysis.mood === 'calm' || analysis.mood === 'sad'
          ? [4, 8, 12]
          : analysis.genre === 'citypop' || analysis.theme === 'summerNight'
            ? [3, 6, 10, 13, 15]
            : [2, 4, 7, 10, 12, 14];

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const base = bar * BAR_LENGTH;
    const section = getArrangementSection(bar);
    const isChorus = isChorusBar(bar);
    const phraseEnd = bar % 4 === 3;
    const densityGate =
      quietPiano
        ? bar % 2 === 0
        : isSoloPianoStyle(analysis)
          ? true
          : isChorus || phraseEnd || (analysis.promptSeed + bar + section) % 3 !== 0;

    if (!densityGate) continue;

    const palette = getConstrainedLeadPalette(chord, analysis, null);
    if (!palette.length) continue;
    const range =
      quietPiano
        ? { min: 52, max: 79 }
        : isSoloPianoStyle(analysis)
          ? getSoloPianoLeadRegisterRange(analysis, bar)
          : getMainMelodyRegisterRange(analysis, bar);
    const rangedPalette = palette.filter((note) => {
      const midi = noteToMidi(note);
      return midi >= range.min && midi <= range.max;
    });
    const usablePalette = rangedPalette.length ? rangedPalette : palette;

    phraseOffsets.forEach((offset, index) => {
      if (quietPiano && index > 0 && bar % 4 !== 0) return;
      if (!isSoloPianoStyle(analysis) && !isChorus && index > 2) return;
      const degreeShift = (analysis.promptSeed >> ((bar + index) % 13)) % usablePalette.length;
      const note = usablePalette[(analysis.variation + bar + index * 2 + degreeShift) % usablePalette.length];
      const duration =
        quietPiano
          ? 2
          : isSoloPianoStyle(analysis)
            ? offset % 4 === 0 ? 2 : 1
            : analysis.mood === 'calm' || analysis.mood === 'sad'
              ? 2
              : 1;
      addNote(events, note, base + offset, duration, isValidMelodyNote);
    });
  }

  return finalizeLeadMelody(events, analysis);
}

function blendPremiumMelody(analysis: PromptAnalysis, melodyEvents: MusicEvent[]) {
  const premiumLayer = createPremiumLeadPhraseLayer(analysis);
  const maxPerStep = isSoloPianoStyle(analysis) ? 3 : analysis.mood === 'calm' || analysis.mood === 'sad' ? 1 : 2;
  const maxPerBar =
    isSoloPianoStyle(analysis)
      ? getSoloPianoVariant(analysis) === 'quiet'
        ? 22
        : 36
      : analysis.genre === 'dance' || analysis.mood === 'energetic'
        ? 12
        : analysis.mood === 'calm' || analysis.mood === 'sad'
          ? 7
          : 10;
  const countsByBar = new Map<number, number>();

  return capEventsPerStep(
    polishEvents([...melodyEvents, ...premiumLayer]).filter((event) => {
      const bar = Math.floor(event.start / BAR_LENGTH);
      const count = countsByBar.get(bar) ?? 0;
      if (count >= maxPerBar) return false;
      countsByBar.set(bar, count + 1);
      return true;
    }),
    maxPerStep
  );
}

function diversifyPhraseOpenings(analysis: PromptAnalysis, melodyEvents: MusicEvent[]) {
  const events = polishEvents(melodyEvents);
  const phraseOpeningCounts = new Map<number, number>();

  return events.map((event) => {
    const bar = Math.floor(event.start / BAR_LENGTH);
    const offset = event.start % BAR_LENGTH;
    if (offset > 2 || bar % 4 !== 0) return event;

    const phrase = Math.floor(bar / 4);
    const chord = getChordForBar(analysis, bar);
    const palette = getConstrainedLeadPalette(chord, analysis, null);
    if (!palette.length) return event;

    const currentMidi = noteToMidi(event.note ?? palette[0]);
    const register =
      isSoloPianoStyle(analysis)
        ? getSoloPianoLeadRegisterRange(analysis, bar)
        : getMainMelodyRegisterRange(analysis, bar);
    const rangedPalette = palette.filter((note) => {
      const midi = noteToMidi(note);
      return midi >= register.min && midi <= register.max;
    });
    const usablePalette = rangedPalette.length ? rangedPalette : palette;
    const phraseKey = currentMidi % 12;
    const repeatedCount = phraseOpeningCounts.get(phraseKey) ?? 0;
    phraseOpeningCounts.set(phraseKey, repeatedCount + 1);

    if (repeatedCount < 1 && phrase % 2 === 0) return event;

    const targetIndex = (analysis.promptSeed + analysis.variation * 5 + phrase * 3 + repeatedCount * 2) % usablePalette.length;
    const replacement = chooseConnectedMelodyNote(usablePalette, targetIndex, event.note ?? null);

    return {
      ...event,
      note: replacement,
    };
  });
}

function shapeMelodySectionArc(analysis: PromptAnalysis, melodyEvents: MusicEvent[]) {
  if (analysis.theme === 'christmas') return melodyEvents;

  return polishEvents(melodyEvents).map((event) => {
    const bar = Math.floor(event.start / BAR_LENGTH);
    const offset = event.start % BAR_LENGTH;
    const chord = getChordForBar(analysis, bar);
    const currentMidi = noteToMidi(event.note ?? CHORD_TONES[chord].melody[0]);
    const chordPitchClasses = getSoloPianoChordPitchClasses(chord, true);
    const sectionLift =
      isSoloPianoStyle(analysis)
        ? isBridgeBar(bar)
          ? -5
          : isChorusBar(bar)
            ? getSoloPianoVariant(analysis) === 'quiet'
              ? 2
              : 7
            : bar % 8 >= 6
              ? 3
              : 0
        : isChorusBar(bar)
          ? 5
          : isBridgeBar(bar)
            ? -4
            : 0;
    const microLift = offset >= 12 && bar % 4 === 3 ? -2 : offset >= 8 && isChorusBar(bar) ? 2 : 0;
    const range =
      isSoloPianoStyle(analysis)
        ? getSoloPianoLeadRegisterRange(analysis, bar)
        : getMainMelodyRegisterRange(analysis, bar);
    const shapedMidi = findNearestMidiWithPitchClass(
      currentMidi + sectionLift + microLift,
      chordPitchClasses,
      range.min,
      Math.min(108, range.max)
    );

    return {
      ...event,
      note: midiToMelodyNote(shapedMidi),
    };
  });
}

function breakEmotionalPianoSameness(analysis: PromptAnalysis, melodyEvents: MusicEvent[]) {
  if (!isSoloPianoStyle(analysis)) {
    return melodyEvents;
  }

  let previousMidi: number | null = null;
  let sameZoneCount = 0;

  return polishEvents(melodyEvents).map((event) => {
    const bar = Math.floor(event.start / BAR_LENGTH);
    const offset = event.start % BAR_LENGTH;
    const chord = getChordForBar(analysis, bar);
    const pitchClasses = getSoloPianoChordPitchClasses(chord, offset === 0 || offset === 8 || offset >= 12);
    const range = getSoloPianoLeadRegisterRange(analysis, bar);
    const currentMidi = noteToMidi(event.note ?? CHORD_TONES[chord].melody[0]);
    const zone = Math.floor(currentMidi / 6);

    if (previousMidi !== null && Math.floor(previousMidi / 6) === zone) {
      sameZoneCount += 1;
    } else {
      sameZoneCount = 0;
    }

    let targetMidi = currentMidi;
    if (previousMidi !== null && (sameZoneCount >= 2 || Math.abs(currentMidi - previousMidi) <= 2)) {
      const phraseDirection = (Math.floor(bar / 4) + analysis.variation) % 2 === 0 ? 1 : -1;
      const jump =
        isChorusBar(bar)
          ? phraseDirection > 0 ? 12 : -7
          : bar % 4 >= 2
            ? phraseDirection > 0 ? 7 : -5
            : phraseDirection > 0 ? 5 : -4;
      targetMidi = findNearestMidiWithPitchClass(
        previousMidi + jump,
        pitchClasses,
        Math.max(48, range.min - 12),
        Math.min(108, range.max + 12)
      );
      sameZoneCount = 0;
    }

    previousMidi = targetMidi;
    return {
      ...event,
      note: midiToMelodyNote(targetMidi),
    };
  });
}

function cleanSoloPianoMelodyVoicing(analysis: PromptAnalysis, melodyEvents: MusicEvent[]) {
  if (!isSoloPianoStyle(analysis) || getSoloPianoVariant(analysis) === 'canon') {
    return melodyEvents;
  }

  const groupedByStart = new Map<number, MusicEvent[]>();
  polishEvents(melodyEvents).forEach((event) => {
    const start = Math.max(0, Math.min(TOTAL_STEPS - 1, event.start));
    groupedByStart.set(start, [...(groupedByStart.get(start) ?? []), { ...event, start }]);
  });

  const cleaned: MusicEvent[] = [];
  groupedByStart.forEach((events, start) => {
    const bar = Math.floor(start / BAR_LENGTH);
    const chord = getChordForBar(analysis, bar);
    const offset = start % BAR_LENGTH;
    const includePassing = offset !== 0 && offset !== 8;
    const pitchClasses = getSoloPianoChordPitchClasses(chord, includePassing);
    const normalized = events
      .map((event) => {
        const originalMidi = noteToMidi(event.note ?? CHORD_TONES[chord].melody[0]);
        const isLeftHand = originalMidi < 56;
        const minMidi = isLeftHand ? 36 : 57;
        const maxMidi =
          getSoloPianoVariant(analysis) === 'bright'
            ? isLeftHand ? 57 : 100
            : getSoloPianoVariant(analysis) === 'sad' || getSoloPianoVariant(analysis) === 'quiet'
              ? isLeftHand ? 55 : 88
              : isLeftHand ? 57 : 96;
        const snappedMidi = findNearestMidiWithPitchClass(originalMidi, pitchClasses, minMidi, maxMidi);
        return {
          ...event,
          note: midiToMelodyNote(snappedMidi),
          duration: Math.max(1, Math.min(event.duration ?? 1, isLeftHand ? 4 : 3, BAR_LENGTH - offset)),
        };
      })
      .sort((a, b) => noteToMidi(a.note ?? 'C4') - noteToMidi(b.note ?? 'C4'));

    const selected: MusicEvent[] = [];
    let hasLow = false;
    normalized.forEach((event) => {
      const midi = noteToMidi(event.note ?? 'C4');
      const isLow = midi < 56;
      const maxStack = isLow ? 1 : 2;
      const currentLowCount = selected.filter((item) => noteToMidi(item.note ?? 'C4') < 56).length;
      const currentHighCount = selected.length - currentLowCount;
      if (isLow && currentLowCount >= maxStack) return;
      if (!isLow && currentHighCount >= maxStack) return;
      if (!isLow && selected.some((item) => Math.abs(noteToMidi(item.note ?? 'C4') - midi) <= 2)) return;
      if (isLow && hasLow) return;
      selected.push(event);
      if (isLow) hasLow = true;
    });

    selected.slice(0, 3).forEach((event) => cleaned.push(event));
  });

  return polishEvents(cleaned);
}

function addSoloPianoMelodicMotion(analysis: PromptAnalysis, melodyEvents: MusicEvent[]) {
  if (!isSoloPianoStyle(analysis) || getSoloPianoVariant(analysis) === 'canon') {
    return melodyEvents;
  }

  const events = [...polishEvents(melodyEvents)];
  const occupied = new Set(events.map((event) => `${event.start}:${event.note}`));

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const highNotes = events
      .filter((event) => Math.floor(event.start / BAR_LENGTH) === bar && noteToMidi(event.note ?? 'C4') >= 57)
      .sort((a, b) => a.start - b.start);
    if (highNotes.length >= 5) continue;

    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const range = getSoloPianoLeadRegisterRange(analysis, bar);
    const base = bar * BAR_LENGTH;
    const phraseDirection = (Math.floor(bar / 4) + analysis.variation + (analysis.promptSeed % 3)) % 2 === 0 ? 1 : -1;
    const contourOffsets = getSoloPianoVariant(analysis) === 'quiet' || getSoloPianoVariant(analysis) === 'calm'
      ? [4, 10, 14]
      : [2, 5, 8, 11, 14];
    const anchorSource = highNotes.at(-1)?.note ?? CHORD_TONES[chord].melody[(bar + analysis.variation) % CHORD_TONES[chord].melody.length];
    const anchorMidi = noteToMidi(anchorSource);

    contourOffsets.forEach((offset, index) => {
      const activeChord = offset >= 12 ? nextChord : chord;
      const pitchClasses = getSoloPianoChordPitchClasses(activeChord, offset !== 0 && offset !== 8);
      const wave = phraseDirection * ([0, 4, 7, 5, 9][index] ?? 4);
      const target = anchorMidi + wave + (isChorusBar(bar) ? 5 : 0) + (isBridgeBar(bar) ? -5 : 0);
      const midi = findNearestMidiWithPitchClass(
        target,
        pitchClasses,
        Math.max(57, range.min),
        Math.min(100, range.max)
      );
      const note = midiToMelodyNote(midi);
      const start = base + offset;
      const key = `${start}:${note}`;
      const notesAtStart = events.filter((event) => event.start === start);
      const highAtStart = notesAtStart.filter((event) => noteToMidi(event.note ?? 'C4') >= 57).length;
      if (occupied.has(key) || highAtStart >= 2) return;
      events.push({ note, start, duration: index % 2 === 0 ? 2 : 1 });
      occupied.add(key);
    });
  }

  return cleanSoloPianoMelodyVoicing(analysis, events);
}

function addProfessionalSectionHooks(analysis: PromptAnalysis, melodyEvents: MusicEvent[]) {
  if (isSoloPianoStyle(analysis)) return melodyEvents;

  const events = [...polishEvents(melodyEvents)];
  const occupied = new Set(events.map((event) => `${event.start}:${event.note}`));
  [7, 15, 23, 31, 35, 39].forEach((bar, hookIndex) => {
    if (bar >= BAR_COUNT) return;
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const palette = getConstrainedLeadPalette(chord, analysis, null);
    const nextPalette = getConstrainedLeadPalette(nextChord, analysis, null);
    const hookNotes = [
      palette[(analysis.variation + hookIndex + 1) % Math.max(1, palette.length)],
      palette[(analysis.variation + hookIndex + 3) % Math.max(1, palette.length)],
      nextPalette[(analysis.variation + hookIndex + 2) % Math.max(1, nextPalette.length)],
    ].filter(Boolean);
    [10, 12, 14].forEach((offset, index) => {
      const note = hookNotes[index] ?? hookNotes[0];
      if (!note) return;
      const start = base + offset;
      const key = `${start}:${note}`;
      if (occupied.has(key)) return;
      events.push({ note, start, duration: index === 2 ? 2 : 1 });
      occupied.add(key);
    });
  });

  return polishEvents(events);
}

function createPremiumBassGlue(analysis: PromptAnalysis) {
  const events: MusicEvent[] = [];
  if (!analysis.instruments.bass || isSoloPianoStyle(analysis) || analysis.mood === 'calm') return events;

  for (let bar = 0; bar < BAR_COUNT; bar += 1) {
    const chord = getChordForBar(analysis, bar);
    const nextChord = getChordForBar(analysis, bar + 1);
    const base = bar * BAR_LENGTH;
    const root = CHORD_TONES[chord].bass;
    const nextRoot = CHORD_TONES[nextChord].bass;
    const energy = getBarEnergy(analysis, bar);
    const isActiveSection = bar >= 4 && (isChorusBar(bar) || energy > 0.62 || bar % 4 === 3);

    addNote(events, root, base, analysis.genre === 'citypop' ? 3 : 4, isValidBassNote);
    if (isActiveSection) {
      addNote(events, root, base + 8, analysis.genre === 'citypop' ? 2 : 3, isValidBassNote);
      if (bar % 2 === 1 || isTurnaroundBar(bar)) {
        addNote(events, nextRoot, base + 12, 2, isValidBassNote);
      }
    }
  }

  return harmonizeBassEventsToProgression(events, analysis);
}

function createPremiumPianoTexture(analysis: PromptAnalysis) {
  if (isSoloPianoStyle(analysis)) return null;
  if (!analysis.instruments.supportingPiano && !isSoloPianoStyle(analysis)) return null;
  const isCanonicalPiano = isSoloPianoStyle(analysis) && getSoloPianoVariant(analysis) === 'canon';

  const events =
    analysis.genre === 'citypop' || analysis.theme === 'summerNight' || analysis.theme === 'night' || analysis.mood === 'dreamy'
        ? createPianoCompBed(analysis, SUPPORTING_PIANO_NOTES)
        : createChordBed(analysis, SUPPORTING_PIANO_NOTES, analysis.mood === 'calm' || analysis.mood === 'sad' ? 10 : 8);

  return createExtraTrack(
    'supportingPiano',
    'AI Premium Piano',
    isSoloPianoStyle(analysis) ? 88 : analysis.mood === 'calm' || analysis.mood === 'sad' ? 72 : 76,
    isCanonicalPiano ? polishEvents(events) : harmonizeSupportingPianoToProgression(events, analysis)
  );
}

function elevateArrangementQuality(
  analysis: PromptAnalysis,
  tracks: SongProject['tracks'],
  extraTracks: SerializedExtraInstrumentTrack[]
) {
  const isCanonicalPiano = isSoloPianoStyle(analysis) && getSoloPianoVariant(analysis) === 'canon';
  const isGeneratedSoloPiano = isSoloPianoStyle(analysis);
  const elevatedMelody = isGeneratedSoloPiano || isCanonicalPiano
    ? tracks.melody
    : breakEmotionalPianoSameness(
      analysis,
      shapeMelodySectionArc(
        analysis,
        breakEmotionalPianoSameness(
          analysis,
          diversifyPhraseOpenings(analysis, blendPremiumMelody(analysis, tracks.melody))
        )
      )
    );
  const premiumBassGlue = createPremiumBassGlue(analysis);
  const elevatedTracks: SongProject['tracks'] = {
    ...tracks,
    melody: elevatedMelody,
    bass: premiumBassGlue.length > 0
      ? harmonizeBassEventsToProgression(mergeTrackEvents(tracks.bass, premiumBassGlue, 2), analysis)
      : tracks.bass,
  };
  let elevatedExtraTracks = [...extraTracks];
  const premiumPiano = createPremiumPianoTexture(analysis);

  if (premiumPiano) {
    const pianoIndex = elevatedExtraTracks.findIndex((track) => track.instrument === 'supportingPiano');
    if (pianoIndex === -1) {
      elevatedExtraTracks.push(premiumPiano);
    } else {
      elevatedExtraTracks[pianoIndex] = {
        ...elevatedExtraTracks[pianoIndex],
        volume: Math.max(elevatedExtraTracks[pianoIndex].volume ?? 0, premiumPiano.volume ?? 0),
        events: mergeTrackEvents(
          elevatedExtraTracks[pianoIndex].events,
          premiumPiano.events,
          isSoloPianoStyle(analysis) ? 4 : 3
        ),
      };
    }
  }

  if (analysis.genre === 'citypop' || analysis.genre === 'jazz' || analysis.theme === 'summerNight') {
    const saxIndex = elevatedExtraTracks.findIndex((track) => track.instrument === 'studioAltoSax');
    const saxTrack = createExtraTrack(
      'studioAltoSax',
      'AI Premium Sax Answer',
      62,
      harmonizeEventsToProgression(
        createStudioAltoSaxAnswerLine(analysis, createRandom(createSeed(`${analysis.styleId}:premium-sax:${analysis.variation}`))),
        analysis,
        STUDIO_ALTO_SAX_NOTES,
        getExtraTrackHarmonyOptions('studioAltoSax', analysis)
      )
    );
    if (saxTrack.events.length > 0) {
      if (saxIndex === -1) elevatedExtraTracks.push(saxTrack);
      else {
        elevatedExtraTracks[saxIndex] = {
          ...elevatedExtraTracks[saxIndex],
          events: mergeTrackEvents(elevatedExtraTracks[saxIndex].events, saxTrack.events, 1),
        };
      }
    }
  }

  return {
    tracks: elevatedTracks,
    extraTracks: elevatedExtraTracks,
  };
}

function polishGeneratedArrangement(
  analysis: PromptAnalysis,
  tracks: SongProject['tracks'],
  extraTracks: SerializedExtraInstrumentTrack[]
) {
  const isCanonicalPiano = isSoloPianoStyle(analysis) && getSoloPianoVariant(analysis) === 'canon';
  const isGeneratedSoloPiano = isSoloPianoStyle(analysis) && !isCanonicalPiano;
  const polishedTracks: SongProject['tracks'] = {
    ...tracks,
    melody: isCanonicalPiano
      ? polishEvents(tracks.melody)
      : isGeneratedSoloPiano
        ? polishEvents(tracks.melody)
      : addProfessionalSectionHooks(
          analysis,
          addSoloPianoMelodicMotion(
            analysis,
            cleanSoloPianoMelodyVoicing(
              analysis,
              finalizeLeadMelody(developMelodyWithMotifs(enrichLeadMelodyPhrases(tracks.melody, analysis), analysis), analysis)
            )
          )
        ),
    bass: harmonizeBassEventsToProgression(tracks.bass, analysis),
    guitar: harmonizeEventsToProgression(tracks.guitar, analysis, GUITAR_TRACK_LABELS, {
      maxPerStep: analysis.genre === 'rock' ? 4 : 3,
      maxPerBar: analysis.genre === 'rock' || analysis.genre === 'citypop' ? 12 : 8,
      includePassing: false,
      maxDuration: analysis.genre === 'rock' ? 4 : 3,
    }),
    violin: harmonizeEventsToProgression(tracks.violin, analysis, VIOLIN_NOTES, {
      maxPerStep: 1,
      maxPerBar: analysis.mood === 'sad' || analysis.mood === 'dreamy' ? 4 : 3,
      includePassing: false,
      maxDuration: 3,
    }),
    saxophone: harmonizeEventsToProgression(tracks.saxophone, analysis, SAXOPHONE_NOTES, {
      maxPerStep: 1,
      maxPerBar: analysis.genre === 'jazz' || analysis.genre === 'citypop' ? 4 : 2,
      includePassing: false,
      maxDuration: 2,
    }),
    drums: polishEvents(tracks.drums),
  };
  let polishedExtraTracks = extraTracks
    .map((track) => {
      const extraInstrument = track.instrument as ExtraInstrumentKey;
      const allowedNotes = getExtraTrackAllowedNotes(extraInstrument);
      const harmonyOptions = getExtraTrackHarmonyOptions(extraInstrument, analysis);
      return {
        ...track,
        events: isCanonicalPiano && track.instrument === 'supportingPiano'
          ? polishEvents(track.events ?? [])
          : track.instrument === 'supportingPiano'
          ? harmonizeSupportingPianoToProgression(track.events ?? [], analysis)
          : harmonizeEventsToProgression(track.events ?? [], analysis, allowedNotes, harmonyOptions),
      };
    })
    .filter((track) => (track.events?.length ?? 0) > 0);

  if (isSoloPianoStyle(analysis)) {
    polishedTracks.drums = [];
    polishedTracks.bass = [];
    polishedTracks.guitar = [];
    polishedTracks.violin = [];
    polishedTracks.saxophone = [];
    polishedExtraTracks = [];
  }

  if (analysis.theme === 'christmas') {
    polishedTracks.violin = [];
    polishedTracks.saxophone = [];
    polishedTracks.guitar = [];
    polishedTracks.bass = simplifyEvents(polishedTracks.bass, 2);
    polishedExtraTracks = polishedExtraTracks.filter((track) => track.instrument === 'supportingPiano' || track.instrument === 'glockenspiel');
  }

  if (analysis.mood === 'calm' || analysis.theme === 'calm' || analysis.theme === 'rainyNight') {
    polishedTracks.drums = simplifyEvents(polishedTracks.drums, 8);
    polishedTracks.bass = simplifyEvents(polishedTracks.bass, 3);
    polishedTracks.guitar = keepEveryNthBar(polishedTracks.guitar, 2);
    polishedTracks.saxophone = [];
    polishedExtraTracks = polishedExtraTracks.filter((track) => track.instrument !== 'chicagoStreet' && track.instrument !== 'piccolo');
  }

  if (analysis.styleId === 'calmSong') {
    polishedTracks.drums = [];
    polishedTracks.bass = [];
    polishedTracks.guitar = [];
    polishedTracks.violin = [];
    polishedTracks.saxophone = [];
    polishedExtraTracks = polishedExtraTracks.filter((track) => track.instrument === 'supportingPiano');
  }

  if (analysis.styleId === 'mysticFeeling' || analysis.styleId === 'dreamyFeeling') {
    polishedTracks.drums = [];
    polishedTracks.guitar = [];
    polishedTracks.saxophone = [];
    polishedTracks.bass = analysis.styleId === 'dreamyFeeling' ? simplifyEvents(polishedTracks.bass, 2) : [];
    polishedTracks.violin = simplifyEvents(polishedTracks.violin, 3);
    polishedExtraTracks = polishedExtraTracks.filter((track) => track.instrument === 'supportingPiano');
  }

  if (analysis.mood === 'sad' && analysis.theme !== 'christmas') {
    polishedTracks.drums = [];
    polishedTracks.guitar = analysis.genre === 'rock' ? polishedTracks.guitar : [];
    polishedTracks.saxophone = [];
    polishedTracks.bass = simplifyEvents(polishedTracks.bass, 3);
    polishedExtraTracks = polishedExtraTracks.filter((track) =>
      track.instrument === 'supportingPiano'
    );
  }

  if (analysis.genre === 'citypop' || analysis.theme === 'summerNight' || analysis.theme === 'night') {
    polishedTracks.violin = [];
    polishedTracks.guitar = simplifyEvents(polishedTracks.guitar, 12);
    polishedTracks.bass = simplifyEvents(polishedTracks.bass, 5);
    polishedExtraTracks = polishedExtraTracks.filter((track) =>
      track.instrument === 'supportingPiano' ||
      track.instrument === 'studioAltoSax' ||
      track.instrument === 'glockenspiel'
    );
  }

  if (analysis.genre === 'jazz') {
    polishedTracks.violin = [];
    polishedTracks.guitar = simplifyEvents(polishedTracks.guitar, 10);
    polishedTracks.saxophone = simplifyEvents(polishedTracks.saxophone, 4);
    polishedExtraTracks = polishedExtraTracks.filter((track) =>
      track.instrument === 'supportingPiano' ||
      track.instrument === 'studioAltoSax'
    );
  }

  if (analysis.genre === 'dance' || analysis.theme === 'kpopDance' || analysis.theme === 'gameBgm') {
    polishedTracks.violin = [];
    polishedTracks.saxophone = [];
    polishedTracks.guitar = analysis.genre === 'rock' ? polishedTracks.guitar : [];
    polishedExtraTracks = polishedExtraTracks.filter((track) =>
      track.instrument === 'supportingPiano' ||
      track.instrument === 'glockenspiel' ||
      track.instrument === 'chicagoStreet' ||
      track.instrument === 'piccolo'
    );
  }

  if (analysis.genre === 'rock') {
    polishedExtraTracks = polishedExtraTracks.filter((track) => track.instrument !== 'piccolo' && track.instrument !== 'studioAltoSax');
  }

  if (analysis.theme === 'cinematic') {
    polishedTracks.guitar = [];
    polishedTracks.saxophone = [];
    polishedTracks.drums = analysis.mood === 'energetic' ? polishedTracks.drums : [];
    polishedExtraTracks = polishedExtraTracks.filter((track) => track.instrument === 'supportingPiano' || track.instrument === 'glockenspiel');
  }

  const premiumArrangement = elevateArrangementQuality(analysis, polishedTracks, polishedExtraTracks);
  const qualityArrangement = ensurePromptQualityFloor(analysis, premiumArrangement.tracks, premiumArrangement.extraTracks);
  const gluedArrangement = polishLeadSupportAgainstMelody(analysis, qualityArrangement.tracks, qualityArrangement.extraTracks);

  return {
    tracks: gluedArrangement.tracks,
    extraTracks: gluedArrangement.extraTracks
      .filter((track) => (track.events?.length ?? 0) > 0)
      .slice(0, analysis.mood === 'calm' ? 3 : 5),
  };
}

function createSongProject(prompt: string): SongProject {
  const analysis = createRuntimeArrangementDiversity(createRuntimeSoloPianoAnalysis(parsePrompt(prompt), prompt), prompt);
  const intentText = createPromptIntentTextReadable(prompt) || createPromptIntentText(prompt);
  const random = createRandom(
    createSeed(
      `${intentText || prompt}:${analysis.genre}:${analysis.mood}:${analysis.theme}:${analysis.variation}:${analysis.progression.join('-')}:${Date.now()}:${Math.random()}`
    )
  );

  const rawMelody = createMelody(analysis, random);
  const melody = isSoloPianoStyle(analysis) ? polishEvents(rawMelody) : finalizeLeadMelody(rawMelody, analysis);
  const bass = analysis.instruments.bass ? finalizeMelodicEvents(createBass(analysis, random), 2) : [];
  const guitar = analysis.instruments.guitar ? finalizeMelodicEvents(createGuitar(analysis, random), 4) : [];
  const violin = analysis.instruments.violin ? finalizeMelodicEvents(createViolin(analysis, random), 2) : [];
  const saxophone = analysis.instruments.saxophone ? finalizeMelodicEvents(createSaxophone(analysis, random), 2) : [];
  const drums = analysis.instruments.drums ? polishEvents(createDrums(analysis, random)) : [];
  const extraTracks = createExtraTracks(analysis, random);
  const arranged = limitAutoArrangement(
    analysis,
    {
      melody,
      violin,
      saxophone,
      guitar,
      drums,
      bass,
    },
    extraTracks
  );
  const polished = polishGeneratedArrangement(analysis, arranged.tracks, arranged.extraTracks);

  return {
    version: 2,
    steps: TOTAL_STEPS,
    bpm: analysis.bpm,
    volumes: {
      melody: isSoloPianoStyle(analysis) ? 68 : 88,
      drums: polished.tracks.drums.length > 0 ? (analysis.theme === 'christmas' ? 42 : analysis.genre === 'ballad' || analysis.mood === 'calm' ? 62 : 80) : 0,
      bass: polished.tracks.bass.length > 0 ? (analysis.theme === 'christmas' ? 54 : analysis.mood === 'calm' || analysis.mood === 'dreamy' ? 56 : analysis.genre === 'citypop' ? 68 : 78) : 0,
      guitar: polished.tracks.guitar.length > 0 ? (analysis.genre === 'rock' || analysis.genre === 'citypop' ? 74 : 58) : 0,
      violin: polished.tracks.violin.length > 0 ? 54 : 0,
      saxophone: polished.tracks.saxophone.length > 0 ? 56 : 0,
      glockenspiel: polished.extraTracks.some((track) => track.instrument === 'glockenspiel') ? (analysis.theme === 'christmas' ? 70 : 58) : 0,
      piccolo: polished.extraTracks.some((track) => track.instrument === 'piccolo') ? 46 : 0,
      supportingPiano: polished.extraTracks.some((track) => track.instrument === 'supportingPiano') ? (isSoloPianoStyle(analysis) ? 90 : analysis.genre === 'citypop' || analysis.theme === 'summerNight' || analysis.mood === 'dreamy' ? 54 : 66) : 0,
      chicagoStreet: polished.extraTracks.some((track) => track.instrument === 'chicagoStreet') ? 56 : 0,
      studioAltoSax: polished.extraTracks.some((track) => track.instrument === 'studioAltoSax') ? 58 : 0,
    },
    tracks: {
      ...polished.tracks,
    },
    extraTracks: polished.extraTracks,
  };
}

function getTrackDensity(events: MusicEvent[] | undefined) {
  return events?.length ?? 0;
}

function mergeTrackEvents(currentEvents: MusicEvent[] | undefined, generatedEvents: MusicEvent[], maxPerStep: number) {
  const current = polishEvents(currentEvents ?? []);
  const occupied = new Set(current.map((event) => `${event.note ?? event.type}-${event.start}`));
  const merged = [...current];

  generatedEvents.forEach((event) => {
    const key = `${event.note ?? event.type}-${event.start}`;
    const bar = Math.floor(event.start / BAR_LENGTH);
    const hasEnoughCurrentMaterial = current.some((currentEvent) => Math.floor(currentEvent.start / BAR_LENGTH) === bar);

    if (occupied.has(key)) return;
    if (hasEnoughCurrentMaterial && bar % 4 !== 3 && getTrackDensity(current) > 24) return;

    occupied.add(key);
    merged.push(event);
  });

  return capEventsPerStep(polishEvents(merged), maxPerStep);
}

export async function fetchAiMusic(prompt: string) {
  try {
    return createSongProject(prompt);
  } catch (error) {
    console.warn('AI music generation failed. Retrying with a safe prompt.', error);
    try {
      const safePrompt = /여름\s*밤|여름밤|summer\s*night/i.test(prompt)
        ? '청량한 여름밤 시티팝'
        : '잔잔한 피아노';
      return createSongProject(safePrompt);
    } catch (fallbackError) {
      console.warn('AI music fallback generation failed. Returning default project.', fallbackError);
      return createSongProject('기본 작곡');
    }
  }
}
