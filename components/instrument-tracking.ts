export const INSTRUMENT_TRACK_MEMORY_MS = 600;

export type MarkerColor = "red" | "orange" | "green" | "blue" | "magenta";

export const MARKER_COLORS: ReadonlyArray<{ id: MarkerColor; label: string; swatch: string }> = [
  { id: "red", label: "Red", swatch: "#ef4444" },
  { id: "orange", label: "Orange", swatch: "#f97316" },
  { id: "green", label: "Green", swatch: "#22c55e" },
  { id: "blue", label: "Blue", swatch: "#3b82f6" },
  { id: "magenta", label: "Pink / Magenta", swatch: "#ec4899" },
];

export type InstrumentBox = { x: number; y: number; width: number; height: number };

export type InstrumentTrack = {
  center: { x: number; y: number };
  box: InstrumentBox;
  confidence: number;
  lastSeen: number;
};

export type InstrumentTrackingState = {
  track: InstrumentTrack | null;
};

export type InstrumentTrackingFrame = {
  state: InstrumentTrackingState;
  track: InstrumentTrack | null;
  remembered: boolean;
  rejected: boolean;
};

type Candidate = Omit<InstrumentTrack, "lastSeen"> & { pixelCount: number };

const MIN_CONFIDENCE = 0.48;
const MAX_REACQUIRE_DISTANCE = 0.3;
const SMOOTHING_ALPHA = 0.45;

export function createInstrumentTrackingState(): InstrumentTrackingState {
  return { track: null };
}

function rgbToHsv(r: number, g: number, b: number) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta > 0) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  if (hue < 0) hue += 360;
  return { hue, saturation: maximum === 0 ? 0 : delta / maximum, value: maximum };
}

function isMarkerPixel(r: number, g: number, b: number, markerColor: MarkerColor) {
  const { hue, saturation, value } = rgbToHsv(r, g, b);
  if (saturation < 0.55 || value < 0.45) return false;

  if (markerColor === "red") return hue >= 345 || hue <= 15;
  if (markerColor === "orange") return hue >= 16 && hue <= 48;
  if (markerColor === "green") return hue >= 75 && hue <= 165;
  if (markerColor === "blue") return hue >= 185 && hue <= 255;
  return hue >= 285 && hue <= 340;
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function detectCandidates(data: Uint8ClampedArray, width: number, height: number, markerColor: MarkerColor): Candidate[] {
  const size = width * height;
  const mask = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    const offset = index * 4;
    if (isMarkerPixel(data[offset], data[offset + 1], data[offset + 2], markerColor)) mask[index] = 1;
  }

  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  const candidates: Candidate[] = [];
  const minimumPixels = Math.max(6, Math.round(size * 0.00008));

  for (let seed = 0; seed < size; seed += 1) {
    if (!mask[seed] || visited[seed]) continue;
    let head = 0;
    let tail = 1;
    queue[0] = seed;
    visited[seed] = 1;
    let pixelCount = 0;
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let sumX = 0;
    let sumY = 0;

    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);
      pixelCount += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      const neighbors = [current - 1, current + 1, current - width, current + width];
      for (const neighbor of neighbors) {
        if (neighbor < 0 || neighbor >= size || visited[neighbor] || !mask[neighbor]) continue;
        const neighborX = neighbor % width;
        if (Math.abs(neighborX - x) > 1) continue;
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }

    if (pixelCount < minimumPixels) continue;
    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const compactness = pixelCount / (boxWidth * boxHeight);
    const sizeScore = Math.min(pixelCount / Math.max(minimumPixels * 3, 24), 1);
    const confidence = sizeScore * 0.55 + compactness * 0.45;
    if (confidence < MIN_CONFIDENCE) continue;

    const padding = 0.012;
    candidates.push({
      center: { x: sumX / pixelCount / width, y: sumY / pixelCount / height },
      box: {
        x: Math.max(0, minX / width - padding),
        y: Math.max(0, minY / height - padding),
        width: Math.min(1, boxWidth / width + padding * 2),
        height: Math.min(1, boxHeight / height + padding * 2),
      },
      confidence,
      pixelCount,
    });
  }

  return candidates;
}

function smooth(previous: InstrumentTrack, current: Candidate, now: number): InstrumentTrack {
  const alpha = SMOOTHING_ALPHA;
  return {
    center: {
      x: previous.center.x + (current.center.x - previous.center.x) * alpha,
      y: previous.center.y + (current.center.y - previous.center.y) * alpha,
    },
    box: {
      x: previous.box.x + (current.box.x - previous.box.x) * alpha,
      y: previous.box.y + (current.box.y - previous.box.y) * alpha,
      width: previous.box.width + (current.box.width - previous.box.width) * alpha,
      height: previous.box.height + (current.box.height - previous.box.height) * alpha,
    },
    confidence: current.confidence,
    lastSeen: now,
  };
}

export function updateInstrumentTrack(
  previous: InstrumentTrackingState,
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  now: number,
  markerColor: MarkerColor = "magenta",
): InstrumentTrackingFrame {
  const candidates = detectCandidates(imageData.data, imageData.width, imageData.height, markerColor);
  const prior = previous.track && now - previous.track.lastSeen <= INSTRUMENT_TRACK_MEMORY_MS ? previous.track : null;
  let selected: Candidate | null = null;

  if (prior) {
    selected = candidates
      .map((candidate) => ({ candidate, distance: distance(candidate.center, prior.center) }))
      .filter((item) => item.distance <= MAX_REACQUIRE_DISTANCE)
      .sort((a, b) => a.distance - b.distance)[0]?.candidate ?? null;
  } else {
    selected = candidates.sort((a, b) => b.pixelCount - a.pixelCount)[0] ?? null;
  }

  if (!selected) {
    return {
      state: { track: prior },
      track: null,
      remembered: Boolean(prior),
      rejected: candidates.length > 0,
    };
  }

  const track = prior
    ? smooth(prior, selected, now)
    : { center: selected.center, box: selected.box, confidence: selected.confidence, lastSeen: now };
  return { state: { track }, track, remembered: false, rejected: false };
}
