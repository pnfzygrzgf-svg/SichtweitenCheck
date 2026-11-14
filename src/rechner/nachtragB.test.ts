// Nachtrag B (Plan «Geometrie aus der AV statt aus der OSM-Linie», VeloroutenCheckWeb/docs/plan_av_geometrie.md, 14.11.2026): B0 Testdaten
// und B1 Fehlernachweis an echten Fällen, BEVOR am Rechencode etwas geändert wird. Diese Datei ändert nichts an der Rechnung: sie hält den
// heutigen Stand (A7 mit den Baustein-Nachträgen) mit Zahlen fest («Ist») und legt die Erwartung als ausdrücklich markierte Soll-Tests ab.
// Soll-Tests laufen mit it.fails: sie bestehen, solange der Fehler besteht, und werden rot, sobald die Rechnung das Soll erreicht – dann
// in ein gewöhnliches it umwandeln und die zugehörigen Ist-Tests streichen.
//
// Testdaten (testdaten/knoten_<id>_*, abgerufen am 14.11.2026 wie die App, © OpenStreetMap-Mitwirkende, ODbL; AV Kanton Bern über
// geodienste.ch; Geodaten Stadt Bern): _osm (Overpass, overpassAbfrageKnoten(id, 300)), _av (WFS LCSF ±150 m, Eigenschaften gekürzt wie die
// Kreisel-Testdaten), _vsig (Geoportal Stadt Bern, V_sig ±150 m), _park (amtliche Parkfelder Stadt Bern ±150 m, KatasterFeld[]), _fall
// (Falleinstellungen), _soll (Soll-Fahrlinie der beiden Bildfälle, Herleitung in der Datei). knoten_alt_47576f8.json: Ergebnis des letzten
// Commits (vor A7) mit denselben Daten, gerechnet in einer Kopie des Commits.
//
// Werte ausgeben: NACHTRAG_B_AUSGABE=1 npx vitest run src/rechner/nachtragB.test.ts

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { lv95, wgs, dist, type P } from '../geo'
import { osmParsen } from '../daten/osm'
import { avParsen, type AvFlaeche, type GeoJson } from '../daten/av'
import { vsigRechnung, vsigAusGeoportal, bernZustaendig, type ArcgisGeoJson } from '../daten/vsig'
import { parkQuelleAmOrt } from '../daten/parkLuzern'
import type { KatasterFeld } from '../daten/parkkataster'
import { rechneKnoten, kontextBauen } from './rechnen'
import { armMittellinieMitEnde } from './hauptachsen'
import { armBord, abzweigungenAm, durchgehendeAchse, type ArmBord } from './bordarm'
import { abschneiden } from './netz'
import { ZIEL_FAKTOR, TAB1, TAB1_MAX } from './sichtweite'
import type { ArmInfo, Ergebnis, HindernisEingaben, Rechnung, RichtungErgebnis } from './typen'

const AUSGABE = !!process.env.NACHTRAG_B_AUSGABE
const zeige = (...x: unknown[]) => { if (AUSGABE) console.log(...x) }
const lesen = (n: string) => JSON.parse(readFileSync(new URL(`./testdaten/${n}`, import.meta.url), 'utf8'))
interface FallDatei { knoten: number; zufahrten: (string | null)[]; avZentrum: P; avRadius: number }
interface SollDatei { richtung: 'links' | 'rechts'; randAbstand: number; sollFuehrung: P[]; sollFahrlinie: P[]; ableitung: string[] }
interface AltRichtung { richtung: string; arm: string; A: number; vorhanden: number; sMax: number; status: string; K: P; fa: P; achse: P[] }
interface AltFall { nullpunkt: P; rand: P; D: P; Dachse: P; B: number; richtungen: AltRichtung[] }
const ALT: Record<string, AltFall> = lesen('knoten_alt_47576f8.json').faelle
/** wie rechnen.ts ARM_LAENGE_M (Länge der Mittellinie der vortrittsberechtigten Arme) */
const ARM_LAENGE_M = Math.ceil(ZIEL_FAKTOR * TAB1[TAB1_MAX][1]) + 60

