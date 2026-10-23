import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { Header } from "@/components/header";

const instructions = [
  ["Set your view", "Place the practice pad in the center of the frame with the full working area visible."],
  ["Prepare your tools", "Arrange your needle driver, forceps, scissors, and suture before recording."],
  ["Complete one suture", "Perform one simple interrupted suture from start to finish in a single take."],
];

export default function TaskPage() {
  return (
    <main className="page-shell">
      <Header step="Step 1 of 2" />
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-12 sm:py-16">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal">Practice task</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">Simple Interrupted Suture</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Prepare a practice pad and your standard suturing instruments. When you’re ready, record one complete suture in a clear, uninterrupted view.</p>

        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-soft">
          {instructions.map(([title, body], index) => (
            <div key={title} className="flex gap-4 border-b border-slate-100 p-5 last:border-0 sm:gap-6 sm:p-6">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mist text-sm font-bold text-teal">{index + 1}</span>
              <div><h2 className="font-semibold text-ink">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{body}</p></div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-400">Use a practice pad only. No patient footage.</p>
          <Link href="/record" className="primary-button">Continue <ArrowRight /></Link>
        </div>
      </section>
    </main>
  );
}
