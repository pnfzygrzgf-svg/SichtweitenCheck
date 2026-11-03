// Tests K1 «Kreisel erkennen und vermessen», E9 (Form statt Kreis), E10 (Bypass), K2 (Einfahrt, K, D) und K3 (Ablenkungswinkel):
// synthetische Kreisel (vier und drei Arme, getrennte Ein- und Ausfahrt, Bypass, Tram über den Ring und durch die Insel, Oval, Klein-
// und Minikreisel, ohne Insel, ohne AV, Mündung mit Ausrundung) mit Handlösungen und der echte Kreisel Sandrainstrasse Bern (Ringpunkt
// OSM 11365036791).
// Synthetisch: Ring als geschlossener Weg im Gegenuhrzeigersinn, Punkte je 10° auf dem Kreis rOsm um O (Punkt-Id 1000 + Winkel/10);
// AV-Fahrbahn = Kreisring zwischen Insel und Aussenrand plus je Arm ein Rechteck nach aussen.
// Sandrain, Eigerplatz, Dalmazibrücke und 1723270017 (Schwarzenburgstrasse): Daten in testdaten/ (© OpenStreetMap-Mitwirkende, ODbL; AV Kanton Bern über geodienste.ch), abgerufen am
// 01.11.2026.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { wgs, lv95, add, dist, type P } from '../geo'
import { osmParsen, kreiselMitten, overpassAbfrage, KREISEL_TAG, type OsmDaten, type OsmWeg } from '../daten/osm'
import { avParsen, type AvFlaeche, type GeoJson } from '../daten/av'
import { OsmNetz, abschneiden, streckeLaenge } from './netz'
import { Fahrbahn } from './flaechen'
import { knotenArt, knotenFinden, keineKnoten, nachNr } from './knoten'
import { rechneKnoten } from './rechnen'
import { kreiselKnoten, ringWege, kreiselTypVorgabe, kreiselAusserhalb, innenringVorschlag, profilWert, KREISEL_EINFAHRT_TEXT,
  KREISEL_BREITE_OHNE_AV_M, INNENRING_AB_M, KREISEL_ARM_GRAD, BYPASS_M, VELOBYPASS_ARM_M, VELOBYPASS_MIN_LAENGE_M,
  VELOBYPASS_ENDE_AUSSEN_M } from './kreisel'
import { HILFSLINIE_M } from './kreiselfahrt'
import { kreiselA, AZ_LU, DURCHSICHT_TEXT } from './kreiselsicht'
import { kreiselAuszug } from '../fall'
import { kreiselFahrzeug, faLage, veloLage, PW_LAENGE_M, VELO_LAENGE_M } from './fahrzeug'
import type { KnotenInfo } from './typen'
import type { Hindernis } from './hindernisse'

const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const ll = (x: number, y: number): [number, number] => wgs(O[0] + x, O[1] + y)
const pol = (r: number, grad: number): [number, number] => [r * Math.cos(grad * Math.PI / 180), r * Math.sin(grad * Math.PI / 180)]
const weg = (id: number, knoten: [number, number, number][], tags: Record<string, string>): OsmWeg =>
  ({ id, tags, knoten: knoten.map(k => k[0]), geom: knoten.map(k => ll(k[1], k[2])) })
const ringId = (grad: number) => 1000 + ((grad % 360) + 360) % 360 / 10
const ringPunkt = (r: number, grad: number): [number, number, number] => [ringId(grad), ...pol(r, grad)]
/** Ring als geschlossener Weg im Gegenuhrzeigersinn (OSM: junction=roundabout, Einbahn in Digitalisierrichtung) */
const ring = (r: number, tags: Record<string, string> = {}): OsmWeg =>
  weg(1, [...Array.from({ length: 36 }, (_, k) => ringPunkt(r, k * 10)), ringPunkt(r, 0)], { highway: 'residential', junction: 'roundabout', ...tags })
/** Arm mit Gegenverkehr am Ringpunkt bei grad, 80 m nach aussen */
const arm = (id: number, r: number, grad: number, name: string): OsmWeg =>
  weg(id, [ringPunkt(r, grad), [id * 10, ...pol(r + 80, grad)]], { highway: 'residential', name })
/** Arm mit getrennter Ein- und Ausfahrt um eine Leitinsel: Teilungspunkt 18 m ausserhalb des Rings bei grad, Einfahrt zum Ringpunkt bei
 *  grad + 20° (links vom Arm, von der Mitte aus), Ausfahrt vom Ringpunkt bei grad − 20° */
const armGetrennt = (id: number, r: number, grad: number, name: string): OsmWeg[] => {
  const t: [number, number, number] = [id * 10, ...pol(r + 18, grad)]
  return [
    weg(id, [t, [id * 10 + 1, ...pol(r + 80, grad)]], { highway: 'residential', name }),
    weg(id + 1, [t, ringPunkt(r, grad + 20)], { highway: 'residential', name, oneway: 'yes' }),
    weg(id + 2, [ringPunkt(r, grad - 20), t], { highway: 'residential', name, oneway: 'yes' }),
  ]
}
const daten = (wege: OsmWeg[], mehr: Partial<OsmDaten> = {}): OsmDaten =>
  ({ wege, tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [], ...mehr })
const kreis = (r: number, n = 120): P[] => Array.from({ length: n + 1 }, (_, k) => lv(...pol(r, k * 360 / n)))
const flaeche = (art: string, ringe: P[][]): AvFlaeche => ({ art, kanton: 'BE', qualitaet: 'AV93', bfs: 351, ringe })
/** AV-Fahrbahn: Kreisring (inselR 0: Scheibe) und je Arm ein 7 m breites Rechteck vom Aussenrand nach aussen */
const fahrbahn = (aussenR: number, inselR: number, armGrad: number[]): AvFlaeche[] => [
  flaeche('Strasse_Weg', inselR > 0 ? [kreis(aussenR), [...kreis(inselR)].reverse()] : [kreis(aussenR)]),
  ...armGrad.map(g => {
    const r: P = pol(1, g), q: P = [-r[1], r[0]]
    const a = add(add(lv(0, 0), r, aussenR - 1), q, -3.5), b = add(a, q, 7), c = add(b, r, 80), d = add(a, r, 80)
    return flaeche('Strasse_Weg', [[a, b, c, d, a]])
  }),
]
const knoten = (o: OsmDaten, av: AvFlaeche[], n = ringId(0), typ: 'klein' | 'mini' | null = null, zufahrt: string | null = null,
  bez: Record<string, boolean> | null = null): KnotenInfo => kreiselKnoten(new OsmNetz(o), new Fahrbahn(av), n, typ, zufahrt, bez, o.querungen)!
const gon = (grad: number) => grad * 400 / 360

