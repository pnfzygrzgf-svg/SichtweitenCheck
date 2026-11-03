import { describe, expect, it } from 'vitest'
import { wgs } from '../../geo'
import { leererFall, fallLesen, fallSchreiben } from '../../fall'
import { ebenenAusDaten } from '../../quellenEbenen'
import { bavUmwandeln, bavUrl } from './gemeinsam/bav'
import type { BavSnapshot } from './gemeinsam/typen'
import roh from './gemeinsam/testdaten/bav-zuerich.json'

const mitte: [number, number] = [2683105, 1247126], [lat, lon] = wgs(...mitte)
const bav: BavSnapshot = { version: 1, quelleId: 'bav.halt', datenstand: null, abgerufen: '2026-11-01T12:00:00.000Z',
  mitte, radiusM: 400, url: bavUrl(lat, lon, 400), vollstaendigkeit: 'unbekannt', halte: bavUmwandeln(roh).halte }
describe('E1a: Kartenquelle und Fall-Datei', () => {
  it('Haltestellen sind auch ohne AV/OSM sichtbar; sie ändern keine anderen Kartenobjekte', () => {
    const eingang = { osm: null, vsig: null, park: null, baeume: null, av: null, profile: [], hoehen: null }
    const vorher = ebenenAusDaten(eingang), nachher = ebenenAusDaten({ ...eingang, bav })
    expect(nachher.bav).toHaveLength(3)
    expect(nachher.bav![0].text).toContain(bav.abgerufen)
    const { bav: _alt, ...restAlt } = vorher, { bav: _neu, ...restNeu } = nachher
    expect(restNeu).toEqual(restAlt)
  })
  it('Ausschnitt, Herkunft und eigene Eingaben bleiben beim Speichern und Öffnen erhalten', () => {
    const f = leererFall(lat, lon, 1)
    f.amtlicheQuellen = { bav }; f.quellen.bav = '© BAV'; f.eingaben.schwerverkehr = true
    const [neu, hinweise] = fallLesen(fallSchreiben(f))
    expect(hinweise).toEqual([])
    expect(neu.amtlicheQuellen).toEqual(f.amtlicheQuellen)
    expect(neu.quellen.bav).toBe('© BAV')
    expect(neu.eingaben).toEqual(f.eingaben)
    const alt = leererFall(lat, lon, 1)
    expect(fallLesen(fallSchreiben(alt))[0].amtlicheQuellen).toBeUndefined()
  })
})
