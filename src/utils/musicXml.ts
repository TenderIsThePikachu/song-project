import {
  getBarCountForSteps,
  getBarInfoAtIndex,
  getBarInfoAtStep,
  normalizeTimeSignature,
  normalizeTimeSignatureChanges,
  type TimeSignature,
  type TimeSignatureChange,
} from './timeSignature.ts';

export type MusicXmlTrack = {
  id: string;
  name: string;
  shortName?: string;
  grid: readonly (readonly boolean[])[];
  lengths?: readonly (readonly number[])[];
  pitches: readonly string[];
  lyrics?: Readonly<Record<string, string>>;
  percussion?: boolean;
  percussionNames?: readonly string[];
  percussionMidiNotes?: readonly number[];
  grandStaff?: boolean;
};

type RawNote = {
  pitch: string;
  start: number;
  duration: number;
  lyric?: string;
  notehead?: 'normal' | 'x' | 'diamond';
  percussionIndex?: number;
  stem?: 'up' | 'down';
};

type NoteSegment = {
  pitch: string;
  start: number;
  duration: number;
  tieStart: boolean;
  tieStop: boolean;
  lyric?: string;
  notehead?: 'normal' | 'x' | 'diamond';
  percussionIndex?: number;
  stem?: 'up' | 'down';
};

type NoteGroup = {
  start: number;
  duration: number;
  notes: NoteSegment[];
};

const DIVISIONS = 4;
const NOTATION_DURATIONS = [16, 12, 8, 6, 4, 3, 2, 1] as const;

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function parsePitch(value: string) {
  const match = /^([A-G])(#|b)?(-?\d+)$/.exec(value.replace('_sharp', '#'));
  if (!match) return null;

  return {
    step: match[1],
    alter: match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0,
    octave: Number(match[3]),
  };
}

function pitchToMidi(value: string) {
  const parsed = parsePitch(value);
  if (!parsed) return 60;
  const pitchClasses: Record<string, number> = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11,
  };
  return (parsed.octave + 1) * 12 + pitchClasses[parsed.step] + parsed.alter;
}

function durationNotation(duration: number) {
  const notation: Record<number, { type: string; dotted?: boolean }> = {
    1: { type: '16th' },
    2: { type: 'eighth' },
    3: { type: 'eighth', dotted: true },
    4: { type: 'quarter' },
    6: { type: 'quarter', dotted: true },
    8: { type: 'half' },
    12: { type: 'half', dotted: true },
    16: { type: 'whole' },
  };
  return notation[duration] ?? notation[1];
}

function splitDuration(duration: number) {
  const chunks: number[] = [];
  let remaining = Math.max(0, Math.floor(duration));
  while (remaining > 0) {
    const chunk = NOTATION_DURATIONS.find((value) => value <= remaining) ?? 1;
    chunks.push(chunk);
    remaining -= chunk;
  }
  return chunks;
}

function getPercussionNotehead(name?: string): RawNote['notehead'] {
  switch (name?.toLowerCase()) {
    case 'hihat':
    case 'clap':
      return 'x';
    case 'percussion':
      return 'diamond';
    default:
      return 'normal';
  }
}

function getPercussionStem(name?: string): RawNote['stem'] {
  return name?.toLowerCase() === 'kick' ? 'down' : 'up';
}

function getPercussionDuration(
  track: MusicXmlTrack,
  rowIndex: number,
  col: number,
  timeSignatureChanges: readonly TimeSignatureChange[],
  timeSignature: TimeSignature
) {
  const stem = getPercussionStem(track.percussionNames?.[rowIndex]);
  const measureEnd = getBarInfoAtStep(timeSignatureChanges, timeSignature, col).end;
  let nextOnset = measureEnd;

  track.grid.forEach((row, candidateRowIndex) => {
    if (getPercussionStem(track.percussionNames?.[candidateRowIndex]) !== stem) return;
    for (let candidateCol = col + 1; candidateCol < Math.min(row.length, measureEnd); candidateCol += 1) {
      if (!row[candidateCol]) continue;
      nextOnset = Math.min(nextOnset, candidateCol);
      break;
    }
  });

  return Math.max(1, Math.min(4, nextOnset - col));
}

