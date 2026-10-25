import { useState } from 'react'
import type { DialogueTurn } from '../lib/types'
import { Button, SpeakButton } from './ui'

const isLearner = (t: DialogueTurn) => t.who === 'Du'

/**
 * Mini-dialogue. In roleplay mode Danish's lines stay hidden until he has said them aloud,
 * the other speaker's lines can be heard and always have text (spec §5.4).
 */
export function Dialogue({ turns, roleplay = false, onDone }: { turns: DialogueTurn[]; roleplay?: boolean; onDone?: () => void }) {
  const [shown, setShown] = useState(roleplay ? 0 : turns.length)
  const [showEn, setShowEn] = useState(false)
  const visible = turns.slice(0, roleplay ? shown + 1 : turns.length)
  const current = turns[shown]
  const finished = shown >= turns.length

  return (
    <div className="space-y-3">
      <ol className="space-y-2.5">
        {visible.map((t, i) => {
          const hidden = roleplay && i === shown && isLearner(t)
          return (
            <li key={i} className={`flex ${isLearner(t) ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${isLearner(t) ? 'bg-ustad-soft' : 'border border-line bg-card'}`}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{t.who}</p>
                {hidden ? (
                  <p className="text-sm text-muted italic">Your turn. Say it aloud: “{t.en}”</p>
                ) : (
                  <>
                    <p className="de font-medium" lang="de">
                      {t.de}
                    </p>
                    {showEn && <p className="text-sm text-muted">{t.en}</p>}
                  </>
                )}
                {!hidden && !isLearner(t) && (
                  <div className="mt-1.5">
                    <SpeakButton text={t.de} />
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <button className="text-sm text-ustad underline underline-offset-2" onClick={() => setShowEn((v) => !v)}>
          {showEn ? 'Hide English' : 'Show English'}
        </button>
        {roleplay && !finished && (
          <Button className="ml-auto" onClick={() => setShown((s) => s + 1)}>
            {current && isLearner(current) ? 'I said it, show me' : 'Next'}
          </Button>
        )}
        {roleplay && finished && onDone && (
          <Button className="ml-auto" onClick={onDone}>
            Done
          </Button>
        )}
      </div>
    </div>
  )
}
