import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Dialogue } from '../components/Dialogue'
import { Badge, Card, German, ItemNotes, PageHeader, ReportButton, SpeakPair } from '../components/ui'
import { ACTION_LABEL, REGION_LABEL } from '../lib/labels'
import { api } from '../lib/api'
import type { Item } from '../lib/types'

const TABS: Item['learner_action'][] = ['use_now', 'recognise_now', 'later']

export function Culture() {
  const q = useQuery({ queryKey: ['culture'], queryFn: () => api<Item[]>('/api/culture') })
  const [tab, setTab] = useState<Item['learner_action']>('use_now')
  const items = (q.data ?? []).filter((i) => i.learner_action === tab)
  return (
    <div className="space-y-4">
      <PageHeader title="Vienna & Austria" sub="What it means, when it sounds natural, and whether to use it yet." back={null} />
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-line/60 p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-10 rounded-xl text-sm font-semibold ${tab === t ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}>
            {ACTION_LABEL[t]}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id}>
            <Link to={`/item/${i.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <German item={i} size="lg" />
                <p className="truncate text-sm text-muted">{i.en}</p>
              </div>
              <Badge tone={i.region_tag === 'vienna' ? 'saffron' : 'neutral'}>{REGION_LABEL[i.region_tag]}</Badge>
            </Link>
          </li>
        ))}
        {q.data && items.length === 0 && <p className="text-muted">Nothing here.</p>}
      </ul>
    </div>
  )
}

export function ItemPage() {
  const { id } = useParams()
  const q = useQuery({ queryKey: ['item', id], queryFn: () => api<Item>(`/api/items/${id}`) })
  const i = q.data
  if (!i) return <p className="pt-10 text-center text-muted">Loading…</p>
  return (
    <div className="space-y-4">
      <PageHeader title={i.deck === 'vienna' ? 'Culture phrase' : 'Phrase'} back={i.deck === 'vienna' ? '/culture' : '/more'} />
      <Card className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="ustad">{ACTION_LABEL[i.learner_action]}</Badge>
          <Badge tone={i.region_tag === 'standard' ? 'neutral' : 'saffron'}>{REGION_LABEL[i.region_tag]}</Badge>
          <Badge>{i.register}</Badge>
          {i.status === 'flagged' && <Badge>reported</Badge>}
        </div>
        <German item={i} size="2xl" />
        {i.plural && <p className="text-sm text-muted">Plural: {i.plural}</p>}
        <p className="text-lg">{i.en}</p>
        <SpeakPair text={i.de} />
        <ItemNotes item={i} />
        {i.likely_reply_de && (
          <div className="rounded-2xl bg-paper p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Likely reply</p>
            <p className="de font-semibold" lang="de">
              {i.likely_reply_de}
            </p>
            <p className="text-sm text-muted">{i.likely_reply_en}</p>
          </div>
        )}
        {i.mission && (
          <p className="text-sm">
            <span className="font-semibold text-ustad">Use this today: </span>
            {i.mission}
          </p>
        )}
      </Card>
      {i.mini_dialogue.length > 0 && (
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Mini-dialogue</p>
          <Dialogue turns={i.mini_dialogue} />
        </Card>
      )}
      {i.verify_source && <p className="text-xs text-muted">Check: {i.verify_source}</p>}
      <ReportButton itemId={i.id} />
    </div>
  )
}
