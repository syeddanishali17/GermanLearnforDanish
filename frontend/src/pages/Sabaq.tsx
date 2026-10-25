import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialogue } from '../components/Dialogue'
import { Badge, Button, Card, German, ItemNotes, PageHeader, Progress, RatingBar, ReportButton, SpeakPair } from '../components/ui'
import { ACTION_LABEL } from '../lib/labels'
import { flushActivity, useActivityMode } from '../lib/activity'
import { api } from '../lib/api'
import { gradeTyped, type GradeResult } from '../lib/grade'
import { send } from '../lib/outbox'
import type { Daily, Item, Rating } from '../lib/types'

type Step = 'meet' | 'repeat' | 'reply' | 'recall'

/** Sabaq: a block of new chunks. Each goes hear → read → repeat → likely reply → hide → say from memory (spec §5.4 mode 1). */
export default function Sabaq() {
  useActivityMode('speaking')
  const qc = useQueryClient()
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => api<Daily>('/api/daily'), staleTime: Infinity })
  // Freeze today's list once loaded so items don't vanish as they get introduced.
  const [items, setItems] = useState<Item[] | null>(null)
  if (items === null && daily.data) setItems(daily.data.sabaq.new_items)

  const [idx, setIdx] = useState(0)
  const [step, setStep] = useState<Step>('meet')
  const [typed, setTyped] = useState('')
  const [grade, setGrade] = useState<GradeResult | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [phase, setPhase] = useState<'learn' | 'dialogue' | 'done'>('learn')
  const [dlgIdx, setDlgIdx] = useState(0)

  const dialogues = useMemo(() => (items ?? []).filter((i) => i.mini_dialogue.length > 0), [items])

  if (!daily.data || items === null) return <p className="pt-10 text-center text-muted">Loading…</p>

  if (!daily.data.manzil.unlocked)
    return (
      <div>
        <PageHeader title="Sabaq" sub="New phrases" />
        <Card className="space-y-3">
          <p>Revision first. Finish {daily.data.manzil.unlock_needed} Manzil reviews (or 4 minutes) to unlock today's Sabaq.</p>
          <Link to="/manzil">
            <Button className="w-full">Go to Manzil</Button>
          </Link>
        </Card>
      </div>
    )

  function finish() {
    setPhase('done')
    flushActivity({ block_done: 'sabaq' })
    void qc.invalidateQueries({ queryKey: ['daily'] })
  }

  if (items.length === 0 || phase === 'done')
    return (
      <div>
        <PageHeader title="Sabaq" sub="New phrases" />
        <Card className="space-y-3">
          <p className="text-lg font-semibold">{items.length ? `${items.length} new chunks learned.` : 'No new chunks today.'}</p>
          <p className="text-muted">
            {items.length
              ? 'Now use them: Bolna to speak them, then one Bahar Mission outside.'
              : "You have reached today's new-phrase limit, or the review backlog is high. That protects tomorrow's workload."}
          </p>
          <Link to="/bolna">
            <Button className="w-full">Go to Bolna</Button>
          </Link>
          {items.length === 0 && !daily.data.sabaq.done && (
            <Button variant="secondary" className="w-full" onClick={finish}>
              Mark Sabaq done
            </Button>
          )}
        </Card>
      </div>
    )

  if (phase === 'dialogue') {
    const it = dialogues[dlgIdx]
    return (
      <div className="space-y-4">
        <PageHeader title="Mini-dialogue" sub={`Roleplay ${dlgIdx + 1} of ${dialogues.length}. Say your lines aloud before you reveal them.`} />
        <Card>
          <Dialogue key={it.id} turns={it.mini_dialogue} roleplay onDone={() => (dlgIdx + 1 < dialogues.length ? setDlgIdx(dlgIdx + 1) : finish())} />
        </Card>
        <Button variant="ghost" className="w-full" onClick={finish}>
          Skip dialogues
        </Button>
      </div>
    )
  }

  const item = items[idx]
  const steps: Step[] = item.likely_reply_de ? ['meet', 'repeat', 'reply', 'recall'] : ['meet', 'repeat', 'recall']
  const recognitionOnly = item.learner_action !== 'use_now'

  function nextStep() {
    const k = steps.indexOf(step)
    setStep(steps[k + 1])
  }

  function rate(r: Rating) {
    void send('/api/sabaq/introduce', { item_id: item.id, rating: r, answer_given: typed || null, answer_mode: typed ? 'typed' : 'spoken' })
    setTyped('')
    setGrade(null)
    setRevealed(false)
    setStep('meet')
    if (idx + 1 < items!.length) setIdx(idx + 1)
    else if (dialogues.length) setPhase('dialogue')
    else finish()
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Sabaq" sub={`Chunk ${idx + 1} of ${items.length}`} />
      <Progress value={idx * steps.length + steps.indexOf(step)} max={items.length * steps.length} />

      <Card className="space-y-4">
        <div className="flex flex-wrap gap-1.5">
          {item.register !== 'neutral' && <Badge>{item.register}</Badge>}
          {item.region_tag !== 'standard' && <Badge tone="saffron">{item.region_tag === 'dach' ? 'DACH' : item.region_tag}</Badge>}
          {recognitionOnly && <Badge tone="ustad">{ACTION_LABEL[item.learner_action]}</Badge>}
        </div>

        {step === 'meet' && (
          <>
            <p className="text-sm font-semibold text-muted">1 · Hear and read</p>
            <German item={item} size="2xl" />
            <p className="text-lg">{item.en}</p>
            <SpeakPair text={item.de} />
            <ItemNotes item={item} />
            <Button className="w-full" onClick={nextStep}>
              Next
            </Button>
          </>
        )}

        {step === 'repeat' && (
          <>
            <p className="text-sm font-semibold text-muted">2 · Say it aloud 3 times</p>
            <German item={item} size="2xl" />
            <SpeakPair text={item.de} />
            <p className="text-sm text-muted">Listen, then copy the rhythm. Clear beats fast.</p>
            <Button className="w-full" onClick={nextStep}>
              I said it 3 times
            </Button>
          </>
        )}

        {step === 'reply' && (
          <>
            <p className="text-sm font-semibold text-muted">3 · What they will probably say back</p>
            <p className="de text-xl font-semibold" lang="de">
              {item.likely_reply_de}
            </p>
            <p>{item.likely_reply_en}</p>
            <SpeakPair text={item.likely_reply_de!} />
            <Button className="w-full" onClick={nextStep}>
              Next
            </Button>
          </>
        )}

        {step === 'recall' && (
          <>
            <p className="text-sm font-semibold text-muted">{steps.length} · {recognitionOnly ? 'Hear it. What does it mean?' : 'Text hidden. Say it from memory'}</p>
            {recognitionOnly ? <SpeakPair text={item.de} /> : <p className="text-xl font-semibold">{item.en}</p>}
            {!revealed && !recognitionOnly && (
              <input
                className="min-h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base"
                placeholder="Say it aloud, or type it (optional)"
                lang="de"
                autoCorrect="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
            )}
            {!revealed ? (
              <Button
                className="w-full"
                onClick={() => {
                  if (typed.trim()) setGrade(gradeTyped(typed, [item.de, ...item.alt_de]))
                  setRevealed(true)
                }}
              >
                {typed ? 'Check' : recognitionOnly ? 'Show answer' : 'I said it. Show answer'}
              </Button>
            ) : (
              <div className="space-y-2 border-t border-line pt-3">
                <German item={item} />
                <p>{item.en}</p>
                {grade && (
                  <p className={`text-sm font-semibold ${grade.verdict === 'exact' ? 'text-good' : grade.verdict === 'close' ? 'text-hard' : 'text-again'}`}>
                    {grade.verdict === 'exact' ? 'Correct.' : grade.verdict === 'close' ? 'Close. Check the difference.' : 'Not yet. It will come back soon.'}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {step === 'recall' && revealed && (
        <div className="space-y-3">
          <p className="text-sm text-muted">How well did you remember it?</p>
          <RatingBar onRate={rate} suggested={grade?.suggested} />
        </div>
      )}
      <ReportButton key={item.id} itemId={item.id} />
    </div>
  )
}
