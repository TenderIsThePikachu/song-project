// src/audio/engine.ts
import * as Tone from "tone";
import {
  acousticGuitarSynth,
  bassSampler,
  CHICAGO_STREET_SAMPLE_URLS,
  chicagoStreetSynth,
  createBassSampler,
  createDrumSampler,
  DRUM_SAMPLE_NOTE_BY_ROW,
  drumSampler,
  GLOCKENSPIEL_SAMPLE_URLS,
  glockenspielSynth,
  GUITAR_SAMPLE_URLS,
  PICCOLO_SAMPLE_URLS,
  piccoloSynth,
  pianoSynth,
  SAXOPHONE_SAMPLE_URLS,
  saxophoneSynth,
  STUDIO_ALTO_SAX_SAMPLE_URLS,
  studioAltoSaxSynth,
  SUPPORTING_PIANO_SAMPLE_URLS,
  supportingPianoSynth,
  VIOLIN_SAMPLE_URLS,
  violinSynth,
} from "./instruments.ts";
import { useSongStore, type ExtraInstrumentTrack, type InstrumentKey, type InstrumentVolumes } from "../store/songStore.ts";
import {
  BASS_MIDI,
  CHICAGO_STREET_NOTES,
  GLOCKENSPIEL_NOTES,
  GUITAR_TRACK_LABELS,
  MELODY_MIDI,
  PICCOLO_NOTES,
  SAXOPHONE_NOTES,
  STUDIO_ALTO_SAX_NOTES,
  SUPPORTING_PIANO_NOTES,
  VIOLIN_NOTES,
} from "../constants/composer.ts";

let loopId: number | null = null;
let playbackStep = 0;
const PLAYBACK_START_DELAY_SECONDS = 0.08;
const AUDIO_LOOK_AHEAD_SECONDS = 0.12;
let cachedVolumeKey = "";
let cachedExtraTrackVolumeKey = "";
let cachedBusVolumes: InstrumentVolumes | null = null;
let lastAppliedTransportBpm = 0;

const SHARP_TO_FLAT_NOTE: Record<string, string> = {
  "C#": "Db",
  "D#": "Eb",
  "F#": "Gb",
  "G#": "Ab",
  "A#": "Bb",
};

function toSamplerNote(note: string) {
  const normalizedNote = note.replace('_sharp', '#');
  return normalizedNote.replace(/^([A-G]#)(-?\d+)$/, (_match, root: string, octave: string) => {
    return `${SHARP_TO_FLAT_NOTE[root] ?? root}${octave}`;
  });
}

function withFlatAliases<T extends Record<string, string>>(urls: T): Record<string, string> {
  const aliasedUrls: Record<string, string> = { ...urls };

  Object.entries(urls).forEach(([note, file]) => {
    aliasedUrls[toSamplerNote(note)] = file;
  });

  return aliasedUrls;
}

const PIANO_SAMPLE_URLS: Record<string, string> = withFlatAliases({
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
});

let cachedPianoBuffers: Record<string, AudioBuffer> | null = null;
let lameLoadPromise: Promise<void> | null = null;
let toneLoadPromise: Promise<void> | null = null;

function tuneAudioLatency() {
  Tone.getContext().lookAhead = AUDIO_LOOK_AHEAD_SECONDS;
}

async function ensureToneReady() {
  tuneAudioLatency();
  await Tone.start();

  if (!toneLoadPromise) {
    toneLoadPromise = Tone.loaded();
  }

  await toneLoadPromise;
}

function getMelodyPlaybackNote(row: number) {
  const midi = MELODY_MIDI[row] ?? MELODY_MIDI[MELODY_MIDI.length - 1];
  return toSamplerNote(Tone.Frequency(midi, "midi").toNote());
}

function getGuitarPlaybackNote(row: number) {
  return toSamplerNote(GUITAR_TRACK_LABELS[row] ?? GUITAR_TRACK_LABELS[GUITAR_TRACK_LABELS.length - 1]);
}

function getViolinPlaybackNote(row: number) {
  return toSamplerNote(VIOLIN_NOTES[row] ?? VIOLIN_NOTES[VIOLIN_NOTES.length - 1]);
}

function getSaxophonePlaybackNote(row: number) {
  return toSamplerNote(SAXOPHONE_NOTES[row] ?? SAXOPHONE_NOTES[SAXOPHONE_NOTES.length - 1]);
}

function getSampledInstrumentPlaybackNote(notes: readonly string[], row: number) {
  return toSamplerNote(notes[row] ?? notes[notes.length - 1] ?? "C4");
}

function volumeToDb(volume: number) {
  if (volume <= 0) {
    return -60;
  }

  return Tone.gainToDb(volume / 100);
}

const DRUM_SAMPLE_DURATION_BY_ROW = ["8n", "16n", "32n", "8n", "8n"] as const;
const SAMPLED_INSTRUMENT_VELOCITY: Record<
  "glockenspiel" | "piccolo" | "supportingPiano" | "chicagoStreet" | "studioAltoSax",
  number
> = {
  glockenspiel: 0.9,
  piccolo: 0.9,
  supportingPiano: 0.9,
  chicagoStreet: 1.65,
  studioAltoSax: 0.9,
};

function getDrumSampleNote(row: number) {
  return DRUM_SAMPLE_NOTE_BY_ROW[row] ?? DRUM_SAMPLE_NOTE_BY_ROW[0];
}

function getDrumSampleDuration(row: number) {
  return DRUM_SAMPLE_DURATION_BY_ROW[row] ?? "16n";
}

