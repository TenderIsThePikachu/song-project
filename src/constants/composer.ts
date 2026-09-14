export const PIANO_STEP_WIDTH = 132;
export const PIANO_ROW_HEIGHT = 56;
export const MELODY_PIANO_ROW_HEIGHT = 24;
export const DRUM_STEP_WIDTH = 84;

export const MELODY_NOTES = [
  'C8',
  'B7',
  'A#7',
  'A7',
  'G#7',
  'G7',
  'F#7',
  'F7',
  'E7',
  'D#7',
  'D7',
  'C#7',
  'C7',
  'B6',
  'A#6',
  'A6',
  'G#6',
  'G6',
  'F#6',
  'F6',
  'E6',
  'D#6',
  'D6',
  'C#6',
  'C6',
  'B5',
  'A#5',
  'A5',
  'G#5',
  'G5',
  'F#5',
  'F5',
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
  'C3',
  'B2',
  'A#2',
  'A2',
  'G#2',
  'G2',
  'F#2',
  'F2',
  'E2',
  'D#2',
  'D2',
  'C#2',
  'C2',
  'B1',
  'A#1',
  'A1',
  'G#1',
  'G1',
  'F#1',
  'F1',
  'E1',
  'D#1',
  'D1',
  'C#1',
  'C1',
  'B0',
  'A#0',
  'A0',
] as const;

export const LEGACY_MELODY_NOTES = [
  'C6',
  'A5',
  'G5',
  'E5',
  'D5',
  'C5',
  'A4',
  'G4',
  'E4',
  'D4',
  'C4',
  'A3',
] as const;

export const LEGACY_BASS_NOTES = [
  'C5',
  'A4',
  'G4',
  'E4',
  'D4',
  'C4',
  'A3',
  'G3',
  'E3',
  'D3',
  'C3',
  'A2',
] as const;

export const LEGACY_EXTENDED_BASS_NOTES = [
  'C5',
  'B4',
  'A4',
  'G4',
  'F4',
  'E4',
  'D4',
  'C4',
  'B3',
  'A3',
  'G3',
  'F3',
  'E3',
  'D3',
  'C3',
  'B2',
  'A2',
] as const;

export const BASS_NOTES = [
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
  'C3',
  'B2',
  'A#2',
  'A2',
  'G#2',
  'G2',
  'F#2',
  'F2',
  'E2',
  'D#2',
  'D2',
  'C#2',
  'C2',
] as const;

export const VIOLIN_NOTES = [
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
  'C3',
] as const;

export const SAXOPHONE_NOTES = [
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
  'C3',
  'B2',
  'A#2',
  'A2',
  'G#2',
  'G2',
  'F#2',
  'F2',
  'E2',
  'D#2',
  'D2',
  'C#2',
  'C2',
] as const;

const NOTE_ROOT_ORDER: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
};

