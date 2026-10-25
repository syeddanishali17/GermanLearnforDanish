import { describe, expect, it } from 'vitest'
import { drillSentence, same, tilesFor } from './drills'

describe('drills', () => {
  it('builds the full sentence for a gap drill without the hint in brackets', () => {
    expect(drillSentence({ t: 'gap', q: 'Du ___ sehr gut Deutsch. (sprechen)', a: 'sprichst' })).toBe('Du sprichst sehr gut Deutsch.')
    expect(drillSentence({ t: 'order', a: 'Ich lerne Deutsch.' })).toBe('Ich lerne Deutsch.')
  })

  it('tiles hide punctuation and the capital of the first word, and never start solved', () => {
    const tiles = tilesFor('Morgen arbeite ich nicht.')
    expect([...tiles].sort()).toEqual(['arbeite', 'ich', 'morgen', 'nicht'])
    expect(tiles.join(' ')).not.toBe('morgen arbeite ich nicht')
    expect(tilesFor('Es regnet, aber wir gehen spazieren.')).not.toContain('regnet,')
  })

  it('compares answers ignoring case, punctuation and umlaut spelling', () => {
    expect(same('morgen arbeite ich nicht', 'Morgen arbeite ich nicht.')).toBe(true)
    expect(same('Ich moechte einen Tee', 'Ich möchte einen Tee.')).toBe(true)
    expect(same('Ich möchte ein Tee', 'Ich möchte einen Tee.')).toBe(false)
  })
})
