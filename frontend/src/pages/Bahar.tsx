import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Card, PageHeader } from '../components/ui'
import { api, post } from '../lib/api'
import type { Daily, Mission } from '../lib/types'
import { Loading } from '../components/Loading'

const SITUATIONS = ['university', 'supermarket', 'canteen/café', 'transport', 'dorm', 'appointment', 'social', 'other']

const OUTCOMES: { v: NonNullable<Mission['outcome']>; label: string }[] = [
  { v: 'no_chance', label: 'No opportunity' },
  { v: 'tried', label: 'Tried one phrase' },
  { v: 'exchange', label: 'Short exchange' },
  { v: 'conversation', label: 'Conversation' },
]

type Phrase = [de: string, en: string]

/** Ready-made mission phrases per place. All of them are in the phrase decks, so they have audio and practice. */
const BY_SITUATION: Record<string, Phrase[]> = {
  university: [
    ['Ist hier frei?', 'Is this seat free?'],
    ['Hast du die Folien?', 'Do you have the slides?'],
    ['Entschuldigung, ich habe eine Frage.', 'Excuse me, I have a question.'],
    ['Bis morgen!', 'See you tomorrow!'],
  ],
  supermarket: [
    ['Mit Karte, bitte.', 'By card, please.'],
    ['Wo finde ich Reis?', 'Where can I find rice?'],
    ["Das war's, danke.", 'That’s all, thanks.'],
    ['Schönen Tag noch!', 'Have a nice day!'],
  ],
  'canteen/café': [
    ['Guten Appetit!', 'Enjoy your meal!'],
    ['Eine Melange, bitte.', 'A Melange, please.'],
    ['Ist da Schweinefleisch drin?', 'Is there pork in it?'],
    ['Zahlen, bitte!', 'The bill, please!'],
  ],
  transport: [
    ['Darf ich bitte vorbei?', 'Can I get past, please?'],
    ['Entschuldigung, wo ist die U-Bahn?', 'Excuse me, where is the U-Bahn?'],
    ['Ist das weit?', 'Is it far?'],
  ],
  dorm: [
    ['Hallo, ich wohne seit Kurzem hier.', 'Hi, I’ve only just moved in.'],
    ['Die Heizung funktioniert nicht.', 'The heating isn’t working.'],
    ['Wo ist die Waschküche?', 'Where is the laundry room?'],
  ],
  appointment: [
    ['Ich möchte einen Termin ausmachen.', 'I’d like to make an appointment.'],
    ['Hier ist meine e-card.', 'Here is my e-card.'],
    ['Können Sie bitte langsamer sprechen?', 'Can you speak more slowly, please?'],
  ],
  social: [
    ['Wie war dein Wochenende?', 'How was your weekend?'],
    ['Woher kommst du?', 'Where are you from?'],
    ['Hast du Zeit für einen Kaffee?', 'Do you have time for a coffee?'],
  ],
  other: [
    ['Guten Morgen!', 'Good morning!'],
    ['Danke, gleichfalls!', 'Thanks, same to you!'],
    ['Schönen Tag noch!', 'Have a nice day!'],
    ['Entschuldigung, ich lerne noch Deutsch.', 'Sorry, I’m still learning German.'],
  ],
}

