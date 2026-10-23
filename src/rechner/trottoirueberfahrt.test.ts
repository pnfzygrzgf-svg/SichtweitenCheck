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
  it('Breite von Hand geht der AV vor (Hinweis mit dem AV-Wert): hinterer Rand y −6,5, D\' y −9,5, Gehlinie bleibt y −5,0', () => {
    const m = rechne(osm(), [fahrbahn, trottoirL, trottoirR], { eingaben: eg({ trottoirueberfahrt: { breite: 3.5 } }) })
    expect([m.trottoirueberfahrt!.breiteQuelle, m.trottoirueberfahrt!.breite]).toEqual(['eingabe', 3.5])
    expect(m.trottoirueberfahrt!.laenge).toBeCloseTo(3.5, 3)
    expect(m.hinweise.join(' | ')).toContain('Breite der Trottoirüberfahrt von Hand 3,50 m (AV: 2,50 m)')
    nahe(m.trottoirueberfahrt!.hinterkante, 1.25, -6.5, 0.06)
    nahe(m.trottoirPruefung!.D, 0.75, -9.5, 0.06)
    nahe(m.trottoirPruefung!.richtungen[0].K, 1.25, -5, 0.06)
  })
  it('ungleiche Trottoirs 2 m links / 6 m rechts: Breite 2,00 (das schmalere), Länge 2,00, hinterer Rand y −5; Gehlinie je Seite', () => {
    // vorher (Schnitt durch die zusammengesetzte Randlinie): Breite 4,00, Länge 6,00. Gehlinie links y −4,5, rechts y −8,5
    const l2 = flaeche('Trottoir', [lv(-200, -5), lv(-2.5, -5), lv(-2.5, -3), lv(-200, -3)])
    const r6 = flaeche('Trottoir', [lv(2.5, -9), lv(200, -9), lv(200, -3), lv(2.5, -3)])
    const m = rechne(osm(), [fahrbahn, l2, r6], { eingaben: eg(TUE) })
    const t = m.trottoirueberfahrt!
    expect([t.breiteQuelle, t.breite]).toEqual(['av_neben', expect.closeTo(2, 2)])
    expect(t.laenge).toBeCloseTo(2, 2)
    nahe(t.hinterkante, 1.25, -5, 0.06)
    nahe(m.trottoirPruefung!.D, 0.75, -8, 0.06)
    nahe(m.trottoirPruefung!.richtungen[0].K, 1.25, -4.5, 0.06)
    nahe(m.trottoirPruefung!.richtungen[1].K, 1.25, -8.5, 0.06)
    expect(m.annahmen.join(' | ')).toContain('hinterer Rand beidseits 2,00 m hinter dem Fahrbahnrand, auf der Zufahrtsachse 2,00 m')
  })
  it('nur rechts ein Trottoir: links Fahrbahnrand plus Breite (y −5,5)', () => {
    const m = rechne(osm(), [fahrbahn, trottoirR], { eingaben: eg(TUE) })
    expect(m.trottoirueberfahrt!.breiteText).toContain('angrenzenden Trottoir (AV rechts 2,50 m;')
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
  it('ungleiche Breiten 2/3, 2/6, 1,8/4: das schmalere, begrenzt auf 2,00 bis 3,50 m; Gehlinie je Seite vor dem eigenen Rand', () => {
    const f = (bw: number, bo: number) => tueBand(sRand, seiten(bw, bo), null, null, 90)
    const a = f(2, 3), b = f(2, 6), c = f(1.8, 4), d = f(4, 5)
    expect([a.breite, a.laenge, a.hinten, a.gehlinie, a.hinweise]).toEqual([2, 2, [5, 6], [4.5, 5.5], []])
    expect([b.breite, b.laenge, b.hinten, b.gehlinie]).toEqual([2, 2, [5, 9], [4.5, 8.5]])
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
    expect(tueBand(sRand, seiten(2.5, 2.5), null, null, 120).laenge).toBeCloseTo(2.887, 3)
    const q = tueBand(sRand, seiten(null, null), { sHinter: sRand + 2.887, breite: 2.887 }, null, 60)
    expect([q.laenge, q.breite]).toEqual([expect.closeTo(2.887, 3), expect.closeTo(2.5, 3)])
  })
  it('schmales Trottoir unter 1,00 m: Gehlinie höchstens in der Mitte des Trottoirs', () => {
    const n = tueBand(sRand, [{ ml: west, seite: 1, rand: 3, t: { abstand: 3.4, breite: 0.8, n: 5 } }, { ml: ost, seite: -1, rand: 3, t: null }],
      null, null, 90)
    expect(n.gehlinie[0]).toBeCloseTo(3.4, 6)
    expect(n.breite).toBe(2)
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
