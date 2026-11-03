import { describe, expect, it } from 'vitest'
import { add, dist, sub, wgs, type P } from './geo'
import { zufahrtKontext, zufahrtEntwurf } from './zufahrtEntwurf'
import { zufahrtWinkel } from './rechner/grundstueck'
import { rechneKnoten } from './rechner/rechnen'
import { fallLesen, fallSchreiben, leererFall } from './fall'
import type { OsmDaten, OsmWeg } from './daten/osm'
import type { AvFlaeche } from './daten/av'
const p = (x: number, y: number): P => [2600000 + x, 1200000 + y]
const weg = (id: number, pts: [number, number, number][], tags: Record<string, string>): OsmWeg => ({ id, tags,
  knoten: pts.map(x => x[0]), geom: pts.map(x => wgs(...p(x[1], x[2]))) })
const osm = (kurve = false): OsmDaten => ({ wege: [weg(1, [[1,-200,0],[2,0,0],[3,200,kurve ? 50 : 0]], { highway: 'residential', name: 'Strasse', maxspeed: '30' })],
  tram: [], uebergaenge: [], ampeln: [], querungen: [], relationen: [], vortritt: [] })
const av: AvFlaeche[] = [{ art: 'Strasse_Weg', kanton: 'BE', qualitaet: 'AV93', bfs: 351,
  ringe: [[p(-200,-3), p(200,-3), p(200,60), p(-200,60)]] }]
const entwurf = (o: OsmDaten, punkt: P, grad: string) => {
  const v = zufahrtEntwurf(zufahrtKontext(o,av), punkt, 'winkel', grad, null)
  if (typeof v === 'string') throw Error(v)
  return v
}
describe('Winkelwahl ausschliesslich als Entwurf einer Grundstückszufahrt', () => {
  it.each([20,45,90,135,160])('Winkel %s° bleibt auf beiden Grundstückseiten erhalten; Vorschau und Rechnung sind identisch', grad => {
    for (const y of [-3, 3]) {
      const o = osm(), z = entwurf(o,p(60,y),String(grad))
      expect(z.geo.richtung[1] * y).toBeGreaterThan(0)
      expect(zufahrtWinkel(z.geo.strassenRichtung,z.geo.richtung)).toBeCloseTo(grad,5)
      const r = rechneKnoten(o,av,{knoten:null,zufahrt:null,zufahrtspunkt:z.eingabe})
      expect(r.meldungen).toEqual([])
      expect(dist(r.knoten!.p,z.geo.kp)).toBeLessThan(1e-6)
      expect(r.ergebnis!.zufahrtspunkt!.winkel).toBeCloseTo(grad,5)
      expect(r.ergebnis!.zufahrtspunkt!.herkunft).toBe('winkel')
      const gespeichert = {...z.eingabe,richtung:z.geo.richtung.map(x=>Math.round(x*1e8)/1e8) as P}
      expect(rechneKnoten(o,av,{knoten:null,zufahrt:null,zufahrtspunkt:gespeichert}).meldungen).toEqual([])
      expect(r.ergebnis!.fbRichtung[0]*z.geo.richtung[0]+r.ergebnis!.fbRichtung[1]*z.geo.richtung[1]).toBeLessThan(-0.99)
    }
  })
  it('ungültige, leere und sehr flache Winkel werden erklärt statt auf 90° gesetzt; kein Wechsel ins andere Grundstück', () => {
    const k = zufahrtKontext(osm(),av)
    for (const a of ['', 'abc', '0', '19.9', '160.1', '180', 'Infinity']) expect(zufahrtEntwurf(k,p(60,-3),'winkel',a,null)).toMatch(/20° bis 160°/)
    expect(zufahrtEntwurf(k,p(60,-3),'gezeichnet','90',[1,2])).toMatch(/in das Grundstück/)
    const flach = rechneKnoten(osm(),av,{knoten:null,zufahrt:null,zufahrtspunkt:{p:p(60,-3),richtung:[1,-0.1]}})
    expect(flach.ergebnis).toBeNull(); expect(flach.meldungen.join(' ')).toContain('keine Rücksetzung auf 90°')
  })
  it('lokale Achse an gekrümmter Strasse statt globaler Kartenwinkel; Richtungsgriff und Zahleneingabe gleich', () => {
    const o = osm(true), k = zufahrtKontext(o,av), z = entwurf(o,p(60,12),'55')
    const gezeichnet = zufahrtEntwurf(k,z.eingabe.p,'gezeichnet','',add([0,0],z.geo.richtung,12))
    expect(typeof gezeichnet).not.toBe('string')
    if (typeof gezeichnet === 'string') return
    expect(dist(gezeichnet.geo.kp,z.geo.kp)).toBeLessThan(1e-6)
    expect(zufahrtWinkel(z.geo.strassenRichtung,z.geo.richtung)).toBeCloseTo(55,6)
    expect(zufahrtWinkel(z.geo.strassenRichtung,sub(p(50,0),p(60,12)))).not.toBeCloseTo(55,0)
  })
  it('OSM-Zufahrt bewusst wählbar, senkrechte Vorgabe verwendet sie nicht versehentlich', () => {
    const o = osm();o.wege.push(weg(4,[[4,30,0],[5,35,-30]],{highway:'service',service:'driveway'}))
    // Anschlussknoten muss Bestandteil der Strasse sein.
    o.wege[0]=weg(1,[[1,-200,0],[2,0,0],[4,30,0],[3,200,0]],o.wege[0].tags)
    const k=zufahrtKontext(o,av), punkt=p(30.5,-3)
    const z=zufahrtEntwurf(k,punkt,'osm','',null), normal=zufahrtEntwurf(k,punkt,'senkrecht','',null)
    expect(typeof z).not.toBe('string');expect(typeof normal).not.toBe('string')
    if(typeof z==='string'||typeof normal==='string')return
    expect(z.geo.weg).toBe(4);expect(normal.geo.weg).toBeNull()
    expect(z.geo.richtung[0]).not.toBeCloseTo(0,1);expect(normal.geo.richtung[0]).toBeCloseTo(0,5)
    expect(zufahrtEntwurf(k,p(100,-3),'osm','',null)).toMatch(/Keine passende OSM-Zufahrt/)
  })
  it('Version 12 speichert nur Richtung und Herkunft; alte Richtungsvektoren und eigene Angaben bleiben erhalten', () => {
    const z=entwurf(osm(),p(60,-3),'45'), f=leererFall(46.9,7.4,null,z.eingabe)
    f.eingaben.haltelinie=p(60,-4);f.eingaben.D=p(60,-7)
    const text=fallSchreiben(f), [g,h]=fallLesen(text)
    expect(JSON.parse(text).version).toBe(12);expect(h).toEqual([])
    expect(g.ort.zufahrtspunkt!.herkunft).toBe('winkel');expect(g.ort.zufahrtspunkt).not.toHaveProperty('winkel')
    expect(g.eingaben.D).toEqual(f.eingaben.D);expect(g.eingaben.haltelinie).toEqual(f.eingaben.haltelinie)
    const alt={...JSON.parse(text),version:11};delete alt.ort.zufahrtspunkt.herkunft
    const [a]=fallLesen(JSON.stringify(alt));expect(a.ort.zufahrtspunkt!.richtung).toEqual(g.ort.zufahrtspunkt!.richtung)
  })
})
