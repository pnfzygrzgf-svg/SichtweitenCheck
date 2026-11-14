// ── Fahrbahnrand je Arm aus dem AV-Bord (Plan «Geometrie aus der AV statt aus der OSM-Linie», Etappe A7, 13.11.2026) ──
//
// Grundsatz (Plan 2.1): Wo die AV einen Bord zeigt, ist er der Bezug der Geometrie; die OSM-Linie des Arms wählt nur noch die Strasse,
// die Seite und die Stationen. Der gemeinsame Baustein kartenbaustein/bordmodell.ts (gepflegt im fgsCheck, hier unverändert) liefert je
// Seite den gemessenen Rand (folgt jeder Bucht, Nase und Einmündung) und die Führungslinie (über bestätigte Einmündungen gerade, bei
// «Rand unbekannt» unterbrochen). Dieses Modul bildet daraus je Arm (Achse = OSM-Linie vom Knoten weg):
//   fuehrung(seite, s): Schnitt der Achsnormalen bei der Station s mit der Führungslinie, mit der Normalen zur Fahrbahn hin. Daraus die
//     Linien: Rand für B und den Nullpunkt, Fahrstreifen-, Velo- und Überholachse, Achse des Zufahrtsstreifens (Parallelen zum Bord).
//   rand(seite, s): Bordpunkt des gemessenen Rands (Querschnitt des Bausteins). Daraus die Messungen: Breite, Parkierungssonden.
//   breite(s): Fahrbahnbreite senkrecht zum Bord (Querschnitt des Bausteins; eine schiefe OSM-Linie vergrössert sie nicht).
//   richtung(): Armrichtung aus der Führungslinie (statt der 10-m-Sehne der OSM-Linie, netz.armRichtung).
// Seiten wie im Baustein: links bzw. rechts von u (Richtung der OSM-Linie vom Knoten weg), quer positiv links.
// Ohne Bord (Lücke, «Rand unbekannt», keine Bordfläche) geben fuehrung und rand null: der Aufrufer rechnet dort wie bisher mit dem
// Randprofil quer zur OSM-Linie und weist das als «aus OSM geschätzt» aus (hauptachsen.ts amRand, rechnen.ts).
// Abzweigungen für die Einmündungsregel des Bausteins (Richtungsänderung > 30° UND OSM-Abzweigung): die übrigen Arme des Knotens und
// die OSM-Knoten entlang des Arms, an denen ein Weg für Motorfahrzeuge abgeht (abzweigungenAm).
// Durchgehende Achse (Nachtrag B, SK1, 14.11.2026): an einer durchgehenden Strasse läuft die Achse des Bordmodells über den Knoten in den
// Gegenarm (durchgehendeAchse). Die Einmündung der Zufahrt liegt dann innerhalb der Achse, ihre Anschlusspunkte beidseits sind bekannt, und
// kein Rest der Seitenstrasse bleibt am Achsanfang stehen (Beispiel Philosophenweg, Knoten 3339261361). Stationen bleiben ab dem Knoten.

import { type P, add, dist, dot, einheit, imPolygon, kreuz, links, neg, rechts, sub, wdiff } from '../geo'
import { type Abzweigung, type Bordmodell, type Querschnitt as BordQuerschnitt, type Seite, BAND_M, achsLage, bordmodell }
  from '../kartenbaustein/bordmodell'
import type { AvFlaeche } from '../daten/av'
import { type OsmNetz, abschneiden } from './netz'

export type { Seite }

/** Annahme: Normale der Führungslinie bzw. des Rands aus der Sehne ± so weit um den Bordpunkt (wie RICHTUNG_SEHNE_M des Bausteins) */
export const BORD_SEHNE_M = 1
/** Annahme: Armrichtung als Sehne der Führungslinie von der Station 0 bis BORD_RICHTUNG_M (wie die 10-m-Sehne der OSM-Linie) */
export const BORD_RICHTUNG_M = 10
/** Annahme: die Sehne der Armrichtung je Seite ist mindestens so lang, sonst gilt diese Seite nicht */
export const BORD_RICHTUNG_MIN_M = 4
/** Annahme: ein OSM-Knoten höchstens so weit neben der Linie des Arms liegt an diesem Arm; ein Weg dort zählt als Abzweigung, sobald er
 *  sich weiter als so weit von der Linie entfernt */