describe('K1: Kreisel als ein Knoten', () => {
  const R = 12.5   // OSM-Linie in der Fahrbahnmitte (Insel 8, Aussenrand 17)
  const vier = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 270, 'Südstrasse'), arm(5, R, 180, 'Weststrasse')])
  const av4 = fahrbahn(17, 8, [90, 0, 270, 180])
  it('jeder Ringpunkt ist «kreisel», kein gewöhnlicher Knoten und nicht ausgeblendet; Kennung = kleinster Ringpunkt', () => {
    const netz = new OsmNetz(vier)
    for (const n of [ringId(0), ringId(90), ringId(40)]) expect(knotenArt(netz, n)).toBe('kreisel')
    expect(knotenFinden(netz)).toEqual([])
    expect(keineKnoten(netz)).toEqual([])
    expect(ringWege(netz, ringId(90))).toEqual([1])
    expect(ringWege(netz, 20)).toEqual([])
    expect(knoten(vier, av4, ringId(130)).id).toBe(1000)
    expect(knoten(vier, av4, ringId(270)).id).toBe(1000)
  })
  it('vier Arme, nummeriert im Uhrzeigersinn ab Norden; Name aus den Armen', () => {
    const k = knoten(vier, av4)
    expect(k.arme).toEqual([])
    expect(nachNr(k.kreisel!.arme).map(a => [a.nr, a.name, a.himmel, a.getrennt])).toEqual([['1', 'Nordstrasse', 'Nord', false],
      ['2', 'Oststrasse', 'Ost', false], ['3', 'Südstrasse', 'Süd', false], ['4', 'Weststrasse', 'West', false]])
    const a = nachNr(k.kreisel!.arme)[0]
    expect([a.ein, a.aus]).toEqual(['2:0:1', '2:0:1'])
    expect(k.name).toBe('Nordstrasse / Oststrasse / Südstrasse / Weststrasse')
  })
  it('Vermessung aus der AV: Aussenrand, Insel, Breite, Kleinkreisel, Innenring 5,50 m innerhalb des Aussenrands', () => {
    const k = knoten(vier, av4).kreisel!, v = k.vermessung
    expect(v.quelle).toBe('av')
    expect(dist(v.mitte, O)).toBeLessThan(0.05)
    expect(v.aussenR).toBeCloseTo(17, 1)
    expect(v.inselR).toBeCloseTo(8, 1)
    expect(v.breite).toBeCloseTo(9, 1)
    expect(v.durchmesser).toBeCloseTo(34, 1)
    expect(v.innenringR!).toBeCloseTo(17 - INNENRING_AB_M, 1)
    expect([k.typ, k.typVorgabe, k.typGewaehlt, k.ausserhalb]).toEqual(['klein', 'klein', false, null])
    expect(v.strahlen).toBeGreaterThan(200)
  })
  it('Mitte der AV statt der OSM-Linie (OSM 1 m verschoben)', () => {
    const v = knoten(vier, fahrbahn(17, 8, [90, 0, 270, 180]).map(f => ({ ...f, ringe: f.ringe.map(r => r.map(p => add(p, [1, 0]))) })))
      .kreisel!.vermessung
    expect(dist(v.mitte, lv(1, 0))).toBeLessThan(0.05)
    expect(v.aussenR).toBeCloseTo(17, 1)
  })
})

describe('K1: Arme am Kreisel', () => {
  const R = 12.5
  const av = fahrbahn(17, 8, [90, 0, 230])
  it('drei Arme, einer mit getrennter Ein- und Ausfahrt (Leitinsel): ein Arm mit beiden OSM-Armen', () => {
    const o = daten([ring(R), ...armGetrennt(2, R, 90, 'Nordstrasse'), arm(6, R, 0, 'Oststrasse'), arm(7, R, 230, 'Südweststrasse')])
    const ka = nachNr(knoten(o, av).kreisel!.arme)
    expect(ka.map(a => [a.nr, a.name, a.himmel])).toEqual([['1', 'Nordstrasse', 'Nord'], ['2', 'Oststrasse', 'Ost'],
      ['3', 'Südweststrasse', 'Südwest']])
    const n = ka[0]
    expect([n.getrennt, n.ein, n.aus, n.anschluss.length, n.linien.length]).toEqual([true, '3:1:-1', '4:0:1', 2, 2])
    expect(n.key).toBe('3:1:-1')
    expect(knoten(o, av).kreisel!.annahmen.some(x => x.includes(`${KREISEL_ARM_GRAD}°`))).toBe(true)
  })
  it('Einfahrt und Ausfahrt mit verschiedenen Namen bzw. weit auseinander: zwei Arme', () => {
    const o = daten([ring(R), weg(2, [[20, ...pol(R + 60, 100)], ringPunkt(R, 100)], { highway: 'residential', name: 'A', oneway: 'yes' }),
      weg(3, [ringPunkt(R, 80), [30, ...pol(R + 60, 80)]], { highway: 'residential', name: 'B', oneway: 'yes' }),
      weg(4, [ringPunkt(R, 300), [40, ...pol(R + 60, 200)]], { highway: 'residential', oneway: 'yes' })])
    const ka = nachNr(knoten(o, av).kreisel!.arme)
    // Nummern im Uhrzeigersinn ab Norden: B (Azimut 10°), ohne Name (rund 200°), A (350°)
    expect(ka.map(a => [a.name, a.getrennt, a.ein !== null, a.aus !== null])).toEqual([['B', false, false, true], ['', false, false, true],
      ['A', false, true, false]])
  })
  it('Weg mit Gegenverkehr und zusätzliche Einfahrt derselben Strasse in derselben Richtung: ein Arm (Befund Dalmazibrücke Bern)', () => {
    const o = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'),
      arm(4, R, 230, 'Südweststrasse'), weg(5, [[41, ...pol(R + 25, 230)], ringPunkt(R, 250)], { highway: 'residential', name: 'Südweststrasse', oneway: 'yes' })])
    const ka = nachNr(knoten(o, av).kreisel!.arme)
    expect(ka.map(a => [a.name, a.getrennt, a.ein, a.aus])).toEqual([['Nordstrasse', false, '2:0:1', '2:0:1'], ['Oststrasse', false, '3:0:1', '3:0:1'],
      ['Südweststrasse', true, '5:1:-1', '4:0:1']])
  })
  it('Bypass (Weg zwischen zwei Armen am Ring vorbei) und service-Weg am Ring sind keine Arme', () => {
    const o = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 230, 'Südweststrasse'),
      // Bypass von der Nordstrasse (Punkt 20) zur Oststrasse (Punkt 30), weit ausserhalb des Rings
      weg(9, [[20, ...pol(R + 80, 90)], [90, 60, 60], [30, ...pol(R + 80, 0)]], { highway: 'residential', oneway: 'yes' }),
      weg(8, [ringPunkt(R, 150), [80, ...pol(R + 30, 150)]], { highway: 'service' })])
    const ka = nachNr(knoten(o, av).kreisel!.arme)
    expect(ka.map(a => a.name)).toEqual(['Nordstrasse', 'Oststrasse', 'Südweststrasse'])
  })
  it('Tram über den Ring: kein Arm, Hinweis', () => {
    const o = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 230, 'Südweststrasse')],
      { tram: [weg(50, [[500, -60, -5], [501, 60, -5]], { railway: 'tram' })] })
    const k = knoten(o, av).kreisel!
    expect(k.arme.length).toBe(3)
    expect(k.hinweise).toContain('Ein Tramgleis quert die Kreiselfahrbahn (OSM railway=tram).')
    const fern = daten(o.wege, { tram: [weg(50, [[500, -60, -40], [501, 60, -40]], { railway: 'tram' })] })
    expect(knoten(fern, av).kreisel!.hinweise.some(h => h.includes('Tram'))).toBe(false)
  })
  it('Kreisel aus mehreren Ringwegen (je ein Viertel): zusammengefasst', () => {
    const viertel = [0, 90, 180, 270].map((g, i) => weg(60 + i, Array.from({ length: 10 }, (_, k) => ringPunkt(R, g + k * 10)),
      { highway: 'residential', junction: 'roundabout' }))
    const o = daten([...viertel, arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 230, 'Südweststrasse')])
    const netz = new OsmNetz(o)
    expect(ringWege(netz, ringId(0))).toEqual([60, 61, 62, 63])
    const k = knoten(o, av).kreisel!
    expect(k.ring.length).toBe(37)
    expect(k.vermessung.aussenR).toBeCloseTo(17, 1)
  })
})

