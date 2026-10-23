// Tests K0: Trottoirüberfahrt (VSS 40 242 Ziffern 12.3, 14.4, 16) am T-Knoten aus rechnen.test.ts. Handlösungen im Kommentar.
//
// Lage (Meter, x Ost, y Nord, Ursprung = OSM-Knoten 12): Hauptstrasse West–Ost, Fahrbahn y = −3 … +3, Tempo 30; Zufahrt von Süden,
// Achse des Zufahrtsstreifens x = +1,25, Bordkante (Fahrbahnrand) y = −3. Phase Fahrbahn: B 3,00 m ab der Bordkante -> D (0,75; −6).
// Phase Trottoir: D' = 3,00 m hinter dem hinteren Rand (Fahrersitz 0,50 m links), Gehlinie 0,50 m vor dem hinteren Trottoirrand.

import { describe, expect, it } from 'vitest'
import { wgs, type P } from '../geo'
import type { OsmDaten, OsmWeg } from '../daten/osm'
import type { AvFlaeche } from '../daten/av'
import type { Hindernis } from './hindernisse'
import { rechneKnoten } from './rechnen'
import { tueBand, TUE_GEHLINIE_M, TUE_BREITE_ANNAHME_M } from './trottoirueberfahrt'
import { KEINE_ALLE_EINGABEN, type Eingaben, type Ergebnis, type KnotenFall } from './typen'
import { ergebnisAuszug } from '../fall'

const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const ll = (x: number, y: number): [number, number] => wgs(O[0] + x, O[1] + y)
const weg = (id: number, knoten: [number, number, number][], tags: Record<string, string>): OsmWeg =>
  ({ id, tags, knoten: knoten.map(k => k[0]), geom: knoten.map(k => ll(k[1], k[2])) })
