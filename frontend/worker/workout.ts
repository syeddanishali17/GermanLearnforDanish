/**
 * Generated practice rounds that reuse the grammar drill UI:
 * - word workouts: der/die/das, plurals, meaning both ways, typing the German, Perfekt with hat/ist
 * - grammar mix: drills from several lessons up to the current week, weakest lessons first
 * Results are stored in grammar_practice: word rounds as code W<week> (W0 = mixed weeks), mix rounds per lesson.
 */

import { dayStart, localDay } from './clock'
import type { Content, ContentItem, Drill, Pattern } from './content'
import { MASTERED, type PatternStat } from './course'
import { all } from './db'

export type WorkoutDrill = (Drill | { t: 'pick'; q: string; a: string; o: string[]; de: string; ask: 'de' | 'en'; en?: string }) & { code?: string; label?: string }

type Rand = () => number

export function shuffle<T>(arr: T[], rand: Rand = Math.random): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

const ARTICLE = /^(der|die|das) /
const bare = (de: string) => de.replace(ARTICLE, '')
const UMLAUT: Record<string, string> = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü' }

/**
 * Plausible wrong plurals: common endings. Umlaut variants only for one-syllable nouns (Stadt → Städte),
 * where learners really have to choose; -ung, -heit etc. never take one.
 */
export function fakePlurals(singular: string, real: string): string[] {
  const n = bare(singular)
  const oneSyllable = (n.toLowerCase().match(/[aeiouäöü]+/g) ?? []).length === 1
  const umlauted = oneSyllable ? n.replace(/(au|[aou])/i, (v: string) => (v.toLowerCase() === 'au' ? `${UMLAUT[v[0]]}u` : UMLAUT[v])) : n
  const forms = n.endsWith('e') ? [`${n}n`, `${n}s`, n, `${n}r`] : [`${n}e`, `${n}en`, `${n}s`, n, `${n}er`]
  if (umlauted !== n) forms.push(`${umlauted}e`, `${umlauted}er`)
  return [...new Set(forms.map((f) => `die ${f}`))].filter((f) => f !== real)
}

const perfekt = (context: string) => context.match(/\b(hat|ist) (\S+)$/)

function kindsFor(w: ContentItem): string[] {
  if (w.gender) return ['article', ...(w.plural ? ['plural'] : []), 'to-de', 'to-en', 'type']
  if (perfekt(w.context)) return ['perfekt', 'to-de', 'to-en', 'type']
  return ['to-de', 'to-en', 'type']
}

function distractors(w: ContentItem, pool: ContentItem[], field: 'de' | 'en', rand: Rand): string[] {
  const sameKind = pool.filter((x) => x.slug !== w.slug && !!x.gender === !!w.gender && x[field] !== w[field])
  const others = pool.filter((x) => x.slug !== w.slug && x[field] !== w[field])
  return [...new Set(shuffle(sameKind.length >= 2 ? sameKind : others, rand).map((x) => x[field]))].slice(0, 2)
}

function wordDrill(w: ContentItem, kind: string, pool: ContentItem[], rand: Rand): WorkoutDrill {
  // label is shown above the question, so it must never give the answer away.
  switch (kind) {
    case 'article':
      return { t: 'gap', q: `___ ${bare(w.de)}`, a: w.gender!, o: ['der', 'die', 'das'], en: w.en, label: w.en }
    case 'plural':
      return { t: 'pick', q: `Plural of ${w.de}?`, a: w.plural!, o: shuffle([w.plural!, ...shuffle(fakePlurals(w.de, w.plural!), rand).slice(0, 2)], rand), de: w.plural!, ask: 'en', en: `${w.en} (plural)`, label: 'Plural' }
    case 'perfekt': {
      const [, aux, part] = perfekt(w.context)!
      return { t: 'gap', q: `Er ___ ${part}. (${w.de})`, a: aux, o: ['hat', 'ist'], en: `Perfekt of ${w.de}: ${w.en}`, label: 'Perfekt: hat or ist?' }
    }
    case 'to-de':
      return { t: 'pick', q: w.en, a: w.de, o: shuffle([w.de, ...distractors(w, pool, 'de', rand)], rand), de: w.de, ask: 'en', en: w.en, label: 'In German' }
    case 'to-en':
      return { t: 'pick', q: w.de, a: w.en, o: shuffle([w.en, ...distractors(w, pool, 'en', rand)], rand), de: w.de, ask: 'de', en: w.en, label: 'Meaning' }
    default:
      return { t: 'tr', q: w.gender ? `In German, with der/die/das: ${w.en}` : `In German: ${w.en}`, a: w.de, en: w.en, label: 'Type it' }
  }
}

export const WORD_ROUND = 12

/** One round over a week's words (week 0 = every word up to `upTo`). Each word once; drill kinds rotate. */
export function wordWorkout(content: Content, week: number, upTo: number, rand: Rand = Math.random, size = WORD_ROUND): WorkoutDrill[] {
  const allWords = content.items.filter((i) => i.kind === 'word')
  const words = allWords.filter((i) => (week ? i.week === week : i.week <= Math.max(upTo, 1)))
  const pool = words.length >= 6 ? words : allWords
  return shuffle(words, rand)
    .slice(0, size)
    .map((w, n) => {
      const kinds = kindsFor(w)
      return wordDrill(w, kinds[(n + Math.floor(rand() * kinds.length)) % kinds.length], pool, rand)
    })
}

export const MIX_ROUND = 10

/**
 * Mixed grammar: lessons up to the current week. Practised-but-shaky lessons first, then mastered ones that were
 * practised longest ago, then lessons not tried yet. Two drills per lesson.
 */
export function grammarMix(content: Content, stats: Map<string, PatternStat>, week: number, rand: Rand = Math.random, size = MIX_ROUND): WorkoutDrill[] {
  const open = content.patterns.filter((p) => p.week <= Math.max(week, 1))
  const shaky = shuffle(open.filter((p) => stats.get(p.code)?.rounds && (stats.get(p.code)!.accuracy ?? 0) < MASTERED), rand)
  const solid = open.filter((p) => (stats.get(p.code)?.accuracy ?? 0) >= MASTERED).sort((a, b) => (stats.get(a.code)?.last ?? 0) - (stats.get(b.code)?.last ?? 0))
  const fresh = shuffle(open.filter((p) => !stats.get(p.code)?.rounds), rand)
  const order: Pattern[] = [...shaky, ...solid, ...fresh]
  const per = Math.max(2, Math.ceil(size / Math.max(1, Math.min(order.length, size / 2))))
  const out: WorkoutDrill[] = []
  for (const p of order) {
    for (const d of shuffle(p.drills, rand).slice(0, per)) if (out.length < size) out.push({ ...d, code: p.code, label: p.title })
    if (out.length >= size) break
  }
  return shuffle(out, rand)
}

export const wordCode = (week: number) => `W${week}`

/** Word practice for the Today page: the current week's words if it has any, else mixed revision. */
export async function dailyWords(db: D1Database, content: Content, week: number, now: number, stats: Map<string, PatternStat>) {
  const hasWords = content.items.some((i) => i.kind === 'word' && i.week === week)
  const w = hasWords ? week : 0
  const start = dayStart(localDay(now))
  const today = await all<{ id: number }>(db, "SELECT id FROM grammar_practice WHERE ts >= ? AND code LIKE 'W%' LIMIT 1", start)
  return { week: w, accuracy: stats.get(wordCode(w))?.accuracy ?? null, practised_today: today.length > 0 }
}