function noteToMidiValue(note: string) {
  const match = /^([A-G](?:#|_sharp)?)(-?\d+)$/.exec(note);
  if (!match) {
    return -Infinity;
  }

  const root = match[1].replace('_sharp', '#');
  return (Number(match[2]) + 1) * 12 + (NOTE_ROOT_ORDER[root] ?? 0);
}

function sortNotesHighToLow(notes: readonly string[]) {
  return [...notes].sort((left, right) => noteToMidiValue(right) - noteToMidiValue(left));
}

function midiValueToNote(midi: number) {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteNames[((midi % 12) + 12) % 12]}${octave}`;
}

function transposeSampleNotesToStart(
  notes: readonly string[],
  sampleStartNote: string,
  displayStartNote: string
) {
  const offset = noteToMidiValue(displayStartNote) - noteToMidiValue(sampleStartNote);
  return notes.map((note) => midiValueToNote(noteToMidiValue(note) + offset));
}

export const GLOCKENSPIEL_SAMPLE_NOTES = [
  'C1', 'C#1', 'D1', 'D#1', 'E1', 'F1', 'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1',
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
  'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5',
] as const;

export const GLOCKENSPIEL_NOTES = sortNotesHighToLow(
  transposeSampleNotesToStart(GLOCKENSPIEL_SAMPLE_NOTES, 'C1', 'C1')
);

export const PICCOLO_SAMPLE_NOTES = [
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
  'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
] as const;

export const PICCOLO_NOTES = sortNotesHighToLow(
  transposeSampleNotesToStart(PICCOLO_SAMPLE_NOTES, 'C2', 'C2')
);

export const SUPPORTING_PIANO_NOTES = sortNotesHighToLow([
  'C0', 'C#0', 'D0', 'D#0', 'E0', 'F0', 'F#0', 'G0', 'G#0', 'A0', 'A#0', 'B0',
  'C1', 'C#1', 'D1', 'D#1', 'E1', 'F1', 'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1',
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
  'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5',
] as const);

export const CHICAGO_STREET_SAMPLE_NOTES = [
  'C1', 'C#1', 'D1', 'D#1', 'E1', 'F1', 'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1',
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
  'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5',
] as const;

export const CHICAGO_STREET_NOTES = sortNotesHighToLow(
  transposeSampleNotesToStart(CHICAGO_STREET_SAMPLE_NOTES, 'C1', 'C1')
);

export const STUDIO_ALTO_SAX_SAMPLE_NOTES = [
  'C1', 'C#1', 'D1', 'D#1', 'E1', 'F1', 'F#1', 'G1', 'G#1', 'A1', 'A#1', 'B1',
  'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 'G#2', 'A2', 'A#2', 'B2',
  'C3', 'C#3', 'D3', 'D#3', 'E3', 'F3', 'F#3', 'G3', 'G#3', 'A3', 'A#3', 'B3',
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
] as const;

export const STUDIO_ALTO_SAX_NOTES = sortNotesHighToLow(
  transposeSampleNotesToStart(STUDIO_ALTO_SAX_SAMPLE_NOTES, 'C1', 'C#4')
);

export const MELODY_MIDI = [
  108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 97,
  96, 95, 94, 93, 92, 91, 90, 89, 88, 87, 86, 85,
  84, 83, 82, 81, 80, 79, 78, 77, 76, 75, 74, 73,
  72, 71, 70, 69, 68, 67, 66, 65, 64, 63, 62, 61,
  60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 49,
  48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37,
  36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25,
  24, 23, 22, 21,
] as const;

export const BASS_MIDI = [
  59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 49, 48,
  47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36,
] as const;

export const MELODY_ROWS = MELODY_NOTES.length;
export const BASS_ROWS = BASS_NOTES.length;
export const VIOLIN_ROWS = VIOLIN_NOTES.length;
export const SAXOPHONE_ROWS = SAXOPHONE_NOTES.length;
export const GLOCKENSPIEL_ROWS = GLOCKENSPIEL_NOTES.length;
export const PICCOLO_ROWS = PICCOLO_NOTES.length;
export const SUPPORTING_PIANO_ROWS = SUPPORTING_PIANO_NOTES.length;
export const CHICAGO_STREET_ROWS = CHICAGO_STREET_NOTES.length;
export const STUDIO_ALTO_SAX_ROWS = STUDIO_ALTO_SAX_NOTES.length;

export const DRUM_TRACK_LABELS = [
  'Kick',
  'Snare',
  'HiHat',
  'Clap',
  'Percussion',
  // 새로 추가한 드럼들 여기에 계속 추가
] as const;

export const DRUM_ROWS = DRUM_TRACK_LABELS.length;


export const GUITAR_TRACK_LABELS = [
  'C6',
  'G#5',
  'G5',
  'F#5',
  'F5',
  'E5',
  'D#5',
  'D5',
  'C#5',
  'C5',
  'B5',
  'A#5',
  'A5',
  'G#4',
  'G4',
  'F#4',
  'F4',
  'E4',
  'D#4',
  'D4',
  'C#4',
  'C4',
  'B4',
  'A#4',
  'A4',
  'G#3',
  'G3',
  'F#3',
  'F3',
  'E3',
  'D#3',
  'D3',
  'C#3',
  'C3',
  'B3',
  'A#3',
  'A3',
] as const;

export const GUITAR_ROWS = GUITAR_TRACK_LABELS.length;

function createNoteToRowMap(notes: readonly string[]) {
  return notes.reduce<Record<string, number>>((map, note, index) => {
    map[note] = index;
    return map;
  }, {});
}

function mapChordNotesToRows(
  noteToRowMap: Record<string, number>,
  chordMap: Record<string, readonly string[]>
) {
  return Object.fromEntries(
    Object.entries(chordMap).map(([chord, notes]) => [
      chord,
      notes
        .map((note) => noteToRowMap[note])
        .filter((row): row is number => typeof row === 'number'),
    ])
  ) as Record<string, number[]>;
}

export const MELODY_NOTE_TO_ROW = createNoteToRowMap(MELODY_NOTES);
export const BASS_NOTE_TO_ROW = createNoteToRowMap(BASS_NOTES);
export const VIOLIN_NOTE_TO_ROW = createNoteToRowMap(VIOLIN_NOTES);
export const SAXOPHONE_NOTE_TO_ROW = createNoteToRowMap(SAXOPHONE_NOTES);
export const GLOCKENSPIEL_NOTE_TO_ROW = createNoteToRowMap(GLOCKENSPIEL_NOTES);
export const PICCOLO_NOTE_TO_ROW = createNoteToRowMap(PICCOLO_NOTES);
export const SUPPORTING_PIANO_NOTE_TO_ROW = createNoteToRowMap(SUPPORTING_PIANO_NOTES);
export const CHICAGO_STREET_NOTE_TO_ROW = createNoteToRowMap(CHICAGO_STREET_NOTES);
export const STUDIO_ALTO_SAX_NOTE_TO_ROW = createNoteToRowMap(STUDIO_ALTO_SAX_NOTES);

export const BASS_MIGRATION_MAP: Record<string, string> = {
  C5: 'C3',
  B4: 'B2',
  A4: 'A2',
  G4: 'G2',
  F4: 'F2',
  E4: 'E2',
  D4: 'D2',
  C4: 'C3',
  B3: 'B2',
  A3: 'A2',
  G3: 'G2',
  F3: 'F2',
  E3: 'E2',
  D3: 'D2',
  C3: 'C3',
  B2: 'B2',
  A2: 'A2',
};

export const MELODY_CHORD_MAP = mapChordNotesToRows(MELODY_NOTE_TO_ROW, {
  C: ['C4', 'E4', 'G4'],
  D: ['D4', 'F#4', 'A4'],
  E: ['E4', 'G#4', 'B4'],
  F: ['F4', 'A4', 'C5'],
  G: ['G4', 'B4', 'D5'],
  A: ['A4', 'C5', 'E5'],
  B: ['B4', 'D#5', 'F#5'],
});

export const BASS_CHORD_MAP = mapChordNotesToRows(BASS_NOTE_TO_ROW, {
  C: ['C2'],
  D: ['D2'],
  E: ['E2'],
  F: ['F2'],
  G: ['G2'],
  A: ['A1'],
  B: ['B2'],
});
