/** Day log, study-day rule, streak with freezes, dashboard numbers (spec §4, §6.2, §7). */

import { addDays, dayStart, isoWeek, isoWeekday, localDay } from './clock'
import type { Content } from './content'
import { all, bool, one, run } from './db'
import { dueQueue, MANZIL_UNLOCK_CARDS, MANZIL_UNLOCK_SECONDS, matureCount, recentLapseItems, reviewsToday, type Profile } from './srs'

export const FREEZES_PER_WEEK = 2

export interface DayLog {
  day: string
  manzil_done: number
  sabaq_done: number
  bolna_done: number
  produced: number
  study_day: number
  active_s: number
  speaking_s: number
  manzil_s: number
  real_world_attempts: number
}

export async function ensureDay(db: D1Database, day: string): Promise<void> {
  await run(db, 'INSERT OR IGNORE INTO day_log (day) VALUES (?)', day)
}

export async function addToDay(db: D1Database, day: string, fields: Partial<Record<'produced' | 'active_s' | 'speaking_s' | 'manzil_s', number>>) {
  await ensureDay(db, day)
  for (const [k, v] of Object.entries(fields)) if (v) await run(db, `UPDATE day_log SET ${k} = ${k} + ? WHERE day = ?`, v, day)
}

export async function markBlock(db: D1Database, day: string, block: 'sabaq' | 'bolna') {
  await ensureDay(db, day)
  await run(db, `UPDATE day_log SET ${block}_done = 1 WHERE day = ?`, day)
}

/** Recompute today's Manzil unlock and study-day flags. Minimum day = Manzil unlock + 1 production answer. */
export async function refreshDay(db: D1Database, content: Content, profile: Profile, now: number): Promise<DayLog> {
  const day = localDay(now)
  await ensureDay(db, day)
  const row = (await one<DayLog>(db, 'SELECT * FROM day_log WHERE day = ?', day))!
  const reviewed = await reviewsToday(db, now, 'manzil')
  const remaining = (await dueQueue(db, content, profile, now, 1)).length
  const manzil = remaining === 0 || reviewed >= MANZIL_UNLOCK_CARDS || row.manzil_s >= MANZIL_UNLOCK_SECONDS
  const attempts =
    (await one<{ n: number }>(db, "SELECT COUNT(*) AS n FROM mission WHERE logged_at >= ? AND outcome IN ('tried','exchange','conversation')", dayStart(day)))?.n ?? 0
  const study = manzil && row.produced >= 1
  await run(db, 'UPDATE day_log SET manzil_done = ?, real_world_attempts = ?, study_day = ? WHERE day = ?', +manzil, attempts, +study, day)
  return { ...row, manzil_done: +manzil, real_world_attempts: attempts, study_day: +study }
}

export const weekDays = (today: string) => Array.from({ length: 7 }, (_, i) => addDays(today, i - (isoWeekday(today) - 1)))

/** Consecutive study days back from today; up to 2 missed days per ISO week are frozen. Today only counts once done. */
export async function streak(db: D1Database, today: string) {
  const logs = new Map((await all<DayLog>(db, 'SELECT * FROM day_log WHERE day >= ?', addDays(today, -400))).map((r) => [r.day, r]))
  const first = [...logs.keys()].sort()[0] ?? today
  const frozen = new Map<string, number>()
  let count = 0
  let d = bool(logs.get(today)?.study_day) ? today : addDays(today, -1)
  while (d >= first) {
    if (bool(logs.get(d)?.study_day)) count++
    else {
      const wk = isoWeek(d)
      if ((frozen.get(wk) ?? 0) >= FREEZES_PER_WEEK) break
      frozen.set(wk, (frozen.get(wk) ?? 0) + 1)
    }
    d = addDays(d, -1)
  }
  return { days: count, freezes_used_this_week: frozen.get(isoWeek(today)) ?? 0 }
}

export async function studyDaysLast7(db: D1Database, today: string): Promise<number> {
  return (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM day_log WHERE day > ? AND day <= ? AND study_day = 1', addDays(today, -7), today))?.n ?? 0
}

export async function dashboard(db: D1Database, content: Content, profile: Profile, now: number) {
  const today = localDay(now)
  await refreshDay(db, content, profile, now)
  const days = weekDays(today)
  const logs = new Map((await all<DayLog>(db, `SELECT * FROM day_log WHERE day >= ? AND day <= ?`, days[0], days[6])).map((r) => [r.day, r]))
  const rows = [...logs.values()]
  const attempts = rows.reduce((s, r) => s + r.real_world_attempts, 0)
  const lapses = await recentLapseItems(db, content, now, 7)
  const target =
    attempts < profile.weekly_target_attempts
      ? `Real-world attempts: ${attempts} of ${profile.weekly_target_attempts} this week. Try today's Bahar Mission.`
      : lapses.length
        ? `Weak spot: "${lapses[0].de}". It comes back in Sabqi.`
        : 'Keep the daily loop. Add one 2-turn exchange this week.'
  return {
    today,
    week: days.map((d) => ({ day: d, study_day: bool(logs.get(d)?.study_day) })),
    study_days_this_week: rows.filter((r) => bool(r.study_day)).length,
    target_study_days: profile.weekly_target_days,
    speaking_minutes_this_week: Math.round(rows.reduce((s, r) => s + r.speaking_s, 0) / 60),
    real_world_attempts_this_week: attempts,
    target_attempts: profile.weekly_target_attempts,
    mature_chunks: await matureCount(db, content),
    streak: await streak(db, today),
    next_target: target,
  }
}
