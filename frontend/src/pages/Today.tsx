import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { InstallHint } from '../components/InstallHint'
import { Loading } from '../components/Loading'
import { Card } from '../components/ui'
import { api } from '../lib/api'
import type { Daily, Dashboard } from '../lib/types'

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function Block({ to, title, urdu, detail, status, locked }: { to: string; title: string; urdu: string; detail: ReactNode; status: 'done' | 'open' | 'locked'; locked?: string }) {
  const body = (
    <div className={`flex items-center gap-4 rounded-2xl border border-line bg-card px-4 py-3.5 ${status === 'locked' ? 'opacity-55' : ''}`}>
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${status === 'done' ? 'bg-ustad text-paper' : 'border-2 border-line text-muted'}`}
        aria-hidden
      >
        {status === 'done' ? '✓' : status === 'locked' ? '·' : ''}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {urdu} <span className="font-normal text-muted">· {title}</span>
        </p>
        <p className="truncate text-sm text-muted">{status === 'locked' ? locked : detail}</p>
      </div>
      {status !== 'locked' && (
        <span className="text-ustad" aria-hidden>
          ›
        </span>
      )}
    </div>
  )
  return status === 'locked' ? (
    body
  ) : (
    <Link to={to} className="block">
      {body}
    </Link>
  )
}

function Metric({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  )
}

interface Step {
  to: string
  label: string
  sub: string
}

/** The single most useful next thing to do today, in loop order. */
function nextStep(d: Daily): Step | null {
  const sabaqCount = d.sabaq.new_items.length
  if (d.manzil.due_now > 0 && !d.manzil.unlocked) return { to: '/manzil', label: 'Start with review', sub: `${d.manzil.due_now} cards due` }
  if (d.manzil.unlocked && sabaqCount > 0 && !d.sabaq.done) return { to: '/sabaq', label: 'Learn new phrases', sub: `${sabaqCount} new today` }
  if (d.grammar && !d.grammar.practised_today) return { to: `/grammar/${d.grammar.code}`, label: 'Practise grammar', sub: d.grammar.title }
  if (!d.bolna.done && (d.sabaq.introduced_today.length > 0 || d.sabqi.length > 0)) return { to: '/bolna', label: 'Speak out loud', sub: 'Say today’s phrases from memory' }
  if (d.conversation && d.conversation.practised < 2) return { to: `/talk/${d.conversation.slug}`, label: 'Roleplay a conversation', sub: d.conversation.title_de }
  if (!d.missions.length) return { to: '/bahar', label: 'Plan a real-world mission', sub: 'One phrase with a real person' }
  if (d.manzil.due_now > 0) return { to: '/manzil', label: 'Clear remaining reviews', sub: `${d.manzil.due_now} cards due` }
  return null
}

const LEVELS = [
  { cefr: 'A1', from: 1, to: 12 },
  { cefr: 'A2', from: 13, to: 24 },
  { cefr: 'B1', from: 25, to: 36 },
]

function LevelPath({ week }: { week: number }) {
  return (
    <Link to="/kurs" className="block rounded-3xl border border-line bg-card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your path to B1</p>
        <p className="text-sm font-semibold text-ustad">Week {week} of 36 ›</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {LEVELS.map((l) => {
          const pct = Math.max(0, Math.min(100, ((week - l.from + 1) / (l.to - l.from + 1)) * 100))
          return (
            <div key={l.cefr}>
              <div className="h-2 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-ustad" style={{ width: `${pct}%` }} />
              </div>
              <p className={`mt-1 text-xs font-semibold ${week >= l.from ? 'text-ustad' : 'text-muted'}`}>{l.cefr}</p>
            </div>
          )
        })}
      </div>
    </Link>
  )
}

export default function Today() {
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => api<Daily>('/api/daily') })
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/api/stats/dashboard') })
  const d = daily.data
  const s = dash.data

  if (daily.isError && !d)
    return (
      <Card className="mt-10 space-y-2 text-center">
        <p className="font-semibold">Can’t reach Ustad right now.</p>
        <p className="text-sm text-muted">Your answers are kept on this phone and sent when you’re back online.</p>
      </Card>
    )
  if (!d || !s) return <Loading />

  const today = new Date(d.day + 'T12:00:00')
  const mission = d.missions.find((m) => m.status === 'planned') ?? d.missions[0]
  const sabaqCount = d.sabaq.new_items.length
  const step = nextStep(d)

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between pt-2">
        <div>
          <p className="text-sm text-muted">{today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="text-3xl font-bold tracking-tight">Aaj ka Sabaq</h1>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{s.streak.days}</p>
          <p className="text-xs text-muted">day streak</p>
        </div>
      </header>

      <InstallHint />

      {step ? (
        <Link to={step.to} className="flex items-center gap-4 rounded-3xl bg-ustad px-5 py-4 text-paper shadow-sm transition active:scale-[0.99]">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Continue</p>
            <p className="text-lg font-bold leading-tight">{step.label}</p>
            <p className="text-sm opacity-85">{step.sub}</p>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-paper/15 text-xl" aria-hidden>
            →
          </span>
        </Link>
      ) : (
        <Card className="text-center">
          <p className="text-lg font-semibold">Today’s loop is done.</p>
          <p className="text-sm text-muted">Use one phrase with a real person, or browse the Kurs.</p>
        </Card>
      )}

      <Card className="space-y-3 !p-4">
        <div className="flex justify-between">
          {s.week.map((w, i) => (
            <span
              key={w.day}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${w.study_day ? 'bg-ustad text-paper' : w.day === s.today ? 'border-2 border-ustad text-ustad' : 'bg-paper text-muted'}`}
              aria-label={`${w.day}${w.study_day ? ', study day' : ''}`}
            >
              {DAY_LETTERS[i]}
            </span>
          ))}
        </div>
        <p className="text-sm">
          {d.study_day ? (
            <span className="font-semibold text-good">Today counts as a study day.</span>
          ) : (
            <span className="text-muted">
              To count today: {d.manzil.unlocked ? '' : 'finish the review minimum, '}
              {d.produced >= 1 ? '' : 'say or type one German answer.'}
            </span>
          )}
        </p>
      </Card>

      <section className="space-y-2.5" aria-label="Daily blocks">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Today’s loop</h2>
        <Block
          to="/manzil"
          urdu="Manzil"
          title="Review"
          status={d.manzil.due_now === 0 ? 'done' : 'open'}
          detail={
            <>
              {d.manzil.due_now ? `${d.manzil.due_now} due` : 'Nothing due'}
              {!d.manzil.unlocked && ` · ${Math.min(d.manzil.reviewed_today, d.manzil.unlock_needed)}/${d.manzil.unlock_needed} to unlock Sabaq`}
            </>
          }
        />
        {d.sabqi.length > 0 && <Block to="/sabqi" urdu="Sabqi" title="Recent" status="open" detail={`${d.sabqi.length} recent or missed phrases`} />}
        <Block
          to="/sabaq"
          urdu="Sabaq"
          title="New phrases"
          status={!d.manzil.unlocked ? 'locked' : d.sabaq.done || (sabaqCount === 0 && d.sabaq.introduced_today.length > 0) ? 'done' : 'open'}
          locked="Unlocks after the review minimum"
          detail={sabaqCount ? `${sabaqCount} new phrases and words` : d.sabaq.introduced_today.length ? `${d.sabaq.introduced_today.length} learned today` : 'No new phrases today'}
        />
        {d.grammar && (
          <Block
            to={`/grammar/${d.grammar.code}`}
            urdu="Qaida"
            title="Grammar"
            status={d.grammar.practised_today ? 'done' : 'open'}
            detail={`${d.grammar.title}${d.grammar.accuracy !== null ? ` · ${d.grammar.accuracy}% recently` : ''}`}
          />
        )}
        <Block to="/bolna" urdu="Bolna" title="Speak" status={d.bolna.done ? 'done' : 'open'} detail="Repeat, reply, roleplay out loud" />
        {d.conversation && (
          <Block
            to={`/talk/${d.conversation.slug}`}
            urdu="Guftagu"
            title="Conversation"
            status={d.conversation.practised >= 2 ? 'done' : 'open'}
            detail={`${d.conversation.cefr} · ${d.conversation.title_de}`}
          />
        )}
        <Block
          to="/bahar"
          urdu="Bahar"
          title="Real world"
          status={mission?.status === 'done' ? 'done' : 'open'}
          detail={mission ? `“${mission.text}”` : 'Pick one phrase to use with a real person'}
        />
      </section>

      <LevelPath week={d.level.week} />

      <section aria-label="This week" className="space-y-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">This week</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Study days" value={`${s.study_days_this_week}/${s.target_study_days}`} />
          <Metric label="Speaking" value={`${s.speaking_minutes_this_week} min`} />
          <Metric label="Real-world tries" value={`${s.real_world_attempts_this_week}/${s.target_attempts}`} />
          <Metric label="Mature" value={s.mature_chunks} sub="phrases held 21+ days" />
        </div>
        <Card className="!p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next target</p>
          <p className="mt-1">{s.next_target}</p>
        </Card>
      </section>
    </div>
  )
}
