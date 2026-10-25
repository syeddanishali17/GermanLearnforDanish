/**
 * Ustad API on Cloudflare Workers + D1. Static app files are served by Workers Assets;
 * only /api/* reaches this code (wrangler.jsonc run_worker_first).
 */

import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Grade } from 'ts-fsrs'
import profileMd from '../../docs/learner_profile.md?raw'
import * as auth from './auth'
import { localDay, now } from './clock'
import { makeContent, type ContentItem } from './content'
import { all, bool, one, run, type Env } from './db'
import * as progress from './progress'
import * as srs from './srs'
import * as talk from './talk'

export const content = makeContent()
type C = Context<{ Bindings: Env }>

const app = new Hono<{ Bindings: Env }>().basePath('/api')

// ---------- helpers ----------

const str = (v: unknown, max = 1000) => (typeof v === 'string' ? v.slice(0, max) : null)
const int = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)
const oneOf = <T extends string>(v: unknown, opts: readonly T[]) => (opts.includes(v as T) ? (v as T) : null)
const tsOf = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? Date.parse(v) : now())
const bad = (c: C, msg: string, status: 400 | 401 | 403 | 404 | 429 = 400) => c.json({ detail: msg }, status)

async function body(c: C): Promise<Record<string, unknown> | null> {
  try {
    return await c.req.json()
  } catch {
    return null
  }
}

async function profile(db: D1Database): Promise<srs.Profile> {
  await run(db, 'INSERT OR IGNORE INTO profile (id, learner_profile_md) VALUES (1, ?)', profileMd)
  return (await one<srs.Profile>(db, 'SELECT * FROM profile WHERE id = 1'))!
}

function itemOut(i: ContentItem, st?: srs.ItemState) {
  const { rank: _rank, ...rest } = i
  return { id: i.slug, ...rest, status: st?.flagged ? 'flagged' : i.status, introduced: !!st?.introduced_at }
}

const cardOut = (card: srs.CardRow, states: Map<string, srs.ItemState>) => ({
  id: card.id,
  card_type: card.card_type,
  state: card.state,
  due: new Date(card.due).toISOString(),
  item: itemOut(content.bySlug.get(card.item_slug)!, states.get(card.item_slug)),
})

interface MissionRow {
  id: number
  day: string
  item_slug: string | null
  situation: string
  text: string
  status: string
  outcome: string | null
  reply_heard: string | null
  understood_reply: number | null
  switched_to_english: number | null
  notes: string | null
}

const missionOut = (m: MissionRow) => ({
  id: m.id,
  day: m.day,
  item_id: m.item_slug,
  situation: m.situation,
  text: m.text,
  status: m.status,
  outcome: m.outcome,
  reply_heard: m.reply_heard,
  understood_reply: m.understood_reply === null ? null : bool(m.understood_reply),
  switched_to_english: m.switched_to_english === null ? null : bool(m.switched_to_english),
  notes: m.notes,
})

// ---------- public ----------

app.get('/health', (c) => c.json({ ok: true, service: 'ustad', version: '0.2.0' }))

app.post('/auth/login', async (c) => {
  const db = c.env.DB
  const t = now()
  const b = await body(c)
  const password = str(b?.password, 200)
  if (!password) return bad(c, 'Password required')
  if (await auth.loginBlocked(db, t)) return bad(c, 'Too many attempts. Wait 10 minutes.', 429)
  if (!(await auth.verifyPassword(password, c.env.PASSWORD_HASH))) {
    await auth.recordFailure(db, t)
    return bad(c, 'Wrong password', 401)
  }
  await auth.resetFailures(db)
  setCookie(c, auth.COOKIE, await auth.createSession(db, t), {
    httpOnly: true,
    secure: c.env.COOKIE_SECURE !== 'false',
    // Strict: the session check happens on same-site API calls, so opening a link to the app still works.
    sameSite: 'Strict',
    path: '/',
    maxAge: auth.SESSION_DAYS * 86_400,
  })
  return c.json({ ok: true })
})

app.post('/auth/logout', async (c) => {
  await auth.dropSession(c.env.DB, getCookie(c, auth.COOKIE))
  deleteCookie(c, auth.COOKIE, { path: '/' })
  return c.json({ ok: true })
})