describe('K1: Typ, Minikreisel, ohne Insel, ohne AV', () => {
  it('Minikreisel (Durchmesser 18 m), Fahrbahn 5 m: kein Innenring; Typ von Hand umschaltbar', () => {
    const o = daten([ring(6.5), arm(2, 6.5, 90, 'N'), arm(3, 6.5, 0, 'O'), arm(4, 6.5, 230, 'SW')])
    const av = fahrbahn(9, 4, [90, 0, 230])
    const k = knoten(o, av).kreisel!
    expect([k.typ, k.typVorgabe, k.vermessung.innenringR]).toEqual(['mini', 'mini', null])
    expect(k.vermessung.breite).toBeCloseTo(5, 1)
    const h = knoten(o, av, ringId(0), 'klein').kreisel!
    expect([h.typ, h.typVorgabe, h.typGewaehlt]).toEqual(['klein', 'mini', true])
    expect(h.hinweise[0]).toBe('Typ von Hand: Kleinkreisel (nach dem Durchmesser 18,0 m: Minikreisel).')
  })
  it('ohne Insel in der AV: Insel 0, Hinweis', () => {
    const o = daten([ring(5), arm(2, 5, 90, 'N'), arm(3, 5, 0, 'O'), arm(4, 5, 230, 'SW')])
    const k = knoten(o, fahrbahn(8, 0, [90, 0, 230])).kreisel!
    expect(k.vermessung.inselR).toBe(0)
    expect(k.vermessung.aussenR).toBeCloseTo(8, 1)
    expect(k.hinweise).toContain('Die AV zeigt keine Mittelinsel ohne Fahrbahn (überfahrbare Insel?); vor Ort prüfen.')
  })
  it('ohne AV: Masse aus der OSM-Linie geschätzt (Annahme 5,50 m Fahrbahn, also kein Innenring)', () => {
    const o = daten([ring(12.5), arm(2, 12.5, 90, 'N'), arm(3, 12.5, 0, 'O'), arm(4, 12.5, 230, 'SW')])
    for (const av of [[], [flaeche('Strasse_Weg', [[lv(-200, -3), lv(200, -3), lv(200, 3), lv(-200, 3), lv(-200, -3)]])]]) {
      const k = knoten(o, av).kreisel!, v = k.vermessung
      expect(v.quelle).toBe('osm')
      expect(v.aussenR).toBeCloseTo(12.5 + KREISEL_BREITE_OHNE_AV_M / 2, 1)
      expect(v.breite).toBeCloseTo(KREISEL_BREITE_OHNE_AV_M, 5)
      expect(v.innenringR).toBeNull()
      expect(k.annahmen[0]).toMatch(/^Masse geschätzt: Die AV zeigt hier keinen Kreisel/)
    }
  })
  it('Grenzen des Typs (ganze Meter) und Hinweis ausserhalb 14 bis 40 m', () => {
    expect([25.4, 25.5, 26, 13.6, 40.4].map(kreiselTypVorgabe)).toEqual(['mini', 'klein', 'klein', 'mini', 'klein'])
    expect([14, 13.4, 40.4, 40.6].map(kreiselAusserhalb)).toEqual([null,
      'Aussendurchmesser 13 m: kleiner als ein Minikreisel (14 bis 25 m, VSS 40 263 Ziffer 4, S. 4)', null,
      'Aussendurchmesser 41 m: grösser als ein Kleinkreisel (26 bis 40 m, VSS 40 263 Ziffer 3, S. 4)'])
    expect([innenringVorschlag(12, 6.5), innenringVorschlag(12, 6.4)]).toEqual([null, 6.5])
  })
  it('grosser Kreisel (Durchmesser 50 m): Hinweis, Typ Kleinkreisel', () => {
    const o = daten([ring(20), arm(2, 20, 90, 'N'), arm(3, 20, 0, 'O'), arm(4, 20, 230, 'SW')])
    const k = knoten(o, fahrbahn(25, 15, [90, 0, 230])).kreisel!
    expect(k.vermessung.durchmesser).toBeCloseTo(50, 0)
    expect([k.typ, k.ausserhalb]).toEqual(['klein', 'Aussendurchmesser 50 m: grösser als ein Kleinkreisel (26 bis 40 m, VSS 40 263 Ziffer 3, S. 4)'])
  })
})

describe('K1: Rechnung und Knotensuche', () => {
  const R = 12.5
  const o = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 230, 'Südweststrasse')])
  const av = fahrbahn(17, 8, [90, 0, 230])
  it('rechneKnoten an einem Ringpunkt: Kreisel-Block, keine Rechnung, Meldung «folgt später»; Typ aus den Eingaben', () => {
    const r = rechneKnoten(o, av, { knoten: ringId(90), zufahrt: null })
    expect([r.ergebnis, r.meldungen, r.knoten?.id, r.knoten?.kreisel?.typ]).toEqual([null, [KREISEL_EINFAHRT_TEXT], 1000, 'klein'])
    expect(r.keinKnoten).toEqual([])
    const m = rechneKnoten(o, av, { knoten: ringId(90), zufahrt: null, eingaben: { typ: null, fahrstreifen: null, neigungGross: null,
      schwerverkehr: false, neigung: { links: null, rechts: null }, kreiselTyp: 'mini' } })
    expect([m.knoten?.kreisel?.typ, m.knoten?.kreisel?.typGewaehlt]).toEqual(['mini', true])
  })
  it('Knotensuche: Ringwege (ohne Tags, mit Geometrie) -> ein Punkt in der Mitte, Kennung = kleinster Ringpunkt', () => {
    const r = ring(R), h = arm(2, R, 90, 'N')
    const roh = { elements: [
      { type: 'way', id: 1, nodes: r.knoten.slice(0, 19), geometry: r.geom.slice(0, 19).map(([lat, lon]) => ({ lat, lon })) },
      { type: 'way', id: 7, nodes: r.knoten.slice(18), geometry: r.geom.slice(18).map(([lat, lon]) => ({ lat, lon })) },
      { type: 'way', id: 2, tags: { highway: 'residential', name: 'N' }, center: { lat: h.geom[1][0], lon: h.geom[1][1] } },
      { type: 'node', id: 99, lat: 46.9, lon: 7.4 },
    ] }
    const k = kreiselMitten(roh)
    expect(k.length).toBe(1)
    expect([k[0].id, k[0].tags[KREISEL_TAG]]).toEqual([1000, 'ja'])
    expect(dist(lv95(k[0].lat, k[0].lon), O)).toBeLessThan(0.05)
  })
})

describe('K1: Kreisel Sandrainstrasse Bern (OSM-Ringpunkt 11365036791)', () => {
  const lesen = (n: string) => JSON.parse(readFileSync(new URL(`./testdaten/${n}`, import.meta.url), 'utf8'))
  const osm = osmParsen(lesen('kreisel_sandrain_osm.json'))
  const av = avParsen(lesen('kreisel_sandrain_av.json') as GeoJson)
  const r = rechneKnoten(osm, av, { knoten: 11365036791, zufahrt: null })
  const kn = r.knoten!, k = kn.kreisel!, v = k.vermessung
  it('ein Knoten aus acht Ringwegen, Kennung kleinster Ringpunkt, gleich von jedem Ringpunkt aus', () => {
    expect(k.ringWege.length).toBe(8)
    expect(kn.id).toBe(Math.min(...k.ringKnoten))
    expect(rechneKnoten(osm, av, { knoten: 564770749, zufahrt: null }).knoten!.id).toBe(kn.id)
    expect(r.meldungen).toEqual([KREISEL_EINFAHRT_TEXT])
  })
  it('Masse aus der AV: Aussenradius ~12,6 m (Durchmesser ~25 m, Minikreisel an der Grenze), Insel ~3,5 m, Fahrbahn ~9 m, Innenring ~7 m', () => {
    expect(v.quelle).toBe('av')
    expect(v.aussenR).toBeGreaterThan(12.3); expect(v.aussenR).toBeLessThan(12.9)
    expect(v.inselR).toBeGreaterThan(3.2); expect(v.inselR).toBeLessThan(3.8)
    expect(v.breite).toBeGreaterThan(8.6); expect(v.breite).toBeLessThan(9.5)
    expect(v.innenringR!).toBeGreaterThan(6.8); expect(v.innenringR!).toBeLessThan(7.4)
    expect([k.typVorgabe, k.typ, k.ausserhalb]).toEqual(['mini', 'mini', null])
    expect(dist(v.mitte, k.osmMitte)).toBeLessThan(1)
  })
  it('drei Arme mit getrennter Ein- und Ausfahrt (Leitinseln), service-Wege keine Arme', () => {
    expect(nachNr(k.arme).map(a => [a.nr, a.name, a.himmel, a.getrennt])).toEqual([['1', 'Marzilistrasse', 'Nordost', true],
      ['2', 'Sandrainstrasse', 'Süd', true], ['3', 'Sulgeneckstrasse', 'West', true]])
    expect(k.arme.every(a => a.ein && a.aus)).toBe(true)
  })
  it('K2: Einfahrt Sandrainstrasse: Wartelinie am Aussenrand, K auf der Fahrlinie, D 3,00 m vor der Wartelinie; K3: drei Arme ohne ' +
    'Fahrbeziehung über 180 gon, Minikreisel 30 km/h', () => {
    const sand = nachNr(k.arme)[1]
    const z = rechneKnoten(osm, av, { knoten: 11365036791, zufahrt: sand.key }).knoten!.kreisel!.zufahrt!
    const r = (p: P) => dist(p, v.mitte)
    expect(Math.abs(r(z.rand) - profilWert(v.aussen, Math.atan2(z.rand[1] - v.mitte[1], z.rand[0] - v.mitte[0]) * 180 / Math.PI))).toBeLessThan(0.1)
    expect(r(z.K)).toBeLessThan(r(z.rand)); expect(r(z.K)).toBeGreaterThan(v.inselR)
    expect(dist(z.Dachse, z.rand)).toBeCloseTo(3, 1)
    expect(k.beta.beziehungen.filter(x => x.vorgabe)).toEqual([])
    expect([k.beta.tempo, k.beta.annahme]).toEqual([30, true])
  })
})

