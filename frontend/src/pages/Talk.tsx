import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card, PageHeader, Progress, SpeakButton } from '../components/ui'
import { useActivityMode } from '../lib/activity'
import { api } from '../lib/api'
import { send } from '../lib/outbox'
import { speak, stopSpeaking } from '../lib/speech'
import type { Cefr, ConversationDetail, ConversationSummary, ConversationTurn, Level } from '../lib/types'

const LEVELS: { cefr: Cefr; label: string; sub: string }[] = [
  { cefr: 'A1', label: 'A1 · Basics', sub: 'Greetings, ordering, asking, first small talk' },
  { cefr: 'A2', label: 'A2 · Small talk', sub: 'Weekend stories, plans, reasons, everyday problems' },
  { cefr: 'B1', label: 'B1 · Real conversations', sub: 'Opinions, stories, interviews, polite negotiation' },
]

const isLearner = (t: ConversationTurn) => t.who === 'Du'
const now = () => Date.now()

function PractisedDots({ n }: { n: number }) {
  return (
    <span className="flex gap-1" aria-label={`Practised ${n} times`}>
      {[0, 1].map((i) => (
        <span key={i} className={`h-2 w-2 rounded-full ${i < n ? 'bg-ustad' : 'bg-line'}`} />
      ))}
    </span>
  )
}