export const ABZWEIG_NAH_M = 5
/** Annahme: ein Weg wird ab dem Knoten höchstens so weit verfolgt, bis er sich von der Linie entfernt */
export const ABZWEIG_SUCHE_M = 40
/** Annahme: ein anderer Arm des Knotens höchstens so viele Grad neben der Gegenrichtung (geradeaus durch den Knoten) ist keine Abzweigung */
export const ABZWEIG_GERADEAUS_GRAD = 30
/** Abzweigung eines Arms des Knotens: Punkt so weit in seiner Richtung (nur für die Seite) */
const ABZWEIG_ARM_M = 10
/** AV-Flächen bis so weit neben der Linie gehen ins Bordmodell (Bereich des Bausteins: zweimal das Band) */
const AV_RAND_M = 2 * BAND_M + 5
/** Rechengenauigkeit an den Enden der Führungslinie (LV95-Koordinaten in Millionen Metern) */
const ENDE_TOL_M = 1e-6
/** Anschlusspunkt: Führungslinie und gemessener Rand höchstens so weit auseinander (dieselbe Linie) */
const ANKER_TOL_M = 0.05
/** Annahme: ein Punkt der Führungslinie gilt nur, wenn der Punkt so weit innen (zur Fahrbahn hin) auf einer Fläche Strasse_Weg liegt
 *  (wie der Prüfpunkt PRUEF_M des Bausteins). Sonst ist es eine weit überbrückte Führung neben der Fahrbahn (Beispiel Tscharnerstrasse
 *  beim Eigerplatz: Südrand ohne Bord, die Führung von der Kante einer anderen Strasse 58 m gerade bis an den Knoten verlängert) und
 *  die Stelle gilt als Lücke («Rand unbekannt») */
export const FUEHRUNG_PRUEF_M = 0.3
/** Annahme: eine konstruierte Führung (gerade Verbindung über eine Einmündung bzw. Bucht, Plan 2.5a) gilt höchstens so lang (Zufahrt
 *  bzw. Seitenstrasse mit beiden Eckausrundungen); längere Verbindungen (Beispiel Dalmazibrücke/Weihergasse, 40 bis 50 m quer über
 *  eine Fläche ohne Bord) gelten als Lücke («Rand unbekannt») */
export const VERBINDUNG_MAX_M = 30
/** Annahme (Nachtrag B, SK1): die durchgehende Achse reicht so weit in den Gegenarm (Einmündung der Zufahrt mit beiden Eckausrundungen,
 *  VERBINDUNG_MAX_M, dazu die Suche nach dem Anschlusspunkt) */
export const VORLAUF_M = 50

/** Punkt auf einer Bordlinie mit der Normalen zur Fahrbahn hin (Einheitsvektor), der Richtung der Linie vom Knoten weg und der Lage auf
 *  der Achsnormalen (positiv links von u) */
export interface BordPunkt { p: P; innen: P; d: P; quer: number }
/** Anschlusspunkt des gemessenen Bords nach der Einmündung am Knoten: Station, Punkt und Richtung vom Knoten weg */
export interface BordAnker { s: number; p: P; d: P }

export interface ArmBord {
  /** Bordmodell auf der Achse; mit durchgehender Achse beginnt sie im Gegenarm, der Knoten liegt bei knotenStation */
  modell: Bordmodell
  knotenStation: number
  /** Länge des Arms ab dem Knoten */
  laenge: number
  /** Führungslinie der Seite auf der Achsnormalen bei der Station s; null in einer Lücke («Rand unbekannt») bzw. ohne Bord */
  fuehrung: (seite: Seite, s: number) => BordPunkt | null
  /** gemessener Rand der Seite (Bordpunkt des Querschnitts) bei s; null an einer Einmündung, in einer Lücke bzw. ohne Bord */
  rand: (seite: Seite, s: number) => BordPunkt | null
  /** Fahrbahnbreite bei s senkrecht zum Bord (gemessener Rand beider Seiten), sonst null */
  breite: (s: number) => number | null
  /** Armrichtung vom Knoten weg aus der Führungslinie beider Seiten (Mittel), null ohne Bord am Knoten */
  richtung: () => P | null
  /** Meter (Stationen je 1 m) zwischen von und bis ohne Führungslinie auf der Seite */
  luecke: (seite: Seite, von: number, bis: number) => number
  /** erste Station (je 1 m, höchstens bis), an der die Führungslinie auf dem gemessenen Bord liegt (nicht über eine Einmündung gerade
   *  verlängert): dort beginnt nach dem Knoten der echte Bord der Seite; null ohne */
  anker: (seite: Seite, bis: number) => BordAnker | null
}

