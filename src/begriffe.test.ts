import { describe, it, expect } from 'vitest'
import { BEGRIFFE, begriffeAlphabetisch, begriffeImText, begriffTeile, begriffRegex } from './begriffe'

// Korrektur 31.10.2026 (Punkt 9b): Begriffe in Alltagssprache, je ein bis zwei Sätze, eigene Worte
describe('Begriffe', () => {
  it('keine doppelten ids und Namen; Muster gültig', () => {
    expect(new Set(BEGRIFFE.map(b => b.id)).size).toBe(BEGRIFFE.length)
    expect(new Set(BEGRIFFE.map(b => b.name)).size).toBe(BEGRIFFE.length)
    for (const b of BEGRIFFE) { expect(b.muster.length).toBeGreaterThan(0); expect(() => begriffRegex(b)).not.toThrow() }
  })
  it('Text: ein bis zwei Sätze, ohne ß, ohne Abkürzungspunkte', () => {
    for (const b of BEGRIFFE) {
      const saetze = b.text.split(/(?<=[.!?])\s+/).filter(x => x.trim())
      expect(saetze.length, b.id).toBeGreaterThanOrEqual(1)
      expect(saetze.length, b.id).toBeLessThanOrEqual(2)
      expect(b.text.endsWith('.'), b.id).toBe(true)
      expect(`${b.name} ${b.text}`, b.id).not.toContain('ß')
    }
  })
  it('Liste des Auftrags vollständig, alphabetisch', () => {
    for (const id of ['anhaltesicht', 'arm', 'b', 'd', 'fa', 'fb', 'fahrlinie', 'faeg', 'gehlinie', 'haltelinie', 'stop', 'knoten', 'a', 'k',
      'neigung', 'misch', 'palisade', 'rv', 'sichtfeld', 'sichtlinie', 'strassentyp', 'tue', 'ueberholfall', 'ungunst', 'v85', 'velogegen',
      'vortrittsstrasse', 'wahrnehmbarkeit', 'zufahrt', 'av', 'osm', 'swissalti3d']) expect(BEGRIFFE.some(b => b.id === id), id).toBe(true)
    const namen = begriffeAlphabetisch().map(b => b.name)
    expect(namen).toEqual([...namen].sort((a, b) => a.localeCompare(b, 'de', { sensitivity: 'base' })))
  })
  it('Erkennung im Text: ganze Wörter, erstes Vorkommen je Begriff', () => {
    expect(begriffeImText(['Das wartende Fahrzeug steht vor der Haltelinie.']).map(b => b.id)).toEqual(['haltelinie'])
    expect(begriffeImText(['Armee']).length).toBe(0)
    const g = new Set<string>()
    const t = begriffTeile('Rechtsvortritt hier, Rechtsvortritt dort', g)
    expect(t.filter(x => 'begriff' in x).length).toBe(1)
    expect(t.map(x => x.text).join('')).toBe('Rechtsvortritt hier, Rechtsvortritt dort')
    expect(begriffTeile('Rechtsvortritt', g).some(x => 'begriff' in x)).toBe(false)
  })
})