type OsmRoh = { elements: Record<string, unknown>[] }
/** Rechnung wie die App ohne Handeingaben: V_sig nur in Bern (bernZustaendig), amtliche Parkfelder nur mit Quelle am Ort (parkQuelleAmOrt) */
function rechne(id: number, zufahrt: string | null, osmRoh: OsmRoh = lesen(`knoten_${id}_osm.json`)) {
  const f: FallDatei = lesen(`knoten_${id}_fall.json`)
  const osm = osmParsen(osmRoh as unknown as Parameters<typeof osmParsen>[0]), av: AvFlaeche[] = avParsen(lesen(`knoten_${id}_av.json`) as GeoJson)
  const tempoAmtlich = bernZustaendig(f.avZentrum, av) ? vsigRechnung(vsigAusGeoportal(lesen(`knoten_${id}_vsig.json`) as ArcgisGeoJson), f.avZentrum, 150) : null
  const pq = parkQuelleAmOrt(av.map(x => x.bfs))
  const hindernisse: HindernisEingaben = { hindernisse: [], verworfen: [], baeume: null,
    park: pq ? { felder: lesen(`knoten_${id}_park.json`) as KatasterFeld[], quellenangabe: pq.quellenangabe } : null }
  const r: Rechnung = rechneKnoten(osm, av, { knoten: id, zufahrt, avZentrum: f.avZentrum, tempoAmtlich, hindernisse }, null, f.avRadius)
  return { r, e: r.ergebnis as Ergebnis, k: kontextBauen(osm, av), f }
}
const gemerkt = new Map<string, ReturnType<typeof rechne>>()
const fall = (id: number, zufahrt: string | null = null) => {
  const key = `${id}|${zufahrt}`
  if (!gemerkt.has(key)) gemerkt.set(key, rechne(id, zufahrt))
  return gemerkt.get(key)!
}
const richtung = (e: Ergebnis, r: string) => e.richtungen.find(x => x.richtung === r) as RichtungErgebnis
/** Bordmodell eines Arms wie rechnen.ts bordAm (OSM-Linie ARM_LAENGE_M, Abzweigungen = übrige Arme und OSM-Wege entlang des Arms) */
function armBordVon(x: ReturnType<typeof rechne>, key: string, ml: P[] | null = null): ArmBord {
  const info = x.r.knoten!, a = info.arme.find(b => b.key === key) as ArmInfo
  const linie = ml ?? armMittellinieMitEnde(x.k.netz, x.k.achsen, a, ARM_LAENGE_M).linie
  const andere = ml ? [info.arme.find(b => b.key === info.vorschlag)!.richtung] : info.arme.filter(b => b.key !== key).map(b => b.richtung)
  return armBord(x.k.av, linie, abzweigungenAm(x.k.netz, info.p, linie, andere))!
}
/** Bordmodell eines Arms der Vortrittsstrasse wie rechnen.ts seit SK1: durchgehende Achse über den Gegenarm (VORLAUF_M), Abzweigungen ohne
 *  den Gegenarm; Stationen ab dem Knoten */
