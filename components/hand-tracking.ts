import type { Category, HandLandmarkerResult, NormalizedLandmark } from "@mediapipe/tasks-vision";

export const MAX_HANDS = 2;
export const TRACK_MEMORY_MS = 650;
export const LANDMARK_VISIBILITY_THRESHOLD = 0.5;

const PALM_INDICES = [0, 5, 9, 13, 17];
const MAX_MATCH_COST = 0.62;

type Point = Pick<NormalizedLandmark, "x" | "y" | "z" | "visibility">;

export type TrackedHand = {
  id: 0 | 1;
  landmarks: Point[];
  visible: boolean[];
  center: { x: number; y: number };
  velocity: { x: number; y: number };
  handedness?: string;
  handednessConfidence: number;
  lastSeen: number;
  matchedThisFrame: boolean;
};

type Candidate = {
  landmarks: Point[];
  visible: boolean[];
  center: { x: number; y: number };
  handedness?: string;
  handednessConfidence: number;
};

export type TrackingFrame = {
  hands: TrackedHand[];
  tracks: TrackedHand[];
  detectedCount: number;
  rejectedCount: number;
  rememberedCount: number;
};

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function landmarkVisibility(landmarks: Point[]) {
  // Hand Landmarker usually omits visibility. If a model build supplies it,
  // reject only those individual points whose visibility is genuinely low.
  const hasVisibility = landmarks.some((point) => typeof point.visibility === "number" && point.visibility > 0);
  return landmarks.map((point) => !hasVisibility || (point.visibility ?? 0) >= LANDMARK_VISIBILITY_THRESHOLD);
}

