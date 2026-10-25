import { describe, expect, it } from 'vitest'
import { gradeTyped, normalize } from './grade'

describe('normalize', () => {
  it('folds case, punctuation and umlauts', () => {
    expect(normalize('Grüß Gott!')).toBe('gruess gott')
    expect(normalize('Gruess gott')).toBe('gruess gott')
    expect(normalize('Wie geht’s?')).toBe("wie geht's")
  })
})

describe('gradeTyped', () => {
  it('accepts exact answers ignoring punctuation', () => {
    expect(gradeTyped('ist hier frei', ['Ist hier frei?']).verdict).toBe('exact')
  })
  it('accepts alternatives', () => {
    expect(gradeTyped('Nochmal, bitte', ['Noch einmal, bitte.', 'Nochmal, bitte.']).suggested).toBe(3)
  })
  it('marks small typos as close (Hard)', () => {
    const r = gradeTyped('Ich hatte gern einen Kaffee', ['Ich hätte gern einen Kaffee.'])
    expect(r.verdict).toBe('close')
    expect(r.suggested).toBe(2)
  })
  it('marks wrong case endings as close, not exact', () => {
    expect(gradeTyped('Ich hätte gern ein Kaffee', ['Ich hätte gern einen Kaffee.']).verdict).toBe('close')
  })
  it('rejects wrong answers', () => {
    expect(gradeTyped('Danke', ['Ist hier frei?']).suggested).toBe(1)
  })
  it('lets word cards drop the article', () => {
    expect(gradeTyped('Sackerl', ['das Sackerl']).verdict).toBe('exact')
  })
  it('treats empty input as wrong', () => {
    expect(gradeTyped('  ', ['Hallo!']).verdict).toBe('wrong')
  })
})