/** Builder gate (spec §6.6). Readable with the session cookie or the read-only X-Gate-Token. */
app.get('/stats/gate', async (c) => {
  const db = c.env.DB
  const viaToken = auth.tokenMatches(c.env.GATE_TOKEN, c.req.header('x-gate-token'))
  if (!viaToken && !(await auth.sessionValid(db, getCookie(c, auth.COOKIE), now()))) return bad(c, 'Not logged in', 401)
  const n = await progress.studyDaysLast7(db, localDay())
  const p = await profile(db)
  return c.json({ study_days_last_7: n, required: 5, open: n >= 5 || bool(p.gate_override) })
})

// ---------- everything below needs a session ----------

app.use('*', async (c, next) => {
  if (!(await auth.sessionValid(c.env.DB, getCookie(c, auth.COOKIE), now()))) return bad(c, 'Not logged in', 401)
  await next()
})

app.get('/auth/me', (c) => c.json({ ok: true }))

app.get('/daily', async (c) => {
  const db = c.env.DB
  const t = now()
  const p = await profile(db)
  const row = await progress.refreshDay(db, content, p, t)
  const states = await srs.itemStates(db)
  const due = await srs.dueQueue(db, content, p, t)
  const reviewed = await srs.reviewsToday(db, t, 'manzil')
  const fresh = srs.newItems(content, states, await srs.newAllowance(db, p, t))
  const sabqi = new Map<string, ContentItem>()
  for (const it of [...(await srs.recentLapseItems(db, content, t)), ...(await srs.recentItems(db, content, t))]) if (!sabqi.has(it.slug)) sabqi.set(it.slug, it)
  const missions = await all<MissionRow>(db, 'SELECT * FROM mission WHERE day = ? ORDER BY id', localDay(t))
  const lvl = await talk.level(db, content)
  const counts = await talk.practiceCounts(db)
  const rec = talk.recommended(content, lvl.week, counts)
  const out = (i: ContentItem) => itemOut(i, states.get(i.slug))
  return c.json({
    day: localDay(t),
    manzil: {
      due_now: due.length,
      reviewed_today: reviewed,
      unlock_needed: Math.min(srs.MANZIL_UNLOCK_CARDS, due.length + reviewed),
      unlocked: bool(row.manzil_done),
    },
    sabqi: [...sabqi.values()].slice(0, 8).map(out),
    sabaq: { new_items: fresh.map(out), introduced_today: (await srs.introducedToday(db, content, t)).map(out), done: bool(row.sabaq_done) },
    bolna: { done: bool(row.bolna_done) },
    missions: missions.map(missionOut),
    produced: row.produced,
    study_day: bool(row.study_day),
    streak: await progress.streak(db, localDay(t)),
    level: lvl,
    conversation: rec ? talk.summary(rec, lvl.week, counts) : null,
  })
})

app.get('/review/queue', async (c) => {
  const db = c.env.DB
  const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, 200)
  const cards = await srs.dueQueue(db, content, await profile(db), now(), limit)
  const states = await srs.itemStates(db)
  return c.json(cards.map((card) => cardOut(card, states)))
})

/** Apply answers in client-timestamp order; ignore UUIDs already applied (offline sync is idempotent). */
app.post('/review/answers', async (c) => {
  const db = c.env.DB
  const b = await c.req.json().catch(() => null)
  if (!Array.isArray(b)) return bad(c, 'Expected a list of answers')
  const applied: string[] = []
  const skipped: string[] = []
  const answers = b
    .map((a) => ({
      uuid: str(a?.uuid, 40),
      card_id: int(a?.card_id, 1, Number.MAX_SAFE_INTEGER),
      rating: int(a?.rating, 1, 4) as Grade | null,
      ts: tsOf(a?.ts),
      answer_given: str(a?.answer_given, 500),
      answer_mode: oneOf(a?.answer_mode, ['self', 'typed', 'spoken'] as const) ?? 'self',
      elapsed_ms: int(a?.elapsed_ms, 0, 86_400_000),
      block: oneOf(a?.block, ['manzil', 'sabaq'] as const) ?? 'manzil',
    }))
    .sort((x, y) => x.ts - y.ts)
  for (const a of answers) {
    if (!a.uuid || a.uuid.length < 8 || !a.card_id || !a.rating) return bad(c, 'Invalid answer')
    if (await one(db, 'SELECT id FROM review_log WHERE client_uuid = ?', a.uuid)) {
      skipped.push(a.uuid)
      continue
    }
    const card = await one<srs.CardRow>(db, 'SELECT * FROM card WHERE id = ?', a.card_id)
    if (!card) {
      skipped.push(a.uuid)
      continue
    }
    await srs.reviewCard(db, card, a.rating, a.ts, { client_uuid: a.uuid, answer_given: a.answer_given, answer_mode: a.answer_mode, elapsed_ms: a.elapsed_ms, block: a.block })
    if (card.card_type === 'produce') await progress.addToDay(db, localDay(a.ts), { produced: 1 })
    applied.push(a.uuid)
  }
  await progress.refreshDay(db, content, await profile(db), now())
  return c.json({ applied, skipped })
})

