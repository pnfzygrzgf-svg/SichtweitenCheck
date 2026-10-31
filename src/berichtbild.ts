// ── Kartenbild des Berichts (E4a): Ausschnitt aus den Geometrien, Bildgrösse, LV95 -> SVG, Massstab ──
//
// Wie fgsCheck (Bericht.tsx): ein einzelnes Luftbild per WMS in LV95 und darüber eine SVG-Zeichnung. Bild und Rechnung sind
// beide in LV95 (ebene Koordinaten), die Zuordnung ist darum eine reine Verschiebung und Skalierung (Norden oben, N nach unten
// gespiegelt). Hier ohne React, damit Ausschnitt und Umrechnung testbar sind.

import type { P } from './geo'
import type { Ergebnis, KnotenInfo, ArmInfo } from './rechner/typen'
import { nrLage } from './rechner/knoten'
import { autoUmriss, fbLage, fbVeloLage, faLage, veloTeile, veloLage } from './rechner/fahrzeug'
import { add } from './geo'

/** Stand einer geladenen Quelle (Panel «Geladene Quellen»; zeit: Abruf, für die Quellen im Bericht) */
export interface QuellenStand { name: string; objekte?: string; ms?: number; bytes?: number; server?: string; fehler?: string; zeit?: string }

/** Ausschnitt [E0, N0, E1, N1] in LV95 */
export type Box = [number, number, number, number]

export const RAND_M = 5               // Rand um die Geometrien
export const MIN_M = 40               // kleinste Kantenlänge (Breite) des Ausschnitts
/** Seitenverhältnis Höhe/Breite: höchstens 0,7 (Bild rund 130 mm hoch auf 186 mm Breite: passt mit Kopf, Ort und Bildunterschrift
 *  auf Seite 1, A4 hoch; Prüfrunde E4a), mindestens so flach */
export const VERH_MIN = 0.55
export const VERH_MAX = 0.7
export const BILD_PX_MIN = 1200       // Breite des WMS-Bilds mindestens (rund 164 dpi auf 186 mm)
export const BILD_PX_MAX = 1400       // und höchstens
export const AUFLOESUNG_M = 0.1       // SWISSIMAGE 10 cm
export const VB = 1000                // Breite der SVG-Zeichnung in Einheiten

/**
 * Ausschnitt um alle Punkte: Rand, mindestens MIN_M breit und MIN_M × VERH_MIN hoch, dann auf das Seitenverhältnis VERH_MIN bis
 * VERH_MAX geweitet (je um die Mitte; nie verkleinert, alles bleibt im Bild).
 */
export function ausschnitt(punkte: P[], rand = RAND_M): Box {
  if (!punkte.length) throw new Error('Ausschnitt ohne Punkte')
  let e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity
  for (const [e, n] of punkte) { e0 = Math.min(e0, e); e1 = Math.max(e1, e); n0 = Math.min(n0, n); n1 = Math.max(n1, n) }
  e0 -= rand; e1 += rand; n0 -= rand; n1 += rand
  const weiten = (a: number, b: number, l: number): [number, number] => { const m = (a + b) / 2; return [m - l / 2, m + l / 2] }
  if (e1 - e0 < MIN_M) [e0, e1] = weiten(e0, e1, MIN_M)
  if (n1 - n0 < MIN_M * VERH_MIN) [n0, n1] = weiten(n0, n1, MIN_M * VERH_MIN)
  const w = e1 - e0, h = n1 - n0
  if (h / w > VERH_MAX) [e0, e1] = weiten(e0, e1, h / VERH_MAX)
  else if (h / w < VERH_MIN) [n0, n1] = weiten(n0, n1, w * VERH_MIN)
  return [e0, n0, e1, n1]
}

/** Grösse des WMS-Bilds: Breite aus der Auflösung, begrenzt auf BILD_PX_MIN … BILD_PX_MAX; Höhe aus derselben m/px */
export function bildPixel(box: Box): { breite: number; hoehe: number; mpx: number } {
  const wM = box[2] - box[0], hM = box[3] - box[1]
  const breite = Math.min(BILD_PX_MAX, Math.max(BILD_PX_MIN, Math.round(wM / AUFLOESUNG_M)))
  const mpx = wM / breite
  return { breite, hoehe: Math.round(hM / mpx), mpx }
}

/** LV95 -> SVG: Massstab s (Einheiten je m), Höhe vh der Zeichnung, Punkt (x nach rechts ab E0, y nach unten ab N1) */
export function svgAbbildung(box: Box, vb = VB): { s: number; vh: number; xy: (p: P) => [number, number] } {
  const [e0, n0, e1, n1] = box
  const s = vb / (e1 - e0)
  return { s, vh: (n1 - n0) * s, xy: p => [(p[0] - e0) * s, (n1 - p[1]) * s] }
}

