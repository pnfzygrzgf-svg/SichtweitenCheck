// Tests Fall-Datei (fall.ts, E2a): Hindernisse, verworfene Vorschläge und Quellen-Häkchen hin und zurück, Prüfung kaputter
// Einträge, localStorage je Knoten. Vorlage: fgsCheck rechner/eingaben.test.ts (Fall-Datei).

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { P } from './geo'
import { FALL_VERSION, leererFall, fallLesen, fallSchreiben, fallMerken, fallErinnern, fallErinnernZufahrt, eingabenZahl, imGebiet, speicherKey,
  type Fall, type FallErgebnis } from './fall'
import { KEINE_ALLE_EINGABEN } from './rechner/typen'

const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const rechteck = (x0: number, y0: number, x1: number, y1: number): P[] => [lv(x0, y0), lv(x1, y0), lv(x1, y1), lv(x0, y1)]
const fallMit = (f: (x: Fall) => void): Fall => { const x = leererFall(46.95492, 7.43717, 32865596); f(x); return x }

describe('Fall-Datei: Hindernisse hin und zurück', () => {
  it('alle Arten, verworfene Vorschläge und Quellen-Häkchen bleiben gleich', () => {
    const f = fallMit(x => {
      x.ort.zufahrt = '7:0:1'
      x.hindernisse.push(
        { id: 'a', art: 'parkfeld', klasse: 'motorrad', ring: rechteck(1, 1, 3, 6), quelle: 'hand' },
        { id: 'osm:5:right:0', art: 'parkfeld', klasse: 'auto', ring: rechteck(5, 1, 30, 3), quelle: 'osm', name: 'Parkierung aus OSM – bestätigt' },
        { id: 'b', art: 'baum', p: lv(3, 5), stamm: 0.5, quelle: 'hand' },
        { id: 'bern:4711', art: 'baum', p: lv(8, 5), stamm: 0.5, quelle: 'kataster', name: 'Linde Nr. 4711 (Baumkataster)' },
        { id: 'c', art: 'hecke', linie: [lv(0, 5), lv(5, 5)], sichtbehindernd: false, quelle: 'hand' },
        { id: 'm', art: 'mauer', linie: [lv(0, 7), lv(5, 7), lv(5, 9)], sichtbehindernd: true, quelle: 'hand' },
        { id: 'z1', art: 'zaun', linie: [lv(0, 8), lv(5, 8)], dicht: true, quelle: 'hand' },
        { id: 'z2', art: 'zaun', linie: [lv(0, 9), lv(5, 9)], dicht: false, quelle: 'hand' },
        { id: 'u', art: 'uebrige', ring: rechteck(10, 10, 12, 11), sichtbehindernd: true, quelle: 'hand' },
        { id: 'l', art: 'laengsparkierung', linie: [lv(0, 3), lv(9, 3)], breite: 2.2, quelle: 'hand' })
      x.vorschlaege['osm:1:right:0'] = 'verworfen'
      x.vorschlaege['bernpark:Parkfeld_Gebuehrenpflichtig:12:0'] = 'verworfen'
      x.baumkataster = true
      x.parkkataster = false
      x.quellen = { osm: 'OSM', av: 'AV', baumkataster: 'Geodaten Stadt Bern, Baumkataster' }
    })
    const [g, hinweise] = fallLesen(fallSchreiben(f))
    expect(hinweise).toEqual([])
    expect(typeof g.gespeichert).toBe('string')
    expect({ ...g, gespeichert: undefined }).toEqual({ ...f, gespeichert: undefined })
    expect(eingabenZahl(g)).toBe(10 + 2 + 1 + 1)
  })
  it('Vorgaben: Baumkataster aus, amtliche Parkfelder an (Feld fehlt), Zaun ohne Angabe dicht, Hecke ohne Angabe sichtbehindernd', () => {
    const roh = JSON.parse(fallSchreiben(fallMit(() => {})))
    roh.hindernisse = [{ id: 'z', art: 'zaun', linie: [[1, 2], [3, 4]] }, { id: 'h', art: 'hecke', linie: [[1, 2], [3, 4]] }]
    delete roh.baumkataster
    const [g] = fallLesen(JSON.stringify(roh))
    expect(g.baumkataster).toBe(false)
    expect(g.parkkataster).toBeUndefined()
    expect(g.hindernisse).toEqual([{ id: 'z', art: 'zaun', linie: [[1, 2], [3, 4]], dicht: true, quelle: 'hand' },
      { id: 'h', art: 'hecke', linie: [[1, 2], [3, 4]], sichtbehindernd: true, quelle: 'hand' }])
  })
  it('ungültige Einträge übergangen und gemeldet, gültige bleiben', () => {
    const roh = JSON.parse(fallSchreiben(fallMit(() => {})))
    roh.hindernisse = [null, 'baum', { id: 'x', art: 'baum' }, { id: 'i', art: 'insel', ring: [[0, 0], [1, 0], [1, 1]] },
      { id: 'p', art: 'parkfeld', ring: [[0, 0], [1, 0]] }, { id: 'b', art: 'baum', p: [1, 2], stamm: 0.5, quelle: 'hand' },
      { id: 'b', art: 'baum', p: [3, 4], stamm: 0.5, quelle: 'hand' }, { id: 'k', art: 'parkfeld', klasse: 'lkw', ring: [[0, 0], [1, 0], [1, 1]] }]
    roh.vorschlaege = { x: 'verworfen', y: true }
    roh.quellen = { osm: 'OSM', av: 5, fremd: 'x' }
    // «__proto__» als echter Schlüssel (JSON), nie übernommen
    const text = JSON.stringify(roh).replace('"vorschlaege":{', '"vorschlaege":{"__proto__":"verworfen",')
    expect(text).toContain('"__proto__"')
    const [g, h] = fallLesen(text)
    expect(g.hindernisse.map(x => [x.id, x.art === 'parkfeld' ? x.klasse : x.art])).toEqual([['b', 'baum'], ['k', 'auto']])
    expect(g.vorschlaege).toEqual({ x: 'verworfen' })
    expect(Object.getPrototypeOf(g.vorschlaege)).toBe(Object.prototype)
    expect(g.quellen).toEqual({ osm: 'OSM' })
    expect(h).toEqual(['Quelle «av» ungültig, übergangen', 'Hindernis ungültig, übergangen', 'Hindernis ungültig, übergangen',
      'Hindernis ungültig, übergangen', 'Hindernis ungültig, übergangen', 'Hindernis ungültig, übergangen', 'Hindernis b doppelt, übergangen',
      'Vorschlag y ungültig, übergangen'])
  })
  it('Listen bzw. Objekte vom falschen Typ: übergangen, keine Ausnahme; fremde Datei, Version und Ort werfen', () => {
    const roh = JSON.parse(fallSchreiben(fallMit(() => {})))
    const [g, h] = fallLesen(JSON.stringify({ ...roh, hindernisse: { a: 1 }, vorschlaege: ['x'] }))
    expect(g.hindernisse).toEqual([])
    expect(g.vorschlaege).toEqual({})
    expect(h).toEqual(['Hindernisse ungültig (keine Liste), übergangen', 'Vorschläge ungültig (kein Objekt), übergangen'])
    expect(() => fallLesen('{"app":"fgsCheck","version":1}')).toThrow(/keine Fall-Datei/)
    expect(() => fallLesen(JSON.stringify({ ...roh, version: 99 }))).toThrow(/Version 99/)
    expect(() => fallLesen(JSON.stringify({ ...roh, ort: { lat: 1200000, lon: 2600000 } }))).toThrow(/keine WGS84/)
    expect(() => fallLesen(JSON.stringify({ ...roh, ort: { lat: 48.85, lon: 2.35 } }))).toThrow(/ausserhalb der Schweiz/)
    expect(imGebiet(47.14, 9.52)).toBe(true)          // Vaduz
  })
  it('Fall aus E0 (ohne Hindernisse) wird gelesen', () => {
    const e0 = { app: 'SichtweitenCheck', version: 1, ort: { lat: 46.95, lon: 7.44, knoten: 30949365, zufahrt: null }, quellen: {} }
    const [g, h] = fallLesen(JSON.stringify(e0))
    expect(h).toEqual([])
    expect(g.hindernisse).toEqual([])
    expect(g.ort.knoten).toBe(30949365)
  })
})

