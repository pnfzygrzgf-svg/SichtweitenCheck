// Tests K0: Trottoirüberfahrt (VSS 40 242 Ziffern 12.3, 14.4, 16) am T-Knoten aus rechnen.test.ts. Handlösungen im Kommentar.
//
// Lage (Meter, x Ost, y Nord, Ursprung = OSM-Knoten 12): Hauptstrasse West–Ost, Fahrbahn y = −3 … +3, Tempo 30; Zufahrt von Süden,
// Achse des Zufahrtsstreifens x = +1,25, Bordkante (Fahrbahnrand) y = −3. Phase Fahrbahn: B 3,00 m ab der Bordkante -> D (0,75; −6).
// Phase Trottoir: D' = 3,00 m hinter dem hinteren Rand (Fahrersitz 0,50 m links), Gehlinie 0,50 m vor dem hinteren Trottoirrand.

import { describe, expect, it } from 'vitest'
import { wgs, dist, imPolygon, type P } from '../geo'
import type { OsmDaten, OsmWeg } from '../daten/osm'
import type { AvFlaeche } from '../daten/av'
import type { Hindernis } from './hindernisse'
import { rechneKnoten } from './rechnen'
import { tueBand, TUE_GEHLINIE_M, TUE_BREITE_ANNAHME_M, type TueSeite } from './trottoirueberfahrt'
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
    expect(tp.achseQuelle).toContain('0,50 m vor dem hinteren Rand der Überfahrt')
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
    expect(t.breiteText).toContain('nach dem schmaleren angrenzenden Trottoir (AV links 2,50 m, rechts 2,50 m')
  })
  it('Phase Trottoir mit Gehlinie y −5,0 und D\' (0,75; −8,5); Phase Fahrbahn ab der Bordkante D (0,75; −6)', () => {
    const tp = e.trottoirPruefung!
    nahe(tp.D, 0.75, -8.5, 0.06)
    nahe(tp.richtungen[0].K, 1.25, -5, 0.06); nahe(tp.richtungen[1].K, 1.25, -5, 0.06)
    nahe(e.D, 0.75, -6)
    // ohne Modus: keine Trottoirprüfung (die AV zeigt kein Trottoir quer über die Zufahrt), Ergebnis wie bisher
    expect(rechne(osm(), [fahrbahn, trottoirL, trottoirR]).trottoirPruefung).toBeNull()
  })
  it('Breite von Hand geht der AV vor (Hinweis mit dem AV-Wert): hinterer Rand y −6,5, D\' y −9,5, Gehlinie y −6,0', () => {
    const m = rechne(osm(), [fahrbahn, trottoirL, trottoirR], { eingaben: eg({ trottoirueberfahrt: { breite: 3.5 } }) })
    expect([m.trottoirueberfahrt!.breiteQuelle, m.trottoirueberfahrt!.breite]).toEqual(['eingabe', 3.5])
    expect(m.trottoirueberfahrt!.laenge).toBeCloseTo(3.5, 3)
    expect(m.hinweise.join(' | ')).toContain('Breite der Trottoirüberfahrt von Hand 3,50 m (AV: 2,50 m)')
    nahe(m.trottoirueberfahrt!.hinterkante, 1.25, -6.5, 0.06)
    nahe(m.trottoirPruefung!.D, 0.75, -9.5, 0.06)
    nahe(m.trottoirPruefung!.richtungen[0].K, 1.25, -6, 0.06)
  })
  it('ungleiche Trottoirs 2 m links / 6 m rechts: Breite 2,00 (das schmalere), Länge 2,00, hinterer Rand y −5; Gehlinie beidseits y −4,5', () => {
    // vorher: Breite 4,00, Länge 6,00 (Schnitt durch die zusammengesetzte Randlinie), dann Gehlinie rechts y −8,5 (eigener Rand, D' fast
    // auf der Gehlinie); jetzt bestimmt die Überfahrt den Rand: Gehlinie beidseits 0,50 m davor, D' 3,00 m dahinter -> 3,50 m Abstand
    const l2 = flaeche('Trottoir', [lv(-200, -5), lv(-2.5, -5), lv(-2.5, -3), lv(-200, -3)])
    const r6 = flaeche('Trottoir', [lv(2.5, -9), lv(200, -9), lv(200, -3), lv(2.5, -3)])
    const m = rechne(osm(), [fahrbahn, l2, r6], { eingaben: eg(TUE) })
    const t = m.trottoirueberfahrt!
    expect([t.breiteQuelle, t.breite]).toEqual(['av_neben', expect.closeTo(2, 2)])
    expect(t.laenge).toBeCloseTo(2, 2)
    nahe(t.hinterkante, 1.25, -5, 0.06)
    nahe(m.trottoirPruefung!.D, 0.75, -8, 0.06)
    nahe(m.trottoirPruefung!.richtungen[0].K, 1.25, -4.5, 0.06)
    nahe(m.trottoirPruefung!.richtungen[1].K, 1.25, -4.5, 0.06)
    for (const r of m.trottoirPruefung!.richtungen) expect(m.trottoirPruefung!.D[1] - r.K[1]).toBeCloseTo(-3.5, 1)
    expect(m.annahmen.join(' | ')).toContain('hinterer Rand beidseits 2,00 m hinter dem Fahrbahnrand, auf der Zufahrtsachse 2,00 m')
  })
  it('nur rechts ein Trottoir: links Fahrbahnrand plus Breite (y −5,5)', () => {
    const m = rechne(osm(), [fahrbahn, trottoirR], { eingaben: eg(TUE) })
    expect(m.trottoirueberfahrt!.breiteText).toContain('angrenzenden Trottoir (AV rechts 2,50 m;')
    nahe(m.trottoirPruefung!.richtungen[0].K, 1.25, -5, 0.06)
    expect(m.trottoirPruefung!.achseQuelle).toContain('nach links 0,50 m vor dem hinteren Rand der Überfahrt, 2,00 m hinter dem Fahrbahnrand')
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

describe('K0: tueBand (Breite nach VSS 40 242 Ziffer 16, Länge = Breite / sin α)', () => {
  // Arme West und Ost auf y = 0, Zufahrt von Süden: West u = (−1; 0), links von u = Süden -> Seite +1; Ost u = (1; 0) -> Seite −1.
  // Fahrbahnrand 3 m, Bordkante auf der Zufahrtsachse bei sRand = 33
  const sRand = 33
  const west: P[] = [lv(0, 0), lv(-100, 0)], ost: P[] = [lv(0, 0), lv(100, 0)]
  const t = (b: number) => ({ abstand: 3 + b / 2, breite: b, n: 10 })
  const seiten = (bw: number | null, bo: number | null): [TueSeite, TueSeite] =>
    [{ ml: west, seite: 1, rand: 3, t: bw === null ? null : t(bw) }, { ml: ost, seite: -1, rand: 3, t: bo === null ? null : t(bo) }]
  it('Reihenfolge: von Hand (geht der AV vor), AV quer, schmaleres angrenzendes Trottoir, Annahme 2,00 m', () => {
    const h = tueBand(sRand, seiten(2, 3), { sHinter: 35.4, breite: 2.4 }, 3, 90)
    expect([h.quelle, h.breite, h.laenge]).toEqual(['eingabe', 3, 3])
    expect(h.hinweise).toEqual(['Breite der Trottoirüberfahrt von Hand 3,00 m (AV: 2,40 m).'])
    const q = tueBand(sRand, seiten(2, 3), { sHinter: 35.4, breite: 2.4 }, null, 90)
    expect([q.quelle, q.breite, q.sHinter]).toEqual(['av_quer', 2.4, 35.4])
    const a = tueBand(sRand, seiten(null, null), null, null, 90)
    expect([a.quelle, a.breite, a.hinten, a.gehlinie, a.sHinter]).toEqual(['annahme', 2, [5, 5], [4.5, 4.5], 35])
  })
  it('ungleiche Breiten 2/3, 2/6, 1,8/4, 5,6/7,4: das schmalere, begrenzt auf 2,00 bis 3,50 m; Gehlinie beidseits vor dem Rand der Überfahrt', () => {
    const f = (bw: number, bo: number) => tueBand(sRand, seiten(bw, bo), null, null, 90)
    const a = f(2, 3), b = f(2, 6), c = f(1.8, 4), d = f(4, 5)
    expect([a.breite, a.laenge, a.hinten, a.gehlinie, a.hinweise]).toEqual([2, 2, [5, 5], [4.5, 4.5], []])
    expect([b.breite, b.laenge, b.hinten, b.gehlinie]).toEqual([2, 2, [5, 5], [4.5, 4.5]])
    // breite Trottoirs 5,6 / 7,4 m (Winkelriedstrasse): Breite 3,50, Gehlinie beidseits 3,00 m hinter dem Fahrbahnrand, D' bei 6,50:
    // Abstand D' – Gehlinie 3,50 m (vorher 0,66 / 1,45 m)
    const w = f(5.6, 7.4)
    expect([w.breite, w.abstand, w.laenge, w.hinten, w.gehlinie]).toEqual([3.5, 3.5, 3.5, [6.5, 6.5], [6, 6]])
    expect(w.sHinter + 3 - (sRand + w.gehlinie[0] - 3)).toBeCloseTo(3.5, 9)
    expect([c.breite, c.laenge]).toEqual([2, 2])
    expect(c.hinweise).toEqual(['Breite der Trottoirüberfahrt 2,00 m: angrenzendes Trottoir nach AV 1,80 m, nach VSS 40 242 Ziffer 16 ' +
      'begrenzt auf 2,00 bis 3,50 m.'])
    expect([d.breite, d.laenge, d.hinweise.length]).toEqual([3.5, 3.5, 1])
    expect(c.quelle).toBe('av_neben')
  })
  it('schiefe Einmündung: Länge auf der Zufahrtsachse = Breite / sin α (60°: 2,50 / 0,866 = 2,887 m); AV quer: Breite = Länge · sin α', () => {
    const n = tueBand(sRand, seiten(2.5, 2.5), null, null, 60)
    expect(n.breite).toBe(2.5)
    expect(n.laenge).toBeCloseTo(2.5 / Math.sin(Math.PI / 3), 6)
    expect(n.sHinter).toBeCloseTo(sRand + 2.887, 3)
    // Gehlinie auf der Achse 0,50 / sin α vor dem hinteren Rand; D' 3,00 m dahinter (rechnen.ts): Abstand auf der Achse 3,577 m
    expect(n.sHinter - n.sGehlinie).toBeCloseTo(0.5 / Math.sin(Math.PI / 3), 6)
    expect(tueBand(sRand, seiten(2.5, 2.5), null, null, 120).laenge).toBeCloseTo(2.887, 3)
    const q = tueBand(sRand, seiten(null, null), { sHinter: sRand + 2.887, breite: 2.887 }, null, 60)
    expect([q.laenge, q.breite]).toEqual([expect.closeTo(2.887, 3), expect.closeTo(2.5, 3)])
  })
  it('Trottoir hinter einem Radweg (Vorlauf 2,00 m): hinterer Rand 2,00 + Breite hinter dem Fahrbahnrand, Gehlinie 0,50 m davor', () => {
    // Trottoir 4,09 m ab 2,00 m hinter dem Rand (Egelgasse): Breite 3,50 (begrenzt), Abstand 5,50, Gehlinie 5,00 hinter dem Rand
    const n = tueBand(sRand, [{ ml: west, seite: 1, rand: 3, t: { abstand: 3 + 2 + 4.09 / 2, breite: 4.09, n: 5 } },
      { ml: ost, seite: -1, rand: 3, t: null }], null, null, 90)
    expect([n.breite, n.vorlauf, n.abstand, n.laenge]).toEqual([3.5, expect.closeTo(2, 9), expect.closeTo(5.5, 9), expect.closeTo(5.5, 9)])
    expect(n.hinten).toEqual([expect.closeTo(8.5, 9), expect.closeTo(8.5, 9)])
    expect(n.gehlinie).toEqual([expect.closeTo(8, 9), expect.closeTo(8, 9)])
    // ohne Vorlauf (Trottoir am Rand) bleibt der Abstand die Breite
    expect(tueBand(sRand, seiten(2.5, null), null, null, 90).abstand).toBe(2.5)
  })
})

describe('K0: kurze Hinweise nur, wenn sie zutreffen (VSS 40 242 Ziffern 14.1, 14.2, 14.3.1, 14.3.4, 15.4.2)', () => {
  const hw = (e: Ergebnis) => e.hinweise.join(' | ')
  it('Normalfall (innerorts, 30 km/h, rechtwinklig, Einmündung): keiner dieser Hinweise', () => {
    const h = hw(rechne(osm(), [fahrbahn], { eingaben: eg(TUE) }))
    for (const z of ['14.1', '14.2', '14.3.1', '14.3.4', '15.4.2']) expect(h).not.toContain(`Ziffer ${z}`)
  })
  it('60 km/h: ausserorts (14.1) und Tempo über 50 km/h (14.3.1); ohne Modus nicht', () => {
    const h = hw(rechne(osm({ maxspeed: '60' }), [fahrbahn], { eingaben: eg(TUE) }))
    expect(h).toContain('Trottoirüberfahrt ausserorts (nach OSM): nach VSS 40 242 Ziffer 14.1 nur innerorts.')
    expect(h).toContain('Tempo auf der Hauptfahrbahn 60 km/h: nach VSS 40 242 Ziffer 14.3.1 höchstens 50 km/h.')
    expect(hw(rechne(osm({ maxspeed: '60' }), [fahrbahn]))).not.toContain('Ziffer 14.1')
  })
  it('Häkchen an einem Arm der durchgehenden Strasse (14.2)', () => {
    const h = hw(rechne(osm(), [fahrbahn], { zufahrt: '1:1:-1', eingaben: eg(TUE) }))
    expect(h).toContain('nach VSS 40 242 Ziffer 14.2')
  })
  it('spitzer Einbiegewinkel rund 40° (14.3.4)', () => {
    const o = osm()
    o.wege[1] = weg(2, [[12, 0, 0], [20, -153.2, -128.6]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' })
    const e = rechne(o, [fahrbahn], { eingaben: eg(TUE) })
    expect(hw(e)).toMatch(/Einbiegewinkel rund (40|140)°: nach VSS 40 242 Ziffer 14\.3\.4 nur zwischen 45° und 135°\./)
  })
  it('Velos auf dem Trottoir nach OSM (15.4.2): Tag auf der Seite der Zufahrt bzw. beidseits; andere Seite nicht', () => {
    // Hauptstrasse West -> Ost digitalisiert: die Zufahrt (Süden) liegt rechts
    expect(hw(rechne(osm({ 'sidewalk:right:bicycle': 'yes' }), [fahrbahn], { eingaben: eg(TUE) })))
      .toContain('OSM: Velos auf dem Trottoir gestattet (sidewalk:right:bicycle=yes): nach VSS 40 242 Ziffer 15.4.2')
    expect(hw(rechne(osm({ 'sidewalk:both:bicycle': 'yes' }), [fahrbahn], { eingaben: eg(TUE) }))).toContain('sidewalk:both:bicycle=yes')
    expect(hw(rechne(osm({ 'sidewalk:left:bicycle': 'yes' }), [fahrbahn], { eingaben: eg(TUE) }))).not.toContain('15.4.2')
    expect(hw(rechne(osm({ 'sidewalk:right:bicycle': 'yes' }), [fahrbahn]))).not.toContain('15.4.2')
  })
})

describe('K0: Gehlinie vor dem hinteren Rand der Überfahrt, Abstand D\' – Gehlinie 3,50 m (Review fgsCheck 23.10.2026)', () => {
  const abstandDG = (e: Ergebnis) => e.trottoirPruefung!.richtungen.map(r => e.trottoirPruefung!.D[1] - r.K[1])
  it('breite Trottoirs 5,6 / 7,4 m (wie Winkelriedstrasse): Breite 3,50, Gehlinie beidseits y −6, D\' y −9,5', () => {
    const l = flaeche('Trottoir', [lv(-200, -8.6), lv(-2.5, -8.6), lv(-2.5, -3), lv(-200, -3)])
    const r = flaeche('Trottoir', [lv(2.5, -10.4), lv(200, -10.4), lv(200, -3), lv(2.5, -3)])
    const e = rechne(osm(), [fahrbahn, l, r], { eingaben: eg(TUE) })
    expect([e.trottoirueberfahrt!.breite, e.trottoirueberfahrt!.abstand]).toEqual([3.5, 3.5])
    nahe(e.trottoirPruefung!.D, 0.75, -9.5, 0.06)
    nahe(e.trottoirPruefung!.richtungen[0].K, 1.25, -6, 0.06); nahe(e.trottoirPruefung!.richtungen[1].K, 1.25, -6, 0.06)
    for (const d of abstandDG(e)) expect(d).toBeCloseTo(-3.5, 1)
    expect(e.hinweise.join(' | ')).toContain('begrenzt auf 2,00 bis 3,50 m')
  })
  it('ungleich 2 / 6 m: Abstand D\' – Gehlinie beidseits 3,50 m', () => {
    const l2 = flaeche('Trottoir', [lv(-200, -5), lv(-2.5, -5), lv(-2.5, -3), lv(-200, -3)])
    const r6 = flaeche('Trottoir', [lv(2.5, -9), lv(200, -9), lv(200, -3), lv(2.5, -3)])
    for (const d of abstandDG(rechne(osm(), [fahrbahn, l2, r6], { eingaben: eg(TUE) }))) expect(d).toBeCloseTo(-3.5, 1)
  })
  it('Radweg vor dem Trottoir: Phase Fahrbahn ab der Aussenkante des Radwegs, Überfahrt ab dem Fahrbahnrand bis hinter das Trottoir', () => {
    // Radweg (OSM) y −4,5, 2,00 m angenommen (y −3,5 … −5,5, Ziffer 12: B ab y −5,5 -> D y −8,5). AV-Trottoir 3,00 m dahinter
    // (y −5,5 … −8,5): Vorlauf 2,50, Breite 3,00, hinterer Rand 5,50 m hinter dem Fahrbahnrand (y −8,5), D' y −11,5, Gehlinie y −8,0
    const radweg = weg(50, [[51, -200, -4.5], [52, 200, -4.5]], { highway: 'cycleway' })
    const tl = flaeche('Trottoir', [lv(-200, -8.5), lv(-2.5, -8.5), lv(-2.5, -5.5), lv(-200, -5.5)])
    const tr = flaeche('Trottoir', [lv(2.5, -8.5), lv(200, -8.5), lv(200, -5.5), lv(2.5, -5.5)])
    const e = rechne(osm({}, { querungen: [radweg] }), [fahrbahn, tl, tr], { eingaben: eg(TUE) })
    expect(e.nullpunktText).toBe('Aussenkante des Radwegs')
    nahe(e.D, 0.75, -8.5, 0.06)
    const t = e.trottoirueberfahrt!
    expect([t.breite, t.abstand, t.laenge]).toEqual([expect.closeTo(3, 2), expect.closeTo(5.5, 2), expect.closeTo(5.5, 2)])
    nahe(t.vorderkante, 1.25, -3, 0.06); nahe(t.hinterkante, 1.25, -8.5, 0.06)
    nahe(e.trottoirPruefung!.D, 0.75, -11.5, 0.06)
    for (const d of abstandDG(e)) expect(d).toBeCloseTo(-3.5, 1)
    expect(e.annahmen.join(' | ')).toContain('hinterer Rand beidseits 5,50 m (Trottoir nach AV ab 2,50 m) hinter dem Fahrbahnrand')
  })
  it('Flag durchgehend: true an einem Arm der durchgehenden Strasse (Ziffer 14.2), sonst false', () => {
    expect(rechne(osm(), [fahrbahn], { eingaben: eg(TUE) }).trottoirueberfahrt!.durchgehend).toBe(false)
    const d = rechne(osm(), [fahrbahn], { zufahrt: '1:1:-1', eingaben: eg(TUE) })
    expect(d.trottoirueberfahrt!.durchgehend).toBe(true)
    expect(d.hinweise.join(' | ')).toContain('Ziffer 14.2')
  })
})

describe('K0: Hauptstrasse mit Knick am Knoten (Review 2 von bb84cfd): Gehlinie nie auf der Fahrbahn', () => {
  // Arm Ost gerade (y = 0), Arm West um 15° nach Süden abgeknickt: u = (−cos 15°; −sin 15°), Seite der Zufahrt n = (sin 15°; −cos 15°).
  // Fahrbahn je Arm 6 m (±3 m), Trottoir je Arm 3 … 5 m auf der Seite der Zufahrt. Erwartung: Gehlinie je Arm 4,5 m neben seiner Achse
  // (1,50 m hinter seinem Fahrbahnrand), kein Zielpunkt ab 5 m auf der Fahrbahn der Hauptstrasse, D' auf der Achse mindestens 3,50 m hinter der Gehlinie
  const w = 15 * Math.PI / 180, u: P = [-Math.cos(w), -Math.sin(w)], nW: P = [Math.sin(w), -Math.cos(w)]
  const pw = (s: number, t: number): P => lv(s * u[0] + t * nW[0], s * u[1] + t * nW[1])
  const o: OsmDaten = { ...osm(), wege: [
    weg(1, [[13, 200, 0], [12, 0, 0]], { highway: 'unclassified', name: 'Hauptstrasse', maxspeed: '30' }),
    weg(3, [[12, 0, 0], [10, 200 * u[0], 200 * u[1]]], { highway: 'unclassified', name: 'Hauptstrasse', maxspeed: '30' }),
    weg(2, [[12, 0, 0], [20, 0, -200]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' })] }
  const fbOst = flaeche('Strasse_Weg', [lv(0, -3), lv(200, -3), lv(200, 3), lv(0, 3)])
  const fbWest = flaeche('Strasse_Weg', [pw(-2, -3), pw(200, -3), pw(200, 3), pw(-2, 3)])
  const fbNeben = flaeche('Strasse_Weg', [lv(-2.5, -1), lv(2.5, -1), lv(2.5, -200), lv(-2.5, -200)])
  const trOst = flaeche('Trottoir', [lv(2.5, -5), lv(200, -5), lv(200, -3), lv(2.5, -3)])
  const trWest = flaeche('Trottoir', [pw(5, 3), pw(200, 3), pw(200, 5), pw(5, 5)])
  const strasse = [fbOst, fbWest, fbNeben]
  it('Gehlinie 1,50 m hinter dem Fahrbahnrand je Arm, nicht auf der Fahrbahn; D\' mindestens 3,50 m dahinter', () => {
    const e = rechne(o, [...strasse, trOst, trWest], { zufahrt: '2:0:1', eingaben: eg(TUE) })
    const t = e.trottoirueberfahrt!
    expect([t.breiteQuelle, t.breite]).toEqual(['av_neben', expect.closeTo(2, 2)])
    const tp = e.trottoirPruefung!
    const links = tp.richtungen.find(r => r.richtung === 'links')!
    for (const p of links.sichtpunkte.slice(5)) {
      // Fahrbahn der Hauptstrasse (die Einmündung selbst ist im Planungsfall Strasse in der AV)
      expect([fbOst, fbWest].some(f => imPolygon(p, f.ringe)), `Zielpunkt ${rel(p)} auf der Fahrbahn`).toBe(false)
      // Abstand zur Achse des Arms West: Projektion auf nW
      const [x, y] = rel(p)
      expect(x * nW[0] + y * nW[1]).toBeCloseTo(4.5, 1)
    }
    for (const r of tp.richtungen) expect(dist(tp.Dachse, r.K)).toBeGreaterThanOrEqual(3.5 - 0.05)
    expect(tp.achseQuelle).toContain('nach links 0,50 m vor dem hinteren Rand der Überfahrt, 1,50 m hinter dem Fahrbahnrand')
  })
})

describe('K0: D\' der Phase Trottoir von Hand (Dtrottoir)', () => {
  // AV-Trottoir quer (y −5 … −3): hinterer Rand y −5,025, D' (Vorgabe) (0,75; −8,025)
  const av = [fbT, neben, trottoirQuer]
  it('D\' von Hand gilt für die Phase Trottoir; Band und Phase Fahrbahn bleiben; Quellen im Ergebnis', () => {
    const v = rechne(osm(), av, { eingaben: eg(TUE) })
    expect([v.trottoirueberfahrt!.DtrottoirQuelle, v.trottoirueberfahrt!.Dquelle]).toEqual(['rechnung', 'rechnung'])
    nahe(v.trottoirueberfahrt!.Dtrottoir, 0.75, -8.025, 0.06)
    const e = rechne(osm(), av, { eingaben: eg({ ...TUE, Dtrottoir: lv(0.75, -10), D: lv(0.75, -6.5) }) })
    const t = e.trottoirueberfahrt!
    expect([t.DtrottoirQuelle, t.Dquelle]).toEqual(['hand', 'hand'])
    nahe(e.trottoirPruefung!.D, 0.75, -10); nahe(t.Dtrottoir, 0.75, -10); nahe(t.D, 0.75, -6.5)
    nahe(e.trottoirPruefung!.Dachse, 1.25, -10)          // Fahrersitz 0,50 m links der Achse wie bei D
    expect([t.vorderkante, t.hinterkante]).toEqual([v.trottoirueberfahrt!.vorderkante, v.trottoirueberfahrt!.hinterkante])
    nahe(e.trottoirPruefung!.richtungen[0].K, 1.25, -4.5, 0.06)  // Gehlinie unverändert
    expect(e.hinweise.join(' | ')).not.toContain("D' von Hand")   // 4,98 m hinter dem hinteren Rand
    expect(e.annahmen.join(' | ')).toContain("Beobachtungspunkt D' von Hand, 4,98 m hinter dem hinteren Rand der Überfahrt")
  })
  it('Hinweis unter 3,00 m hinter dem hinteren Rand bzw. weit weg; ohne Häkchen ohne Wirkung', () => {
    const n = rechne(osm(), av, { eingaben: eg({ ...TUE, Dtrottoir: lv(0.75, -6.5) }) })
    expect(n.hinweise).toContain("D' von Hand 1,48 m hinter dem hinteren Rand: weniger als 3,00 m (VSS 40 273 Ziffer 13.2).")
    const w = rechne(osm(), av, { eingaben: eg({ ...TUE, Dtrottoir: lv(0.75, -60) }) })
    expect(w.hinweise.join(' | ')).toContain("D' von Hand liegt 55 m vom hinteren Rand entfernt: Lage prüfen.")
    const o = rechne(osm(), av, { eingaben: eg({ Dtrottoir: lv(0.75, -10) }) })
    expect(o.hinweise).toContain("D' von Hand ohne Wirkung: gilt nur mit dem Häkchen «Trottoirüberfahrt».")
    nahe(o.trottoirPruefung!.D, 0.75, -8.025, 0.06)
  })
  it('ohne das Feld bzw. null: Ergebnis gleich (Fall-Dateien vor dem Feld)', () => {
    const a = rechneKnoten(osm(), av, { knoten: 12, zufahrt: null, eingaben: eg(TUE) })
    const b = rechneKnoten(osm(), av, { knoten: 12, zufahrt: null, eingaben: { ...eg(TUE), Dtrottoir: undefined } })
    a.ms = 0; b.ms = 0
    expect(JSON.stringify(b)).toBe(JSON.stringify(a))
  })
})
