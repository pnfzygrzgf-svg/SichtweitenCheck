// Etappe A7 (Plan «Geometrie aus der AV statt aus der OSM-Linie», 13.11.2026): der SichtweitenCheck rechnet mit dem AV-Bord statt mit
// «OSM-Linie plus AV-Sehne». Konstruierter T-Knoten wie rechnen.test.ts, jetzt mit Trottoir (Bord):
//
// Lage (Meter, x Ost, y Nord, Ursprung = OSM-Knoten der geraden Fassung):
//   Hauptstrasse West–Ost, Fahrbahn y = −3 … +3 (6 m), Trottoir beidseits 3 m; Nebenstrasse (Zufahrt) von Süden, Fahrbahn
//   x = −2,5 … +2,5 (5 m), Trottoir beidseits 3 m. Eine Fläche Strasse_Weg: der Umriss läuft an der Einmündung um die Ecke.
// Handlösung (wie rechnen.test.ts): Achse des Zufahrtsstreifens x = +1,25 (Mitte der rechten Hälfte, 1,25 m vom Bord x = 2,5);
//   Nullpunkt (1,25; −3) auf der Führungslinie y = −3 über die Einmündung; B 3,00 m → Achspunkt (1,25; −6), D 0,50 m links (0,75; −6).
//   Fahrstreifenachse von Osten (ferne Spur) y = 3 − 1,5 = 1,5, K = (1,25; 1,5); von Westen (nahe Spur) y = −1,5, K = (1,25; −1,5).
// Prüfung: dieselbe AV mit schiefer bzw. versetzter OSM-Linie → Breite, Rand, D und Sichtpunkte gleich (2 cm).

import { describe, expect, it } from 'vitest'
import { wgs, type P } from '../geo'
import type { OsmDaten, OsmWeg } from '../daten/osm'
import type { AvFlaeche } from '../daten/av'
import { rechneKnoten } from './rechnen'
import { OsmNetz } from './netz'
import { Fahrbahn } from './flaechen'
import { querschnitt, sondenRechts, amRand, fahrbahnBreite } from './hauptachsen'
import { armBord, abzweigungenAm, randDurchKnoten, ABZWEIG_NAH_M } from './bordarm'
import { PARK_SONDE_M } from './fahrstreifen'
import type { Ergebnis, RichtungErgebnis } from './typen'