type Kasten = [number, number, number, number]
const kastenVon = (pts: readonly P[], rand = 0): Kasten => {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity
  for (const [e, n] of pts) { a = Math.min(a, e); b = Math.min(b, n); c = Math.max(c, e); d = Math.max(d, n) }
  return [a - rand, b - rand, c + rand, d + rand]
}
const ueberlappt = (a: Kasten, b: Kasten) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

/** Bogenlängen einer Polylinie */
function bogen(l: readonly P[]): number[] {
  const lam = [0]
  for (let i = 1; i < l.length; i++) lam.push(lam[i - 1] + dist(l[i - 1], l[i]))
  return lam
}
function punktBei(l: readonly P[], lam: number[], x: number): P {
  const n = l.length
  if (x <= 0) return l[0]
  if (x >= lam[n - 1]) return l[n - 1]
  let i = 1
  while (i < n - 1 && lam[i] < x) i++
  const d = lam[i] - lam[i - 1]
  return d > 0 ? add(l[i - 1], sub(l[i], l[i - 1]), (x - lam[i - 1]) / d) : l[i]
}
/** Richtung einer Polylinie bei der Bogenlänge x als Sehne ± BORD_SEHNE_M (in Laufrichtung) */
function sehneBei(l: readonly P[], lam: number[], x: number): P {
  const r = einheit(sub(punktBei(l, lam, x + BORD_SEHNE_M), punktBei(l, lam, x - BORD_SEHNE_M)))
  return r[0] || r[1] ? r : [1, 0]
}
/** Normale zur Fahrbahn hin: Linien laufen in Achsrichtung, die Fahrbahn liegt links des rechten bzw. rechts des linken Rands; zur
 *  Sicherheit gegen die Achsnormale n geprüft (zeigt innen nach aussen, wird sie gedreht) */
function innenVon(d: P, seite: Seite, n: P): P {
  const i = seite === 'links' ? rechts(d) : links(d)
  const aussen = seite === 'links' ? n : neg(n)
  return dot(i, aussen) > 0 ? neg(i) : i
}

/** Abstand eines Punkts von einer Polylinie */
function abstandLinie(p: P, l: readonly P[]): number {
  let best = Infinity
  for (let k = 0; k < l.length - 1; k++) {
    const a = l[k], v = sub(l[k + 1], a), l2 = dot(v, v)
    const t = l2 ? Math.max(0, Math.min(1, dot(sub(p, a), v) / l2)) : 0
    best = Math.min(best, dist(p, add(a, v, t)))
  }
  return best
}

const cache = new WeakMap<readonly AvFlaeche[], Map<string, ArmBord | null>>()
const linieSchluessel = (ml: readonly P[], z: readonly Abzweigung[]) => ml.map(p => `${p[0].toFixed(3)},${p[1].toFixed(3)}`).join(';') + '|' +
  z.map(x => `${x.p[0].toFixed(2)},${x.p[1].toFixed(2)},${x.seite ?? ''},${x.arm ? `${x.arm[0].toFixed(2)},${x.arm[1].toFixed(2)}` : ''}`).join(';')

/**
 * Durchgehende Achse (SK1): Gegenarm gegen (Linie vom Knoten weg) auf VORLAUF_M (ganze Meter, höchstens seine Länge) umgekehrt, dann der
 * Arm ml ab dem Knoten. s0 = Station des Knotens. Ohne Gegenarm die Linie des Arms (s0 = 0).
 * Beispiel: Gegenarm (0,0)→(−80,0), Arm (0,0)→(100,0) → Achse (−50,0)→(0,0)→(100,0), s0 = 50.
 */
