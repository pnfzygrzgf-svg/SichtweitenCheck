import { describe, expect, it } from 'vitest'
import { ebenenAusDaten, ebenenSichtbar } from './quellenEbenen'
import type { OsmDaten, OsmWeg } from './daten/osm'
import { regionalDienst } from './daten/anbieter/gemeinsam/regionalDienste'
import { UNFALL_EBENE, objektQuelleUrl } from './kartenbaustein/quellenLink'

// Die Unfall-Ebenen stehen immer in der Liste: Ihr Kartenbild gilt überall, nicht nur um den Prüfpunkt
const ohneUnfaelle = <T extends { id: string }>(l: T[]) => l.filter(e => !UNFALL_EBENE[e.id] && e.id !== 'npvm' && e.id !== 'haltestellen')

// Fehlt ein Vorsatz in quellenLink.tsx, landet das Objekt still auf dem Kartenausschnitt statt beim Objekt
const ohneObjektlink = (d: object) => Object.entries(d).flatMap(([ebene, liste]) => (Array.isArray(liste) ? liste as { id: string; text: string; quelle?: string; profil?: true }[] : [])
  .filter(o => `${o.quelle ?? ''} ${o.text}`.includes('OpenStreetMap') && !o.profil)
  .filter(o => !/openstreetmap\.org\/(node|way|relation)\/\d+/.test(objektQuelleUrl(o, ebene, 'https://www.openstreetmap.org/', { lat: 47, lon: 7, e: 2600000, n: 1200000 }) ?? ''))
  .map(o => o.id))

const weg = (id: number, tags: Record<string, string>): OsmWeg => ({ id, tags, knoten: [1, 2], geom: [[46.95, 7.44], [46.95, 7.441]] })
const osm = (x: Partial<OsmDaten>): OsmDaten => ({ wege: [], tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [], ...x })
const leer = { osm: null, vsig: null, park: null, baeume: null, av: null, profile: [], hoehen: null }

it('E6-Kontext (Beleuchtung, Wegnetz, Rillen) erscheint nicht als Ebene; vorhandenes Tempo bleibt erhalten', () => {
  const d = ebenenAusDaten({ ...leer, osm: osm({ wege: [weg(1, { maxspeed: '30' })] }) })
  expect(d.tempo?.[0]).toMatchObject({ wert: '30', gestrichelt: true })
  const menu = ebenenSichtbar(d)
  expect([...menu.zeigen, ...menu.ohne, ...menu.laedt, ...menu.fehler].filter(e => e.id.startsWith('regional.e6.'))).toEqual([])
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
  it('jedes OSM-Objekt führt zu seinem Objekt in OpenStreetMap', () => {
    const knoten = (id: number, tags: Record<string, string>) => ({ id, tags, lat: 46.95, lon: 7.44 })
    const d = ebenenAusDaten({ ...leer, osm: { wege: [weg(1, { highway: 'residential', maxspeed: '30', priority_road: 'designated' })], tram: [weg(2, { railway: 'tram' })],
      querungen: [weg(3, { highway: 'footway' })], vortritt: [knoten(4, { highway: 'stop' })], ampeln: [knoten(5, {})], uebergaenge: [knoten(6, {})] } } as never)
    for (const ebene of ['tempo', 'vortritt', 'lsa', 'velofuss', 'strassentyp', 'tram'] as const) expect(d[ebene]!.length).toBeGreaterThan(0)
    expect(ohneObjektlink(d)).toEqual([])
  })
  it('Profile mit Neigung; Menü nur mit Daten', () => {
    const d = ebenenAusDaten({ ...leer, profile: [{ key: 'links', linie: [[0, 0], [30, 0]] }, { key: 'zufahrt', linie: [] }],
      hoehen: { links: { i: 7.2, quelle: 'swissALTI3D', laenge: 30, punkte: 20, hinweis: null } } })
    expect(d.steigung!.map(o => [o.klasse, o.wert])).toEqual([['n6', '7,2 %']])
    expect(ohneUnfaelle(ebenenSichtbar(d).zeigen).map(e => e.id)).toEqual(['steigung'])
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
      metadaten: { 'regional.ge.signal': {}, 'regional.sz.signal': { fehler: 'Dienst nicht erreichbar' } },
    })
    expect(menu.laedt.map(e => e.id)).toEqual(['regional.ge.signal'])
    expect(menu.fehler.map(e => e.id)).toEqual(['regional.sz.signal'])
    expect(menu.ohne.map(e => e.id).filter(id => id.startsWith('regional.'))).toEqual(['regional.bund.tram'])
    expect(menu.zeigen.some(e => e.id === 'regional.sz.signal')).toBe(false)
  })
  it('führt auch bei alten Objekten einen aktuellen Fehler nicht als erfolgreichen Abruf', () => {
    const o = { id: 'alt', punkt: [2600000,1200000] as [number,number], klasse: 'lampe', text: 'alt' }
    const menu = ebenenSichtbar({ 'regional.sz.signal': [o], metadaten: { 'regional.sz.signal': { fehler: 'nicht erreichbar' } } })
    expect(menu.fehler.map(e => e.id)).toContain('regional.sz.signal')
    expect(menu.zeigen.map(e => e.id)).not.toContain('regional.sz.signal')
    expect(menu.ohne.map(e => e.id)).not.toContain('regional.sz.signal')
  })
  it('zeigt den Diensthinweis im tatsächlichen Tooltip genau einmal', async () => {
    const { ebenenBeschriften } = await import('./quellenEbenen')
    const d = regionalDienst('sz.signal')!
    const text = ebenenBeschriften({ 'regional.sz.signal': [{ id: 'a', klasse: 'signal', text: `Vortrittssignal; ${d.hinweis}` }] })['regional.sz.signal']![0].text
    expect(text.split(d.hinweis)).toHaveLength(2)
    expect(text).toContain('Datenstand')
  })
})
