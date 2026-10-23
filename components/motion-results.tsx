import type { MotionResults } from "./motion-metrics";

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

export function MotionResultsPanel({ results, onReset }: { results: MotionResults; onReset: () => void }) {
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
      </div>

      <div className="mt-5 rounded-xl bg-mist/70 p-4 text-xs leading-5 text-slate-600">
        <span className="font-semibold text-ink">About FW units:</span> 1.0 FW equals travel across the full width of the video frame. These are normalized image-space measurements, not centimeters or meters.
      </div>
    </section>
  );
}