describe('E9: Eigerplatz Bern (Ringpunkt 3212734952): Oval mit Tramtrassee durch die Insel', () => {
  const lesen = (n: string) => JSON.parse(readFileSync(new URL(`./testdaten/${n}`, import.meta.url), 'utf8'))
  const osm = osmParsen(lesen('kreisel_eigerplatz_osm.json'))
  const av = avParsen(lesen('kreisel_eigerplatz_av.json') as GeoJson)
  const k = rechneKnoten(osm, av, { knoten: 3212734952, zufahrt: null }).knoten!.kreisel!, v = k.vermessung
  it('aus der AV vermessen (nicht mehr aus OSM geschätzt), nicht kreisrund, Inselrand über das Trassee ergänzt', () => {
    expect(v.quelle).toBe('av')
    expect(v.dMin).toBeGreaterThan(28); expect(v.dMin).toBeLessThan(31.5)
    expect(v.dMax).toBeGreaterThan(38.5); expect(v.dMax).toBeLessThan(42)
    expect(v.dMax / v.dMin).toBeGreaterThan(1.2)
    expect(v.inselErgaenzt).toBeGreaterThan(30)
    expect(k.typ).toBe('klein')
    expect(k.hinweise.some(h => h.startsWith('Das Tramtrassee führt durch die Mittelinsel'))).toBe(true)
    expect(k.hinweise.some(h => h.startsWith('Nicht kreisrund'))).toBe(true)
  })
  it('vier Arme; die Schwarzenburgstrasse hat in OSM nur eine Einfahrt (1497788623): kein Bypass nach E10 («zweite Einfahrt»)', () => {
    expect(nachNr(k.arme).map(a => a.name)).toEqual(['Eigerstrasse', 'Seftigenstrasse', 'Schwarzenburgstrasse', 'Eigerplatz'])
    const s = k.arme.find(a => a.name === 'Schwarzenburgstrasse')!
    expect([s.ein, s.aus, s.bypass.length]).toEqual(['1497788623:12:-1', '1497788621:0:1', 0])
  })
  it('Velobypass Ost von Arm 2 (Seftigenstrasse) zu Arm 1 (Eigerstrasse), Einbahn 558291586; der westliche (Arm 4 zu 3) ist in OSM ' +
    'nicht bis Arm 3 kartiert und wird nicht erkannt', () => {
    expect(nachNr(k.arme).flatMap(a => a.velobypass.map(x => [a.nr, x.zu, x.wege, x.einbahn]))).toEqual([['2', '1 Eigerstrasse (Ost)', [558291586], true]])
  })
})

describe('E9: Form statt Kreis', () => {
  // Oval: OSM-Linie Ellipse 14,5 × 11,5 m (Halbachsen), Aussenrand 19 × 16 m, Insel 10 × 7 m; Arme in den Achsen
  const ell = (a: number, b: number, t: number): [number, number] => [a * Math.cos(t * Math.PI / 180), b * Math.sin(t * Math.PI / 180)]
  const ellipse = (a: number, b: number, n = 240): P[] => Array.from({ length: n + 1 }, (_, k) => lv(...ell(a, b, k * 360 / n)))
  const ovalRing = weg(1, [...Array.from({ length: 36 }, (_, k) => [ringId(k * 10), ...ell(14.5, 11.5, k * 10)] as [number, number, number]),
    [ringId(0), 14.5, 0]], { highway: 'residential', junction: 'roundabout' })
  const ovalArm = (id: number, grad: number, name: string) => {
    const p = ell(14.5, 11.5, grad), r = pol(1, grad)
    return weg(id, [[ringId(grad), ...p], [id * 10, p[0] + r[0] * 80, p[1] + r[1] * 80]], { highway: 'residential', name })
  }
  const o = daten([ovalRing, ovalArm(2, 90, 'N'), ovalArm(3, 0, 'O'), ovalArm(4, 270, 'S'), ovalArm(5, 180, 'W')])
  const av = [flaeche('Strasse_Weg', [ellipse(19, 16), [...ellipse(10, 7)].reverse()]), ...fahrbahn(17, 0, [90, 0, 270, 180]).slice(1)]
  it('Aussenrand und Insel je Richtung; kleinster und grösster Durchmesser, Typ nach dem mittleren, Hinweis «nicht kreisrund»', () => {
    const k = knoten(o, av).kreisel!, v = k.vermessung
    expect(v.quelle).toBe('av')
    expect(dist(v.mitte, O)).toBeLessThan(0.1)
    expect(v.dMax).toBeCloseTo(38, 0)
    expect(v.dMin).toBeCloseTo(32, 0)
    expect(v.durchmesser).toBeGreaterThan(v.dMin); expect(v.durchmesser).toBeLessThan(v.dMax)
    expect(profilWert(v.insel, 0)).toBeCloseTo(10, 0); expect(profilWert(v.insel, 90)).toBeCloseTo(7, 0)
    expect(profilWert(v.aussen, 45)).toBeCloseTo(Math.hypot(...ell(19, 16, Math.atan2(19 * Math.sin(Math.PI / 4), 16 * Math.cos(Math.PI / 4)) * 180 / Math.PI)), 0)
    // Innenring je Richtung: 5,50 m innerhalb des Aussenrands; Fahrlinie in der Mitte bis zum Innenring
    expect(v.innenring[0]!).toBeCloseTo(v.aussen[0] - INNENRING_AB_M, 5)
    expect(v.fahrlinie[90]).toBeCloseTo((v.aussen[90] + v.innenring[90]!) / 2, 5)
    expect(k.typ).toBe('klein')
    expect(k.hinweise.some(h => h.startsWith('Nicht kreisrund: Aussendurchmesser 32'))).toBe(true)
  })
  it('Tramtrassee quer durch die Insel: Inselrand über die Lücke ergänzt, Hinweis «Durchsicht über das Tramtrassee»', () => {
    const t = daten([ring(12.5), arm(2, 12.5, 90, 'N'), arm(3, 12.5, 0, 'O'), arm(4, 12.5, 270, 'S'), arm(5, 12.5, 180, 'W')],
      { tram: [weg(50, [[500, -60, 0], [501, 60, 0]], { railway: 'tram' })] })
    const trassee = flaeche('Strasse_Weg', [[lv(-25, -3), lv(25, -3), lv(25, 3), lv(-25, 3), lv(-25, -3)]])
    const k = knoten(t, [...fahrbahn(17, 8, [90, 0, 270, 180]), trassee]).kreisel!, v = k.vermessung
    expect(v.inselR).toBeCloseTo(8, 0)
    expect(v.inselErgaenzt).toBeGreaterThan(40)
    expect(Math.min(...v.insel)).toBeGreaterThan(7.5)
    expect(k.hinweise).toContain('Das Tramtrassee führt durch die Mittelinsel: Durchsicht über das Tramtrassee (VSS 40 263 Ziffer 13.3, S. 9). ' +
      'Der Inselrand ist über die Lücke ergänzt.')
  })
})

