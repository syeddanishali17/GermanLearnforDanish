import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, German, ItemNotes, PageHeader, Progress, RatingBar, ReportButton, SpeakPair } from '../components/ui'
import { useActivityMode } from '../lib/activity'
import { api } from '../lib/api'
import { gradeTyped, type GradeResult } from '../lib/grade'
import { flush, send } from '../lib/outbox'
import { speak } from '../lib/speech'
import type { Daily, Rating, ReviewCard } from '../lib/types'
import { Loading } from '../components/Loading'

const MAX_SHOWS = 3 // P4: no cramming loops

const PROMPT: Record<ReviewCard['card_type'], string> = {
  recognise: 'What does it mean?',
  produce: 'Say it in German',
  reply: 'They answer. What does it mean?',
}

export default function Manzil() {
  useActivityMode('manzil')
  const qc = useQueryClient()
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => api<Daily>('/api/daily') })
  const [queue, setQueue] = useState<ReviewCard[] | null>(null)
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [typed, setTyped] = useState('')
  const [grade, setGrade] = useState<GradeResult | null>(null)
  const [showReplyText, setShowReplyText] = useState(false)
  const [doneCount, setDoneCount] = useState(0)
  const shows = useRef(new Map<number, number>())
  const started = useRef(0)

  async function load() {
    await flush().catch(() => undefined)
    const cards = await api<ReviewCard[]>('/api/review/queue?limit=60').catch(() => [] as ReviewCard[])
    setQueue(cards.filter((c) => (shows.current.get(c.id) ?? 0) < MAX_SHOWS))
    started.current = Date.now()
    setI(0)
  }

  useEffect(() => {
    void load()
  }, [])

  const card = queue?.[i]
  const unlockNeeded = daily.data?.manzil.unlock_needed ?? 10
  const reviewedBefore = daily.data?.manzil.reviewed_today ?? 0

  function reset() {
    setRevealed(false)
    setTyped('')
    setGrade(null)
    setShowReplyText(false)
    started.current = Date.now()
  }

  function reveal() {
    if (card && card.card_type === 'produce' && typed.trim()) setGrade(gradeTyped(typed, [card.item.de, ...card.item.alt_de]))
    setRevealed(true)
    // Hear the model answer right when it is revealed (inside the tap, so iOS plays it).
    if (card?.card_type === 'produce') void speak(card.item.de)
  }

  /** Cards whose prompt is audio start playing as soon as they appear. */
  function playPrompt(c: ReviewCard | undefined) {
    if (c?.card_type === 'recognise') void speak(c.item.de)
    if (c?.card_type === 'reply' && c.item.likely_reply_de) void speak(c.item.likely_reply_de)
  }

  async function rate(r: Rating) {
    if (!card || !queue) return
    const n = (shows.current.get(card.id) ?? 0) + 1
    shows.current.set(card.id, n)
    void send('/api/review/answers', {
      card_id: card.id,
      rating: r,
      answer_given: typed || null,
      answer_mode: card.card_type === 'produce' ? (typed ? 'typed' : 'spoken') : 'self',
      elapsed_ms: Date.now() - started.current,
      block: 'manzil',
    })
    setDoneCount((c) => c + 1)
    let next = queue
    if (r === 1 && n < MAX_SHOWS) {
      // Missed: see it again a few cards later in this session.
      next = [...queue]
      next.splice(Math.min(i + 4, next.length), 0, card)
      setQueue(next)
    }
    reset()
    if (i + 1 < next.length) {
      setI(i + 1)
      playPrompt(next[i + 1])
    } else {
      setQueue(null)
      await load()
      void qc.invalidateQueries({ queryKey: ['daily'] })
    }
  }

  if (queue === null) return <Loading label="Loading reviews" />

  if (!card)
    return (
      <div>
        <PageHeader title="Manzil" sub="Review" />
        <Card className="space-y-4 text-center">
          <p className="text-4xl" aria-hidden>
            ✓
          </p>
          <p className="text-lg font-semibold">{doneCount ? `${doneCount} reviews done.` : 'Nothing due right now.'}</p>
          <p className="text-muted">Cards you missed come back later today or tomorrow. The scheduler decides.</p>
          <div className="flex flex-col gap-2">
            <Link to="/sabaq">
              <Button className="w-full">Go to Sabaq</Button>
            </Link>
            <Link to="/">
              <Button variant="secondary" className="w-full">
                Back to today
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    )

  const item = card.item
  const unlockedNow = reviewedBefore + doneCount >= unlockNeeded

  return (
    <div className="space-y-4">
      <PageHeader title="Manzil" sub={unlockedNow ? 'Sabaq is unlocked. Keep going or stop any time.' : `${reviewedBefore + doneCount}/${unlockNeeded} to unlock Sabaq`} />
      <Progress value={i} max={queue.length} />

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge tone="ustad">{PROMPT[card.card_type]}</Badge>
          {item.register !== 'neutral' && <Badge>{item.register}</Badge>}
        </div>

        {card.card_type === 'recognise' && (
          <>
            <German item={item} size="2xl" />
            <SpeakPair text={item.de} />
          </>
        )}

        {card.card_type === 'produce' && (
          <>
            <p className="text-xl font-semibold">{item.en}</p>
            {item.context && <p className="text-sm text-muted">{item.context}</p>}
            {!revealed && (
              <input
                className="min-h-12 w-full rounded-2xl border border-line bg-paper px-4 text-base"
                placeholder="Say it aloud, or type it (optional)"
                lang="de"
                autoCapitalize="sentences"
                autoCorrect="off"
                spellCheck={false}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && reveal()}
              />
            )}
          </>
        )}

        {card.card_type === 'reply' && (
          <>
            <p className="text-sm text-muted">You say:</p>
            <p className="de text-lg font-semibold" lang="de">
              {item.de}
            </p>
            <p className="text-sm text-muted">They reply:</p>
            <SpeakPair text={item.likely_reply_de ?? ''} />
            {showReplyText || revealed ? (
              <p className="de text-xl font-semibold" lang="de">
                {item.likely_reply_de}
              </p>
            ) : (
              <button className="text-sm text-ustad underline underline-offset-2" onClick={() => setShowReplyText(true)}>
                Show transcript
              </button>
            )}
          </>
        )}

        {!revealed ? (
          <Button className="w-full" onClick={reveal}>
            {card.card_type === 'produce' ? (typed ? 'Check' : 'I said it. Show answer') : 'Show answer'}
          </Button>
        ) : (
          <div className="space-y-3 border-t border-line pt-4">
            {card.card_type === 'produce' && (
              <>
                <German item={item} size="2xl" />
                <SpeakPair text={item.de} />
                {grade && (
                  <p className={`text-sm font-semibold ${grade.verdict === 'exact' ? 'text-good' : grade.verdict === 'close' ? 'text-hard' : 'text-again'}`}>
                    {grade.verdict === 'exact' ? 'Correct.' : grade.verdict === 'close' ? `Close. You typed: “${typed}”` : `Not yet. You typed: “${typed}”`}
                  </p>
                )}
              </>
            )}
            {card.card_type === 'reply' ? <p className="text-lg">{item.likely_reply_en}</p> : card.card_type === 'recognise' && <p className="text-xl font-semibold">{item.en}</p>}
            <ItemNotes item={card.card_type === 'produce' ? { ...item, context: '' } : item} />
            {card.card_type !== 'reply' && item.likely_reply_de && (
              <p className="text-sm">
                <span className="text-muted">Likely reply: </span>
                <span lang="de" className="font-medium">
                  {item.likely_reply_de}
                </span>
              </p>
            )}
          </div>
        )}
      </Card>

      {revealed && (
        <div className="space-y-3">
          <RatingBar onRate={rate} suggested={grade?.suggested} />
          <ReportButton key={item.id} itemId={item.id} />
        </div>
      )}
    </div>
  )
}
