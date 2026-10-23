// ── Web Worker: Rechnung abseits der Karte ──
// Nachricht {id, osm (Overpass roh), av (GeoJSON roh), avRadius, avZentrum, knoten, zufahrt, zufahrtspunkt, eingaben, hindernisse,
// hoehen (Längsneigung aus dem Höhenmodell, E3a), tempoAmtlich (K0: V_sig Stadt Bern bzw. null)}
// -> {id, ok, rechnung} bzw. {id, ok: false, fehler}.

import type { P } from '../geo'
import { osmParsen } from '../daten/osm'
import { avParsen, type GeoJson } from '../daten/av'
import { rechneKnoten } from './rechnen'
import type { Eingaben, HindernisEingaben, HoehenVorgabe, TempoAmtlichDaten, ZufahrtspunktEingabe } from './typen'

interface Auftrag { id: number; osm: unknown; av: GeoJson; avRadius: number; avZentrum: P; knoten: number | null; zufahrt: string | null
  zufahrtspunkt: ZufahrtspunktEingabe | null; eingaben: Eingaben; hindernisse: HindernisEingaben; hoehen: HoehenVorgabe | null
  tempoAmtlich?: TempoAmtlichDaten | null }

self.onmessage = (ev: MessageEvent<Auftrag>) => {
  const { id, osm, av, avRadius, avZentrum, knoten, zufahrt, zufahrtspunkt, eingaben, hindernisse, hoehen, tempoAmtlich } = ev.data
  try {
    const r = rechneKnoten(osmParsen(osm as Parameters<typeof osmParsen>[0]), avParsen(av),
      { knoten, zufahrt, zufahrtspunkt, eingaben, hindernisse, avZentrum, hoehen, tempoAmtlich: tempoAmtlich ?? null }, null, avRadius)
    ;(self as unknown as Worker).postMessage({ id, ok: true, rechnung: r })
  } catch (e) {
    ;(self as unknown as Worker).postMessage({ id, ok: false, fehler: String((e as Error)?.message ?? e) })
  }
}