describe('E10: Bypass', () => {
  const R = 12.5
  // zweite Einfahrt der Nordstrasse, mündet am Ringpunkt bei 140°, 40° (8,7 m) vor der Ausfahrt der Weststrasse bei 180°
  const zweite = weg(9, [[90, -8, R + 18], ringPunkt(R, 140)], { highway: 'residential', name: 'Nordstrasse', oneway: 'yes' })
  it('zweite Einfahrt bis 20 m vor der Ausfahrt des nächsten Arms: Bypass, keine Einfahrt, Hinweis', () => {
    const o = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 270, 'Südstrasse'), arm(5, R, 180, 'Weststrasse'), zweite])
    const k = knoten(o, fahrbahn(17, 8, [90, 0, 270, 180])).kreisel!
    const n = nachNr(k.arme)[0]
    expect([n.name, n.ein, n.getrennt, n.bypass.length]).toEqual(['Nordstrasse', '2:0:1', false, 1])
    expect(n.bypass[0].abstand).toBeCloseTo(R * 40 * Math.PI / 180, 1)
    expect([n.bypass[0].wid, n.bypass[0].vor, n.bypass[0].key]).toEqual([9, '4 Weststrasse (West)', '9:1:-1'])
    expect(k.hinweise).toContain(`Arm 1 Nordstrasse (Nord): Die zweite Einfahrt (OSM-Weg 9) mündet 9 m vor der Ausfahrt 4 Weststrasse (West) ` +
      `in den Ring und gilt als Bypass (Annahme: bis ${BYPASS_M} m). Das Einfädeln prüft die App nicht.`)
  })
  it('weiter als 20 m vor der nächsten Ausfahrt (ohne Weststrasse: Südstrasse 130° weiter): kein Bypass, zweite Einfahrt im Arm', () => {
    const o = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 270, 'Südstrasse'), zweite])
    const n = knoten(o, fahrbahn(17, 8, [90, 0, 270])).kreisel!.arme.find(a => a.name === 'Nordstrasse')!
    expect([n.bypass.length, n.getrennt, n.anschluss.length]).toEqual([0, true, 2])
  })
})

describe('K2 und K3: Einfahrt, K, D, Ablenkungswinkel', () => {
  const R = 12.5, w = 3.5, aussen = 17, insel = 8, grenze = aussen - INNENRING_AB_M   // Innenring 11,50 m
  const o = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 270, 'Südstrasse'), arm(5, R, 180, 'Weststrasse')])
  const SUED = '4:0:1'
  it('K2: Achse 1,75 m rechts der OSM-Linie (Mitte der rechten Hälfte), Wartelinie, K auf der Fahrlinie, D 3,00 m dahinter am Fahrer*innensitz', () => {
    const k = knoten(o, fahrbahn(aussen, insel, [90, 0, 270, 180]), ringId(0), null, SUED).kreisel!
    const z = k.zufahrt!
    expect(k.zufahrtFehler).toBeNull()
    const x = (p: P) => p[0] - O[0], y = (p: P) => p[1] - O[1]
    expect(x(z.rand)).toBeCloseTo(1.75, 1); expect(y(z.rand)).toBeCloseTo(-Math.sqrt(aussen ** 2 - 1.75 ** 2), 1)
    const fl = (aussen + grenze) / 2
    expect(x(z.K)).toBeCloseTo(1.75, 1); expect(y(z.K)).toBeCloseTo(-Math.sqrt(fl ** 2 - 1.75 ** 2), 1)
    expect(z.B).toBe(3)
    expect(x(z.D)).toBeCloseTo(1.25, 1); expect(y(z.D)).toBeCloseTo(y(z.rand) - 3, 1)
    expect(dist(z.vortrittLinie[z.vortrittLinie.length - 1], z.K)).toBe(0)
    expect(dist(z.vortrittLinie[0], O)).toBeCloseTo(fl, 0)
    expect(z.lageQuelle).toMatch(/^AV-Querschnitt 7,00 m/)
    // ohne Einfahrt bzw. fremder Schlüssel
    expect(knoten(o, fahrbahn(aussen, insel, [90, 0, 270, 180]), ringId(0), null, '99:0:1').kreisel!.zufahrtFehler)
      .toBe('Die gewählte Einfahrt gehört nicht zu diesem Kreisel.')
  })
  it('K3 ohne Ausrundung: Startpunkt an der Wartelinie auf der Hilfslinie 3,50 m innerhalb des rechten Rands; Handlösung β = 2·asin(r/d)', () => {
    const k = knoten(o, fahrbahn(aussen, insel, [90, 0, 270, 180]), ringId(0), 'klein').kreisel!, b = k.beta
    const vor = b.beziehungen.filter(x => x.vorgabe)
    expect(vor.map(x => [k.arme.find(a => a.key === x.von)!.name, k.arme.find(a => a.key === x.nach)!.name]).sort()).toEqual([
      ['Nordstrasse', 'Südstrasse'], ['Oststrasse', 'Weststrasse'], ['Südstrasse', 'Nordstrasse'], ['Weststrasse', 'Oststrasse']])
    const d = Math.sqrt(aussen ** 2 - 1.75 ** 2)   // Startpunkt: x = 1,75 − 1,75 = 0 (Hilfslinie 3,50 m links vom rechten Rand bei x = 3,50)
    const soll = gon(2 * Math.asin(grenze / d) * 180 / Math.PI)
    for (const x of vor) { expect(x.gueltig).toBe(true); expect(x.betaGon!).toBeCloseTo(soll, 0); expect(x.fall).toBe(2); expect(x.re2Ein).toBeNull() }
    const s = vor.find(x => x.von === SUED)!
    expect(s.startEin![0] - O[0]).toBeCloseTo(1.75 + w / 2 - HILFSLINIE_M, 1)
    expect([b.tempo, b.annahme]).toEqual([30, false])
    expect(b.tempoGrund).toMatch(/^kleinstes β 95,\d gon \(Fahrbeziehung \d → \d\): 30 km\/h \(VSS 40 263 Ziffer 13\.2, S\. 8–9\)$/)
  })
  it('K3 mit Ausrundung Re2 = 10 m: Tangente an Hilfskreis (Re2 + 3,50 m) und Innenring, Handlösung', () => {
    const Re2 = 10, R0 = aussen
    // Arm nach Norden (lokal +y) mit Ausrundungen beidseits, dann gedreht
    const yc = Math.sqrt((R0 + Re2) ** 2 - (w + Re2) ** 2)
    const lokal: [number, number][] = []
    const c: [number, number] = [w + Re2, yc], a1 = Math.atan2(-yc, -(w + Re2)) + 2 * Math.PI
    for (let i = 0; i <= 30; i++) { const t = a1 + (Math.PI - a1) * i / 30; lokal.push([c[0] + Re2 * Math.cos(t), c[1] + Re2 * Math.sin(t)]) }
    const rechts = [...lokal, [w, 80] as [number, number]]
    const links = [[-w, 80] as [number, number], ...[...lokal].reverse().map(([x, y]) => [-x, y] as [number, number])]
    const armFlaeche = (grad: number) => {
      const dreh = (p: [number, number]): P => { const g = (grad - 90) * Math.PI / 180; return lv(p[0] * Math.cos(g) - p[1] * Math.sin(g), p[0] * Math.sin(g) + p[1] * Math.cos(g)) }
      const r = [...rechts, ...links].map(dreh)
      return flaeche('Strasse_Weg', [[...r, r[0]]])
    }
    const av = [fahrbahn(aussen, insel, [])[0], ...[90, 0, 270, 180].map(armFlaeche)]
    const b = knoten(o, av, ringId(0), 'klein').kreisel!.beta
    // innere gemeinsame Tangente: (w + Re2) cos δ + yc sin δ = (Re2 + 3,50) + Innenring, δ von der Fahrtrichtung, β = 2δ
    const A = w + Re2, Bv = yc, C = Re2 + HILFSLINIE_M + grenze
    const delta = Math.atan2(Bv, A) - Math.acos(C / Math.hypot(A, Bv))
    const soll = gon(2 * delta * 180 / Math.PI)
    for (const x of b.beziehungen.filter(y => y.vorgabe)) {
      expect(x.re2Ein!).toBeCloseTo(Re2, 0); expect(x.re2Aus!).toBeCloseTo(Re2, 0)
      expect(Math.abs(x.betaGon! - soll)).toBeLessThan(1.5)
    }
  })
  it('K3: Fahrbeziehung von Hand ab bzw. an; Minikreisel fest 30 km/h; ohne Insel in der AV am Innenring-Vorschlag', () => {
    const av = fahrbahn(aussen, insel, [90, 0, 270, 180])
    const alle = knoten(o, av, ringId(0), 'klein').kreisel!.beta.beziehungen.filter(x => x.vorgabe).map(x => x.key)
    const ab = Object.fromEntries(alle.map(k => [k, false]))
    const b = knoten(o, av, ringId(0), 'klein', null, ab).kreisel!.beta
    expect([b.tempo, b.annahme, b.massgebend]).toEqual([40, true, null])
    expect(b.tempoGrund).toBe('ohne gültige Konstruktion des Ablenkungswinkels 40 km/h (Annahme)')
    const an = knoten(o, av, ringId(0), 'klein', null, { ...ab, [alle[0]]: true }).kreisel!.beta
    expect([an.massgebend, an.tempo]).toEqual([alle[0], 30])
    expect(knoten(o, av, ringId(0), 'mini').kreisel!.beta.tempoGrund).toBe('Minikreisel: fest 30 km/h, ohne Ablenkungswinkel (Annahme, Entscheid E1)')
    const ohne = knoten(o, fahrbahn(aussen, 0, [90, 0, 270, 180]), ringId(0), 'klein').kreisel!.beta
    expect(ohne.beziehungen.filter(x => x.vorgabe).every(x => x.gueltig && x.fall === 2)).toBe(true)   // Innenring 5,50 m innerhalb
  })
  it('drei Arme: Fahrbeziehung nur zwischen Armen mit mehr als 180 gon (T-Form ja, Y-Form nein)', () => {
    const t = daten([ring(R), arm(2, R, 90, 'N'), arm(3, R, 0, 'O'), arm(4, R, 270, 'S')])
    const bt = knoten(t, fahrbahn(aussen, insel, [90, 0, 270]), ringId(0), 'klein').kreisel!.beta.beziehungen.filter(x => x.vorgabe)
    expect(bt.map(x => x.key).sort()).toEqual(['2:0:1>4:0:1', '4:0:1>2:0:1'])
    const y = daten([ring(R), arm(2, R, 90, 'N'), arm(3, R, 210, 'SW'), arm(4, R, 330, 'SO')])
    const by = knoten(y, fahrbahn(aussen, insel, [90, 210, 330]), ringId(0), 'klein').kreisel!.beta
    expect(by.beziehungen.filter(x => x.vorgabe)).toEqual([])
    expect(by.tempo).toBe(40)
  })
})

