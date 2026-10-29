// Tests E3a: Längsneigung aus dem Höhenprofil (Ausgleichsgerade, Ausreisser, Vorzeichen), Abruf beim Dienst (Fehler -> 0 % mit
// Hinweis), Wirkung in der Rechnung am T-Knoten aus rechnen.test.ts und Lesen der Fall-Datei (Version 2: 0 = Vorgabe).
//
// Handlösung: Strasse mit durchgehender Steigung h(x) = 500 + 0,06 · x, Knoten bei x = 0. Profil der einen Richtung vom Knoten weg
// nach +x: h = 500 + 0,06 · dist (steigt vom Knoten weg) -> FA fährt bergab: i = −6,0 %. Gegenrichtung vom Knoten weg nach −x:
// h = 500 − 0,06 · dist -> FA fährt bergauf: i = +6,0 %. Ein Ausreisser (+2,5 m bei dist 30) fällt nach der ersten Geraden weg.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { wgs, type P } from '../geo'
import type { OsmDaten, OsmWeg } from '../daten/osm'
import type { AvFlaeche } from '../daten/av'
import { ausgleichsgerade, neigungAusProfil, neigungMessung, type ProfilPunkt } from './neigung'
import { ladeNeigung, profilUrl, profilLesen } from '../daten/hoehen'
import { rechneKnoten } from './rechnen'
import { KEINE_ALLE_EINGABEN, type Eingaben, type NeigungMessung } from './typen'
import { fallLesen, FALL_VERSION } from '../fall'

const profil = (f: (d: number) => number, ausreisser: [number, number] | null = null): ProfilPunkt[] =>
  Array.from({ length: 21 }, (_, k) => k * 2).map(d => ({ dist: d, h: Math.round((f(d) + (ausreisser && d === ausreisser[0] ? ausreisser[1] : 0)) * 10) / 10 }))

describe('E3a: Neigung aus dem Profil', () => {
  it('Ausgleichsgerade über exakte Punkte', () => {
    const g = ausgleichsgerade([{ dist: 0, h: 1 }, { dist: 10, h: 2 }, { dist: 20, h: 3 }])!
    expect(g.b).toBeCloseTo(0.1, 9)
    expect(g.a).toBeCloseTo(1, 9)
    expect(ausgleichsgerade([{ dist: 5, h: 1 }, { dist: 5, h: 2 }])).toBeNull()
  })
  it('6 % Gefälle zum Knoten mit einem Ausreisser: −6,0 % (FA bergab), Gegenrichtung +6,0 %', () => {
    const ab = neigungAusProfil(profil(d => 500 + 0.06 * d, [30, 2.5]))!
    expect(Math.round(ab.i * 10) / 10).toBe(-6)
    expect([ab.punkte, ab.ausreisser, ab.laenge]).toEqual([20, 1, 40])
    const auf = neigungAusProfil(profil(d => 500 - 0.06 * d, [30, 2.5]))!
    expect(Math.round(auf.i * 10) / 10).toBe(6)
    // Endpunkt minus Anfangspunkt wäre mit einem Ausreisser am Ende falsch, die Gerade nicht
    const ende = neigungAusProfil(profil(d => 500 + 0.06 * d, [40, -3]))!
    expect(Math.round(ende.i * 10) / 10).toBe(-6)
  })
  it('mehrere Ausreisser (Brücke am Ende, 4 Punkte +4 m): Hinweis «Höhenprofil uneben»; Rundung des Modells (0,1 m) ohne Hinweis', () => {
    const p = profil(d => 500 + 0.06 * d).map(x => (x.dist >= 34 ? { ...x, h: x.h + 4 } : x))
    expect(neigungMessung(p).hinweis).toContain('Höhenprofil uneben')
    expect(neigungMessung(profil(d => 500 + 0.073 * d)).hinweis).toBeNull()
  })
  it('Messung: Quelle mit Länge und Punkten, auf 0,1 % gerundet; Hinweis zum Ausreisser', () => {
    const m = neigungMessung(profil(d => 500 + 0.06 * d, [30, 2.5]))
    expect(m).toMatchObject({ i: -6, quelle: 'swissALTI3D (swisstopo), Profil 40 m, 20 Punkte', punkte: 20 })
    expect(m.hinweis).toContain('1 Punkt weit neben der Ausgleichsgeraden')
    expect(neigungMessung(profil(d => 500 + 0.06 * d)).hinweis).toBeNull()
    expect(neigungMessung([{ dist: 0, h: 1 }]).i).toBeNull()
  })
  it('Dienst-Fehler: i = null, Hinweis «0 % angenommen»', () => {
    const m = neigungMessung(new Error('HTTP 500'))
    expect(m.i).toBeNull()
    expect(m.hinweis).toBe('Höhenmodell nicht verfügbar (HTTP 500): Längsneigung 0 % angenommen, von Hand eingeben.')
  })
})

