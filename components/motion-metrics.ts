import type { TrackedHand } from "./hand-tracking";

export type HandSide = "Left" | "Right";

type Point = { x: number; y: number };

type HandMetricState = {
  pathLength: number;
  validFrames: number;
  lastPoint: Point | null;
  lastTimestamp: number | null;
};

export type MotionMetricState = {
  totalFrames: number;
  hands: Record<HandSide, HandMetricState>;
};

export type MotionResults = {
  completionTimeSeconds: number;
  leftPathLength: number;
  rightPathLength: number;
  leftCoverage: number;
  rightCoverage: number;
};

const MAX_CONTINUOUS_GAP_SECONDS = 0.2;

function emptyHandMetric(): HandMetricState {
  return { pathLength: 0, validFrames: 0, lastPoint: null, lastTimestamp: null };
}

export function createMotionMetricState(): MotionMetricState {
  return {
    totalFrames: 0,
    hands: { Left: emptyHandMetric(), Right: emptyHandMetric() },
  };
}

function sideFor(hand: TrackedHand): HandSide | null {
  return hand.handedness === "Left" || hand.handedness === "Right" ? hand.handedness : null;
}

export function addTrackingFrame(
  state: MotionMetricState,
  hands: TrackedHand[],
  timestampSeconds: number,
  videoWidth: number,
  videoHeight: number,
) {
  state.totalFrames += 1;
  const observed = new Set<HandSide>();
  const verticalScale = videoWidth > 0 ? videoHeight / videoWidth : 1;

  hands.forEach((hand) => {
    const side = sideFor(hand);
    if (!side || observed.has(side)) return;
    observed.add(side);
    const metric = state.hands[side];
    metric.validFrames += 1;

    if (metric.lastPoint && metric.lastTimestamp !== null) {
      const elapsed = timestampSeconds - metric.lastTimestamp;
      if (elapsed > 0 && elapsed <= MAX_CONTINUOUS_GAP_SECONDS) {
        const dx = hand.center.x - metric.lastPoint.x;
        const dy = (hand.center.y - metric.lastPoint.y) * verticalScale;
        metric.pathLength += Math.hypot(dx, dy);
      }
    }
    metric.lastPoint = hand.center;
    metric.lastTimestamp = timestampSeconds;
  });

  (["Left", "Right"] as const).forEach((side) => {
    if (!observed.has(side)) {
      state.hands[side].lastPoint = null;
      state.hands[side].lastTimestamp = null;
    }
  });
}

function coverage(validFrames: number, totalFrames: number) {
  return totalFrames > 0 ? (validFrames / totalFrames) * 100 : 0;
}

export function finalizeMotionResults(state: MotionMetricState, completionTimeSeconds: number): MotionResults {
  return {
    completionTimeSeconds: Math.max(0, completionTimeSeconds),
    leftPathLength: state.hands.Left.pathLength,
    rightPathLength: state.hands.Right.pathLength,
    leftCoverage: coverage(state.hands.Left.validFrames, state.totalFrames),
    rightCoverage: coverage(state.hands.Right.validFrames, state.totalFrames),
  };
}
