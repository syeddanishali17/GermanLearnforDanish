import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, Progress } from '../components/ui'
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
      {status !== 'locked' && <span className="text-ustad" aria-hidden>›</span>}
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

export default function Today() {
  const daily = useQuery({ queryKey: ['daily'], queryFn: () => api<Daily>('/api/daily') })
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api<Dashboard>('/api/stats/dashboard') })
  const d = daily.data
  const s = dash.data

  if (daily.isError) return <p className="pt-10 text-center text-muted">Can't reach Ustad right now. Your answers are kept and sent when you're back online.</p>
  if (!d || !s) return <p className="pt-10 text-center text-muted">Loading…</p>

  const today = new Date(d.day + 'T12:00:00')
  const mission = d.missions.find((m) => m.status === 'planned') ?? d.missions[0]
  const sabaqCount = d.sabaq.new_items.length

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

      <Card className="space-y-3 !p-4">
        <div className="flex justify-between">
          {s.week.map((w, i) => (
            <div key={w.day} className="flex flex-col items-center gap-1">
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${w.study_day ? 'bg-ustad text-paper' : w.day === s.today ? 'border-2 border-ustad text-ustad' : 'bg-paper text-muted'}`}>
                {DAY_LETTERS[i]}
              </span>
            </div>
          ))}
        </div>
        <p className="text-sm">
          {d.study_day ? (
            <span className="font-semibold text-good">Today counts as a study day.</span>
          ) : (
            <span className="text-muted">
              To count today: {d.manzil.unlocked ? '' : 'finish the Manzil minimum, '}
              {d.produced >= 1 ? '' : 'say or type one German answer.'}
            </span>
          )}
        </p>
      </Card>

      <section className="space-y-2.5" aria-label="Daily blocks">
        <Block
          to="/manzil"
          urdu="Manzil"
          title="Review"
          status={d.manzil.due_now === 0 ? 'done' : 'open'}
          detail={
            <>
              {d.manzil.due_now} due
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
          locked="Unlocks after the Manzil minimum"
          detail={sabaqCount ? `${sabaqCount} new chunks` : d.sabaq.introduced_today.length ? `${d.sabaq.introduced_today.length} learned today` : 'No new chunks today'}
        />
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
          urdu="Bahar Mission"
          title="Real world"
          status={mission?.status === 'done' ? 'done' : 'open'}
          detail={mission ? `“${mission.text}”` : 'Pick one phrase to use with a real person'}
        />
      </section>

      <section aria-label="This week" className="space-y-2.5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">This week</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Study days" value={`${s.study_days_this_week}/${s.target_study_days}`} />
          <Metric label="Speaking" value={`${s.speaking_minutes_this_week} min`} />
          <Metric label="Real-world tries" value={`${s.real_world_attempts_this_week}/${s.target_attempts}`} />
          <Metric label="Mature chunks" value={s.mature_chunks} sub="held 21+ days" />
        </div>
        <Card className="!p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Next target</p>
          <p className="mt-1">{s.next_target}</p>
        </Card>
        <div className="flex items-center gap-2 text-xs text-muted">
          <Badge>
            Week {d.level.week} · {d.level.cefr}
          </Badge>
          <Progress value={s.study_days_this_week} max={s.target_study_days} />
        </div>
      </section>
    </div>
  )
}
