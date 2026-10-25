/** Level tracking and conversation recommendation (A1 → A2 → B1). */

import { cefrForWeek, type Content, type Conversation } from './content'
import { all, one } from './db'

const PRACTISED_AFTER = 2 // roleplays before a conversation counts as practised

/** Curriculum week = the furthest week Danish has started phrases from. Moves only as fast as he learns. */
export async function currentWeek(db: D1Database, content: Content): Promise<number> {
  const rows = await all<{ slug: string }>(db, 'SELECT slug FROM item_state WHERE introduced_at IS NOT NULL')
  return rows.reduce((w, r) => Math.max(w, content.bySlug.get(r.slug)?.week ?? 1), 1)
}

export async function level(db: D1Database, content: Content) {
  const week = await currentWeek(db, content)
  return { week, cefr: cefrForWeek(week) }
}

export async function practiceCounts(db: D1Database): Promise<Map<string, number>> {
  const rows = await all<{ slug: string; n: number }>(
    db,
    "SELECT conversation_slug AS slug, COUNT(*) AS n FROM conversation_practice WHERE mode IN ('roleplay','own') GROUP BY conversation_slug",
  )
  return new Map(rows.map((r) => [r.slug, r.n]))
}

export const readiness = (c: Conversation, week: number) => (c.week <= week + 1 ? 'ready' : 'stretch')

export function recommended(content: Content, week: number, counts: Map<string, number>): Conversation | null {
  const open = content.conversations.filter((c) => c.status !== 'flagged' && (counts.get(c.slug) ?? 0) < PRACTISED_AFTER)
  return open.find((c) => readiness(c, week) === 'ready') ?? open[0] ?? null
}

export function summary(c: Conversation, week: number, counts: Map<string, number>) {
  return {
    id: c.slug,
    slug: c.slug,
    cefr: c.cefr,
    week: c.week,
    title: c.title,
    title_de: c.title_de,
    partner: c.partner,
    setting: c.setting,
    register: c.register,
    turns: c.turns.length,
    practised: counts.get(c.slug) ?? 0,
    readiness: readiness(c, week),
  }
}

export function detail(c: Conversation, week: number, counts: Map<string, number>) {
  return { ...summary(c, week, counts), goal: c.goal, patterns: c.patterns, turns_list: c.turns, key_phrases: c.key_phrases, notes: c.notes }
}

export async function practiceExists(db: D1Database, uuid: string | null | undefined) {
  return !!uuid && !!(await one(db, 'SELECT id FROM conversation_practice WHERE client_uuid = ?', uuid))
}
