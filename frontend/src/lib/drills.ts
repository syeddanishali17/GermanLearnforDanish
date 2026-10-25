/** Grammar drill helpers: answer sentence, word tiles, answer comparison. */
import { normalize as normaliseAnswer } from './grade'
import type { Drill } from './types'

/** Same full-sentence form the audio generator uses for drill answers. */
export const drillSentence = (d: Drill) => (d.t === 'gap' ? d.q.replace('___', d.a).replace(/\s*\([^)]*\)\s*$/, '') : d.a)

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  // Never start already solved.
  return out.join(' ') === arr.join(' ') && out.length > 1 ? [...out.slice(1), out[0]] : out
}

/** Tiles: words without punctuation; the first word lower-cased so capitals don't give the answer away. */
export function tilesFor(answer: string): string[] {
  const words = answer.replace(/[.,!?;:„“"]/g, '').split(/\s+/).filter(Boolean)
  if (words.length) words[0] = words[0].charAt(0).toLowerCase() + words[0].slice(1)
  return seededShuffle(words, answer)
}

export const same = (a: string, b: string) => normaliseAnswer(a) === normaliseAnswer(b)