export function durchgehendeAchse(ml: readonly P[], gegen: readonly P[] | null): { achse: P[]; s0: number } {
  if (!gegen || gegen.length < 2 || ml.length < 2) return { achse: ml.slice(), s0: 0 }
  let len = 0
  for (let i = 1; i < gegen.length; i++) len += dist(gegen[i - 1], gegen[i])
  const v = Math.min(VORLAUF_M, Math.floor(len))
  if (v < 1) return { achse: ml.slice(), s0: 0 }
  const vor = abschneiden(gegen.slice(), v)
  return { achse: [...vor.slice().reverse(), ...ml.slice(1)], s0: v }
}

/**
 * Bordmodell eines Arms: OSM-Linie ml vom Knoten weg als Auswahl-Achse, AV-Flächen um die Linie, Abzweigungen. null ohne AV-Fahrbahn bzw.
 * ohne jeden Bord (alle Kanten offen oder gegen andere Strassenflächen). Je AV-Liste zwischengespeichert (dieselbe Linie wird in einer
 * Rechnung mehrmals gebraucht, etwa beim Rechtsvortritt für alle Arme).
 */
export function armBord(av: readonly AvFlaeche[], ml: readonly P[], abzweigungen: readonly Abzweigung[] = [], gegen: readonly P[] | null = null):
  ArmBord | null {
  if (ml.length < 2) return null
  let c = cache.get(av)
  if (!c) { c = new Map(); cache.set(av, c) }
  const { achse, s0 } = durchgehendeAchse(ml, gegen)
  const key = linieSchluessel(achse, abzweigungen) + `|${s0}`
  if (c.has(key)) return c.get(key)!
  const x = armBordRechnen(av, achse, s0, abzweigungen)
  c.set(key, x)
  return x
}

