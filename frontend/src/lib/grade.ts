/** Typed-answer checking. Lenient on case, punctuation and umlaut spelling; suggests an FSRS rating. */
import type { Rating } from './types'

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/\.\.\.|…/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** Remove a leading article so "Sackerl" matches "das Sackerl" on word cards. */
const stripArticle = (s: string) => s.replace(/^(der|die|das) /, '')

export interface GradeResult {
  verdict: 'exact' | 'close' | 'wrong'
  suggested: Rating
  distance: number
}

export function gradeTyped(answer: string, accepted: string[]): GradeResult {
  const a = normalize(answer)
  if (!a) return { verdict: 'wrong', suggested: 1, distance: Infinity }
  let best = Infinity
  for (const target of accepted) {
    const t = normalize(target)
    best = Math.min(best, levenshtein(a, t))
    // Right word, missing or wrong article: close, because the article is part of learning a noun.
    if (stripArticle(t) !== t && levenshtein(stripArticle(a), stripArticle(t)) === 0 && a !== t) best = Math.min(best, 1)
  }
  const longest = Math.max(...accepted.map((t) => normalize(t).length), 1)
  if (best === 0) return { verdict: 'exact', suggested: 3, distance: 0 }
  if (best <= Math.max(2, Math.floor(longest * 0.15))) return { verdict: 'close', suggested: 2, distance: best }
  return { verdict: 'wrong', suggested: 1, distance: best }
}