function triggerLiveDrumSample(row: number, time?: number, velocity?: number) {
  drumSampler.triggerAttackRelease(
    getDrumSampleNote(row),
    getDrumSampleDuration(row),
    time,
    velocity
  );
}

function getInstrumentBusVolumes(volumes: InstrumentVolumes, extraTracks: ExtraInstrumentTrack[] = []) {
  const busVolumes: InstrumentVolumes = {
    melody: volumes.melody ?? 82,
    violin: volumes.violin ?? 78,
    saxophone: volumes.saxophone ?? 80,
    guitar: volumes.guitar ?? 80,
    drums: volumes.drums ?? 78,
    bass: volumes.bass ?? 84,
    glockenspiel: volumes.glockenspiel ?? 78,
    piccolo: volumes.piccolo ?? 76,
    supportingPiano: volumes.supportingPiano ?? 78,
    chicagoStreet: volumes.chicagoStreet ?? 78,
    studioAltoSax: volumes.studioAltoSax ?? 80,
  };

  extraTracks.forEach((track) => {
    busVolumes[track.instrument] = Math.max(busVolumes[track.instrument] ?? 0, track.volume);
  });

  return busVolumes;
}

function getVolumeScale(volume: number, busVolume: number) {
  if (busVolume <= 0 || volume <= 0) {
    return 0;
  }

  return Math.min(1, volume / busVolume);
}

function applyLiveVolumes(volumes: InstrumentVolumes, extraTracks: ExtraInstrumentTrack[] = []) {
  const busVolumes = getInstrumentBusVolumes(volumes, extraTracks);
  const melodyDb = volumeToDb(busVolumes.melody);
  const violinDb = volumeToDb(busVolumes.violin);
  const saxophoneDb = volumeToDb(busVolumes.saxophone);
  const guitarDb = volumeToDb(busVolumes.guitar);
  const drumsDb = volumeToDb(busVolumes.drums);
  const bassDb = volumeToDb(busVolumes.bass);
  const glockenspielDb = volumeToDb(busVolumes.glockenspiel);
  const piccoloDb = volumeToDb(busVolumes.piccolo);
  const supportingPianoDb = volumeToDb(busVolumes.supportingPiano);
  const chicagoStreetDb = volumeToDb(busVolumes.chicagoStreet);
  const studioAltoSaxDb = volumeToDb(busVolumes.studioAltoSax);

  pianoSynth.volume.value = melodyDb;
  acousticGuitarSynth.volume.value = guitarDb;
  violinSynth.volume.value = violinDb;
  saxophoneSynth.volume.value = saxophoneDb;
  drumSampler.volume.value = drumsDb;
  bassSampler.volume.value = bassDb;
  glockenspielSynth.volume.value = glockenspielDb;
  piccoloSynth.volume.value = piccoloDb;
  supportingPianoSynth.volume.value = supportingPianoDb;
  chicagoStreetSynth.volume.value = chicagoStreetDb;
  studioAltoSaxSynth.volume.value = studioAltoSaxDb;

  return busVolumes;
}

function getLiveBusVolumes(volumes: InstrumentVolumes, extraTracks: ExtraInstrumentTrack[] = []) {
  const volumeKey = `${volumes.melody}|${volumes.violin}|${volumes.saxophone}|${volumes.guitar}|${volumes.drums}|${volumes.bass}|${volumes.glockenspiel}|${volumes.piccolo}|${volumes.supportingPiano}|${volumes.chicagoStreet}|${volumes.studioAltoSax}`;
  const extraTrackVolumeKey = extraTracks
    .map((track) => `${track.id}:${track.instrument}:${track.volume}`)
    .join("|");

  if (
    cachedBusVolumes &&
    cachedVolumeKey === volumeKey &&
    cachedExtraTrackVolumeKey === extraTrackVolumeKey
  ) {
    return cachedBusVolumes;
  }

  cachedVolumeKey = volumeKey;
  cachedExtraTrackVolumeKey = extraTrackVolumeKey;
  cachedBusVolumes = applyLiveVolumes(volumes, extraTracks);
  return cachedBusVolumes;
}

function getSixteenthDurationSeconds(bpm: number) {
  return (60 / bpm) / 4;
}

function getAutomationBpmAtStep(state: ReturnType<typeof useSongStore.getState>, step: number) {
  const automation = state.tempoAutomation;
  if (!automation || automation.length === 0) {
    return state.bpm;
  }

  const safeStep = Math.max(0, Math.min(state.steps - 1, step));
  const points = automation
    .filter((point) => Number.isFinite(point.step) && Number.isFinite(point.bpm))
    .sort((a, b) => a.step - b.step);
  if (points.length === 0) {
    return state.bpm;
  }

  const first = points[0];
  if (safeStep <= first.step) {
    return first.bpm;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (safeStep >= from.step && safeStep <= to.step) {
      const span = Math.max(1, to.step - from.step);
      const progress = (safeStep - from.step) / span;
      return from.bpm + (to.bpm - from.bpm) * progress;
    }
  }

  return points[points.length - 1].bpm;
}

function getMelodyGateSeconds(durationSteps: number, bpm: number) {
  return getSixteenthDurationSeconds(bpm) * Math.max(1, durationSteps) * 0.86;
}

function getMelodyVelocity(row: number, durationSteps: number) {
  void durationSteps;
  const midi = MELODY_MIDI[row] ?? MELODY_MIDI[MELODY_MIDI.length - 1];

  if (midi <= 36) {
    return 0.78;
  }

  if (midi <= 48) {
    return 0.82;
  }

  if (midi <= 56) {
    return 0.9;
  }

  return midi >= 84 ? 0.92 : 1;
}

