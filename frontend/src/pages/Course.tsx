import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Loading } from '../components/Loading'
import { Badge, Button, Card, German, PageHeader, Progress, SpeakButton } from '../components/ui'
import { useActivityMode } from '../lib/activity'
import { api } from '../lib/api'
import { drillSentence, same, tilesFor } from '../lib/drills'
import { send } from '../lib/outbox'
import { speak } from '../lib/speech'
import type { Cefr, Drill, Level, PatternDetail, PatternSummary, WeekDetail, WeekSummary } from '../lib/types'
import { ConversationRow } from './Talk'

const LEVEL_INFO: Record<Cefr, string> = {
  A1: 'Basics: greet, order, ask, describe your day',
  A2: 'Small talk: stories, plans, reasons, everyday problems',
  B1: 'Real conversations: opinions, interviews, the B1 exam',
}

function Accuracy({ p }: { p: PatternSummary }) {
  if (p.accuracy === null) return <Badge>new</Badge>
  return <Badge tone={p.mastered ? 'ustad' : 'saffron'}>{p.accuracy}%</Badge>
}

// ---------------- overview ----------------

export function CourseOverview() {
  const q = useQuery({
    queryKey: ['course'],
    queryFn: () => api<{ level: Level; weeks: WeekSummary[]; totals: { items: number; words: number; conversations: number; patterns: number } }>('/api/course'),
  })
  const [open, setOpen] = useState<Cefr | null>(null)
  if (!q.data) return <Loading />
  const { level, weeks, totals } = q.data
  const shown = open ?? level.cefr

  return (
    <div className="space-y-5">
      <PageHeader title="Kurs" sub={`36 weeks from A1 to B1. You are in week ${level.week}.`} back={null} />

      <div className="grid grid-cols-2 gap-2.5">
        <Link to="/talk" className="rounded-2xl border border-line bg-card p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Conversations</p>
          <p className="mt-1 font-semibold">{totals.conversations} to roleplay ›</p>
        </Link>
        <Link to="/culture" className="rounded-2xl border border-line bg-card p-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Vienna</p>
          <p className="mt-1 font-semibold">Austrian phrases ›</p>
        </Link>
      </div>
      <p className="text-sm text-muted">
        {totals.items} phrases and words ({totals.words} core words), {totals.patterns} grammar lessons. New phrases arrive in order in your daily Sabaq; browse ahead any time.
      </p>

      {(['A1', 'A2', 'B1'] as Cefr[]).map((cefr) => {
        const list = weeks.filter((w) => w.cefr === cefr)
        const isOpen = shown === cefr
        const done = list.filter((w) => w.items.total > 0 && w.items.started === w.items.total).length
        return (
          <section key={cefr} className="space-y-2">
            <button onClick={() => setOpen(isOpen ? null : cefr)} className="flex w-full items-center gap-3 rounded-2xl bg-ustad-soft px-4 py-3 text-left" aria-expanded={isOpen}>
              <div className="flex-1">
                <p className="font-bold text-ustad">{cefr}</p>
                <p className="text-sm text-muted">{LEVEL_INFO[cefr]}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-ustad">
                {done}/{list.length} weeks
              </span>
            </button>
            {isOpen && (
              <ol className="space-y-2">
                {list.map((w) => {
                  const here = w.week === level.week
                  return (
                    <li key={w.week}>
                      <Link to={`/kurs/${w.week}`} className={`block rounded-2xl border bg-card px-4 py-3 ${here ? 'border-ustad ring-2 ring-ustad/20' : 'border-line'}`}>
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="font-semibold">
                            <span className="text-muted">Week {w.week} · </span>
                            {w.title}
                          </p>
                          {here && <Badge tone="ustad">You are here</Badge>}
                        </div>
                        <p className="de text-sm text-muted" lang="de">
                          {w.title_de}
                        </p>
                        <div className="mt-2">
                          <Progress value={w.items.started} max={Math.max(1, w.items.total)} />
                        </div>
                        <p className="mt-1.5 text-xs text-muted">
                          {w.items.started}/{w.items.total} phrases & words
                          {w.patterns.length > 0 && ` · ${w.patterns.length} grammar`}
                          {w.conversations.total > 0 && ` · ${w.conversations.total} conversation${w.conversations.total > 1 ? 's' : ''}`}
                        </p>
                      </Link>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}

// ---------------- week ----------------

export function WeekPage() {
  const { week } = useParams()
  const q = useQuery({ queryKey: ['course', week], queryFn: () => api<WeekDetail>(`/api/course/${week}`) })
  const [showAllWords, setShowAllWords] = useState(false)
  const w = q.data
  if (!w) return <Loading />
  const words = showAllWords ? w.words : w.words.slice(0, 12)

  return (
    <div className="space-y-5">
      <PageHeader title={`Week ${w.week}: ${w.title}`} sub={`${w.cefr} · ${w.title_de}`} back="/kurs" />

      <Card className="space-y-2 !p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">By the end of this week you can</p>
        <ul className="space-y-1.5">
          {w.goals.map((g) => (
            <li key={g} className="flex gap-2">
              <span className="text-ustad" aria-hidden>
                ✓
              </span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </Card>

      {w.patterns.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Grammar</h2>
          {w.patterns.map((p) => (
            <Link key={p.code} to={`/grammar/${p.code}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.title}</p>
                <p className="de truncate text-sm text-muted" lang="de">
                  {p.title_de}
                </p>
              </div>
              <Accuracy p={p} />
            </Link>
          ))}
        </section>
      )}

      {w.conversation_list.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Conversations</h2>
          {w.conversation_list.map((c) => (
            <ConversationRow key={c.id} c={c} />
          ))}
        </section>
      )}

      {w.phrases.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Phrases · {w.phrases.length}</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {w.phrases.map((i) => (
              <li key={i.id} className="flex items-center gap-2 px-4 py-2.5">
                <Link to={`/item/${i.id}`} className="min-w-0 flex-1">
                  <German item={i} size="lg" />
                  <p className="text-sm text-muted">{i.en}</p>
                </Link>
                {i.introduced && <span className="text-xs font-semibold text-good">started</span>}
                <SpeakButton text={i.de} label="" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {w.words.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Words · {w.words.length}</h2>
          <ul className="grid grid-cols-1 gap-2">
            {words.map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <German item={i} size="lg" />
                  <p className="text-sm text-muted">
                    {i.en}
                    {i.plural && <span> · {i.plural}</span>}
                  </p>
                </div>
                <SpeakButton text={i.de} label="" />
              </li>
            ))}
          </ul>
          {w.words.length > 12 && (
            <Button variant="ghost" className="w-full" onClick={() => setShowAllWords((v) => !v)}>
              {showAllWords ? 'Show fewer' : `Show all ${w.words.length} words`}
            </Button>
          )}
        </section>
      )}
    </div>
  )
}

// ---------------- grammar lesson + drills ----------------

function DrillCard({ d, n, total, onResult }: { d: Drill; n: number; total: number; onResult: (ok: boolean) => void }) {
  const [typed, setTyped] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [checked, setChecked] = useState<null | boolean>(null)
  const tiles = useMemo(() => (d.t === 'order' ? tilesFor(d.a) : []), [d])
  const remaining = useMemo(() => {
    const left = [...tiles]
    for (const p of picked) left.splice(left.indexOf(p), 1)
    return left
  }, [tiles, picked])

  function check(answer: string) {
    const accepted = d.t === 'tr' ? [d.a, ...(d.alt ?? [])] : [d.a]
    const ok = accepted.some((a) => same(answer, a))
    setChecked(ok)
    void speak(drillSentence(d))
  }

  const prompt = d.t === 'gap' ? 'Fill the gap' : d.t === 'order' ? 'Build the sentence' : 'Change the sentence'

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge tone="ustad">{prompt}</Badge>
        <span className="text-sm tabular-nums text-muted">
          {n}/{total}
        </span>
      </div>

      {d.t === 'gap' && (
        <>
          <p className="de text-xl font-semibold leading-snug" lang="de">
            {d.q.split('___').map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && <span className="mx-1 inline-block min-w-12 border-b-2 border-ustad text-center text-ustad">{checked === null ? ' ' : d.a}</span>}
              </span>
            ))}
          </p>
          {d.o && checked === null ? (
            <div className="grid grid-cols-1 gap-2">
              {d.o.map((o) => (
                <Button key={o} variant="secondary" className="de text-lg" onClick={() => check(o)} lang="de">
                  {o}
                </Button>
              ))}
            </div>
          ) : null}
        </>
      )}

      {d.t === 'order' && (
        <>
          {d.en && <p className="text-lg">{d.en}</p>}
          <div className="min-h-14 rounded-2xl border-2 border-dashed border-line p-2" aria-label="Your sentence">
            <div className="flex flex-wrap gap-1.5">
              {picked.map((w, i) => (
                <button
                  key={`${w}-${i}`}
                  className="de min-h-10 rounded-xl bg-ustad px-3 font-semibold text-paper"
                  onClick={() => checked === null && setPicked(picked.filter((_, k) => k !== i))}
                  lang="de"
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          {checked === null && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {remaining.map((w, i) => (
                  <button key={`${w}-${i}`} className="de min-h-10 rounded-xl border border-line bg-paper px-3 font-semibold" onClick={() => setPicked([...picked, w])} lang="de">
                    {w}
                  </button>
                ))}
              </div>
              <Button className="w-full" disabled={remaining.length > 0} onClick={() => check(picked.join(' '))}>
                Check
              </Button>
            </>
          )}
        </>
      )}

      {d.t === 'tr' && (
        <>
          <p className="de text-lg font-semibold leading-snug" lang="de">
            {d.q}
          </p>
          {checked === null && (
            <>
              <input
                className="min-h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base"
                placeholder="Type the new sentence"
                lang="de"
                autoCapitalize="sentences"
                autoCorrect="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && typed.trim() && check(typed)}
              />
              <Button className="w-full" disabled={!typed.trim()} onClick={() => check(typed)}>
                Check
              </Button>
            </>
          )}
        </>
      )}

      {d.t === 'gap' && !d.o && checked === null && (
        <div className="flex gap-2">
          <input
            className="min-h-12 flex-1 rounded-2xl border border-line bg-paper px-4 text-base"
            lang="de"
            autoCorrect="off"
            spellCheck={false}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
          <Button disabled={!typed.trim()} onClick={() => check(typed)}>
            Check
          </Button>
        </div>
      )}

      {checked !== null && (
        <div className="space-y-3 border-t border-line pt-3">
          <p className={`font-semibold ${checked ? 'text-good' : 'text-again'}`}>{checked ? 'Richtig!' : 'Not quite. The answer:'}</p>
          <p className="de text-lg font-semibold" lang="de">
            {drillSentence(d)}
          </p>
          {d.en && <p className="text-sm text-muted">{d.en}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <SpeakButton text={drillSentence(d)} />
            {!checked && (
              <button className="text-sm text-muted underline underline-offset-2" onClick={() => setChecked(true)}>
                My answer was also right
              </button>
            )}
          </div>
          <Button className="w-full" onClick={() => onResult(!!checked)}>
            {n < total ? 'Next' : 'Finish'}
          </Button>
        </div>
      )}
    </Card>
  )
}

export function GrammarPage() {
  const { code } = useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['grammar', code], queryFn: () => api<PatternDetail>(`/api/grammar/${code}`) })
  const [mode, setMode] = useState<'learn' | 'drill' | 'done'>('learn')
  const [i, setI] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [round, setRound] = useState(0)
  useActivityMode(mode === 'drill' ? 'speaking' : null)
  const p = q.data
  if (!p) return <Loading />

  function result(ok: boolean) {
    const c = correct + (ok ? 1 : 0)
    setCorrect(c)
    if (i + 1 < p!.drills.length) setI(i + 1)
    else {
      setMode('done')
      void send(`/api/grammar/${p!.code}/practice`, { correct: c, total: p!.drills.length })
      void qc.invalidateQueries({ queryKey: ['daily'] })
      void qc.invalidateQueries({ queryKey: ['course'] })
    }
  }

  function start() {
    setMode('drill')
    setI(0)
    setCorrect(0)
    setRound((r) => r + 1)
  }

  return (
    <div className="space-y-4">
      <PageHeader title={p.title} sub={`${p.cefr} · week ${p.week} · ${p.title_de}`} back={`/kurs/${p.week}`} />

      {mode === 'learn' && (
        <>
          <Card className="space-y-3">
            {p.explain.map((e) => (
              <p key={e} className="leading-relaxed">
                {e}
              </p>
            ))}
            {p.slots && (
              <div className="flex flex-wrap gap-1.5 pt-1" aria-label="Sentence pattern">
                {p.slots.map(([label, text]) => (
                  <div key={label} className="rounded-xl border border-line bg-paper px-2.5 py-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
                    <p className="de font-semibold text-ustad" lang="de">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {p.table && (
              <table className="w-full text-left">
                <tbody>
                  {p.table.map(([a, b]) => (
                    <tr key={a} className="border-t border-line">
                      <td className="py-1.5 pr-3 text-muted">{a}</td>
                      <td className="de py-1.5 font-semibold" lang="de">
                        {b}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Examples</h2>
            {p.examples.map(([de, en]) => (
              <div key={de} className="flex items-center gap-2 rounded-2xl border border-line bg-card px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="de font-semibold" lang="de">
                    {de}
                  </p>
                  <p className="text-sm text-muted">{en}</p>
                </div>
                <SpeakButton text={de} label="" />
              </div>
            ))}
          </section>

          {p.mistake && (
            <Card className="space-y-1.5 !p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Common mistake</p>
              <p className="de text-again line-through" lang="de">
                {p.mistake.wrong}
              </p>
              <p className="de font-semibold text-good" lang="de">
                {p.mistake.right}
              </p>
              <p className="text-sm text-muted">{p.mistake.why}</p>
            </Card>
          )}

          <div className="sticky bottom-0 -mx-4 border-t border-line bg-paper/95 px-4 pb-[max(env(safe-area-inset-bottom),10px)] pt-2.5 backdrop-blur">
            <Button className="w-full" onClick={start}>
              Practise: {p.drills.length} drills {p.accuracy !== null && `· last ${p.accuracy}%`}
            </Button>
          </div>
        </>
      )}

      {mode === 'drill' && (
        <>
          <Progress value={i} max={p.drills.length} />
          <DrillCard key={`${round}-${i}`} d={p.drills[i]} n={i + 1} total={p.drills.length} onResult={result} />
          <Button variant="ghost" className="w-full" onClick={() => setMode('learn')}>
            Back to the explanation
          </Button>
        </>
      )}

      {mode === 'done' && (
        <Card className="space-y-4 text-center">
          <p className="text-4xl font-bold tabular-nums">
            {correct}/{p.drills.length}
          </p>
          <p className="font-semibold">
            {correct === p.drills.length ? 'Perfect. This pattern is solid.' : correct >= p.drills.length * 0.8 ? 'Good. One more round makes it automatic.' : 'Read the examples once more, then try again.'}
          </p>
          <p className="text-sm text-muted">Now say two of the example sentences aloud with your own words.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={start}>
              Again
            </Button>
            <Link to={`/kurs/${p.week}`}>
              <Button className="w-full">Week {p.week}</Button>
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