const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const ll = (x: number, y: number): [number, number] => wgs(O[0] + x, O[1] + y)
const rel = (p: P): [number, number] => [p[0] - O[0], p[1] - O[1]]
function weg(id: number, knoten: [number, number, number][], tags: Record<string, string>): OsmWeg {
  return { id, tags, knoten: knoten.map(k => k[0]), geom: knoten.map(k => ll(k[1], k[2])) }
}
const osm = (haupt: [number, number, number][], neben: [number, number, number][]): OsmDaten => ({
  wege: [weg(1, haupt, { highway: 'unclassified', name: 'Hauptstrasse', maxspeed: '30' }),
    weg(2, neben, { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' })],
  tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [],
})
const W = 400
const flaeche = (art: string, ring: P[]): AvFlaeche => ({ art, kanton: 'BE', qualitaet: 'AV93', bfs: 351, ringe: [ring] })
const rechteck = (art: string, x0: number, x1: number, y0: number, y1: number) => flaeche(art, [lv(x0, y0), lv(x1, y0), lv(x1, y1), lv(x0, y1)])
/** Viertelbogen um (cx, cy) mit Radius r von w0 nach w1 [Grad], ohne Anfangspunkt */
const bogen = (cx: number, cy: number, r: number, w0: number, w1: number, n = 8): P[] =>
  Array.from({ length: n }, (_, k) => { const w = (w0 + (w1 - w0) * (k + 1) / n) * Math.PI / 180; return lv(cx + r * Math.cos(w), cy + r * Math.sin(w)) })

/** T-Knoten mit Trottoir; ecke: Eckausrundung r 3 m an der Einmündung (sonst scharfe Ecken); fussweg: Fussweg in der Fläche Strasse_Weg
 *  am Nordrand x = 20 … 23 (bis y = 12, dahinter nichts: offene Kante), daneben Trottoir und Garten */
function av(ecke = false, fussweg = false): AvFlaeche[] {
  const nord = fussweg ? [lv(W, 3), lv(23, 3), lv(23, 12), lv(20, 12), lv(20, 3), lv(-W, 3)] : [lv(W, 3), lv(-W, 3)]
  const strasse = ecke
    ? [lv(-W, -3), lv(-5.5, -3), ...bogen(-5.5, -6, 3, 90, 0), lv(-2.5, -W), lv(2.5, -W), lv(2.5, -6), ...bogen(5.5, -6, 3, 180, 90), lv(W, -3), ...nord]
    : [lv(-W, -3), lv(-2.5, -3), lv(-2.5, -W), lv(2.5, -W), lv(2.5, -3), lv(W, -3), ...nord]
  const sw = ecke ? [lv(-W, -3), lv(-5.5, -3), ...bogen(-5.5, -6, 3, 90, 0), lv(-2.5, -W), lv(-5.5, -W), lv(-5.5, -6), lv(-W, -6)]
    : [lv(-W, -3), lv(-2.5, -3), lv(-2.5, -W), lv(-5.5, -W), lv(-5.5, -6), lv(-W, -6)]
  const so = ecke ? [lv(2.5, -W), lv(2.5, -6), ...bogen(5.5, -6, 3, 180, 90), lv(W, -3), lv(W, -6), lv(5.5, -6), lv(5.5, -W)]
    : [lv(2.5, -W), lv(2.5, -3), lv(W, -3), lv(W, -6), lv(5.5, -6), lv(5.5, -W)]
  const nordFlaechen = fussweg
    ? [rechteck('Trottoir', -W, 20, 3, 6), rechteck('Gartenanlage', -W, 20, 6, 30), rechteck('Trottoir', 23, W, 3, 6), rechteck('Gartenanlage', 23, W, 6, 30)]
    : [rechteck('Trottoir', -W, W, 3, 6)]
  return [flaeche('Strasse_Weg', strasse), flaeche('Trottoir', sw), flaeche('Trottoir', so), ...nordFlaechen]
}

type Linie = [number, number, number][]
const HAUPT_GERADE: Linie = [[10, -W, 0], [12, 0, 0], [13, W, 0]]
const NEBEN_GERADE: Linie = [[12, 0, 0], [20, 0, -W]]
/** Ostarm schief: am Knoten in der Mitte, 30 m weiter 1,5 m nördlich, dann parallel; Zufahrt 30 m weiter 1,2 m westlich, dann parallel */
const HAUPT_SCHIEF: Linie = [[10, -W, 0], [12, 0, 0], [14, 30, 1.5], [13, W, 1.5]]
const NEBEN_SCHIEF: Linie = [[12, 0, 0], [21, -1.2, -30], [20, -1.2, -W]]
/** beide Linien parallel versetzt: Hauptstrasse auf y = +1, Zufahrt auf x = −1 (Knoten bei (−1; 1)) */
const HAUPT_VERSETZT: Linie = [[10, -W, 1], [12, -1, 1], [13, W, 1]]
const NEBEN_VERSETZT: Linie = [[12, -1, 1], [20, -1, -W]]
/** Zufahrt am Knoten geknickt: die ersten 4,5 m nach Südosten, dann wieder auf x = 0 */
const NEBEN_GEKNICKT: Linie = [[12, 0, 0], [22, 2, -4], [20, 0, -W]]

const rechne = (haupt: Linie, neben: Linie, flaechen = av()): Ergebnis =>
  rechneKnoten(osm(haupt, neben), flaechen, { knoten: 12, zufahrt: '2:0:1' }).ergebnis!
const richtung = (e: Ergebnis, r: 'links' | 'rechts') => e.richtungen.find(x => x.richtung === r) as RichtungErgebnis
const TOL = 0.02
const nahe = (p: P, x: number, y: number, tol = TOL, was = '') => {
  const [a, b] = rel(p)
  expect(Math.abs(a - x), `${was} x ${a} statt ${x}`).toBeLessThan(tol)
  expect(Math.abs(b - y), `${was} y ${b} statt ${y}`).toBeLessThan(tol)
}
const gleich = (p: P, q: P, was: string) => nahe(p, rel(q)[0], rel(q)[1], TOL, was)

describe('A7: Rand und Breite je Arm aus dem Bordmodell', () => {
  const netz = new OsmNetz(osm(HAUPT_GERADE, NEBEN_GERADE))
  const fb = new Fahrbahn(av())
  const kp = lv(0, 0)
  const ost = (ml: P[]) => {
    const bord = armBord(av(), ml, abzweigungenAm(netz, kp, ml, [[0, -1]]))
    return { bord, qs: querschnitt(netz, fb, ml, 1, undefined, undefined, [], bord) }
  }
  const gerade = ost([lv(0, 0), lv(270, 0)])
  const schief = ost([lv(0, 0), lv(30, 1.5), lv(270, 1.5)])

  it('gerade OSM-Linie: Breite 6,00 senkrecht zum Bord, Ränder je Stelle aus dem Bord, Quelle AV-Bord', () => {
    expect(gerade.bord).not.toBeNull()
    expect(gerade.qs.breite!).toBeCloseTo(6, 6)
    expect(fahrbahnBreite(gerade.qs)).toBeCloseTo(6, 6)
    expect(gerade.qs.bordSeiten).toEqual({ links: true, rechts: true })
    expect(gerade.qs.quelle).toMatch(/^AV-Bord \(Fahrbahn 6,0 m senkrecht zum Bord, Median aus \d+ Querschnitten; Ränder je Stelle aus dem Bord; Lage folgt der Fahrbahn\)$/)
    expect(gerade.qs.annahme).toBe(false)
  })
  it('schiefe OSM-Linie (1,5 m auf 30 m): Breite gleich wie gerade (2 cm), nicht 6 / cos', () => {
    expect(Math.abs(schief.qs.breite! - gerade.qs.breite!)).toBeLessThan(TOL)
  })
  it('Rand und Fahrstreifenachse: Parallele zum Bord, gleich für gerade und schiefe OSM-Linie', () => {
    for (const { qs, ml } of [{ ...gerade, ml: [lv(0, 0), lv(270, 0)] }, { ...schief, ml: [lv(0, 0), lv(30, 1.5), lv(270, 1.5)] }]) {
      for (const p of amRand(ml, qs, 'links', () => 0).slice(0, 200)) expect(Math.abs(rel(p)[1] - 3)).toBeLessThan(TOL)
      for (const p of amRand(ml, qs, 'links', () => 1.5).slice(0, 200)) expect(Math.abs(rel(p)[1] - 1.5)).toBeLessThan(TOL)
      // Rand rechts von u (Süden): über die Einmündung der Zufahrt gerade (Führungslinie), schon ab dem Knoten
      for (const p of amRand(ml, qs, 'rechts', () => 0).slice(0, 60)) expect(Math.abs(rel(p)[1] + 3)).toBeLessThan(TOL)
    }
  })
  it('Parkierungssonden PARK_SONDE_M senkrecht innerhalb des gemessenen Rands (auch bei schiefer OSM-Linie)', () => {
    for (const { qs, ml } of [{ ...gerade, ml: [lv(0, 0), lv(270, 0)] }, { ...schief, ml: [lv(0, 0), lv(30, 1.5), lv(270, 1.5)] }]) {
      const s = sondenRechts(ml, qs, 50)
      expect(s.length).toBe(26)
      for (const p of s) expect(Math.abs(rel(p)[1] - (3 - PARK_SONDE_M))).toBeLessThan(1e-6)
    }
  })
  it('Teilung der Fahrbahn nach 50 m: Bord nur bis zur Teilung, dahinter wie bisher aus den Sehnen', () => {
    const ml: P[] = [lv(0, 0), lv(270, 0)]
    const bord = armBord(av(), ml, abzweigungenAm(netz, kp, ml, [[0, -1]]))
    const qs = querschnitt(netz, fb, ml, 1, undefined, undefined, [50], bord)
    expect(qs.quelle).toContain('ab der Teilung der Fahrbahn nach 50 m aus den AV-Sehnen wie bisher')
    expect(qs.bord!.fuehrung('links', 40)).not.toBeNull()
    expect(qs.bord!.fuehrung('links', 60)).toBeNull()
    expect(qs.bord!.luecke('links', 0, 100)).toBe(0)
  })
  it('Abzweigungen: Zufahrt als Arm des Knotens (Seite rechts), Gegenrichtung nicht; der eigene Weg nicht', () => {
    const ml: P[] = [lv(0, 0), lv(270, 0)]
    const z = abzweigungenAm(netz, kp, ml, [[0, -1], [-1, 0]])
    expect(z.length).toBeGreaterThan(0)
    // jede Abzweigung liegt am Knoten und zeigt nach Süden (weiter als ABZWEIG_NAH_M neben der Linie)
    for (const x of z) {
      nahe(x.p, 0, 0, 1e-6)
      expect(rel(x.arm!)[1]).toBeLessThan(-ABZWEIG_NAH_M)
    }
  })
})

describe('A7: dieselbe AV mit schiefer bzw. versetzter OSM-Linie → derselbe Rand, D und dieselben Sichtpunkte', () => {
  const a = rechne(HAUPT_GERADE, NEBEN_GERADE)
  const faelle: [string, Ergebnis][] = [['schief', rechne(HAUPT_SCHIEF, NEBEN_SCHIEF)], ['versetzt', rechne(HAUPT_VERSETZT, NEBEN_VERSETZT)]]

  it('gerade OSM-Linie: Handlösung (Nullpunkt, D, K) und Quelle der Zufahrtsachse aus dem Bord', () => {
    nahe(a.nullpunkt, 1.25, -3)
    nahe(a.rand, 1.25, -3)
    nahe(a.Dachse, 1.25, -6)
    nahe(a.D, 0.75, -6)
    nahe(richtung(a, 'rechts').K, 1.25, 1.5)
    nahe(richtung(a, 'links').K, 1.25, -1.5)
    for (const p of a.zufahrtAchse) expect(Math.abs(rel(p)[0] - 1.25)).toBeLessThan(TOL)
    expect(a.zufahrtLageQuelle).toBe('Achse des Zufahrtsstreifens parallel zum AV-Bord rechts, 1,25 m davon (Fahrbahn 5,0 m senkrecht zum ' +
      'Bord im Median, 16 Querschnitte, Mitte der rechten Hälfte; am Nullpunkt 1,25 m rechts der OSM-Achse)')
    expect(richtung(a, 'rechts').lageQuelle).toContain('AV-Bord (Fahrbahn 6,0 m senkrecht zum Bord')
    expect(a.bBezug?.quelle).toContain('aus dem AV-Bord')
    expect(a.einbiegewinkel).toBeCloseTo(90, 6)
  })
  for (const [name, b] of faelle) {
    it(`${name}: Nullpunkt, Rand, D und Achspunkt gleich wie gerade (2 cm)`, () => {
      gleich(b.nullpunkt, a.nullpunkt, 'Nullpunkt')
      gleich(b.rand, a.rand, 'Rand')
      gleich(b.D, a.D, 'D')
      gleich(b.Dachse, a.Dachse, 'Dachse')
      for (const p of b.bBezug!.linie) expect(Math.abs(rel(p)[1] + 3), 'Rand für B auf y = −3').toBeLessThan(TOL)
      for (const p of b.zufahrtAchse) expect(Math.abs(rel(p)[0] - 1.25), 'Zufahrtsachse x = 1,25').toBeLessThan(TOL)
    })
    it(`${name}: K und Sichtpunkte beider Richtungen gleich wie gerade (2 cm), Fahrstreifenachse parallel zum Bord`, () => {
      for (const r of ['links', 'rechts'] as const) {
        const x = richtung(a, r), y = richtung(b, r)
        gleich(y.K, x.K, `K ${r}`)
        expect(y.sichtpunkte.length).toBe(x.sichtpunkte.length)
        y.sichtpunkte.forEach((p, i) => gleich(p, x.sichtpunkte[i], `Sichtpunkt ${r} ${i}`))
        for (const p of y.achse) expect(Math.abs(rel(p)[1] - (r === 'rechts' ? 1.5 : -1.5)), `Achse ${r}`).toBeLessThan(TOL)
        expect(y.vorhanden).toBeCloseTo(x.vorhanden, 1)
      }
    })
    it(`${name}: Einbiegewinkel aus den Bordrichtungen 90°`, () => {
      expect(Math.abs(b.einbiegewinkel - 90)).toBeLessThan(0.1)
    })
  }
})

describe('A7: Armrichtung bei geknickter OSM-Linie am Knoten aus dem Bord', () => {
  it('Zufahrt die ersten 4,5 m schräg: OSM-Sehne über 10° schief, Einbiegewinkel aus dem Bord 90°; D wie gerade', () => {
    const netz = new OsmNetz(osm(HAUPT_GERADE, NEBEN_GEKNICKT))
    const r = netz.armRichtung([2, 0, 1])
    // Richtung der OSM-Linie (10-m-Sehne) um mehr als 10° neben Süden
    expect(Math.abs(Math.atan2(r[0], -r[1]) * 180 / Math.PI)).toBeGreaterThan(10)
    const e = rechne(HAUPT_GERADE, NEBEN_GEKNICKT)
    expect(Math.abs(e.einbiegewinkel - 90)).toBeLessThan(0.1)
    expect(e.herleitung!.some(h => h.startsWith('Einbiegewinkel rund 90°: Armrichtungen aus dem AV-Bord'))).toBe(true)
    nahe(e.D, 0.75, -6)
    nahe(e.nullpunkt, 1.25, -3)
  })
})

describe('A7: Einmündung, deren Umriss um die Ecke läuft (Eckausrundung r 3 m)', () => {
  const e = rechne(HAUPT_GERADE, NEBEN_GERADE, av(true))
  it('Rand für B gerade über die Einmündung (nicht auf dem Eckbogen); Nullpunkt und D wie Handlösung', () => {
    nahe(e.nullpunkt, 1.25, -3)
    nahe(e.D, 0.75, -6)
    for (const p of e.bBezug!.linie) expect(Math.abs(rel(p)[1] + 3)).toBeLessThan(TOL)
  })
  it('Zufahrtsachse bis zum Knoten parallel zum Bord (x = 1,25), Fahrstreifenachsen auf y = ±1,5', () => {
    for (const p of e.zufahrtAchse) expect(Math.abs(rel(p)[0] - 1.25)).toBeLessThan(TOL)
    for (const r of ['links', 'rechts'] as const) for (const p of richtung(e, r).achse)
      expect(Math.abs(rel(p)[1] - (r === 'rechts' ? 1.5 : -1.5))).toBeLessThan(TOL)
    expect(Math.abs(e.einbiegewinkel - 90)).toBeLessThan(0.1)
  })
  it('schiefe OSM-Linie an derselben Einmündung: gleiche Werte (2 cm)', () => {
    const b = rechne(HAUPT_SCHIEF, NEBEN_SCHIEF, av(true))
    gleich(b.nullpunkt, e.nullpunkt, 'Nullpunkt')
    gleich(b.D, e.D, 'D')
    richtung(b, 'rechts').sichtpunkte.forEach((p, i) => gleich(p, richtung(e, 'rechts').sichtpunkte[i], `Sichtpunkt ${i}`))
  })
})

describe('A7: Fussweg in der Fläche Strasse_Weg (seit Nachtrag B, BK3: Öffnung in der Bordflucht, überbrückt)', () => {
  const e = rechne(HAUPT_GERADE, NEBEN_GERADE, av(false, true))
  const r = richtung(e, 'rechts')
  it('Fahrstreifenachse von Osten läuft über die Lücke (x = 20 … 23) wie bisher weiter (y = 1,5)', () => {
    for (const p of r.achse) expect(Math.abs(rel(p)[1] - 1.5), `y bei x ${rel(p)[0]}`).toBeLessThan(TOL)
  })
  it('kein Rückfall auf OSM mehr: der Bord läuft nach dem Fussweg in derselben Flucht weiter (Öffnung), kein Hinweis «ohne AV-Bord» ' +
    '(vorher: rechter Fahrbahnrand in der Lücke aus OSM geschätzt); der Rückfall bei «Rand unbekannt» bleibt (z. B. Knoten 2860577444)', () => {
    expect(r.hinweise.some(h => h.includes('ohne AV-Bord'))).toBe(false)
    expect(r.lageQuelle).not.toContain('Lücken im Bord (Rand unbekannt)')
    expect(richtung(e, 'links').hinweise.some(h => h.includes('ohne AV-Bord'))).toBe(false)
  })
})

describe('A7: Rand für B über die Einmündung (randDurchKnoten)', () => {
  const stationen = (a: P, d: P, n: number): P[] => Array.from({ length: n }, (_, i) => [a[0] + d[0] * i, a[1] + d[1] * i] as P)
  it('gerade Strasse: Anschlusspunkte (−2,5; −3) und (2,5; −3) → Gerade auf y = −3', () => {
    const a0 = { s: 3, p: lv(-2.5, -3), d: [-1, 0] as P }, a1 = { s: 3, p: lv(2.5, -3), d: [1, 0] as P }
    const l = randDurchKnoten(stationen(lv(0.5, -3), [-1, 0], 60), a0, stationen(lv(-0.5, -3), [1, 0], 60), a1)
    for (const p of l) expect(Math.abs(rel(p)[1] + 3)).toBeLessThan(1e-9)
    expect(rel(l[0])[0]).toBeCloseTo(-58.5, 9)
    expect(rel(l[l.length - 1])[0]).toBeCloseTo(58.5, 9)
  })
  it('Strasse im Bogen (Radius 50 m, Anschlusspunkte je 12° neben dem Scheitel): Kurve höchstens 1 cm neben dem Bogen, die gerade ' +
    'Verlängerung eines Arms bis zum Scheitel über 1 m daneben', () => {
    const R = 50, w = 12 * Math.PI / 180, auf = (a: number): P => lv(R * Math.sin(a), R * Math.cos(a) - R)
    const a0 = { s: 10, p: auf(-w), d: [-Math.cos(w), -Math.sin(w)] as P }, a1 = { s: 10, p: auf(w), d: [Math.cos(w), -Math.sin(w)] as P }
    const l = randDurchKnoten([a0.p], { ...a0, s: 0 }, [a1.p], { ...a1, s: 0 })
    for (const p of l) expect(Math.abs(Math.hypot(rel(p)[0], rel(p)[1] + R) - R)).toBeLessThan(0.01)
    // gerade Verlängerung von a0 bis zum Scheitel (x = 0): Abstand zum Bogen R (1 / cos 12° − 1) = 1,1 m
    const t = R * Math.sin(w) / Math.cos(w), gerade = [rel(a0.p)[0] + Math.cos(w) * t, rel(a0.p)[1] + Math.sin(w) * t]
    expect(Math.hypot(gerade[0], gerade[1] + R) - R).toBeGreaterThan(1)
  })
})
