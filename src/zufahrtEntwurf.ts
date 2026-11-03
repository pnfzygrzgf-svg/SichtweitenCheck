import type { P } from './geo'
import { OsmNetz } from './rechner/netz'
import { OsmAchsen } from './rechner/achsen'
import { Fahrbahn } from './rechner/flaechen'
import type { OsmDaten } from './daten/osm'
import type { AvFlaeche } from './daten/av'
import { grundstueckGeometrie, zufahrtRichtung, type GrundstueckGeo } from './rechner/grundstueck'
import type { ZufahrtspunktEingabe, ZufahrtHerkunft } from './rechner/typen'

export function zufahrtKontext(osm: OsmDaten, av: AvFlaeche[]) {
  const netz = new OsmNetz(osm)
  return { netz, achsen: new OsmAchsen(netz), fahrbahn: new Fahrbahn(av) }
}
export type ZufahrtKontext = ReturnType<typeof zufahrtKontext>
export function zufahrtGeo(k: ZufahrtKontext, z: ZufahrtspunktEingabe): GrundstueckGeo | string {
  return grundstueckGeometrie(k.netz, k.achsen, k.fahrbahn, z)
}
export interface ZufahrtEntwurf { eingabe: ZufahrtspunktEingabe; geo: GrundstueckGeo; basis: GrundstueckGeo }
/** Einzige Geometrie für Vorschau und Übernahme. Keine eigenständige Winkel-Speicherung. */
export function zufahrtEntwurf(k: ZufahrtKontext, p: P, art: ZufahrtHerkunft, grad: string, richtung: P | null): ZufahrtEntwurf | string {
  const basis = zufahrtGeo(k, { p, richtung: null, herkunft: 'senkrecht' })
  if (typeof basis === 'string') return basis
  let r: P | null = null
  if (art === 'winkel') {
    const text = grad.trim().replace(',', '.')
    r = text === '' ? null : zufahrtRichtung(basis.strassenRichtung, basis.richtung, Number(text))
    if (!r) return 'Winkel von 20° bis 160° eingeben; 90° bedeutet rechtwinklig. Sehr flache Zufahrten werden noch nicht unterstützt.'
  } else if (art === 'gezeichnet') {
    if (!richtung || Math.hypot(...richtung) < 1) return 'Richtungsgriff mindestens 1 m ins Grundstück setzen oder eine Gradangabe eingeben.'
    // Anders als alte Fälle: während des Setzens keine Umkehr auf die andere Grundstückseite.
    if (richtung[0] * basis.richtung[0] + richtung[1] * basis.richtung[1] <= 0) return 'Die Richtung muss vom Fahrbahnrand in das Grundstück zeigen.'
    r = richtung
  }
  const eingabe: ZufahrtspunktEingabe = { p, richtung: r, herkunft: art }
  const geo = zufahrtGeo(k, eingabe)
  return typeof geo === 'string' ? geo : { eingabe, geo, basis }
}