function bordWieRechnung(x: ReturnType<typeof rechne>, key: string, gegenKey: string): ArmBord {
  const info = x.r.knoten!, arm = (k: string) => info.arme.find(b => b.key === k) as ArmInfo
  const ml = armMittellinieMitEnde(x.k.netz, x.k.achsen, arm(key), ARM_LAENGE_M).linie
  const mlG = armMittellinieMitEnde(x.k.netz, x.k.achsen, arm(gegenKey), ARM_LAENGE_M).linie
  return armBord(x.k.av, ml, abzweigungenAm(x.k.netz, info.p, durchgehendeAchse(ml, mlG).achse,
    info.arme.filter(b => b.key !== key && b.key !== gegenKey).map(b => b.richtung)), mlG)!
}
/** durchgehende Achse: je 100 m beidseits des Knotens (Gegenarm umgekehrt, dann der Arm); Abzweigung nur die Zufahrt */
function durchgehend(x: ReturnType<typeof rechne>, key: string, gegenKey: string): { b: ArmBord; sK: number } {
  const info = x.r.knoten!, arm = (k: string) => info.arme.find(b => b.key === k) as ArmInfo
  const ml = armMittellinieMitEnde(x.k.netz, x.k.achsen, arm(key), ARM_LAENGE_M).linie
  const mlG = armMittellinieMitEnde(x.k.netz, x.k.achsen, arm(gegenKey), ARM_LAENGE_M).linie
  const durch = [...abschneiden(mlG, 100).slice().reverse(), ...abschneiden(ml, 100).slice(1)]
  const b = armBordVon(x, key, durch)
  return { b, sK: b.modell.achse.station(info.p).s }
}
function abstand(p: P, l: readonly P[]): number {
  let best = Infinity
  for (let i = 0; i < l.length - 1; i++) {
    const a = l[i], v: P = [l[i + 1][0] - a[0], l[i + 1][1] - a[1]], l2 = v[0] ** 2 + v[1] ** 2
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / l2)) : 0
    best = Math.min(best, Math.hypot(p[0] - a[0] - v[0] * t, p[1] - a[1] - v[1] * t))
  }
  return best
}
const nahe = (p: P | null | undefined, q: P, tol = 0.02) => { expect(p).toBeTruthy(); expect(dist(p!, q), `(${p![0].toFixed(2)}, ${p![1].toFixed(2)})`).toBeLessThan(tol) }
/** Punkte der Fahrlinie ab K je Meter bis bis */
function jeMeter(l: P[], bis: number): P[] {
  const aus: P[] = [l[0]]
  let s = 0, ziel = 1
  for (let i = 1; i < l.length && ziel <= bis; i++) {
    const d = dist(l[i - 1], l[i])
    while (ziel <= s + d && ziel <= bis) { const t = (ziel - s) / d; aus.push([l[i - 1][0] + (l[i][0] - l[i - 1][0]) * t, l[i - 1][1] + (l[i][1] - l[i - 1][1]) * t]); ziel++ }
    s += d
  }
  return aus
}
/** Eckpunkte der Fahrlinie ab K bis zur Bogenlänge bis und dazu je Meter (der grösste Abstand liegt oft an einer Ecke) */
function bis(l: P[], b: number): P[] {
  const aus: P[] = [...jeMeter(l, b)]
  let s = 0
  for (let i = 0; i < l.length; i++) { if (i) s += dist(l[i - 1], l[i]); if (s > b) break; aus.push(l[i]) }
  return aus
}
/** grösste Richtungsänderung der Fahrlinie zwischen zwei aufeinanderfolgenden Metern [Grad] und wo (m ab K) */
function knick(l: P[]): { grad: number; bei: number } {
  let grad = 0, bei = 0
  for (let i = 1; i + 1 < l.length; i++) {
    const a = Math.atan2(l[i][1] - l[i - 1][1], l[i][0] - l[i - 1][0]), b = Math.atan2(l[i + 1][1] - l[i][1], l[i + 1][0] - l[i][0])
    const w = Math.abs(((b - a) * 180 / Math.PI + 540) % 360 - 180)
    if (w > grad) { grad = w; bei = i }
  }
  return { grad, bei }
}
/** grösster Abstand der Punkte zur Linie */
const maxAbstand = (pts: P[], l: readonly P[]) => Math.max(...pts.map(p => abstand(p, l)))
/** Stationen von bis bis ohne Führungspunkt bzw. grösster Abstand der Führungspunkte zur Linie */
function fuehrungGegen(b: ArmBord, seite: 'links' | 'rechts', von: number, bis: number, l: readonly P[], s0 = 0) {
  const ohne: number[] = []
  let max = 0, bei = -1
  for (let s = von; s <= bis; s++) {
    const f = b.fuehrung(seite, s0 + s)
    if (!f) { ohne.push(s); continue }
    const d = abstand(f.p, l)
    if (d > max) { max = d; bei = s }
  }
  return { ohne, max, bei }
}
/** OSM-Rohdaten in LV95 umgerechnet (alle Knoten und Weggeometrien) */
function osmVerschoben(id: number, f: (p: P) => P): OsmRoh {
  const roh: OsmRoh = lesen(`knoten_${id}_osm.json`)
  const t = (lat: number, lon: number) => { const [e, n] = f(lv95(lat, lon)); const [la, lo] = wgs(e, n); return { lat: la, lon: lo } }
  return { ...roh, elements: roh.elements.map(e => ({ ...e, ...(typeof e.lat === 'number' ? t(e.lat, e.lon as number) : {}),
    ...(Array.isArray(e.geometry) ? { geometry: (e.geometry as ({ lat: number; lon: number } | null)[]).map(g => (g ? t(g.lat, g.lon) : g)) } : {}) })) }
}

