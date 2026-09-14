import * as Tone from "tone";
import {
  CHICAGO_STREET_NOTES,
  CHICAGO_STREET_SAMPLE_NOTES,
  GLOCKENSPIEL_NOTES,
  GLOCKENSPIEL_SAMPLE_NOTES,
  PICCOLO_SAMPLE_NOTES,
  STUDIO_ALTO_SAX_NOTES,
  STUDIO_ALTO_SAX_SAMPLE_NOTES,
  SUPPORTING_PIANO_NOTES,
} from "../constants/composer.ts";

function createReverb(options: ConstructorParameters<typeof Tone.Reverb>[0]) {
  return new Tone.Reverb(options).toDestination();
}

function lazySampler(factory: () => Tone.Sampler): Tone.Sampler {
  let sampler: Tone.Sampler | null = null;

  const getSampler = () => {
    sampler ??= factory();
    return sampler;
  };

  return new Proxy({} as Tone.Sampler, {
    get(_target, property, receiver) {
      const value = Reflect.get(getSampler(), property, receiver);
      return typeof value === "function" ? value.bind(getSampler()) : value;
    },
    set(_target, property, value, receiver) {
      return Reflect.set(getSampler(), property, value, receiver);
    },
  });
}

function lazyPlayers(factory: () => Tone.Players): Tone.Players {
  let players: Tone.Players | null = null;

  const getPlayers = () => {
    players ??= factory();
    return players;
  };

  return new Proxy({} as Tone.Players, {
    get(_target, property, receiver) {
      const value = Reflect.get(getPlayers(), property, receiver);
      return typeof value === "function" ? value.bind(getPlayers()) : value;
    },
    set(_target, property, value, receiver) {
      return Reflect.set(getPlayers(), property, value, receiver);
    },
  });
}

const SHARP_TO_FLAT_NOTE: Record<string, string> = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
};

function withFlatAliases<T extends Record<string, string>>(urls: T): Record<string, string> {
  const aliasedUrls: Record<string, string> = { ...urls };

  Object.entries(urls).forEach(([note, file]) => {
    const flatNote = note.replace(/^([A-G]#)(-?\d+)$/, (_match, root: string, octave: string) => {
      return `${SHARP_TO_FLAT_NOTE[root] ?? root}${octave}`;
    });

    aliasedUrls[flatNote] = file;
  });

  return aliasedUrls;
}

function normalizeNoteName(note: string) {
  return note.replace('_sharp', '#');
}

function noteToFileName(note: string) {
  return `${note.replace('#', '_sharp')}.mp3`;
}

function buildSampleUrls(notes: readonly string[]) {
  return withFlatAliases(
    Object.fromEntries(notes.map((note) => [normalizeNoteName(note), noteToFileName(note)]))
  );
}

function buildTransposedSampleUrls(displayNotes: readonly string[], sampleNotes: readonly string[]) {
  void displayNotes;
  return buildSampleUrls(sampleNotes);
}

export const pianoSynth = lazySampler(() => new Tone.Sampler({
  urls: withFlatAliases({
    "A#4": "A_sharp4.mp3",
    A4: "A4.mp3",
    B4: "B4.mp3",
    "C#4": "C_sharp4.mp3",
    C4: "C4.mp3",
    C5: "C5.mp3",
    "D#4": "D_sharp4.mp3",
    D4: "D4.mp3",
    E4: "E4.mp3",
    "F#4": "F_sharp4.mp3",
    F4: "F4.mp3",
    "G#4": "G_sharp4.mp3",
    G4: "G4.mp3",
  }),
  release: 0.42,
  baseUrl: "/samples/piano/",
}).connect(createReverb({
  decay: 1.25,
  preDelay: 0.008,
  wet: 0.1,
})));

export const GUITAR_SAMPLE_URLS = withFlatAliases({
  A3: "A3.mp3",
  "A#3": "A_sharp3.mp3",
  B3: "B3.mp3",
  C3: "C3.mp3",
  "C#3": "C_sharp3.mp3",
  D3: "D3.mp3",
  "D#3": "D_sharp3.mp3",
  E3: "E3.mp3",
  F3: "F3.mp3",
  "F#3": "F_sharp3.mp3",
  G3: "G3.mp3",
  "G#3": "G_sharp3.mp3",
  A4: "A4.mp3",
  "A#4": "A_sharp4.mp3",
  B4: "B4.mp3",
  C4: "C4.mp3",
  "C#4": "C_sharp4.mp3",
  D4: "D4.mp3",
  "D#4": "D_sharp4.mp3",
  E4: "E4.mp3",
  F4: "F4.mp3",
  "F#4": "F_sharp4.mp3",
  G4: "G4.mp3",
  "G#4": "G_sharp4.mp3",
  A5: "A5.mp3",
  "A#5": "A_sharp5.mp3",
  B5: "B5.mp3",
  C5: "C5.mp3",
  "C#5": "C_sharp5.mp3",
  D5: "D5.mp3",
  "D#5": "D_sharp5.mp3",
  E5: "E5.mp3",
  F5: "F5.mp3",
  "F#5": "F_sharp5.mp3",
  G5: "G5.mp3",
  "G#5": "G_sharp5.mp3",
  C6: "C6.mp3",
} as const);

