// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { CURRICULUM, EXTRA_DRILLS, expandWordDeck, GRAMMAR_FILES, validateGrammar } from './content'
import { drillSentence } from '../src/lib/drills'
import { fakePlurals, grammarMix, wordWorkout } from './workout'
import { content } from './index'
import { client } from './test/helpers'

describe('course content', () => {
  it('grammar and curriculum are valid and complete', () => {
    expect(validateGrammar(GRAMMAR_FILES, CURRICULUM)).toEqual([])
    expect(content.weeks).toHaveLength(36)
    expect(content.patterns.length).toBeGreaterThanOrEqual(55)
    expect(content.patterns.reduce((n, p) => n + p.drills.length, 0)).toBeGreaterThanOrEqual(500)
    expect(content.patterns.every((p) => p.drills.length >= 8)).toBe(true)
  })

  it('extra drills only target lessons that exist', () => {
    for (const code of Object.keys(EXTRA_DRILLS)) expect(content.patternByCode.has(code), code).toBe(true)
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

// Deterministic random for generated rounds.
const seeded = (seed = 1) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646

describe('generated workouts', () => {
  it('word rounds use each word once, with valid answers', () => {
    for (const week of [0, 1, 3, 12, 24]) {
      const drills = wordWorkout(content, week, 24, seeded(week + 1))
      const n = Math.min(12, content.items.filter((i) => i.kind === 'word' && (week ? i.week === week : i.week <= 24)).length)
      expect(drills).toHaveLength(n)
      expect(n).toBeGreaterThanOrEqual(8)
      for (const d of drills) {
        if (d.t === 'gap' || d.t === 'pick') expect(d.o, JSON.stringify(d)).toContain(d.a)
        if (d.t === 'pick') expect(new Set(d.o).size).toBe(d.o.length)
        expect(drillSentence(d)).not.toContain('___')
      }
    }
  })

  it('word rounds cover several drill kinds', () => {
    const kinds = new Set(wordWorkout(content, 0, 36, seeded(7), 60).map((d) => (d.t === 'pick' ? `pick-${d.ask}` : d.t)))
    expect([...kinds].sort()).toEqual(['gap', 'pick-de', 'pick-en', 'tr'])
  })

  it('fake plurals never include the real one', () => {
    expect(fakePlurals('der Tisch', 'die Tische')).not.toContain('die Tische')
    expect(fakePlurals('die Stadt', 'die Städte')).not.toContain('die Städte')
    expect(fakePlurals('die Stadt', 'die Städte').length).toBeGreaterThanOrEqual(2)
    expect(fakePlurals('das Haus', 'die Häuser')).toContain('die Häuse')
    expect(fakePlurals('die Packung', 'die Packungen').join(' ')).not.toMatch(/[äöü]/)
  })

  it('grammar mix only uses lessons up to the week and favours shaky ones', () => {
    const stats = new Map([['P04', { accuracy: 40, rounds: 2, last: 1 }]])
    const drills = grammarMix(content, stats, 3, seeded(3))
    expect(drills).toHaveLength(10)
    expect(drills.every((d) => content.patternByCode.get(d.code!)!.week <= 3)).toBe(true)
    expect(drills.filter((d) => d.code === 'P04').length).toBeGreaterThanOrEqual(2)
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

  it('word workout: round, practice, daily Lughat', async () => {
    const c = await client()
    await c.login()
    let d = await c.get('/api/daily')
    expect(d.words).toMatchObject({ week: 1, practised_today: false, accuracy: null })
    const w = await c.get('/api/vocab/1')
    expect(w.drills).toHaveLength(12)
    expect((await c.get('/api/vocab/0')).drills).toHaveLength(12)
    expect((await c.req('/api/vocab/37')).status).toBe(404)
    expect((await c.req('/api/vocab/25')).status).toBe(404)
    await c.post('/api/vocab/1/practice', { uuid: 'words-0001', correct: 9, total: 12 })
    expect((await c.post('/api/vocab/1/practice', { uuid: 'words-0001', correct: 9, total: 12 })).duplicate).toBe(true)
    d = await c.get('/api/daily')
    expect(d.words).toMatchObject({ week: 1, practised_today: true, accuracy: 75 })
    expect(d.grammar).toMatchObject({ code: 'P01', practised_today: false })
    expect(d.produced).toBe(1)
    expect((await c.get('/api/course/1')).word_accuracy).toBe(75)
  })

  it('grammar mix stores results per lesson', async () => {
    const c = await client()
    await c.login()
    const m = await c.get('/api/workout/grammar')
    expect(m.drills.length).toBeGreaterThanOrEqual(5)
    const results = [
      { code: 'P01', ok: true },
      { code: 'P01', ok: true },
      { code: 'P02', ok: false },
    ]
    await c.post('/api/workout/grammar/practice', { uuid: 'mix-0001', results })
    expect((await c.post('/api/workout/grammar/practice', { uuid: 'mix-0001', results })).duplicate).toBe(true)
    expect((await c.get('/api/grammar/P01')).accuracy).toBe(100)
    expect((await c.get('/api/grammar/P02')).accuracy).toBe(0)
    expect((await c.req('/api/workout/grammar/practice', { method: 'POST', json: { results: [{ code: 'X99', ok: true }] } })).status).toBe(400)
  })
})