// E2b: alle Eingaben (E1 und E2b), Zufahrtspunkt, Ergebnis-Auszug; Prüfung jedes Felds (ungültig -> Vorgabe, gemeldet)
describe('Fall-Datei E2b: Eingaben, Zufahrtspunkt', () => {
  const vollerFall = () => fallMit(x => {
    x.ort.zufahrt = '7:0:1'
    x.eingaben = { typ: 'hvs', fahrstreifen: true, neigungGross: false, schwerverkehr: true, neigung: { links: -6.5, rechts: 2 },
      regelung: 'stop', haltelinie: lv(1.25, -4), D: lv(0.5, -7), trottoirFrei: true,
      tempo: { links: { art: 'v85', wert: 38, begruendung: 'Messung Juni 2026' }, rechts: { art: 'fahrbar', wert: 20, begruendung: '' } } }
    x.hindernisse.push({ id: 'b', art: 'baum', p: lv(3, 5), stamm: 0.5, quelle: 'hand' })
    x.vorschlaege['osm:1:right:0'] = 'verworfen'
    x.baumkataster = true
    x.quellen = { osm: 'overpass.osm.ch', av: 'geodienste.ch, Kanton BE', geladen: '2026-10-16' }
  })
  it('hin und zurück mit allen neuen Feldern; Ergebnis-Auszug nur in der Datei', () => {
    const f = vollerFall()
    const erg: FallErgebnis = { zufahrt: 'Fischerweg (Süd)', regelung: 'Stop', B: 3, nullpunkt: 'Vorderkante der Haltelinie', D: lv(0.5, -7),
      Dhand: true, richtungen: [{ richtung: 'links', strasse: 'Brückfeldstrasse', tempo: 38, tempoQuelle: 'von Hand: V85', neigung: -6.5, neigungQuelle: 'von Hand', massgebend: 35,
        vorhanden: 13.3, bisEnde: false, status: 'nicht_erfuellt', statusZusatz: [] }] }
    const text = fallSchreiben(f, erg)
    expect(JSON.parse(text).ergebnis.richtungen[0].vorhanden).toBe(13.3)
    const [g, h] = fallLesen(text)
    expect(h).toEqual([])
    expect(g.ergebnis).toBeUndefined()                        // beim Laden neu gerechnet
    expect({ ...g, gespeichert: undefined }).toEqual({ ...f, gespeichert: undefined })
    expect(eingabenZahl(g)).toBe(12 + 1 + 1 + 1)              // 12 Eingaben E1/E2b, Baum, verworfen, Baumkataster
  })
  it('Grundstückzufahrt: Zufahrtspunkt statt Knoten, Richtung normiert; Schlüssel im Browser', () => {
    const f = leererFall(46.95, 7.44, 32865596, { p: [2600123.44, 1200456.66], richtung: [0, -3] })
    expect([f.ort.knoten, f.ort.zufahrt]).toEqual([null, null])
    const [g, h] = fallLesen(fallSchreiben(f))
    expect(h).toEqual([])
    expect(g.ort.zufahrtspunkt).toEqual({ p: [2600123.44, 1200456.66], richtung: [0, -1] })
    expect(speicherKey(g)).toBe('SichtweitenCheck.fall.z2600123.4,1200456.7')
    expect(speicherKey(leererFall(46.95, 7.44, 42))).toBe('SichtweitenCheck.fall.42')
  })
  it('ungültige Werte fallen einzeln auf die Vorgabe, gültige bleiben; jedes gemeldet', () => {
    const roh = JSON.parse(fallSchreiben(vollerFall()))
    roh.eingaben = { ...roh.eingaben, typ: 'autobahn', fahrstreifen: 'ja', neigung: { links: 45, rechts: 2 }, regelung: 'ampel',
      haltelinie: [1, 2], D: [2600000, 'x'], trottoirFrei: 1,
      tempo: { links: { art: 'v85', wert: 38.5, begruendung: 'x' }, rechts: { art: 'gefühlt', wert: 30, begruendung: '' } } }
    roh.ort.zufahrtspunkt = { p: [7.4, 46.9], richtung: null }
    const [g, h] = fallLesen(JSON.stringify(roh))
    expect(g.eingaben).toEqual({ ...KEINE_ALLE_EINGABEN, neigungGross: false, schwerverkehr: true, neigung: { links: null, rechts: 2 } })
    expect(g.ort.zufahrtspunkt).toBeUndefined()
    expect(g.ort.knoten).toBe(32865596)
    expect(h).toEqual(['Zufahrtspunkt ungültig, übergangen', 'Eingabe «typ» ungültig, Vorgabe', 'Eingabe «fahrstreifen» ungültig, Vorgabe',
      'Eingabe «neigung.links» ungültig, Vorgabe', 'Eingabe «regelung» ungültig, Vorgabe', 'Eingabe «haltelinie» ungültig, Vorgabe',
      'Eingabe «D» ungültig, Vorgabe', 'Eingabe «trottoirFrei» ungültig, Vorgabe', 'Eingabe «tempo.links» ungültig, Vorgabe',
      'Eingabe «tempo.rechts» ungültig, Vorgabe'])
    // Begründung zu lang bzw. kein Text, Knoten und Zufahrt ungültig, Version keine ganze Zahl
    const lang = JSON.parse(fallSchreiben(vollerFall()))
    lang.eingaben.tempo.links.begruendung = 'x'.repeat(600)
    lang.eingaben.tempo.rechts.begruendung = 7
    lang.ort.knoten = '12'; lang.ort.zufahrt = 3
    const [l, hl] = fallLesen(JSON.stringify(lang))
    expect(l.eingaben.tempo.links!.begruendung.length).toBe(500)
    expect(l.eingaben.tempo.rechts).toEqual({ art: 'fahrbar', wert: 20, begruendung: '' })
    expect([l.ort.knoten, l.ort.zufahrt]).toEqual([null, null])
    expect(hl).toEqual(['Knoten ungültig, übergangen', 'Zufahrt ungültig, übergangen', 'Eingabe «tempo.links.begruendung» auf 500 Zeichen gekürzt',
      'Eingabe «tempo.rechts.begruendung» ungültig, leer'])
    for (const v of [0, -1, 1.5]) expect(() => fallLesen(JSON.stringify({ ...lang, version: v }))).toThrow(/Version/)
    // Eingaben kein Objekt: alle Vorgaben
    const [k, hk] = fallLesen(JSON.stringify({ ...roh, eingaben: [1, 2] }))
    expect(k.eingaben).toEqual(KEINE_ALLE_EINGABEN)
    expect(hk).toContain('Eingaben ungültig (kein Objekt), Vorgaben')
  })
  it('fremde Datei (app anders) abgewiesen; Fall E2a (Version 1, ohne Eingaben) mit Vorgaben gelesen', () => {
    const roh = JSON.parse(fallSchreiben(vollerFall()))
    expect(() => fallLesen(JSON.stringify({ ...roh, app: 'fgsCheck' }))).toThrow(/keine Fall-Datei des SichtweitenCheck/)
    expect(() => fallLesen(JSON.stringify({ ...roh, app: undefined }))).toThrow(/keine Fall-Datei/)
    expect(() => fallLesen('[]')).toThrow(/keine Fall-Datei/)
    const { eingaben: _e, ...e2a } = roh
    const [g, h] = fallLesen(JSON.stringify({ ...e2a, version: 1 }))
    expect(h).toEqual([])
    expect(g.eingaben).toEqual(KEINE_ALLE_EINGABEN)
    expect(g.version).toBe(FALL_VERSION)
  })
})

