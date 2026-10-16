export const TIME_SIGNATURE_BEAT_TYPES = [2, 4, 8, 16] as const;

export type TimeSignatureBeatType = (typeof TIME_SIGNATURE_BEAT_TYPES)[number];

export type TimeSignature = {
  beats: number;
  beatType: TimeSignatureBeatType;
};

export type TimeSignatureChange = TimeSignature & {
  bar: number;
};

export type BarInfo = {
  index: number;
  start: number;
  end: number;
  length: number;
  offset: number;
  timeSignature: TimeSignature;
};

export const DEFAULT_TIME_SIGNATURE: TimeSignature = { beats: 4, beatType: 4 };

export function normalizeTimeSignature(value: unknown): TimeSignature {
  if (!value || typeof value !== 'object') return { ...DEFAULT_TIME_SIGNATURE };
  const candidate = value as Partial<TimeSignature>;
  const beats = Math.min(32, Math.max(1, Math.floor(Number(candidate.beats) || 4)));
  const beatType = TIME_SIGNATURE_BEAT_TYPES.includes(candidate.beatType as TimeSignatureBeatType)
    ? candidate.beatType as TimeSignatureBeatType
    : 4;
  return { beats, beatType };
}

export function getStepsPerBar(timeSignature: TimeSignature) {
  const normalized = normalizeTimeSignature(timeSignature);
  return normalized.beats * (16 / normalized.beatType);
}

export function formatTimeSignature(timeSignature: TimeSignature) {
  const normalized = normalizeTimeSignature(timeSignature);
  return `${normalized.beats}/${normalized.beatType}`;
}

export function getBeatSteps(timeSignature: TimeSignature) {
  return 16 / normalizeTimeSignature(timeSignature).beatType;
}

export function getPrimaryBeatSteps(timeSignature: TimeSignature) {
  const normalized = normalizeTimeSignature(timeSignature);
  const beatSteps = getBeatSteps(normalized);
  const isCompoundMeter =
    normalized.beatType === 8 && normalized.beats > 3 && normalized.beats % 3 === 0;
  return isCompoundMeter ? beatSteps * 3 : beatSteps;
}

export function normalizeTimeSignatureChanges(
  value: unknown,
  fallback: TimeSignature = DEFAULT_TIME_SIGNATURE,
  _totalSteps = Number.POSITIVE_INFINITY
): TimeSignatureChange[] {
  void _totalSteps;
  const initial = normalizeTimeSignature(fallback);
  const entries = Array.isArray(value) ? value : [];
  const byBar = new Map<number, TimeSignature>();

  entries.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const candidate = entry as Partial<TimeSignatureChange>;
    const legacyStep = Number((candidate as Partial<TimeSignatureChange> & { step?: number }).step);
    const rawBar = Number(candidate.bar);
    const bar = Number.isFinite(rawBar)
      ? Math.max(0, Math.floor(rawBar))
      : Number.isFinite(legacyStep)
        ? Math.max(0, Math.floor(legacyStep / getStepsPerBar(initial)))
        : Number.NaN;
    if (!Number.isFinite(bar)) return;
    byBar.set(bar, normalizeTimeSignature(candidate));
  });

  if (!byBar.has(0)) byBar.set(0, initial);

  return [...byBar.entries()]
    .sort(([left], [right]) => left - right)
    .map(([bar, timeSignature]) => ({ bar, ...timeSignature }))
    .filter((change, index, changes) => {
      if (index === 0) return true;
      const previous = changes[index - 1];
      return previous.beats !== change.beats || previous.beatType !== change.beatType;
    });
}

export function getTimeSignatureAtStep(
  changes: readonly TimeSignatureChange[] | undefined,
  fallback: TimeSignature,
  step: number
) {
  const normalized = normalizeTimeSignatureChanges(changes, fallback);
  return getBarInfoAtStep(normalized, fallback, step).timeSignature;
}

export function getBarInfoAtStep(
  changes: readonly TimeSignatureChange[] | undefined,
  fallback: TimeSignature,
  step: number
): BarInfo {
  const normalized = normalizeTimeSignatureChanges(changes, fallback);
  const target = Math.max(0, Math.floor(step));
  let index = 0;
  let start = 0;
  let changeIndex = 0;
  let timeSignature = normalizeTimeSignature(normalized[0] ?? fallback);

  while (start <= target) {
    while (changeIndex + 1 < normalized.length && normalized[changeIndex + 1].bar <= index) {
      changeIndex += 1;
      timeSignature = normalizeTimeSignature(normalized[changeIndex]);
    }
    const length = getStepsPerBar(timeSignature);
    const end = start + length;
    if (target < end) {
      return { index, start, end, length: end - start, offset: target - start, timeSignature };
    }
    start = end;
    index += 1;
  }

  const length = getStepsPerBar(timeSignature);
  return { index, start, end: start + length, length, offset: 0, timeSignature };
}

export function getBarInfoAtIndex(
  changes: readonly TimeSignatureChange[] | undefined,
  fallback: TimeSignature,
  barIndex: number
): BarInfo {
  const targetIndex = Math.max(0, Math.floor(barIndex));
  let info = getBarInfoAtStep(changes, fallback, 0);
  while (info.index < targetIndex) {
    info = getBarInfoAtStep(changes, fallback, info.end);
  }
  return info;
}

export function getBarCountForSteps(
  changes: readonly TimeSignatureChange[] | undefined,
  fallback: TimeSignature,
  steps: number
) {
  const total = Math.max(1, Math.floor(steps));
  return getBarInfoAtStep(changes, fallback, total - 1).index + 1;
}

export function upsertTimeSignatureChange(
  changes: readonly TimeSignatureChange[] | undefined,
  fallback: TimeSignature,
  step: number,
  timeSignature: TimeSignature,
  totalSteps = Number.POSITIVE_INFINITY
) {
  const bar = getBarInfoAtStep(changes, fallback, step);
  const next = normalizeTimeSignature(timeSignature);
  return normalizeTimeSignatureChanges(
    [
      ...normalizeTimeSignatureChanges(changes, fallback, totalSteps).filter(
        (change) => change.bar !== bar.index
      ),
      { bar: bar.index, ...next },
    ],
    next,
    totalSteps
  );
}

export function removeTimeSignatureChange(
  changes: readonly TimeSignatureChange[] | undefined,
  fallback: TimeSignature,
  step: number,
  totalSteps = Number.POSITIVE_INFINITY
) {
  const bar = getBarInfoAtStep(changes, fallback, step);
  if (bar.index === 0) return normalizeTimeSignatureChanges(changes, fallback, totalSteps);
  return normalizeTimeSignatureChanges(
    normalizeTimeSignatureChanges(changes, fallback, totalSteps).filter(
      (change) => change.bar !== bar.index
    ),
    fallback,
    totalSteps
  );
}