describe('Velobypass (Nutzerbefund 01.11.2026)', () => {
  it('Umkreis-Abfrage: Fuss- und Radwege mit bicycle=designated bzw. yes', () => {
    expect(overpassAbfrage(46.9, 7.4, 150)).toContain('["highway"~"^(path|footway)$"]["bicycle"~"^(designated|yes)$"]')
  })
  const R = 12.5
  const strassen = [ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 270, 'Südstrasse'), arm(5, R, 180, 'Weststrasse')]
  const av = fahrbahn(17, 8, [90, 0, 270, 180])
  const rad = (id: number, pts: [number, number][], tags: Record<string, string>, knoten?: number[]) =>
    weg(id, pts.map((p, i) => [knoten?.[i] ?? id * 100 + i, p[0], p[1]] as [number, number, number]), tags)
  // Westseite von der Nordstrasse zur Weststrasse, Enden 6 m neben den Armen, ausserhalb des Aussenrands
  const west: [number, number][] = [[-6, 40], [-25, 25], [-40, 6]]
  it('Radweg zwischen zwei Armen: Velobypass ab dem Arm mit der kleineren Nummer (bzw. in Einbahnrichtung), Hinweis, kein Arm', () => {
    const k = knoten(daten(strassen, { querungen: [rad(70, west, { highway: 'cycleway' })] }), av).kreisel!
    expect(k.arme.length).toBe(4)
    const n = nachNr(k.arme)
    expect(n[0].velobypass.map(x => [x.zu, x.wege, x.einbahn])).toEqual([['4 Weststrasse (West)', [70], false]])
    expect(k.hinweise).toContain('Velobypass von Arm 1 Nordstrasse (Nord) zu Arm 4 Weststrasse (West) (OSM-Weg 70): Querungen und ' +
      'Einmündungen des Bypasses prüft die App nicht.')
    const ein = knoten(daten(strassen, { querungen: [rad(70, [...west].reverse(), { highway: 'cycleway', oneway: 'yes' })] }), av).kreisel!
    expect(nachNr(ein.arme)[3].velobypass.map(x => [x.zu, x.einbahn])).toEqual([['1 Nordstrasse (Nord)', true]])
  })
  it('aus zwei Wegen (Kette); path mit bicycle=yes zählt, Fussweg ohne Velo nicht', () => {
    const k = knoten(daten(strassen, { querungen: [rad(70, west.slice(0, 2), { highway: 'path', bicycle: 'yes' }, [701, 702]),
      rad(71, west.slice(1), { highway: 'cycleway' }, [702, 703])] }), av).kreisel!
    expect(nachNr(k.arme)[0].velobypass.map(x => x.wege)).toEqual([[70, 71]])
    const f = knoten(daten(strassen, { querungen: [rad(70, west, { highway: 'footway' })] }), av).kreisel!
    expect(f.arme.every(a => !a.velobypass.length)).toBe(true)
  })
  it('kein Velobypass: am Ring, weiter als 25 m von einem Arm, nur an einem Arm, über 60 m von der Mitte, Querung', () => {
    const fall = (pts: [number, number][], tags: Record<string, string> = { highway: 'cycleway' }, knoten?: number[]) =>
      nachNr(knoten_(daten(strassen, { querungen: [rad(70, pts, tags, knoten)] }))).flatMap(a => a.velobypass)
    const knoten_ = (o: OsmDaten) => knoten(o, av).kreisel!.arme
    expect(fall(west, { highway: 'cycleway' }, [ringId(100), 7001, 7002])).toEqual([])
    expect(fall([[-6, 40], [-25, 25], [-40, 6 + VELOBYPASS_ARM_M + 5]])).toEqual([])
    expect(fall([[-6, 40], [-6, 25]])).toEqual([])
    expect(fall([[-6, 70], [-25, 25], [-40, 6]])).toEqual([])
    expect(fall(west, { highway: 'footway', footway: 'crossing', bicycle: 'yes' })).toEqual([])
  })
  it('kein Velobypass: kürzer als 20 m bzw. ein Ende weniger als 5 m ausserhalb des Aussenrands (Zufahrt für Velos am Ring)', () => {
    expect([VELOBYPASS_MIN_LAENGE_M, VELOBYPASS_ENDE_AUSSEN_M]).toEqual([20, 5])
    const vb = (pts: [number, number][]) => knoten(daten(strassen, { querungen: [rad(70, pts, { highway: 'cycleway' })] }), av).kreisel!
      .arme.flatMap(a => a.velobypass)
    // schräg von der Weststrasse zur Nordstrasse, Enden 6 m neben den Armen: 25,5 m lang zählt, 17,0 m lang nicht
    expect(vb([[-24, 6], [-6, 24]]).length).toBe(1)
    expect(vb([[-18, 6], [-6, 18]])).toEqual([])
    // Ende an der Nordstrasse nur 3 m ausserhalb des Aussenrands (17 m)
    expect(vb([[-40, 6], [-25, 15], [-3, 19.8]])).toEqual([])
    expect(vb([[-40, 6], [-25, 15], [-3, 23]]).length).toBe(1)
  })
  it('Querschnitt: OSM-Linie auf einer Mittelinsel: Einfahrt in der Mitte der Fahrbahn rechts davon; Radweg auf der Fläche begrenzt sie', () => {
    const sued = [flaeche('Strasse_Weg', [[lv(1.5, -16), lv(5, -16), lv(5, -90), lv(1.5, -90), lv(1.5, -16)]]),
      flaeche('Strasse_Weg', [[lv(-5, -16), lv(-1.5, -16), lv(-1.5, -90), lv(-5, -90), lv(-5, -16)]])]
    const av2 = [...fahrbahn(17, 8, [90, 0, 180]), ...sued]
    const z = knoten(daten(strassen), av2, ringId(0), null, '4:0:1').kreisel!.zufahrt!
    expect(z.rand[0] - O[0]).toBeCloseTo(3.25, 1)
    expect(z.lageQuelle).toMatch(/OSM-Linie auf einer Mittelinsel: Fahrbahn rechts davon, 3,50 m/)
    // Radweg bei x = 5 auf der Fahrbahn −3,50 bis 6,00: Fahrbahn bis 1 m davor (4,00), Gegenverkehr: rechte Hälfte 0,25 bis 4,00
    const breit = [...fahrbahn(17, 8, [90, 0, 180]), flaeche('Strasse_Weg', [[lv(-3.5, -16), lv(6, -16), lv(6, -90), lv(-3.5, -90), lv(-3.5, -16)]])]
    const r = knoten(daten(strassen, { querungen: [rad(80, [[5, -20], [5, -80]], { highway: 'cycleway' })] }), breit, ringId(0), null, '4:0:1')
      .kreisel!.zufahrt!
    expect(r.rand[0] - O[0]).toBeCloseTo((0.25 + 4) / 2, 1)
    expect(r.lageQuelle).toMatch(/begrenzt durch einen benachbarten OSM-Weg/)
  })
})