function triggerLiveMelodyNote(
  note: string,
  durationSeconds: number,
  time?: number,
  velocity?: number
) {
  pianoSynth.triggerAttackRelease(note, durationSeconds, time, velocity);
}

function triggerLiveGuitarNote(
  row: number,
  durationSeconds: number,
  time?: number,
  velocity?: number
) {
  acousticGuitarSynth.triggerAttackRelease(
    getGuitarPlaybackNote(row),
    durationSeconds,
    time,
    velocity
  );
}

function triggerLiveViolinNote(
  row: number,
  durationSeconds: number,
  time?: number,
  velocity?: number
) {
  violinSynth.triggerAttackRelease(getViolinPlaybackNote(row), durationSeconds, time, velocity);
}

function triggerLiveSaxophoneNote(
  row: number,
  durationSeconds: number,
  time?: number,
  velocity?: number
) {
  saxophoneSynth.triggerAttackRelease(getSaxophonePlaybackNote(row), durationSeconds, time, velocity);
}

function triggerLiveSampledInstrumentNote(
  synth: Tone.Sampler,
  notes: readonly string[],
  row: number,
  durationSeconds: number,
  time?: number,
  velocity?: number
) {
  synth.triggerAttackRelease(
    getSampledInstrumentPlaybackNote(notes, row),
    durationSeconds,
    time,
    velocity
  );
}

function getSampledInstrumentRuntime(
  instrument: "glockenspiel" | "piccolo" | "supportingPiano" | "chicagoStreet" | "studioAltoSax"
) {
  switch (instrument) {
    case "glockenspiel":
      return { synth: glockenspielSynth, notes: GLOCKENSPIEL_NOTES };
    case "piccolo":
      return { synth: piccoloSynth, notes: PICCOLO_NOTES };
    case "supportingPiano":
      return { synth: supportingPianoSynth, notes: SUPPORTING_PIANO_NOTES };
    case "chicagoStreet":
      return { synth: chicagoStreetSynth, notes: CHICAGO_STREET_NOTES };
    case "studioAltoSax":
    default:
      return { synth: studioAltoSaxSynth, notes: STUDIO_ALTO_SAX_NOTES };
  }
}

function getExtraTrackNote(
  instrument: InstrumentKey,
  row: number,
  fallbackNote = "C4"
) {
  switch (instrument) {
    case "melody":
      return getMelodyPlaybackNote(row);
    case "violin":
      return getViolinPlaybackNote(row);
    case "saxophone":
      return getSaxophonePlaybackNote(row);
    case "guitar":
      return getGuitarPlaybackNote(row);
    case "bass": {
      const midi = BASS_MIDI[row] ?? BASS_MIDI[BASS_MIDI.length - 1];
      return toSamplerNote(Tone.Frequency(midi, "midi").toNote());
    }
    case "drums":
      return getDrumSampleNote(row);
    case "glockenspiel":
      return getSampledInstrumentPlaybackNote(GLOCKENSPIEL_NOTES, row);
    case "piccolo":
      return getSampledInstrumentPlaybackNote(PICCOLO_NOTES, row);
    case "supportingPiano":
      return getSampledInstrumentPlaybackNote(SUPPORTING_PIANO_NOTES, row);
    case "chicagoStreet":
      return getSampledInstrumentPlaybackNote(CHICAGO_STREET_NOTES, row);
    case "studioAltoSax":
      return getSampledInstrumentPlaybackNote(STUDIO_ALTO_SAX_NOTES, row);
    default:
      return fallbackNote;
  }
}

type PlaybackEvent =
  | { type: "melody"; note: string; durationSeconds: number; velocity: number }
  | { type: "violin"; row: number; durationSeconds: number; velocity: number }
  | { type: "saxophone"; row: number; durationSeconds: number; velocity: number }
  | { type: "guitar"; row: number; durationSeconds: number; velocity: number }
  | { type: "bass"; note: string; durationSeconds: number; velocity: number }
  | { type: "drums"; row: number; velocity: number }
  | { type: "sampled"; instrument: "glockenspiel" | "piccolo" | "supportingPiano" | "chicagoStreet" | "studioAltoSax"; row: number; durationSeconds: number; velocity: number };

