// Parkfelder der Stadt Zürich: Die Rechnung kennt sie nur als bestätigte Hindernisse. Lage wie rechner/vorschlaege.test.ts (Meter, Ursprung = OSM-Knoten):
// Hauptstrasse West–Ost, Fahrbahn y = −3 … +3, Nebenstrasse von Süden. Felder längs am Südrand westlich des Knotens, im Sichtfeld nach links.
import { describe, expect, it } from 'vitest'
import { wgs, type P } from './geo'
import type { OsmDaten, OsmWeg } from './daten/osm'
import type { AvFlaeche } from './daten/av'
import { parkQuelleAmOrt } from './daten/parkLuzern'
import { ZH_PARK_FLAECHE, zhParkFelder, zhParkVorschlaege } from './daten/anbieter/gemeinsam/parkZuerich'
import { quelleText, ZH_PARK_QUELLE_TEXT, type Hindernis } from './rechner/hindernisse'
import { rechneKnoten } from './rechner/rechnen'
import { parkKatasterFelder } from './rechner/vorschlaege'
import { KEINE_HINDERNISSE, type HindernisEingaben } from './rechner/typen'

const O: P = [2600000, 1200000]
const lv = (x: number, y: number): P => [O[0] + x, O[1] + y]
const ll = (x: number, y: number): [number, number] => wgs(O[0] + x, O[1] + y)
const weg = (id: number, knoten: [number, number, number][], tags: Record<string, string>): OsmWeg => ({ id, tags, knoten: knoten.map(k => k[0]), geom: knoten.map(k => ll(k[1], k[2])) })
const osm: OsmDaten = { wege: [weg(1, [[10, -200, 0], [12, 0, 0], [13, 200, 0]], { highway: 'unclassified', name: 'Hauptstrasse', maxspeed: '30' }),
  weg(2, [[12, 0, 0], [20, 0, -200]], { highway: 'residential', name: 'Nebenstrasse', maxspeed: '30' })], tram: [], uebergaenge: [], ampeln: [], relationen: [], querungen: [], vortritt: [] }
const fahrbahn: AvFlaeche = { art: 'Strasse_Weg', kanton: 'ZH', qualitaet: 'AV93', bfs: 261, ringe: [[lv(-200, -3), lv(-2.5, -3), lv(-2.5, -200), lv(2.5, -200), lv(2.5, -3), lv(200, -3), lv(200, 3), lv(-200, 3), lv(-200, -3)]] }
const rechne = (h: HindernisEingaben) => rechneKnoten(osm, [fahrbahn], { knoten: 12, zufahrt: null, hindernisse: h }).ergebnis!
const CRS = { properties: { name: 'urn:ogc:def:crs:EPSG::2056' } }
const felder = zhParkFelder({ crs: CRS, features: [8, 14, 20, 26].map((x, i) => ({ geometry: { type: 'MultiPoint', coordinates: [lv(-x, -2)] },
  properties: { objectid: i + 1, davnr: '1', orientierung: 'LPU', art: 'Standard', bezeichnung: 'Hauptstrasse', parkfeldnummer: i + 1 } })) }, { crs: CRS, features: [] })
const vorschlaege = zhParkVorschlaege(parkKatasterFelder(felder, O, 120, 'Stadt Zürich'), [], {})

describe('Parkfelder Stadt Zürich in der Rechnung', () => {
  it('wirken nicht, solange sie Vorschlag oder verworfen sind', () => {
    expect(parkQuelleAmOrt([261])).toBeNull()
    expect(vorschlaege).toHaveLength(4)
    const ohne = rechne(KEINE_HINDERNISSE), verworfen = rechne({ ...KEINE_HINDERNISSE, verworfen: vorschlaege.map(v => v.id) })
    expect(JSON.stringify(verworfen.richtungen)).toBe(JSON.stringify(ohne.richtungen))
    expect(ohne.hindernis.amtlich).toEqual([])
    expect(ohne.hindernis.vorschlaege).toEqual([])
  })
  it('wirken wie ein Parkfeld, sobald sie bestätigt sind', () => {
    const ohne = rechne(KEINE_HINDERNISSE), bestaetigt = rechne({ ...KEINE_HINDERNISSE, hindernisse: vorschlaege.map(v => v.hindernis) })
    expect(JSON.stringify(bestaetigt.richtungen)).not.toBe(JSON.stringify(ohne.richtungen))
  })
  it('tragen im Sichtergebnis ihren eigenen Text; das Resultat ist dasselbe wie mit einem gewöhnlichen amtlichen Feld', () => {
    const zh = rechne({ ...KEINE_HINDERNISSE, hindernisse: vorschlaege.map(v => v.hindernis) })
    const anders = rechne({ ...KEINE_HINDERNISSE, hindernisse: vorschlaege.map(v => ({ ...v.hindernis, id: v.id.replace('zhpark:', 'bernpark:') })) })
    const texte = (e: typeof zh) => JSON.stringify(e.richtungen)
    expect(texte(zh)).toContain(ZH_PARK_FLAECHE)
    expect(texte(zh)).not.toContain('amtlich (Parkkataster)')
    expect(texte(anders)).toContain('amtlich (Parkkataster)')
    expect(texte(zh).split(ZH_PARK_FLAECHE).join('amtlich (Parkkataster)').split('zhpark:').join('bernpark:')).toBe(texte(anders))
    expect(ZH_PARK_QUELLE_TEXT).toBe(ZH_PARK_FLAECHE)
  })
  it('Berner, Luzerner und Baum-Einträge behalten ihren Text', () => {
    const ring: P[] = [lv(0, 0), lv(5, 0), lv(5, 2)]
    const feld = (id: string): Hindernis => ({ id, art: 'parkfeld', klasse: 'auto', ring, quelle: 'kataster' })
    expect(quelleText(feld('bernpark:Parkfeld:1:0'))).toBe('amtlich (Parkkataster)')
    expect(quelleText(feld('luzernpark:Parkfeld:1:0'))).toBe('amtlich (Parkkataster)')
    expect(quelleText({ id: 'bern:1', art: 'baum', p: lv(0, 0), stamm: 0.5, quelle: 'kataster' })).toBe('Baumkataster')
    expect(quelleText(feld('zhpark:p:1:0'))).toBe(ZH_PARK_FLAECHE)
  })
})
