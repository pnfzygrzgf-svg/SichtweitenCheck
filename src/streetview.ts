// ── Google Street View als Link (Nutzerwunsch 31.10.2026, wie fgsCheck streetview.ts und VeloroutenCheck) ──
//
// Nur ein Link auf Google Maps (Maps URLs, map_action=pano: Google sucht das nächste Panorama), keine Einbettung, kein API-Schlüssel.
// Die Koordinaten gehen erst beim Klick an Google. Je geprüfte Richtung der Blick des wartenden Lenkers: von D zum Punkt am Ende der
// nötigen Sichtweite A auf der Fahrlinie mit Vortritt.

import { wgs, type P } from './geo'

/** Link auf Google Street View: Standpunkt (WGS84, 6 Nachkommastellen) und Blickrichtung (Grad ab Norden im Uhrzeigersinn, 0–359) */
export function streetViewUrl(lat: number, lon: number, heading?: number | null): string {
  const h = heading == null || !Number.isFinite(heading) ? '' : `&heading=${((Math.round(heading) % 360) + 360) % 360}`
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}${h}`
}

/** Peilung von a nach b in LV95 [Grad ab Norden im Uhrzeigersinn]; die Meridiankonvergenz (unter 2°) ist vernachlässigt */
export function peilung(a: P, b: P): number {
  const g = (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI
  return (g + 360) % 360
}

/** Street View je Richtung: von D mit Blick auf den Punkt am Ende von A (Zielpunkte je 1 m ab K); null ohne Zielpunkte */
export function richtungStreetView(D: P, sichtpunkte: readonly P[], A: number): string | null {
  if (!sichtpunkte.length) return null
  const ziel = sichtpunkte[Math.max(0, Math.min(Math.round(A), sichtpunkte.length - 1))]
  const [lat, lon] = wgs(D[0], D[1])
  return streetViewUrl(lat, lon, peilung(D, ziel))
}

/** Tooltip des Links je Richtung */
export const richtungStreetViewTitel = (lage: string, strasse: string): string =>
  `Google Street View: Blick aus der Zufahrt ${lage} auf ${strasse} – Hecken, Mauern, Parkierung prüfen (öffnet Google Maps)`