function armBordRechnen(av: readonly AvFlaeche[], achse: readonly P[], s0: number, abzweigungen: readonly Abzweigung[]): ArmBord | null {
  const box = kastenVon(achse, AV_RAND_M)
  const flaechen = av.filter(f => f.ringe.length && f.ringe[0].length >= 3 && ueberlappt(kastenVon(f.ringe[0]), box))
  if (!flaechen.some(f => f.art === 'Strasse_Weg')) return null
  const modell = bordmodell({ flaechen, achse: achse as P[], abzweigungen })
  if (!modell.rand.links.teile.length && !modell.rand.rechts.teile.length) return null
  // Stationen der Schnittstelle ab dem Knoten (s), im Modell S = s0 + s; L = Länge des Arms
  const ach = modell.achse, L = ach.laenge - s0
  const fl: Record<Seite, { l: P[]; lam: number[] }[]> = {
    links: modell.fuehrung.links.teile.map(l => ({ l, lam: bogen(l) })), rechts: modell.fuehrung.rechts.teile.map(l => ({ l, lam: bogen(l) })) }
  const rd: Record<Seite, { l: P[]; lam: number[] }[]> = {
    links: modell.rand.links.teile.map(l => ({ l, lam: bogen(l) })), rechts: modell.rand.rechts.teile.map(l => ({ l, lam: bogen(l) })) }

  const strassen = flaechen.filter(f => f.art === 'Strasse_Weg').map(f => ({ ringe: f.ringe, box: kastenVon(f.ringe[0]) }))
  const aufStrasse = (p: P) => strassen.some(x => p[0] >= x.box[0] && p[0] <= x.box[2] && p[1] >= x.box[1] && p[1] <= x.box[3] && imPolygon(p, x.ringe))
  const zuLang: Record<Seite, { von: P; bis: P }[]> = {
    links: modell.fuehrung.links.verbindungen.filter(v => dist(v.von, v.bis) > VERBINDUNG_MAX_M),
    rechts: modell.fuehrung.rechts.verbindungen.filter(v => dist(v.von, v.bis) > VERBINDUNG_MAX_M) }
  const fMemo = new Map<string, BordPunkt | null>()
  const fuehrung = (seite: Seite, s: number): BordPunkt | null => {
    if (!(s >= -1e-9 && s <= L + 1e-9)) return null
    const key = `${seite}:${s.toFixed(6)}`
    if (fMemo.has(key)) return fMemo.get(key)!
    const o = ach.punkt(s0 + s), n = links(ach.richtung(s0 + s)), sg = seite === 'links' ? 1 : -1
    const kand: { t: number; teil: { l: P[]; lam: number[] }; lam: number }[] = []
    for (const teil of fl[seite]) {
      const { l, lam } = teil
      for (let k = 0; k < l.length - 1; k++) {
        const a = l[k], e = sub(l[k + 1], a), den = kreuz(n, e)
        if (Math.abs(den) < 1e-12) continue
        // Toleranz ENDE_TOL_M an den Enden der Strecken: die Führungslinie beginnt am Abschnittsanfang genau auf der Achsnormalen
        const w = sub(a, o), t = kreuz(w, e) / den, u = kreuz(w, n) / den, tu = ENDE_TOL_M / Math.hypot(e[0], e[1])
        if (u < -tu || u > 1 + tu || sg * t <= 0 || Math.abs(t) > BAND_M) continue
        kand.push({ t, teil, lam: lam[k] + Math.max(0, Math.min(1, u)) * (lam[k + 1] - lam[k]) })
      }
    }
    kand.sort((x, y) => Math.abs(x.t) - Math.abs(y.t))
    let aus: BordPunkt | null = null
    for (const c of kand) {
      const p = add(o, n, c.t), d = sehneBei(c.teil.l, c.teil.lam, c.lam), innen = innenVon(d, seite, n)
      if (zuLang[seite].some(v => abstandLinie(p, [v.von, v.bis]) < 0.01)) continue
      if (aufStrasse(add(p, innen, FUEHRUNG_PRUEF_M))) { aus = { p, innen, d, quer: c.t }; break }
    }
    fMemo.set(key, aus)
    return aus
  }

  // Querschnitte des Bausteins (alle 1 m); andere Stationen auf Abruf
  const qMemo = new Map<string, BordQuerschnitt>()
  const qsBei = (sArm: number): BordQuerschnitt => {
    const s = s0 + sArm, i = Math.round(s)
    const q = Math.abs(s - i) < 1e-6 ? modell.querschnitte[i] : undefined
    if (q && Math.abs(q.s - s) < 1e-6) return q
    const key = s.toFixed(6)
    let x = qMemo.get(key)
    if (!x) { x = modell.querschnitt(s); qMemo.set(key, x) }
    return x
  }
  const rand = (seite: Seite, s: number): BordPunkt | null => {
    if (!(s >= -1e-9 && s <= L + 1e-9)) return null
    const q = qsBei(s), x = q[seite]
    if (!x.punkt || x.quer === null) return null
    // Richtung des gemessenen Rands am Bordpunkt: nächstes Stück des Rands, Sehne ± BORD_SEHNE_M
    let bt: { l: P[]; lam: number[] } | null = null, bl = 0, bd = 0.05
    for (const teil of rd[seite]) for (let k = 0; k < teil.l.length - 1; k++) {
      const a = teil.l[k], v = sub(teil.l[k + 1], a), l2 = dot(v, v)
      const t = l2 ? Math.max(0, Math.min(1, dot(sub(x.punkt, a), v) / l2)) : 0
      const d = dist(x.punkt, add(a, v, t))
      if (d < bd) { bd = d; bt = teil; bl = teil.lam[k] + t * (teil.lam[k + 1] - teil.lam[k]) }
    }
    const d = bt ? sehneBei(bt.l, bt.lam, bl) : ach.richtung(s0 + s)
    return { p: x.punkt, innen: innenVon(d, seite, q.normale), d, quer: x.quer }
  }
  const breite = (s: number): number | null => (s >= -1e-9 && s <= L + 1e-9 ? qsBei(s).breite : null)

  const richtung = (): P | null => {
    let summe: P = [0, 0], n = 0
    for (const seite of ['links', 'rechts'] as const) {
      // Stationen 0 … BORD_RICHTUNG_M mit Führungslinie, ohne Trottoirnase (sie verschwenkt die Sehne)
      const pts: P[] = []
      for (let s = 0; s <= Math.min(BORD_RICHTUNG_M, L) + 1e-9; s += 1) {
        const f = fuehrung(seite, s)
        if (f && qsBei(s)[seite].art !== 'nase') pts.push(f.p)
      }
      if (pts.length < 2 || dist(pts[0], pts[pts.length - 1]) < BORD_RICHTUNG_MIN_M) continue
      summe = add(summe, einheit(sub(pts[pts.length - 1], pts[0])))
      n++
    }
    return n && (summe[0] || summe[1]) ? einheit(summe) : null
  }
  const luecke = (seite: Seite, von: number, bis: number): number => {
    let m = 0
    for (let s = Math.max(0, Math.ceil(von - 1e-9)); s <= Math.min(L, bis) + 1e-9; s += 1) if (!fuehrung(seite, s)) m++
    return m
  }
  const anker = (seite: Seite, bis: number): BordAnker | null => {
    for (let s = 0; s <= Math.min(L, bis) + 1e-9; s += 1) {
      const f = fuehrung(seite, s), q = qsBei(s)[seite]
      if (!f || q.art === 'einmuendung' || q.art === 'oeffnung' || q.art === 'unbekannt' || !q.punkt || dist(q.punkt, f.p) > ANKER_TOL_M) continue
      return { s, p: f.p, d: f.d }
    }
    return null
  }
  return { modell, knotenStation: s0, laenge: L, fuehrung, rand, breite, richtung, luecke, anker }
}

