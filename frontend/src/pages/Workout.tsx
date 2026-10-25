import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { Button, Card, PageHeader, Progress } from '../components/ui'
import { useActivityMode } from '../lib/activity'
import { api } from '../lib/api'
import { send } from '../lib/outbox'
import type { Workout } from '../lib/types'
import { DrillCard } from './Course'

/** A generated round (words or mixed grammar). Every visit or "New round" fetches a fresh random set. */
function Round({ queryKey, path, back, backLabel, save }: { queryKey: unknown[]; path: string; back: string; backLabel: string; save: (w: Workout, results: boolean[]) => void }) {
  const qc = useQueryClient()
  const q = useQuery({ queryKey, queryFn: () => api<Workout>(path), staleTime: Infinity, gcTime: 0 })
  const [i, setI] = useState(0)
  const [results, setResults] = useState<boolean[]>([])
  useActivityMode(q.data && results.length < q.data.drills.length ? 'speaking' : null)
  const w = q.data
  if (q.isError) return <PageHeader title="Nothing to practise yet" sub="Learn a few lessons first, then come back." back={back} />
  if (!w || q.isFetching) return <Loading />
  const done = results.length === w.drills.length
  const correct = results.filter(Boolean).length

  function result(ok: boolean) {
    const r = [...results, ok]
    setResults(r)
    if (r.length < w!.drills.length) setI(i + 1)
    else {
      save(w!, r)
      void qc.invalidateQueries({ queryKey: ['daily'] })
      void qc.invalidateQueries({ queryKey: ['course'] })
    }
  }

  function again() {
    setI(0)
    setResults([])
    void q.refetch()
  }

  return (
    <div className="space-y-4">
      <PageHeader title={w.title} sub={`${w.sub}${w.accuracy !== null ? ` · last rounds ${w.accuracy}%` : ''}`} back={back} />
      {!done ? (
        <>
          <Progress value={i} max={w.drills.length} />
          <DrillCard key={`${q.dataUpdatedAt}-${i}`} d={w.drills[i]} label={w.drills[i].label} n={i + 1} total={w.drills.length} onResult={result} />
        </>
      ) : (
        <Card className="space-y-4 text-center">
          <p className="text-4xl font-bold tabular-nums">
            {correct}/{w.drills.length}
          </p>
          <p className="font-semibold">{correct === w.drills.length ? 'Perfect round.' : correct >= w.drills.length * 0.8 ? 'Good. Another round mixes in new ones.' : 'Do one more round. Mistakes come back until they stick.'}</p>
          <p className="text-sm text-muted">Say three of the answers aloud in a short sentence of your own.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={again}>
              New round
            </Button>
            <Link to={back}>
              <Button className="w-full">{backLabel}</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}

export function WordWorkout() {
  const { week = '0' } = useParams()
  const back = week === '0' ? '/kurs' : `/kurs/${week}`
  return (
    <Round
      key={week}
      queryKey={['workout', 'words', week]}
      path={`/api/vocab/${week}`}
      back={back}
      backLabel={week === '0' ? 'Kurs' : `Week ${week}`}
      save={(_, r) => void send(`/api/vocab/${week}/practice`, { correct: r.filter(Boolean).length, total: r.length })}
    />
  )
}

export function GrammarWorkout() {
  return (
    <Round
      queryKey={['workout', 'grammar']}
      path="/api/workout/grammar"
      back="/kurs"
      backLabel="Kurs"
      save={(w, r) => void send('/api/workout/grammar/practice', { results: w.drills.map((d, n) => ({ code: d.code, ok: r[n] })) })}
    />
  )
}