describe('Fall-Datei E3c: Wahrnehmbarkeit und alle Arme (Version 5)', () => {
  it('hin und zurück; Version 4 ohne die Felder: Vorgabe; ungültige Wahrnehmbarkeit gemeldet', () => {
    const f = fallMit(x => {
      x.ort.zufahrt = '7:0:1'
      x.eingaben = { ...KEINE_ALLE_EINGABEN, regelung: 'rechtsvortritt', wahrnehmbarkeit: 'sehr_gut', alleArme: true }
    })
    const text = fallSchreiben(f)
    expect(JSON.parse(text).version).toBeGreaterThanOrEqual(5)
    const [g, h] = fallLesen(text)
    expect(h).toEqual([])
    expect(g.eingaben).toEqual(f.eingaben)
    expect(eingabenZahl(g)).toBe(3)
    // Version 4 (E3b) ohne die neuen Felder
    const roh = JSON.parse(text)
    delete roh.eingaben.wahrnehmbarkeit; delete roh.eingaben.alleArme
    const [v4] = fallLesen(JSON.stringify({ ...roh, version: 4 }))
    expect([v4.eingaben.regelung, v4.eingaben.wahrnehmbarkeit ?? null, v4.eingaben.alleArme ?? false]).toEqual(['rechtsvortritt', null, false])
    const [u, hu] = fallLesen(JSON.stringify({ ...roh, eingaben: { ...roh.eingaben, wahrnehmbarkeit: 'mittel', alleArme: 'ja' } }))
    expect(u.eingaben.wahrnehmbarkeit ?? null).toBe(null)
    expect(hu).toEqual(['Eingabe «wahrnehmbarkeit» ungültig, Vorgabe', 'Eingabe «alleArme» ungültig, Vorgabe'])
  })
})

