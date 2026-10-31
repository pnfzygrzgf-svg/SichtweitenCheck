// Tests E4: Velo gegen die Einbahn am T-Knoten aus velo.test.ts. Handlösungen im Kommentar.
//
// Lage (Meter, x Ost, y Nord, Ursprung = OSM-Knoten 12): Hauptstrasse West–Ost (Weg 1, von West nach Ost digitalisiert), Fahrbahn
// y = −3 … +3; Zufahrt Nebenstrasse von Süden (Weg 2, vom Knoten nach Süden digitalisiert), Fahrbahn x = −2,5 … +2,5, Kante y = −3.
// Hauptstrasse mit oneway=yes: von rechts (Osten) kommen keine Motorfahrzeuge (Einbahn vom Knoten weg). Velos gegen die Einbahn fahren
// nach Westen, auf der für sie rechten Seite = Norden = aus Sicht des Autoverkehrs (nach Osten) links: Mischverkehr y = +2,5,
// Gegenverkehrsstreifen (opposite_lane) y = +2,25. Ohne Eingaben D (0,75; −6). Gebäudeecke C = (10; −4) im Südosten.
// Strahlensatz D–C bis zur Achse y = a: s = x − 1,25 mit x = 0,75 + 9,25 · (a + 6) / 2.
//   a = 2,5: x = 40,0625, s = 38,8125 m; a = 2,25: x = 38,90625, s = 37,65625 m (A Velo 50 m über 30 km/h, Spalte 0).
// Zufahrt mit oneway=yes (Autos nach Süden): Velos gegen die Einbahn fahren nach Norden, rechts = Osten: Achse x = 2,5 − 0,5 = 2,0
// (Mischverkehr) bzw. 2,5 − 0,75 = 1,75 (opposite_lane); D auf der Achse 3,00 m hinter der Kante: (2,0; −6) bzw. (1,75; −6).

import { describe, expect, it } from 'vitest'
import { wgs, kreuz, sub, type P } from '../geo'
import type { OsmDaten, OsmWeg } from '../daten/osm'
import type { AvFlaeche } from '../daten/av'
import { rechneKnoten } from './rechnen'
import { veloGegenTag } from './netz'
import { veloVorgabe } from './velo'
import { berichtPunkte } from '../berichtbild'
import { KEINE_EINGABEN, type Ergebnis, type KnotenFall } from './typen'

const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const ll = (x: number, y: number): [number, number] => wgs(O[0] + x, O[1] + y)
const weg = (id: number, knoten: [number, number, number][], tags: Record<string, string>): OsmWeg =>
  ({ id, tags, knoten: knoten.map(k => k[0]), geom: knoten.map(k => ll(k[1], k[2])) })
