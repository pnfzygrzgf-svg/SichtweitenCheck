import { describe, it, expect } from 'vitest'
import { REGELN, WERKE, WERK_IDS, MIT_SEITE, THEMEN, HERKUNFT, WIRKUNG_TEXT, regelnJeWerk, regelGruppen, regelnVonWerk, regelnZaehlen } from './regeln'

// Korrektur 31.10.2026 (Punkt 9c): Katalog der angewendeten Regeln
describe('Regeln', () => {
  it('jede Regel: eindeutige id, Werk, Fundstelle, Herkunft, Wirkung, Thema; Wert und Daten nur, wo es sie gibt', () => {
    expect(new Set(REGELN.map(r => r.id)).size).toBe(REGELN.length)
    for (const r of REGELN) {
      expect(WERK_IDS, r.id).toContain(r.werk)
      expect(r.fundstelle.trim(), r.id).not.toBe('')
      expect(HERKUNFT, r.id).toContain(r.herkunft)
      expect(r.herkunft, r.id).toBe(WERKE[r.werk].herkunft)
      expect(Object.keys(WIRKUNG_TEXT), r.id).toContain(r.wirkung)
      expect(THEMEN.map(t => t[0]), r.id).toContain(r.thema)
      expect(r.prueft.trim() && r.titel.trim(), r.id).toBeTruthy()
      // ohne Wert bzw. Daten fehlt das Feld; nie «–», «Rechnung» oder leer
      for (const x of [r.werte, r.daten]) if (x !== undefined) expect(x.trim(), r.id).not.toMatch(/^(|–|-|Rechnung)$/)
      expect(`${r.titel} ${r.prueft} ${r.werte ?? ''} ${r.daten ?? ''}`, r.id).not.toContain('ß')
    }
  })
  // Überarbeitung 31.10.2026 (Nutzer): Alltagssprache ohne Code-Wörter, «Kein Vortritt» statt «Vortritt» für das Signal, Daten in Worten
  it('Texte ohne Code-Wörter und Selbstreferenz; Daten beginnen nicht mit einem OSM-Tag', () => {
    const verboten = [/Achse/, /Zielpunkt/, /Querschnitt/, /Rückfallebene/, /Sehne/, /Stütze/, /[a-z]+=[a-z]/, /[A-Z_]{4,}/, /wie «Vortritt»/,
      /\bOSM\b/]
    for (const r of REGELN) for (const v of verboten) expect(`${r.titel} ${r.prueft}`, `${r.id}: ${v}`).not.toMatch(v)
    for (const r of REGELN) if (r.daten) {
      expect(r.daten, r.id).not.toMatch(/^[a-z_:]+=/)
      expect(r.daten, r.id).not.toMatch(/^OSM\b/)
    }
  })
  it('Herkunft je Werk; Wirkung nach dem Code (Stichproben); Zählung', () => {
    expect(WERK_IDS.map(w => WERKE[w].herkunft)).toEqual(['Norm', 'Norm', 'Norm', 'Norm', 'Norm', 'Fachempfehlung', 'Recht', 'Recht', 'Recht',
      'Kantonale Praxis', 'Kantonale Praxis', 'Kantonale Praxis', 'Kantonale Praxis', 'Annahme der App', 'Projektentscheid'])
    const r = (id: string) => REGELN.find(x => x.id === id)!
    expect(r('VRV-15.3').herkunft).toBe('Recht')
    expect(r('VRV-15.3').wirkung).toBe('rechnet mit')
    expect(['BE-2.3', 'LU-653', 'BS-5.2', 'SSV-36.7'].map(id => r(id).wirkung)).toEqual(['nur Hinweis', 'nur Hinweis', 'nur Hinweis', 'nur Hinweis'])
    expect(r('BE-2.3').herkunft).toBe('Kantonale Praxis')
    expect(r('BE-2.3').werte).toBeUndefined()
    expect(r('BE-2.3').daten).toBe('Ergebnis der Sichtprüfung dieser Zufahrt')
    expect(r('V242-12.3').prueft).toContain('«Kein Vortritt»')
    const z = regelnZaehlen()
    expect(z.wirkung['rechnet mit'] + z.wirkung['nur Hinweis']).toBe(REGELN.length)
    expect(z.herkunft.reduce((s, x) => s + x[1], 0)).toBe(REGELN.length)
  })
  it('VSS und bfu: Fundstelle mit gedruckter Seite; Gesetze mit Artikel', () => {
    for (const r of REGELN.filter(x => MIT_SEITE.includes(x.werk) && x.werk !== '40213')) expect(r.fundstelle, r.id).toMatch(/S\. \d/)
    for (const r of REGELN.filter(x => ['SSV', 'SVG', 'VRV'].includes(x.werk))) expect(r.fundstelle, r.id).toMatch(/^Art\. \d/)
    // Seiten der VSS 40 273 nach dem Seitenplan (Stichproben)
    const f = (id: string) => REGELN.find(r => r.id === id)!.fundstelle
    expect([f('V273-12a'), f('V273-13.1a'), f('V273-13.3a'), f('V273-16d'), f('V273-17')]).toEqual(['Ziffer 12, S. 7–8',
      'Ziffer 13.1 und Tab. 1, S. 8', 'Ziffer 13.3 und Tab. 3, S. 9', 'Ziffer 16, S. 10; Abb. 5, S. 11', 'Ziffer 17, S. 11; Abb. 6, S. 12'])
  })
  it('Zählung je Werk = Quellentabelle = Gruppen nach Quelle; jedes Werk mit mindestens einer Regel', () => {
    const n = regelnJeWerk()
    for (const w of WERK_IDS) {
      expect(n.get(w), w).toBe(REGELN.filter(r => r.werk === w).length)
      expect(n.get(w), w).toBeGreaterThan(0)
      expect(WERKE[w].ausgabe.trim(), w).not.toBe('')
    }
    const g = regelGruppen('quelle')
    expect(g.map(x => x.schluessel)).toEqual(WERK_IDS.map(w => `werk-${w}`))
    for (const x of g) expect(x.regeln.length).toBe(n.get(x.schluessel.slice(5) as typeof WERK_IDS[number]))
    expect(regelGruppen('thema').reduce((s, x) => s + x.regeln.length, 0)).toBe(REGELN.length)
  })
  it('Normreihenfolge: VSS 40 273 Ziffer für Ziffer, Normen vor bfu, Werke nach Herkunft, Annahmen und Entscheide am Schluss', () => {
    const o = regelnVonWerk('40273').map(r => r.ordnung)
    expect(o).toEqual([...o].sort((a, b) => a - b))
    expect(WERK_IDS.slice(0, 6)).toEqual(['40273', '40090', '40242', '40213', '40040', 'BFU'])
    expect(WERK_IDS.slice(-2)).toEqual(['ANNAHME', 'ENTSCHEID'])
    const rang = WERK_IDS.map(w => HERKUNFT.indexOf(WERKE[w].herkunft))
    expect(rang).toEqual([...rang].sort((a, b) => a - b))
  })
  it('Ausgaben wie vorgegeben; Normen kostenpflichtig', () => {
    expect(WERK_IDS.map(w => WERKE[w].ausgabe)).toEqual(['VSS 40 273:2024', 'VSS 40 090b:2019-03', 'VSS 40 242:2019', 'VSS 40 213:2019',
      'VSS 40 040b:2019-03', 'bfu 2.443.01-2022/BM.021', 'SR 741.21, geltende Fassung', 'SR 741.01, geltende Fassung', 'SR 741.11, geltende Fassung', 'Ausgabe Dezember 2024', '1.2.2024',
      '653.105, 11/2018', '1.1.2023', '2026-10', '2026-10'])
    for (const w of ['40273', '40090', '40242', '40213', '40040'] as const) expect(WERKE[w].bezug).toBe('kostenpflichtig')
  })
})