function palmCenter(landmarks: Point[], visible: boolean[]) {
  const points = PALM_INDICES.filter((index) => visible[index]).map((index) => landmarks[index]);
  if (points.length < 3) return null;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function handednessFor(result: HandLandmarkerResult, index: number): Category | undefined {
  return result.handednesses?.[index]?.[0];
}

function candidatesFrom(result: HandLandmarkerResult) {
  let rejectedCount = 0;
  const candidates: Candidate[] = [];

  result.landmarks.slice(0, MAX_HANDS).forEach((landmarks, index) => {
    const visible = landmarkVisibility(landmarks);
    const center = palmCenter(landmarks, visible);
    const visibleCount = visible.filter(Boolean).length;
    if (!center || visibleCount < 15) {
      rejectedCount += 1;
      return;
    }
    const handedness = handednessFor(result, index);
    candidates.push({
      landmarks,
      visible,
      center,
      handedness: handedness?.categoryName,
      handednessConfidence: handedness?.score ?? 0,
    });
  });

  return { candidates, rejectedCount };
}

function predictedCenter(track: TrackedHand, now: number) {
  const frameSteps = Math.min(Math.max((now - track.lastSeen) / 33, 0), 3);
  return {
    x: track.center.x + track.velocity.x * frameSteps,
    y: track.center.y + track.velocity.y * frameSteps,
  };
}

function matchCost(track: TrackedHand, candidate: Candidate, now: number) {
  let cost = distance(predictedCenter(track, now), candidate.center);
  const bothLabelsConfident = track.handednessConfidence >= 0.75 && candidate.handednessConfidence >= 0.75;
  if (bothLabelsConfident && track.handedness && candidate.handedness) {
    cost += track.handedness === candidate.handedness ? -0.08 : 0.38;
  }
  return cost;
}

function chooseMatches(active: TrackedHand[], candidates: Candidate[], now: number) {
  type Choice = { candidateIndex: number; trackIndex: number; cost: number };
  const choices: Choice[] = [];
  active.forEach((track, trackIndex) => {
    candidates.forEach((candidate, candidateIndex) => {
      const cost = matchCost(track, candidate, now);
      if (cost <= MAX_MATCH_COST) choices.push({ candidateIndex, trackIndex, cost });
    });
  });

  if (active.length === 2 && candidates.length === 2) {
    const direct = [matchCost(active[0], candidates[0], now), matchCost(active[1], candidates[1], now)];
    const crossed = [matchCost(active[0], candidates[1], now), matchCost(active[1], candidates[0], now)];
    const directValid = direct.every((cost) => cost <= MAX_MATCH_COST);
    const crossedValid = crossed.every((cost) => cost <= MAX_MATCH_COST);
    if (directValid || crossedValid) {
      const useCrossed = crossedValid && (!directValid || crossed[0] + crossed[1] < direct[0] + direct[1]);
      const matches = useCrossed
        ? [{ candidateIndex: 1, trackIndex: 0, cost: crossed[0] }, { candidateIndex: 0, trackIndex: 1, cost: crossed[1] }]
        : [{ candidateIndex: 0, trackIndex: 0, cost: direct[0] }, { candidateIndex: 1, trackIndex: 1, cost: direct[1] }];
      return { matches, usedCandidates: new Set([0, 1]), usedTracks: new Set([0, 1]) };
    }
  }
  choices.sort((a, b) => a.cost - b.cost);

  const usedCandidates = new Set<number>();
  const usedTracks = new Set<number>();
  const matches: Choice[] = [];
  for (const choice of choices) {
    if (!usedCandidates.has(choice.candidateIndex) && !usedTracks.has(choice.trackIndex)) {
      usedCandidates.add(choice.candidateIndex);
      usedTracks.add(choice.trackIndex);
      matches.push(choice);
    }
  }
  return { matches, usedCandidates, usedTracks };
}

function updateTrack(track: TrackedHand, candidate: Candidate, now: number): TrackedHand {
  const movement = distance(track.center, candidate.center);
  const alpha = Math.min(0.68, Math.max(0.28, 0.28 + movement * 1.8));
  const elapsedFrames = Math.max((now - track.lastSeen) / 33, 1);
  const measuredVelocity = {
    x: (candidate.center.x - track.center.x) / elapsedFrames,
    y: (candidate.center.y - track.center.y) / elapsedFrames,
  };

  return {
    ...track,
    landmarks: candidate.landmarks.map((point, index) => {
      if (!candidate.visible[index] || !track.visible[index]) return point;
      const previous = track.landmarks[index];
      return {
        x: previous.x + (point.x - previous.x) * alpha,
        y: previous.y + (point.y - previous.y) * alpha,
        z: (previous.z ?? 0) + ((point.z ?? 0) - (previous.z ?? 0)) * alpha,
        visibility: point.visibility,
      };
    }),
    visible: candidate.visible,
    center: {
      x: track.center.x + (candidate.center.x - track.center.x) * alpha,
      y: track.center.y + (candidate.center.y - track.center.y) * alpha,
    },
    velocity: {
      x: track.velocity.x * 0.45 + measuredVelocity.x * 0.55,
      y: track.velocity.y * 0.45 + measuredVelocity.y * 0.55,
    },
    handedness: candidate.handednessConfidence >= 0.75 ? candidate.handedness : track.handedness,
    handednessConfidence: candidate.handednessConfidence >= 0.75 ? candidate.handednessConfidence : track.handednessConfidence * 0.98,
    lastSeen: now,
    matchedThisFrame: true,
  };
}

function newTrack(id: 0 | 1, candidate: Candidate, now: number): TrackedHand {
  return {
    id,
    landmarks: candidate.landmarks,
    visible: candidate.visible,
    center: candidate.center,
    velocity: { x: 0, y: 0 },
    handedness: candidate.handedness,
    handednessConfidence: candidate.handednessConfidence,
    lastSeen: now,
    matchedThisFrame: true,
  };
}

export function updateHandTracks(previous: TrackedHand[], result: HandLandmarkerResult, now: number): TrackingFrame {
  const { candidates, rejectedCount } = candidatesFrom(result);
  const remembered = previous
    .filter((track) => now - track.lastSeen <= TRACK_MEMORY_MS)
    .map((track) => ({ ...track, matchedThisFrame: false }));
  const { matches, usedCandidates, usedTracks } = chooseMatches(remembered, candidates, now);

  const next = remembered.map((track, index) => {
    const match = matches.find((choice) => choice.trackIndex === index);
    return match ? updateTrack(track, candidates[match.candidateIndex], now) : track;
  });

  candidates.forEach((candidate, candidateIndex) => {
    if (usedCandidates.has(candidateIndex)) return;
    const availableId = ([0, 1] as const).find((id) => !next.some((track) => track.id === id));
    if (availableId !== undefined) next.push(newTrack(availableId, candidate, now));
  });

  const currentHands = next.filter((track) => track.matchedThisFrame).sort((a, b) => a.id - b.id);
  return {
    hands: currentHands,
    tracks: next.sort((a, b) => a.id - b.id),
    detectedCount: currentHands.length,
    rejectedCount,
    rememberedCount: next.length - currentHands.length,
  };
}
