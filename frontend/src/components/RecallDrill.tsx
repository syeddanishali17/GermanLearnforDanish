import { useState } from 'react'
import { send } from '../lib/outbox'
import type { Item } from '../lib/types'
import { Button, Card, German, Progress, SpeakPair } from './ui'

/**
 * Practice drill that does not touch the FSRS schedule: English cue → say it aloud → check.
 * mode "reply": hear the likely reply first, then answer it (expected-reply training, spec §5.4 mode 2).
 */
export function RecallDrill({ items, mode = 'recall', onDone }: { items: Item[]; mode?: 'recall' | 'reply'; onDone: (stats: { got: number; total: number }) => void }) {
  const [i, setI] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [got, setGot] = useState(0)
  const item = items[i]
  if (!item) return null

  function next(ok: boolean) {
    void send('/api/activity', { produced: 1 })
    const g = got + (ok ? 1 : 0)
    setGot(g)
    setRevealed(false)
    if (i + 1 < items.length) setI(i + 1)
    else onDone({ got: g, total: items.length })
  }

  return (
    <div className="space-y-4">
      <Progress value={i} max={items.length} />
      <Card className="space-y-4">
        {mode === 'reply' && item.likely_reply_de ? (
          <>
            <p className="text-sm text-muted">You said “{item.de}”. They answer:</p>
            <p className="de text-xl font-semibold" lang="de">
              {item.likely_reply_de}
            </p>
            <SpeakPair text={item.likely_reply_de} />
            <p className="text-sm font-semibold text-muted">What does it mean? Say a short answer aloud.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-muted">Say it in German</p>
            <p className="text-xl font-semibold">{item.en}</p>
            {item.context && <p className="text-sm text-muted">{item.context}</p>}
          </>
        )}
        {!revealed ? (
          <Button className="w-full" onClick={() => setRevealed(true)}>
            I said it. Show me
          </Button>
        ) : (
          <div className="space-y-3 border-t border-line pt-3">
            {mode === 'reply' && item.likely_reply_de ? (
              <p className="text-lg">{item.likely_reply_en}</p>
            ) : (
              <>
                <German item={item} size="2xl" />
                <SpeakPair text={item.de} />
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => next(false)}>
                Not yet
              </Button>
              <Button onClick={() => next(true)}>Got it</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