function collectRawNotes(
  track: MusicXmlTrack,
  timeSignatureChanges: readonly TimeSignatureChange[],
  timeSignature: TimeSignature
) {
  const notes: RawNote[] = [];
  track.grid.forEach((row, rowIndex) => {
    const pitch = track.pitches[rowIndex];
    if (!pitch || !parsePitch(pitch)) return;

    row.forEach((active, col) => {
      if (!active) return;
      notes.push({
        pitch,
        start: col,
        duration: track.percussion
          ? getPercussionDuration(track, rowIndex, col, timeSignatureChanges, timeSignature)
          : Math.max(1, Math.floor(track.lengths?.[rowIndex]?.[col] ?? 1)),
        lyric: track.lyrics?.[`${rowIndex}-${col}`]?.trim() || undefined,
        notehead: track.percussion
          ? getPercussionNotehead(track.percussionNames?.[rowIndex])
          : undefined,
        percussionIndex: track.percussion ? rowIndex : undefined,
        stem: track.percussion
          ? getPercussionStem(track.percussionNames?.[rowIndex])
          : undefined,
      });
    });
  });
  return notes;
}

function splitNoteIntoMeasures(
  note: RawNote,
  timeSignatureChanges: readonly TimeSignatureChange[],
  timeSignature: TimeSignature
) {
  const segments: Array<NoteSegment & { measure: number }> = [];
  let cursor = note.start;
  let remaining = note.duration;
  let consumed = 0;

  while (remaining > 0) {
    const bar = getBarInfoAtStep(timeSignatureChanges, timeSignature, cursor);
    const measure = bar.index;
    const availableInMeasure = bar.end - cursor;
    const available = Math.min(remaining, availableInMeasure);
    const chunks = splitDuration(available);

    chunks.forEach((duration) => {
      const hasPrevious = consumed > 0;
      const hasNext = remaining - duration > 0;
      segments.push({
        measure,
        pitch: note.pitch,
        start: cursor - bar.start,
        duration,
        tieStop: hasPrevious,
        tieStart: hasNext,
        lyric: consumed === 0 ? note.lyric : undefined,
        notehead: note.notehead,
        percussionIndex: note.percussionIndex,
        stem: note.stem,
      });
      cursor += duration;
      consumed += duration;
      remaining -= duration;
    });
  }

  return segments;
}

function groupSegments(segments: NoteSegment[]) {
  const groups = new Map<string, NoteGroup>();
  segments.forEach((segment) => {
    const key = [
      segment.start,
      segment.duration,
      Number(segment.tieStart),
      Number(segment.tieStop),
      segment.stem ?? '',
    ].join(':');
    const group = groups.get(key) ?? {
      start: segment.start,
      duration: segment.duration,
      notes: [],
    };
    group.notes.push(segment);
    groups.set(key, group);
  });

  return [...groups.values()].sort((left, right) => {
    const startDifference = left.start - right.start;
    if (startDifference) return startDifference;
    const leftStem = left.notes[0].stem;
    const rightStem = right.notes[0].stem;
    if (leftStem !== rightStem) return leftStem === 'up' ? -1 : 1;
    return pitchToMidi(left.notes[0].pitch) - pitchToMidi(right.notes[0].pitch);
  });
}

function assignVoices(groups: NoteGroup[], percussion: boolean) {
  if (percussion) {
    return (['up', 'down'] as const).flatMap((stem) => {
      const stemGroups = groups.filter((group) => group.notes[0].stem === stem);
      return stemGroups.length
        ? [{ end: stemGroups.at(-1)!.start + stemGroups.at(-1)!.duration, groups: stemGroups }]
        : [];
    });
  }

  const voices: Array<{ end: number; groups: NoteGroup[] }> = [];
  groups.forEach((group) => {
    const voice = voices.find((candidate) => candidate.end <= group.start);
    if (voice) {
      voice.groups.push(group);
      voice.end = group.start + group.duration;
    } else {
      voices.push({ end: group.start + group.duration, groups: [group] });
    }
  });
  return voices;
}

