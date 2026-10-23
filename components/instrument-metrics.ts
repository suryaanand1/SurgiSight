import type { InstrumentTrack } from "./instrument-tracking";

export type InstrumentMetricState = {
  totalFrames: number;
  validFrames: number;
  pathLength: number;
  lastCenter: { x: number; y: number } | null;
  lastTimestamp: number | null;
  segmentId: number;
  samples: InstrumentSample[];
};

export type InstrumentKeyMoment = {
  timestampSeconds: number;
  startSeconds: number;
  endSeconds: number;
};

export type InstrumentResults = {
  instrumentPathLength: number;
  instrumentCoverage: number;
  largestInstrumentExcursion: InstrumentKeyMoment | null;
  longestInstrumentPause: InstrumentKeyMoment | null;
};

const MAX_CONTINUOUS_GAP_SECONDS = 0.2;
const EXCURSION_WINDOW_SECONDS = 0.8;
const MIN_EXCURSION_SPAN_SECONDS = 0.25;
const MIN_MEANINGFUL_EXCURSION_FW = 0.025;
const PAUSE_RADIUS_FW = 0.012;
const MIN_PAUSE_SECONDS = 0.5;

type InstrumentSample = {
  timestamp: number;
  x: number;
  y: number;
  segmentId: number;
};

export function createInstrumentMetricState(): InstrumentMetricState {
  return { totalFrames: 0, validFrames: 0, pathLength: 0, lastCenter: null, lastTimestamp: null, segmentId: 0, samples: [] };
}

export function addInstrumentFrame(
  state: InstrumentMetricState,
  track: InstrumentTrack | null,
  timestampSeconds: number,
  videoWidth: number,
  videoHeight: number,
) {
  state.totalFrames += 1;
  if (!track) {
    if (state.lastCenter) state.segmentId += 1;
    state.lastCenter = null;
    state.lastTimestamp = null;
    return;
  }

  state.validFrames += 1;
  const verticalScale = videoWidth > 0 ? videoHeight / videoWidth : 1;
  if (state.lastCenter && state.lastTimestamp !== null) {
    const elapsed = timestampSeconds - state.lastTimestamp;
    if (elapsed > 0 && elapsed <= MAX_CONTINUOUS_GAP_SECONDS) {
      const dx = track.center.x - state.lastCenter.x;
      const dy = (track.center.y - state.lastCenter.y) * verticalScale;
      state.pathLength += Math.hypot(dx, dy);
    } else {
      state.segmentId += 1;
    }
  }
  state.samples.push({ timestamp: timestampSeconds, x: track.center.x, y: track.center.y * verticalScale, segmentId: state.segmentId });
  state.lastCenter = track.center;
  state.lastTimestamp = timestampSeconds;
}

function median(values: number[]) {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

function denoiseSamples(samples: InstrumentSample[]) {
  return samples.map((sample, index) => {
    const neighbors = samples.slice(Math.max(0, index - 1), index + 2).filter((item) => item.segmentId === sample.segmentId);
    return { ...sample, x: median(neighbors.map((item) => item.x)), y: median(neighbors.map((item) => item.y)) };
  });
}

function findLargestExcursion(samples: InstrumentSample[]): InstrumentKeyMoment | null {
  let best: { start: InstrumentSample; end: InstrumentSample; distance: number } | null = null;
  for (let startIndex = 0; startIndex < samples.length; startIndex += 1) {
    const start = samples[startIndex];
    for (let endIndex = startIndex + 1; endIndex < samples.length; endIndex += 1) {
      const end = samples[endIndex];
      if (end.segmentId !== start.segmentId) break;
      const elapsed = end.timestamp - start.timestamp;
      if (elapsed > EXCURSION_WINDOW_SECONDS) break;
      if (elapsed < MIN_EXCURSION_SPAN_SECONDS || endIndex - startIndex < 3) continue;
      const distance = Math.hypot(end.x - start.x, end.y - start.y);
      if (!best || distance > best.distance) best = { start, end, distance };
    }
  }
  if (!best || best.distance < MIN_MEANINGFUL_EXCURSION_FW) return null;
  return {
    startSeconds: best.start.timestamp,
    endSeconds: best.end.timestamp,
    timestampSeconds: (best.start.timestamp + best.end.timestamp) / 2,
  };
}

function findLongestPause(samples: InstrumentSample[]): InstrumentKeyMoment | null {
  let best: { start: InstrumentSample; end: InstrumentSample; duration: number } | null = null;
  let startIndex = 0;
  for (let index = 1; index <= samples.length; index += 1) {
    const start = samples[startIndex];
    const current = samples[index];
    const continues = current && current.segmentId === start.segmentId && Math.hypot(current.x - start.x, current.y - start.y) <= PAUSE_RADIUS_FW;
    if (continues) continue;

    const end = samples[index - 1];
    const duration = end.timestamp - start.timestamp;
    if (duration >= MIN_PAUSE_SECONDS && (!best || duration > best.duration)) best = { start, end, duration };
    startIndex = index;
  }
  if (!best) return null;
  return {
    startSeconds: best.start.timestamp,
    endSeconds: best.end.timestamp,
    timestampSeconds: (best.start.timestamp + best.end.timestamp) / 2,
  };
}

export function finalizeInstrumentResults(state: InstrumentMetricState): InstrumentResults {
  const samples = denoiseSamples(state.samples);
  return {
    instrumentPathLength: state.pathLength,
    instrumentCoverage: state.totalFrames > 0 ? (state.validFrames / state.totalFrames) * 100 : 0,
    largestInstrumentExcursion: findLargestExcursion(samples),
    longestInstrumentPause: findLongestPause(samples),
  };
}
