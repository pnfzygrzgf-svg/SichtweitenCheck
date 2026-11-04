import { describe, expect, it } from 'vitest'
import { ebenenAusDaten, ebenenSichtbar } from './quellenEbenen'
import type { OsmDaten, OsmWeg } from './daten/osm'
import { regionalLesen, type RegionalSnapshot } from './daten/anbieter/gemeinsam/regional'
import { regionalDienst } from './daten/anbieter/gemeinsam/regionalDienste'
import { e6Stand } from './daten/anbieter/gemeinsam/e6'
import { readFileSync } from 'node:fs'

const weg = (id: number, tags: Record<string, string>): OsmWeg => ({ id, tags, knoten: [1, 2], geom: [[46.95, 7.44], [46.95, 7.441]] })
const osm = (x: Partial<OsmDaten>): OsmDaten => ({ wege: [], tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [], ...x })
const leer = { osm: null, vsig: null, park: null, baeume: null, av: null, profile: [], hoehen: null }

it('E6-Kontext hat Originalpunkte/-linien, Datum und Anbieter; vorhandenes Tempo bleibt erhalten', () => {
  const teile = ['zh.licht', 'zh.taktil', 'zh.netz'].map(id => {
    const f = JSON.parse(readFileSync(new URL(`./daten/anbieter/gemeinsam/testdaten/e6/${id}.json`, import.meta.url), 'utf8'))
    const d = regionalDienst('e6.' + id)!
    return { id: d.id, roh: f.roh, meta: f.meta, objekte: regionalLesen(d, f.roh), url: d.url, abgerufen: '2026-11-03T00:00:00Z', datenstand: e6Stand(f.meta) }
  })
  const regional: RegionalSnapshot = { version: 1, mitte: [2683000, 1252000], radiusM: 200, teile }
  const d = ebenenAusDaten({ ...leer, regional, osm: osm({ wege: [weg(1, { maxspeed: '30' })] }) })
  expect(d['regional.e6.zh.licht']).toHaveLength(15)
  expect(d['regional.e6.zh.taktil']?.every(o => o.punkt && !o.ringe)).toBe(true)
  expect(d['regional.e6.zh.netz']?.[0].linien).toBeDefined()
  expect(d.tempo?.[0]).toMatchObject({ wert: '30', gestrichelt: true })
  const menu = ebenenSichtbar(d).zeigen.filter(e => e.id.startsWith('regional.e6.'))
  expect(menu.map(e => e.titel)).toEqual(['Beleuchtung (Stadt Zürich)', 'Fuss- und Velowegnetz (Stadt Zürich)', 'Taktile Rillen an VBZ-Haltestellen (Zürich)'])
  expect(menu.every(e => e.quelle.includes('Stadt Zürich'))).toBe(true)
  expect(menu[1].quelle).toContain('19.10.2022')
  expect(ebenenSichtbar(ebenenAusDaten(leer)).ohne.some(e => e.id.startsWith('regional.e6.'))).toBe(false)
})

describe('quellenEbenen (SichtweitenCheck)', () => {
  it('Tempo: amtlich vor OSM, sonst OSM maxspeed gestrichelt; Strassentyp nach highway', () => {
    const d = ebenenAusDaten({ ...leer, osm: osm({ wege: [weg(1, { highway: 'secondary', maxspeed: '50' })] }) })
    expect(d.tempo!.map(o => [o.klasse, o.gestrichelt])).toEqual([['t50', true]])
    expect(d.strassentyp!.map(o => o.klasse)).toEqual(['haupt'])
    const a = ebenenAusDaten({ ...leer, osm: osm({ wege: [weg(1, { maxspeed: '50' })] }), vsig: [{ id: 'v', strasse: '', vSig: 30, teile: [[[0, 0], [9, 0]]] }] })
    expect(a.tempo!.map(o => o.klasse)).toEqual(['t30'])
  })
  it('Vortritt, Lichtsignale, Rad- und Fusswege, Tram und Übergänge aus OSM', () => {
    const k = (id: number, tags: Record<string, string>) => ({ id, tags, lat: 46.95, lon: 7.44 })
    const d = ebenenAusDaten({ ...leer, osm: osm({ vortritt: [k(1, { highway: 'stop' }), k(2, { highway: 'give_way' })], ampeln: [k(3, {})],
      querungen: [weg(4, { highway: 'cycleway' }), weg(5, { highway: 'footway', footway: 'crossing' })], tram: [weg(6, { railway: 'tram' })],
      uebergaenge: [k(7, { crossing: 'zebra' })], wege: [weg(8, { highway: 'primary', priority_road: 'designated' })] }) })
    expect(d.vortritt!.map(o => o.klasse)).toEqual(['stop', 'give_way', 'prioritaet'])
    expect(d.lsa!.length).toBe(1)
    expect(d.velofuss!.map(o => o.klasse)).toEqual(['rad', 'fuss'])
    expect(d.tram!.map(o => o.klasse)).toEqual(['tram', 'uebergang'])
  })
  it('Profile mit Neigung; Menü nur mit Daten', () => {
    const d = ebenenAusDaten({ ...leer, profile: [{ key: 'links', linie: [[0, 0], [30, 0]] }, { key: 'zufahrt', linie: [] }],
      hoehen: { links: { i: 7.2, quelle: 'swissALTI3D', laenge: 30, punkte: 20, hinweis: null } } })
    expect(d.steigung!.map(o => [o.klasse, o.wert])).toEqual([['n6', '7,2 %']])
    expect(ebenenSichtbar(d).zeigen.map(e => e.id)).toEqual(['steigung'])
  })
})