/**
 * Abzweigungen an einem Arm für die Einmündungsregel des Bausteins. knoten: Knotenpunkt (Anfang von ml), andere: Richtungen der übrigen
 * Arme des Knotens (vom Knoten weg); ein Arm fast in Gegenrichtung (geradeaus, ABZWEIG_GERADEAUS_GRAD) zählt nicht. Dazu die OSM-Knoten
 * höchstens ABZWEIG_NAH_M neben ml, an denen ein Weg für Motorfahrzeuge (bzw. Bus) abgeht und sich innert ABZWEIG_SUCHE_M weiter als
 * ABZWEIG_NAH_M von ml entfernt; ein Weg, der hinter dem Anfang bzw. dem Ende von ml weitergeht, ist keine Abzweigung.
 * Beispiel: T-Knoten, Arm nach Osten, Zufahrt nach Süden → { p: Knoten, arm: 10 m südlich } (Seite rechts).
 */
export function abzweigungenAm(netz: OsmNetz | null, knoten: P, ml: readonly P[], andere: readonly P[]): Abzweigung[] {
  if (ml.length < 2) return []
  const ach = achsLage(ml)
  const u = ach.richtungAnfang
  const aus: Abzweigung[] = []
  for (const r of andere) {
    if (wdiff(neg(u), r) <= ABZWEIG_GERADEAUS_GRAD) continue
    aus.push({ p: knoten, arm: add(knoten, einheit(r), ABZWEIG_ARM_M) })
  }
  if (!netz) return aus
  const box = kastenVon(ml, ABZWEIG_NAH_M)
  const gesehen = new Set<string>()
  for (const [n, lst] of netz.an) {
    const p = netz.P.get(n)
    if (!p || p[0] < box[0] || p[0] > box[2] || p[1] < box[1] || p[1] > box[3]) continue
    const sp = ach.station(p)
    if (Math.abs(sp.q) > ABZWEIG_NAH_M || sp.s < -ABZWEIG_NAH_M || sp.s > ach.laenge + ABZWEIG_NAH_M) continue
    for (const [wid, i] of lst) {
      const w = netz.W.get(wid)
      if (!w || !(w.mfz || w.bus)) continue
      for (const r of [1, -1]) {
        let weg = 0, j = i, vor = p
        let ziel: P | null = null
        while (weg <= ABZWEIG_SUCHE_M) {
          j += r
          if (j < 0 || j >= w.nds.length) break
          const q = netz.P.get(w.nds[j])
          if (!q) break
          weg += dist(vor, q); vor = q
          const sq = ach.station(q)
          if (sq.s < -ABZWEIG_NAH_M || sq.s > ach.laenge + ABZWEIG_NAH_M) break          // läuft hinter dem Anfang bzw. Ende weiter
          if (abstandLinie(q, ml) > ABZWEIG_NAH_M) { ziel = q; break }
        }
        if (!ziel) continue
        const k = `${n}:${ziel[0]},${ziel[1]}`
        if (gesehen.has(k)) continue
        gesehen.add(k)
        aus.push({ p, arm: ziel })
      }
    }
  }
  return aus
}

