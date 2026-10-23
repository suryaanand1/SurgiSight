"use client";

import { useRef } from "react";
import type { MotionResults } from "./motion-metrics";
import type { InstrumentKeyMoment, InstrumentResults } from "./instrument-metrics";

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function formatTimestamp(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(1).padStart(4, "0")}`;
}

function MomentCard({ title, detail, moment, onReplay, canReplay }: { title: string; detail: string; moment: InstrumentKeyMoment | null; onReplay: (moment: InstrumentKeyMoment) => void; canReplay: boolean }) {
  return (
    <article className="rounded-2xl border border-teal/15 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal">Key moment</p>
          <h3 className="mt-2 text-lg font-semibold text-ink">{title}</h3>
        </div>
        <span className="rounded-full bg-mist px-3 py-1.5 text-sm font-semibold text-teal">
          {moment ? `${formatTimestamp(moment.startSeconds)}–${formatTimestamp(moment.endSeconds)}` : "Not detected"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">{moment ? detail : "Not enough continuous, reliable instrument tracking was available for this event."}</p>
      <button type="button" onClick={() => moment && onReplay(moment)} disabled={!moment || !canReplay} className="secondary-button mt-4 w-full disabled:cursor-not-allowed disabled:opacity-45">
        Replay moment
      </button>
    </article>
  );
}

export function MotionResultsPanel({ results, onReset, replayUrl }: { results: MotionResults & InstrumentResults; onReset: () => void; replayUrl: string | null }) {
  const replayRef = useRef<HTMLVideoElement>(null);
  const stopAtRef = useRef<number | null>(null);

  async function replayMoment(moment: InstrumentKeyMoment) {
    const video = replayRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = Math.max(0, moment.startSeconds - 0.2);
    stopAtRef.current = moment.endSeconds + 0.15;
    try {
      await video.play();
    } catch {
      stopAtRef.current = null;
      video.currentTime = moment.timestampSeconds;
      video.pause();
    }
  }

  function stopReplayAtMoment() {
    const video = replayRef.current;
    if (video && stopAtRef.current !== null && video.currentTime >= stopAtRef.current) {
      video.pause();
      stopAtRef.current = null;
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-soft sm:p-7">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal">Objective results</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Practice summary</h2>
        </div>
        <button type="button" onClick={onReset} className="secondary-button">Analyze another recording</button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard label="Completion Time" value={`${results.completionTimeSeconds.toFixed(1)} s`} detail="Duration from the beginning to the end of this analysis." />
        <MetricCard label="Left Hand Path Length" value={`${results.leftPathLength.toFixed(3)} FW`} detail="Tracked palm travel in frame-width image units." />
        <MetricCard label="Right Hand Path Length" value={`${results.rightPathLength.toFixed(3)} FW`} detail="Tracked palm travel in frame-width image units." />
        <MetricCard label="Left Hand Tracking Coverage" value={`${results.leftCoverage.toFixed(0)}%`} detail="Share of analyzed frames with a reliable left-hand track." />
        <MetricCard label="Right Hand Tracking Coverage" value={`${results.rightCoverage.toFixed(0)}%`} detail="Share of analyzed frames with a reliable right-hand track." />
        <MetricCard label="Needle Holder Path Length" value={`${results.instrumentPathLength.toFixed(3)} FW`} detail="Tracked marker-center travel in frame-width image units." />
        <MetricCard label="Needle Holder Tracking Coverage" value={`${results.instrumentCoverage.toFixed(0)}%`} detail="Share of analyzed frames with a reliable marker track." />
      </div>

      <div className="mt-5 rounded-xl bg-mist/70 p-4 text-xs leading-5 text-slate-600">
        <span className="font-semibold text-ink">About FW units:</span> 1.0 FW equals travel across the full width of the video frame. These are normalized image-space measurements, not centimeters or meters.
      </div>

      <section className="mt-8 border-t border-slate-200 pt-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal">Surgical Key Moments</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-ink">Review instrument movement</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Objective timestamps from continuous needle-holder tracking. Tracking gaps are excluded.</p>
        </div>

        {replayUrl && (
          <video ref={replayRef} src={replayUrl} controls playsInline onTimeUpdate={stopReplayAtMoment} className="mt-5 max-h-[28rem] w-full rounded-2xl bg-[#102a33] object-contain" />
        )}
        {!replayUrl && <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Replay is available for uploaded recordings. Live-camera timestamps are still shown below.</p>}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <MomentCard title="Largest Instrument Excursion" detail="The largest sustained needle-holder displacement found within a short analysis window." moment={results.largestInstrumentExcursion} onReplay={replayMoment} canReplay={Boolean(replayUrl)} />
          <MomentCard title="Longest Instrument Pause" detail="The longest continuous interval where the needle holder remained approximately stationary and visible." moment={results.longestInstrumentPause} onReplay={replayMoment} canReplay={Boolean(replayUrl)} />
        </div>
      </section>
    </section>
  );
}
