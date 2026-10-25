/** Course structure (36 weeks), grammar mastery and the daily grammar suggestion. */

import { dayStart, localDay } from './clock'
import type { Content, Pattern, Week } from './content'
import { all } from './db'

export const MASTERED = 85 // % on recent drills (spec §1: A1 foundation patterns ≥ 85 %)
const RECENT = 4 // practice rounds that count for "recent accuracy"

export interface PatternStat {
  accuracy: number | null
  rounds: number
  last: number | null
}

interface Row {
  code: string
  ts: number
  correct: number
  total: number
}

export async function patternStats(db: D1Database): Promise<Map<string, PatternStat>> {
  const rows = await all<Row>(db, 'SELECT code, ts, correct, total FROM grammar_practice ORDER BY ts DESC')
  const by = new Map<string, Row[]>()
  for (const r of rows) by.set(r.code, [...(by.get(r.code) ?? []), r])
  const out = new Map<string, PatternStat>()
  for (const [code, rs] of by) {
    const recent = rs.slice(0, RECENT)
    const total = recent.reduce((s, r) => s + r.total, 0)
    out.set(code, {
      accuracy: total ? Math.round((recent.reduce((s, r) => s + r.correct, 0) / total) * 100) : null,
      rounds: rs.length,
      last: rs[0]?.ts ?? null,
    })
  }
  return out
}

export const patternSummary = (p: Pattern, s?: PatternStat) => ({
  code: p.code,
  week: p.week,
  cefr: p.cefr,
  title: p.title,
  title_de: p.title_de,
  accuracy: s?.accuracy ?? null,
  rounds: s?.rounds ?? 0,
  mastered: (s?.accuracy ?? 0) >= MASTERED,
})

/**
 * Today's grammar: if something was practised today, show that (done). Otherwise the earliest pattern up to the
 * current week that is not yet mastered; once all are mastered, the one practised longest ago (spaced revision).
 */
export async function dailyGrammar(db: D1Database, content: Content, week: number, now: number) {
  const stats = await patternStats(db)
  const start = dayStart(localDay(now))
  const today = (await all<{ code: string }>(db, 'SELECT code FROM grammar_practice WHERE ts >= ? ORDER BY ts DESC LIMIT 1', start))[0]
  const pick = (p: Pattern | undefined, practised_today: boolean) =>
    p ? { code: p.code, title: p.title, accuracy: stats.get(p.code)?.accuracy ?? null, practised_today } : null
  if (today) return pick(content.patternByCode.get(today.code), true)
  const open = content.patterns.filter((p) => p.week <= Math.max(week, 1))
  const next = open.find((p) => (stats.get(p.code)?.accuracy ?? 0) < MASTERED)
  if (next) return pick(next, false)
  const stale = [...open].sort((a, b) => (stats.get(a.code)?.last ?? 0) - (stats.get(b.code)?.last ?? 0))[0]
  return pick(stale, false)
}

export function weekSummary(w: Week, content: Content, stats: Map<string, PatternStat>, introduced: Set<string>, practisedConvs: Map<string, number>) {
  const items = content.items.filter((i) => i.week === w.week && i.learner_action !== 'later')
  const convs = content.conversations.filter((c) => c.week === w.week)
  return {
    ...w,
    patterns: w.patterns.map((code) => patternSummary(content.patternByCode.get(code)!, stats.get(code))),
    items: { total: items.length, started: items.filter((i) => introduced.has(i.slug)).length, words: items.filter((i) => i.kind === 'word').length },
    conversations: { total: convs.length, practised: convs.filter((c) => (practisedConvs.get(c.slug) ?? 0) >= 2).length },
  }
}