function Chips<T extends string>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`min-h-10 rounded-full border px-3.5 text-sm font-medium ${value === o.v ? 'border-ustad bg-ustad text-paper' : 'border-line bg-card'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function LogForm({ m, onSaved }: { m: Mission; onSaved: () => void }) {
  const [outcome, setOutcome] = useState<Mission['outcome']>(null)
  const [understood, setUnderstood] = useState<'yes' | 'partly' | 'no' | null>(null)
  const [english, setEnglish] = useState<'yes' | 'no' | null>(null)
  const [reply, setReply] = useState('')
  const save = useMutation({
    mutationFn: () =>
      api(`/api/missions/${m.id}`, {
        method: 'PATCH',
        json: {
          outcome,
          understood_reply: understood === null ? null : understood !== 'no',
          switched_to_english: english === null ? null : english === 'yes',
          reply_heard: reply || null,
          notes: understood === 'partly' ? 'understood partly' : null,
        },
      }),
    onSuccess: onSaved,
  })
  const tried = outcome && outcome !== 'no_chance'
  return (
    <div className="space-y-4">
      <p className="font-semibold">Did you use German with anyone?</p>
      <Chips options={OUTCOMES} value={outcome} onChange={setOutcome} />
      {tried && (
        <>
          <p className="font-semibold">Did you understand the reply?</p>
          <Chips
            options={[
              { v: 'yes', label: 'Yes' },
              { v: 'partly', label: 'Partly' },
              { v: 'no', label: 'No' },
            ]}
            value={understood}
            onChange={setUnderstood}
          />
          <p className="font-semibold">Did it switch to English?</p>
          <Chips
            options={[
              { v: 'no', label: 'No, stayed German' },
              { v: 'yes', label: 'Yes' },
            ]}
            value={english}
            onChange={setEnglish}
          />
          <label className="block space-y-1.5">
            <span className="font-semibold">What did they say back? (optional)</span>
            <textarea
              rows={2}
              lang="de"
              className="w-full rounded-2xl border border-line bg-paper p-3"
              placeholder="Write what you remember, even half of it"
              value={reply}
              onChange={(e) => setReply(e.target.value)}
            />
          </label>
        </>
      )}
      <Button className="w-full" disabled={!outcome || save.isPending} onClick={() => save.mutate()}>
        Save
      </Button>
      {tried && <p className="text-sm text-muted">An attempt counts even if it went badly. Recovery phrases count as German.</p>}
    </div>
  )
}

export default function Bahar() {
  const qc = useQueryClient()
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => api<Daily>('/api/daily') })
  const history = useQuery({ queryKey: ['missions'], queryFn: () => api<Mission[]>('/api/missions') })
  const [text, setText] = useState('')
  const [situation, setSituation] = useState('other')
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['daily'] })
    void qc.invalidateQueries({ queryKey: ['missions'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const create = useMutation({ mutationFn: (body: { text: string; item_id?: string; situation: string }) => post<Mission>('/api/missions', body), onSuccess: refresh })

  if (!daily.data) return <Loading />
  const planned = daily.data.missions.filter((m) => m.status === 'planned')
  const fromToday = [...daily.data.sabaq.introduced_today, ...daily.data.sabqi].filter((i) => i.learner_action === 'use_now').slice(0, 6)
  const learned = fromToday.map((i) => ({ text: i.de, id: i.id as string | undefined, hint: i.en }))
  const forPlace = (BY_SITUATION[situation] ?? BY_SITUATION.other)
    .filter(([de]) => !learned.some((l) => l.text === de))
    .map(([de, en]) => ({ text: de, id: undefined, hint: en }))

  return (
    <div className="space-y-5">
      <PageHeader title="Bahar Mission" sub="One small piece of German with a real person today." back={null} />

      {planned.map((m) => (
        <Card key={m.id} className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Today's mission · {m.situation}</p>
            <p className="de mt-1 text-2xl font-semibold" lang="de">
              {m.text}
            </p>
          </div>
          <LogForm m={m} onSaved={refresh} />
        </Card>
      ))}

      {planned.length === 0 && (
        <Card className="space-y-4">
          <p className="font-semibold">Where will you speak German today?</p>
          <Chips options={SITUATIONS.map((s) => ({ v: s, label: s }))} value={situation} onChange={setSituation} />
          <div>
            <p className="font-semibold">Pick a phrase</p>
            <p className="text-sm text-muted">Tap one to make it today’s mission. Small is fine: one phrase counts.</p>
          </div>
          {learned.length > 0 && <p className="text-xs font-semibold uppercase tracking-wide text-muted">Learned today</p>}
          <div className="space-y-2">
            {[...learned, ...forPlace].map((s, n) => (
              <button
                key={s.text}
                onClick={() => create.mutate({ text: s.text, item_id: s.id, situation })}
                className="block w-full rounded-2xl border border-line bg-paper px-4 py-3 text-left"
              >
                <span className="de font-semibold" lang="de">
                  {s.text}
                </span>
                {s.hint && <span className="block text-sm text-muted">{s.hint}</span>}
                {n === learned.length - 1 && learned.length > 0 && <span className="sr-only">End of today’s phrases</span>}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="min-h-12 flex-1 rounded-2xl border border-line bg-paper px-4"
              placeholder="Or write your own"
              lang="de"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button disabled={!text.trim()} onClick={() => create.mutate({ text: text.trim(), situation })}>
              Add
            </Button>
          </div>
        </Card>
      )}

      {history.data && history.data.some((m) => m.status !== 'planned') && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Recent</h2>
          {history.data
            .filter((m) => m.status !== 'planned')
            .slice(0, 10)
            .map((m) => (
              <div key={m.id} className="rounded-2xl border border-line bg-card px-4 py-3">
                <p className="de font-medium" lang="de">
                  {m.text}
                </p>
                <p className="text-sm text-muted">
                  {m.day} · {OUTCOMES.find((o) => o.v === m.outcome)?.label}
                  {m.understood_reply === false && ' · reply not understood'}
                </p>
                {m.reply_heard && (
                  <p className="mt-1 text-sm" lang="de">
                    Heard: “{m.reply_heard}”
                  </p>
                )}
              </div>
            ))}
        </section>
      )}
    </div>
  )
}
