import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Card, German, PageHeader } from '../components/ui'
import { api } from '../lib/api'
import { InstallHint } from '../components/InstallHint'
import { isStandalone } from '../lib/platform'
import { pendingCount } from '../lib/outbox'
import { logoutAndClear } from '../lib/privacy'
import { loadAudioManifest, voiceLabel } from '../lib/speech'
import type { Item } from '../lib/types'

interface Settings {
  learner_profile_md: string
  new_per_day: number
  max_reviews_per_day: number
  weekly_target_days: number
  weekly_target_attempts: number
}

const DECKS: Record<string, string> = {
  survival: 'Survival German',
  words: 'Core words',
  vienna: 'Vienna / Austria',
  uni: 'University / Student life',
  home: 'Home & City',
  smalltalk: 'Small talk A2',
  b1: 'B1: opinions and stories',
}

/** Thumb-friendly −/+ stepper instead of a tiny number field. */
function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)))
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full border border-line bg-paper text-lg font-bold text-ustad disabled:opacity-30'
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex-1">{label}</span>
      <button type="button" className={btn} onClick={() => set(value - step)} disabled={value <= min} aria-label={`Decrease ${label}`}>
        −
      </button>
      <span className="w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => set(value + step)} disabled={value >= max} aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  )
}

export default function More({ onLogout }: { onLogout: () => void }) {
  const qc = useQueryClient()
  const settings = useQuery({ queryKey: ['settings'], queryFn: () => api<Settings>('/api/settings') })
  const items = useQuery({ queryKey: ['items'], queryFn: () => api<Item[]>('/api/items') })
  const [edited, setForm] = useState<Settings | null>(null)
  const form = edited ?? settings.data ?? null
  const [deck, setDeck] = useState<string | null>(null)
  const [voice, setVoice] = useState('')
  useEffect(() => {
    let live = true
    void loadAudioManifest().then(() => live && setVoice(voiceLabel()))
    return () => {
      live = false
    }
  }, [])
  const save = useMutation({
    mutationFn: (s: Settings) => api<Settings>('/api/settings', { method: 'PUT', json: s }),
    onSuccess: () => qc.invalidateQueries(),
  })

  const counts = Object.keys(DECKS).map((k) => {
    const all = (items.data ?? []).filter((i) => i.deck === k)
    return { k, total: all.length, learned: all.filter((i) => i.introduced).length }
  }).filter((c) => c.total > 0)

  return (
    <div className="space-y-5">
      <PageHeader title="More" back={null} />
      <InstallHint />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Decks</h2>
        {counts.map((c) => (
          <button key={c.k} onClick={() => setDeck(deck === c.k ? null : c.k)} className="flex w-full items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-left">
            <span className="font-medium">{DECKS[c.k]}</span>
            <span className="text-sm tabular-nums text-muted">
              {c.learned}/{c.total} started
            </span>
          </button>
        ))}
        {deck && (
          <ul className="space-y-1.5">
            {(items.data ?? [])
              .filter((i) => i.deck === deck)
              .map((i) => (
                <li key={i.id}>
                  <Link to={`/item/${i.id}`} className="block rounded-xl px-3 py-2 hover:bg-card">
                    <German item={i} size="lg" />
                    <p className="text-sm text-muted">
                      {i.en} · week {i.week}
                      {i.introduced ? ' · started' : ''}
                    </p>
                  </Link>
                </li>
              ))}
          </ul>
        )}
      </section>

      {form && (
        <Card className="space-y-4">
          <h2 className="font-semibold">Settings</h2>
          <NumberField label="New phrases per day" value={form.new_per_day} min={3} max={20} onChange={(n) => setForm({ ...form, new_per_day: n })} />
          <NumberField label="Max reviews per day" value={form.max_reviews_per_day} min={20} max={500} step={10} onChange={(n) => setForm({ ...form, max_reviews_per_day: n })} />
          <NumberField label="Target study days / week" value={form.weekly_target_days} min={1} max={7} onChange={(n) => setForm({ ...form, weekly_target_days: n })} />
          <NumberField label="Target real-world tries / week" value={form.weekly_target_attempts} min={0} max={50} onChange={(n) => setForm({ ...form, weekly_target_attempts: n })} />
          <label className="block space-y-1.5">
            <span>Learner profile (the tutor reads this)</span>
            <textarea rows={8} className="w-full rounded-2xl border border-line bg-paper p-3 text-base" value={form.learner_profile_md} onChange={(e) => setForm({ ...form, learner_profile_md: e.target.value })} />
          </label>
          <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate(form)}>
            {save.isSuccess ? 'Saved' : 'Save settings'}
          </Button>
        </Card>
      )}

      <Card className="space-y-2 text-sm">
        <h2 className="font-semibold">This device</h2>
        <p>
          <span className="text-muted">Voice: </span>
          {voice || '…'}
        </p>
        <p>
          <span className="text-muted">Answers waiting to sync: </span>
          {pendingCount()}
        </p>
        <p className="text-muted">{isStandalone() ? 'Running as an installed app.' : 'Running in the browser. Install it for full-screen use and offline study.'}</p>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <a href="/api/export" download="ustad-export.json">
          <Button variant="secondary" className="w-full">
            Export data
          </Button>
        </a>
        <Button
          variant="secondary"
          onClick={async () => {
            await logoutAndClear()
            onLogout()
          }}
        >
          Log out
        </Button>
      </div>
    </div>
  )
}