describe('Fall im Browser merken (localStorage je Knoten)', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  const speicher = () => {
    const m = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) },
      removeItem: (k: string) => { m.delete(k) } })
    return m
  }
  it('ohne Eingaben kein Eintrag; mit Hindernis gespeichert; alles gelöscht: Eintrag entfernt', () => {
    const m = speicher()
    const leer = leererFall(46.95, 7.44, 42)
    fallMerken(leer)
    expect(m.size).toBe(0)
    const mit = structuredClone(leer)
    mit.hindernisse.push({ id: 'b', art: 'baum', p: lv(1, 1), stamm: 0.5, quelle: 'hand' })
    fallMerken(mit)
    expect([...m.keys()]).toEqual(['SichtweitenCheck.fall.42'])
    expect(fallErinnern(42)?.hindernisse.map(h => h.id)).toEqual(['b'])
    expect(fallErinnern(43)).toBeNull()
    fallMerken(leer)
    expect(m.size).toBe(0)
  })
  it('Häkchen allein werden gemerkt; kaputte Einträge und fremder Knoten ergeben null', () => {
    const m = speicher()
    const a = leererFall(46.95, 7.44, 7); a.parkkataster = false
    fallMerken(a)
    expect(fallErinnern(7)?.parkkataster).toBe(false)
    m.set('SichtweitenCheck.fall.5', '{kaputt')
    m.set('SichtweitenCheck.fall.6', fallSchreiben({ ...leererFall(46.95, 7.44, 9), baumkataster: true }))
    expect(fallErinnern(5)).toBeNull()
    expect(fallErinnern(6)).toBeNull()
  })
  it('Zufahrtspunkt: eigener Eintrag, gewählte Zufahrt bzw. Eingaben allein werden gemerkt', () => {
    const m = speicher()
    fallMerken(leererFall(46.95, 7.44, null, { p: [2600010, 1200020], richtung: null }))
    expect(m.size).toBe(0)                                  // Zufahrtspunkt allein: hält die Adresse
    const z = leererFall(46.95, 7.44, null, { p: [2600010, 1200020], richtung: [0, -1] })
    fallMerken(z)
    expect([...m.keys()]).toEqual(['SichtweitenCheck.fall.z2600010.0,1200020.0'])
    expect(fallErinnernZufahrt([2600010.02, 1200019.98])?.ort.zufahrtspunkt?.p).toEqual([2600010, 1200020])
    expect(fallErinnernZufahrt([2600011, 1200020])).toBeNull()
    expect(fallErinnern(2600010)).toBeNull()
    const k = leererFall(46.95, 7.44, 8); k.eingaben.regelung = 'stop'
    fallMerken(k)
    expect(fallErinnern(8)?.eingaben.regelung).toBe('stop')
    const a = leererFall(46.95, 7.44, 9); a.ort.zufahrt = '1:0:1'
    fallMerken(a)
    expect(fallErinnern(9)?.ort.zufahrt).toBe('1:0:1')
  })
  it('ohne localStorage (Zugriff wirft): kein Absturz', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('gesperrt') }, setItem: () => { throw new Error('gesperrt') },
      removeItem: () => { throw new Error('gesperrt') } })
    const f = leererFall(46.95, 7.44, 1); f.baumkataster = true
    expect(() => fallMerken(f)).not.toThrow()
    expect(fallErinnern(1)).toBeNull()
  })
})

