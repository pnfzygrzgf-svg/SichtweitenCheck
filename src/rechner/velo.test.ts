// Tests E3b: Veloverkehr (Tab. 3, Veloachse, Radweg nach Ziffer 12) und Trottoir (Tab. 2) am T-Knoten aus rechnen.test.ts.
// Handlösungen im Kommentar.
//
// Lage (Meter, x Ost, y Nord, Ursprung = OSM-Knoten 12): Hauptstrasse West–Ost, Fahrbahn y = −3 … +3, Erschliessungsstrasse 30 km/h;
// Zufahrt von Süden, Achse x = +1,25, Kante y = −3. Ohne Eingaben: D (0,75; −6). Nach links Autoachse y = −1,5 (d 1,50 m),
// Veloachse im Mischverkehr y = −2,5 (d 0,50 m), auf einem Radstreifen y = −2,25 (Mitte des Streifens 1,50 m, 0,75 m vom Rand) und
// die Autoachse dann y = 0 (1,50 m neben dem Streifen). Gebäudeecke C = (−10; −4).
// Strahlensatz D–C bis zur Achse y = a: s = 1,25 − x mit x = 0,75 − 10,75 · (a + 6) / 2.
//   Auto (a = −1,5): x = −23,4375, s = 24,6875 m. Velo Mischverkehr (a = −2,5): x = −18,0625, s = 19,3125 m < 25 m (Tab. 3).
//   Velo Radstreifen (a = −2,25): x = −19,40625, s = 20,65625 m. Auto mit Radstreifen (a = 0): x = −31,5, s = 32,75 m.

import { describe, expect, it } from 'vitest'
import { wgs, type P } from '../geo'
import type { OsmDaten, OsmWeg } from '../daten/osm'
import type { AvFlaeche } from '../daten/av'
import type { Hindernis } from './hindernisse'
import { rechneKnoten } from './rechnen'
import { tab3Spalte, veloSichtweite, tab2Spalte, trottoirSichtweite, TAB3, TAB2, istRadweg, veloVorgabe } from './velo'
import { veloTeile, veloLage, VELO_LAENGE_M, VELO_BREITE_M } from './fahrzeug'
import { KEINE_ALLE_EINGABEN, type Eingaben, type Ergebnis, type KnotenFall } from './typen'
import { neigungMessung } from './neigung'

const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const ll = (x: number, y: number): [number, number] => wgs(O[0] + x, O[1] + y)
const weg = (id: number, knoten: [number, number, number][], tags: Record<string, string>): OsmWeg =>
  ({ id, tags, knoten: knoten.map(k => k[0]), geom: knoten.map(k => ll(k[1], k[2])) })
