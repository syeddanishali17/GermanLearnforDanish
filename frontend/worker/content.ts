/** Learning content bundled from data/*.json. Validated by tests; never written by the app. */

import a1 from '../../data/conversations/a1.json'
import a2 from '../../data/conversations/a2.json'
import b1 from '../../data/conversations/b1.json'
import survival from '../../data/seed/1_survival.json'
import vienna from '../../data/seed/2_vienna.json'
import uni from '../../data/seed/3_uni.json'
import home from '../../data/seed/4_home_city.json'
import smalltalk from '../../data/seed/5_smalltalk_a2.json'
import b1deck from '../../data/seed/6_b1_expression.json'
import words from '../../data/seed/7_words.json'
import curriculum from '../../data/curriculum.json'
import grammarA1 from '../../data/grammar/a1.json'
import grammarA2 from '../../data/grammar/a2.json'
import grammarB1 from '../../data/grammar/b1.json'

export type Cefr = 'A1' | 'A2' | 'B1'

export interface Turn {
  who: string
  de: string
  en: string
  alt?: string[]
}

export interface ContentItem {
  slug: string
  deck: string
  kind: string
  de: string
  en: string
  alt_de: string[]
  gender: string | null
  plural: string | null
  register: string
  region_tag: string
  learner_action: 'use_now' | 'recognise_now' | 'later'
  context: string
  likely_reply_de: string | null
  likely_reply_en: string | null
  austria_note: string | null
  mini_dialogue: Turn[]
  mission: string | null
  verify_source: string | null
  week: number
  cefr: Cefr
  status: string
  /** position for intake: week, then order in deck, then deck order */
  rank: number
}

