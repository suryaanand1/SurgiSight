import Link from "next/link";
import { ArrowRight } from "@/components/icons";
import { Header } from "@/components/header";

export default function Home() {
  return (
    <main className="page-shell">
      <Header />
      <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-teal/15 bg-mist px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-teal">
            <span className="h-1.5 w-1.5 rounded-full bg-teal" /> Surgical practice, made visible
          </div>
          <h1 className="text-5xl font-semibold leading-[1.04] tracking-[-0.045em] sm:text-6xl lg:text-7xl">Practice with purpose.</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600 sm:text-xl">A focused platform for objective surgical practice analysis—beginning with the fundamentals, one suture at a time.</p>
          <Link href="/task" className="primary-button mt-9">Start Assessment <ArrowRight /></Link>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-500">
            <span>01 · Prepare</span><span>02 · Record</span><span>03 · Review</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -inset-5 -z-10 rounded-[2.5rem] bg-gradient-to-br from-teal/10 to-transparent blur-2xl" />
          <div className="overflow-hidden rounded-[2rem] border border-white bg-white/80 p-4 shadow-soft backdrop-blur">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[1.4rem] bg-[#d9ece8]">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_46%,rgba(8,127,122,.09)_47%,transparent_49%)] bg-[length:28px_28px]" />
              <div className="absolute left-1/2 top-1/2 h-40 w-64 -translate-x-1/2 -translate-y-1/2 rotate-[-5deg] rounded-[45%] bg-[#e8b5a5] shadow-[inset_0_-18px_35px_rgba(136,65,48,.12),0_18px_40px_rgba(38,82,83,.12)]">
                <div className="absolute left-1/2 top-1/2 h-1 w-24 -translate-x-1/2 -translate-y-1/2 rotate-[4deg] rounded-full bg-[#9d5149]" />
                <div className="absolute left-1/2 top-[45%] h-8 w-14 -translate-x-1/2 border-b-2 border-teal/80" />
              </div>
              <div className="absolute bottom-4 left-4 rounded-lg bg-white/85 px-3 py-2 text-xs font-semibold text-ink shadow-sm backdrop-blur">Simple interrupted suture</div>
            </div>
          </div>
        </div>
      </section>
      <footer className="pb-6 text-xs text-slate-400">Built for focused, deliberate practice.</footer>
    </main>
  );
}
