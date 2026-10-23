import Link from "next/link";

export function Header({ step }: { step?: string }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200/70 py-5">
      <Link href="/" className="flex items-center gap-3" aria-label="SurgiSight home">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal text-white shadow-sm">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="8" opacity=".45" /></svg>
        </span>
        <span className="text-lg font-bold tracking-tight">SurgiSight</span>
      </Link>
      {step && <span className="rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-slate-500">{step}</span>}
    </header>
  );
}