function renderRest(duration: number, voice: number, staff?: number) {
  return splitDuration(duration)
    .map((chunk) => {
      const notation = durationNotation(chunk);
      return `<note><rest/><duration>${chunk}</duration><voice>${voice}</voice><type>${notation.type}</type>${notation.dotted ? '<dot/>' : ''}${staff ? `<staff>${staff}</staff>` : ''}</note>`;
    })
    .join('');
}

function renderBeams(groups: NoteGroup[], groupIndex: number) {
  const group = groups[groupIndex];
  const levelCount = group.duration === 1 ? 2 : group.duration === 2 ? 1 : 0;
  if (!levelCount) return '';

  const connectsAtLevel = (candidate: NoteGroup | undefined, level: number) => {
    if (!candidate) return false;
    const candidateLevels = candidate.duration === 1 ? 2 : candidate.duration === 2 ? 1 : 0;
    const contiguous = candidate.start + candidate.duration === group.start
      || group.start + group.duration === candidate.start;
    const sameHalfMeasure = Math.floor(candidate.start / 8) === Math.floor(group.start / 8);
    return candidateLevels >= level && contiguous && sameHalfMeasure;
  };

  return Array.from({ length: levelCount }, (_, levelIndex) => {
    const level = levelIndex + 1;
    const previous = connectsAtLevel(groups[groupIndex - 1], level);
    const next = connectsAtLevel(groups[groupIndex + 1], level);
    if (!previous && !next) return '';
    const value = previous ? (next ? 'continue' : 'end') : 'begin';
    return `<beam number="${level}">${value}</beam>`;
  }).join('');
}

function renderNote(
  segment: NoteSegment,
  voice: number,
  chord: boolean,
  percussion: boolean,
  partIndex: number,
  beams: string,
  staff?: number
) {
  const pitch = parsePitch(segment.pitch);
  if (!pitch) return '';
  const notation = durationNotation(segment.duration);
  const ties = `${segment.tieStop ? '<tie type="stop"/>' : ''}${segment.tieStart ? '<tie type="start"/>' : ''}`;
  const tiedNotations = `${segment.tieStop ? '<tied type="stop"/>' : ''}${segment.tieStart ? '<tied type="start"/>' : ''}`;
  const notationBlock = tiedNotations ? `<notations>${tiedNotations}</notations>` : '';
  const lyric = segment.lyric
    ? `<lyric><syllabic>single</syllabic><text>${escapeXml(segment.lyric)}</text></lyric>`
    : '';
  const pitchBlock = percussion
    ? `<unpitched><display-step>${pitch.step}</display-step><display-octave>${pitch.octave}</display-octave></unpitched>`
    : `<pitch><step>${pitch.step}</step>${pitch.alter ? `<alter>${pitch.alter}</alter>` : ''}<octave>${pitch.octave}</octave></pitch>`;
  const notehead = percussion && segment.notehead && segment.notehead !== 'normal'
    ? `<notehead>${segment.notehead}</notehead>`
    : '';
  const instrument = percussion && segment.percussionIndex !== undefined
    ? `<instrument id="P${partIndex + 1}-I${segment.percussionIndex + 1}"/>`
    : '';
  const stem = percussion && segment.stem ? `<stem>${segment.stem}</stem>` : '';

  return `<note>${chord ? '<chord/>' : ''}${pitchBlock}<duration>${segment.duration}</duration>${ties}${instrument}<voice>${voice}</voice><type>${notation.type}</type>${notation.dotted ? '<dot/>' : ''}${stem}${notehead}${staff ? `<staff>${staff}</staff>` : ''}${beams}${notationBlock}${lyric}</note>`;
}