export function ConversationRow({ c, highlight }: { c: ConversationSummary; highlight?: boolean }) {
  return (
    <Link to={`/talk/${c.slug}`} className={`block rounded-2xl border bg-card px-4 py-3 ${highlight ? 'border-ustad ring-2 ring-ustad/20' : 'border-line'}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="de font-semibold" lang="de">
          {c.title_de}
        </p>
        <PractisedDots n={c.practised} />
      </div>
      <p className="text-sm text-muted">{c.title}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {highlight && <Badge tone="ustad">Next for you</Badge>}
        {c.readiness === 'stretch' && <Badge>Stretch</Badge>}
        <Badge>{c.register === 'formal' ? 'Sie' : 'du'}</Badge>
        <Badge>{c.turns} turns</Badge>
      </div>
    </Link>
  )
}

export function TalkList() {
  const q = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api<{ level: Level; recommended_id: string | null; conversations: ConversationSummary[] }>('/api/conversations'),
  })
  const [open, setOpen] = useState<Cefr | null>(null)
  if (!q.data) return <p className="pt-10 text-center text-muted">Loading…</p>
  const { level, recommended_id, conversations } = q.data
  const shown = open ?? level.cefr

  return (
    <div className="space-y-4">
      <PageHeader title="Gespräche" sub={`Full conversations to roleplay. You are in week ${level.week}, level ${level.cefr}.`} back={null} />
      {LEVELS.map((l) => {
        const list = conversations.filter((c) => c.cefr === l.cefr)
        const done = list.filter((c) => c.practised >= 2).length
        const isOpen = shown === l.cefr
        return (
          <section key={l.cefr} className="space-y-2">
            <button onClick={() => setOpen(isOpen ? (l.cefr === 'A1' ? 'A2' : 'A1') : l.cefr)} className="flex w-full items-center gap-3 rounded-2xl bg-ustad-soft px-4 py-3 text-left" aria-expanded={isOpen}>
              <div className="flex-1">
                <p className="font-bold text-ustad">{l.label}</p>
                <p className="text-sm text-muted">{l.sub}</p>
              </div>
              <span className="text-sm font-semibold tabular-nums text-ustad">
                {done}/{list.length}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-2">
                {list.map((c) => (
                  <ConversationRow key={c.id} c={c} highlight={c.id === recommended_id} />
                ))}
              </div>
            )}
          </section>
        )
      })}
      <p className="text-sm text-muted">A conversation counts as practised after two roleplays. Stretch ones are ahead of your phrases; try them anyway if you feel ready.</p>
    </div>
  )
}

type Mode = 'listen' | 'roleplay' | 'own'
const MODES: { m: Mode; label: string; hint: string }[] = [
  { m: 'listen', label: 'Listen', hint: 'Read and hear the whole conversation first.' },
  { m: 'roleplay', label: 'Roleplay', hint: 'Your lines are hidden. Say them aloud, then check.' },
  { m: 'own', label: 'Your words', hint: 'You only see the English idea. Say it your way, then compare.' },
]

function Turn({ id, t, hidden, cue, showEn }: { id?: string; t: ConversationTurn; hidden: boolean; cue: boolean; showEn: boolean }) {
  const mine = isLearner(t)
  return (
    <li id={id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${mine ? 'bg-ustad-soft' : 'border border-line bg-card'}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{mine ? 'Du' : t.who}</p>
        {hidden ? (
          <p className="text-sm italic text-muted">{cue ? `Say: “${t.en}”` : 'Your turn. Say your line aloud.'}</p>
        ) : (
          <>
            <p className="de font-medium" lang="de">
              {t.de}
            </p>
            {showEn && <p className="text-sm text-muted">{t.en}</p>}
            {mine && t.alt?.length ? (
              <p className="mt-1 text-sm text-muted">
                Also fine:{' '}
                <span lang="de" className="text-ink">
                  {t.alt.join(' · ')}
                </span>
              </p>
            ) : null}
            <div className="mt-1.5">
              <SpeakButton text={t.de} label={mine ? 'Model' : 'Hören'} />
            </div>
          </>
        )}
      </div>
    </li>
  )
}

export function ConversationPage() {
  const { slug } = useParams()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['conversation', slug], queryFn: () => api<ConversationDetail>(`/api/conversations/${slug}`) })
  const [mode, setMode] = useState<Mode>('listen')
  const [pos, setPos] = useState(0)
  const [showEn, setShowEn] = useState(false)
  const [finished, setFinished] = useState(false)
  const [saved, setSaved] = useState(false)
  const [playing, setPlaying] = useState(false)
  const started = useRef(0)
  const stop = useRef(false)
  useActivityMode(mode === 'listen' ? null : 'speaking')
  useEffect(() => () => void (stop.current = true), [])

  useEffect(() => {
    if (pos > 0) document.getElementById('turn-latest')?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [pos])

  const c = q.data
  if (!c) return <p className="pt-10 text-center text-muted">Loading…</p>
  const turns = c.turns_list

  function choose(m: Mode) {
    stop.current = true
    stopSpeaking()
    setMode(m)
    setPos(0)
    setFinished(false)
    setSaved(false)
    started.current = now()
  }

  async function playAll() {
    stop.current = false
    setPlaying(true)
    for (const t of turns) {
      if (stop.current) break
      await speak(t.de)
      await new Promise((r) => setTimeout(r, 350))
    }
    setPlaying(false)
  }

  function next() {
    const n = pos + 1
    setPos(n)
    // Partner's next line is spoken on the same tap, so iOS allows the audio.
    const t = turns[n]
    if (t && !isLearner(t)) void speak(t.de)
    if (n >= turns.length) setFinished(true)
  }

  function startPractice() {
    setPos(0)
    setFinished(false)
    started.current = now()
    const first = turns[0]
    if (first && !isLearner(first)) void speak(first.de)
  }

  function save(result: 'smooth' | 'helped' | 'hard' | null) {
    void send(`/api/conversations/${c!.id}/practice`, { mode, result, seconds: Math.min(1800, Math.round((now() - started.current) / 1000)) })
    setSaved(true)
    void qc.invalidateQueries({ queryKey: ['conversations'] })
    void qc.invalidateQueries({ queryKey: ['daily'] })
  }

  const practising = mode !== 'listen'
  const visible = practising ? turns.slice(0, Math.min(pos + 1, turns.length)) : turns
  const current = turns[pos]

  return (
    <div className="space-y-4 pb-4">
      <PageHeader title={c.title_de} sub={c.title} back="/talk" />
      <Card className="space-y-2 !p-4 text-sm">
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="ustad">{c.cefr}</Badge>
          <Badge>{c.register === 'formal' ? 'Sie (formal)' : 'du (informal)'}</Badge>
          <Badge>{c.partner}</Badge>
        </div>
        <p className="text-muted">{c.setting}</p>
        <p>
          <span className="font-semibold">Goal: </span>
          {c.goal}
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-line/60 p-1" role="tablist">
        {MODES.map((x) => (
          <button key={x.m} role="tab" aria-selected={mode === x.m} onClick={() => choose(x.m)} className={`min-h-10 rounded-xl text-sm font-semibold ${mode === x.m ? 'bg-card text-ink shadow-sm' : 'text-muted'}`}>
            {x.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">{MODES.find((x) => x.m === mode)!.hint}</p>

      {practising && <Progress value={Math.min(pos, turns.length)} max={turns.length} />}

      <ol className="space-y-2.5">
        {visible.map((t, i) => (
          <Turn key={`${mode}-${i}`} id={i === visible.length - 1 ? 'turn-latest' : undefined} t={t} hidden={practising && i === pos && isLearner(t) && !finished} cue={mode === 'own'} showEn={showEn || (mode === 'own' && isLearner(t))} />
        ))}
      </ol>

      <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-[5] -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-paper/95 px-4 py-2.5 backdrop-blur">
        <button className="text-sm text-ustad underline underline-offset-2" onClick={() => setShowEn((v) => !v)}>
          {showEn ? 'Hide English' : 'Show English'}
        </button>
        {mode === 'listen' && (
          <Button className="ml-auto" variant="secondary" onClick={() => (playing ? ((stop.current = true), stopSpeaking()) : void playAll())}>
            {playing ? 'Stop' : 'Play all'}
          </Button>
        )}
        {practising && !finished && pos === 0 && current && !isLearner(current) && (
          <Button variant="secondary" onClick={startPractice}>
            Hear first line
          </Button>
        )}
        {practising && !finished && (
          <Button className="ml-auto" onClick={next}>
            {current && isLearner(current) ? 'I said it, show me' : 'Next'}
          </Button>
        )}
      </div>

      {mode === 'listen' && (
        <Button className="w-full" onClick={() => choose('roleplay')}>
          Ready: start roleplay
        </Button>
      )}

      {practising && finished && (
        <Card className="space-y-3">
          {saved ? (
            <>
              <p className="font-semibold">Saved. {mode === 'roleplay' ? 'Next time try Your words: same situation, your own sentences.' : 'Now use one line of it with a real person.'}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => choose(mode)}>
                  Again
                </Button>
                <Link to="/talk">
                  <Button className="w-full">More conversations</Button>
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="font-semibold">How did it go?</p>
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" onClick={() => save('smooth')}>
                  Smooth
                </Button>
                <Button variant="secondary" onClick={() => save('helped')}>
                  Some help
                </Button>
                <Button variant="secondary" onClick={() => save('hard')}>
                  Hard
                </Button>
              </div>
            </>
          )}
        </Card>
      )}

      {c.key_phrases.length > 0 && (
        <Card className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Key phrases</p>
          <ul className="space-y-2">
            {c.key_phrases.map((k) => (
              <li key={k.de} className="flex items-start justify-between gap-3">
                <div>
                  <p className="de font-medium" lang="de">
                    {k.de}
                  </p>
                  <p className="text-sm text-muted">{k.en}</p>
                </div>
                <SpeakButton text={k.de} label="" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {c.notes.length > 0 && (
        <div className="space-y-2">
          {c.notes.map((n) => (
            <p key={n} className="rounded-xl bg-saffron-soft px-3 py-2 text-sm">
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
