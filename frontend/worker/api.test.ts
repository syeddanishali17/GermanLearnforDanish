// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { addDays, dayStart, isoWeek, localDay } from './clock'
import { applyOverlay, buildItems, CONVERSATION_FILES, DECK_FILES, PRIVATE_OVERLAY, PUBLIC_CONVERSATION_FILES, PUBLIC_DECK_FILES, validateConversations, validateDecks } from './content'
import { run } from './db'
import { streak } from './progress'
import { dueQueue, newItems } from './srs'
import { content } from './index'
import { client } from './test/helpers'

const HOUR = 3600_000

describe('content', () => {
  it('real decks and conversations are valid', () => {
    expect(validateDecks(DECK_FILES)).toEqual([])
    expect(validateConversations(CONVERSATION_FILES)).toEqual([])
    expect(content.items.length).toBeGreaterThanOrEqual(300)
    expect(content.conversations.length).toBeGreaterThanOrEqual(30)
  })

  it('intake skips drafts, flagged and later items', () => {
    const items = buildItems([
      {
        deck: 't',
        status: 'reviewed',
        items: [
          { slug: 'a', de: 'A', en: 'A' },
          { slug: 'b', de: 'B', en: 'B', status: 'draft' },
          { slug: 'c', de: 'C', en: 'C', learner_action: 'later' },
          { slug: 'd', de: 'D', en: 'D' },
        ],
      },
    ])
    const c = { items, bySlug: new Map(items.map((i) => [i.slug, i])), conversations: [], conversationBySlug: new Map() }
    const states = new Map([['d', { slug: 'd', introduced_at: null, flagged: 1 }]])
    expect(newItems(c, states, 10).map((i) => i.slug)).toEqual(['a'])
  })

  it('public content (no overlay) is valid on its own', () => {
    expect(validateDecks(PUBLIC_DECK_FILES)).toEqual([])
    expect(validateConversations(PUBLIC_CONVERSATION_FILES)).toEqual([])
  })

  it('private overlay only targets existing slugs', () => {
    const items = new Set(PUBLIC_DECK_FILES.flatMap((d) => d.items.map((i: { slug: string }) => i.slug)))
    const convs = new Set(PUBLIC_CONVERSATION_FILES.flatMap((f) => f.conversations.map((c: { slug: string }) => c.slug)))
    expect(Object.keys(PRIVATE_OVERLAY.items ?? {}).filter((s) => !items.has(s))).toEqual([])
    expect(Object.keys(PRIVATE_OVERLAY.conversations ?? {}).filter((s) => !convs.has(s))).toEqual([])
  })

  it('overlay replaces fields by slug and leaves the rest', () => {
    const [decks, convs] = applyOverlay(
      [{ deck: 'd', title: 'Generic', items: [{ slug: 'a', de: 'Ich komme aus ...', en: 'x' }, { slug: 'b', de: 'B', en: 'B' }] }],
      [{ cefr: 'A1', conversations: [{ slug: 'c', title: 'T', turns: [{ who: 'Du', de: '1', en: '1' }] }] }],
      { items: { a: { de: 'Ich komme aus Atlantis.' } }, conversations: { c: { turns: [{ who: 'Du', de: '2', en: '2' }] } }, deck_titles: { d: 'Mine' } },
    )
    expect(decks[0].title).toBe('Mine')
    expect(decks[0].items[0]).toEqual({ slug: 'a', de: 'Ich komme aus Atlantis.', en: 'x' })
    expect(decks[0].items[1].de).toBe('B')
    expect(convs[0].conversations[0].turns[0].de).toBe('2')
  })

  it('reports duplicate slugs', () => {
    expect(validateDecks([{ deck: 'x', items: [{ slug: 's', de: 'a', en: 'b' }, { slug: 's', de: 'a', en: 'b' }] }])).toHaveLength(1)
  })
})