function buildPlaybackPlan(state: ReturnType<typeof useSongStore.getState>) {
  const plan = Array.from({ length: state.steps }, () => [] as PlaybackEvent[]);
  const busVolumes = getLiveBusVolumes(state.volumes, state.extraTracks);
  const melodyVelocityScale = getVolumeScale(state.volumes.melody, busVolumes.melody);
  const violinVelocityScale = getVolumeScale(state.volumes.violin, busVolumes.violin);
  const saxophoneVelocityScale = getVolumeScale(state.volumes.saxophone, busVolumes.saxophone);
  const guitarVelocityScale = getVolumeScale(state.volumes.guitar, busVolumes.guitar);
  const drumsVelocityScale = getVolumeScale(state.volumes.drums, busVolumes.drums);
  const bassVelocityScale = getVolumeScale(state.volumes.bass, busVolumes.bass);
  const addEvent = (step: number, event: PlaybackEvent) => {
    if (step >= 0 && step < plan.length) {
      plan[step].push(event);
    }
  };

  state.melody.forEach((rowArr, rowIndex) => {
    rowArr.forEach((active, step) => {
      if (!active) return;
      const durationSteps = Math.max(1, state.melodyLengths[rowIndex]?.[step] ?? 1);
      const expressiveVelocity = state.melodyVelocities?.[rowIndex]?.[step] || 0;
      const stepBpm = getAutomationBpmAtStep(state, step);
      addEvent(step, {
        type: "melody",
        note: getMelodyPlaybackNote(rowIndex),
        durationSeconds: getMelodyGateSeconds(durationSteps, stepBpm),
        velocity: getMelodyVelocity(rowIndex, durationSteps) * melodyVelocityScale * (expressiveVelocity || 0.82),
      });
    });
  });

  state.violin.slice(0, VIOLIN_NOTES.length).forEach((rowArr, rowIndex) => {
    rowArr.forEach((active, step) => {
      if (!active) return;
      const durationSteps = Math.max(1, state.violinLengths[rowIndex]?.[step] ?? 1);
      const stepBpm = getAutomationBpmAtStep(state, step);
      addEvent(step, {
        type: "violin",
        row: rowIndex,
        durationSeconds: getMelodyGateSeconds(durationSteps, stepBpm),
        velocity: 0.86 * violinVelocityScale,
      });
    });
  });

  state.saxophone.slice(0, SAXOPHONE_NOTES.length).forEach((rowArr, rowIndex) => {
    rowArr.forEach((active, step) => {
      if (!active) return;
      const durationSteps = Math.max(1, state.saxophoneLengths[rowIndex]?.[step] ?? 1);
      const stepBpm = getAutomationBpmAtStep(state, step);
      addEvent(step, {
        type: "saxophone",
        row: rowIndex,
        durationSeconds: getMelodyGateSeconds(durationSteps, stepBpm),
        velocity: 0.78 * saxophoneVelocityScale,
      });
    });
  });

  state.guitar.forEach((rowArr, rowIndex) => {
    rowArr.forEach((active, step) => {
      if (!active) return;
      const durationSteps = Math.max(1, state.guitarLengths[rowIndex]?.[step] ?? 1);
      const stepBpm = getAutomationBpmAtStep(state, step);
      addEvent(step, {
        type: "guitar",
        row: rowIndex,
        durationSeconds: getMelodyGateSeconds(durationSteps, stepBpm),
        velocity: guitarVelocityScale,
      });
    });
  });

  state.bass.forEach((rowArr, rowIndex) => {
    rowArr.forEach((active, step) => {
      if (!active) return;
      const durationSteps = Math.max(1, state.bassLengths[rowIndex]?.[step] ?? 1);
      const stepBpm = getAutomationBpmAtStep(state, step);
      addEvent(step, {
        type: "bass",
        note: getExtraTrackNote("bass", rowIndex),
        durationSeconds: getMelodyGateSeconds(durationSteps, stepBpm),
        velocity: bassVelocityScale,
      });
    });
  });

  state.drums.forEach((rowArr, rowIndex) => {
    rowArr.forEach((active, step) => {
      if (active) {
        addEvent(step, { type: "drums", row: rowIndex, velocity: drumsVelocityScale });
      }
    });
  });

  state.extraTracks.forEach((track) => {
    const velocityScale = getVolumeScale(track.volume, busVolumes[track.instrument]);
    if (velocityScale <= 0) return;

    track.grid.forEach((rowArr, rowIndex) => {
      rowArr.forEach((active, step) => {
        if (!active) return;
        const durationSteps = Math.max(1, track.melodyLengths?.[rowIndex]?.[step] ?? 1);
        const durationSeconds = getMelodyGateSeconds(durationSteps, getAutomationBpmAtStep(state, step));

        switch (track.instrument) {
          case "melody":
            addEvent(step, {
              type: "melody",
              note: getExtraTrackNote(track.instrument, rowIndex),
              durationSeconds,
              velocity: getMelodyVelocity(rowIndex, durationSteps) * velocityScale,
            });
            break;
          case "violin":
            addEvent(step, { type: "violin", row: rowIndex, durationSeconds, velocity: 0.86 * velocityScale });
            break;
          case "saxophone":
            addEvent(step, { type: "saxophone", row: rowIndex, durationSeconds, velocity: 0.78 * velocityScale });
            break;
          case "guitar":
            addEvent(step, { type: "guitar", row: rowIndex, durationSeconds, velocity: velocityScale });
            break;
          case "bass":
            addEvent(step, {
              type: "bass",
              note: getExtraTrackNote(track.instrument, rowIndex),
              durationSeconds,
              velocity: velocityScale,
            });
            break;
          case "drums":
            addEvent(step, { type: "drums", row: rowIndex, velocity: velocityScale });
            break;
          case "glockenspiel":
          case "piccolo":
          case "supportingPiano":
          case "chicagoStreet":
          case "studioAltoSax":
            addEvent(step, {
              type: "sampled",
              instrument: track.instrument,
              row: rowIndex,
              durationSeconds,
              velocity: SAMPLED_INSTRUMENT_VELOCITY[track.instrument] * velocityScale,
            });
            break;
          default:
            break;
        }
      });
    });
  });

  return plan;
}