/** Annahme: Anschlusspunkte des Bords nach der Einmündung der Zufahrt höchstens so weit ab dem Knoten gesucht (randDurchKnoten) */
export const RAND_ANKER_BIS_M = 30
/** Stützpunkte der Kurve über die Einmündung */
const KURVE_PUNKTE = 16

/**
 * Rand der Vortrittsstrasse durch den Knoten (A7, für B und den Nullpunkt): Arm 0 vom Ende bis zu seinem Anschlusspunkt, über die
 * Einmündung der Zufahrt eine Kurve tangential an beide Borde (kubische Hermite-Kurve; bei gerader Strasse genau die Gerade, in einer
 * Kurve folgt sie der Krümmung statt der Tangente eines Arms), dann Arm 1 ab seinem Anschlusspunkt. linie0/linie1: Rand je Arm vom Knoten
 * weg, je 1 m ab der Station 0 (amRand mit Abstand 0); a0/a1: Anschlusspunkte (ArmBord.anker).
 * Beispiel: Rand N −3, Anschlusspunkte (−2,5; −3) und (2,5; −3), Richtungen West bzw. Ost → Linie auf N −3 von West nach Ost.
 */
export function randDurchKnoten(linie0: readonly P[], a0: BordAnker, linie1: readonly P[], a1: BordAnker): P[] {
  // Länge der Tangenten: Sehne mal 2 tan(θ/4) / sin(θ/2) (θ = Richtungsänderung zwischen den Borden): ein Kreisbogen wird in der Mitte
  // genau getroffen, eine Gerade (θ = 0) bleibt die Gerade
  const th = Math.min(179, wdiff(neg(a0.d), a1.d)) * Math.PI / 180
  const c = dist(a0.p, a1.p) * (th > 1e-6 ? 2 * Math.tan(th / 4) / Math.sin(th / 2) : 1)
  const m0: P = [-a0.d[0] * c, -a0.d[1] * c], m1: P = [a1.d[0] * c, a1.d[1] * c]
  const kurve: P[] = []
  for (let k = 1; k < KURVE_PUNKTE; k++) {
    const t = k / KURVE_PUNKTE, t2 = t * t, t3 = t2 * t
    const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2
    kurve.push([h00 * a0.p[0] + h10 * m0[0] + h01 * a1.p[0] + h11 * m1[0], h00 * a0.p[1] + h10 * m0[1] + h01 * a1.p[1] + h11 * m1[1]])
  }
  const arm0 = [a0.p, ...linie0.slice(a0.s + 1)].reverse()
  return [...arm0, ...(c > 0.05 ? kurve : []), a1.p, ...linie1.slice(a1.s + 1)]
}

/** Bord eines Arms nur bis zur Station bis (z. B. bis zur Teilung der Fahrbahn in zwei Einbahnen: dahinter überbrückt das Bordmodell die
 *  Insel, der Rand der Gegenrichtung wäre der Aussenrand der anderen Einbahn); dahinter geben fuehrung und rand null, luecke zählt nicht */
export function bordBis(b: ArmBord, bis: number): ArmBord {
  if (!(bis < b.laenge)) return b
  return { ...b, fuehrung: (x, s) => (s <= bis + 1e-9 ? b.fuehrung(x, s) : null), rand: (x, s) => (s <= bis + 1e-9 ? b.rand(x, s) : null),
    breite: s => (s <= bis + 1e-9 ? b.breite(s) : null), luecke: (x, von, b2) => b.luecke(x, von, Math.min(b2, bis)),
    anker: (x, b2) => b.anker(x, Math.min(b2, bis)) }
}