describe('clock', () => {
  it('study day rolls over at 04:00 Vienna', () => {
    // 2026-10-25 01:30 UTC = 02:30 Vienna (after DST end) -> still the 24th
    expect(localDay(Date.UTC(2026, 9, 25, 1, 30))).toBe('2026-10-24')
    expect(localDay(Date.UTC(2026, 9, 25, 3, 30))).toBe('2026-10-25')
    // Day start of 25 Oct (winter time, UTC+1) is 03:00 UTC
    expect(new Date(dayStart('2026-10-25')).toISOString()).toBe('2026-10-25T03:00:00.000Z')
    expect(new Date(dayStart('2026-07-01')).toISOString()).toBe('2026-07-01T02:00:00.000Z')
    expect(isoWeek('2026-10-25')).toBe('2026-W43')
  })
})

describe('auth', () => {
  it('health is public, the rest needs login', async () => {
    const c = await client()
    expect((await c.get('/api/health')).ok).toBe(true)
    expect((await c.req('/api/daily')).status).toBe(401)
  })

  it('rate limits after 5 wrong passwords', async () => {
    const c = await client()
    for (let i = 0; i < 5; i++) expect((await c.req('/api/auth/login', { method: 'POST', json: { password: 'nope' } })).status).toBe(401)
    expect((await c.req('/api/auth/login', { method: 'POST', json: { password: 'test-password-123' } })).status).toBe(429)
  })

  it('logs in and out', async () => {
    const c = await client()
    await c.login()
    expect((await c.req('/api/auth/me')).status).toBe(200)
    await c.post('/api/auth/logout')
    expect((await c.req('/api/auth/me')).status).toBe(401)
  })

  it('gate works with the read-only token', async () => {
    const c = await client()
    expect((await c.req('/api/stats/gate')).status).toBe(401)
    const r = await c.req('/api/stats/gate', { headers: { 'x-gate-token': 'gate-test-token' } })
    expect(r.status).toBe(200)
    expect(((await r.json()) as { open: boolean }).open).toBe(false)
  })
})

describe('daily loop', () => {
  it('day one: 6 new chunks, Manzil open, not yet a study day', async () => {
    const c = await client()
    await c.login()
    const d = await c.get('/api/daily')
    expect(d.sabaq.new_items).toHaveLength(6)
    expect(d.sabaq.new_items[0].id).toBe('hallo')
    expect(d.manzil.unlocked).toBe(true)
    expect(d.study_day).toBe(false)
    expect(d.level).toEqual({ week: 1, cefr: 'A1' })
  })

  it('introduce creates cards, buries siblings, counts production', async () => {
    const c = await client()
    await c.login()
    await c.post('/api/sabaq/introduce', { item_id: 'hallo', rating: 3 })
    await c.post('/api/sabaq/introduce', { item_id: 'gruess-gott', rating: 3 })
    const d = await c.get('/api/daily')
    expect(d.produced).toBe(1) // recognition-only intro is not production
    expect(d.study_day).toBe(true)
    const profile = { new_per_day: 6, max_reviews_per_day: 100 } as never
    const q = await dueQueue(c.env.DB, content, profile, Date.now() + 15 * 60_000)
    expect(q.map((x) => `${x.item_slug}:${x.card_type}`).sort()).toEqual(['gruess-gott:recognise', 'hallo:produce'])
    // Everything due: still one card per item, learning card wins
    await run(c.env.DB, 'UPDATE card SET due = ?', Date.now() - 60_000)
    const all = await dueQueue(c.env.DB, content, profile, Date.now())
    expect(all.map((x) => `${x.item_slug}:${x.card_type}`).sort()).toEqual(['gruess-gott:recognise', 'hallo:produce'])
  })

  it('answers are idempotent and applied in time order', async () => {
    const c = await client()
    await c.login()
    await c.post('/api/sabaq/introduce', { item_id: 'hallo', rating: 3 })
    await run(c.env.DB, 'UPDATE card SET due = ?', Date.now() - 60_000)
    const q = await c.get<{ id: number; card_type: string }[]>('/api/review/queue')
    const card = q.find((x) => x.card_type === 'produce')!
    const t0 = Date.now()
    const batch = [
      { uuid: 'uuid-b-0002', card_id: card.id, rating: 3, ts: new Date(t0 + 12 * 60_000).toISOString() },
      { uuid: 'uuid-a-0001', card_id: card.id, rating: 1, ts: new Date(t0 + 11 * 60_000).toISOString() },
    ]
    expect((await c.post('/api/review/answers', batch)).applied).toEqual(['uuid-a-0001', 'uuid-b-0002'])
    const again = await c.post('/api/review/answers', batch)
    expect(again.applied).toEqual([])
    expect(again.skipped).toHaveLength(2)
  })

  it('missions count as real-world attempts', async () => {
    const c = await client()
    await c.login()
    const m = await c.post('/api/missions', { text: 'Ist hier frei?', situation: 'canteen' })
    await c.req(`/api/missions/${m.id}`, { method: 'PATCH', json: { outcome: 'tried', understood_reply: false } })
    expect((await c.get('/api/stats/dashboard')).real_world_attempts_this_week).toBe(1)
  })

  it('report flags an item and removes it from intake', async () => {
    const c = await client()
    await c.login()
    await c.post('/api/items/hallo/report', { note: 'check' })
    expect((await c.get('/api/items/hallo')).status).toBe('flagged')
    expect((await c.get('/api/daily')).sabaq.new_items.map((i: { id: string }) => i.id)).not.toContain('hallo')
  })

  it('settings and export', async () => {
    const c = await client()
    await c.login()
    const s = await c.req('/api/settings', { method: 'PUT', json: { new_per_day: 8, max_reviews_per_day: 5 } })
    expect(((await s.json()) as { new_per_day: number }).new_per_day).toBe(8)
    expect((await c.get('/api/daily')).sabaq.new_items).toHaveLength(8)
    const ex = await c.get('/api/export')
    expect(ex.profile[0].max_reviews_per_day).toBe(100) // 5 is below the allowed minimum, so it is ignored
  })
})

