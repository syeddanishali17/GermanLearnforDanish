/** FSRS scheduling, new-card intake and the daily queue (spec §4, §5.1). */

import { createEmptyCard, fsrs, generatorParameters, type Card as FsrsCard, type Grade } from 'ts-fsrs'
import { dayStart, localDay, nextDayStart } from './clock'
import type { Content, ContentItem } from './content'
import { all, one, run } from './db'

const scheduler = fsrs(generatorParameters({ request_retention: 0.9, enable_fuzz: true }))

export const MATURE_STABILITY_DAYS = 21
export const MANZIL_UNLOCK_CARDS = 10
export const MANZIL_UNLOCK_SECONDS = 240
const OVERDUE_THROTTLE = 60
const OVERDUE_STOP = 120
const THROTTLED_NEW = 3
const LEARNING = 1
const RELEARNING = 3
const REVIEW = 2

export interface CardRow {
  id: number
  item_slug: string
  card_type: 'recognise' | 'produce' | 'reply'
  fsrs: string
  due: number
  state: number
  stability: number | null
  last_review: number | null
  lapses: number
}

export interface Profile {
  learner_profile_md: string
  new_per_day: number
  max_reviews_per_day: number
  weekly_target_days: number
  weekly_target_attempts: number
  gate_override: number
}

export interface ItemState {
  slug: string
  introduced_at: number | null
  flagged: number
}

/** Phase 1 card budget: at most recognise + produce + reply. Recognition-only items get no produce card. */
export function cardTypesFor(item: ContentItem): CardRow['card_type'][] {
  const types: CardRow['card_type'][] = ['recognise']
  if (item.learner_action === 'use_now') types.push('produce')
  if (item.likely_reply_de) types.push('reply')
  return types
}

export const maturityCardType = (item: ContentItem) => (item.learner_action === 'use_now' ? 'produce' : 'recognise')

function toFsrs(json: string): FsrsCard {
  const c = JSON.parse(json)
  return { ...c, due: new Date(c.due), last_review: c.last_review ? new Date(c.last_review) : undefined }
}

async function saveCard(db: D1Database, id: number, c: FsrsCard, lapses: number) {
  await run(
    db,
    'UPDATE card SET fsrs = ?, due = ?, state = ?, stability = ?, last_review = ?, lapses = ? WHERE id = ?',
    JSON.stringify(c),
    c.due.getTime(),
    c.state,
    c.stability,
    c.last_review ? c.last_review.getTime() : null,
    lapses,
    id,
  )
}

export interface ReviewMeta {
  client_uuid?: string | null
  answer_given?: string | null
  answer_mode?: string
  elapsed_ms?: number | null
  block?: string
}

export async function reviewCard(db: D1Database, card: CardRow, rating: Grade, ts: number, meta: ReviewMeta = {}) {
  const fc = toFsrs(card.fsrs)
  // A late offline sync can carry a timestamp older than the last review; clamp so it still applies.
  if (fc.last_review && ts < fc.last_review.getTime()) ts = fc.last_review.getTime()
  const next = scheduler.next(fc, new Date(ts), rating).card
  const lapses = card.lapses + (rating === 1 && card.state === REVIEW ? 1 : 0)
  await saveCard(db, card.id, next, lapses)
  await run(
    db,
    'INSERT INTO review_log (client_uuid, card_id, ts, rating, answer_given, answer_mode, elapsed_ms, block) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    meta.client_uuid ?? null,
    card.id,
    ts,
    rating,
    meta.answer_given ?? null,
    meta.answer_mode ?? 'self',
    meta.elapsed_ms ?? null,
    meta.block ?? 'manzil',
  )
}

/** Sabaq introduction: create cards; the intro test is the first review of the maturity card; siblings wait a day. */
export async function introduceItem(db: D1Database, item: ContentItem, rating: Grade, ts: number, meta: ReviewMeta = {}) {
  const st = await one<ItemState>(db, 'SELECT * FROM item_state WHERE slug = ?', item.slug)
  if (st?.introduced_at) return false
  await run(
    db,
    'INSERT INTO item_state (slug, introduced_at) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET introduced_at = excluded.introduced_at',
    item.slug,
    ts,
  )
  const first = maturityCardType(item)
  const tomorrow = nextDayStart(ts)
  for (const ct of cardTypesFor(item)) {
    const c = createEmptyCard(new Date(ct === first ? ts : tomorrow))
    await run(
      db,
      'INSERT OR IGNORE INTO card (item_slug, card_type, fsrs, due, state, stability, last_review, lapses) VALUES (?, ?, ?, ?, ?, ?, NULL, 0)',
      item.slug,
      ct,
      JSON.stringify(c),
      c.due.getTime(),
      c.state,
      c.stability,
    )
  }
  const card = await one<CardRow>(db, 'SELECT * FROM card WHERE item_slug = ? AND card_type = ?', item.slug, first)
  await reviewCard(db, card!, rating, ts, { ...meta, block: 'sabaq' })
  return true
}