describe('Velobypass: Dalmazibrücke Bern (Ringpunkt 564771785), Negativfall', () => {
  const lesen = (n: string) => JSON.parse(readFileSync(new URL(`./testdaten/${n}`, import.meta.url), 'utf8'))
  const osm = osmParsen(lesen('kreisel_dalmazi_osm.json'))
  const av = avParsen(lesen('kreisel_dalmazi_av.json') as GeoJson)
  it('Radweg 1113134819 (rund 10 m, von der für Velos geöffneten Einbahn Brückenstrasse bis 3 m an den Ring) ist kein Velobypass', () => {
    const k = rechneKnoten(osm, av, { knoten: 564771785, zufahrt: null }).knoten!.kreisel!
    expect(osm.querungen.some(w => w.id === 1113134819)).toBe(true)
    expect(k.arme.flatMap(a => a.velobypass)).toEqual([])
    expect(k.hinweise.some(h => h.startsWith('Velobypass'))).toBe(false)
  })
})

describe('K4: Sicht am Kreisel (Ak, Velo, Sichtberme) und K4b Az', () => {
  const R = 12.5
  const o = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 270, 'Südstrasse'), arm(5, R, 180, 'Weststrasse')])
  const av = fahrbahn(17, 8, [90, 0, 270, 180])
  const SUED = '4:0:1'
  const rechne = (hindernisse: Hindernis[] = [], typ: 'klein' | 'mini' | null = 'klein', oo = o) => rechneKnoten(oo, av, { knoten: ringId(0),
    zufahrt: SUED, eingaben: { typ: null, fahrstreifen: null, neigungGross: null, schwerverkehr: false, neigung: { links: null, rechts: null },
      kreiselTyp: typ }, hindernisse: { hindernisse, verworfen: [], park: null, baeume: null } }).knoten!.kreisel!
  it('Tab.-1-Werte: 30 und 40 km/h direkt, 35 km/h linear dazwischen (E7); Hauptverkehrsstrasse wie am Knoten (Zwischenwert)', () => {
    expect(kreiselA(30, 'es')).toMatchObject({ massgebend: 20, oben: 35, interpoliert: false })
    expect(kreiselA(40, 'hvs')).toMatchObject({ massgebend: 43, oben: 50 })
    expect(kreiselA(35, 'es')).toMatchObject({ massgebend: 27.5, oben: 42.5, interpoliert: true })
    expect(kreiselA(35, 'hvs')).toMatchObject({ massgebend: 35.5, oben: 42.5 })
    expect(AZ_LU).toEqual({ 40: [40, 35], 35: [30, 25], 30: [25, 20] })
  })
  it('ohne Hindernisse: Ak, Velo, Sichtberme und Az (Zufahrt links = Weststrasse) erfüllt; Linie ab K gegen die Fahrtrichtung in voller ' +
    'Länge (1,5 × oberer Wert), nicht an der vorherigen Einfahrt begrenzt', () => {
    const k = rechne(), s = k.sicht!
    expect(streckeLaenge(s.auto.achse)).toBeCloseTo(Math.ceil(1.5 * 35), 0)
    expect([s.tempo, s.typ, s.auto.A, s.auto.oben, s.auto.status, s.velo.A, s.velo.status, s.gesamt]).toEqual([30, 'es', 20, 35, 'erfuellt', 25,
      'erfuellt', 'erfuellt'])
    expect([s.auto.begrenzt, s.velo.begrenzt]).toEqual([null, null])
    expect(dist(s.auto.achse[0], k.zufahrt!.K)).toBeLessThan(1e-6)
    // gegen die Fahrtrichtung: von K (Süden, x > 0) zuerst nach Westen (x nimmt ab)
    expect(s.auto.achse[5][0]).toBeLessThan(s.auto.achse[0][0])
    expect([s.azLinks, s.az!.A, s.az!.minimal, s.az!.status]).toEqual(['4 Weststrasse (West)', 25, 20, 'erfuellt'])
    // Az: Fahrlinie mit Vortritt bis zum K der Weststrasse, dann deren Einfahrtsfahrstreifen hinaus (rechte Hälfte: y = −1,75 m)
    expect(Math.min(...s.az!.achse.map(p => dist(p, k.einfahrtK['5:0:1'])))).toBeLessThan(1e-6)
    const azEnde = s.az!.achse[s.az!.achse.length - 1]
    expect(azEnde[0] - O[0]).toBeLessThan(-17); expect(azEnde[1] - O[1]).toBeCloseTo(-1.75, 1)
    const fz = kreiselFahrzeug(s.az!.achse, s.az!.A, faLage)!
    expect(fz[1][0]).toBeGreaterThan(0.99)   // im Einfahrtsfahrstreifen der Weststrasse, nach Osten zum Ring
    expect(s.berme.flaechen.length).toBeGreaterThan(0)
    expect(s.berme.status).toBe('erfuellt')
    expect(s.hinweise).toContain(DURCHSICHT_TEXT)
    expect(s.annahmen.some(a => a.startsWith('Az ist ein Vergleichswert'))).toBe(true)
  })
  it('Hindernis in der Sichtberme (auf der Insel im Sichtfeld): Sichtberme und Ak nicht erfüllt; ausserhalb des Sichtfelds: erwünscht', () => {
    // Sichtfeld nach links (Westen) über die Insel: Hindernis auf der Insel südwestlich der Mitte
    const im: Hindernis = { id: 'h1', art: 'uebrige', ring: [lv(-6, -5), lv(-3, -5), lv(-3, -2), lv(-6, -2)], sichtbehindernd: true, quelle: 'hand', name: 'Busch' }
    const drei = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 270, 'Südstrasse')])
    const s = rechne([im], 'klein', drei).sicht!
    expect([s.berme.status, s.berme.hindernisse, s.berme.ids]).toEqual(['nicht_erfuellt', ['Busch'], ['h1']])
    expect(s.gesamt).toBe('nicht_erfuellt')
    // Nordosten der Insel liegt nicht im Sichtfeld (Durchsicht verhindern): dort zählt das Hindernis nicht
    const aus: Hindernis = { id: 'h2', art: 'uebrige', ring: [lv(3, 2), lv(6, 2), lv(6, 5), lv(3, 5)], sichtbehindernd: true, quelle: 'hand', name: 'Hecke' }
    const s2 = rechne([aus], 'klein', drei).sicht!
    expect([s2.berme.status, s2.auto.status]).toEqual(['erfuellt', 'erfuellt'])
    expect(s2.durchsicht.length).toBeGreaterThan(0)
  })
  it('Minikreisel 30 km/h; 35 km/h aus β mit Annahme; Velo über 30 km/h nach Tab. 3 (50 m)', () => {
    expect(rechne([], 'mini').sicht!.tempo).toBe(30)
    // Fahrbeziehungen ab, Kleinkreisel: ohne gültige Konstruktion 40 km/h
    const ohne = rechneKnoten(o, av, { knoten: ringId(0), zufahrt: SUED, eingaben: { typ: null, fahrstreifen: null, neigungGross: null,
      schwerverkehr: false, neigung: { links: null, rechts: null }, kreiselTyp: 'klein', kreiselBeziehungen: Object.fromEntries(
        ['2:0:1>4:0:1', '4:0:1>2:0:1', '3:0:1>5:0:1', '5:0:1>3:0:1'].map(k => [k, false])) } }).knoten!.kreisel!.sicht!
    expect([ohne.tempo, ohne.auto.A, ohne.auto.oben, ohne.velo.A, ohne.auto.begrenzt]).toEqual([40, 35, 50, 50, null])
    // kleiner Kreisel (Aussenrand 10 m, Fahrlinie rund 46 m): Velo 50 m und Ak 50 m länger als eine Runde, auf die Runde begrenzt
    const klein = daten([ring(7.5), arm(2, 7.5, 90, 'Nordstrasse'), arm(3, 7.5, 0, 'Oststrasse'), arm(4, 7.5, 270, 'Südstrasse'), arm(5, 7.5, 180, 'Weststrasse')])
    const sk = rechneKnoten(klein, fahrbahn(10, 4, [90, 0, 270, 180]), { knoten: ringId(0), zufahrt: SUED, eingaben: { typ: null, fahrstreifen: null,
      neigungGross: null, schwerverkehr: false, neigung: { links: null, rechts: null }, kreiselTyp: 'klein', kreiselBeziehungen: Object.fromEntries(
        ['2:0:1>4:0:1', '4:0:1>2:0:1', '3:0:1>5:0:1', '5:0:1>3:0:1'].map(k => [k, false])) } }).knoten!.kreisel!.sicht!
    const runde = streckeLaenge(sk.velo.achse)
    expect(runde).toBeLessThan(50)
    expect(sk.velo.begrenzt).toEqual({ A: 50, oben: 50, grund: 'länger als eine Runde' })
    expect(sk.velo.A).toBeCloseTo(runde, 5)
    expect(sk.auto.oben).toBeCloseTo(runde, 1)
    expect(sk.annahmen.some(a => a.startsWith('Die nötige Sicht wäre länger als eine Runde'))).toBe(true)
  })
  it('Az entfällt, wenn links nur eine Ausfahrt liegt', () => {
    const oo = daten([ring(R), arm(2, R, 90, 'Nordstrasse'), arm(3, R, 0, 'Oststrasse'), arm(4, R, 270, 'Südstrasse'),
      weg(5, [ringPunkt(R, 180), [50, ...pol(R + 80, 180)]], { highway: 'residential', name: 'Weststrasse', oneway: 'yes' })])
    const s = rechne([], 'klein', oo).sicht!
    expect([s.az, s.azGrund]).toEqual([null, 'Links liegt nur eine Ausfahrt (Arm 4 Weststrasse (West)): keine Zufahrt links, Az entfällt.'])
  })
  it('Fahrzeuge: F_A mit der Front am Ende von Ak, Velo mit dem Vorderrad am Ende seiner Linie, beide auf K zu (gegen die Linie)', () => {
    const s = rechne().sicht!
    const ende = (achse: P[], x: number) => { const q = abschneiden(achse, x); return q[q.length - 1] }
    const fa = kreiselFahrzeug(s.auto.achse, s.auto.A, faLage)!
    const front = add(fa[0], fa[1], PW_LAENGE_M / 2)
    expect(dist(front, ende(s.auto.achse, s.auto.A))).toBeLessThan(1e-6)
    expect(dist(add(front, fa[1], 1), ende(s.auto.achse, s.auto.A - 1))).toBeLessThan(0.05)
    const fv = kreiselFahrzeug(s.velo.achse, s.velo.A, veloLage)!
    expect(dist(add(fv[0], fv[1], VELO_LAENGE_M / 2), ende(s.velo.achse, s.velo.A))).toBeLessThan(1e-6)
    expect(kreiselFahrzeug(s.auto.achse, 1000, faLage)).toBeNull()
  })
  it('ohne Einfahrt: keine Sicht, Meldung; Fall-Datei: Auszug am Kreisel', () => {
    const r = rechneKnoten(o, av, { knoten: ringId(0), zufahrt: null })
    expect([r.knoten!.kreisel!.sicht, r.meldungen]).toEqual([null, [KREISEL_EINFAHRT_TEXT]])
    const a = kreiselAuszug(rechne())
    expect([a.richtungen, a.kreisel!.auto.status, a.kreisel!.az!.links, a.kreisel!.tempo]).toEqual([[], 'erfuellt', '4 Weststrasse (West)', 30])
  })
})

