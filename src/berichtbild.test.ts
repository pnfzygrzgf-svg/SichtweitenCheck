// Tests Bericht (E4a): Ausschnitt und Massstab des Kartenbilds aus den Geometrien, LV95 -> SVG, Textbausteine je Status.
// Handlösungen in den Kommentaren (Koordinaten relativ zu O = 2 600 000 / 1 200 000).

import { describe, expect, it } from 'vitest'
import type { P } from './geo'
import type { Ergebnis, RichtungErgebnis, KnotenInfo, ArmInfo } from './rechner/typen'
import { ausschnitt, bildPixel, svgAbbildung, massstab, berichtPunkte, imAusschnitt, schilder, type Box } from './berichtbild'
import { autoText, gesamtText, statusMarke } from './texte'

const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const boxNah = (b: Box, soll: [number, number, number, number]) => b.forEach((v, i) => expect(v - (i % 2 ? O[1] : O[0])).toBeCloseTo(soll[i], 6))
const drin = (b: Box, p: P) => p[0] >= b[0] && p[0] <= b[2] && p[1] >= b[1] && p[1] <= b[3]

describe('Kartenbild: Ausschnitt aus den Punkten', () => {
  it('flach: Rand 5 m, dann auf Höhe/Breite 0,55 geweitet', () => {
    // E −5 … 105 (110 m), N −5 … 25 (30 m); 30/110 < 0,55 -> Höhe 60,5 m um die Mitte N 10: −20,25 … 40,25
    boxNah(ausschnitt([lv(0, 0), lv(100, 20)]), [-5, -20.25, 105, 40.25])
  })
  it('hoch: erst auf 40 m Breite, dann auf Höhe/Breite 0,7 geweitet', () => {
    // E −5 … 15 (20 m) -> 40 m um 5: −15 … 25; N −5 … 105 (110 m); 110/40 > 0,7 -> Breite 110/0,7 = 157,142857 m um 5: −73,571429 … 83,571429
    boxNah(ausschnitt([lv(0, 0), lv(10, 100)]), [5 - 55 / 0.7, -5, 5 + 55 / 0.7, 105])
  })
  it('ein Punkt: Mindestgrösse 40 × 22 m', () => {
    // E −5 … 5 -> 40 m: −20 … 20; N −5 … 5 (10 m) -> 40 × 0,55 = 22 m: −11 … 11; 22/40 = 0,55
    boxNah(ausschnitt([lv(0, 0)]), [-20, -11, 20, 11])
  })
  it('ohne Punkte: Fehler', () => { expect(() => ausschnitt([])).toThrow() })
})