const osm = (haupt: Record<string, string> = {}, extra: Partial<OsmDaten> = {}): OsmDaten => ({
  wege: [
    weg(1, [[10, -200, 0], [12, 0, 0], [13, 200, 0]], { highway: 'unclassified', name: 'Hauptstrasse', maxspeed: '30', ...haupt }),
    weg(2, [[12, 0, 0], [20, 0, -200]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' }),
  ],
  tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [], ...extra,
})
const flaeche = (art: string, ring: P[]): AvFlaeche => ({ art, kanton: 'BE', qualitaet: 'AV93', bfs: 351, ringe: [ring] })
// Einmündung in der AV durchgehend Strasse (Planungsfall)
const fahrbahn = flaeche('Strasse_Weg', [lv(-200, -3), lv(-2.5, -3), lv(-2.5, -200), lv(2.5, -200), lv(2.5, -3), lv(200, -3),
  lv(200, 3), lv(-200, 3), lv(-200, -3)])
// Trottoir quer über die Zufahrt (y −5 … −3 durchgehend), Fahrbahn der Nebenstrasse erst ab y −5 (wie velo.test.ts)
const fbT = flaeche('Strasse_Weg', [lv(-200, -3), lv(200, -3), lv(200, 3), lv(-200, 3)])
const neben = flaeche('Strasse_Weg', [lv(-2.5, -5), lv(2.5, -5), lv(2.5, -200), lv(-2.5, -200)])
const trottoirQuer = flaeche('Trottoir', [lv(-200, -5), lv(200, -5), lv(200, -3), lv(-200, -3)])
// angrenzendes Trottoir 2,50 m (y −5,5 … −3) links und rechts der Zufahrt, an der Einmündung unterbrochen
const trottoirL = flaeche('Trottoir', [lv(-200, -5.5), lv(-2.5, -5.5), lv(-2.5, -3), lv(-200, -3)])
const trottoirR = flaeche('Trottoir', [lv(2.5, -5.5), lv(200, -5.5), lv(200, -3), lv(2.5, -3)])
const ecke = flaeche('Gebaeude', [lv(-10, -4), lv(-30, -4), lv(-30, -24), lv(-10, -24), lv(-10, -4)])

const TUE = { trottoirueberfahrt: { breite: null } }
const eg = (x: Partial<Eingaben>): Eingaben => ({ ...KEINE_ALLE_EINGABEN, ...x })
const rechne = (o: OsmDaten, av: AvFlaeche[], f: Partial<KnotenFall> = {}): Ergebnis => {
  const r = rechneKnoten(o, av, { knoten: 12, zufahrt: null, ...f })
  expect(r.meldungen).toEqual([])
  return r.ergebnis!
}
const rel = (p: P): [number, number] => [p[0] - O[0], p[1] - O[1]]
const nahe = (p: P, x: number, y: number, tol = 0.05) => {
  const [a, b] = rel(p)
  expect(Math.abs(a - x), `x ${a} statt ${x}`).toBeLessThan(tol)
  expect(Math.abs(b - y), `y ${b} statt ${y}`).toBeLessThan(tol)
}
const seite = (e: Ergebnis, r: 'links' | 'rechts') => e.richtungen.find(x => x.richtung === r)!

describe('K0: Trottoirüberfahrt mit AV-Trottoir quer über die Zufahrt', () => {
  // Breite 2,00 m entlang der Achse (Suchschritt 0,05 m wie E2b: hinterer Rand y −5,025). Hinterer Trottoirrand neben den Armen
  // y −5 (AV, auf 1 mm) -> Gehlinie y −4,5. D' = (0,75; −8,025).
  const e = rechne(osm(), [fbT, neben, trottoirQuer], { eingaben: eg(TUE) })
  it('Breite aus der AV quer, vorderer Rand an der Bordkante, hinterer Rand y −5', () => {
    const t = e.trottoirueberfahrt!
    expect(t.breiteQuelle).toBe('av_quer')
    expect(t.breite).toBeCloseTo(2, 1)
    nahe(t.vorderkante, 1.25, -3)
    nahe(t.hinterkante, 1.25, -5, 0.06)
    expect(t.gehlinie).toBe(TUE_GEHLINIE_M)
    expect(e.annahmen.join(' | ')).toContain('aus der AV-Fläche Trottoir quer über die Zufahrt')
  })
  it('Phase Fahrbahn: Bordkante als Nullpunkt (ohne Häkchen «ohne Hindernisse»): D (0,75; −6) statt (0,75; −8)', () => {
    expect(e.nullpunktText).toBe('Bordkante (vorderer Rand der Trottoirüberfahrt)')
    nahe(e.nullpunkt, 1.25, -3)
    nahe(e.D, 0.75, -6)
    // ohne Modus wartet F_B vor dem Trottoir (unverändert)
    const ohne = rechne(osm(), [fbT, neben, trottoirQuer])
    expect(ohne.nullpunktText).toBe('Trottoirhinterkante')
    nahe(ohne.D, 0.75, -8, 0.06)
    expect(ohne.trottoirueberfahrt).toBeUndefined()
  })
  it('Phase Trottoir: D\' 3 m hinter dem hinteren Rand, Zielpunkte auf der Gehlinie y −4,5 (ohne Modus: Trottoirachse y −4)', () => {
    const tp = e.trottoirPruefung!
    expect(tp.gehlinie).toBe(true)
    nahe(tp.D, 0.75, -8.025, 0.06)
    const [l, r] = tp.richtungen
    nahe(l.K, 1.25, -4.5, 0.06); nahe(r.K, 1.25, -4.5, 0.06)
    nahe(l.sichtpunkte[10], 1.25 - 10, -4.5, 0.06); nahe(r.sichtpunkte[10], 1.25 + 10, -4.5, 0.06)
    expect([l.A, l.status, r.A, r.status]).toEqual([15, 'erfuellt', 15, 'erfuellt'])
    expect(tp.achseQuelle).toContain('0,50 m vor dem hinteren Trottoirrand')
    const ohne = rechne(osm(), [fbT, neben, trottoirQuer]).trottoirPruefung!
    expect(ohne.gehlinie).toBeUndefined()
    nahe(ohne.richtungen[0].K, 1.25, -4, 0.06)
    expect(e.trottoirueberfahrt!.phaseTrottoir).toEqual({ status: 'erfuellt', fehlt: [] })
  })
  it('Hecke 1 m hinter dem hinteren Rand: Gehlinie strenger als die Achse (Strahlensatz 4,67 m statt 5,26 m)', () => {
    // Hecke y −6 von x −30 bis −2, Puffer 0,30 m: Ecke (−2; −5,7). D' (0,75; −8,025), Richtung zur Ecke (−2,75; 2,325); bis zur
    // Gehlinie y −4,5 (dy 3,525): x = 0,75 − 2,75 · 3,525 / 2,325 = −3,419, s = 1,25 + 3,419 = 4,669 m < 15 m: nicht erfüllt
    const hecke: Hindernis = { id: 'h1', art: 'hecke', linie: [lv(-30, -6), lv(-2, -6)], sichtbehindernd: true, quelle: 'hand', name: 'Hecke' }
    const hg = { hindernisse: [hecke], verworfen: [], park: null, baeume: null }
    const m = rechne(osm(), [fbT, neben, trottoirQuer], { eingaben: eg(TUE), hindernisse: hg })
    const [l, r] = m.trottoirPruefung!.richtungen
    expect(l.vorhanden).toBeCloseTo(0.5 + 2.75 * 3.525 / 2.325, 1)
    expect([l.status, r.status]).toEqual(['nicht_erfuellt', 'erfuellt'])
    expect(m.trottoirueberfahrt!.phaseTrottoir).toEqual({ status: 'nicht_erfuellt', fehlt: ['von links: Trottoir'] })
    expect(m.trottoirueberfahrt!.phaseFahrbahn.fehlt).toEqual([])
    expect(seite(m, 'links').gesamtFehlt).toContain('Trottoir')
    const ohne = rechne(osm(), [fbT, neben, trottoirQuer], { hindernisse: hg }).trottoirPruefung!.richtungen[0]
    expect(ohne.vorhanden).toBeCloseTo(0.5 + 2.75 * 4.025 / 2.325, 1)
  })
})

describe('K0: Zufahrt in der AV durchgehend Strasse, angrenzendes Trottoir links und rechts (Planungsfall)', () => {
  // Trottoir 2,50 m beidseits (y −5,5 … −3), an der Einmündung Strasse. Hinterer Rand y −5,5, Schnitt mit der Achse (1,25; −5,5);
  // Gehlinie y −5,0; D' (0,75; −8,5)
  const e = rechne(osm(), [fahrbahn, trottoirL, trottoirR], { eingaben: eg(TUE) })
  it('Breite 2,50 m wie das angrenzende Trottoir; hinterer Rand y −5,5', () => {
    expect(e.trottoir).toBeNull()                      // kein Trottoir quer über die Zufahrt nach AV
    const t = e.trottoirueberfahrt!
    expect([t.breiteQuelle, t.breite]).toEqual(['av_neben', expect.closeTo(2.5, 2)])
    expect(t.laenge).toBeCloseTo(2.5, 1)
    nahe(t.hinterkante, 1.25, -5.5, 0.06)
    expect(t.breiteText).toContain('wie das angrenzende Trottoir nach AV (links und rechts, Mittel)')
  })
  it('Phase Trottoir mit Gehlinie y −5,0 und D\' (0,75; −8,5); Phase Fahrbahn ab der Bordkante D (0,75; −6)', () => {
    const tp = e.trottoirPruefung!
    nahe(tp.D, 0.75, -8.5, 0.06)
    nahe(tp.richtungen[0].K, 1.25, -5, 0.06); nahe(tp.richtungen[1].K, 1.25, -5, 0.06)
    nahe(e.D, 0.75, -6)
    // ohne Modus: keine Trottoirprüfung (die AV zeigt kein Trottoir quer über die Zufahrt), Ergebnis wie bisher
    expect(rechne(osm(), [fahrbahn, trottoirL, trottoirR]).trottoirPruefung).toBeNull()
  })
  it('Breite von Hand ohne Wirkung, wenn die AV die Breite liefert (Hinweis)', () => {
    const m = rechne(osm(), [fahrbahn, trottoirL, trottoirR], { eingaben: eg({ trottoirueberfahrt: { breite: 3.5 } }) })
    expect(m.trottoirueberfahrt!.breiteQuelle).toBe('av_neben')
    expect(m.hinweise.join(' | ')).toContain('Breite der Trottoirüberfahrt von Hand 3,50 m ohne Wirkung')
  })
  it('nur rechts ein Trottoir: links Fahrbahnrand plus Breite (y −5,5)', () => {
    const m = rechne(osm(), [fahrbahn, trottoirR], { eingaben: eg(TUE) })
    expect(m.trottoirueberfahrt!.breiteText).toContain('(rechts)')
    nahe(m.trottoirPruefung!.richtungen[0].K, 1.25, -5, 0.06)
    expect(m.trottoirPruefung!.achseQuelle).toContain('Fahrbahnrand plus Breite der Überfahrt 2,50 m')
  })
})

describe('K0: ohne Trottoir in der AV', () => {
  it('Annahme 2,00 m (gekennzeichnet): hinterer Rand y −5, Gehlinie y −4,5, D\' (0,75; −8)', () => {
    const e = rechne(osm(), [fahrbahn], { eingaben: eg(TUE) })
    const t = e.trottoirueberfahrt!
    expect([t.breiteQuelle, t.breite]).toEqual(['annahme', TUE_BREITE_ANNAHME_M])
    nahe(t.hinterkante, 1.25, -5, 0.06)
    nahe(e.trottoirPruefung!.D, 0.75, -8, 0.06)
    nahe(e.trottoirPruefung!.richtungen[0].K, 1.25, -4.5, 0.06)
    expect(e.annahmen.join(' | ')).toContain('Breite 2,00 m angenommen')
    // Auszug der Fall-Datei: Trottoirüberfahrt je Phase; ohne Modus fehlt das Feld
    expect(ergebnisAuszug(e, 'Vortritt').trottoirueberfahrt).toEqual({ breite: 2, breiteQuelle: 'annahme', laenge: 2, phaseTrottoir: 'erfuellt',
      phaseFahrbahn: 'erfuellt' })
    expect('trottoirueberfahrt' in ergebnisAuszug(rechne(osm(), [fahrbahn]), 'Vortritt')).toBe(false)
  })
  it('Breite von Hand 3,00 m: hinterer Rand y −6, Gehlinie y −5,5, D\' (0,75; −9)', () => {
    const e = rechne(osm(), [fahrbahn], { eingaben: eg({ trottoirueberfahrt: { breite: 3 } }) })
    expect([e.trottoirueberfahrt!.breiteQuelle, e.trottoirueberfahrt!.breite]).toEqual(['eingabe', 3])
    nahe(e.trottoirPruefung!.D, 0.75, -9, 0.06)
    nahe(e.trottoirPruefung!.richtungen[1].K, 1.25, -5.5, 0.06)
  })
  it('Gebäudeecke im Trottoirband: Phase Fahrbahn wie velo.test (Velo links 19,31 m < 25 m), Phase Trottoir links 11,25 m < 15 m', () => {
    // Phase Fahrbahn: D (0,75; −6), Velo nach links nicht erfüllt (Strahlensatz in velo.test.ts). Phase Trottoir: Gehlinie y −4,5 läuft
    // ab x −10 durch das Gebäude (x ≤ −10, y ≤ −4): sichtbar bis s = 1,25 + 10 = 11,25 m
    const e = rechne(osm(), [fahrbahn, ecke], { eingaben: eg(TUE) })
    expect(seite(e, 'links').velo!.vorhanden).toBeCloseTo(19.3125, 1)
    expect(e.trottoirPruefung!.richtungen[0].vorhanden).toBeCloseTo(11.25, 1)
    expect(e.trottoirueberfahrt!.phaseFahrbahn).toEqual({ status: 'nicht_erfuellt', fehlt: ['von links: Velo'] })
    expect(e.trottoirueberfahrt!.phaseTrottoir).toEqual({ status: 'nicht_erfuellt', fehlt: ['von links: Trottoir'] })
  })
})

describe('K0: Vortritt fest (VSS 40 242 Ziffer 12.3)', () => {
  // Quartierstrasse Tempo 30 ohne Signal: ohne Modus Rechtsvortritt (Entscheid 17.10.2026), mit Modus Vortritt, B 3,00 m statt 5,00 m
  const quartier = osm({ highway: 'residential', maxspeed: '30' })
  it('Vorgabe ohne Signal: Vortritt statt Rechtsvortritt', () => {
    expect(rechne(quartier, [fahrbahn]).regelungVorgabe).toBe('rechtsvortritt')
    const e = rechne(quartier, [fahrbahn], { eingaben: eg(TUE) })
    expect([e.regelung, e.regelungVorgabe, e.B, e.rechtsvortritt]).toEqual(['vortritt', 'vortritt', 3, null])
    expect(e.regelungQuelle).toContain('an einer Trottoirüberfahrt gilt kein Rechtsvortritt')
    expect(e.trottoirueberfahrt!.regelungText).toContain('kein Rechtsvortritt')
    expect(seite(e, 'links').status).not.toBe('keine_zufahrt')
  })
  it('«Rechtsvortritt» von Hand: gerechnet wie Vortritt, Hinweis', () => {
    const e = rechne(quartier, [fahrbahn], { eingaben: eg({ ...TUE, regelung: 'rechtsvortritt' }) })
    expect([e.regelung, e.B, e.rechtsvortritt]).toEqual(['vortritt', 3, null])
    expect(e.hinweise.join(' | ')).toContain('Rechtsvortritt an einer Trottoirüberfahrt: gilt nicht')
  })
  it('Stop aus OSM bleibt Stop', () => {
    const stop = osm({}, { vortritt: [{ id: 99, tags: { highway: 'stop' }, lat: ll(0, -4)[0], lon: ll(0, -4)[1] }] })
    expect(rechne(stop, [fahrbahn], { eingaben: eg(TUE) }).regelung).toBe('stop')
  })
  it('Haltelinie geht der Bordkante vor', () => {
    const e = rechne(osm(), [fbT, neben, trottoirQuer], { eingaben: eg({ ...TUE, haltelinie: lv(1.25, -6) }) })
    expect(e.nullpunktText).toBe('Vorderkante der Haltelinie')
    nahe(e.D, 0.75, -9, 0.06)
    expect(e.trottoirueberfahrt).toBeDefined()
  })
})

describe('K0: Regression ohne Modus', () => {
  it('trottoirueberfahrt null bzw. fehlend: Ergebnis gleich (ohne Rechenzeit)', () => {
    for (const av of [[fahrbahn], [fbT, neben, trottoirQuer], [fahrbahn, ecke]]) {
      const a = rechneKnoten(osm(), av, { knoten: 12, zufahrt: null })
      const b = rechneKnoten(osm(), av, { knoten: 12, zufahrt: null, eingaben: eg({ trottoirueberfahrt: null }) })
      const c = rechneKnoten(osm(), av, { knoten: 12, zufahrt: null, eingaben: eg({}), tempoAmtlich: null })
      for (const r of [a, b, c]) r.ms = 0
      expect(JSON.stringify(b)).toBe(JSON.stringify(a))
      expect(JSON.stringify(c)).toBe(JSON.stringify(a))
      expect(a.ergebnis!.trottoirueberfahrt).toBeUndefined()
    }
  })
  it('Grundstückzufahrt mit Modus: Bordkante als Nullpunkt, Gehlinie; ohne Modus wie bisher', () => {
    const zp = { p: lv(10, -3), richtung: null }
    const ohne = rechne(osm(), [fbT, trottoirQuer], { knoten: null, zufahrtspunkt: zp })
    expect(ohne.nullpunktText).toBe('Trottoirhinterkante')
    expect(ohne.trottoirPruefung!.gehlinie).toBeUndefined()
    const mit = rechne(osm(), [fbT, trottoirQuer], { knoten: null, zufahrtspunkt: zp, eingaben: eg(TUE) })
    expect(mit.nullpunktText).toBe('Bordkante (vorderer Rand der Trottoirüberfahrt)')
    expect(mit.trottoirPruefung!.gehlinie).toBe(true)
  })
})

describe('K0: tueBand (Geometrie)', () => {
  // gerade Zufahrtsachse nach Süden ab (1,25; 30) über den Knoten; Arme West und Ost auf y = 0; Fahrbahnrand 3 m
  const zAchse: P[] = [lv(1.25, 30), lv(1.25, -100)]
  const sRand = 33                                     // Bogenlänge bis y −3
  const west: P[] = [lv(0, 0), lv(-100, 0)], ost: P[] = [lv(0, 0), lv(100, 0)]
  it('Reihenfolge der Breite: AV quer, AV neben (Mittel), Eingabe, Annahme', () => {
    const t = (b: number) => ({ abstand: 3 + b / 2, breite: b, n: 10 })
    const s0 = { ml: west, seite: -1 as const, rand: 3, t: null }, s1 = { ml: ost, seite: 1 as const, rand: 3, t: null }
    expect(tueBand(zAchse, sRand, lv(0, 0), [s0, s1], { sHinter: 35.4, breite: 2.4 }, 3).quelle).toBe('av_quer')
    const n = tueBand(zAchse, sRand, lv(0, 0), [{ ...s0, t: t(2) }, { ...s1, t: t(3) }], null, 4)
    expect([n.quelle, n.breite, n.hinten, n.gehlinie]).toEqual(['av_neben', 2.5, [5, 6], [4.5, 5.5]])
    expect(n.hinweise[0]).toContain('ohne Wirkung')
    expect(tueBand(zAchse, sRand, lv(0, 0), [s0, s1], null, 3).quelle).toBe('eingabe')
    const a = tueBand(zAchse, sRand, lv(0, 0), [s0, s1], null, null)
    expect([a.quelle, a.breite, a.hinten, a.gehlinie]).toEqual(['annahme', 2, [5, 5], [4.5, 4.5]])
    expect(a.sHinter).toBeCloseTo(35, 3)
  })
  it('schmales Trottoir unter 1,00 m: Gehlinie höchstens in der Mitte; unter 2,00 m Hinweis Ziffer 16', () => {
    const n = tueBand(zAchse, sRand, lv(0, 0), [{ ml: west, seite: -1, rand: 3, t: { abstand: 3.4, breite: 0.8, n: 5 } },
      { ml: ost, seite: 1, rand: 3, t: null }], null, null)
    expect(n.gehlinie[0]).toBeCloseTo(3.4, 6)
    expect(n.hinweise.join(' ')).toContain('Ziffer 16')
  })
})
