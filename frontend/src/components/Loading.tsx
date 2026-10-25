/** Centered, calm loading state (replaces bare "Loading…" text). */
export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-muted" role="status" aria-live="polite">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-line border-t-ustad" aria-hidden />
      <span className="text-sm">{label}…</span>
    </div>
  )
}