describe('E3a: Abruf des Profils (profile.json)', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const linie: P[] = [[2600000, 1200000], [2600010, 1200000], [2600040, 1200000]]
  it('Adresse: LineString in LV95, sr=2056, 20 Punkte', () => {
    const u = new URL(profilUrl(linie))
    expect(u.host).toBe('api3.geo.admin.ch')
    expect(JSON.parse(u.searchParams.get('geom')!)).toEqual({ type: 'LineString', coordinates: linie })
    expect([u.searchParams.get('sr'), u.searchParams.get('nb_points')]).toEqual(['2056', '20'])
  })
  it('Antwort lesen: COMB, sonst DTM2; Punkte ohne Höhe fallen weg', () => {
    expect(profilLesen([{ dist: 0, alts: { COMB: 500 } }, { dist: 10, alts: { COMB: null, DTM2: 501 } }, { dist: 20, alts: {} }]))
      .toEqual([{ dist: 0, h: 500 }, { dist: 10, h: 501 }])
    expect(() => profilLesen({ error: 'x' })).toThrow()
  })
  it('Dienst nicht erreichbar bzw. HTTP-Fehler: Messung ohne Wert mit Hinweis, kein Abbruch der Rechnung', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const [m, a] = await ladeNeigung(linie)
    expect(m.i).toBeNull()
    expect(m.hinweis).toContain('0 % angenommen')
    expect(a).toContain('nicht erreichbar')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Fehler', { status: 500 })))
    const [m2, a2] = await ladeNeigung(linie)
    expect([m2.i, a2]).toEqual([null, 'HTTP 500'])
  })
  it('Antwort mit 6 % Steigung vom Knoten weg: −6,0 %', async () => {
    const roh = profil(d => 500 + 0.06 * d).map(p => ({ dist: p.dist, alts: { COMB: p.h, DTM2: p.h, DTM25: p.h } }))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(roh), { status: 200 })))
    const [m] = await ladeNeigung(linie)
    expect(m.i).toBe(-6)
  })
})

// T-Knoten wie rechnen.test.ts (Hauptstrasse West–Ost, Zufahrt von Süden), Hauptverkehrsstrasse 50 km/h
const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const ll = (x: number, y: number): [number, number] => wgs(O[0] + x, O[1] + y)
const weg = (id: number, knoten: [number, number, number][], tags: Record<string, string>): OsmWeg =>
  ({ id, tags, knoten: knoten.map(k => k[0]), geom: knoten.map(k => ll(k[1], k[2])) })