describe('Fall-Datei E4a: Bezeichnung (Version 6)', () => {
  it('hin und zurück; Version 5 ohne Bezeichnung lesbar; zu lang gekürzt, ungültig gemeldet', () => {
    const f = fallMit(x => { x.ort.bezeichnung = 'Hallerstrasse / Alpeneggstrasse, Projekt 2026' })
    const text = fallSchreiben(f)
    expect(JSON.parse(text).version).toBe(FALL_VERSION)      // seit K0 Version 7 (vorher 6)
    const [g, h] = fallLesen(text)
    expect(h).toEqual([])
    expect(g.ort.bezeichnung).toBe('Hallerstrasse / Alpeneggstrasse, Projekt 2026')
    // Version 5 (E3c) ohne Bezeichnung
    const roh = JSON.parse(text)
    delete roh.ort.bezeichnung
    const [v5, h5] = fallLesen(JSON.stringify({ ...roh, version: 5 }))
    expect([v5.ort.bezeichnung, h5, v5.version]).toEqual([undefined, [], FALL_VERSION])
    // zu lang: auf 200 Zeichen gekürzt; Zahl statt Text: übergangen; nur Leerzeichen: keine Bezeichnung
    const [lang, hl] = fallLesen(JSON.stringify({ ...roh, ort: { ...roh.ort, bezeichnung: 'x'.repeat(250) } }))
    expect([lang.ort.bezeichnung?.length, hl]).toEqual([200, ['Bezeichnung auf 200 Zeichen gekürzt']])
    const [zahl, hz] = fallLesen(JSON.stringify({ ...roh, ort: { ...roh.ort, bezeichnung: 42 } }))
    expect([zahl.ort.bezeichnung, hz]).toEqual([undefined, ['Bezeichnung ungültig, übergangen']])
    const [leer] = fallLesen(JSON.stringify({ ...roh, ort: { ...roh.ort, bezeichnung: '   ' } }))
    expect(leer.ort.bezeichnung).toBeUndefined()
  })
})

