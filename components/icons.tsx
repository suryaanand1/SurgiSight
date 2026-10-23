type IconProps = { className?: string };

export function ArrowRight({ className = "h-4 w-4" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export function Upload({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" /></svg>;
}

export function Camera({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.2-2h4.6l1.2 2h2A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-8Z" /><circle cx="12" cy="12.5" r="3.5" /></svg>;
}

export function Play({ className = "h-5 w-5" }: IconProps) {
  return <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m9 7 8 5-8 5V7Z" /></svg>;
}
