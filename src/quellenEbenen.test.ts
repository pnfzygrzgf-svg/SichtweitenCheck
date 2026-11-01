import { describe, expect, it } from 'vitest'
import { ebenenAusDaten, ebenenSichtbar } from './quellenEbenen'
import type { OsmDaten, OsmWeg } from './daten/osm'

const weg = (id: number, tags: Record<string, string>): OsmWeg => ({ id, tags, knoten: [1, 2], geom: [[46.95, 7.44], [46.95, 7.441]] })
const osm = (x: Partial<OsmDaten>): OsmDaten => ({ wege: [], tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [], ...x })
const leer = { osm: null, vsig: null, park: null, baeume: null, av: null, profile: [], hoehen: null }

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
