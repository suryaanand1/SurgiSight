import { Header } from "@/components/header";
import { VideoInput } from "@/components/video-input";

export default function RecordPage() {
  return (
    <main className="page-shell">
      <Header step="Step 2 of 2" />
      <section className="mx-auto w-full max-w-5xl flex-1 py-10 sm:py-14">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal">Capture</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Record your suture</h1></div>
          <p className="max-w-sm text-sm leading-6 text-slate-500">Keep the practice pad and both hands visible throughout the recording.</p>
        </div>
        <VideoInput />
      </section>
    </main>
  );
}