const osm = (haupt: Record<string, string> = {}, querungen: OsmWeg[] = []): OsmDaten => ({
  wege: [
    weg(1, [[10, -200, 0], [12, 0, 0], [13, 200, 0]], { highway: 'unclassified', name: 'Hauptstrasse', maxspeed: '30', ...haupt }),
    weg(2, [[12, 0, 0], [20, 0, -200]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' }),
  ],
  tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen, vortritt: [],
})
const flaeche = (art: string, ring: P[]): AvFlaeche => ({ art, kanton: 'BE', qualitaet: 'AV93', bfs: 351, ringe: [ring] })
const fahrbahn = flaeche('Strasse_Weg', [lv(-200, -3), lv(-2.5, -3), lv(-2.5, -200), lv(2.5, -200), lv(2.5, -3), lv(200, -3),
  lv(200, 3), lv(-200, 3), lv(-200, -3)])
const ecke = flaeche('Gebaeude', [lv(-10, -4), lv(-30, -4), lv(-30, -24), lv(-10, -24), lv(-10, -4)])
const eg = (x: Partial<Eingaben>): Eingaben => ({ ...KEINE_ALLE_EINGABEN, ...x })
const rechne = (o: OsmDaten, av: AvFlaeche[], f: Partial<KnotenFall> = {}): Ergebnis => {
  const r = rechneKnoten(o, av, { knoten: 12, zufahrt: null, ...f })
  expect(r.meldungen).toEqual([])
  return r.ergebnis!
}
const seite = (e: Ergebnis, r: 'links' | 'rechts') => e.richtungen.find(x => x.richtung === r)!
const rel = (p: P): [number, number] => [p[0] - O[0], p[1] - O[1]]
const nahe = (p: P, x: number, y: number, tol = 0.05) => {
  const [a, b] = rel(p)
  expect(Math.abs(a - x), `x ${a} statt ${x}`).toBeLessThan(tol)
  expect(Math.abs(b - y), `y ${b} statt ${y}`).toBeLessThan(tol)
}

describe('E3b: Tab. 3 (Veloverkehr)', () => {
  it('Spalten ≤ −4, −2, 0, > 0: je bis zur Spaltenzahl gerechnet', () => {
    expect([-8, -4, -3.9, -2, -1.9, -0.1, 0, 0.1, 5].map(tab3Spalte)).toEqual([0, 0, 1, 1, 2, 2, 2, 3, 3])
  })
  it('bis 30 km/h: 30 / 25 / 25 / 20 m; über 30 km/h: 55 / 55 / 50 / 45 m', () => {
    expect([-5, -2, 0, 3].map(i => veloSichtweite(30, i).A)).toEqual([30, 25, 25, 20])
    expect([-5, -2, 0, 3].map(i => veloSichtweite(20, i).A)).toEqual(TAB3.bis30)
    expect([-5, -2, 0, 3].map(i => veloSichtweite(31, i).A)).toEqual([55, 55, 50, 45])
    expect([-5, -2, 0, 3].map(i => veloSichtweite(80, i).A)).toEqual(TAB3.ueber30)
    expect(veloSichtweite(50, -3).text).toBe('Tab. 3, über 30 km/h, Spalte −2 %')
  })
  it('schnelle E-Bikes verboten (nur über 30 km/h): 35 m talwärts, 30 m eben, 25 m bergwärts', () => {
    expect([-5, -2, 0, 3].map(i => veloSichtweite(50, i, true).A)).toEqual([35, 35, 30, 25])
    expect([-5, -2, 0, 3].map(i => veloSichtweite(30, i, true).A)).toEqual([30, 25, 25, 20])   // bis 30 km/h ohne Wirkung
    expect(veloSichtweite(50, 1, true)).toMatchObject({ ebike: true, text: 'Tab. 3, über 30 km/h, schnelle E-Bikes verboten, bergwärts (Spalte > 0 %)' })
  })
  it('Neigung unbekannt (Entscheid 31.10.2026): Spalte ≤ −4, unabhängig von i; E-Bikes verboten: talwärts 35 m', () => {
    expect([30, 31, 50].map(t => veloSichtweite(t, 0, false, true).A)).toEqual([30, 55, 55])
    expect(veloSichtweite(50, 3, false, true)).toMatchObject({ A: 55, spalte: 0,
      text: 'Tab. 3, über 30 km/h, Spalte ≤ −4 % (Neigung unbekannt: strengster Wert)' })
    expect(veloSichtweite(30, 0, false, true).text).toBe('Tab. 3, bis 30 km/h, Spalte ≤ −4 % (Neigung unbekannt: strengster Wert)')
    expect(veloSichtweite(50, 0, true, true)).toMatchObject({ A: 35, ebike: true,
      text: 'Tab. 3, über 30 km/h, schnelle E-Bikes verboten, talwärts (Spalte ≤ −4 %; Neigung unbekannt: strengster Wert)' })
  })
})

describe('E3b: Tab. 2 (Trottoir)', () => {
  it('Spalten ≤ −6, −4, −2, ≥ 0 (Zwischenwerte zur Spalte talwärts daneben): 30 / 20 / 20 / 15 m', () => {
    expect([-7, -6, -5, -4, -3, -0.1, 0, 4].map(tab2Spalte)).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
    expect([-7, -5, -3, 0, 4].map(i => trottoirSichtweite(i).A)).toEqual([30, 20, 20, 15, 15])
    expect(TAB2).toEqual([30, 20, 20, 15])
  })
  it('Neigung unbekannt (Entscheid 31.10.2026): Spalte ≤ −6, 30 m', () => {
    expect(trottoirSichtweite(4, true)).toEqual({ A: 30, spalte: 0, text: 'Tab. 2, Spalte ≤ −6 % (Neigung unbekannt: strengster Wert)' })
    expect(trottoirSichtweite(4).A).toBe(15)
  })
})

describe('E3b: Veloführung aus OSM', () => {
  it('Radweg-Tags; Seite rechts des Verkehrs zum Knoten (Weg vom Knoten weg digitalisiert: left)', () => {
    expect([istRadweg({ highway: 'cycleway' }), istRadweg({ highway: 'path', bicycle: 'designated' }),
      istRadweg({ highway: 'cycleway', cycleway: 'crossing' }), istRadweg({ highway: 'footway' })]).toEqual([true, true, false, false])
    expect(veloVorgabe({ 'cycleway:left': 'lane' }, 'tertiary', true, null)[0]).toBe('radstreifen')
    expect(veloVorgabe({ 'cycleway:left': 'lane' }, 'tertiary', false, null)[0]).toBe('misch')
    expect(veloVorgabe({ 'cycleway:right': 'track' }, 'tertiary', false, null)[0]).toBe('radweg')
    expect(veloVorgabe({ bicycle: 'no' }, 'tertiary', true, null)[0]).toBe('kein')
    expect(veloVorgabe({}, 'motorway', true, null)[0]).toBe('kein')
    expect(veloVorgabe({}, 'residential', true, null)).toEqual(['misch', 'ohne Veloanlage in OSM'])
  })
})

describe('E3b: Veloachse und Strahlensatz am T-Knoten', () => {
  it('Mischverkehr: Veloachse 0,50 m vom Rand (y −2,5); Gebäudeecke: Velo 19,31 m < 25 m nicht erfüllt, Auto 24,69 m', () => {
    const e = rechne(osm(), [fahrbahn, ecke])
    const l = seite(e, 'links')
    expect(l.veloFuehrung).toBe('misch')
    expect(l.velo!.randAbstand).toBeCloseTo(0.5, 6)
    nahe(l.velo!.K, 1.25, -2.5)
    nahe(l.velo!.sichtpunkte[10], 1.25 - 10, -2.5)
    expect(l.velo!.vorhanden).toBeCloseTo(19.3125, 2)
    expect(l.vorhanden).toBeCloseTo(24.6875, 2)
    expect(l.velo!.vorhanden).toBeLessThan(l.vorhanden)             // näher am Rand = kürzere Sicht
    expect([l.velo!.A, l.velo!.status, l.status]).toEqual([25, 'nicht_erfuellt', 'massgebend'])
    expect([l.gesamt, l.gesamtFehlt]).toEqual(['nicht_erfuellt', ['Velo']])
    // nach rechts frei: Velo auf der fernen Seite y = +2,5, erfüllt
    const r = seite(e, 'rechts')
    nahe(r.velo!.K, 1.25, 2.5)
    expect([r.velo!.status, r.gesamt]).toEqual(['erfuellt', 'erfuellt'])
    expect(e.annahmen.join(' | ')).toContain('Velos fahren hier im Mischverkehr, 0,50 m vom rechten Fahrbahnrand (VSS 40 273 Ziffer 10 und 13.3')
  })
  it('Radstreifen (OSM cycleway=lane): Velo 0,75 m vom Rand (20,66 m), Autoachse 1,50 m neben dem Streifen (32,75 m)', () => {
    const e = rechne(osm({ cycleway: 'lane' }), [fahrbahn, ecke])
    const l = seite(e, 'links')
    expect([l.veloFuehrung, l.veloVorgabe, l.veloGewaehlt]).toEqual(['radstreifen', 'radstreifen', false])
    expect(l.velo!.randAbstand).toBeCloseTo(0.75, 6)
    nahe(l.velo!.K, 1.25, -2.25)
    expect(l.velo!.vorhanden).toBeCloseTo(20.65625, 2)
    expect(l.randAbstand).toBeCloseTo(3, 6)
    nahe(l.K, 1.25, 0)
    expect(l.vorhanden).toBeCloseTo(32.75, 2)
    expect(l.lageQuelle).toContain('Radstreifen 1,50 m (Annahme)')
    // von Hand Mischverkehr gewählt: Autoachse zurück auf d 1,50 m
    const m = rechne(osm({ cycleway: 'lane' }), [fahrbahn, ecke], { eingaben: eg({ velo: { links: 'misch', rechts: null } }) })
    expect([seite(m, 'links').veloGewaehlt, seite(m, 'links').randAbstand, seite(m, 'rechts').veloFuehrung]).toEqual([true, 1.5, 'radstreifen'])
  })
  it('kein Veloverkehr: keine Velo-Prüfung, Gesamtstatus = Auto', () => {
    const e = rechne(osm(), [fahrbahn, ecke], { eingaben: eg({ velo: { links: 'kein', rechts: 'kein' } }) })
    expect(seite(e, 'links').velo).toBeNull()
    expect([seite(e, 'links').gesamt, seite(e, 'links').gesamtFehlt]).toEqual(['massgebend', []])
  })
  it('Massnahmen berücksichtigen den Velo-Teil: Haltelinie (Velo braucht D näher), Tempo senken ohne Wirkung bis 30 km/h', () => {
    // nur Velo nicht erfüllt -> Massnahmen; Haltelinie: Velo bei b: s = 0,5 + 10,75 (b + 0,5) / (b − 1) ... b = 1,50 m:
    // s = 0,5 + 10,75 · 2 / 0,5 = 43,5 m ≥ 25 m; erste Stufe mit Velo ≥ 25 m: b = 2,75 m (s = 0,5 + 10,75 · 3,25 / 1,75 = 20,46 m)
    // reicht nicht; b = 2,50 m: s = 0,5 + 10,75 · 3 / 1,5 = 22,0 m; b = 2,25: s = 0,5 + 10,75 · 2,75 / 1,25 = 24,15 m; b = 2,00: 0,5 + 10,75 · 2,5 = 27,375 m
    const e = rechne(osm(), [fahrbahn, ecke])
    expect(e.massnahmen).not.toBeNull()
    const m2 = e.massnahmen!.find(m => m.nr === 2)!
    expect(m2.reicht).toBe(true)
    expect(m2.zeilen[0].text).toMatch(/^Haltelinie 1,00 m vorverlegt, D 2,00 m hinter der Kante: links \d+,\d m \(erforderlich 20 m\), Velo 27,[34] m \(erforderlich 25 m\)/)
    expect(e.massnahmen!.find(m => m.nr === 5)!.reicht).toBe(false)
    expect(e.massnahmen!.find(m => m.nr === 4)!.text).toBe('Nicht anwendbar: nach links nicht ausreichend.')
  })
})

describe('E3b: Prüfrunde, Massnahmen-Varianten der Veloachse', () => {
  // Parkfeld von Hand y −3 … −0,3 (2,7 m breit, breiter als der Abzug 1,90 m): die Veloachse (y −0,6 neben dem Parkstreifen)
  // läuft hindurch; es zählt für die Velo-Sicht nicht, auch nicht in den Varianten der Massnahmen.
  const pf: Hindernis = { id: 'pf', art: 'parkfeld', klasse: 'auto', quelle: 'hand', name: 'Parkfeld breit',
    ring: [lv(-60, -3), lv(-10, -3), lv(-10, -0.3), lv(-60, -0.3)] }
  it('Basis und Varianten gleich: Velo ohne das durchquerte Parkfeld', () => {
    const e = rechne(osm(), [fahrbahn, ecke], { hindernisse: { hindernisse: [pf], verworfen: [], park: null, baeume: null } })
    const l = seite(e, 'links')
    expect(l.velo!.ohneFlaechen).toEqual(['pf'])
    expect(l.velo!.hinweise.join(' ')).toContain('läuft bis A durch «Parkfeld breit»')
    const m2 = e.massnahmen?.find(m => m.nr === 2)
    if (m2?.zeilen[0]) {
      const velo = Number(/Velo (\d+),(\d) m/.exec(m2.zeilen[0].text)!.slice(1).join('.'))
      expect(velo).toBeGreaterThanOrEqual(Math.floor(l.velo!.vorhanden * 10) / 10 - 0.05)
    }
  })
  it('Tempo senken mit V85 von Hand über der zulässigen: Tab. 3 nach höchstens der zulässigen Höchstgeschwindigkeit', () => {
    const e = rechne(osm(), [fahrbahn, ecke], { eingaben: eg({ tempo: { links: { art: 'v85', wert: 45, begruendung: '' }, rechts: null } }) })
    const z = e.massnahmen!.find(m => m.nr === 5)!.zeilen.find(x => x.text.startsWith('nach links bei 40'))!
    expect(z.text).toContain('Velo erforderlich 25 m')
  })
})

describe('E3b: Radweg (Ziffer 12, Abb. 2)', () => {
  // Radweg (OSM highway=cycleway) entlang y = −4,5, Breite 2,00 m angenommen: innerer Rand y −3,5 (0,50 m vom Fahrbahnrand, näher
  // als 2,00 m), Aussenkante y −5,5 -> B ab der Aussenkante: Dachse (1,25; −8,5), D (0,75; −8,5). Veloachse = Radwegachse y −4,5.
  // Gebäudeecke C2 = (−10; −7): Sichtlinie D–C2 (−10,75; 1,5) bis y −4,5 (dy 4): x = 0,75 − 28,667 = −27,917, s = 29,17 m ≥ 25 m.
  const radweg = weg(50, [[51, -200, -4.5], [52, 200, -4.5]], { highway: 'cycleway' })
  const ecke2 = flaeche('Gebaeude', [lv(-10, -7), lv(-30, -7), lv(-30, -24), lv(-10, -24), lv(-10, -7)])
  it('Radweg aus OSM: Veloachse auf der Radwegachse, B ab der Aussenkante, Strahlensatz', () => {
    const e = rechne(osm({}, [radweg]), [fahrbahn, ecke2])
    const l = seite(e, 'links')
    expect(l.veloFuehrung).toBe('radweg')
    expect(l.velo!.radweg).toMatchObject({ id: 50, eigeneSeite: true, breite: 2, breiteOsm: false })
    expect(l.velo!.radweg!.abstand).toBeCloseTo(0.5, 1)
    nahe(l.velo!.K, 1.25, -4.5)
    expect(e.nullpunktText).toBe('Aussenkante des Radwegs')
    nahe(e.nullpunkt, 1.25, -5.5)
    nahe(e.D, 0.75, -8.5)
    nahe(e.radwegRand!, 1.25, -5.5)
    expect(l.velo!.vorhanden).toBeCloseTo(0.5 + 10.75 * 4 / 1.5, 1)
    expect(l.velo!.status).toBe('erfuellt')
    expect(e.annahmen.join(' | ')).toContain('näher als 2,00 m: das Fahrzeug wartet vor dem Radweg, B zählt ab seiner Aussenkante')
    // nach rechts: derselbe Radweg in beiden Richtungen (ohne oneway) auf der Gegenseite des Verkehrs von rechts
    const r = seite(e, 'rechts')
    expect(r.velo!.radweg).toMatchObject({ id: 50, eigeneSeite: false, zweiRichtungen: true })
    nahe(r.velo!.K, 1.25, -4.5)
  })
  it('Radweg mit oneway=yes: nach rechts nur auf der eigenen Seite gesucht -> Mischverkehr', () => {
    const e = rechne(osm({}, [{ ...radweg, tags: { highway: 'cycleway', oneway: 'yes' } }]), [fahrbahn])
    expect([seite(e, 'links').veloFuehrung, seite(e, 'rechts').veloFuehrung]).toEqual(['radweg', 'misch'])
  })
  it('Radweg 3 m neben dem Rand (nicht näher als 2,00 m): B ab der Kante', () => {
    const fern = weg(50, [[51, -200, -7], [52, 200, -7]], { highway: 'cycleway' })      // innerer Rand y −6: 3 m
    const e = rechne(osm({}, [fern]), [fahrbahn])
    expect(seite(e, 'links').velo!.radweg!.abstand).toBeCloseTo(3, 1)
    expect(e.nullpunktText).toBe('Kante des Fahrstreifens mit Vortritt')
    nahe(e.D, 0.75, -6)
    expect(e.radwegRand).toBeNull()
  })
  it('Prüfrunde: Ziffer 12 hängt an der Lage des Radwegs, nicht an der Veloführung (Mischverkehr gewählt: B trotzdem ab y −5,5, Hinweis)', () => {
    const e = rechne(osm({}, [radweg]), [fahrbahn], { eingaben: eg({ velo: { links: 'misch', rechts: 'kein' } }) })
    nahe(e.D, 0.75, -8.5)
    expect(e.hinweise.join(' ')).toContain('obwohl nach links «Mischverkehr» gilt')
  })
  it('Prüfrunde: Radweg endet vor der Zufahrt (x ≤ −6): keine Verlängerung, B ab der Kante, Hinweis', () => {
    const kurz = weg(50, [[51, -200, -4.5], [52, -6, -4.5]], { highway: 'cycleway' })
    const e = rechne(osm({}, [kurz]), [fahrbahn])
    nahe(e.D, 0.75, -6)
    expect(e.hinweise.join(' ')).toContain('reicht nicht bis an die Zufahrt')
  })
  it('Radweg von Hand ohne OSM-Linie: 2,00 m direkt am Rand angenommen, Achse y −4, B ab y −5', () => {
    const e = rechne(osm(), [fahrbahn], { eingaben: eg({ velo: { links: 'radweg', rechts: null } }) })
    nahe(seite(e, 'links').velo!.K, 1.25, -4)
    nahe(e.D, 0.75, -8)
    expect(seite(e, 'links').velo!.lageText).toContain('ohne OSM-Linie')
  })
})

describe('E3b: Trottoir (Ziffer 13.2, Tab. 2)', () => {
  // Trottoir y = −5 … −3 durchgehend (Breite 2 m, Achse y = −4), Fahrbahn der Nebenstrasse ab y = −5. Trottoirhinterkante y −5,
  // D' = (0,75; −8) (3,00 m dahinter, Fahrersitz). Hecke an der Grundstücksgrenze 1 m hinter der Hinterkante: Linie y = −6 von
  // x = −30 bis −2 (Puffer 0,30 m beidseits, ohne Kappe: Ecke zur Zufahrt und zur Strasse (−2; −5,7)).
  // Nach links: Sichtlinie D'–(−2; −5,7): Richtung (−2,75; 2,3), bis y = −4 (dy 4): x = 0,75 − 2,75 · 4 / 2,3 = −4,033,
  // s = 1,25 + 4,033 = 5,28 m < 15 m (Tab. 2 bei 0 %): nicht erfüllt. Nach rechts frei: ≥ 15 m, erfüllt. Die Trottoirhinterkante
  // liegt in der Rechnung 0,025 m weiter hinten (Suchschritt 0,05 m wie E2b): D' y = −8,025, s = 0,5 + 2,75 · 4,025 / 2,325 = 5,26 m.
  const fbT = flaeche('Strasse_Weg', [lv(-200, -3), lv(200, -3), lv(200, 3), lv(-200, 3)])
  const neben = flaeche('Strasse_Weg', [lv(-2.5, -5), lv(2.5, -5), lv(2.5, -200), lv(-2.5, -200)])
  const trottoir = flaeche('Trottoir', [lv(-200, -5), lv(200, -5), lv(200, -3), lv(-200, -3)])
  const hecke: Hindernis = { id: 'h1', art: 'hecke', linie: [lv(-30, -6), lv(-2, -6)], sichtbehindernd: true, quelle: 'hand', name: 'Hecke' }
  const hg = { hindernisse: [hecke], verworfen: [], park: null, baeume: null }
  it('ohne Hecke: D\' 3 m hinter der Hinterkante, Achse in der Mitte (y −4), A 15 m, beide erfüllt', () => {
    const e = rechne(osm(), [fbT, neben, trottoir])
    const t = e.trottoirPruefung!
    nahe(t.D, 0.75, -8, 0.06)
    nahe(t.hinterkante, 1.25, -5, 0.06)
    expect(t.achseQuelle).toContain('Mitte der AV-Fläche Trottoir')
    const [l, r] = t.richtungen
    nahe(l.K, 1.25, -4, 0.06); nahe(r.K, 1.25, -4, 0.06)
    nahe(l.sichtpunkte[10], 1.25 - 10, -4, 0.06); nahe(r.sichtpunkte[10], 1.25 + 10, -4, 0.06)
    expect([l.A, l.status, r.A, r.status, l.text]).toEqual([15, 'erfuellt', 15, 'erfuellt', 'Tab. 2, Spalte ≥ 0 %'])
    expect(e.trottoirProfil.length).toBeGreaterThan(10)
    expect(e.annahmen.join(' | ')).toContain('Für die Sicht aufs Trottoir liegt das Auge D\' 3,00 m hinter der Trottoirhinterkante, am Fahrersitz ' +
      '(VSS 40 273 Ziffer 13.2, S. 8).')
  })
  it('Hecke 1 m hinter der Hinterkante: nach links 5,28 m < 15 m nicht erfüllt (Strahlensatz), Gesamtstatus nicht erfüllt', () => {
    const e = rechne(osm(), [fbT, neben, trottoir], { hindernisse: hg })
    const [l, r] = e.trottoirPruefung!.richtungen
    expect(l.vorhanden).toBeCloseTo(0.5 + 2.75 * 4.025 / 2.325, 1)
    expect([l.status, r.status]).toEqual(['nicht_erfuellt', 'erfuellt'])
    expect(l.verdecker?.name).toBe('Hecke')
    const sl = seite(e, 'links')
    expect(sl.gesamt).toBe('nicht_erfuellt')
    expect(sl.gesamtFehlt).toContain('Trottoir')
  })
  it('Neigung aus dem Trottoirprofil: links −i, rechts +i (Gehrichtung auf die Zufahrt zu); −5 % -> 20 m', () => {
    const m = { i: 5, quelle: 'swissALTI3D (swisstopo), Profil 60 m, 20 Punkte', laenge: 60, punkte: 20, hinweis: null }
    const e = rechne(osm(), [fbT, neben, trottoir], { hoehen: { trottoir: m } })
    const [l, r] = e.trottoirPruefung!.richtungen
    expect([l.neigung, l.A, r.neigung, r.A]).toEqual([-5, 20, 5, 15])
    expect(l.neigungQuelle).toContain('Trottoirachse')
    expect([l.neigungUnbekannt, r.neigungUnbekannt]).toEqual([false, false])
  })
  it('Neigung des Trottoirs unbekannt (Entscheid 31.10.2026): nach dem Laden ohne Messung Spalte ≤ −6 -> 30 m; lädt: 0 % -> 15 m', () => {
    // Höhenmodell geladen, Trottoir-Profil fehlt bzw. Dienst-Fehler: strengster Wert der Tab. 2
    for (const hoehen of [{}, { trottoir: neigungMessung(new Error('HTTP 500')) }]) {
      const e = rechne(osm(), [fbT, neben, trottoir], { hoehen })
      const [l, r] = e.trottoirPruefung!.richtungen
      expect([l.A, r.A, l.neigung, l.neigungUnbekannt, r.neigungUnbekannt]).toEqual([30, 30, 0, true, true])
      expect(l.text).toBe('Tab. 2, Spalte ≤ −6 % (Neigung unbekannt: strengster Wert)')
      expect(l.neigungQuelle).toContain('unbekannt, strengster Wert')
      expect(e.annahmen.join(' | ')).toContain('Längsneigung des Trottoirs in Gehrichtung auf die Zufahrt zu unbekannt (kein Höhenprofil): ' +
        'strengster Wert der Tab. 2 (Spalte ≤ −6 %) angenommen (Entscheid 31.10.2026)')
    }
    // Höhenmodell lädt noch: bisheriges Verhalten (vorerst 0 %)
    const n = rechne(osm(), [fbT, neben, trottoir])
    const [l] = n.trottoirPruefung!.richtungen
    expect([l.A, l.neigungUnbekannt, l.neigungQuelle]).toEqual([15, false, 'Höhenmodell lädt: vorerst 0 %'])
  })
  it('ohne Trottoir: keine Trottoirprüfung', () => {
    expect(rechne(osm(), [fahrbahn]).trottoirPruefung).toBeNull()
  })
})

describe('E3b: Velosymbol', () => {
  it('vier Teile (Räder, Rahmen, Lenker), Aussenmass 1,8 × 0,6 m, Vorderrad bei A', () => {
    const t = veloTeile([0, 0], [1, 0])
    expect(t).toHaveLength(4)
    const xs = t.flat().map(p => p[0]), ys = t.flat().map(p => p[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(VELO_LAENGE_M, 6)
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(VELO_BREITE_M, 6)
    const pts: P[] = [[0, 0], [1, 0], [2, 0], [3, 0]]
    const [m, u] = veloLage(pts, 3)!
    expect(u).toEqual([-1, 0])
    expect(m[0]).toBeCloseTo(3 + VELO_LAENGE_M / 2, 6)
  })
})

describe('E3b: Fall-Datei Version 4', () => {
  it('Veloführung und E-Bike-Häkchen hin und zurück; Version 3 ohne Velo weiter lesbar; ungültig -> Vorgabe, gemeldet', async () => {
    const { leererFall, fallLesen, fallSchreiben, eingabenZahl, FALL_VERSION } = await import('../fall')
    expect(FALL_VERSION).toBeGreaterThanOrEqual(4)
    const f = leererFall(46.95, 7.44, 12)
    f.eingaben = { ...f.eingaben, velo: { links: 'radweg', rechts: null }, ebikeVerboten: true }
    const [g, h] = fallLesen(fallSchreiben(f))
    expect(h).toEqual([])
    expect([g.eingaben.velo, g.eingaben.ebikeVerboten, eingabenZahl(g)]).toEqual([{ links: 'radweg', rechts: null }, true, 2])
    const roh = JSON.parse(fallSchreiben(leererFall(46.95, 7.44, 12)))
    const [v3, h3] = fallLesen(JSON.stringify({ ...roh, version: 3 }))
    expect(h3).toEqual([])
    expect([v3.eingaben.velo, v3.eingaben.ebikeVerboten]).toEqual([undefined, undefined])
    const [x, hx] = fallLesen(JSON.stringify({ ...roh, eingaben: { ...roh.eingaben, velo: { links: 'tandem', rechts: 'kein' }, ebikeVerboten: 'ja' } }))
    expect(x.eingaben.velo).toEqual({ links: null, rechts: 'kein' })
    expect(x.eingaben.ebikeVerboten).toBeUndefined()
    expect(hx).toEqual(['Eingabe «velo.links» ungültig, Vorgabe', 'Eingabe «ebikeVerboten» ungültig, Vorgabe'])
  })
})