export const acousticGuitarSynth = lazySampler(() => new Tone.Sampler({
  urls: GUITAR_SAMPLE_URLS,
  release: 1.2,
  baseUrl: "/samples/guitar/",
}).connect(createReverb({
  decay: 1.8,
  preDelay: 0.01,
  wet: 0.18,
})));

export const VIOLIN_SAMPLE_URLS = withFlatAliases({
  C3: "C3.mp3",
  "C#3": "C_sharp3.mp3",
  D3: "D3.mp3",
  "D#3": "D_sharp3.mp3",
  E3: "E3.mp3",
  F3: "F3.mp3",
  "F#3": "F_sharp3.mp3",
  G3: "G3.mp3",
  "G#3": "G_sharp3.mp3",
  A3: "A3.mp3",
  "A#3": "A_sharp3.mp3",
  B3: "B3.mp3",
  C4: "C4.mp3",
  "C#4": "C_sharp4.mp3",
  D4: "D4.mp3",
  "D#4": "D_sharp4.mp3",
  E4: "E4.mp3",
  F4: "F4.mp3",
  "F#4": "F_sharp4.mp3",
  G4: "G4.mp3",
  "G#4": "G_sharp4.mp3",
  A4: "A4.mp3",
  "A#4": "A_sharp4.mp3",
  B4: "B4.mp3",
} as const);

export const SAXOPHONE_SAMPLE_URLS = withFlatAliases({
  C2: "C2.mp3",
  "C#2": "C_sharp2.mp3",
  D2: "D2.mp3",
  "D#2": "D_sharp2.mp3",
  E2: "E2.mp3",
  F2: "F2.mp3",
  "F#2": "F_sharp2.mp3",
  G2: "G2.mp3",
  "G#2": "G_sharp2.mp3",
  A2: "A2.mp3",
  "A#2": "A_sharp2.mp3",
  B2: "B2.mp3",
  C3: "C3.mp3",
  "C#3": "C_sharp3.mp3",
  D3: "D3.mp3",
  "D#3": "D_sharp3.mp3",
  E3: "E3.mp3",
  F3: "F3.mp3",
  "F#3": "F_sharp3.mp3",
  G3: "G3.mp3",
  "G#3": "G_sharp3.mp3",
  A3: "A3.mp3",
  "A#3": "A_sharp3.mp3",
  B3: "B3.mp3",
  C4: "C4.mp3",
  "C#4": "C_sharp4.mp3",
  D4: "D4.mp3",
  "D#4": "D_sharp4.mp3",
  E4: "E4.mp3",
  F4: "F4.mp3",
  "F#4": "F_sharp4.mp3",
  G4: "G4.mp3",
  "G#4": "G_sharp4.mp3",
  A4: "A4.mp3",
  "A#4": "A_sharp4.mp3",
  B4: "B4.mp3",
} as const);

export const violinSynth = lazySampler(() => new Tone.Sampler({
  urls: VIOLIN_SAMPLE_URLS,
  attack: 0.018,
  release: 0.58,
  baseUrl: "/samples/violin/",
}).connect(createReverb({
  decay: 1.65,
  preDelay: 0.012,
  wet: 0.16,
})));

export const saxophoneSynth = lazySampler(() => new Tone.Sampler({
  urls: SAXOPHONE_SAMPLE_URLS,
  attack: 0.008,
  release: 0.28,
  baseUrl: "/samples/sax/",
}).connect(createReverb({
  decay: 1.15,
  preDelay: 0.008,
  wet: 0.11,
})));

export const GLOCKENSPIEL_SAMPLE_URLS = buildTransposedSampleUrls(
  GLOCKENSPIEL_NOTES,
  GLOCKENSPIEL_SAMPLE_NOTES
);
export const PICCOLO_SAMPLE_URLS = buildSampleUrls(PICCOLO_SAMPLE_NOTES);
export const SUPPORTING_PIANO_SAMPLE_URLS = buildSampleUrls(SUPPORTING_PIANO_NOTES);
export const CHICAGO_STREET_SAMPLE_URLS = buildTransposedSampleUrls(
  CHICAGO_STREET_NOTES,
  CHICAGO_STREET_SAMPLE_NOTES
);
export const STUDIO_ALTO_SAX_SAMPLE_URLS = buildTransposedSampleUrls(
  STUDIO_ALTO_SAX_NOTES,
  STUDIO_ALTO_SAX_SAMPLE_NOTES
);