describe('Kartenbild: Geometrien eines Ergebnisses', () => {
  // Zufahrt von Süden (FB fährt nach Norden), D bei O; nach rechts Achse ab K (2/5) nach Osten, A 50 m; ein Gebäude im Sichtdreieck;
  // nach links kein Verkehr (Dreieck weit weg: darf den Ausschnitt nicht weiten)
  const sp = Array.from({ length: 61 }, (_, i) => lv(2 + i, 5))
  const gebaeude = [lv(30, 10), lv(35, 10), lv(35, 15), lv(30, 15)]
  const rechts = { richtung: 'rechts', status: 'erfuellt', dreieck: [lv(0, 0), lv(2, 5), lv(52, 5)], K: lv(2, 5), massgebend: 50,
    sichtpunkte: sp, verdeckerListe: [{ ring: gebaeude }], velo: null } as unknown as RichtungErgebnis
  const links = { richtung: 'links', status: 'keine_zufahrt', dreieck: [lv(-500, 0)], K: lv(-500, 0), massgebend: 50, sichtpunkte: [],
    verdeckerListe: [], velo: null } as unknown as RichtungErgebnis
  const e = { D: lv(0, 0), Dachse: lv(0.5, 0), fbRichtung: [0, 1], richtungen: [links, rechts], trottoirPruefung: null, haltelinie: null,
    zufahrtspunkt: null, rechtsvortritt: null } as unknown as Ergebnis
  it('alle Dreiecke, Verdecker und Fahrzeuge im Bild (Handlösung)', () => {
    const pkt = berichtPunkte(e)
    const b = ausschnitt(pkt)
    for (const p of [...rechts.dreieck, ...gebaeude, e.D]) expect(drin(b, p)).toBe(true)
    for (const p of pkt) expect(drin(b, p)).toBe(true)
    expect(pkt.some(p => p[0] < O[0] - 100)).toBe(false)          // Richtung ohne Verkehr zählt nicht
    // FB: Mitte 0,25 m hinter Dachse (Lenker 2,0 m hinter der Front, halbe Länge 2,25 m): E −0,4 … 1,4, N −2,5 … 2,0
    // FA: Front bei A (52/5), Fahrt nach Westen, Mitte 54,25: E 52 … 56,5. Rohe Hülle E −0,4 … 56,5, N −2,5 … 15 (Gebäude)
    // Rand 5: E −5,4 … 61,5 (66,9 m), N −7,5 … 20 (27,5 m); 27,5/66,9 < 0,55 -> Höhe 36,795 um 6,25: −12,1475 … 24,6475
    boxNah(b, [-5.4, -12.1475, 61.5, 24.6475])
  })
  it('Velo, Trottoir, Haltelinie, Zufahrtspunkt und Punkte der Abb. 5 kommen dazu', () => {
    const velo = { dreieckFrei: [lv(0, 0), lv(1, 4), lv(31, 4)], dreieckVerdeckt: [], A: 30, sichtpunkte: Array.from({ length: 41 }, (_, i) => lv(1 + i, 4)),
      verdeckerListe: [{ ring: [lv(20, -30), lv(21, -30), lv(21, -29)] }] }
    const r2 = { ...rechts, velo } as unknown as RichtungErgebnis
    const e2 = { ...e, richtungen: [r2], haltelinie: { quer: [lv(-1.5, 2), lv(1.5, 2)] }, zufahrtspunkt: { eingabe: lv(0, 3) },
      trottoirPruefung: { D: lv(0, -4), richtungen: [{ dreieckFrei: [lv(0, -4), lv(0, 1), lv(-18, 1)], dreieckVerdeckt: [], verdeckerListe: [] }] },
      rechtsvortritt: { arm: { paare: { punkte1: [lv(0, -12)], punkte2: [lv(-14, 5)] } } } } as unknown as Ergebnis
    const pkt = berichtPunkte(e2)
    for (const p of [lv(-18, 1), lv(0, -4), lv(20, -30), lv(-1.5, 2), lv(0, 3), lv(0, -12), lv(-14, 5)])
      expect(pkt.some(q => q[0] === p[0] && q[1] === p[1])).toBe(true)
    // Velo am Ende von A (Vorderrad bei 31/4, Fahrt nach Westen): reicht bis E 32,8
    expect(Math.max(...pkt.filter(q => Math.abs(q[1] - O[1] - 4) < 0.35 && q[0] - O[0] < 40).map(q => q[0] - O[0]))).toBeCloseTo(32.8, 6)
    const b = ausschnitt(pkt)
    for (const p of pkt) expect(drin(b, p)).toBe(true)
  })
})

describe('Kartenbild: Nummernschilder der Arme', () => {
  // Knoten bei (0/10); Arme nach Norden (1, Zufahrt) und Osten (2) bzw. eine Grundstückzufahrt Z nach Süden
  const arm = (key: string, nr: string, richtung: P) => ({ key, nr, richtung }) as ArmInfo
  const e = { D: lv(0, 0), Dachse: lv(0.5, 0), fbRichtung: [0, 1], richtungen: [], trottoirPruefung: null, haltelinie: null,
    zufahrtspunkt: null, rechtsvortritt: null, zufahrt: 'n' } as unknown as Ergebnis
  it('12 m vom Knoten auf der Armachse, gewählt = Zufahrt; im Ausschnitt', () => {
    const kn = { p: lv(0, 10), arme: [arm('n', '1', [0, 1]), arm('o', '2', [1, 0])] } as unknown as KnotenInfo
    expect(schilder(kn, e).map(x => [x.a.nr, x.p[0] - O[0], x.p[1] - O[1], x.gewaehlt])).toEqual([['1', 0, 22, true], ['2', 12, 10, false]])
    const pkt = berichtPunkte(e, kn)
    expect(pkt.some(q => q[0] === O[0] + 12 && q[1] === O[1] + 10)).toBe(true)
  })
  it('Grundstückzufahrt «Z» am Zufahrtspunkt', () => {
    const kn = { p: lv(0, 10), grundstueck: true, arme: [arm('grundstueck', 'Z', [0, -1])] } as unknown as KnotenInfo
    const eg = { ...e, zufahrt: 'grundstueck', zufahrtspunkt: { eingabe: lv(0.4, 7) } } as unknown as Ergebnis
    const [z] = schilder(kn, eg)
    expect([z.a.nr, z.gewaehlt, z.p]).toEqual(['Z', true, eg.zufahrtspunkt!.eingabe])
  })
})

