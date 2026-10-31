// Gesamtrechnung an einem konstruierten T-Knoten mit AV-Fahrbahn und Gebäude: Seiten links/rechts, Lage von D und B,
// Kreuzungspunkte K (nahe bzw. ferne Fahrspur, d = 1,50 m), Zielpunkte ab K, Tempo und Status. Handlösung im Kommentar.
//
// Lage (Meter, x Ost, y Nord, Ursprung = OSM-Knoten):
//   Hauptstrasse West–Ost, Fahrbahn y = −3 … +3 (6 m); Nebenstrasse von Süden, Fahrbahn x = −2,5 … +2,5 (5 m).
//   Zufahrt Nebenstrasse, Fahrt nach Norden: links = Westen, rechts = Osten.
//   Achse des Zufahrtsstreifens: Mitte der rechten (östlichen) Hälfte, x = +1,25.
//   Nächstliegender Rand: y = −3. B = 3,00 m (innerorts) -> Achspunkt (1,25; −6); D 0,5 m links (Westen): D = (0,75; −6).
//   Nach links: Verkehr von Westen auf der nahen Spur, Achse y = −3 + 1,5 = −1,5, K = (1,25; −1,5), Zielpunkte nach Westen.
//   Nach rechts: Verkehr von Osten auf der fernen Spur, Achse y = +3 − 1,5 = +1,5, K = (1,25; 1,5), Zielpunkte nach Osten.
//   Gebäude in der Südwest-Ecke, Ecke C = (−10; −4) (1 m vom Rand): Strahlensatz mit Spitze D,
//   FA(s) = (1,25 − s; −1,5): (s − 0,5) / 10,75 = 4,5 / 2  ->  s = 0,5 + 24,1875 = 24,6875 m.

import { describe, expect, it } from 'vitest'
import { wgs, type P } from '../geo'
import type { OsmDaten, OsmWeg } from '../daten/osm'
import type { AvFlaeche } from '../daten/av'
import { rechneKnoten, avNachladen } from './rechnen'
import { KEINE_EINGABEN, type RichtungErgebnis, type SichtEingaben } from './typen'