const osm = (haupt: Record<string, string> = {}, neben: Record<string, string> = {}): OsmDaten => ({
  wege: [
    weg(1, [[10, -200, 0], [12, 0, 0], [13, 200, 0]], { highway: 'unclassified', name: 'Hauptstrasse', maxspeed: '50', ...haupt }),
    weg(2, [[12, 0, 0], [20, 0, -200]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30', ...neben }),
  ],
  tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [],
})
const flaeche = (art: string, ring: P[]): AvFlaeche => ({ art, kanton: 'BE', qualitaet: 'AV93', bfs: 351, ringe: [ring] })
const fahrbahn = flaeche('Strasse_Weg', [lv(-200, -3), lv(-2.5, -3), lv(-2.5, -200), lv(2.5, -200), lv(2.5, -3), lv(200, -3),
  lv(200, 3), lv(-200, 3), lv(-200, -3)])
const ecke = flaeche('Gebaeude', [lv(10, -4), lv(10, -24), lv(30, -24), lv(30, -4), lv(10, -4)])
const rechne = (o: OsmDaten, f: Partial<KnotenFall> = {}): Ergebnis => {
  const r = rechneKnoten(o, [fahrbahn, ecke], { knoten: 12, zufahrt: null, ...f })
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
/** Zufahrt Nebenstrasse (Weg 2, Arm vom Knoten nach Süden) */
const ZUFAHRT_NEBEN = '2:0:1'

describe('E4: Tags des Velos gegen die Einbahn', () => {
  it('oneway:bicycle=no, cycleway*=opposite*, cycleway:*:oneway gegen die Einbahn; ohne Einbahn bzw. mit bicycle=no keines', () => {
    expect(veloGegenTag({ oneway: 'yes', 'oneway:bicycle': 'no' }, 1)).toBe('oneway:bicycle=no')
    expect(veloGegenTag({ oneway: 'yes', cycleway: 'opposite_lane' }, 1)).toBe('cycleway=opposite_lane')
    expect(veloGegenTag({ oneway: 'yes', 'cycleway:left': 'opposite_track' }, 1)).toBe('cycleway:left=opposite_track')
    expect(veloGegenTag({ oneway: 'yes', cycleway: 'opposite' }, 1)).toBe('cycleway=opposite')
    expect(veloGegenTag({ oneway: 'yes', 'cycleway:left': 'lane', 'cycleway:left:oneway': '-1' }, 1)).toBe('cycleway:left:oneway=-1')
    expect(veloGegenTag({ oneway: '-1', 'cycleway:right': 'lane', 'cycleway:right:oneway': 'yes' }, -1)).toBe('cycleway:right:oneway=yes')
    expect(veloGegenTag({ oneway: 'yes', 'cycleway:right': 'lane', 'cycleway:right:oneway': 'yes' }, 1)).toBeNull()   // mit der Einbahn
    expect(veloGegenTag({ oneway: 'yes' }, 1)).toBeNull()
    expect(veloGegenTag({ 'oneway:bicycle': 'no' }, 0)).toBeNull()
    expect(veloGegenTag({ oneway: 'yes', 'oneway:bicycle': 'no', bicycle: 'no' }, 1)).toBeNull()
  })
  it('Veloführung gegen die Einbahn: Radstreifen bei opposite_lane, Radweg bei opposite_track, sonst Mischverkehr', () => {
    expect(veloVorgabe({ oneway: 'yes', cycleway: 'opposite_lane' }, 'residential', true, null, 'cycleway=opposite_lane'))
      .toEqual(['radstreifen', 'OSM cycleway=opposite_lane (Velo gegen die Einbahn)'])
    expect(veloVorgabe({ oneway: 'yes', cycleway: 'opposite_track' }, 'residential', true, null, 'cycleway=opposite_track')[0]).toBe('radweg')
    expect(veloVorgabe({ oneway: 'yes', 'cycleway:left': 'lane', 'cycleway:left:oneway': '-1' }, 'residential', true, null,
      'cycleway:left:oneway=-1')).toEqual(['radstreifen', 'OSM cycleway:left=lane; Velo gegen die Einbahn (OSM cycleway:left:oneway=-1)'])
    // cycleway=lane ohne Seite liegt in Fahrtrichtung der Einbahn: für die Velos gegen die Einbahn Mischverkehr
    expect(veloVorgabe({ oneway: 'yes', cycleway: 'lane', 'oneway:bicycle': 'no' }, 'residential', true, null, 'oneway:bicycle=no')[0]).toBe('misch')
  })
  it('Arm: veloZufluss mit Quelle; ohne Einbahn vom Knoten weg wie zufluss', () => {
    const r = rechneKnoten(osm({ oneway: 'yes', 'oneway:bicycle': 'no' }), [fahrbahn], { knoten: 12, zufahrt: null })
    const arme = r.knoten!.arme
    const ost = arme.find(a => a.key === '1:1:1')!, west = arme.find(a => a.key === '1:1:-1')!, sued = arme.find(a => a.key === ZUFAHRT_NEBEN)!
    expect([ost.zufluss, ost.veloZufluss, ost.veloZuflussQuelle]).toEqual([false, true, 'oneway:bicycle=no'])
    expect([west.zufluss, west.veloZufluss, west.veloZuflussQuelle]).toEqual([true, true, ''])
    expect([sued.zufluss, sued.veloZufluss]).toEqual([true, true])
  })
})

describe('E4: Hauptarm mit Einbahn vom Knoten weg und Velo gegen die Einbahn', () => {
  it('oneway:bicycle=no: Auto keine_zufahrt «nur Velos», Velo nach Tab. 3 auf der linken Seite aus Sicht des Autoverkehrs (y +2,5)', () => {
    const e = rechne(osm({ oneway: 'yes', 'oneway:bicycle': 'no' }))
    const r = seite(e, 'rechts')
    expect(r.status).toBe('keine_zufahrt')
    expect(r.veloGegen).toBe('oneway:bicycle=no')
    expect(r.keinGrund).toContain('nur Velos')
    expect(r.hinweise).toContain('Einbahn vom Knoten weg: von dieser Seite kommen nur Velos (OSM oneway:bicycle=no).')
    expect(r.achse).toEqual([])                                      // kein F_A, keine Autoachse
    expect([r.veloFuehrung, r.veloVorgabe]).toEqual(['misch', 'misch'])
    expect(r.veloVorgabeQuelle).toContain('Velo gegen die Einbahn (OSM oneway:bicycle=no)')
    const v = r.velo!
    nahe(v.K, 1.25, 2.5)
    nahe(v.sichtpunkte[10], 11.25, 2.5)
    // Seite: Autoverkehr fährt nach Osten (u = +x); die Veloachse liegt links davon (Norden)
    expect(kreuz([1, 0], sub(v.sichtpunkte[10], lv(0, 0)))).toBeGreaterThan(0)
    expect(v.lageText).toContain('aus Sicht des Autoverkehrs linken Fahrbahnrand')
    expect(v.A).toBe(50)
    expect(v.vorhanden).toBeCloseTo(38.8125, 2)
    expect([v.status, r.gesamt, r.gesamtFehlt]).toEqual(['nicht_erfuellt', 'nicht_erfuellt', ['Velo']])
    // Profil der Längsneigung auf der Veloachse
    expect(r.profilLinie.length).toBeGreaterThan(1)
    nahe(r.profilLinie[0], 1.25, 2.5)
    expect(r.neigungQuelle).not.toContain('kein Verkehr')
    expect(e.annahmen.join(' | ')).toContain('Von rechts kommen nur Velos (Einbahn vom Knoten weg, OSM oneway:bicycle=no)')
    // von links normal: Motorfahrzeuge und Velo
    const l = seite(e, 'links')
    expect(l.status).not.toBe('keine_zufahrt')
    expect(l.veloGegen).toBeUndefined()
    // Massnahmen: die Richtung «nur Velo» zählt mit
    const m = e.massnahmen!
    expect(m).not.toBeNull()
    const tempo = m.find(x => x.nr === 5)!
    expect(tempo.zeilen.map(z => z.text).join(' | ')).toContain('nach rechts bei 30 km/h statt 50: Velo erforderlich 25 m')
    expect(tempo.reicht).toBe(true)
    expect(m.find(x => x.nr === 2)!.zeilen[0].text).toContain('rechts nur Velo')
    // Berichtsbild: Velo und Sichtdreieck der Richtung «nur Velo» im Ausschnitt
    expect(berichtPunkte(e).some(p => Math.abs(rel(p)[0] - 40) < 2 && Math.abs(rel(p)[1] - 2.5) < 1)).toBe(true)
  })
  it('cycleway=opposite_lane: Vorgabe Radstreifen, Achse in der Mitte des Gegenverkehrsstreifens (y +2,25), 37,66 m', () => {
    const e = rechne(osm({ oneway: 'yes', cycleway: 'opposite_lane' }))
    const r = seite(e, 'rechts')
    expect([r.status, r.veloGegen, r.veloFuehrung, r.veloVorgabe]).toEqual(['keine_zufahrt', 'cycleway=opposite_lane', 'radstreifen', 'radstreifen'])
    expect(r.veloVorgabeQuelle).toBe('OSM cycleway=opposite_lane (Velo gegen die Einbahn)')
    nahe(r.velo!.K, 1.25, 2.25)
    expect(r.velo!.randAbstand).toBeCloseTo(0.75, 6)
    expect(r.velo!.lageText).toContain('Mitte des Gegenverkehrsstreifens')
    expect(r.velo!.vorhanden).toBeCloseTo(37.65625, 2)
  })
  it('Veloführung von Hand bleibt wählbar: Mischverkehr statt Radstreifen, «kein Veloverkehr» ohne Prüfung', () => {
    const e = rechne(osm({ oneway: 'yes', cycleway: 'opposite_lane' }), { eingaben: { ...KEINE_EINGABEN, velo: { links: null, rechts: 'misch' } } })
    const r = seite(e, 'rechts')
    expect([r.veloFuehrung, r.veloVorgabe, r.veloGewaehlt]).toEqual(['misch', 'radstreifen', true])
    nahe(r.velo!.K, 1.25, 2.5)
    const k = seite(rechne(osm({ oneway: 'yes', cycleway: 'opposite_lane' }), { eingaben: { ...KEINE_EINGABEN, velo: { links: null, rechts: 'kein' } } }), 'rechts')
    expect([k.status, k.velo, k.gesamt]).toEqual(['keine_zufahrt', null, 'keine_zufahrt'])
  })
  it('Einbahn ohne Velotags: unverändert keine_zufahrt, velo null, ohne Profil', () => {
    const e = rechne(osm({ oneway: 'yes' }))
    const r = seite(e, 'rechts')
    expect([r.status, r.velo, r.veloGegen, r.gesamt, r.keinGrund]).toEqual(['keine_zufahrt', null, undefined, 'keine_zufahrt', undefined])
    expect(r.hinweise).toContain('Einbahn vom Knoten weg: von dieser Seite kommt kein Verkehr.')
    expect(r.profilLinie).toEqual([])
    expect(e.massnahmen).toBeNull()
  })
})

describe('E4: Zufahrt mit Einbahn vom Knoten weg und Velo gegen die Einbahn', () => {
  it('oneway:bicycle=no: D auf der Veloachse 0,50 m vom für das Velo rechten Rand (2,0; −6), F_B als Velo', () => {
    const e = rechne(osm({}, { oneway: 'yes', 'oneway:bicycle': 'no' }), { zufahrt: ZUFAHRT_NEBEN })
    expect(e.zufahrtVelo).toMatchObject({ quelle: 'oneway:bicycle=no', fuehrung: 'misch' })
    nahe(e.D, 2.0, -6)
    nahe(e.Dachse, 2.0, -6)
    expect(e.Dlage.seitlich).toBe(0)
    // Wortlaut des Auftraggebers (Korrektur 31.10.2026, Punkt 2)
    expect(e.hinweise).toContain('Die Zufahrt ist eine Einbahn vom Knoten weg. Vortrittsbelastet sind nur die Velos im Gegenverkehr ' +
      '(OSM oneway:bicycle=no).')
    expect(e.hinweise.join(' | ')).not.toContain('Gerechnet wird trotzdem')
    // Velo gegen die Einbahn in den Annahmen nur einmal, im Thema «Wartendes Velo» (Korrektur 31.10.2026, Punkt 7)
    const t = e.annahmen.join(' | ')
    expect(t).toContain('Wartendes Velo: ')
    expect(t).toContain('Auf dieser Zufahrt dürfen Velos gegen die Einbahn zum Knoten fahren (OSM oneway:bicycle=no). Die App prüft darum ' +
      'die Sicht aus der Lage eines solchen Velos: 0,50 m vom für das Velo rechten Fahrbahnrand, das Auge des Velofahrers über dieser Linie.')
    expect(t.match(/gegen die Einbahn/g)).toHaveLength(1)
    expect(t.match(/oneway:bicycle/g)).toHaveLength(1)
    expect(e.annahmenThemen!.filter(x => /Velo/.test(x.text) && /Einbahn/.test(x.text)).map(x => x.thema)).toEqual(['wartend'])
    // technische Lage der Achse nur in der Herleitung
    expect(e.zufahrtLageQuelle).toContain('Achse des Velogegenverkehrs')
    expect(e.herleitung![0]).toContain('Achse des Velogegenverkehrs')
    expect(t).not.toContain('Achse des Velogegenverkehrs')
    // beide Richtungen der Hauptstrasse gerechnet wie sonst (Auto und Velo von D aus)
    expect(e.richtungen.every(r => r.status !== 'keine_zufahrt' && r.velo)).toBe(true)
  })
  it('cycleway=opposite_lane: D in der Mitte des Gegenverkehrsstreifens (1,75; −6); Massnahmen mit D auf der Veloachse', () => {
    const e = rechne(osm({}, { oneway: 'yes', cycleway: 'opposite_lane' }), { zufahrt: ZUFAHRT_NEBEN })
    expect(e.zufahrtVelo).toMatchObject({ quelle: 'cycleway=opposite_lane', fuehrung: 'radstreifen' })
    nahe(e.D, 1.75, -6)
    expect(e.zufahrtVelo!.lageText).toContain('Mitte des Gegenverkehrsstreifens')
  })
  it('Einbahn ohne Velotags: unverändert («Gerechnet wird trotzdem»), D am Fahrersitz der Einbahn-Mitte', () => {
    const e = rechne(osm({}, { oneway: 'yes' }), { zufahrt: ZUFAHRT_NEBEN })
    expect(e.zufahrtVelo).toBeNull()
    expect(e.hinweise.join(' | ')).toContain('Gerechnet wird trotzdem')
    nahe(e.Dachse, 0, -6)
    nahe(e.D, -0.5, -6)
  })
})

// Rechtsvortritt (Teil E): B 5,00 m ab dem Rand des rechten Arms (y −3), D also bei y −8; Tempo 30 km/h, Velo nach Tab. 3 bis 30 km/h.
// Velo gegen die Einbahn auf dem rechten Arm (Hauptstrasse nach Osten, opposite_lane, y +2,25), Gebäudeecke C = (10; −4), D (0,75; −8):
// x = 0,75 + 9,25 · (2,25 + 8) / 4 = 24,453125, s = 23,203125 m < 25 m.
describe('E4: Velo gegen die Einbahn beim Rechtsvortritt', () => {
  // Tempo 30 von Hand (OSM Hauptstrasse 50): seit Punkt 24 (31.10.2026) gilt beim Rechtsvortritt das Tempo der Strasse für die Velos
  const rv = { eingaben: { ...KEINE_EINGABEN, regelung: 'rechtsvortritt' as const,
    tempo: { links: null, rechts: { art: 'signalisiert' as const, wert: 30, begruendung: '' } } } }
  it('Zufahrt nur Velos gegen die Einbahn: Prüfung nach Teil E gegen den Arm rechts, D auf der Veloachse 5,00 m hinter dem Rand', () => {
    const e = rechne(osm({}, { oneway: 'yes', 'oneway:bicycle': 'no' }), { zufahrt: ZUFAHRT_NEBEN, ...rv })
    expect(e.zufahrtVelo).toMatchObject({ quelle: 'oneway:bicycle=no' })
    nahe(e.D, 2.0, -8)
    expect(e.rechtsvortritt!.arm.status).not.toBe('keine')
    expect(e.rechtsvortritt!.arm.rechts).toBe('1:1:1')
    const r = seite(e, 'rechts')
    expect([r.status !== 'keine_zufahrt', r.rv, r.velo?.tempo]).toEqual([true, true, 30])
    expect(seite(e, 'links').keinGrund).toContain('muss dieser Zufahrt den Vortritt lassen')
    expect(e.hinweise).toContain('Die Zufahrt ist eine Einbahn vom Knoten weg. Vortrittsbelastet sind nur die Velos im Gegenverkehr ' +
      '(OSM oneway:bicycle=no).')
    expect(e.annahmen.join(' | ').match(/gegen die Einbahn/g)).toHaveLength(1)
  })
  it('Arm rechts nur Velos gegen die Einbahn: Velo von rechts nach Tab. 3 mit 30 km/h, 23,20 m < 25 m nicht erfüllt', () => {
    const e = rechne(osm({ oneway: 'yes', cycleway: 'opposite_lane' }), { zufahrt: ZUFAHRT_NEBEN, ...rv })
    expect(e.zufahrtVelo).toBeNull()
    nahe(e.D, 0.75, -8)
    const a = e.rechtsvortritt!.arm
    expect(a.status).toBe('keine')
    expect(a.grund).toContain('von rechts kommen nur Velos (OSM cycleway=opposite_lane), geprüft nach Tab. 3')
    expect(a.nurVelo).toBe('cycleway=opposite_lane')
    const r = seite(e, 'rechts')
    expect([r.status, r.veloGegen, r.veloFuehrung]).toEqual(['keine_zufahrt', 'cycleway=opposite_lane', 'radstreifen'])
    nahe(r.velo!.K, 1.25, 2.25)
    expect([r.velo!.A, r.velo!.tempo]).toEqual([25, 30])
    expect(r.velo!.vorhanden).toBeCloseTo(23.203125, 2)
    expect([r.gesamt, r.gesamtFehlt]).toEqual(['nicht_erfuellt', ['Velo']])
    expect(e.massnahmen).not.toBeNull()
  })
  it('Arm rechts Einbahn ohne Velotags: unverändert keine Prüfung, kein Verkehr von rechts', () => {
    const e = rechne(osm({ oneway: 'yes' }), { zufahrt: ZUFAHRT_NEBEN, ...rv })
    expect(e.rechtsvortritt!.arm.grund).toContain('kein Verkehr von rechts')
    const r = seite(e, 'rechts')
    expect([r.status, r.velo, r.gesamt]).toEqual(['keine_zufahrt', null, 'keine_zufahrt'])
  })
})