function triggerPlaybackEvent(event: PlaybackEvent, time: number) {
  switch (event.type) {
    case "melody":
      triggerLiveMelodyNote(event.note, event.durationSeconds, time, event.velocity);
      break;
    case "violin":
      triggerLiveViolinNote(event.row, event.durationSeconds, time, event.velocity);
      break;
    case "saxophone":
      triggerLiveSaxophoneNote(event.row, event.durationSeconds, time, event.velocity);
      break;
    case "guitar":
      triggerLiveGuitarNote(event.row, event.durationSeconds, time, event.velocity);
      break;
    case "bass":
      bassSampler.triggerAttackRelease(event.note, event.durationSeconds, time, event.velocity);
      break;
    case "drums":
      triggerLiveDrumSample(event.row, time, event.velocity);
      break;
    case "sampled": {
      const sampledConfig = getSampledInstrumentRuntime(event.instrument);
      triggerLiveSampledInstrumentNote(
        sampledConfig.synth,
        sampledConfig.notes,
        event.row,
        event.durationSeconds,
        time,
        event.velocity
      );
      break;
    }
    default:
      break;
  }
}

export async function preparePlaybackEngine() {
  await ensureToneReady();
  initTransport();
  const state = useSongStore.getState();
  cachedVolumeKey = "";
  cachedExtraTrackVolumeKey = "";
  cachedBusVolumes = null;
  getLiveBusVolumes(state.volumes, state.extraTracks);
}

export function getPlaybackStartDelaySeconds() {
  return PLAYBACK_START_DELAY_SECONDS;
}

export function releaseInstrumentSounds(instrument: InstrumentKey) {
  switch (instrument) {
    case "melody":
      pianoSynth.releaseAll();
      break;
    case "violin":
      violinSynth.releaseAll();
      break;
    case "saxophone":
      saxophoneSynth.releaseAll();
      break;
    case "guitar":
      acousticGuitarSynth.releaseAll();
      break;
    case "bass":
      bassSampler.releaseAll();
      break;
    case "drums":
    default:
      break;
    case "glockenspiel":
      glockenspielSynth.releaseAll();
      break;
    case "piccolo":
      piccoloSynth.releaseAll();
      break;
    case "supportingPiano":
      supportingPianoSynth.releaseAll();
      break;
    case "chicagoStreet":
      chicagoStreetSynth.releaseAll();
      break;
    case "studioAltoSax":
      studioAltoSaxSynth.releaseAll();
      break;
  }
}

async function loadPianoBuffers(): Promise<Record<string, AudioBuffer>> {
  if (cachedPianoBuffers) return cachedPianoBuffers;
  const entries = await Promise.all(
    Object.entries(PIANO_SAMPLE_URLS).map(async ([note, file]) => {
      const baseUrl = import.meta.env.BASE_URL ?? "/";
      const origin = getOrigin();
      const base = new URL(baseUrl, origin);
      const url = new URL(
        `samples/piano/${encodeURIComponent(file)}`,
        base
      ).toString();
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} for ${url}`);
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.startsWith("audio/")) {
          throw new Error(
            `Unexpected content-type "${contentType}" for ${url}`
          );
        }
        const arrayBuffer = await res.arrayBuffer();
        const audio = await Tone.getContext().rawContext.decodeAudioData(
          arrayBuffer.slice(0)
        );
        return [note, audio] as const;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to decode ${url}: ${message}`);
      }
    })
  );
  cachedPianoBuffers = Object.fromEntries(entries);
  return cachedPianoBuffers;
}

export function initTransport() {
  if (loopId !== null) {
    Tone.Transport.clear(loopId);
    loopId = null;
  }

  Tone.Transport.cancel();
  const initialState = useSongStore.getState();
  playbackStep = initialState.loopRange?.start ?? initialState.currentStep;

  loopId = Tone.Transport.scheduleRepeat((time) => {
    const latestState = useSongStore.getState();
    const playbackPlan = buildPlaybackPlan(latestState);
    const playbackSteps = latestState.steps;
    const playbackLoopRange = latestState.loopRange;
    const currentPlaybackStep = Math.min(playbackStep, Math.max(0, playbackSteps - 1));
    const playbackBpm = getAutomationBpmAtStep(latestState, currentPlaybackStep);

    if (lastAppliedTransportBpm !== playbackBpm) {
      const bpmParam = Tone.Transport.bpm as unknown as {
        rampTo?: (value: number, rampTime: number) => void;
        value: number;
      };
      if (typeof bpmParam.rampTo === "function") {
        bpmParam.rampTo(playbackBpm, 0.06);
      } else {
        bpmParam.value = playbackBpm;
      }
      lastAppliedTransportBpm = playbackBpm;
    }

    try {
      playbackPlan[currentPlaybackStep]?.forEach((event) => {
        triggerPlaybackEvent(event, time);
      });
    } catch (error) {
      console.error("Playback tick failed:", error);
    } finally {
      Tone.Draw.schedule(() => {
        window.dispatchEvent(
          new CustomEvent("composer-playhead-step", {
            detail: { step: currentPlaybackStep, bpm: playbackBpm },
          })
        );
      }, time);

      const nextStep = playbackLoopRange
        ? currentPlaybackStep >= playbackLoopRange.end
          ? playbackLoopRange.start
          : currentPlaybackStep + 1
        : (currentPlaybackStep + 1) % playbackSteps;
      playbackStep = nextStep;
    }
  }, "16n");

  Tone.Transport.position = 0;
}

export async function playMelodyPreview(row: number, durationSteps = 1): Promise<void> {
  await ensureToneReady();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  const bpm = state.bpm;
  const note = getMelodyPlaybackNote(row);
  triggerLiveMelodyNote(
    note,
    getMelodyGateSeconds(durationSteps, bpm),
    Tone.now(),
    getMelodyVelocity(row, durationSteps)
  );
}

export async function playViolinPreview(row: number, durationSteps = 1): Promise<void> {
  await ensureToneReady();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  triggerLiveViolinNote(row, getMelodyGateSeconds(durationSteps, state.bpm), Tone.now(), 0.86);
}