describe('K4: Sandrainstrasse, Einfahrt Sandrainstrasse', () => {
  const lesen = (n: string) => JSON.parse(readFileSync(new URL(`./testdaten/${n}`, import.meta.url), 'utf8'))
  const osm = osmParsen(lesen('kreisel_sandrain_osm.json'))
  const av = avParsen(lesen('kreisel_sandrain_av.json') as GeoJson)
  it('Minikreisel 30 km/h: Ak 20/35 m, Velo 25 m (nicht begrenzt), Az zur Sulgeneckstrasse 25/20 m; erfüllt', () => {
    const k0 = rechneKnoten(osm, av, { knoten: 11365036791, zufahrt: null }).knoten!.kreisel!
    const sand = nachNr(k0.arme)[1]
    const s = rechneKnoten(osm, av, { knoten: 11365036791, zufahrt: sand.key }).knoten!.kreisel!.sicht!
    expect([s.tempo, s.auto.A, s.auto.oben, s.velo.A, s.auto.begrenzt, s.azLinks, s.az!.A, s.gesamt]).toEqual([30, 20, 35, 25, null,
      '3 Sulgeneckstrasse (West)', 25, 'erfuellt'])
  })
})

describe('K4: Kreisel Schwarzenburgstrasse (Ringpunkt 1723270017): Velo 50 m auf einer Fahrlinie von rund 61 m', () => {
  const lesen = (n: string) => JSON.parse(readFileSync(new URL(`./testdaten/${n}`, import.meta.url), 'utf8'))
  const osm = osmParsen(lesen('kreisel_1723270017_osm.json'))
  const av = avParsen(lesen('kreisel_1723270017_av.json') as GeoJson)
  it('35 km/h: Ak 35,5/42,5 m und Velo 50 m in voller Länge (kürzer als eine Runde); erfüllt', () => {
    const k0 = rechneKnoten(osm, av, { knoten: 1723270017, zufahrt: null }).knoten!.kreisel!
    expect(k0.beta.tempo).toBe(35)
    for (const a of nachNr(k0.arme).filter(x => x.ein)) {
      const s = rechneKnoten(osm, av, { knoten: 1723270017, zufahrt: a.key }).knoten!.kreisel!.sicht!
      expect([s.auto.A, s.auto.oben, s.velo.A, s.auto.begrenzt, s.velo.begrenzt]).toEqual([35.5, 42.5, 50, null, null])
      expect(streckeLaenge(s.velo.achse)).toBeGreaterThan(50)
      expect([s.auto.status, s.velo.status, s.gesamt]).toEqual(['erfuellt', 'erfuellt', 'erfuellt'])
    }
  })
})