app.post('/sabaq/introduce', async (c) => {
  const db = c.env.DB
  const b = await body(c)
  const item = content.bySlug.get(str(b?.item_id, 80) ?? '')
  const rating = int(b?.rating, 1, 4) as Grade | null
  if (!item) return bad(c, 'Item not found', 404)
  if (!rating) return bad(c, 'Invalid rating')
  const uuid = str(b?.uuid, 40)
  if (uuid && (await one(db, 'SELECT id FROM review_log WHERE client_uuid = ?', uuid))) return c.json({ ok: true, duplicate: true })
  const ts = tsOf(b?.ts)
  const created = await srs.introduceItem(db, item, rating, ts, {
    client_uuid: uuid,
    answer_given: str(b?.answer_given, 500),
    answer_mode: oneOf(b?.answer_mode, ['self', 'typed', 'spoken'] as const) ?? 'self',
  })
  // Recognition-only introductions are not production.
  if (created && item.learner_action === 'use_now') await progress.addToDay(db, localDay(ts), { produced: 1 })
  await progress.refreshDay(db, content, await profile(db), now())
  return c.json({ ok: true, duplicate: !created })
})

app.post('/activity', async (c) => {
  const db = c.env.DB
  const b = (await body(c)) ?? {}
  const t = now()
  const day = localDay(t)
  await progress.addToDay(db, day, {
    active_s: int(b.active_s, 0, 3600) ?? 0,
    speaking_s: int(b.speaking_s, 0, 3600) ?? 0,
    manzil_s: int(b.manzil_s, 0, 3600) ?? 0,
    produced: int(b.produced, 0, 100) ?? 0,
  })
  const block = oneOf(b.block_done, ['sabaq', 'bolna'] as const)
  if (block) await progress.markBlock(db, day, block)
  const row = await progress.refreshDay(db, content, await profile(db), t)
  return c.json({ study_day: bool(row.study_day), manzil_done: bool(row.manzil_done), produced: row.produced })
})

// ---------- content ----------

app.get('/items', async (c) => {
  const deck = c.req.query('deck')
  const states = await srs.itemStates(c.env.DB)
  return c.json(content.items.filter((i) => !deck || i.deck === deck).map((i) => itemOut(i, states.get(i.slug))))
})

app.get('/items/:slug', async (c) => {
  const item = content.bySlug.get(c.req.param('slug'))
  if (!item) return bad(c, 'Item not found', 404)
  return c.json(itemOut(item, (await srs.itemStates(c.env.DB)).get(item.slug)))
})

app.post('/items/:slug/report', async (c) => {
  const db = c.env.DB
  const slug = c.req.param('slug')
  if (!content.bySlug.has(slug)) return bad(c, 'Item not found', 404)
  const b = await body(c)
  await run(db, 'INSERT INTO item_state (slug, flagged) VALUES (?, 1) ON CONFLICT(slug) DO UPDATE SET flagged = 1', slug)
  await run(db, 'INSERT INTO content_report (item_slug, note, created_at) VALUES (?, ?, ?)', slug, str(b?.note, 1000) ?? '', now())
  return c.json({ ok: true })
})

app.get('/culture', async (c) => {
  const states = await srs.itemStates(c.env.DB)
  return c.json(content.items.filter((i) => i.deck === 'vienna').map((i) => itemOut(i, states.get(i.slug))))
})