it('nennt nur angefragte regionale Quellen ohne Daten, keine gebietsfremden Inventare', () => {
  const daten = { 'regional.bund.tram': [], 'regional.bs.tempo': [], metadaten: { 'regional.ge.signal': { datenstand: 'unbekannt' } } }
  const ids = ebenenSichtbar(daten).ohne.map(e => e.id)
  expect(ids).toContain('regional.bund.tram')
  expect(ids).toContain('regional.bs.tempo')
  expect(ids).not.toContain('regional.ge.signal')
  expect(ids).not.toContain('regional.sg.fgs')
  expect(ids).not.toContain('zhTempo')
  expect(ebenenSichtbar({ zhTempo: [], qualitaet: { zhTempo: { datenstand: '01.11.2026' } } }).ohne.map(e => e.id)).toContain('zhTempo')
})

it('AV-Ebene führt geladene Arten, tatsächlichen Kanton und dessen Datenstand im alphabetischen Menü', async () => {
 const { ebenenBeschriften }=await import('./quellenEbenen')
 const av=[{art:'Gebaeude',kanton:'BE',qualitaet:'AV93',bfs:351,ringe:[[[2600000,1200000],[2600010,1200000],[2600010,1200010]]] as [number,number][][]}]
 const d=ebenenAusDaten({...leer,av})
 const beschriftet=ebenenBeschriften({...d,metadaten:{av:{datenstand:'BE: 29.10.2026 (kantonale Publikation)'}}})
 const menu=ebenenSichtbar(beschriftet).zeigen
 const a=menu.find(e=>e.id==='av')!
 expect(a.titel).toBe('Amtliche Vermessung');expect(a.quelle).toContain('Kanton BE');expect(a.quelle).toContain('29.10.2026')
 expect(menu.map(e=>e.titel)).toEqual([...menu.map(e=>e.titel)].sort((a,b)=>a.localeCompare(b,'de-CH',{numeric:true})))
 expect(beschriftet.av?.[0].klasse).toBe('gebaeude')
})


describe('Ladezustand regionaler Kartenquellen', () => {
  it('trennt laufende, fehlgeschlagene und vollständig leere Abfragen', () => {
    const menu = ebenenSichtbar({
      'regional.bund.tram': [],
      metadaten: { 'regional.ge.signal': {}, 'regional.e6.sg.licht': { fehler: 'Dienst nicht erreichbar' } },
    })
    expect(menu.laedt.map(e => e.id)).toEqual(['regional.ge.signal'])
    expect(menu.fehler.map(e => e.id)).toEqual(['regional.e6.sg.licht'])
    expect(menu.ohne.map(e => e.id).filter(id => id.startsWith('regional.'))).toEqual(['regional.bund.tram'])
    expect(menu.zeigen.some(e => e.id === 'regional.e6.sg.licht')).toBe(false)
  })
  it('führt auch bei alten Objekten einen aktuellen Fehler nicht als erfolgreichen Abruf', () => {
    const o = { id: 'alt', punkt: [2600000,1200000] as [number,number], klasse: 'lampe', text: 'alt' }
    const menu = ebenenSichtbar({ 'regional.e6.sg.licht': [o], metadaten: { 'regional.e6.sg.licht': { fehler: 'nicht erreichbar' } } })
    expect(menu.fehler.map(e => e.id)).toContain('regional.e6.sg.licht')
    expect(menu.zeigen.map(e => e.id)).not.toContain('regional.e6.sg.licht')
    expect(menu.ohne.map(e => e.id)).not.toContain('regional.e6.sg.licht')
  })
  it('zeigt den Diensthinweis im tatsächlichen E6-Tooltip genau einmal', async () => {
    const { ebenenBeschriften } = await import('./quellenEbenen')
    const d = regionalDienst('e6.zh.licht')!
    const text = ebenenBeschriften({ 'regional.e6.zh.licht': [{ id: 'a', klasse: 'lampe', text: `Leuchte; ${d.hinweis}` }] })['regional.e6.zh.licht']![0].text
    expect(text.split(d.hinweis)).toHaveLength(2)
    expect(text).toContain('Stadt Zürich')
    expect(text).toContain('Datenstand')
  })
})