const osm: OsmDaten = { wege: [
  weg(1, [[10, -200, 0], [12, 0, 0], [13, 200, 0]], { highway: 'tertiary', name: 'Hauptstrasse', maxspeed: '50' }),
  weg(2, [[12, 0, 0], [20, 0, -200]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' }),
], tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [] }
const flaeche = (art: string, ring: P[]): AvFlaeche => ({ art, kanton: 'BE', qualitaet: 'AV93', bfs: 351, ringe: [ring] })
const fahrbahn = flaeche('Strasse_Weg', [lv(-200, -3), lv(-2.5, -3), lv(-2.5, -200), lv(2.5, -200), lv(2.5, -3), lv(200, -3),
  lv(200, 3), lv(-200, 3), lv(-200, -3)])
const gemessen = (i: number): NeigungMessung => ({ i, quelle: `swissALTI3D (swisstopo), Profil 61 m, 20 Punkte`, laenge: 61, punkte: 20, hinweis: null })

describe('E3a: Neigung in der Rechnung', () => {
  const rechne = (hoehen: Parameters<typeof rechneKnoten>[2]['hoehen'], eg: Partial<Eingaben> = {}) =>
    rechneKnoten(osm, [fahrbahn], { knoten: 12, zufahrt: null, hoehen, eingaben: { ...KEINE_ALLE_EINGABEN, ...eg } }).ergebnis!
  const seite = (e: ReturnType<typeof rechne>, r: string) => e.richtungen.find(x => x.richtung === r)!
  it('Vorgabe aus dem Höhenmodell: −6,9 / +7,2 %; Anhaltesichtweite und «grosse Längsneigung» (oberer Wert) als Vorgabe', () => {
    const e = rechne({ links: gemessen(-6.9), rechts: gemessen(7.2), zufahrt: gemessen(-7.5) })
    const l = seite(e, 'links'), r = seite(e, 'rechts')
    expect([l.neigung, l.neigungVorgabe, l.neigungHand, l.neigungQuelle]).toEqual([-6.9, -6.9, false, gemessen(0).quelle])
    expect([r.neigung, r.neigungHand]).toEqual([7.2, false])
    expect(l.anhalteAngewendet).toBe(true)
    // 50 km/h, HVS mit grosser Längsneigung: oberer Wert 70 m (Anhaltesichtweite bei −6,9 % liegt darunter)
    expect([e.strasse.ungunstVorgabe.neigung, e.strasse.ungunst.neigung, l.typStufe, l.massgebend]).toEqual([true, true, 'oben', 70])
    expect(e.annahmen.join(' | ')).toContain('Längsneigung von links −6,9 %, von rechts +7,2 % aus dem Höhenmodell')
    expect(e.annahmen.some(a => a.includes('0 % (eben'))).toBe(false)
    // Profillinie ab K bis A massgebend (mindestens 20 m); Zufahrt 20 m ab der Kante; steile Zufahrt nur als Hinweis
    expect(l.profilLinie[0]).toEqual(l.K)
    expect(e.zufahrtProfil.length).toBeGreaterThanOrEqual(2)
    expect(e.zufahrtNeigung?.i).toBe(-7.5)
    expect(e.hinweise.join(' ')).toContain('Steile Zufahrt: Längsneigung −7,5 %')
  })
  it('von Hand geht vor (Quelle «von Hand»), Vorgabe bleibt sichtbar', () => {
    const e = rechne({ links: gemessen(-6.9), rechts: gemessen(7.2) }, { neigung: { links: -2, rechts: null } })
    expect([seite(e, 'links').neigung, seite(e, 'links').neigungVorgabe, seite(e, 'links').neigungQuelle]).toEqual([-2, -6.9, 'von Hand'])
    expect(seite(e, 'rechts').neigung).toBe(7.2)
  })
  it('Dienst-Fehler: 0 % mit Hinweis und Annahme; noch nicht geladen: 0 % «lädt»; ohne Profil der Richtung: kein «lädt»', () => {
    const e = rechne({ links: neigungMessung(new Error('HTTP 500')), rechts: gemessen(3) })
    const l = seite(e, 'links')
    expect([l.neigung, l.neigungVorgabe, l.neigungHand]).toEqual([0, 0, false])
    expect(l.neigungQuelle).toBe('swissALTI3D (swisstopo) nicht verfügbar: 0 % angenommen')
    expect(l.hinweise).toContain('Höhenmodell nicht verfügbar (HTTP 500): Längsneigung 0 % angenommen, von Hand eingeben.')
    expect(e.annahmen.join(' | ')).toContain('Längsneigung von links 0 % (eben; ohne Messung aus dem Höhenmodell')
    expect(seite(rechne(null), 'links').neigungQuelle).toBe('Höhenmodell lädt: vorerst 0 %')
    // Profile geladen, aber für links keines geholt (Befund 17.10.2026: sonst wartete der Druck ewig)
    expect(seite(rechne({ rechts: gemessen(3) }), 'links').neigungQuelle).toBe('ohne Profil: 0 % angenommen')
  })
})

describe('E3a: Fall-Datei Version 3', () => {
  const datei = (version: number, neigung: unknown) => JSON.stringify({ app: 'SichtweitenCheck', version,
    ort: { lat: 46.95, lon: 7.44, knoten: 1, zufahrt: null }, quellen: {}, eingaben: { neigung } })
  it('Version 2: 0 war die Vorgabe (jetzt Höhenmodell), andere Werte von Hand; Version 3: null Vorgabe, 0 von Hand', () => {
    expect(FALL_VERSION).toBeGreaterThanOrEqual(3)          // E3b: Version 4 (Velo), liest Version 3 weiter
    expect(fallLesen(datei(2, { links: 0, rechts: -5.5 }))[0].eingaben.neigung).toEqual({ links: null, rechts: -5.5 })
    expect(fallLesen(datei(3, { links: 0, rechts: null }))[0].eingaben.neigung).toEqual({ links: 0, rechts: null })
  })
})