// ───────────────────────────────────────────────────────────────────────────────────────────── B0
describe('B0: Testdaten der fünf Prüffälle (SWC-Teil: vier Knoten)', { timeout: 60_000 }, () => {
  for (const [id, vorschlag] of [[3339261361, '428170764:0:1'], [282774166, '52985434:11:-1'], [568814986, null], [1021708, null]] as const) {
    it(`${id}: Fixture vollständig, Knoten in OSM, AV-Ausschnitt reicht (kein Nachladen), Zufahrten wie in der Falldatei`, () => {
      const f: FallDatei = lesen(`knoten_${id}_fall.json`)
      expect(f.knoten).toBe(id)
      for (const z of f.zufahrten) {
        const x = fall(id, z)
        expect(x.r.knoten?.id).toBe(id)
        expect(x.e).toBeTruthy()
        expect(x.e.avBedarf).toBeLessThanOrEqual(f.avRadius)
        if (z === null) expect(x.r.knoten?.vorschlag).toBe(vorschlag)
      }
    })
  }
  it('Soll-Dateien der beiden Bildfälle: Polylinien in LV95, Herleitung dokumentiert, Fahrlinie im Fahrstreifenabstand der Rechnung', () => {
    for (const id of [3339261361, 282774166]) {
      const s: SollDatei = lesen(`knoten_${id}_soll.json`)
      expect(s.sollFuehrung.length).toBeGreaterThan(10)
      expect(s.ableitung.length).toBeGreaterThan(5)
      expect(s.randAbstand).toBe(richtung(fall(id).e, s.richtung).randAbstand)
      for (const p of s.sollFahrlinie.slice(1, -1)) expect(Math.abs(abstand(p, s.sollFuehrung) - s.randAbstand)).toBeLessThan(0.02)
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────────────────────── S4
describe('S4: Knoten 282774166, Fahrlinie mit Vortritt von Osten (Arm 1 Schwarzenburgstrasse Nordost)', { timeout: 60_000 }, () => {
  const ARM = '313532074:2:-1', GEGEN = '160262782:0:1'
  const x = () => fall(282774166), rr = () => richtung(x().e, 'links'), b = () => armBordVon(x(), ARM)
  const soll = (): SollDatei => lesen('knoten_282774166_soll.json')
  it('die Achse des Arms endet NICHT an der Einmündung (531,97 m, durch den Eigerplatz); die Einmündung des Bürkiwegs (OSM-Knoten ' +
    '32985984, s 28,27) ist als Abzweigung auf beiden Seiten übergeben und links als Einmündung erkannt und verbunden', () => {
    const m = b().modell
    expect(m.achse.laenge).toBeCloseTo(531.97, 1)
    const ab = abzweigungenAm(x().k.netz, x().r.knoten!.p, m.achse.achse, x().r.knoten!.arme.filter(a => a.key !== ARM).map(a => a.richtung))
    const buerki = ab.filter(z => dist(z.p, [2599322.08, 1198744.76]) < 0.02)
    expect(buerki.map(z => (m.achse.station(z.arm!).q - m.achse.station(z.p).q >= 0 ? 'links' : 'rechts')).sort()).toEqual(['links', 'rechts'])
    const e = m.abweichungen.find(a => a.seite === 'links' && a.art === 'einmuendung' && a.s0 > 20 && a.s0 < 30)!
    expect([e.s0, e.s1]).toEqual([expect.closeTo(23.57, 1), expect.closeTo(32.49, 1)])
    expect(e.verbunden).toBe(true)
    expect(e.grund).toContain('OSM-Abzweigung')
    zeige('S4 Abweichung links', e)
  })
  it('BK1 (vorher erste falsche Station s 25): der Absatz des Rands (88°, 2,42 m nach aussen, Nachbar Gartenanlage), 0,52 m flach und die ' +
    'Ausrundung in den Bürkiweg sind eine Flanke; A liegt vor dem Absatz auf der Trottoirkante (vorher q 7,73 an der Flankenecke), ' +
    's 24, 25 und 31 haben einen Führungspunkt auf der Trottoirflucht', () => {
    const bb = b(), m = bb.modell
    for (const s of [24, 25, 31]) expect(bb.fuehrung('links', s)!.quer).toBeCloseTo(s < 30 ? 5.23 : 5.08, 1)
    const e = m.abweichungen.find(a => a.seite === 'links' && a.art === 'einmuendung' && a.s0 > 20 && a.s0 < 30)!
    nahe(e.von, [2599315.31, 1198746.72])           // A: q 5,25, Trottoir 1,33 m vor der Ecke (ANKER_SONDE_M)
    nahe(e.bis, [2599322.85, 1198751.30])           // B: q 5,06, Trottoir nach der Mündung
    const trottoirEcke: P = [2599316.47, 1198747.39]  // letzte Ecke des Trottoirbords vor dem Absatz, q 5,20
    expect(m.rand.links.teile[0].some(p => dist(p, trottoirEcke) < 0.01)).toBe(true)   // der gemessene Rand folgt weiter dem Absatz
    expect(abstand(trottoirEcke, [e.von!, e.bis!])).toBeLessThan(0.05)
  })
  it('BK1 mit der Armachse wie mit durchgehender Achse (je 100 m beidseits des Knotens): Führung höchstens 0,05 m von der Soll-Führung ' +
    '(vorher je 2,42 m bei s 25), überall ein Führungspunkt; der Rand für B liegt auf der Soll-Führung', () => {
    const d = durchgehend(x(), ARM, GEGEN), arm = fuehrungGegen(b(), 'links', 20, 36, soll().sollFuehrung)
    const mit = fuehrungGegen(d.b, 'links', 20, 36, soll().sollFuehrung, d.sK)
    expect(arm.max).toBeLessThan(0.05); expect(arm.ohne).toEqual([])
    expect(mit.max).toBeLessThan(0.05); expect(mit.ohne).toEqual([])
    expect(maxAbstand(x().e.bBezug!.linie, soll().sollFuehrung)).toBeLessThan(0.01)
    zeige('S4 Abweichung Führung–Soll Armachse / durchgehend', arm, mit)
  })
  it('Soll (Nachtrag B, B4): Führungslinie links von s 0 bis 60 an jeder Station vorhanden und höchstens 0,30 m von der Soll-Führung ' +
    '(Übergang s 24 → 25: die beiden Trottoirabschnitte gerade verbunden)', () => {
    const g = fuehrungGegen(b(), 'links', 0, 60, soll().sollFuehrung)
    expect(g.ohne).toEqual([])
    expect(g.max).toBeLessThanOrEqual(0.3)
  })
  it('Soll (Nachtrag B, B4/B5): Fahrlinie von K bis zum letzten Sichtpunkt höchstens 0,30 m von der Soll-Fahrlinie, ohne Haken ' +
    '(Richtungsänderung je Meter unter 10°): sie hält ihren Fahrstreifen', () => {
    const r = rr()
    expect(maxAbstand(bis(r.achse, r.sMax), soll().sollFahrlinie)).toBeLessThanOrEqual(0.3)
    expect(knick(jeMeter(r.achse, r.sMax)).grad).toBeLessThan(10)
  })
  it('Kette nach BK1: K 0,02 m neben der Soll-Fahrlinie, Sichtweite 53 m (massgebend 28 m, erfüllt), letzter Sichtpunkt wieder wie im ' +
    'letzten Commit (vorher 5,43 m näher am Knoten)', () => {
    const r = rr(), alt = ALT['282774166|vorschlag'].richtungen.find(y => y.richtung === 'links')!
    expect(abstand(r.K, soll().sollFahrlinie)).toBeLessThan(0.05)
    expect([r.massgebend, r.vorhanden, r.status]).toEqual([28, 53, 'erfuellt'])
    expect(dist(r.sichtpunkte[r.sichtpunkte.length - 1], [2599337.94, 1198758.24])).toBeLessThan(0.05)
    expect(dist(r.K, alt.K)).toBeCloseTo(0.13, 1)
    expect(dist(x().e.D, ALT['282774166|vorschlag'].D)).toBeCloseTo(0.41, 1)
  })
})

// ───────────────────────────────────────────────────────────────────────────────────────────── S2/S3
describe('S2/S3: Philosophenweg 3339261361, Fahrlinie mit Vortritt von Westen (Arm 3), Fahrzeug bei D (Arm 2)', { timeout: 60_000 }, () => {
  const ARM = '26199847:0:1', GEGEN = '52061075:9:-1'
  const x = () => fall(3339261361), rr = () => richtung(x().e, 'links'), b = () => armBordVon(x(), ARM)
  const soll = (): SollDatei => lesen('knoten_3339261361_soll.json')
  const altFall = () => ALT['3339261361|vorschlag'], altR = () => altFall().richtungen.find(y => y.richtung === 'links')!
  it('nur Armachse (Diagnose; die Rechnung nutzt seit SK1 die durchgehende Achse): A ist der Rest des Ostrands der Seitenstrasse, am ' +
    'Achsanfang abgeschnitten (q 13,5 m, 72,7° zur Achse), Führung die Diagonale A–B 15,92 m. Die Reststück-Regel (BK2a) behob das, ' +
    'verlängerte aber im fgsCheck die Querung am Berner Ort 1416 von 18,13 auf 36,8 m und ist zurückgestellt', () => {
    const m = b().modell
    const e = m.abweichungen.find(a => a.seite === 'links' && a.art === 'einmuendung' && a.s0 < 1)!
    expect(e.s1).toBeCloseTo(12.73, 1)
    expect(e.verbunden).toBe(true)
    nahe(e.von, [2599500.57, 1198985.13])
    nahe(e.bis, [2599489.51, 1198996.58])
    const v = m.fuehrung.links.verbindungen.find(y => dist(y.von, e.von!) < 0.01)!
    expect(dist(v.von, v.bis)).toBeCloseTo(15.92, 1)
    const arm = fuehrungGegen(b(), 'links', 0, 20, soll().sollFuehrung)
    expect(arm.ohne).toEqual([0, 8, 9, 10, 11, 12]); expect(arm.max).toBeCloseTo(9.01, 1)
  })
  it('SK1: mit der durchgehenden Achse der Rechnung (Gegenarm 50 m) wie mit je 100 m beidseits liegt die Führung höchstens 0,06 m von der ' +
    'Geraden zwischen den Trottoirkanten, überall ein Führungspunkt; die Einmündung reicht seit S8 von s −15,95 (vorher −14,37: Anfang des ' +
    'Suchfensters, Plan S7; der Bord biegt dort mit R ≈ 32 m in die Seitenstrasse, Flanke nahe der Abzweigung ab 20°) bis 12,73', () => {
    const r = fuehrungGegen(bordWieRechnung(x(), ARM, GEGEN), 'links', 0, 20, soll().sollFuehrung)
    expect(r.ohne).toEqual([]); expect(r.max).toBeLessThan(0.06)
    const d = durchgehend(x(), ARM, GEGEN), mit = fuehrungGegen(d.b, 'links', 0, 20, soll().sollFuehrung, d.sK)
    expect(mit.ohne).toEqual([]); expect(mit.max).toBeLessThan(0.06)
    const e = d.b.modell.abweichungen.find(a => a.seite === 'links' && a.art === 'einmuendung' && a.s0 < d.sK && a.s1 > d.sK)!
    expect([e.s0 - d.sK, e.s1 - d.sK]).toEqual([expect.closeTo(-15.95, 1), expect.closeTo(12.73, 1)])
  })
  it('Kette (BK1, SK1, S8): K 0,06 m neben der Soll-Fahrlinie (vorher 7,59 m in der Seitenstrasse), 1,19 m vom K des letzten Commits; ' +
    'vorhandene Sichtweite von Westen 29,72 m (letzter Commit 30,16 m, nach SK1 28,28 m, fehlerhafter Zwischenstand 22,96 m), Status «massgebend»', () => {
    const r = rr()
    expect(abstand(r.K, soll().sollFahrlinie)).toBeLessThan(0.06)
    expect(dist(r.K, altR().K)).toBeCloseTo(1.19, 1)
    expect(dist(x().e.D, altFall().D)).toBeCloseTo(0.58, 1)
    expect(altR().vorhanden).toBeCloseTo(30.16, 1); expect(r.vorhanden).toBeCloseTo(29.72, 1)
    expect([altR().status, r.status]).toEqual(['massgebend', 'massgebend'])
    expect(abstand(altR().K, soll().sollFahrlinie)).toBeLessThan(0.6)                 // letzter Commit: K auf dem südlichen Fahrstreifen
    expect(r.hinweise.some(h => h.includes('Fahrbahnrand'))).toBe(false)               // vorher «Rechter Fahrbahnrand auf 6 m … aus OSM»
  })
  it('S3 nach der Korrektur: Nullpunkt 0,01 m vom Südrand (nach SK1 0,17 m, letzter Commit 0,37 m, vorher 1,12 m), D 2,68 m vom Südrand ' +
    '(letzter Commit 2,86 m, vorher 3,81 m); Anschlussrichtung 2° neben dem Bord (vorher 13,6°). Offen bleibt: Zufahrtsachse 3,67 m vom rechten Bord der ' +
    'Zufahrt (letzter Commit 3,18 m, Sollabstand nach B1 3,34 m) – betrifft den Bord der Zufahrt, nicht die Vortrittsstrasse', () => {
    const e = x().e, a = altFall(), s = soll()
    const zb = armBordVon(x(), x().r.knoten!.vorschlag!)
    const rechterBord = (p: P) => Math.min(...zb.modell.rand.links.teile.map(t => abstand(p, t)))
    expect(abstand(e.nullpunkt, s.sollFuehrung)).toBeCloseTo(0.01, 1); expect(abstand(a.nullpunkt, s.sollFuehrung)).toBeCloseTo(0.37, 1)
    expect(dist(e.rand, e.Dachse)).toBeCloseTo(3, 2); expect(dist(e.D, e.Dachse)).toBeCloseTo(0.5, 2)
    expect(abstand(e.D, s.sollFuehrung)).toBeCloseTo(2.68, 1); expect(abstand(a.D, s.sollFuehrung)).toBeCloseTo(2.86, 1)
    expect(rechterBord(e.Dachse)).toBeCloseTo(3.74, 1); expect(rechterBord(a.Dachse)).toBeCloseTo(3.18, 1)
    const an = bordWieRechnung(x(), ARM, GEGEN).anker('links', 30)!, bord: P = [-0.989, 0.144]
    expect(Math.acos(an.d[0] * bord[0] + an.d[1] * bord[1]) * 180 / Math.PI).toBeLessThan(3)
  })
  it('Soll (Nachtrag B, B4): Führungslinie Südrand (Bordmodell der Rechnung) von s 0 bis 20 an jeder Station vorhanden und höchstens ' +
    '0,30 m von der Geraden zwischen den Trottoirkanten beidseits der Seitenstrasse', () => {
    const g = fuehrungGegen(bordWieRechnung(x(), ARM, GEGEN), 'links', 0, 20, soll().sollFuehrung)
    expect(g.ohne).toEqual([])
    expect(g.max).toBeLessThanOrEqual(0.3)
  })
  it('Soll (Nachtrag B, B4): Fahrlinie von Westen bis zum letzten Sichtpunkt und K höchstens 0,30 m von der Soll-Fahrlinie (geradeaus ' +
    'über die Einmündung)', () => {
    const r = rr()
    expect(abstand(r.K, soll().sollFahrlinie)).toBeLessThanOrEqual(0.3)
    expect(maxAbstand(bis(r.achse, r.sMax), soll().sollFahrlinie)).toBeLessThanOrEqual(0.3)
  })
  it('Soll (Nachtrag B, B4, S3): Nullpunkt bzw. Rand für B höchstens 0,30 m vom Südrand (Soll-Führung)', () => {
    expect(abstand(x().e.nullpunkt, soll().sollFuehrung)).toBeLessThanOrEqual(0.3)
    expect(maxAbstand(x().e.bBezug!.linie, soll().sollFuehrung)).toBeLessThanOrEqual(0.3)
  })
})

// ───────────────────────────────────────────────────────────────────────────────────────────── übrige Fälle
describe('Schwarzenburgstrasse 568814986 und Dalmazi 1021708: Kennzahlen neu gegen den letzten Commit', { timeout: 60_000 }, () => {
  const vergleich = (id: number, z: string) => {
    const x = fall(id, z), a = ALT[`${id}|${z}`]
    return { x, a, dD: dist(x.e.D, a.D), dK: (r: string) => dist(richtung(x.e, r).K, a.richtungen.find(y => y.richtung === r)!.K),
      status: (r: string) => [a.richtungen.find(y => y.richtung === r)!.status, richtung(x.e, r).status] }
  }
  it('568814986, Zufahrt 1242757706:0:1: kein Statuswechsel (beide Richtungen erfüllt, wie im letzten Commit); D 6,04 m verschoben, ' +
    'K links 3,25 m, rechts 5,71 m; vorhandene Sichtweite links 105 → 70,5 m', () => {
    const v = vergleich(568814986, '1242757706:0:1')
    expect(v.dD).toBeCloseTo(6.04, 1); expect(v.dK('links')).toBeCloseTo(3.25, 1); expect(v.dK('rechts')).toBeCloseTo(5.71, 1)
    expect(v.status('links')).toEqual(['erfuellt', 'erfuellt']); expect(v.status('rechts')).toEqual(['erfuellt', 'erfuellt'])
    expect(richtung(v.x.e, 'links').vorhanden).toBeCloseTo(70.54, 1)
    // Einmündung am Anfang beider Arme erkannt, ohne Anschlusspunkt A: Verlängerung entlang der Achskrümmung (Nachtrag 6, viele Punkte)
    for (const [key, s1, n] of [['725155096:3:-1', 18.9, 39], ['135171872:3:-1', 22.01, 46]] as const) {
      const m = armBordVon(v.x, key).modell
      const e = m.abweichungen.find(a => a.seite === 'links' && a.art === 'einmuendung' && a.s0 < 1)!
      expect([e.von, e.verbunden]).toEqual([null, true]); expect(e.s1).toBeCloseTo(s1, 1)
      expect(m.fuehrung.links.verbindungen.find(y => dist(y.bis, e.bis!) < 0.01)!.linie.length).toBe(n)
    }
  })
  it('568814986, Zufahrt 135171872:3:-1: kein Statuswechsel; D 3,29 m (vor S8 3,82 m), K links 0,27 m, rechts 4,65 m verschoben', () => {
    const v = vergleich(568814986, '135171872:3:-1')
    expect(v.dD).toBeCloseTo(3.29, 1); expect(v.dK('links')).toBeCloseTo(0.27, 1); expect(v.dK('rechts')).toBeCloseTo(4.65, 1)
    expect(v.status('links')).toEqual(['erfuellt', 'erfuellt']); expect(v.status('rechts')).toEqual(['erfuellt', 'erfuellt'])
  })
  it('1021708, Zufahrt 30119418:0:1: Gasstrasse (Arm 2) am Nordostrand: der Bord beginnt erst bei s 17,77 ohne Flanke (davor die ' +
    'Ausrundung gegen «uebrige_befestigte»); mit der Weihergasse (Arm 1) als Abzweigung dieser Seite gilt das seit BK2 als Einmündung ' +
    '(vorher «Rand unbekannt (kein Bord)»); Fahrlinie seit BK3 nirgends mehr aus OSM (vorher 32 m, nach BK2 14 m)', () => {
    const v = vergleich(1021708, '30119418:0:1')
    expect(v.dD).toBeCloseTo(2.37, 1); expect(v.dK('rechts')).toBeCloseTo(1.47, 1)
    expect(v.status('rechts')).toEqual(['erfuellt', 'erfuellt']); expect(v.status('links')).toEqual(['keine_zufahrt', 'keine_zufahrt'])
    const bb = armBordVon(v.x, '8223862:5:-1'), m = bb.modell
    const e = m.abweichungen.find(a => a.seite === 'links' && a.s0 < 1)!
    expect([e.art, e.von, e.verbunden]).toEqual(['einmuendung', null, true])
    expect(e.grund).toMatch(/^Bord erst nach dem Abschnittsanfang und OSM-Abzweigung/)
    expect(e.s1).toBeCloseTo(17.77, 1)
    const ab = abzweigungenAm(v.x.k.netz, v.x.r.knoten!.p, m.achse.achse, v.x.r.knoten!.arme.filter(a => a.key !== '8223862:5:-1').map(a => a.richtung))
    expect(ab.some(z => dist(z.p, v.x.r.knoten!.p) < 0.01 && m.achse.station(z.arm!).q > 0)).toBe(true)
    // Fahrlinie aus OSM: vor BK2 auf 32 m, nach BK2 auf 14 m, seit BK3 (Öffnung in der Bordflucht) nirgends mehr
    expect(richtung(v.x.e, 'rechts').hinweise.some(h => h.startsWith('Rechter Fahrbahnrand auf'))).toBe(false)
  })
})

// ───────────────────────────────────────────────────────────────────────────────────────────── Stabilität
describe('Stabilität gegen die OSM-Linie (Plan A1/A7: dieselbe AV → dieselbe Geometrie, 2 cm in LV95)', { timeout: 120_000 }, () => {
  // Ist nach BK1/SK1/S8 (vorher 3339261361: 1,25 bzw. 0,54 m, nach SK1 0,05 bzw. 0,13 m); 282774166 unverändert: dort hängt die Lage der Zufahrt (D, Nullpunkt) noch
  // an der OSM-Linie – eigener Prüfpunkt
  const KNOTEN = [[3339261361, 'links', 0.05, 0.08], [282774166, 'links', 0.97, 0.11]] as const
  const kn = (id: number) => fall(id).r.knoten!.p
  const drehen = (id: number, grad: number) => (p: P): P => {
    const c = kn(id), w = grad * Math.PI / 180, dx = p[0] - c[0], dy = p[1] - c[1]
    return [c[0] + Math.cos(w) * dx - Math.sin(w) * dy, c[1] + Math.sin(w) * dx + Math.cos(w) * dy]
  }
  const varianten = (id: number) => [['OSM 0,50 m nach Osten', (p: P): P => [p[0] + 0.5, p[1]]], ['OSM 1° um den Knoten gedreht', drehen(id, 1)]] as const
  const gemerktV = new Map<string, ReturnType<typeof rechne>>()
  const variante = (id: number, i: number) => {
    const key = `${id}|${i}`
    if (!gemerktV.has(key)) gemerktV.set(key, rechne(id, null, osmVerschoben(id, varianten(id)[i][1])))
    return gemerktV.get(key)!
  }
  const abweichung = (id: number, r: string, i: number) => {
    const o = fall(id).e, v = variante(id, i).e, ro = richtung(o, r), rv = richtung(v, r)
    return { K: dist(ro.K, rv.K), D: dist(o.D, v.D), fahrlinie: maxAbstand(bis(rv.achse, ro.sMax), ro.achse) }
  }
  for (const [id, r, kVersatz, kDrehung] of KNOTEN) {
    it(`Ist ${id}: K verschiebt sich um ${kVersatz.toFixed(2)} m (0,50 m Versatz) bzw. ${kDrehung.toFixed(2)} m (1° Drehung)`, () => {
      const a = abweichung(id, r, 0), b = abweichung(id, r, 1)
      expect(a.K).toBeCloseTo(kVersatz, 1); expect(b.K).toBeCloseTo(kDrehung, 1)
      zeige(`Stabilität ${id}`, { versatz: a, drehung: b })
    })
    for (const i of [0, 1])
      it.fails(`Soll ${id}, ${varianten(id)[i][0]}: Fahrlinie (bis zum letzten Sichtpunkt), D und K höchstens 2 cm verschoben`, () => {
        const a = abweichung(id, r, i)
        expect(a.K).toBeLessThanOrEqual(0.02); expect(a.D).toBeLessThanOrEqual(0.02); expect(a.fahrlinie).toBeLessThanOrEqual(0.02)
      })
  }
})