export const glockenspielSynth = lazySampler(() => new Tone.Sampler({
  urls: GLOCKENSPIEL_SAMPLE_URLS,
  release: 1.1,
  baseUrl: "/samples/glockenspiel/",
}).connect(createReverb({
  decay: 1.45,
  preDelay: 0.01,
  wet: 0.2,
})));

export const piccoloSynth = lazySampler(() => new Tone.Sampler({
  urls: PICCOLO_SAMPLE_URLS,
  attack: 0.006,
  release: 0.34,
  baseUrl: "/samples/piccolo/",
}).connect(createReverb({
  decay: 1.25,
  preDelay: 0.008,
  wet: 0.13,
})));

export const supportingPianoSynth = lazySampler(() => new Tone.Sampler({
  urls: SUPPORTING_PIANO_SAMPLE_URLS,
  release: 1.1,
  baseUrl: "/samples/supporting_piano/",
}).connect(createReverb({
  decay: 1.9,
  preDelay: 0.01,
  wet: 0.18,
})));

export const chicagoStreetSynth = lazySampler(() => new Tone.Sampler({
  urls: CHICAGO_STREET_SAMPLE_URLS,
  attack: 0.008,
  release: 0.42,
  baseUrl: "/samples/chicago_street/",
}).connect(createReverb({
  decay: 1.35,
  preDelay: 0.01,
  wet: 0.14,
})));

export const studioAltoSaxSynth = lazySampler(() => new Tone.Sampler({
  urls: STUDIO_ALTO_SAX_SAMPLE_URLS,
  attack: 0.008,
  release: 0.3,
  baseUrl: "/samples/studio_alto_sax/",
}).connect(createReverb({
  decay: 1.1,
  preDelay: 0.008,
  wet: 0.12,
})));

export const BASS_SAMPLE_URLS = withFlatAliases({
  C2: "01_C2.mp3",
  "C#2": "02_C_sharp2.mp3",
  D2: "03_D2.mp3",
  "D#2": "04_D_sharp2.mp3",
  E2: "05_E2.mp3",
  F2: "06_F2.mp3",
  "F#2": "07_F_sharp2.mp3",
  G2: "08_G2.mp3",
  "G#2": "09_G_sharp2.mp3",
  A2: "10_A2.mp3",
  "A#2": "11_A_sharp2.mp3",
  B2: "12_B2.mp3",
  C3: "13_C3.mp3",
  "C#3": "14_C_sharp3.mp3",
  D3: "15_D3.mp3",
  "D#3": "16_D_sharp3.mp3",
  E3: "17_E3.mp3",
  F3: "18_F3.mp3",
  "F#3": "19_F_sharp3.mp3",
  G3: "20_G3.mp3",
  "G#3": "21_G_sharp3.mp3",
  A3: "22_A3.mp3",
  "A#3": "23_A_sharp3.mp3",
  B3: "24_B3.mp3",
} as const);

export const DRUM_SAMPLE_URLS = {
  C2: "kick_punch.mp3",
  D2: "snare.mp3",
  E2: "kick_low.mp3",
  "F#2": "hats_tight.mp3",
  "A#2": "hats_loose.mp3",
  C3: "crash.mp3",
} as const;

export const DRUM_SAMPLE_NOTE_BY_ROW = ["C2", "D2", "F#2", "A#2", "E2"] as const;

export function createBassSampler() {
  return new Tone.Sampler({
    urls: BASS_SAMPLE_URLS,
    release: 1,
    baseUrl: "/samples/drum_bass/bass/",
  }).toDestination();
}

export function createDrumSampler() {
  return new Tone.Sampler({
    urls: DRUM_SAMPLE_URLS,
    release: 0.8,
    baseUrl: "/samples/drum_bass/drum/",
  }).toDestination();
}

export const bassSampler = lazySampler(createBassSampler);
export const drumSampler = lazySampler(createDrumSampler);


export const STROKE_SAMPLE_URLS = {
  C_DOWN: "C_Down-.mp3",
  C_UP: "C_Up-.mp3",

  D_DOWN: "D_Down-.mp3",
  D_UP: "D_Up-.mp3",

  E_DOWN: "E_Down-.mp3",
  E_UP: "E_Up-.mp3",

  F_DOWN: "F_Down-.mp3",
  F_UP: "F_Up-.mp3",

  G_DOWN: "G_Down-.mp3",
  G_UP: "G_Up-.mp3",

  A_DOWN: "A_Down-.mp3",
  A_UP: "A_Up-.mp3",

  B_DOWN: "B_Down-.mp3",
  B_UP: "B_Up-.mp3",
} as const;
  
export const strokePlayer = lazyPlayers(() =>
  new Tone.Players({
    urls: STROKE_SAMPLE_URLS,
    baseUrl: "/samples/stroke/",
  }).toDestination()
);