describe('Kartenbild: Bildgrösse, LV95 -> SVG, Massstab', () => {
  const b: Box = [O[0] - 5, O[1] - 20.25, O[0] + 105, O[1] + 40.25]
  it('Bild: 110 m bei 0,1 m/px wären 1100 px -> 1200 px (Minimum), 0,0917 m/px, Höhe 60,5 m -> 660 px', () => {
    const p = bildPixel(b)
    expect(p.breite).toBe(1200)
    expect(p.mpx).toBeCloseTo(110 / 1200, 9)
    expect(p.hoehe).toBe(660)
    // 200 m breit: 2000 px -> 1400 (Maximum); 110 m hoch -> 110 / (200/1400) = 770 px
    expect(bildPixel([0, 0, 200, 110])).toEqual({ breite: 1400, hoehe: 770, mpx: 200 / 1400 })
  })
  it('Verschiebung und Skalierung: s = 1000/110, Ecken auf 0/0 und 1000/550, N nach unten', () => {
    const { s, vh, xy } = svgAbbildung(b)
    expect(s).toBeCloseTo(9.090909, 5)
    expect(vh).toBeCloseTo(550, 9)
    const nah = (p: [number, number], soll: [number, number]) => { expect(p[0]).toBeCloseTo(soll[0], 6); expect(p[1]).toBeCloseTo(soll[1], 6) }
    nah(xy([b[0], b[3]]), [0, 0])                                   // oben links
    nah(xy([b[2], b[1]]), [1000, 550])                              // unten rechts
    // O: x = 5 × 1000/110 = 45,4545; y = (40,25 − 0) × 1000/110 = 365,9091
    nah(xy(O), [45.454545, 365.909091])
    // 11 m nach Norden: 100 Einheiten nach oben
    expect(xy(lv(0, 11))[1]).toBeCloseTo(xy(O)[1] - 100, 9)
  })
  it('Massstab: runde Länge nahe einem Fünftel der Breite', () => {
    expect(massstab(110)).toBe(20)                 // 22 -> 20
    expect(massstab(66.9)).toBe(10)                // 13,4 -> 10 (näher als 20)
    expect(massstab(300)).toBe(50)                 // 60 -> 50
    expect(massstab(40)).toBe(10)                  // 8 -> 10
  })
  it('Ring im Ausschnitt: Rechteck schneidet', () => {
    expect(imAusschnitt([lv(100, 30), lv(200, 30), lv(200, 90)], b)).toBe(true)     // ragt hinein
    expect(imAusschnitt([lv(106, 0), lv(120, 5), lv(110, 9)], b)).toBe(false)      // ganz östlich
  })
})

describe('Textbausteine je Status (Bericht, schwarz-weiss lesbar)', () => {
  const r = (x: Partial<RichtungErgebnis>) => ({ status: 'erfuellt', gesamt: 'erfuellt', gesamtFehlt: [], statusZusatz: [], ...x }) as RichtungErgebnis
  it('Zeichen', () => {
    expect(['erfuellt', 'massgebend', 'nicht_erfuellt', 'keine_zufahrt', 'bedingt', 'keine'].map(s => statusMarke(s)))
      .toEqual(['✓', '✓', '✗', '–', '(✓)', '–'])
    expect(statusMarke('massgebend', true)).toBe('(✓)')             // Rechtsvortritt: zulässig = bedingt
  })
  it('Motorfahrzeuge und Gesamt nach Tab. 1', () => {
    expect(autoText(r({}))).toBe('erfüllt (≥ oberer Wert)')
    expect(autoText(r({ status: 'massgebend' }))).toBe('massgebender Wert erfüllt')
    expect(autoText(r({ status: 'nicht_erfuellt' }))).toBe('nicht erfüllt')
    expect(autoText(r({ status: 'keine_zufahrt' }))).toBe('kein Verkehr von dieser Seite')
    expect(autoText(r({ status: 'keine_zufahrt', keinGrund: 'Rechtsvortritt: von links keine Prüfung' }))).toBe('Rechtsvortritt: von links keine Prüfung')
    expect(gesamtText(r({ status: 'erfuellt', gesamt: 'nicht_erfuellt', gesamtFehlt: ['Velo', 'Trottoir'] }))).toBe('nicht erfüllt: Velo, Trottoir')
    expect(gesamtText(r({ status: 'keine_zufahrt', gesamt: 'erfuellt' }))).toBe('erfüllt (ohne Motorfahrzeuge)')
    expect(gesamtText(r({ status: 'massgebend', gesamt: 'massgebend' }))).toBe('massgebender Wert erfüllt')
  })
  it('Rechtsvortritt nach Abb. 6 und Abb. 5', () => {
    expect(autoText(r({ rv: true }))).toBe('erfüllt (anzustrebender Zustand)')
    expect(autoText(r({ rv: true, status: 'massgebend' }))).toBe('bedingt (zulässig als Ausnahme, Abb. 6)')
    expect(autoText(r({ rv: true, status: 'nicht_erfuellt' }))).toBe('nicht erfüllt (zu sanieren)')
    expect(autoText(r({ rv: true, status: 'nicht_erfuellt', statusZusatz: ['Sichtfeld nach Abb. 5 nicht frei'] })))
      .toBe('nicht erfüllt (Sichtfeld nach Abb. 5)')
  })
})