/** Länge des Massstabsbalkens: runde Länge nahe einem Fünftel der Breite [m] */
export function massstab(breiteM: number): number {
  return [5, 10, 20, 25, 50, 100, 200].reduce((b, x) => (Math.abs(x - breiteM / 5) < Math.abs(b - breiteM / 5) ? x : b), 10)
}

/**
 * Punkte, die im Kartenbild liegen müssen: D, Fahrzeug FB, je Richtung mit Verkehr das Sichtdreieck bis A (D und Achse), K,
 * Fahrzeug FA, die Verdecker im Sichtdreieck; Velo- und Trottoirdreiecke mit Velo und D', Haltelinie, Zufahrtspunkt und beim
 * Rechtsvortritt die Punkte der Abb. 5; mit dem Knoten die Nummernschilder der Arme.
 */
export function berichtPunkte(e: Ergebnis, kn: KnotenInfo | null = null): P[] {
  // F_B als Auto bzw. (E4, Velo gegen die Einbahn auf der Zufahrt) als Velo
  const fb = e.zufahrtVelo ? veloTeile(...fbVeloLage(e.Dachse, add(e.Dachse, e.fbRichtung))).flat() :
    autoUmriss(...fbLage(e.Dachse, add(e.Dachse, e.fbRichtung)))
  const aus: P[] = [e.D, ...fb]
  const ringe = (l: { ring: P[] }[]) => { for (const t of l) aus.push(...t.ring) }
  for (const r of e.richtungen) {
    if (r.status !== 'keine_zufahrt') {
      aus.push(...r.dreieck, r.K)
      const iA = Math.min(r.massgebend, r.sichtpunkte.length - 1)
      const fa = faLage(r.sichtpunkte, iA)
      if (fa) aus.push(...autoUmriss(...fa))
      ringe(r.verdeckerListe)
      // Überholfall (Block 5): Sichtdreieck auf den Gegenfahrstreifen
      if (r.ueberholfall) { aus.push(...r.ueberholfall.dreieckFrei, ...r.ueberholfall.dreieckVerdeckt); ringe(r.ueberholfall.verdeckerListe) }
    }
    // Velo, auch ohne Motorfahrzeuge von dieser Seite (E4: Velo gegen die Einbahn)
    const v = r.velo
    if (v) {
      aus.push(...v.dreieckFrei, ...v.dreieckVerdeckt)
      const vl = veloLage(v.sichtpunkte, Math.min(v.A, v.sichtpunkte.length - 1))
      if (vl) for (const t of veloTeile(...vl)) aus.push(...t)
      ringe(v.verdeckerListe)
    }
  }
  const tp = e.trottoirPruefung
  if (tp) {
    aus.push(tp.D)
    for (const t of tp.richtungen) { aus.push(...t.dreieckFrei, ...t.dreieckVerdeckt); ringe(t.verdeckerListe) }
  }
  if (e.haltelinie) aus.push(...e.haltelinie.quer)
  if (e.zufahrtspunkt) aus.push(e.zufahrtspunkt.eingabe)
  const m = e.rechtsvortritt?.arm.sichtfeld
  if (m) aus.push(...m.pfad, ...m.linien.map(l => l.p))
  if (kn) aus.push(...schilder(kn, e).map(x => x.p))
  return aus.filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
}

/** Nummernschilder der Arme im Kartenbild: Lage wie auf der Karte (nrLage), gewählt = Zufahrt */
export function schilder(kn: KnotenInfo, e: Ergebnis): { a: ArmInfo; p: P; gewaehlt: boolean }[] {
  return kn.arme.map(a => ({ a, p: nrLage(kn, a, e.zufahrtspunkt?.eingabe ?? null), gewaehlt: a.key === e.zufahrt }))
}

/** Rechteck eines Rings schneidet den Ausschnitt (AV-Flächen und Hindernisse nur im Bild zeichnen) */
export function imAusschnitt(ring: P[], box: Box): boolean {
  let e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity
  for (const [e, n] of ring) { e0 = Math.min(e0, e); e1 = Math.max(e1, e); n0 = Math.min(n0, n); n1 = Math.max(n1, n) }
  return e1 >= box[0] && e0 <= box[2] && n1 >= box[1] && n0 <= box[3]
}

/** Kreuzungspunkte K für Karte und Kartenbild (Korrektur 31.10.2026, Punkt 10): je geprüfte Richtung mit Motorfahrzeugen ein Punkt mit
 *  Beschriftung «K» und Tooltip */
export function kreuzungspunkte(e: Pick<Ergebnis, 'richtungen'>): { richtung: string; p: P; text: 'K'; tooltip: string }[] {
  return e.richtungen.filter(r => r.status !== 'keine_zufahrt').map(r => ({ richtung: r.richtung, p: r.K, text: 'K' as const,
    tooltip: `K ${r.lage === 'gegenueber' ? 'zum Gegenverkehr' : `nach ${r.lage}`} (${r.strasse}): Kreuzung der Fahrlinie der Zufahrt mit der ` +
      'Fahrlinie mit Vortritt; ab hier wird A gemessen' }))
}
