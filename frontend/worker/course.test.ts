// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CURRICULUM, expandWordDeck, GRAMMAR_FILES, validateGrammar } from './content'
import { content } from './index'
import { client } from './test/helpers'

describe('course content', () => {
  it('grammar and curriculum are valid and complete', () => {
    expect(validateGrammar(GRAMMAR_FILES, CURRICULUM)).toEqual([])
    expect(content.weeks).toHaveLength(36)
    expect(content.patterns.length).toBeGreaterThanOrEqual(40)
    expect(content.patterns.reduce((n, p) => n + p.drills.length, 0)).toBeGreaterThanOrEqual(200)
  })

  it('every week has something to learn', () => {
    for (const w of content.weeks) {
      const items = content.items.filter((i) => i.week === w.week)
      const convs = content.conversations.filter((c) => c.week === w.week)
      expect(items.length + convs.length + w.patterns.length, `week ${w.week}`).toBeGreaterThan(0)
    }
  })

  it('has a real vocabulary', () => {
    const words = content.items.filter((i) => i.kind === 'word')
    expect(words.length).toBeGreaterThanOrEqual(350)
    const tisch = content.bySlug.get('w-der-tisch')!
    expect(tisch.gender).toBe('der')
    expect(tisch.plural).toBe('die Tische')
    const essen = content.bySlug.get('w-essen')!
    expect(essen.gender).toBeNull()
    expect(essen.context).toContain('gegessen')
  })

  it('word groups expand: plural-only nouns get no gender', () => {
    const d = expandWordDeck({ deck: 'w', groups: [{ week: 1, topic: 'T', words: [['die Eltern', 'parents', 'plural only'], ['schön', 'nice', '–']] }] })
    expect(d.items[0]).toMatchObject({ slug: 'w-die-eltern', gender: null, plural: null, context: 'Used in the plural.' })
    expect(d.items[1]).toMatchObject({ slug: 'w-schoen', context: '' })
  })
})

describe('course API', () => {
  it('lists 36 weeks with counts and progress', async () => {
    const c = await client()
    await c.login()
    const data = await c.get('/api/course')
    expect(data.weeks).toHaveLength(36)
    expect(data.weeks[0].patterns.map((p: { code: string }) => p.code)).toEqual(['P01', 'P02', 'P07'])
    expect(data.weeks[0].items.total).toBeGreaterThan(20)
    expect(data.totals.patterns).toBeGreaterThanOrEqual(40)
  })

  it('week detail splits phrases and words', async () => {
    const c = await client()
    await c.login()
    const w = await c.get('/api/course/3')
    expect(w.words.length).toBeGreaterThan(10)
    expect(w.phrases.length).toBeGreaterThan(5)
    expect(w.words.every((i: { kind: string }) => i.kind === 'word')).toBe(true)
    expect((await c.req('/api/course/99')).status).toBe(404)
  })

  it('grammar practice drives the daily grammar step and counts as production', async () => {
    const c = await client()
    await c.login()
    let d = await c.get('/api/daily')
    expect(d.grammar).toMatchObject({ code: 'P01', practised_today: false, accuracy: null })
    const p = await c.get('/api/grammar/P01')
    expect(p.drills.length).toBeGreaterThanOrEqual(5)
    await c.post('/api/grammar/P01/practice', { uuid: 'grammar-0001', correct: 4, total: 5 })
    expect((await c.post('/api/grammar/P01/practice', { uuid: 'grammar-0001', correct: 4, total: 5 })).duplicate).toBe(true)
    d = await c.get('/api/daily')
    expect(d.grammar).toMatchObject({ code: 'P01', practised_today: true, accuracy: 80 })
    expect(d.produced).toBe(1)
    expect((await c.get('/api/grammar/P01')).mastered).toBe(false)
    expect((await c.req('/api/grammar/P01/practice', { method: 'POST', json: { correct: 6, total: 5 } })).status).toBe(400)
  })
})