describe('Fall-Datei K0: Trottoirüberfahrt und Quelle V_sig (Version 7)', () => {
  it('hin und zurück; Version 6 ohne Trottoirüberfahrt lesbar; ungültige Breite -> Modus ohne Breite, gemeldet', () => {
    const f = fallMit(x => {
      x.ort.zufahrt = '7:0:1'
      x.eingaben.trottoirueberfahrt = { breite: 2.5 }
      x.quellen = { vsig: 'Geodaten Stadt Bern, Signalisierte Höchstgeschwindigkeit' }
    })
    const text = fallSchreiben(f)
    expect(JSON.parse(text).version).toBe(7)
    const [g, h] = fallLesen(text)
    expect(h).toEqual([])
    expect(g.eingaben.trottoirueberfahrt).toEqual({ breite: 2.5 })
    expect(g.quellen.vsig).toBe('Geodaten Stadt Bern, Signalisierte Höchstgeschwindigkeit')
    expect(eingabenZahl(g)).toBe(2)                        // Häkchen und Breite
    const roh = JSON.parse(text)
    // Modus ohne Breite
    const [o] = fallLesen(JSON.stringify({ ...roh, eingaben: { ...roh.eingaben, trottoirueberfahrt: { breite: null } } }))
    expect([o.eingaben.trottoirueberfahrt, eingabenZahl(o)]).toEqual([{ breite: null }, 1])
    // Version 6: ohne das Feld kein Modus
    const { trottoirueberfahrt: _t, ...ohne } = roh.eingaben
    const [v6, h6] = fallLesen(JSON.stringify({ ...roh, version: 6, eingaben: ohne }))
    expect([v6.eingaben.trottoirueberfahrt, h6, v6.version]).toEqual([undefined, [], FALL_VERSION])
    // ungültig
    const [u, hu] = fallLesen(JSON.stringify({ ...roh, eingaben: { ...roh.eingaben, trottoirueberfahrt: { breite: 50 } } }))
    expect([u.eingaben.trottoirueberfahrt, hu]).toEqual([{ breite: null }, ['Eingabe «trottoirueberfahrt.breite» ungültig, ohne Breite']])
    const [k, hk] = fallLesen(JSON.stringify({ ...roh, eingaben: { ...roh.eingaben, trottoirueberfahrt: 'ja' } }))
    expect([k.eingaben.trottoirueberfahrt, hk]).toEqual([undefined, ['Eingabe «trottoirueberfahrt» ungültig, Vorgabe']])
    // Version 8 (Zukunft) nicht lesbar
    expect(() => fallLesen(JSON.stringify({ ...roh, version: 8 }))).toThrow('Version 8')
  })
})

describe('Fall-Datei K0: D\' von Hand (Dtrottoir, Version 7)', () => {
  it('hin und zurück; fehlt in älteren Dateien (= null); ungültig -> Vorgabe, gemeldet', () => {
    const f = fallMit(x => { x.eingaben.trottoirueberfahrt = { breite: null }; x.eingaben.Dtrottoir = [2600010.5, 1200020.25] })
    const text = fallSchreiben(f)
    expect(JSON.parse(text).version).toBe(7)
    const [g, h] = fallLesen(text)
    expect([g.eingaben.Dtrottoir, h, eingabenZahl(g)]).toEqual([[2600010.5, 1200020.25], [], 2])
    const roh = JSON.parse(text)
    const { Dtrottoir: _d, ...ohne } = roh.eingaben
    expect(fallLesen(JSON.stringify({ ...roh, eingaben: ohne }))[0].eingaben.Dtrottoir ?? null).toBeNull()
    const [u, hu] = fallLesen(JSON.stringify({ ...roh, eingaben: { ...roh.eingaben, Dtrottoir: [1, 2] } }))
    expect([u.eingaben.Dtrottoir ?? null, hu]).toEqual([null, ['Eingabe «Dtrottoir» ungültig, Vorgabe']])
  })
})