export async function playSaxophonePreview(row: number, durationSteps = 1): Promise<void> {
  await ensureToneReady();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  triggerLiveSaxophoneNote(row, getMelodyGateSeconds(durationSteps, state.bpm), Tone.now(), 0.78);
}

export async function playGuitarPreview(row: number, durationSteps = 1): Promise<void> {
  await ensureToneReady();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  triggerLiveGuitarNote(row, getMelodyGateSeconds(durationSteps, state.bpm), Tone.now(), 1);
}

export async function playSampledInstrumentPreview(
  instrument: "glockenspiel" | "piccolo" | "supportingPiano" | "chicagoStreet" | "studioAltoSax",
  row: number,
  durationSteps = 1
): Promise<void> {
  await ensureToneReady();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  const config = getSampledInstrumentRuntime(instrument);
  triggerLiveSampledInstrumentNote(
    config.synth,
    config.notes,
    row,
    getMelodyGateSeconds(durationSteps, state.bpm),
    Tone.now(),
    SAMPLED_INSTRUMENT_VELOCITY[instrument]
  );
}

export async function playDrumPreview(row: number): Promise<void> {
  await ensureToneReady();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  triggerLiveDrumSample(row, Tone.now());
}

async function renderSongBuffer(): Promise<AudioBuffer> {
  await Tone.start();
  await loadLame();
  const {
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
    steps,
    bpm,
    volumes,
  } = useSongStore.getState();
  const pianoBuffers = await loadPianoBuffers();

  const sixteenthSeconds = getSixteenthDurationSeconds(bpm);
  const durationSeconds = steps * sixteenthSeconds + 1.0;

  const rendered = await Tone.Offline(async ({ transport }) => {
    const melodyBus = new Tone.Reverb({ decay: 1.25, preDelay: 0.008, wet: 0.1 }).toDestination();
    const violinBus = new Tone.Reverb({ decay: 1.65, preDelay: 0.012, wet: 0.16 }).toDestination();
    const saxophoneBus = new Tone.Reverb({ decay: 1.15, preDelay: 0.008, wet: 0.11 }).toDestination();
    const guitarBus = new Tone.Reverb({ decay: 1.8, preDelay: 0.01, wet: 0.18 }).toDestination();
    const glockenspielBus = new Tone.Reverb({ decay: 1.45, preDelay: 0.01, wet: 0.2 }).toDestination();
    const piccoloBus = new Tone.Reverb({ decay: 1.25, preDelay: 0.008, wet: 0.13 }).toDestination();
    const supportingPianoBus = new Tone.Reverb({ decay: 1.9, preDelay: 0.01, wet: 0.18 }).toDestination();
    const chicagoStreetBus = new Tone.Reverb({ decay: 1.35, preDelay: 0.01, wet: 0.14 }).toDestination();
    const studioAltoSaxBus = new Tone.Reverb({ decay: 1.1, preDelay: 0.008, wet: 0.12 }).toDestination();
    const melodySynth = new Tone.Sampler({ urls: pianoBuffers ?? {}, release: 0.42 }).connect(melodyBus);
    const violinSynthOffline = new Tone.Sampler({
      urls: VIOLIN_SAMPLE_URLS,
      attack: 0.018,
      release: 0.58,
      baseUrl: "/samples/violin/",
    }).connect(violinBus);
    const saxophoneSynthOffline = new Tone.Sampler({
      urls: SAXOPHONE_SAMPLE_URLS,
      attack: 0.008,
      release: 0.28,
      baseUrl: "/samples/sax/",
    }).connect(saxophoneBus);
    const guitarSynth = new Tone.Sampler({
      urls: GUITAR_SAMPLE_URLS,
      release: 1.2,
      baseUrl: "/samples/guitar/",
    }).connect(guitarBus);
    const glockenspielSynthOffline = new Tone.Sampler({
      urls: GLOCKENSPIEL_SAMPLE_URLS,
      release: 1.1,
      baseUrl: "/samples/glockenspiel/",
    }).connect(glockenspielBus);
    const piccoloSynthOffline = new Tone.Sampler({
      urls: PICCOLO_SAMPLE_URLS,
      attack: 0.006,
      release: 0.34,
      baseUrl: "/samples/piccolo/",
    }).connect(piccoloBus);
    const supportingPianoSynthOffline = new Tone.Sampler({
      urls: SUPPORTING_PIANO_SAMPLE_URLS,
      release: 1.1,
      baseUrl: "/samples/supporting_piano/",
    }).connect(supportingPianoBus);
    const chicagoStreetSynthOffline = new Tone.Sampler({
      urls: CHICAGO_STREET_SAMPLE_URLS,
      attack: 0.008,
      release: 0.42,
      baseUrl: "/samples/chicago_street/",
    }).connect(chicagoStreetBus);
    const studioAltoSaxSynthOffline = new Tone.Sampler({
      urls: STUDIO_ALTO_SAX_SAMPLE_URLS,
      attack: 0.008,
      release: 0.3,
      baseUrl: "/samples/studio_alto_sax/",
    }).connect(studioAltoSaxBus);

    const drumSamplerOffline = createDrumSampler();
    const bassSamplerOffline = createBassSampler();

    await Tone.loaded();

    const busVolumes = getInstrumentBusVolumes(volumes, extraTracks);
    const melodyDb = volumeToDb(busVolumes.melody);
    const violinDb = volumeToDb(busVolumes.violin);
    const saxophoneDb = volumeToDb(busVolumes.saxophone);
    const guitarDb = volumeToDb(busVolumes.guitar);
    const drumsDb = volumeToDb(busVolumes.drums);
    const bassDb = volumeToDb(busVolumes.bass);

    melodySynth.volume.value = melodyDb;
    violinSynthOffline.volume.value = violinDb;
    saxophoneSynthOffline.volume.value = saxophoneDb;
    guitarSynth.volume.value = guitarDb;
    drumSamplerOffline.volume.value = drumsDb;
    bassSamplerOffline.volume.value = bassDb;
    glockenspielSynthOffline.volume.value = volumeToDb(busVolumes.glockenspiel);
    piccoloSynthOffline.volume.value = volumeToDb(busVolumes.piccolo);
    supportingPianoSynthOffline.volume.value = volumeToDb(busVolumes.supportingPiano);
    chicagoStreetSynthOffline.volume.value = volumeToDb(busVolumes.chicagoStreet);
    studioAltoSaxSynthOffline.volume.value = volumeToDb(busVolumes.studioAltoSax);

    transport.bpm.value = bpm;
    const melodyVelocityScale = getVolumeScale(volumes.melody, busVolumes.melody);
    const violinVelocityScale = getVolumeScale(volumes.violin, busVolumes.violin);
    const saxophoneVelocityScale = getVolumeScale(volumes.saxophone, busVolumes.saxophone);
    const guitarVelocityScale = getVolumeScale(volumes.guitar, busVolumes.guitar);
    const drumsVelocityScale = getVolumeScale(volumes.drums, busVolumes.drums);
    const bassVelocityScale = getVolumeScale(volumes.bass, busVolumes.bass);

    for (let col = 0; col < steps; col += 1) {
      const time = col * sixteenthSeconds;

      for (let row = 0; row < melody.length; row += 1) {
        if (!melody[row]?.[col]) continue;
        const note = getMelodyPlaybackNote(row);
        const durationSteps = Math.max(1, melodyLengths[row]?.[col] ?? 1);
        const expressiveVelocity = melodyVelocities?.[row]?.[col] || 0;
        melodySynth.triggerAttackRelease(
          note,
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          getMelodyVelocity(row, durationSteps) * melodyVelocityScale * (expressiveVelocity || 0.82)
        );
      }

      for (let row = 0; row < Math.min(violin.length, VIOLIN_NOTES.length); row += 1) {
        if (!violin[row]?.[col]) continue;
        const durationSteps = Math.max(1, violinLengths[row]?.[col] ?? 1);
        violinSynthOffline.triggerAttackRelease(
          getViolinPlaybackNote(row),
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          0.86 * violinVelocityScale
        );
      }

      for (let row = 0; row < Math.min(saxophone.length, SAXOPHONE_NOTES.length); row += 1) {
        if (!saxophone[row]?.[col]) continue;
        const durationSteps = Math.max(1, saxophoneLengths[row]?.[col] ?? 1);
        saxophoneSynthOffline.triggerAttackRelease(
          getSaxophonePlaybackNote(row),
          getMelodyGateSeconds(durationSteps, bpm),
          time,
          0.78 * saxophoneVelocityScale
        );
      }

      for (let row = 0; row < guitar.length; row += 1) {
        if (!guitar[row]?.[col]) continue;
        const durationSteps = Math.max(1, guitarLengths[row]?.[col] ?? 1);
        guitarSynth.triggerAttackRelease(getGuitarPlaybackNote(row), getMelodyGateSeconds(durationSteps, bpm), time, guitarVelocityScale);
      }

      for (let row = 0; row < bass.length; row += 1) {
        if (!bass[row]?.[col]) continue;
        const midi = BASS_MIDI[row] ?? BASS_MIDI[BASS_MIDI.length - 1];
        const note = toSamplerNote(Tone.Frequency(midi, "midi").toNote());
        const durationSteps = Math.max(1, bassLengths[row]?.[col] ?? 1);
        bassSamplerOffline.triggerAttackRelease(note, getMelodyGateSeconds(durationSteps, bpm), time, bassVelocityScale);
      }

      for (let row = 0; row < drums.length; row += 1) {
        if (!drums[row]?.[col]) continue;
        drumSamplerOffline.triggerAttackRelease(
          getDrumSampleNote(row),
          getDrumSampleDuration(row),
          time,
          drumsVelocityScale
        );
      }

      extraTracks.forEach((track) => {
        const velocityScale = getVolumeScale(track.volume, busVolumes[track.instrument]);
        if (velocityScale <= 0) {
          return;
        }

        track.grid.forEach((rowArr, row) => {
          if (!rowArr[col]) {
            return;
          }

          switch (track.instrument) {
            case "melody": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              melodySynth.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                getMelodyVelocity(row, durationSteps) * velocityScale
              );
              break;
            }
            case "violin": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              violinSynthOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                0.86 * velocityScale
              );
              break;
            }
            case "saxophone": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              saxophoneSynthOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                0.78 * velocityScale
              );
              break;
            }
            case "guitar": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              guitarSynth.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                velocityScale
              );
              break;
            }
            case "bass": {
              const durationSteps = Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1);
              bassSamplerOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(durationSteps, bpm),
                time,
                velocityScale
              );
              break;
            }
            case "drums":
              drumSamplerOffline.triggerAttackRelease(
                getDrumSampleNote(row),
                getDrumSampleDuration(row),
                time,
                velocityScale
              );
              break;
            case "glockenspiel":
              glockenspielSynthOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1), bpm),
                time,
                SAMPLED_INSTRUMENT_VELOCITY[track.instrument] * velocityScale
              );
              break;
            case "piccolo":
              piccoloSynthOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1), bpm),
                time,
                SAMPLED_INSTRUMENT_VELOCITY[track.instrument] * velocityScale
              );
              break;
            case "supportingPiano":
              supportingPianoSynthOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1), bpm),
                time,
                SAMPLED_INSTRUMENT_VELOCITY[track.instrument] * velocityScale
              );
              break;
            case "chicagoStreet":
              chicagoStreetSynthOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1), bpm),
                time,
                SAMPLED_INSTRUMENT_VELOCITY[track.instrument] * velocityScale
              );
              break;
            case "studioAltoSax":
              studioAltoSaxSynthOffline.triggerAttackRelease(
                getExtraTrackNote(track.instrument, row),
                getMelodyGateSeconds(Math.max(1, track.melodyLengths?.[row]?.[col] ?? 1), bpm),
                time,
                SAMPLED_INSTRUMENT_VELOCITY[track.instrument] * velocityScale
              );
              break;
            default:
              break;
          }
        });
      });
    }

    transport.start(0);
  }, durationSeconds);

  const buffer = rendered.get();
  if (!buffer) {
    throw new Error("Failed to render audio buffer");
  }

  return buffer;
}

