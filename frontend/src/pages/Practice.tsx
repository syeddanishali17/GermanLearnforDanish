import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialogue } from '../components/Dialogue'
import { RecallDrill } from '../components/RecallDrill'
import { Button, Card, PageHeader } from '../components/ui'
import { flushActivity, useActivityMode } from '../lib/activity'
import { api } from '../lib/api'
import type { Daily, Item } from '../lib/types'
import { Loading } from '../components/Loading'

function uniq(items: Item[]): Item[] {
  const seen = new Set<string>()
  return items.filter((i) => !seen.has(i.id) && seen.add(i.id))
}

function Finished({ text, next }: { text: string; next: { to: string; label: string } }) {
  return (
    <Card className="space-y-3">
      <p className="text-lg font-semibold">{text}</p>
      <Link to={next.to}>
        <Button className="w-full">{next.label}</Button>
      </Link>
      <Link to="/">
        <Button variant="secondary" className="w-full">
          Back to today
        </Button>
      </Link>
    </Card>
  )
}

/** Sabqi: recent phrases and yesterday's misses, recalled aloud (spec §4 block 2). */
export function Sabqi() {
  useActivityMode('speaking')
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => api<Daily>('/api/daily'), staleTime: Infinity })
  const [result, setResult] = useState<{ got: number; total: number } | null>(null)
  const items = daily.data?.sabqi ?? []
  return (
    <div>
      <PageHeader title="Sabqi" sub="Recent phrases and recent misses. Say each one aloud." />
      {!daily.data ? (
        <Loading />
      ) : result || items.length === 0 ? (
        <Finished text={items.length ? `${result!.got} of ${result!.total} recalled.` : 'Nothing recent to revise yet.'} next={{ to: '/sabaq', label: 'Go to Sabaq' }} />
      ) : (
        <RecallDrill items={items.slice(0, 8)} onDone={setResult} />
      )}
    </div>
  )
}

/** Bolna: phrase rehearsal, expected-reply training and roleplay for today's material (spec §4 block 4). */
export function Bolna() {
  useActivityMode('speaking')
  const qc = useQueryClient()
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => api<Daily>('/api/daily'), staleTime: Infinity })
  const [stage, setStage] = useState<'say' | 'reply' | 'roleplay' | 'done'>('say')
  const [dlg, setDlg] = useState(0)

  if (!daily.data) return <Loading />
  const d = daily.data
  const pool = uniq([...d.sabaq.introduced_today, ...d.sabqi]).filter((i) => i.learner_action === 'use_now').slice(0, 8)
  const withReply = pool.filter((i) => i.likely_reply_de)
  const dialogues = pool.filter((i) => i.mini_dialogue.length)

  function advance(from: typeof stage) {
    const order: (typeof stage)[] = ['say', ...(withReply.length ? (['reply'] as const) : []), ...(dialogues.length ? (['roleplay'] as const) : []), 'done']
    const nextStage = order[order.indexOf(from) + 1]
    setStage(nextStage)
    if (nextStage === 'done') {
      flushActivity({ block_done: 'bolna' })
      void qc.invalidateQueries({ queryKey: ['daily'] })
    }
  }

  if (pool.length === 0)
    return (
      <div>
        <PageHeader title="Bolna" sub="Speak" />
        <Finished text="Learn some phrases in Sabaq first, then come back to speak them." next={{ to: '/sabaq', label: 'Go to Sabaq' }} />
      </div>
    )

  return (
    <div>
      {stage === 'say' && (
        <>
          <PageHeader title="Bolna" sub="Step 1: say today's phrases from memory, out loud." />
          <RecallDrill items={pool} onDone={() => advance('say')} />
        </>
      )}
      {stage === 'reply' && (
        <>
          <PageHeader title="Bolna" sub="Step 2: understand the reply, then answer it aloud." />
          <RecallDrill items={withReply} mode="reply" onDone={() => advance('reply')} />
        </>
      )}
      {stage === 'roleplay' && (
        <>
          <PageHeader title="Bolna" sub={`Step 3: roleplay ${dlg + 1} of ${dialogues.length}. Say your lines before you reveal them.`} />
          <Card>
            <Dialogue key={dialogues[dlg].id} turns={dialogues[dlg].mini_dialogue} roleplay onDone={() => (dlg + 1 < dialogues.length ? setDlg(dlg + 1) : advance('roleplay'))} />
          </Card>
        </>
      )}
      {stage === 'done' && (
        <>
          <PageHeader title="Bolna" sub="Speak" />
          <Finished text="Speaking practice done. Now take one phrase outside." next={{ to: '/bahar', label: 'Plan a Bahar Mission' }} />
        </>
      )}
    </div>
  )
}