app.get('/missions', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 30) || 30, 200)
  return c.json((await all<MissionRow>(c.env.DB, 'SELECT * FROM mission ORDER BY id DESC LIMIT ?', limit)).map(missionOut))
})

app.post('/missions', async (c) => {
  const b = await body(c)
  const text = str(b?.text, 300)?.trim()
  if (!text) return bad(c, 'Text required')
  const slug = str(b?.item_id, 80)
  const { id } = await run(
    c.env.DB,
    'INSERT INTO mission (day, item_slug, situation, text, created_at) VALUES (?, ?, ?, ?, ?)',
    localDay(),
    slug && content.bySlug.has(slug) ? slug : null,
    str(b?.situation, 40) ?? 'other',
    text,
    now(),
  )
  return c.json(missionOut((await one<MissionRow>(c.env.DB, 'SELECT * FROM mission WHERE id = ?', id))!))
})

app.patch('/missions/:id', async (c) => {
  const db = c.env.DB
  const id = Number(c.req.param('id'))
  if (!(await one(db, 'SELECT id FROM mission WHERE id = ?', id))) return bad(c, 'Mission not found', 404)
  const b = await body(c)
  const outcome = oneOf(b?.outcome, ['no_chance', 'tried', 'exchange', 'conversation'] as const)
  if (!outcome) return bad(c, 'Invalid outcome')
  const tri = (v: unknown) => (typeof v === 'boolean' ? +v : null)
  await run(
    db,
    'UPDATE mission SET outcome = ?, reply_heard = ?, understood_reply = ?, switched_to_english = ?, notes = ?, status = ?, logged_at = ? WHERE id = ?',
    outcome,
    str(b?.reply_heard, 1000),
    tri(b?.understood_reply),
    tri(b?.switched_to_english),
    str(b?.notes, 1000),
    outcome === 'no_chance' ? 'skipped' : 'done',
    now(),
    id,
  )
  await progress.refreshDay(db, content, await profile(db), now())
  return c.json(missionOut((await one<MissionRow>(db, 'SELECT * FROM mission WHERE id = ?', id))!))
})

// ---------- conversations ----------

app.get('/conversations', async (c) => {
  const db = c.env.DB
  const lvl = await talk.level(db, content)
  const counts = await talk.practiceCounts(db)
  const rec = talk.recommended(content, lvl.week, counts)
  return c.json({
    level: lvl,
    recommended_id: rec?.slug ?? null,
    conversations: content.conversations.filter((x) => x.status !== 'flagged').map((x) => talk.summary(x, lvl.week, counts)),
  })
})

app.get('/conversations/:slug', async (c) => {
  const conv = content.conversationBySlug.get(c.req.param('slug'))
  if (!conv) return bad(c, 'Conversation not found', 404)
  return c.json(talk.detail(conv, await talk.currentWeek(c.env.DB, content), await talk.practiceCounts(c.env.DB)))
})

app.post('/conversations/:slug/practice', async (c) => {
  const db = c.env.DB
  const conv = content.conversationBySlug.get(c.req.param('slug'))
  if (!conv) return bad(c, 'Conversation not found', 404)
  const b = await body(c)
  const mode = oneOf(b?.mode, ['listen', 'roleplay', 'own'] as const)
  if (!mode) return bad(c, 'Invalid mode')
  const uuid = str(b?.uuid, 40)
  if (await talk.practiceExists(db, uuid)) return c.json({ ok: true, duplicate: true })
  const ts = tsOf(b?.ts)
  await run(
    db,
    'INSERT INTO conversation_practice (client_uuid, conversation_slug, ts, mode, result, seconds) VALUES (?, ?, ?, ?, ?, ?)',
    uuid,
    conv.slug,
    ts,
    mode,
    oneOf(b?.result, ['smooth', 'helped', 'hard'] as const),
    int(b?.seconds, 0, 1800) ?? 0,
  )
  // Speaking time is counted by the client's activity tracker; seconds here is a per-practice record.
  if (mode !== 'listen') await progress.addToDay(db, localDay(ts), { produced: 1 })
  await progress.refreshDay(db, content, await profile(db), now())
  return c.json({ ok: true, duplicate: false })
})