export async function itemStates(db: D1Database): Promise<Map<string, ItemState>> {
  return new Map((await all<ItemState>(db, 'SELECT * FROM item_state')).map((s) => [s.slug, s]))
}

export async function reviewsToday(db: D1Database, ts: number, block?: string): Promise<number> {
  const start = dayStart(localDay(ts))
  const r = block
    ? await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM review_log WHERE ts >= ? AND block = ?', start, block)
    : await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM review_log WHERE ts >= ?', start)
  return r?.n ?? 0
}

export async function newAllowance(db: D1Database, profile: Profile, ts: number): Promise<number> {
  const overdue = (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM card WHERE due <= ?', ts))?.n ?? 0
  if (overdue > OVERDUE_STOP) return 0
  const cap = overdue <= OVERDUE_THROTTLE ? profile.new_per_day : Math.min(THROTTLED_NEW, profile.new_per_day)
  const introduced = (await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM item_state WHERE introduced_at >= ?', dayStart(localDay(ts))))?.n ?? 0
  return Math.max(0, cap - introduced)
}

export const isActive = (item: ContentItem, st?: ItemState) => !st?.flagged && (item.status === 'reviewed' || item.status === 'approved')

export function newItems(content: Content, states: Map<string, ItemState>, limit: number): ContentItem[] {
  if (limit <= 0) return []
  const out: ContentItem[] = []
  for (const item of content.items) {
    const st = states.get(item.slug)
    if (st?.introduced_at || item.learner_action === 'later' || !isActive(item, st)) continue
    out.push(item)
    if (out.length >= limit) break
  }
  return out
}

const inLearning = (c: CardRow) => (c.state === LEARNING || c.state === RELEARNING) && c.last_review !== null

/** Due cards, oldest first, one card per item per day unless a card is mid-(re)learning. */
export async function dueQueue(db: D1Database, content: Content, profile: Profile, ts: number, limit?: number): Promise<CardRow[]> {
  const start = dayStart(localDay(ts))
  const cap = Math.min(Math.max(0, profile.max_reviews_per_day - (await reviewsToday(db, ts, 'manzil'))), limit ?? Infinity)
  const reviewedToday = new Set(
    (await all<{ item_slug: string }>(db, 'SELECT DISTINCT c.item_slug FROM review_log r JOIN card c ON c.id = r.card_id WHERE r.ts >= ?', start)).map(
      (r) => r.item_slug,
    ),
  )
  const flagged = new Set((await all<{ slug: string }>(db, 'SELECT slug FROM item_state WHERE flagged = 1')).map((r) => r.slug))
  const cards = (await all<CardRow>(db, 'SELECT * FROM card WHERE due <= ? ORDER BY due', ts)).filter(
    (c) => content.bySlug.has(c.item_slug) && !flagged.has(c.item_slug),
  )
  // Cards mid-learning go first so they win over their siblings.
  cards.sort((a, b) => Number(inLearning(b)) - Number(inLearning(a)))
  const out: CardRow[] = []
  const seen = new Set<string>()
  for (const c of cards) {
    if (out.length >= cap) break
    if (!inLearning(c) && (reviewedToday.has(c.item_slug) || seen.has(c.item_slug))) continue
    seen.add(c.item_slug)
    out.push(c)
  }
  return out
}

export async function matureCount(db: D1Database, content: Content): Promise<number> {
  const rows = await all<CardRow>(db, 'SELECT item_slug, card_type FROM card WHERE stability >= ?', MATURE_STABILITY_DAYS)
  return rows.filter((c) => {
    const item = content.bySlug.get(c.item_slug)
    return item && c.card_type === maturityCardType(item)
  }).length
}

export async function recentLapseItems(db: D1Database, content: Content, ts: number, days = 2): Promise<ContentItem[]> {
  const since = dayStart(localDay(ts - days * 86_400_000))
  const rows = await all<{ item_slug: string }>(
    db,
    'SELECT DISTINCT c.item_slug FROM review_log r JOIN card c ON c.id = r.card_id WHERE r.ts >= ? AND r.rating = 1',
    since,
  )
  return rows.map((r) => content.bySlug.get(r.item_slug)).filter((i): i is ContentItem => !!i)
}

export async function recentItems(db: D1Database, content: Content, ts: number, days = 3): Promise<ContentItem[]> {
  const today = dayStart(localDay(ts))
  const since = dayStart(localDay(ts - days * 86_400_000))
  const rows = await all<{ slug: string }>(
    db,
    'SELECT slug FROM item_state WHERE introduced_at >= ? AND introduced_at < ? ORDER BY introduced_at',
    since,
    today,
  )
  return rows.map((r) => content.bySlug.get(r.slug)).filter((i): i is ContentItem => !!i)
}

export async function introducedToday(db: D1Database, content: Content, ts: number): Promise<ContentItem[]> {
  const rows = await all<{ slug: string }>(db, 'SELECT slug FROM item_state WHERE introduced_at >= ? ORDER BY introduced_at', dayStart(localDay(ts)))
  return rows.map((r) => content.bySlug.get(r.slug)).filter((i): i is ContentItem => !!i)
}