function renderStaff(
  segments: NoteSegment[],
  percussion: boolean,
  partIndex: number,
  voiceOffset = 0,
  staff: number | undefined,
  stepsPerBar: number
) {
  const groups = groupSegments(segments);
  const voices = assignVoices(groups, percussion);
  if (!voices.length) {
    const voice = voiceOffset + 1;
    return `<note><rest measure="yes"/><duration>${stepsPerBar}</duration><voice>${voice}</voice>${staff ? `<staff>${staff}</staff>` : ''}</note>`;
  }

  return voices.map((voice, voiceIndex) => {
    const voiceNumber = voiceOffset + voiceIndex + 1;
    let cursor = 0;
    const notes = voice.groups.map((group, groupIndex) => {
      const gap = Math.max(0, group.start - cursor);
      const rest = gap ? renderRest(gap, voiceNumber, staff) : '';
      const beams = percussion && group.notes[0].stem === 'up'
        ? renderBeams(voice.groups, groupIndex)
        : '';
      const chord = group.notes
        .sort((left, right) => pitchToMidi(left.pitch) - pitchToMidi(right.pitch))
        .map((note, noteIndex) => renderNote(
          note,
          voiceNumber,
          noteIndex > 0,
          percussion,
          partIndex,
          noteIndex === 0 ? beams : '',
          staff
        ))
        .join('');
      cursor = group.start + group.duration;
      return `${rest}${chord}`;
    }).join('');
    const endingRest = cursor < stepsPerBar
      ? renderRest(stepsPerBar - cursor, voiceNumber, staff)
      : '';
    const backup = voiceIndex < voices.length - 1
      ? `<backup><duration>${stepsPerBar}</duration></backup>`
      : '';
    return `${notes}${endingRest}${backup}`;
  }).join('');
}

function renderMeasure(
  measureNumber: number,
  segments: NoteSegment[],
  includeAttributes: boolean,
  includeTimeChange: boolean,
  bpm: number,
  clef: 'G' | 'F' | 'percussion',
  percussion: boolean,
  partIndex: number,
  grandStaff: boolean,
  timeSignature: TimeSignature,
  stepsPerBar: number
) {
  const attributes = includeAttributes
    ? grandStaff
      ? `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>${timeSignature.beats}</beats><beat-type>${timeSignature.beatType}</beat-type></time><staves>2</staves><clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`
      : `<attributes><divisions>${DIVISIONS}</divisions><key><fifths>0</fifths></key><time><beats>${timeSignature.beats}</beats><beat-type>${timeSignature.beatType}</beat-type></time><clef><sign>${clef}</sign><line>${clef === 'F' ? 4 : 2}</line></clef></attributes><direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit><per-minute>${bpm}</per-minute></metronome></direction-type><sound tempo="${bpm}"/></direction>`
    : includeTimeChange
      ? `<attributes><time><beats>${timeSignature.beats}</beats><beat-type>${timeSignature.beatType}</beat-type></time></attributes>`
      : '';

  const voiceXml = grandStaff
    ? `${renderStaff(segments.filter((segment) => pitchToMidi(segment.pitch) >= 60), false, partIndex, 0, 1, stepsPerBar)}<backup><duration>${stepsPerBar}</duration></backup>${renderStaff(segments.filter((segment) => pitchToMidi(segment.pitch) < 60), false, partIndex, 4, 2, stepsPerBar)}`
    : renderStaff(segments, percussion, partIndex, 0, undefined, stepsPerBar);

  return `<measure number="${measureNumber}">${attributes}${voiceXml}</measure>`;
}

