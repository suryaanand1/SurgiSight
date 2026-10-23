import assert from "node:assert/strict";
import test from "node:test";
import { createInstrumentTrackingState, updateInstrumentTrack } from "../components/instrument-tracking.ts";
import { addInstrumentFrame, createInstrumentMetricState, finalizeInstrumentResults } from "../components/instrument-metrics.ts";

const markerRgb = {
  red: [235, 25, 35],
  orange: [245, 115, 20],
  green: [30, 220, 80],
  blue: [35, 105, 235],
  magenta: [235, 35, 195],
};

function frame(width, height, boxes = [], color = "magenta") {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 35;
    data[index * 4 + 1] = 45;
    data[index * 4 + 2] = 50;
    data[index * 4 + 3] = 255;
  }
  boxes.forEach(({ x, y, width: boxWidth, height: boxHeight }) => {
    for (let py = y; py < y + boxHeight; py += 1) {
      for (let px = x; px < x + boxWidth; px += 1) {
        const offset = (py * width + px) * 4;
        data[offset] = markerRgb[color][0];
        data[offset + 1] = markerRgb[color][1];
        data[offset + 2] = markerRgb[color][2];
      }
    }
  });
  return { data, width, height };
}

function runMovement(step) {
  let tracking = createInstrumentTrackingState();
  const metrics = createInstrumentMetricState();
  for (let index = 0; index < 20; index += 1) {
    const result = updateInstrumentTrack(tracking, frame(200, 120, [{ x: 20 + index * step, y: 50, width: 10, height: 8 }]), index * 33);
    tracking = result.state;
    addInstrumentFrame(metrics, result.track, index / 30, 200, 120);
  }
  return finalizeInstrumentResults(metrics);
}

test("tracks a magenta needle-holder marker with a box and center", () => {
  const result = updateInstrumentTrack(createInstrumentTrackingState(), frame(200, 120, [{ x: 40, y: 30, width: 12, height: 8 }]), 0);
  assert.ok(result.track);
  assert.ok(Math.abs(result.track.center.x - 45.5 / 200) < 0.01);
  assert.ok(result.track.box.width > 0);
});

test("tracks a green marker when green is selected", () => {
  const result = updateInstrumentTrack(createInstrumentTrackingState(), frame(200, 120, [{ x: 40, y: 30, width: 12, height: 8 }], "green"), 0, "green");
  assert.ok(result.track);
});

test("tracks an orange marker when orange is selected", () => {
  const result = updateInstrumentTrack(createInstrumentTrackingState(), frame(200, 120, [{ x: 40, y: 30, width: 12, height: 8 }], "orange"), 0, "orange");
  assert.ok(result.track);
});

test("does not track a marker when a different color is selected", () => {
  const result = updateInstrumentTrack(createInstrumentTrackingState(), frame(200, 120, [{ x: 40, y: 30, width: 12, height: 8 }], "orange"), 0, "blue");
  assert.equal(result.track, null);
});

test("larger instrument motion produces a larger path length", () => {
  const small = runMovement(1);
  const large = runMovement(4);
  assert.ok(large.instrumentPathLength > small.instrumentPathLength * 2);
});

test("temporary occlusion preserves identity but draws no stale instrument", () => {
  const first = updateInstrumentTrack(createInstrumentTrackingState(), frame(200, 120, [{ x: 40, y: 40, width: 10, height: 8 }]), 0);
  const hidden = updateInstrumentTrack(first.state, frame(200, 120), 250);
  assert.equal(hidden.track, null);
  assert.equal(hidden.remembered, true);
  const recovered = updateInstrumentTrack(hidden.state, frame(200, 120, [{ x: 48, y: 40, width: 10, height: 8 }]), 500);
  assert.ok(recovered.track);
});

test("sustained loss expires the track", () => {
  const first = updateInstrumentTrack(createInstrumentTrackingState(), frame(200, 120, [{ x: 40, y: 40, width: 10, height: 8 }]), 0);
  const expired = updateInstrumentTrack(first.state, frame(200, 120), 700);
  assert.equal(expired.track, null);
  assert.equal(expired.state.track, null);
});

test("occlusion does not create an artificial path jump and lowers coverage", () => {
  let tracking = createInstrumentTrackingState();
  const metrics = createInstrumentMetricState();
  const visible = updateInstrumentTrack(tracking, frame(200, 120, [{ x: 20, y: 50, width: 10, height: 8 }]), 0);
  tracking = visible.state;
  addInstrumentFrame(metrics, visible.track, 0, 200, 120);
  const hidden = updateInstrumentTrack(tracking, frame(200, 120), 33);
  tracking = hidden.state;
  addInstrumentFrame(metrics, hidden.track, 1 / 30, 200, 120);
  const recovered = updateInstrumentTrack(tracking, frame(200, 120, [{ x: 70, y: 50, width: 10, height: 8 }]), 66);
  addInstrumentFrame(metrics, recovered.track, 2 / 30, 200, 120);
  const results = finalizeInstrumentResults(metrics);
  assert.equal(results.instrumentPathLength, 0);
  assert.ok(Math.abs(results.instrumentCoverage - 66.66666666666666) < 1e-9);
});

function metricTrack(x, y = 0.5) {
  return { center: { x, y }, box: { x, y, width: 0.03, height: 0.03 }, confidence: 1, lastSeen: 0 };
}

test("finds a sustained largest excursion and the longest stationary interval", () => {
  const metrics = createInstrumentMetricState();
  for (let frameIndex = 0; frameIndex <= 90; frameIndex += 1) {
    const time = frameIndex / 30;
    let x = 0.2;
    if (time > 1 && time <= 1.6) x = 0.2 + (time - 1) * 0.5;
    else if (time > 1.6) x = 0.5;
    addInstrumentFrame(metrics, metricTrack(x), time, 200, 120);
  }
  const results = finalizeInstrumentResults(metrics);
  assert.ok(results.largestInstrumentExcursion);
  assert.ok(results.largestInstrumentExcursion.startSeconds >= 0.8);
  assert.ok(results.largestInstrumentExcursion.endSeconds <= 1.8);
  assert.ok(results.longestInstrumentPause);
  assert.ok(results.longestInstrumentPause.startSeconds >= 1.5);
  assert.ok(results.longestInstrumentPause.endSeconds >= 2.9);
});

test("tracking loss and distant reacquisition do not create a false key moment", () => {
  const metrics = createInstrumentMetricState();
  for (let frameIndex = 0; frameIndex < 20; frameIndex += 1) addInstrumentFrame(metrics, metricTrack(0.1), frameIndex / 30, 200, 120);
  addInstrumentFrame(metrics, null, 20 / 30, 200, 120);
  for (let frameIndex = 21; frameIndex < 41; frameIndex += 1) addInstrumentFrame(metrics, metricTrack(0.9), frameIndex / 30, 200, 120);
  const results = finalizeInstrumentResults(metrics);
  assert.equal(results.largestInstrumentExcursion, null);
  assert.ok(results.longestInstrumentPause);
});

test("single-frame position noise is ignored by key-moment detection", () => {
  const metrics = createInstrumentMetricState();
  for (let frameIndex = 0; frameIndex < 45; frameIndex += 1) {
    addInstrumentFrame(metrics, metricTrack(frameIndex === 22 ? 0.8 : 0.2), frameIndex / 30, 200, 120);
  }
  const results = finalizeInstrumentResults(metrics);
  assert.equal(results.largestInstrumentExcursion, null);
  assert.ok(results.longestInstrumentPause);
});