// ---------- stats, settings, export ----------

app.get('/stats/dashboard', async (c) => c.json(await progress.dashboard(c.env.DB, content, await profile(c.env.DB), now())))

const settingsOut = (p: srs.Profile) => ({
  learner_profile_md: p.learner_profile_md,
  new_per_day: p.new_per_day,
  max_reviews_per_day: p.max_reviews_per_day,
  weekly_target_days: p.weekly_target_days,
  weekly_target_attempts: p.weekly_target_attempts,
})

app.get('/settings', async (c) => c.json(settingsOut(await profile(c.env.DB))))

app.put('/settings', async (c) => {
  const db = c.env.DB
  await profile(db)
  const b = (await body(c)) ?? {}
  const fields: [string, string | number | null][] = [
    ['learner_profile_md', str(b.learner_profile_md, 20_000)],
    ['new_per_day', int(b.new_per_day, 3, 10)],
    ['max_reviews_per_day', int(b.max_reviews_per_day, 20, 500)],
    ['weekly_target_days', int(b.weekly_target_days, 1, 7)],
    ['weekly_target_attempts', int(b.weekly_target_attempts, 0, 50)],
  ]
  for (const [k, v] of fields) if (v !== null) await run(db, `UPDATE profile SET ${k} = ? WHERE id = 1`, v)
  return c.json(settingsOut(await profile(db)))
})

/** Full personal-data export (spec §12). */
app.get('/export', async (c) => {
  const db = c.env.DB
  const tables = ['profile', 'item_state', 'card', 'review_log', 'mission', 'day_log', 'content_report', 'conversation_practice', 'cost_ledger']
  const out: Record<string, unknown> = { exported_at: new Date().toISOString() }
  for (const t of tables) out[t] = await all(db, `SELECT * FROM ${t}`)
  return c.json(out, 200, { 'Content-Disposition': 'attachment; filename="ustad-export.json"' })
})

app.notFound((c) => c.json({ detail: 'Not found' }, 404))
app.onError((err, c) => {
  console.error(err)
  return c.json({ detail: 'Server error' }, 500)
})

/** Same headers as public/_headers, plus no caching of private API responses. */
const SECURITY_HEADERS: Record<string, string> = {
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), geolocation=(), payment=(), microphone=(self)',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Cross-Origin-Resource-Policy': 'same-origin',
}

/** Rejects cross-site writes (defence in depth on top of SameSite=Lax cookies). */
function crossSiteWrite(req: Request): boolean {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return false
  if (req.headers.get('sec-fetch-site') === 'cross-site') return true
  const origin = req.headers.get('origin')
  return !!origin && origin !== new URL(req.url).origin
}

const sessionCookie = (req: Request) =>
  req.headers
    .get('cookie')
    ?.split(';')
    .map((c) => c.trim().split('='))
    .find(([k]) => k === auth.COOKIE)?.[1]

/** Audio of Danish's personal phrases (frontend/public/audio-private, built from data/private) needs a session. */
async function privateAudio(req: Request, env: Env): Promise<Response> {
  if (!(await auth.sessionValid(env.DB, sessionCookie(req), now()))) return Response.json({ detail: 'Not logged in' }, { status: 401 })
  if (!env.ASSETS) return Response.json({ detail: 'Not found' }, { status: 404 })
  const res = await env.ASSETS.fetch(req)
  // Missing files would fall back to index.html (SPA); answer 404 instead.
  if (res.headers.get('content-type')?.includes('text/html')) return Response.json({ detail: 'Not found' }, { status: 404 })
  const out = new Response(res.body, res)
  out.headers.set('Cache-Control', 'private, max-age=604800')
  return out
}

export async function handle(req: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const path = new URL(req.url).pathname
  const res = crossSiteWrite(req)
    ? Response.json({ detail: 'Cross-site request blocked' }, { status: 403 })
    : path.startsWith('/audio-private/')
      ? await privateAudio(req, env)
      : await app.fetch(req, env, ctx)
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) out.headers.set(k, v)
  if (!path.startsWith('/api/health') && !(path.startsWith('/audio-private/') && res.ok)) out.headers.set('Cache-Control', 'private, no-store')
  return out
}

export { app }
export default { fetch: handle } satisfies ExportedHandler<Env>
