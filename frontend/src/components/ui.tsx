import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { post } from '../lib/api'
import { speak } from '../lib/speech'
import type { Gender, Item, Rating } from '../lib/types'

type Variant = 'primary' | 'secondary' | 'ghost'

export function Button({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-ustad text-paper',
    secondary: 'bg-card text-ink border border-line',
    ghost: 'text-ustad',
  }
  return (
    <button
      {...p}
      className={`min-h-12 rounded-2xl px-5 font-semibold transition active:scale-[0.98] disabled:opacity-40 ${styles[variant]} ${className}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-line bg-card p-5 ${className}`}>{children}</div>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'ustad' | 'saffron' }) {
  const t = { neutral: 'bg-paper text-muted border border-line', ustad: 'bg-ustad-soft text-ustad', saffron: 'bg-saffron-soft text-saffron' }[tone]
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${t}`}>{children}</span>
}

const GENDER: Record<string, { sym: string; label: string }> = {
  der: { sym: '▲', label: 'der (masculine)' },
  die: { sym: '●', label: 'die (feminine)' },
  das: { sym: '■', label: 'das (neuter)' },
}

/** Gender cue shapes everywhere nouns appear (spec §5.1): der ▲, die ●, das ■. */
export function GenderCue({ gender }: { gender: Gender }) {
  if (!gender) return null
  const g = GENDER[gender]
  return (
    <span className="mr-1.5 align-middle text-base text-saffron" title={g.label} aria-label={g.label}>
      {g.sym}
    </span>
  )
}

export function German({ item, size = 'xl' }: { item: Pick<Item, 'de' | 'gender'>; size?: 'xl' | '2xl' | 'lg' }) {
  const s = { lg: 'text-lg', xl: 'text-xl', '2xl': 'text-2xl' }[size]
  return (
    <p className={`de font-semibold leading-snug ${s}`} lang="de">
      <GenderCue gender={item.gender} />
      {item.de}
    </p>
  )
}

export function SpeakButton({ text, label = 'Hören', slow = false }: { text: string; label?: string; slow?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState(false)
  if (missing) return <span className="text-xs text-muted">No audio for this line yet</span>
  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true)
        const ok = await speak(text, slow ? 0.75 : 1)
        setBusy(false)
        if (!ok) setMissing(true)
      }}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-paper px-4 text-sm font-semibold text-ustad ${busy ? 'opacity-60' : ''}`}
      aria-label={`${label}: ${text}`}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
      </svg>
      {label}
    </button>
  )
}

export function SpeakPair({ text }: { text: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <SpeakButton text={text} />
      <SpeakButton text={text} label="0.75×" slow />
    </div>
  )
}

const RATINGS: { r: Rating; label: string; hint: string; cls: string }[] = [
  { r: 1, label: 'Again', hint: 'missed', cls: 'text-again' },
  { r: 2, label: 'Hard', hint: 'slow / small error', cls: 'text-hard' },
  { r: 3, label: 'Good', hint: 'got it', cls: 'text-good' },
  { r: 4, label: 'Easy', hint: 'instant', cls: 'text-easy' },
]

export function RatingBar({ onRate, suggested }: { onRate: (r: Rating) => void; suggested?: Rating }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map(({ r, label, hint, cls }) => (
        <button
          key={r}
          onClick={() => onRate(r)}
          className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border bg-card ${cls} ${suggested === r ? 'border-current ring-2 ring-current/30' : 'border-line'}`}
        >
          <span className="font-bold">{label}</span>
          <span className="text-[11px] text-muted">{hint}</span>
        </button>
      ))}
    </div>
  )
}

export function ReportButton({ itemId }: { itemId: string }) {
  const [state, setState] = useState<'idle' | 'open' | 'sent'>('idle')
  const [note, setNote] = useState('')
  if (state === 'sent') return <p className="text-xs text-muted">Reported. This item is paused until it is fixed.</p>
  if (state === 'idle')
    return (
      <button className="text-xs text-muted underline underline-offset-2" onClick={() => setState('open')}>
        Report a problem
      </button>
    )
  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-xl border border-line bg-paper p-2 text-sm"
        rows={2}
        placeholder="What looks wrong?"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex gap-2">
        <Button variant="secondary" className="min-h-10 text-sm" onClick={() => setState('idle')}>
          Cancel
        </Button>
        <Button
          className="min-h-10 text-sm"
          onClick={async () => {
            await post(`/api/items/${itemId}/report`, { note })
            setState('sent')
          }}
        >
          Send report
        </Button>
      </div>
    </div>
  )
}

export function PageHeader({ title, sub, back = '/' }: { title: string; sub?: string; back?: string | null }) {
  return (
    <header className="mb-4 flex items-start gap-3 pt-2">
      {back && (
        <Link to={back} aria-label="Back" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ustad">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
      )}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
    </header>
  )
}

export function ItemNotes({ item }: { item: Item }) {
  return (
    <div className="space-y-2 text-sm">
      {item.context && <p className="text-muted">{item.context}</p>}
      {item.austria_note && (
        <p className="rounded-xl bg-saffron-soft px-3 py-2 text-ink">
          <span className="font-semibold text-saffron">Österreich: </span>
          {item.austria_note}
        </p>
      )}
    </div>
  )
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className="h-full rounded-full bg-ustad transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}
