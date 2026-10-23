import assert from "node:assert/strict";
import test from "node:test";
import { addTrackingFrame, createMotionMetricState, finalizeMotionResults } from "../components/motion-metrics.ts";

function hand(side, x, y) {
  return {
    id: side === "Left" ? 0 : 1,
    landmarks: [],
    visible: [],
    center: { x, y },
    velocity: { x: 0, y: 0 },
    handedness: side,
    handednessConfidence: 0.95,
    lastSeen: 0,
    matchedThisFrame: true,
  };
}

function analyze(step) {
  const state = createMotionMetricState();
  for (let frame = 0; frame < 20; frame += 1) {
    addTrackingFrame(state, [hand("Left", 0.2 + frame * step, 0.5), hand("Right", 0.8 - frame * step, 0.5)], frame / 30, 1280, 720);
  }
  return finalizeMotionResults(state, 20 / 30);
}

test("deliberately larger movements produce larger path lengths", () => {
  const small = analyze(0.002);
  const large = analyze(0.012);
  assert.ok(large.leftPathLength > small.leftPathLength);
  assert.ok(large.rightPathLength > small.rightPathLength);
});

test("reports completion time and keeps left and right paths separate", () => {
  const state = createMotionMetricState();
  addTrackingFrame(state, [hand("Left", 0.1, 0.3), hand("Right", 0.8, 0.5)], 0, 1000, 500);
  addTrackingFrame(state, [hand("Left", 0.3, 0.3), hand("Right", 0.8, 0.5)], 1 / 30, 1000, 500);
  const results = finalizeMotionResults(state, 7.25);
  assert.equal(results.completionTimeSeconds, 7.25);
  assert.ok(Math.abs(results.leftPathLength - 0.2) < 1e-9);
  assert.equal(results.rightPathLength, 0);
});

test("does not bridge a missing tracking frame", () => {
  const state = createMotionMetricState();
  addTrackingFrame(state, [hand("Left", 0.1, 0.5)], 0, 1000, 500);
  addTrackingFrame(state, [], 1 / 30, 1000, 500);
  addTrackingFrame(state, [hand("Left", 0.9, 0.5)], 2 / 30, 1000, 500);
  const results = finalizeMotionResults(state, 1);
  assert.equal(results.leftPathLength, 0);
  assert.ok(Math.abs(results.leftCoverage - 66.66666666666666) < 1e-9);
});

test("does not bridge a long timestamp gap even when both endpoint frames are tracked", () => {
  const state = createMotionMetricState();
  addTrackingFrame(state, [hand("Right", 0.1, 0.5)], 0, 1920, 1080);
  addTrackingFrame(state, [hand("Right", 0.9, 0.5)], 0.5, 1920, 1080);
  assert.equal(finalizeMotionResults(state, 0.5).rightPathLength, 0);
});

test("vertical image distance is corrected for frame aspect ratio", () => {
  const state = createMotionMetricState();
  addTrackingFrame(state, [hand("Left", 0.5, 0)], 0, 1920, 1080);
  addTrackingFrame(state, [hand("Left", 0.5, 1)], 1 / 30, 1920, 1080);
  const results = finalizeMotionResults(state, 1);
  assert.ok(Math.abs(results.leftPathLength - 1080 / 1920) < 1e-9);
});
