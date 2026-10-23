import assert from "node:assert/strict";
import test from "node:test";
import { TRACK_MEMORY_MS, updateHandTracks } from "../components/hand-tracking.ts";

function landmarks(cx, cy, hidden = 0) {
  return Array.from({ length: 21 }, (_, index) => ({
    x: cx + ((index % 5) - 2) * 0.008,
    y: cy + (Math.floor(index / 5) - 2) * 0.008,
    z: 0,
    visibility: index < hidden ? 0.1 : 0.95,
  }));
}

function result(hands) {
  return {
    landmarks: hands.map((hand) => landmarks(hand.x, hand.y, hand.hidden)),
    worldLandmarks: hands.map(() => []),
    handednesses: hands.map((hand) => [{ categoryName: hand.label, displayName: hand.label, score: hand.score ?? 0.95, index: 0 }]),
  };
}

test("keeps two separated hand identities when detector order reverses", () => {
  const first = updateHandTracks([], result([{ x: 0.25, y: 0.5, label: "Left" }, { x: 0.75, y: 0.5, label: "Right" }]), 0);
  const second = updateHandTracks(first.tracks, result([{ x: 0.73, y: 0.5, label: "Right" }, { x: 0.27, y: 0.5, label: "Left" }]), 33);
  assert.equal(second.hands.find((hand) => hand.id === 0).handedness, "Left");
  assert.equal(second.hands.find((hand) => hand.id === 1).handedness, "Right");
});

test("keeps identity as hands approach and cross", () => {
  let frame = updateHandTracks([], result([{ x: 0.3, y: 0.5, label: "Left" }, { x: 0.7, y: 0.5, label: "Right" }]), 0);
  frame = updateHandTracks(frame.tracks, result([{ x: 0.47, y: 0.5, label: "Left" }, { x: 0.53, y: 0.5, label: "Right" }]), 33);
  frame = updateHandTracks(frame.tracks, result([{ x: 0.44, y: 0.5, label: "Right" }, { x: 0.56, y: 0.5, label: "Left" }]), 66);
  assert.equal(frame.hands.find((hand) => hand.id === 0).handedness, "Left");
  assert.equal(frame.hands.find((hand) => hand.id === 1).handedness, "Right");
});

test("remembers identities through a brief overlap without drawing stale hands", () => {
  const visible = updateHandTracks([], result([{ x: 0.35, y: 0.5, label: "Left" }, { x: 0.65, y: 0.5, label: "Right" }]), 0);
  const occluded = updateHandTracks(visible.tracks, result([]), 250);
  assert.equal(occluded.hands.length, 0);
  assert.equal(occluded.rememberedCount, 2);
  const recovered = updateHandTracks(occluded.tracks, result([{ x: 0.62, y: 0.5, label: "Right" }, { x: 0.38, y: 0.5, label: "Left" }]), 500);
  assert.equal(recovered.hands.find((hand) => hand.id === 0).handedness, "Left");
  assert.equal(recovered.hands.find((hand) => hand.id === 1).handedness, "Right");
});

test("preserves a temporarily missing hand but expires sustained loss", () => {
  const both = updateHandTracks([], result([{ x: 0.3, y: 0.5, label: "Left" }, { x: 0.7, y: 0.5, label: "Right" }]), 0);
  const one = updateHandTracks(both.tracks, result([{ x: 0.32, y: 0.5, label: "Left" }]), 200);
  assert.equal(one.hands.length, 1);
  assert.equal(one.rememberedCount, 1);
  const expired = updateHandTracks(one.tracks, result([]), TRACK_MEMORY_MS + 250);
  assert.equal(expired.tracks.length, 0);
});

test("smooths short movement and rejects extensively low-visibility output", () => {
  const first = updateHandTracks([], result([{ x: 0.2, y: 0.5, label: "Left" }]), 0);
  const moved = updateHandTracks(first.tracks, result([{ x: 0.3, y: 0.5, label: "Left" }]), 33);
  const smoothedX = moved.hands[0].center.x;
  assert.ok(smoothedX > first.hands[0].center.x && smoothedX < 0.3);
  const unreliable = updateHandTracks([], result([{ x: 0.5, y: 0.5, label: "Left", hidden: 8 }]), 0);
  assert.equal(unreliable.hands.length, 0);
  assert.equal(unreliable.rejectedCount, 1);
});