export async function exportSongAsMp3(): Promise<Blob> {
  const buffer = await renderSongBuffer();
  return audioBufferToMp3(buffer);
}

export async function exportSongAsWav(): Promise<Blob> {
  const buffer = await renderSongBuffer();
  return audioBufferToWav(buffer);
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const blockAlign = channels * (bitDepth / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = buffer.length * blockAlign;
  const wavBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(wavBuffer);

  writeAsciiString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, "WAVE");
  writeAsciiString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeAsciiString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channels; channelIndex += 1) {
      const sample = buffer.getChannelData(channelIndex)[sampleIndex] ?? 0;
      const value = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([wavBuffer], { type: "audio/wav" });
}

function audioBufferToMp3(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const Mp3Encoder = getLame()?.Mp3Encoder;
  if (!Mp3Encoder) {
    throw new Error("Mp3Encoder is not available");
  }
  const encoder: Mp3EncoderInstance = new Mp3Encoder(
    numChannels,
    sampleRate,
    128
  );
  const blockSize = 1152;
  const mp3Chunks: BlobPart[] = [];

  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch += 1) {
    channelData.push(buffer.getChannelData(ch));
  }

  const length = buffer.length;
  for (let i = 0; i < length; i += blockSize) {
    const left = floatToInt16(channelData[0].subarray(i, i + blockSize));
    let mp3buf: Int8Array | Uint8Array | number[];

    if (numChannels === 1) {
      mp3buf = encoder.encodeBuffer(left);
    } else {
      const right = floatToInt16(channelData[1].subarray(i, i + blockSize));
      mp3buf = encoder.encodeBuffer(left, right);
    }

    if (mp3buf.length > 0) {
      mp3Chunks.push(toArrayBuffer(mp3buf));
    }
  }

  const end = encoder.flush();
  if (end.length > 0) {
    mp3Chunks.push(toArrayBuffer(end));
  }

  return new Blob(mp3Chunks, { type: "audio/mpeg" });
}

function floatToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

function writeAsciiString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function getOrigin(): string {
  const { protocol, hostname, port } = window.location;
  const host = port ? `${hostname}:${port}` : hostname;
  return `${protocol}//${host}`;
}

function toArrayBuffer(data: Int8Array | Uint8Array | number[]): ArrayBuffer {
  const u8 =
    data instanceof Uint8Array
      ? data
      : data instanceof Int8Array
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
  return u8.buffer.slice(
    u8.byteOffset,
    u8.byteOffset + u8.byteLength
  ) as ArrayBuffer;
}

type Mp3EncoderInstance = {
  encodeBuffer: (
    left: Int16Array,
    right?: Int16Array
  ) => Int8Array | Uint8Array | number[];
  flush: () => Int8Array | Uint8Array | number[];
};

type Mp3EncoderCtor = new (
  channels: number,
  sampleRate: number,
  kbps: number
) => Mp3EncoderInstance;

function getLame(): { Mp3Encoder: Mp3EncoderCtor } | null {
  const anyWindow = window as unknown as { lamejs?: { Mp3Encoder?: unknown } };
  if (anyWindow.lamejs && anyWindow.lamejs.Mp3Encoder) {
    return anyWindow.lamejs as {
      Mp3Encoder: Mp3EncoderCtor;
    };
  }
  return null;
}

function loadLame(): Promise<void> {
  if (getLame()) return Promise.resolve();
  if (lameLoadPromise) return lameLoadPromise;
  const baseUrl = import.meta.env.BASE_URL ?? "/";
  const base = new URL(baseUrl, getOrigin());
  const scriptUrl = new URL("vendor/lame.min.js", base).toString();
  lameLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${scriptUrl}`));
    document.head.appendChild(script);
  });
  return lameLoadPromise;
}

export async function playBassPreview(row: number, durationSteps = 1): Promise<void> {
  await ensureToneReady();
  const state = useSongStore.getState();
  applyLiveVolumes(state.volumes, state.extraTracks);
  const midi = BASS_MIDI[row] ?? BASS_MIDI[BASS_MIDI.length - 1];
  const note = toSamplerNote(Tone.Frequency(midi, "midi").toNote());
  bassSampler.triggerAttackRelease(note, getMelodyGateSeconds(durationSteps, state.bpm));
}