describe('streak', () => {
  it('freezes up to two missed days per ISO week', async () => {
    const c = await client()
    const today = '2026-10-25' // Sunday
    for (const d of [today, addDays(today, -1), addDays(today, -3), addDays(today, -4), addDays(today, -12)])
      await run(c.env.DB, 'INSERT INTO day_log (day, study_day) VALUES (?, 1)', d)
    expect((await streak(c.env.DB, today)).days).toBe(4)
  })
})

describe('conversations', () => {
  it('recommends the first ready conversation and moves on after two roleplays', async () => {
    const c = await client()
    await c.login()
    const list = await c.get('/api/conversations')
    expect(list.level).toEqual({ week: 1, cefr: 'A1' })
    const first = list.recommended_id
    expect(first).toBe('a1-neue-nachbarin')
    const byId = Object.fromEntries(list.conversations.map((x: { id: string }) => [x.id, x]))
    expect(byId['a1-mensa-platz'].readiness).toBe('ready')
    expect(byId['b1-heuriger'].readiness).toBe('stretch')
    for (const n of [1, 2]) await c.post(`/api/conversations/${first}/practice`, { uuid: `practice-000${n}`, mode: 'roleplay', result: 'helped' })
    expect((await c.post(`/api/conversations/${first}/practice`, { uuid: 'practice-0001', mode: 'roleplay' })).duplicate).toBe(true)
    const after = await c.get('/api/conversations')
    expect(after.recommended_id).not.toBe(first)
    const d = await c.get('/api/daily')
    expect(d.produced).toBe(2)
    expect(d.conversation.id).toBe(after.recommended_id)
  })

  it('listen mode is not production; detail and 404', async () => {
    const c = await client()
    await c.login()
    await c.post('/api/conversations/a1-mensa-platz/practice', { mode: 'listen' })
    expect((await c.get('/api/daily')).produced).toBe(0)
    expect((await c.get('/api/conversations/a1-mensa-platz')).turns_list[0].who).toBe('Du')
    expect((await c.req('/api/conversations/nope')).status).toBe(404)
  })

  it('level follows the furthest started week', async () => {
    const c = await client()
    await c.login()
    await run(c.env.DB, 'INSERT INTO item_state (slug, introduced_at) VALUES (?, ?)', 'a2-wie-wars', Date.now() - HOUR)
    expect((await c.get('/api/conversations')).level).toEqual({ week: 14, cefr: 'A2' })
  })
})