export interface Conversation {
  slug: string
  cefr: Cefr
  week: number
  order: number
  title: string
  title_de: string
  setting: string
  partner: string
  register: string
  goal: string
  patterns: string[]
  turns: Turn[]
  key_phrases: { de: string; en: string }[]
  notes: string[]
  status: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>

export interface Overlay {
  items?: Record<string, Raw>
  conversations?: Record<string, Raw>
  deck_titles?: Record<string, string>
}

/**
 * Personal content lives in data/private/overlay.json (git-ignored, see docs/PRIVACY.md). It replaces fields of
 * public items/conversations by slug when the app is built on Danish's machine; public builds use the generic text.
 */
const privateFiles = import.meta.glob<Overlay>('../../data/private/overlay.json', { eager: true, import: 'default' })
export const PRIVATE_OVERLAY: Overlay = Object.values(privateFiles)[0] ?? {}

export function applyOverlay(decks: Raw[], convFiles: Raw[], overlay: Overlay): [Raw[], Raw[]] {
  const items = overlay.items ?? {}
  const convs = overlay.conversations ?? {}
  return [
    decks.map((d) => ({
      ...d,
      title: overlay.deck_titles?.[d.deck] ?? d.title,
      items: d.items.map((i: Raw) => (items[i.slug] ? { ...i, ...items[i.slug] } : i)),
    })),
    convFiles.map((f) => ({ ...f, conversations: f.conversations.map((c: Raw) => (convs[c.slug] ? { ...c, ...convs[c.slug] } : c)) })),
  ]
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const ARTICLE = /^(der|die|das) /

/**
 * Word decks are written compactly as groups of [German, English, plural-or-forms] (data/seed/7_words.json).
 * Nouns ("der Tisch") get gender and plural; verbs and adjectives get their key forms as context.
 * tools/tts/generate.py mirrors this expansion.
 */
export function expandWordDeck(deck: Raw): Raw {
  if (!deck.groups) return deck
  const items: Raw[] = []
  for (const g of deck.groups) {
    for (const [de, en, extra] of g.words as [string, string, string | undefined][]) {
      const m = de.match(ARTICLE)
      const noun = !!m
      const pluralOnly = extra === 'plural only' || extra === 'plural'
      items.push({
        slug: `w-${slugify(de)}`,
        kind: 'word',
        de,
        en,
        week: g.week,
        tags: [g.topic],
        gender: noun && !pluralOnly ? m![1] : null,
        plural: noun && extra && extra !== '–' && !pluralOnly ? extra : null,
        context: noun ? (pluralOnly ? 'Used in the plural.' : '') : extra && extra !== '–' ? extra : '',
      })
    }
  }
  return { ...deck, items }
}

export const PUBLIC_DECK_FILES: Raw[] = [survival, vienna, uni, home, smalltalk, b1deck, expandWordDeck(words)]
export const PUBLIC_CONVERSATION_FILES: Raw[] = [a1, a2, b1]
export const [DECK_FILES, CONVERSATION_FILES] = applyOverlay(PUBLIC_DECK_FILES, PUBLIC_CONVERSATION_FILES, PRIVATE_OVERLAY)

export const cefrForWeek = (week: number): Cefr => (week <= 12 ? 'A1' : week <= 24 ? 'A2' : 'B1')

const ENUMS: Record<string, (string | null)[]> = {
  gender: [null, 'der', 'die', 'das'],
  register: ['formal', 'informal', 'neutral'],
  region_tag: ['standard', 'dach', 'austria', 'vienna', 'recognition'],
  learner_action: ['use_now', 'recognise_now', 'later'],
  status: ['draft', 'reviewed', 'approved', 'flagged'],
  cefr: ['A1', 'A2', 'B1'],
}

export function validateDecks(decks: Raw[]): string[] {
  const errors: string[] = []
  const slugs = new Set<string>()
  for (const deck of decks) {
    deck.items.forEach((raw: Raw, n: number) => {
      const where = `${deck.deck}#${n} (${raw.slug})`
      for (const f of ['slug', 'de', 'en']) if (!raw[f]) errors.push(`${where}: missing ${f}`)
      if (slugs.has(raw.slug)) errors.push(`${where}: duplicate slug`)
      slugs.add(raw.slug)
      for (const [f, allowed] of Object.entries(ENUMS)) if (f in raw && !allowed.includes(raw[f])) errors.push(`${where}: bad ${f}=${raw[f]}`)
      for (const t of raw.dialogue ?? []) if (!t.who || !t.de || !t.en) errors.push(`${where}: dialogue turn needs who/de/en`)
    })
  }
  return errors
}

export function validateConversations(files: Raw[]): string[] {
  const errors: string[] = []
  const slugs = new Set<string>()
  for (const file of files) {
    if (!ENUMS.cefr.includes(file.cefr)) errors.push(`file needs cefr A1/A2/B1`)
    file.conversations.forEach((c: Raw, n: number) => {
      const where = `${file.cefr}#${n} (${c.slug})`
      for (const f of ['slug', 'title', 'title_de', 'turns']) if (!c[f]) errors.push(`${where}: missing ${f}`)
      if (slugs.has(c.slug)) errors.push(`${where}: duplicate slug`)
      slugs.add(c.slug)
      if (!c.turns?.some((t: Raw) => t.who === 'Du')) errors.push(`${where}: no learner (Du) turns`)
      for (const t of c.turns ?? []) if (!t.who || !t.de || !t.en) errors.push(`${where}: turn needs who/de/en`)
      for (const k of c.key_phrases ?? []) if (!k.de || !k.en) errors.push(`${where}: key phrase needs de/en`)
    })
  }
  return errors
}

export function buildItems(decks: Raw[]): ContentItem[] {
  const out: ContentItem[] = []
  let global = 0
  for (const deck of decks) {
    deck.items.forEach((raw: Raw, order: number) => {
      const week = raw.week ?? deck.week ?? 1
      out.push({
        slug: raw.slug,
        deck: deck.deck,
        kind: raw.kind ?? 'chunk',
        de: raw.de,
        en: raw.en,
        alt_de: raw.alt_de ?? [],
        gender: raw.gender ?? null,
        plural: raw.plural ?? null,
        register: raw.register ?? 'neutral',
        region_tag: raw.region_tag ?? 'standard',
        learner_action: raw.learner_action ?? 'use_now',
        context: raw.context ?? '',
        likely_reply_de: raw.likely_reply_de ?? null,
        likely_reply_en: raw.likely_reply_en ?? null,
        austria_note: raw.austria_note ?? null,
        mini_dialogue: raw.dialogue ?? [],
        mission: raw.mission ?? null,
        verify_source: raw.verify_source ?? null,
        week,
        cefr: raw.cefr ?? deck.cefr ?? cefrForWeek(week),
        status: raw.status ?? deck.status ?? 'draft',
        rank: week * 1_000_000 + order * 1_000 + global++,
      })
    })
  }
  return out.sort((a, b) => a.rank - b.rank)
}

export function buildConversations(files: Raw[]): Conversation[] {
  const order: Record<string, number> = { A1: 0, A2: 1, B1: 2 }
  return files
    .flatMap((f) =>
      f.conversations.map((c: Raw, i: number) => ({
        slug: c.slug,
        cefr: f.cefr,
        week: c.week ?? 1,
        order: i,
        title: c.title,
        title_de: c.title_de,
        setting: c.setting ?? '',
        partner: c.partner ?? '',
        register: c.register ?? 'informal',
        goal: c.goal ?? '',
        patterns: c.patterns ?? [],
        turns: c.turns,
        key_phrases: c.key_phrases ?? [],
        notes: c.notes ?? [],
        status: c.status ?? f.status ?? 'reviewed',
      })),
    )
    .sort((a: Conversation, b: Conversation) => order[a.cefr] - order[b.cefr] || a.week - b.week || a.order - b.order)
}

// ---------- course: weeks and grammar ----------

export type Drill =
  | { t: 'gap'; q: string; a: string; o?: string[]; en?: string }
  | { t: 'order'; a: string; en?: string }
  | { t: 'tr'; q: string; a: string; alt?: string[]; en?: string }

export interface Pattern {
  code: string
  week: number
  cefr: Cefr
  title: string
  title_de: string
  explain: string[]
  slots?: [string, string][]
  table?: [string, string][]
  examples: [string, string][]
  mistake?: { wrong: string; right: string; why: string }
  drills: Drill[]
}

export interface Week {
  week: number
  cefr: Cefr
  title: string
  title_de: string
  goals: string[]
  patterns: string[]
}

export const GRAMMAR_FILES: Raw[] = [grammarA1, grammarA2, grammarB1]
export const CURRICULUM: Raw = curriculum

export function validateGrammar(files: Raw[], weeks: Raw): string[] {
  const errors: string[] = []
  const codes = new Set<string>()
  for (const f of files) {
    for (const p of f.patterns) {
      const where = p.code
      if (codes.has(p.code)) errors.push(`${where}: duplicate code`)
      codes.add(p.code)
      for (const k of ['code', 'week', 'title', 'title_de', 'explain', 'examples', 'drills']) if (!p[k]) errors.push(`${where}: missing ${k}`)
      if ((p.drills?.length ?? 0) < 3) errors.push(`${where}: needs at least 3 drills`)
      p.drills?.forEach((d: Raw, i: number) => {
        if (!['gap', 'order', 'tr'].includes(d.t)) errors.push(`${where}#${i}: bad drill type ${d.t}`)
        if (!d.a) errors.push(`${where}#${i}: drill needs an answer`)
        if (d.t === 'gap' && !String(d.q).includes('___')) errors.push(`${where}#${i}: gap needs ___`)
        if (d.t === 'gap' && d.o && !d.o.includes(d.a)) errors.push(`${where}#${i}: answer not among options`)
        if (d.t === 'tr' && !d.q) errors.push(`${where}#${i}: transform needs a prompt`)
      })
    }
  }
  const seenWeeks = new Set<number>()
  for (const w of weeks.weeks) {
    seenWeeks.add(w.week)
    for (const c of w.patterns) if (!codes.has(c)) errors.push(`week ${w.week}: unknown pattern ${c}`)
  }
  for (let n = 1; n <= 36; n++) if (!seenWeeks.has(n)) errors.push(`curriculum: week ${n} missing`)
  return errors
}

export interface Content {
  items: ContentItem[]
  bySlug: Map<string, ContentItem>
  conversations: Conversation[]
  conversationBySlug: Map<string, Conversation>
  patterns: Pattern[]
  patternByCode: Map<string, Pattern>
  weeks: Week[]
}

export function makeContent(decks: Raw[] = DECK_FILES, convs: Raw[] = CONVERSATION_FILES, grammar: Raw[] = GRAMMAR_FILES, weeks: Raw = CURRICULUM): Content {
  const items = buildItems(decks)
  const conversations = buildConversations(convs)
  const patterns: Pattern[] = grammar.flatMap((f) => f.patterns.map((p: Raw) => ({ ...p, cefr: f.cefr }))).sort((a, b) => a.week - b.week)
  return {
    items,
    bySlug: new Map(items.map((i) => [i.slug, i])),
    conversations,
    conversationBySlug: new Map(conversations.map((c) => [c.slug, c])),
    patterns,
    patternByCode: new Map(patterns.map((p) => [p.code, p])),
    weeks: weeks.weeks,
  }
}