function renderPart(
  track: MusicXmlTrack,
  partIndex: number,
  measureCount: number,
  bpm: number,
  timeSignature: TimeSignature,
  timeSignatureChanges: readonly TimeSignatureChange[]
) {
  const notes = collectRawNotes(track, timeSignatureChanges, timeSignature);
  const measureSegments = new Map<number, NoteSegment[]>();
  notes.flatMap((note) => splitNoteIntoMeasures(note, timeSignatureChanges, timeSignature)).forEach(({ measure, ...segment }) => {
    measureSegments.set(measure, [...(measureSegments.get(measure) ?? []), segment]);
  });
  const averageMidi = notes.length
    ? notes.reduce((sum, note) => sum + pitchToMidi(note.pitch), 0) / notes.length
    : 60;
  const clef = track.percussion ? 'percussion' : averageMidi < 58 ? 'F' : 'G';
  const measures = Array.from({ length: measureCount }, (_, index) => {
    const bar = getBarInfoAtIndex(timeSignatureChanges, timeSignature, index);
    const previousBar = index > 0
      ? getBarInfoAtIndex(timeSignatureChanges, timeSignature, index - 1)
      : null;
    const includeTimeChange = Boolean(
      previousBar &&
      (previousBar.timeSignature.beats !== bar.timeSignature.beats ||
        previousBar.timeSignature.beatType !== bar.timeSignature.beatType)
    );
    return renderMeasure(
      index + 1,
      measureSegments.get(index) ?? [],
      index === 0,
      includeTimeChange,
      bpm,
      clef,
      Boolean(track.percussion),
      partIndex,
      Boolean(track.grandStaff),
      bar.timeSignature,
      bar.length
    );
  }).join('');
  return `<part id="P${partIndex + 1}">${measures}</part>`;
}

export function hasTrackNotes(track: MusicXmlTrack) {
  return track.grid.some((row) => row.some(Boolean));
}

export function buildMusicXml({
  title,
  creator,
  bpm,
  tracks,
  timeSignature: requestedTimeSignature,
  timeSignatureChanges: requestedTimeSignatureChanges,
}: {
  title: string;
  creator?: string;
  bpm: number;
  tracks: MusicXmlTrack[];
  timeSignature?: TimeSignature;
  timeSignatureChanges?: TimeSignatureChange[];
}) {
  const timeSignature = normalizeTimeSignature(requestedTimeSignature);
  const timeSignatureChanges = normalizeTimeSignatureChanges(
    requestedTimeSignatureChanges,
    timeSignature
  );
  const populatedTracks = tracks.filter(hasTrackNotes);
  const allNotes = populatedTracks.flatMap((track) =>
    collectRawNotes(track, timeSignatureChanges, timeSignature)
  );
  const lastStep = allNotes.reduce(
    (latest, note) => Math.max(latest, note.start + note.duration),
    1
  );
  const measureCount = getBarCountForSteps(timeSignatureChanges, timeSignature, lastStep);
  const partList = populatedTracks
    .map((track, index) => {
      const name = escapeXml(track.name);
      const shortName = escapeXml(track.shortName ?? track.name);
      const textStyle = 'font-family="NanumGothic" font-size="4.5" font-weight="normal" color="#52657c"';
      const instrument = track.percussion
        ? (track.percussionNames?.length ? track.percussionNames : ['Drumset'])
            .map((instrumentName, instrumentIndex) => {
              const instrumentId = `P${index + 1}-I${instrumentIndex + 1}`;
              const midiNote = track.percussionMidiNotes?.[instrumentIndex];
              return `<score-instrument id="${instrumentId}"><instrument-name>${escapeXml(instrumentName)}</instrument-name></score-instrument><midi-instrument id="${instrumentId}"><midi-channel>10</midi-channel><midi-program>1</midi-program>${midiNote ? `<midi-unpitched>${midiNote}</midi-unpitched>` : ''}</midi-instrument>`;
            })
            .join('')
        : '';
      return `<score-part id="P${index + 1}"><part-name print-object="yes" ${textStyle}>${name}</part-name><part-abbreviation print-object="yes" ${textStyle}>${shortName}</part-abbreviation>${instrument}</score-part>`;
    })
    .join('');
  const parts = populatedTracks
    .map((track, index) => renderPart(
      track,
      index,
      measureCount,
      bpm,
      timeSignature,
      timeSignatureChanges
    ))
    .join('');
  const creatorCredit = creator?.trim()
    ? `<creator type="composer">${escapeXml(`${creator.trim()} 작곡`)}</creator>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0"><work><work-title>${escapeXml(title.trim() || '제목 없는 곡')}</work-title></work><identification>${creatorCredit}<rights>작곡밥에서 제작</rights><encoding><software>작곡밥</software><encoding-date>${new Date().toISOString().slice(0, 10)}</encoding-date></encoding></identification><part-list>${partList}</part-list>${parts}</score-partwise>`;
}