const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const ll = (x: number, y: number): [number, number] => wgs(O[0] + x, O[1] + y)
function weg(id: number, knoten: [number, number, number][], tags: Record<string, string>): OsmWeg {
  return { id, tags, knoten: knoten.map(k => k[0]), geom: knoten.map(k => ll(k[1], k[2])) }
}
const osm = (haupt: Record<string, string> = {}): OsmDaten => ({
  wege: [
    // unclassified: Vorgabe Erschliessungsstrasse (unterer Wert); seit E1 wäre tertiary eine Hauptverkehrsstrasse (Zwischenwert)
    weg(1, [[10, -200, 0], [12, 0, 0], [13, 200, 0]], { highway: 'unclassified', name: 'Hauptstrasse', maxspeed: '30', ...haupt }),
    weg(2, [[12, 0, 0], [20, 0, -200]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' }),
  ],
  tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [],
})
const flaeche = (art: string, ring: P[]): AvFlaeche => ({ art, kanton: 'BE', qualitaet: 'AV93', bfs: 351, ringe: [ring] })
const fahrbahn = flaeche('Strasse_Weg', [lv(-200, -3), lv(-2.5, -3), lv(-2.5, -200), lv(2.5, -200), lv(2.5, -3), lv(200, -3),
  lv(200, 3), lv(-200, 3), lv(-200, -3)])
const ecke = flaeche('Gebaeude', [lv(-10, -4), lv(-30, -4), lv(-30, -24), lv(-10, -24), lv(-10, -4)])
const rel = (p: P): [number, number] => [p[0] - O[0], p[1] - O[1]]
const nahe = (p: P, x: number, y: number, tol = 0.05) => {
  const [a, b] = rel(p)
  expect(Math.abs(a - x), `x ${a} statt ${x}`).toBeLessThan(tol)
  expect(Math.abs(b - y), `y ${b} statt ${y}`).toBeLessThan(tol)
}

describe('Gesamtrechnung T-Knoten', () => {
  const r = rechneKnoten(osm(), [fahrbahn, ecke], { knoten: 12, zufahrt: null })
  const e = r.ergebnis!
  const links = e.richtungen.find(x => x.richtung === 'links') as RichtungErgebnis
  const rechts = e.richtungen.find(x => x.richtung === 'rechts') as RichtungErgebnis

  it('Zufahrt vorgeschlagen: Nebenstrasse (Süd); Vortrittsstrasse: Hauptstrasse', () => {
    expect(r.meldungen).toEqual([])
    expect(e.zufahrt).toBe('2:0:1')
    expect(e.zufahrtName).toBe('2 Nebenstrasse (Süd)')
    expect(links.arm).toBe('1:1:-1')                  // West
    expect(rechts.arm).toBe('1:1:1')                  // Ost
    expect([links.spur, rechts.spur]).toEqual(['nah', 'fern'])
    expect(e.vortritt).toEqual(['1:1:-1', '1:1:1'])
    expect(e.einbiegewinkel).toBeCloseTo(90, 3)
    expect(e.annahmen.some(a => a.includes('mündet schräg'))).toBe(false)
  })
  it('Zufahrt auf einem Arm der Hauptstrasse: übrige Arme als Vortrittsstrasse, mit Hinweis', () => {
    const r6 = rechneKnoten(osm(), [fahrbahn], { knoten: 12, zufahrt: '1:1:1' }).ergebnis!
    expect([...r6.vortritt].sort()).toEqual(['1:1:-1', '2:0:1'])
    expect(r6.hinweise.some(h => h.includes('gehört nach OSM zur durchgehenden Strasse'))).toBe(true)
  })
  it('Tempo aus zone:maxspeed CH:30 (Schreibweise ohne «zone»)', () => {
    const r7 = rechneKnoten(osm({ maxspeed: '', 'zone:maxspeed': 'CH:30' }), [fahrbahn], { knoten: 12, zufahrt: null }).ergebnis!
    expect(r7.richtungen.map(x => [x.tempo, x.tempoAnnahme])).toEqual([[30, false], [30, false]])
  })
  it('B innerorts 3,00 m vor dem nächstliegenden Rand, D am Fahrersitz 0,5 m links der Zufahrtsachse', () => {
    expect(e.B).toBe(3)
    expect(e.ausserorts).toBe(false)
    nahe(e.rand, 1.25, -3)
    nahe(e.Dachse, 1.25, -6)
    nahe(e.D, 0.75, -6)
  })
  it('K nach links auf der nahen, nach rechts auf der fernen Fahrspur (d = 1,50 m vom rechten Rand)', () => {
    nahe(links.K, 1.25, -1.5)
    nahe(rechts.K, 1.25, 1.5)
    expect(links.randAbstand).toBe(1.5)
    // Zielpunkte ab K entlang der Achse vom Knoten weg: nach links Richtung Westen, nach rechts Richtung Osten, je 1 m
    nahe(links.sichtpunkte[0], 1.25, -1.5)
    nahe(links.sichtpunkte[20], 1.25 - 20, -1.5)
    nahe(rechts.sichtpunkte[20], 1.25 + 20, 1.5)
    expect(links.sichtpunkte.length).toBe(links.sMax + 1)
  })
  it('Tempo 30 aus OSM, Tab. 1: 20 … 35 m, Zielpunkte bis 53 m', () => {
    for (const x of [links, rechts]) {
      expect([x.tempo, x.tempoQuelle, x.tempoAnnahme]).toEqual([30, 'OSM maxspeed', false])
      expect([x.erforderlichUnten, x.erforderlichOben, x.massgebend, x.sMax]).toEqual([20, 35, 20, 53])
    }
  })
  it('nach links: Gebäudeecke verdeckt ab 24,69 m (Strahlensatz), Status «unterer Wert»; nach rechts frei', () => {
    expect(Math.abs(links.vorhanden - 24.6875)).toBeLessThan(0.1)
    expect(links.status).toBe('massgebend')
    expect(links.verdecker?.name).toBe('Gebäude (AV)')
    expect(links.verdecker?.sVerdeckt).toBe(25)
    expect(links.dreieckVerdeckt).toEqual([])         // vorhanden ≥ A massgebend (20 m)
    expect(links.dreieckFrei.length).toBe(1 + 21)     // D und Achse 0 … 20 m
    expect(rechts.bisEnde).toBe(true)
    expect(rechts.vorhanden).toBeCloseTo(53, 6)
    expect(rechts.status).toBe('erfuellt')
  })
  it('ausserorts (maxspeed 60): B 5,00 m, Tempo 60 (A 70 … 90 m)', () => {
    const r2 = rechneKnoten(osm({ maxspeed: '60' }), [fahrbahn], { knoten: 12, zufahrt: null }).ergebnis!
    expect(r2.B).toBe(5)
    expect(r2.ausserorts).toBe(true)
    nahe(r2.Dachse, 1.25, -8)
    expect(r2.richtungen.map(x => [x.tempo, x.erforderlichUnten, x.erforderlichOben])).toEqual([[60, 70, 90], [60, 70, 90]])
  })
  it('ohne Tempo in OSM: 50 km/h als Annahme', () => {
    const r3 = rechneKnoten(osm({ maxspeed: '' }), [fahrbahn], { knoten: 12, zufahrt: null }).ergebnis!
    expect(r3.richtungen.every(x => x.tempo === 50 && x.tempoAnnahme)).toBe(true)
    expect(r3.annahmen.some(a => a.includes('Tempo nach links: ohne Angabe in OSM 50 km/h'))).toBe(true)
  })
  it('Einbahn West -> Ost auf der Hauptstrasse: von rechts kein Verkehr', () => {
    const r4 = rechneKnoten(osm({ oneway: 'yes' }), [fahrbahn], { knoten: 12, zufahrt: null }).ergebnis!
    expect(r4.richtungen.find(x => x.richtung === 'links')!.status).not.toBe('keine_zufahrt')
    expect(r4.richtungen.find(x => x.richtung === 'rechts')!.status).toBe('keine_zufahrt')
  })
  it('Annahmen in der Seite: B, D Fahrersitz, d, Strassentyp, Vortritt, nur Gebäude', () => {
    const t = e.annahmen.join(' | ')
    for (const s of ['Das wartende Fahrzeug steht 3,00 m hinter der Kante des Fahrstreifens mit Vortritt (Beobachtungsdistanz B innerorts',
      'Das Auge des Lenkers (D) liegt 0,50 m links der Fahrlinie (Fahrersitz)', 'mit der Wagenmitte 1,50 m vom rechten Fahrbahnrand',
      'massgebend ist der untere Wert der Tab. 1', 'Vortrittsregelung «Kein Vortritt (Signal 3.02)» angenommen',
      'Gebäude der amtlichen Vermessung (weitere Hindernisse sind keine']) expect(t).toContain(s)
    // je Thema höchstens ein Punkt, in der Reihenfolge der Rechnung (Korrektur 31.10.2026)
    expect(e.annahmenThemen!.map(x => x.thema)).toEqual(['vortritt', 'wartend', 'verkehr', 'hindernisse'])
    expect(e.annahmen).toEqual(e.annahmenThemen!.map(x => `${x.titel}: ${x.text}`))
  })
  it('ohne Zufahrt an einer Kreuzung: nur Knoten und Meldung', () => {
    const x = osm()
    x.wege.push(weg(3, [[12, 0, 0], [21, 0, 200]], { highway: 'residential', name: 'Nordweg' }))
    const r5 = rechneKnoten(x, [fahrbahn], { knoten: 12, zufahrt: null })
    expect(r5.ergebnis).toBeNull()
    expect(r5.knoten?.arme.length).toBe(4)
    expect(r5.meldungen[0]).toContain('Zufahrt wählen')
  })
})

// E1: derselbe T-Knoten als Hauptverkehrsstrasse (highway=tertiary, Tempo 50): Vorgabe Strassentyp aus OSM, Zwischenwert
// (50 … 70 m -> 60 m), ungünstige Verhältnisse, Neigung je Richtung, Anhaltesichtweite, nötiger AV-Ausschnitt.
// Handlösung: nach links verdeckt die Gebäudeecke wie oben ab 24,69 m (Lage unabhängig vom Tempo); nach rechts frei bis
// 1,5 × 70 = 105 m. Nach links fährt FA nach Osten auf den Knoten zu: i = −6 % heisst talwärts; Abb. 2 50 km/h bei −6 %: 53 m.
describe('E1: erforderliche Sichtweite an einer Hauptverkehrsstrasse', () => {
  const hvs = (x: Record<string, string> = {}) => osm({ highway: 'tertiary', maxspeed: '50', ...x })
  const eg = (x: Partial<SichtEingaben>): SichtEingaben => ({ ...KEINE_EINGABEN, ...x })
  const rechne = (o: OsmDaten, e: SichtEingaben = KEINE_EINGABEN, avRadius?: number) =>
    rechneKnoten(o, [fahrbahn, ecke], { knoten: 12, zufahrt: null, eingaben: e }, null, avRadius).ergebnis!
  const seite = (e: ReturnType<typeof rechne>, r: 'links' | 'rechts') => e.richtungen.find(x => x.richtung === r)!

  it('Vorgabe aus OSM highway=tertiary: Hauptverkehrsstrasse, Zwischenwert 60 m, als Annahme ausgewiesen', () => {
    const e = rechne(hvs())
    expect(e.strasse).toMatchObject({ typ: 'hvs', typVorgabe: 'hvs', typQuelle: 'OSM highway=tertiary', typGewaehlt: false })
    for (const x of e.richtungen) expect([x.erforderlichUnten, x.zwischenwert, x.erforderlichOben, x.typStufe, x.massgebend])
      .toEqual([50, 60, 70, 'zwischen', 60])
    expect(seite(e, 'links').status).toBe('nicht_erfuellt')       // 24,69 m < 60 m
    expect(seite(e, 'links').dreieckVerdeckt.length).toBeGreaterThan(0)
    expect(seite(e, 'rechts').status).toBe('erfuellt')            // frei bis 105 m ≥ 70 m
    const t = e.annahmen.join(' | ')
    expect(t).toContain('Die Vortrittsstrasse gilt als Hauptverkehrsstrasse oder wichtige Verbindungsstrasse (nach OSM highway=tertiary; ' +
      'im Panel änderbar)')
    expect(t).toContain('der Zwischenwert der Tab. 1 (VSS 40 273, S. 8; Mittel von unterem und oberem Wert, aufgerundet; Entscheid ' +
      '15.10.2026 – die Norm nennt nur einen Bereich)')
    // Strassentyp aus OSM als Annahme der App, tertiary auf der sicheren Seite: technische Herleitung
    expect(e.herleitung!.join(' | ')).toContain('trunk, primary, secondary, tertiary und deren links gelten als Hauptverkehrsstrasse ' +
      '(tertiary damit auf der sicheren Seite)')
    // eben: Anhaltesichtweite nicht angewendet, darum nicht genannt
    expect(t).not.toContain('Anhaltesichtweite')
    expect(seite(e, 'links').typText).toBe('Zwischenwert, Hauptverkehrsstrasse (Mittel von unterem und oberem Wert, aufgerundet; ' +
      'Entscheid 15.10.2026 – die Norm nennt nur einen Bereich)')
    expect(t).toContain('Längsneigung von links und von rechts 0 % (eben')
  })
  it('Strassentyp von Hand ES: unterer Wert 50 m, Annahme zum Strassentyp entfällt', () => {
    const e = rechne(hvs(), eg({ typ: 'es' }))
    expect(e.strasse.typGewaehlt).toBe(true)
    expect(e.richtungen.map(x => x.massgebend)).toEqual([50, 50])
    expect(e.annahmen.some(a => a.includes('Die Vortrittsstrasse gilt als'))).toBe(false)
  })
  it('ES mit Neigung: links −6 % -> Anhaltesichtweite 52 m massgebend; rechts +6 % -> 46 m < 50 m, Tab. 1 bleibt', () => {
    const e = rechne(hvs(), eg({ typ: 'es', neigung: { links: -6, rechts: 6 } }))
    const l = seite(e, 'links'), r = seite(e, 'rechts')
    expect([l.neigung, l.anhalte?.meter, l.anhalteAngewendet, l.massgebend, l.massgebendText]).toEqual([-6, 52, true, 52, 'Anhaltesichtweite bei −6 %'])
    expect([r.neigung, r.anhalte?.meter, r.massgebend, r.massgebendText]).toEqual([6, 46, 50, 'unterer Wert, Erschliessungsstrasse'])
    // |i| > 5 %: Häkchen «grosse Längsneigung» als Vorgabe gesetzt, bei ES nur Hinweis
    expect(e.strasse.ungunst.neigung).toBe(true)
    expect(e.hinweise.some(h => h.startsWith('Ungünstige Verhältnisse an einer Erschliessungs'))).toBe(true)
    expect(e.annahmen.some(a => a.includes('Längsneigung'))).toBe(false)
    // Anhaltesichtweite angewendet (links −6 %): kurz genannt, Einzelheiten in der Herleitung
    expect(e.annahmen.join(' | ')).toContain('zählt zusätzlich die Anhaltesichtweite nach VSS 40 090b (Abb. 2, S. 5')
    expect(e.herleitung!.join(' | ')).toContain('Untergrenze erst über ±2 % (VSS 40 273 Ziffer 13.1)')
  })
  it('HVS mit Neigung ±6 %: Vorgabe «grosse Längsneigung» hebt auf den oberen Wert 70 m; Häkchen von Hand weg: 60 m', () => {
    const e = rechne(hvs(), eg({ neigung: { links: -6, rechts: 6 } }))
    expect(e.richtungen.map(x => [x.typStufe, x.massgebend])).toEqual([['oben', 70], ['oben', 70]])
    expect(e.annahmen.some(a => a.includes('Ungünstige Verhältnisse angenommen: Gefälle über 5 % in einer Richtung'))).toBe(true)
    const f = rechne(hvs(), eg({ neigungGross: false, neigung: { links: -6, rechts: 6 } }))
    expect(f.richtungen.map(x => x.massgebend)).toEqual([60, 60])   // Anhaltesichtweite 53 m < 60 m
    expect(f.strasse.ungunstVorgabe.neigung).toBe(true)
  })
  it('OSM lanes=4: Vorgabe «mehr als ein Fahrstreifen je Richtung», HVS oberer Wert; Schwerverkehr von Hand', () => {
    const e = rechne(hvs({ lanes: '4' }))
    expect(e.strasse).toMatchObject({ fahrstreifenQuelle: 'OSM lanes=4', ungunst: { fahrstreifen: true, neigung: false, schwerverkehr: false } })
    expect(e.richtungen.map(x => x.massgebend)).toEqual([70, 70])
    expect(rechne(hvs({ lanes: '2' })).richtungen.map(x => x.massgebend)).toEqual([60, 60])
    expect(rechne(hvs(), eg({ schwerverkehr: true })).richtungen.map(x => x.massgebend)).toEqual([70, 70])
  })
  it('Block 5, ungünstige Verhältnisse nach Kanton Solothurn: lanes je Richtung, Einbahn, Schwerverkehrsanteil über 8 %', () => {
    // lanes:forward/backward gehen vor: 2 in einer Richtung -> ungünstig; je 1 -> nicht (auch bei lanes=3)
    expect(rechne(hvs({ 'lanes:forward': '2', 'lanes:backward': '1' })).strasse).toMatchObject({ ungunst: { fahrstreifen: true },
      fahrstreifenQuelle: 'OSM lanes:forward=2, lanes:backward=1' })
    expect(rechne(hvs({ lanes: '3', 'lanes:forward': '1', 'lanes:backward': '1' })).strasse.ungunst.fahrstreifen).toBe(false)
    // lanes=2 ohne Einbahn: je Richtung einer -> nicht ungünstig
    expect(rechne(hvs({ lanes: '2' })).strasse.ungunst.fahrstreifen).toBe(false)
    // Schwerverkehrsanteil: 9 % -> oberer Wert mit Annahme, 8 % -> Zwischenwert; Häkchen von Hand gilt unabhängig vom Anteil
    const s9 = rechne(hvs(), eg({ schwerverkehrAnteil: 9 }))
    expect([s9.strasse.ungunst.schwerverkehr, s9.richtungen.map(x => x.massgebend)]).toEqual([true, [70, 70]])
    expect(s9.annahmen.some(a => a.includes('Ungünstige Verhältnisse angenommen: Schwerverkehrsanteil 9,0 %, über 8 %') &&
      a.includes('Kanton Solothurn (AVT 12/2024, S. 3'))).toBe(true)
    expect(rechne(hvs(), eg({ schwerverkehrAnteil: 8 })).richtungen.map(x => x.massgebend)).toEqual([60, 60])
    expect(rechne(hvs(), eg({ schwerverkehrAnteil: 2, schwerverkehr: true })).strasse.ungunst.schwerverkehr).toBe(true)
  })
  it('AV-Bedarf: Tempo 30 weitester Zielpunkt 54,3 m -> 75 m (kein Nachladen); Tempo 70 166,3 m -> 187 m, Hinweis bei ±150 m', () => {
    // Tempo 30: rechts Ende der Zielpunkte (1,25 + 53; 1,5) -> 54,27 m ab Knoten, plus 20 m Reserve
    const e30 = rechne(osm())
    expect([e30.avRadius, e30.avBedarf]).toEqual([150, 75])
    expect(avNachladen(e30.avBedarf, e30.avRadius)).toBeNull()
    // Tempo 70 (ES): 1,5 × 110 = 165 m -> (166,25; 1,5) -> 166,26 m + 20 = 186,26 -> 187 m
    const e70 = rechne(osm({ maxspeed: '70' }), eg({ typ: 'es' }))
    expect(e70.avBedarf).toBe(187)
    expect(seite(e70, 'rechts').hinweise.some(h => h.includes('über den AV-Ausschnitt (±150 m)'))).toBe(true)
    expect(avNachladen(e70.avBedarf, e70.avRadius)).toBe(187)
    // nach dem Nachladen: kein Hinweis mehr, kein zweites Nachladen
    const n70 = rechne(osm({ maxspeed: '70' }), eg({ typ: 'es' }), 187)
    expect(n70.avRadius).toBe(187)
    expect(n70.richtungen.some(x => x.hinweise.some(h => h.includes('AV-Ausschnitt')))).toBe(false)
    expect(avNachladen(n70.avBedarf, n70.avRadius)).toBeNull()
  })
  it('Vorgaben aus OSM: Arme mit verschiedener Klasse, trunk, lanes «2;3»; Neigung nur in einer Richtung', () => {
    // Vortrittsstrasse aus zwei Wegen: West residential, Ost primary_link -> HVS, Quelle nennt beide
    const x = osm()
    x.wege[0] = weg(1, [[10, -200, 0], [12, 0, 0]], { highway: 'residential', name: 'Hauptstrasse', maxspeed: '50' })
    x.wege.push(weg(4, [[12, 0, 0], [13, 200, 0]], { highway: 'primary_link', name: 'Hauptstrasse', maxspeed: '50', lanes: '2;3' }))
    const e = rechne(x)
    expect(e.strasse).toMatchObject({ typ: 'hvs', fahrstreifenQuelle: 'OSM lanes=3', ungunst: { fahrstreifen: true } })
    expect(e.strasse.typQuelle).toContain('primary_link')
    expect(e.strasse.typQuelle).toContain('residential')
    expect(rechne(hvs({ highway: 'trunk' })).strasse.typ).toBe('hvs')
    // genau 5 % (Kanton Solothurn, Annahme): noch keine grosse Längsneigung; Annahme 0 % nur für die andere Richtung
    const n = rechne(hvs(), eg({ neigung: { links: -5, rechts: 0 } }))
    expect(n.strasse.ungunst.neigung).toBe(false)
    const nt = n.annahmen.join(' | ')
    expect([nt.includes('Längsneigung von rechts 0 %'), nt.includes('Längsneigung von links')]).toEqual([true, false])
  })
  it('80 km/h, −12 % (ES): Anhaltesichtweite 142 m über dem oberen Wert, Zielpunkte bis 213 m, AV-Bedarf 232 m', () => {
    // längere Vorlage (±300 m); Abb. 2 bei −12 % 143 m, um −1 m auf Tab. 1 verschoben -> 142 m; links: (1,25 − 213; −1,5) ->
    // 211,76 m + 20 -> 232 m; rechts eben: 1,5 × 140 = 210 m
    const lang: OsmDaten = { ...osm(), wege: [
      weg(1, [[10, -300, 0], [12, 0, 0], [13, 300, 0]], { highway: 'unclassified', name: 'Hauptstrasse', maxspeed: '80' }),
      weg(2, [[12, 0, 0], [20, 0, -200]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' })] }
    const fb = flaeche('Strasse_Weg', [lv(-300, -3), lv(-2.5, -3), lv(-2.5, -200), lv(2.5, -200), lv(2.5, -3), lv(300, -3),
      lv(300, 3), lv(-300, 3), lv(-300, -3)])
    const e = rechneKnoten(lang, [fb], { knoten: 12, zufahrt: null, eingaben: eg({ typ: 'es', neigungGross: false, neigung: { links: -12, rechts: 0 } }) }).ergebnis!
    const l = seite(e, 'links'), r = seite(e, 'rechts')
    expect([l.typWert, l.anhalte?.meter, l.massgebend, l.sMax, l.status]).toEqual([110, 142, 142, 213, 'erfuellt'])
    expect(l.hinweise.join(' ')).toContain('verlängert')
    expect([r.massgebend, r.sMax]).toEqual([110, 210])
    expect(e.avBedarf).toBe(232)
    expect(avNachladen(e.avBedarf, e.avRadius)).toBe(232)
  })
  it('Nachladen höchstens 400 m', () => {
    expect(avNachladen(157, 150)).toBe(157)
    expect(avNachladen(130, 150)).toBeNull()
    expect(avNachladen(450, 150)).toBe(400)
    expect(avNachladen(420, 380)).toBe(400)
    expect(avNachladen(450, 400)).toBeNull()
  })
})

// Block 5, Überholfall (VSS 40 273 Ziffer 6, Abb. 1): ausserorts (maxspeed:type CH:rural), 50 km/h, ES: A = 50 m, B = 5,00 m:
// Dachse (1,25; −8), D (0,75; −8). Nach rechts fährt der Verkehr von Osten auf y = +1,5, das überholende Fahrzeug auf dem
// Gegenfahrstreifen y = −1,5 (1,50 m vom anderen Rand). Gebäude x ≥ 25, y ≤ −4: die Sichtlinie D -> (1,25 + s; y) liegt bei y = −4
// bei 0,75 + (0,5 + s) · 4 / (y + 8). Auto (y = 1,5): verdeckt ab s = 24,25 · 9,5 / 4 − 0,5 = 57,09 m ≥ 50 m; Überholfall (y = −1,5):
// ab s = 24,25 · 6,5 / 4 − 0,5 = 38,91 m < 50 m: nicht erfüllt.
describe('Block 5: Überholfall ausserorts', () => {
  const land = (x: Record<string, string> = {}) => osm({ maxspeed: '50', 'maxspeed:type': 'CH:rural', ...x })
  const haus = flaeche('Gebaeude', [lv(25, -4), lv(60, -4), lv(60, -30), lv(25, -30), lv(25, -4)])
  const rechne = (o: OsmDaten, e: Partial<import('./typen').Eingaben> = {}) =>
    rechneKnoten(o, [fahrbahn, haus], { knoten: 12, zufahrt: null, eingaben: { ...KEINE_EINGABEN, ...e } }).ergebnis!
  const seite = (e: ReturnType<typeof rechne>, r: 'links' | 'rechts') => e.richtungen.find(x => x.richtung === r)!
  it('zweite Sichtlinie auf den Gegenfahrstreifen: rechts 38,9 m < 50 m, Auto 57,1 m; Gesamtstatus nicht erfüllt (Überholfall)', () => {
    const e = rechne(land())
    expect([e.ausserorts, e.B]).toEqual([true, 5])
    const r = seite(e, 'rechts'), l = seite(e, 'links')
    expect(r.vorhanden).toBeCloseTo(24.25 * 9.5 / 4 - 0.5, 1)
    expect(r.status).toBe('massgebend')
    expect(r.ueberholfall!.vorhanden).toBeCloseTo(24.25 * 6.5 / 4 - 0.5, 1)
    expect([r.ueberholfall!.A, r.ueberholfall!.status]).toEqual([50, 'nicht_erfuellt'])
    nahe(r.ueberholfall!.K, 1.25, -1.5)
    expect([r.gesamt, r.gesamtFehlt]).toEqual(['nicht_erfuellt', ['Überholfall']])
    // links: Gegenfahrstreifen y = +1,5, frei
    nahe(l.ueberholfall!.K, 1.25, 1.5)
    expect(l.ueberholfall!.status).toBe('erfuellt')
    expect(e.ueberholen).toMatchObject({ ausserorts: true, vorgabe: true, gewaehlt: false, erlaubt: true, geprueft: true })
    expect(e.annahmen.join(' | ')).toContain('Ausserorts ist hier Überholen erlaubt (Vorgabe: ohne overtaking=no in OSM: erlaubt angenommen): ' +
      'die App prüft von links und von rechts zusätzlich')
    // Massnahmen: rechts nicht erfüllt nur wegen des Überholfalls; die Varianten rechnen ihn mit
    expect(e.massnahmen).not.toBeNull()
    expect(e.massnahmen!.find(m => m.nr === 2)!.zeilen[0].text).toContain('Überholfall')
  })
  it('Überholverbot aus OSM (overtaking=no, je Richtung overtaking:forward/backward) bzw. von Hand; innerorts nicht geprüft', () => {
    const v = rechne(land({ overtaking: 'no' }))
    expect(v.richtungen.map(r => r.ueberholfall ?? null)).toEqual([null, null])
    expect(v.annahmen.join(' | ')).toContain('Überholfall nicht geprüft (von links: Überholen verboten (OSM overtaking=no); von rechts: ' +
      'Überholen verboten (OSM overtaking=no); VSS 40 273 Ziffer 6, S. 4).')
    expect(seite(v, 'rechts').gesamt).toBe('massgebend')
    // Arm West (sd −1): Verkehr zum Knoten in Wegrichtung -> overtaking:forward; Arm Ost -> overtaking:backward
    const f = rechne(land({ 'overtaking:forward': 'no' }))
    expect([!!seite(f, 'links').ueberholfall, !!seite(f, 'rechts').ueberholfall]).toEqual([false, true])
    const b = rechne(land({ 'overtaking:backward': 'no' }))
    expect([!!seite(b, 'links').ueberholfall, !!seite(b, 'rechts').ueberholfall]).toEqual([true, false])
    // von Hand: verboten bzw. trotz OSM erlaubt
    expect(rechne(land(), { ueberholen: false }).richtungen.every(r => !r.ueberholfall)).toBe(true)
    expect(rechne(land({ overtaking: 'no' }), { ueberholen: true }).richtungen.every(r => !!r.ueberholfall)).toBe(true)
    // innerorts: keine Prüfung und keine Annahme (gilt dort nicht; Korrektur 31.10.2026)
    const i = rechne(osm())
    expect(i.richtungen.every(r => !r.ueberholfall)).toBe(true)
    expect(i.annahmen.join(' | ')).not.toContain('Überholfall')
  })
})

describe('Block 5: Hinweise ohne Statuswirkung', () => {
  const rechne = (o: OsmDaten, e: Partial<import('./typen').Eingaben> = {}, av: AvFlaeche[] = [fahrbahn]) =>
    rechneKnoten(o, av, { knoten: 12, zufahrt: null, eingaben: { ...KEINE_EINGABEN, ...e } }).ergebnis!
  const STOP = 'Kein Vortritt statt Stop möglich: Stop nur, wo die Sicht nicht reicht (SSV Art. 36 Abs. 7; Praxis TBA Bern Arbeitshilfe ' +
    'Vortritt Kap. 2.3, vif Luzern 653.105, Basel-Stadt AB-SSV Teil 1 Kap. 5.2).'
  it('Stop mit ausreichender Sicht: innerorts Hinweis «Kein Vortritt statt Stop»; nicht, wenn eine Richtung nicht reicht', () => {
    expect(rechne(osm(), { regelung: 'stop' }).hinweise).toContain(STOP)
    expect(rechne(osm(), { regelung: 'stop' }, [fahrbahn, ecke]).hinweise.some(h => h.startsWith('Kein Vortritt statt Stop'))).toBe(false)
    expect(rechne(osm()).hinweise.some(h => h.startsWith('Kein Vortritt statt Stop'))).toBe(false)
  })
  it('Stop ausserorts: gerechnet mit B 5,00 m (Kein Vortritt); D von Hand: Vorbehalt', () => {
    const land = osm({ maxspeed: '50', 'maxspeed:type': 'CH:rural' })
    const e = rechne(land, { regelung: 'stop' })
    expect(e.B).toBe(3)
    expect(e.hinweise).toContain(`${STOP} Ausserorts gilt bei «Kein Vortritt» B 5,00 m (Ziffer 12): mit D bei B 5,00 m gerechnet, reicht ` +
      'die Sicht auch dort.')
    const h = rechne(land, { regelung: 'stop', D: lv(0.75, -6) })
    expect(h.hinweise).toContain(`${STOP} Ausserorts gilt bei «Kein Vortritt» B 5,00 m (Ziffer 12): ab B 5,00 m zu prüfen (D von Hand ` +
      'gesetzt, nicht gerechnet).')
  })
  it('Anhaltesichtweite angewendet bei Tempo ≤ 30 bzw. ES: Hinweis auf VSS 40 090b Ziffer 6; Einbiegewinkel 90°: kein Hinweis', () => {
    const e = rechne(osm(), { neigung: { links: -8, rechts: 0 } })
    expect(e.hinweise).toContain('Auf siedlungsorientierten Strassen mit Verkehrsberuhigung darf die Anhaltesichtweite nach VSS 40 090b ' +
      'Ziffer 6 (S. 4) reduziert werden; die App reduziert nicht (konservativ).')
    expect(rechne(osm()).hinweise.some(h => h.startsWith('Auf siedlungsorientierten'))).toBe(false)
    expect(e.hinweise.some(h => h.startsWith('Einbiegewinkel'))).toBe(false)
  })
  it('Einbiegewinkel unter 45°: Hinweis mit Annahme der Grenze', () => {
    // Nebenstrasse von Südwesten unter 40° zur Hauptstrasse (Zufahrt von x < 0)
    const o = osm()
    const c = Math.cos(40 * Math.PI / 180), s = Math.sin(40 * Math.PI / 180)
    o.wege[1] = weg(2, [[12, 0, 0], [20, -200 * c, -200 * s]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' })
    const e = rechne(o)
    expect(Math.round(e.einbiegewinkel) < 45 || Math.round(e.einbiegewinkel) > 135).toBe(true)
    expect(e.hinweise.find(h => h.startsWith('Einbiegewinkel'))).toBe(`Einbiegewinkel rund ${Math.round(e.einbiegewinkel)}°: deutlich von 90° ` +
      'abweichend, nach VSS 40 273 Ziffer 10 (S. 7) grundsätzlich zu vermeiden; spitze Winkel für Lastwagen besonders problematisch ' +
      '(Annahme der Grenze 45°/135°).')
  })
})
