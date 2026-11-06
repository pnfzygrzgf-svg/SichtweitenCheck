import { useHoehenkurven } from './hoehenkurven/Karte'
import { HoehenkurvenWahl } from './hoehenkurven/Wahl'
import { AvEbenenWahl } from './AvEbenenWahl'
import { EbenenGruppe, HoehenprofilAnsicht } from './hoehenprofil/Ansicht'
import { profilObjekteWaehlen, standardProfil } from './hoehenprofil/modell'
import { avKartenStil, avArtSichtbar, avArtenLesen } from './daten/anbieter/gemeinsam/avKarte'
import { swcSichtMasse } from './sichtMasse'
import type { ZufahrtEntwurf } from './zufahrtEntwurf'
import { strassenRichtung, zufahrtWinkel, ZUFAHRT_HERKUNFT } from './rechner/grundstueck'
import { useSichtWahl, sichtZeigen, sichtMassZeigen, richtungSichtId, kreiselSichtId, type SichtArt } from './Sichtfelder'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { AvFlaeche } from './daten/av'
import { KREISEL_TAG, type OsmKnoten, type Strassenname } from './daten/osm'
import type { Rechnung, ArmInfo, KnotenInfo, KreiselSichtTeil, VerdeckerEintrag, Richtung, FahrzeugLageHand } from './rechner/typen'
import { linieImPolygon } from './rechner/poly'
import { armText, nrLage, NR_ABSTAND_M } from './rechner/knoten'
import { profilLinie, profilWert, INNENRING_AB_M } from './rechner/kreisel'
import { lageNach, lageText, lageWort } from './rechner/lage'
import { wgs, lv95, add, dist, dot, sub, einheit, rechts, winkelGrad, type P } from './geo'
import { querlinie, lageAnAchse, B_INNERORTS_M, FAHRERSITZ_M } from './rechner/beobachtung'
import { TUE_BREITE_KURZ, f2 } from './texte'
import { hindernisRing, artText, quelleText, type Hindernis } from './rechner/hindernisse'
import Ortssuche from './Ortssuche'
import { ortZoom, type Ort } from './daten/ortssuche'
import { autoUmriss, autoScheibe, fbLage, fbVeloLage, faLage, faAnzeige, veloLage, veloTeile, kreiselFahrzeug, PW_LAENGE_M, LENKER_VOR_FRONT_M, VELO_LAENGE_M, VELO_BREITE_M } from './rechner/fahrzeug'
import { kreuzungspunkte } from './berichtbild'
import { BESCHRIFT_ZOOM, EBENEN, ebenenFarbe, ebenenSichtbar, ebenenSymbol, type EbeneId, type EbenenDaten, type EbenenObjekt } from './quellenEbenen'

// Unterbau aus fgsCheck (Karte.tsx): Hintergründe, Standort, Strassennamen, Ortssuche, Hinweise. Neu in E0: Knoten statt
// Übergänge, Arme zum Wählen der Zufahrt, Beobachtungspunkt D, Sichtdreiecke, Fahrstreifenachsen, verdeckende Gebäude.
// E2a aus fgsCheck: Zeichenwerkzeuge (Klick setzt Punkte, Doppelklick schliesst, Fadenkreuz), Hindernisse und Vorschläge,
// Ecken ziehen; neu: Verdecker im Sichtdreieck hervorgehoben (voll rot, Palisade gelb, Hinweis violett gestrichelt).
// E3b: Velo-Sichtdreieck (Türkis gestrichelt), Veloachse und Velosymbol am Ende von A; Trottoir: Dreiecke von D' zu den
// Trottoirpunkten (Bernstein), Zufussgehende (Punkt mit Ring) am Ende von A, D'.
// E2b: Werkzeuge «Haltelinie setzen» und «Zufahrt setzen» (Grundstückzufahrt, zweiter Klick zeichnet die Richtung), D zum
// Ziehen (D von Hand), Haltelinie als Querlinie, Nullpunkt von B, Zufahrtspunkt.
// Block 5: Halte- oder Wartelinie (Feld haltelinie), Überholfall als zweites, schwächeres Sichtdreieck, Sichtfeld der schmalen Zufahrt
// beim Rechtsvortritt (bfu BM.021 Abb. 4: Pfad und Sichtlinien von D).

// AV-Farben wie fgsCheck (Gebäude neutral dunkelgrau, damit Rot für «verdeckt» bleibt)
export { AV_FARBEN } from './daten/anbieter/gemeinsam/avKarte'

export const KNOTEN_FARBE = '#0ea5e9'
export const STATUS_FARBE: Record<string, string> = {
  erfuellt: '#15803d', massgebend: '#ca8a04', nicht_erfuellt: '#dc2626', keine_zufahrt: '#64748b',
}
export const FREI_FARBE = '#22c55e'
export const VERDECKT_FARBE = '#dc2626'
/** Gebäude, das erst ausserhalb der massgebenden Sichtweite A verdeckt */
export const SPAETER_FARBE = '#f97316'
/** D: weiss gefüllt mit dunklem Rand, damit er auf dem dunklen F<sub>B</sub> sichtbar bleibt */
export const D_FARBE = '#ffffff'
export const D_RAND_FARBE = '#111827'
export const ACHSE_FARBE = '#ffffff'
export const ZUFAHRT_FARBE = '#f59e0b'
/** Fahrzeuge (Vogelperspektive, nur Darstellung): FB vortrittsbelastet auf der Zufahrt, FA vortrittsberechtigt am Ende von A */
export const FB_FARBE = '#1e293b'
export const FA_FARBE = '#f8fafc'
/** E3b: Velo-Prüfung (Türkis: auf Luftbildern mit Grün und Grau gut sichtbar; das Petrol des VeloroutenCheck ging dort unter, 06.11.2026)
 *  und Trottoir-Prüfung (Indigo) */
export const VELO_FARBE = '#06b6d4'
export const TROTTOIR_FARBE = '#4f46e5'   // Indigo (Orange nur für die Zufahrt)
const SCHEIBE_FARBE = '#94a3b8'
/** Nummernschild der gewählten Zufahrt (App-Farbe; Karte: CSS .arm-nr.gewaehlt, Bericht: Kartenbild) */
export const NR_GEWAEHLT_FARBE = '#15803d'
/** Nummernschild auf der Karte mindestens so weit vom Knoten [px]: bei kleinem Zoom (bis 17) rückt es nach aussen, weg von
 *  Knoten, D und den anderen Schildern, höchstens bis zum Ende des Arms (ARM_KARTE_M); ab Zoom 18 gilt NR_ABSTAND_M */
const NR_MIN_PX = 28
/** Länge der Arme auf der Karte (zum Wählen der Zufahrt) */
const ARM_KARTE_M = 22

/** Zeichenwerkzeuge (E2a) */
export type Werkzeug = null | 'parkfeld' | 'laengs' | 'baum' | 'hecke' | 'mauer' | 'zaun' | 'flaeche'
/** Werkzeuge zum Knoten (E2b): Haltelinie (ein Klick), Grundstückzufahrt (Punkt am Rand, optional zweiter Klick für die Richtung) */
export type KnotenWerkzeug = null | 'haltelinie' | 'zufahrt' | 'd'      // 'd': Beobachtungspunkt D mit Klick setzen (E4)
/** Haltelinie (weiss mit dunklem Rand) und Zufahrtspunkt (Grundstückzufahrt) */
export const HALTELINIE_FARBE = '#ffffff'
export const ZUFAHRTSPUNKT_FARBE = '#f59e0b'
/** D von Hand: Rand des Punkts */
export const D_HAND_FARBE = '#f59e0b'
/**
 * Hindernisse nach Art in fgsCheck-Farben: amtliche Parkfelder nach Klasse (Auto dunkelblau, Velo petrol, Motorrad pink, wie
 * PARK_FARBE), Baum grün (Baumkataster), Hecke und Mauer orange (Hindernis), Zaun violett (Zweirad), übriges braun.
 * Quelle über das Strichmuster: OSM-Vorschlag gestrichelt, Baumkataster-Vorschlag gestrichelt, verworfen gepunktet und blass.
 */
export const HINDERNIS_FARBE: Record<string, string> = {
  auto: '#1e40af', velo: '#0f766e', motorrad: '#ec4899', baum: '#78350f', hecke: '#ea580c', mauer: '#ea580c', zaun: '#a855f7',
  uebrige: '#92400e',
}
export const hindernisFarbe = (h: Hindernis): string =>
  h.art === 'parkfeld' ? HINDERNIS_FARBE[h.klasse] : h.art === 'laengsparkierung' ? HINDERNIS_FARBE.auto : HINDERNIS_FARBE[h.art]
/** Massnahmen (E3a): hervorgehobenes Hindernis */
export const HERVOR_FARBE = '#d946ef'   // Fuchsia (Türkis ist seit 06.11.2026 das Velo)
/** Verdecker im Sichtdreieck bis A: voll, Palisade, Hinweis */
export const TREFFER_FARBE: Record<string, string> = { voll: '#dc2626', palisade: '#facc15', hinweis: '#a855f7' }
/** Strichmuster der Vorschläge (OSM, Baumkataster) */
export const STRICH_VORSCHLAG = '5 4'
const STRICH_VERWORFEN = '2 4'
/** Hindernis als Text (Liste, Tooltip): «Art – Name (Quelle)» */
export function hindernisText(h: Hindernis): string {
  const art = artText(h)
  return `${h.name && h.name !== art ? `${art}: ${h.name}` : art} (${quelleText(h)})`
}

/** Hinweis über der Karte (Stand der Knotensuche); erneut: Knopf «erneut suchen» (nur nach einem Fehler) */
export interface KartenHinweis { text: string; fehler?: boolean; erneut?: () => void }

export const STANDORT_ZOOM = 18
const STANDORT_UNGENAU_M = 100
// Hintergründe (WMTS geo.admin.ch): Luftbild bis Zoom 20, Landeskarte bis 18; darüber vergrössert Leaflet die Kacheln
const HINTERGRUND_LUFTBILD = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg'
const HINTERGRUND_KARTE = 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg'
// Strassennamen (OSM): eigenes Pane über den Vektoren, nicht anklickbar, erst ab NAMEN_ZOOM
const NAMEN_PANE = 'strassennamen'
const NAMEN_ZOOM = 16
// Hindernisse und hervorgehobene Verdecker in eigenen Panes über den Sichtdreiecken (overlayPane 400): sonst lägen die nach jeder
// Rechnung neu gezeichneten Dreiecke darüber und fingen die Klicks auf die Hindernisse ab
const HIND_PANE = 'hindernisse'
const TREFFER_PANE = 'treffer'
/** Knoten, Arme, Achsen, D, K, A und Fahrzeuge über den Hindernissen (Parkfelder liegen oft auf K) */
const OBEN_PANE = 'oben'
/** D über allem Übrigen (auch über F<sub>B</sub> und den Strassennamen), damit er sich ziehen lässt */
const D_PANE = 'dpunkt'
/** Nummernschilder der Arme über Linien, Dreiecken und Strassennamen (sonst teils von der Armlinie verdeckt;
 *  im gemeinsamen Pane hängt die Reihenfolge Marker/SVG vom z-index aus der Bildschirmlage ab); nur D liegt darüber */
const SCHILD_PANE = 'schilder'
// Knoten: nur Marker im Sichtbereich mit diesem Rand (Anteil je Seite) zeichnen
const MARKER_RAND = 0.5
const STANDORT_MS = 10000
const STANDORT_FARBE = '#2563eb'
const STANDORT_SYMBOL = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>' +
  '<path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>'

/** Meldung zu einem Fehler der Standortbestimmung (GeolocationPositionError.code) */
export function standortFehlerText(code: number): string {
  if (code === 1) return 'Standort nicht freigegeben: Zugriff auf den Standort in den Einstellungen des Browsers erlauben.'
  if (code === 3) return `Standort nicht innert ${STANDORT_MS / 1000} s bestimmt; nochmals versuchen.`
  return 'Standort zurzeit nicht verfügbar (kein GPS- bzw. Netzempfang).'
}

const ll = (p: P): L.LatLngTuple => wgs(p[0], p[1])

/** Geometrie eines Hindernisses als Leaflet-Ebene (Linien von Hecke, Mauer, Zaun als Linie, sonst Umriss) */
function hindernisEbene(h: Hindernis, stilRoh: L.PathOptions): L.Path {
  const stil: L.PathOptions = { pane: HIND_PANE, ...stilRoh }
  if ((h.art === 'hecke' || h.art === 'mauer' || h.art === 'uebrige') && !h.ring && h.linie) return L.polyline(h.linie.map(ll), { ...stil, weight: 4 })
  if (h.art === 'zaun') return L.polyline(h.linie.map(ll), { ...stil, weight: 3, dashArray: h.dicht ? stil.dashArray : '1 5' })
  return L.polygon(hindernisRing(h).map(ll), h.art === 'baum' ? { ...stil, weight: 3 } : stil)
}
const knotenTip = (k: OsmKnoten, lsa?: Set<number>) => k.tags[KREISEL_TAG] ? `<b>Kreisel</b> (Ringpunkt ${k.id})<br><i>Klick: Kreisel wählen</i>` :
  `<b>OSM-Knoten ${k.id}</b>${lsa?.has(k.id) ? ' · LSA (Lichtsignalanlage)' : ''}<br><i>Klick: Knoten wählen</i>`
/** Knotenpunkt; K1: ein Kreisel als Ring (weiss gefüllt) in der Kreiselmitte */
const markerStil = (g: boolean, kreisel = false): L.CircleMarkerOptions => ({
  radius: g ? 9 : 6, color: kreisel ? KNOTEN_FARBE : g ? '#0f172a' : '#ffffff', weight: kreisel ? (g ? 5 : 4) : g ? 3 : 2,
  fillColor: kreisel ? '#ffffff' : KNOTEN_FARBE, fillOpacity: 0.95, pane: OBEN_PANE,
})
/** K1: Farben des Kreisels auf der Karte */
const KREISEL_RAND_FARBE = '#f8fafc'
const KREISEL_INSEL_FARBE = '#16a34a'
const KREISEL_INNENRING_FARBE = '#facc15'
const KREISEL_FAHRLINIE_FARBE = '#38bdf8'
const KREISEL_BETA_FARBE = '#f472b6'
/** Schraffur einer Fläche (LV95): Linien unter 45° im Abstand abstand [m], auf die Fläche zugeschnitten */
function schraffur(ring: P[], abstand = 0.8): P[][] {
  if (ring.length < 3) return []
  const xs = ring.map(p => p[0] + p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs)
  const ys = ring.map(p => p[1] - p[0]), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const out: P[][] = []
  for (let c = x0 + abstand / 2; c < x1; c += abstand * Math.SQRT2) {
    // Linie x + y = c, von y − x = y0 bis y1
    const a: P = [(c - y0) / 2, (c + y0) / 2], b: P = [(c - y1) / 2, (c + y1) / 2]
    out.push(...linieImPolygon([a, b], [ring]))
  }
  return out
}
/** Nummernschild eines Arms (divIcon, Klasse arm-nr; gewählte Zufahrt gefüllt) */
export const nrIcon = (a: Pick<ArmInfo, 'nr'>, gewaehlt: boolean): L.DivIcon =>
  L.divIcon({ className: gewaehlt ? 'arm-nr gewaehlt' : 'arm-nr', iconSize: [22, 22], html: `<span>${esc(a.nr)}</span>` })
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
// Geladene Quellen (quellenEbenen.ts, seit 01.11.2026): unter den Objekten der Prüfung, ohne Mausereignisse
const Q_WERT_PANE = 'quellenWerte'
const Q_PANE = 'quellen'
const Q_FLAECHE_PANE = 'quellenFlaechen'
const Q_PROFIL_PANE = 'quellenProfile'
/** Tags des OSM-Wegs eines Arms, die die Rechnung liest (Fahrstreifen, Parkierung, Radstreifen, Tempo, Zone, Vortritt, Überholen; S6,
 *  01.11.2026), als Zeile im Tooltip; ohne solche Tags leer */
const OSM_TAG_MUSTER = /^(highway|lanes|turn:lanes|oneway|maxspeed|zone:maxspeed|cycleway|parking|width|overtaking|priority_road|sidewalk)(:|$)/
function osmTagZeile(weg: number, tags?: ReadonlyMap<number, Record<string, string>> | null): string {
  const t = tags?.get(weg)
  if (!t) return ''
  const z = Object.entries(t).filter(([k]) => OSM_TAG_MUSTER.test(k)).map(([k, v]) => `${k}=${v}`)
  return z.length ? `<br><span style="font-size:11px">OSM way ${weg}: ${esc(z.join(', '))}</span>` : ''
}
const f1 = (x: number) => x.toFixed(1).replace('.', ',')
/** Verdecker im Tooltip: Name ohne Quelle in Klammern am Schluss; Art davor, wenn der Name sie nicht schon nennt */
function verdeckerName(v: { art: string; name: string }): string {
  const name = v.name.replace(/\s*\([^()]*\)\s*$/, '') || v.name
  return name === v.art || v.name === 'Gebäude (AV)' ? v.art : name.split(' ')[0] === v.art.split(' ')[0] ? name : `${v.art}: ${name}`
}

/** Abstand des Dreh-Griffs vor der Front [m] */
const GRIFF_VOR_FRONT_M = 2.5
/** Schiebe-Griff von F_B: so weit hinter D, im Heck des Fahrzeugs */
const FB_GRIFF_HINTER_D_M = 1.5
const GRIFF_FARBE = '#f59e0b'
/** Symbole als SVG um die Mitte (12, 12): Schriftzeichen wie ✥ und ↻ sitzen je nach Schrift neben der Mitte */
const griffSvg = (d: string) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.6" ` +
  `stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`
const GRIFF_SYMBOL = {
  schieben: griffSvg('M12 3v18M3 12h18M12 3 9 6M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3'),
  drehen: griffSvg('M19 12a7 7 0 1 1-2.05-4.95M17 3v4h-4'),
}
/** Griff zum Ziehen: Schieben bzw. Drehen; beiZug zeichnet die Vorschau, amEnde übernimmt die Lage */
function griffZeichnen(ebene: L.LayerGroup, p: P, art: 'schieben' | 'drehen', titel: string, beiZug: (q: P) => void, amEnde: (q: P) => void, von?: P): void {
  const lage = (ev: L.LeafletEvent): P => { const g = (ev.target as L.Marker).getLatLng(); return lv95(g.lat, g.lng) }
  // Stiel vom Drehpunkt zum Griff: zeigt, wozu der Griff gehört
  const stiel = von ? L.polyline([ll(von), ll(p)], { color: GRIFF_FARBE, weight: 3, interactive: false, pane: OBEN_PANE }).addTo(ebene) : null
  L.marker(ll(p), { draggable: true, keyboard: false, pane: D_PANE, zIndexOffset: 1100, bubblingMouseEvents: false,
    icon: L.divIcon({ className: `kartengriff ${art}`, iconSize: [30, 30], html: GRIFF_SYMBOL[art] }) })
    .bindTooltip(titel).on('drag', ev => { const q = lage(ev); stiel?.setLatLngs([ll(von!), ll(q)]); beiZug(q) }).on('dragend', ev => amEnde(lage(ev))).addTo(ebene)
}
/** Vorschau beim Ziehen: gestrichelter Umriss, beim ersten Aufruf angelegt */
function vorschauZeichnen(ebene: L.LayerGroup): (pts: P[]) => void {
  let form: L.Polygon | null = null
  return pts => {
    if (form) form.setLatLngs(pts.map(ll))
    else form = L.polygon(pts.map(ll), { color: '#f59e0b', weight: 2, dashArray: '4 3', fillOpacity: 0.15, interactive: false, pane: OBEN_PANE }).addTo(ebene)
  }
}

/** Auto von oben als zwei Polygone (Umriss, Scheibe) mit Tooltip */
function autoZeichnen(ebene: L.LayerGroup, mitte: P, richtung: P, farbe: string, rand: string, tooltip: string, schalten?: () => void): void {
  L.polygon(autoUmriss(mitte, richtung).map(ll), { color: rand, weight: 1.5, fillColor: farbe, fillOpacity: 0.9, pane: OBEN_PANE })
    .bindTooltip(tooltip + (schalten ? '<br><i>Klick: Sichtfeld dieses Fahrzeugs ein-/ausblenden</i>' : ''), { sticky: true })
    .on('click', e => { if (schalten) { L.DomEvent.stopPropagation(e); schalten() } }).addTo(ebene)
  L.polygon(autoScheibe(mitte, richtung).map(ll), { color: SCHEIBE_FARBE, weight: 1, fillColor: SCHEIBE_FARBE, fillOpacity: 0.9,
    interactive: false, pane: OBEN_PANE }).addTo(ebene)
}

/** Velo als Piktogramm fester Grösse (Vogelperspektive, in Fahrtrichtung gedreht): das Velo von 1,8 × 0,6 m wäre als Polygon bei
 *  Zoom 18 nur wenige Pixel gross und ging unter dem D-Punkt unter. Länge VELO_SYMBOL_PX, Breite ein Drittel davon. */
const VELO_SYMBOL_PX = 34
function veloZeichnen(ebene: L.LayerGroup, mitte: P, richtung: P, farbe: string, rand: string, tooltip: string, schalten?: () => void): void {
  const n = Math.hypot(richtung[0], richtung[1]) || 1
  // Bildschirm: x nach Osten, y nach Süden; CSS-Drehung im Uhrzeigersinn
  const grad = Math.atan2(-richtung[1] / n, richtung[0] / n) * 180 / Math.PI
  const w = VELO_SYMBOL_PX, h = Math.round(VELO_SYMBOL_PX / 3)
  // Vogelperspektive, Fahrt nach rechts: Hinterrad, Rahmen, Vorderrad, Lenker quer, Kopf des Fahrers
  const html = `<svg viewBox="0 0 60 20" width="${w}" height="${h}" style="display:block;overflow:visible;transform:rotate(${grad}deg);filter:drop-shadow(0 0 1.5px #0f172a) drop-shadow(0 0 1px #0f172a)">` +
    `<rect x="2" y="7" width="20" height="6" rx="3" fill="${farbe}" stroke="${rand}" stroke-width="1.5"/>` +
    `<rect x="38" y="7" width="20" height="6" rx="3" fill="${farbe}" stroke="${rand}" stroke-width="1.5"/>` +
    `<rect x="18" y="8.5" width="24" height="3" fill="${farbe}" stroke="${rand}" stroke-width="1"/>` +
    `<rect x="40" y="1" width="3" height="18" rx="1.5" fill="${farbe}" stroke="${rand}" stroke-width="1"/>` +
    `<circle cx="27" cy="10" r="5" fill="${farbe}" stroke="${rand}" stroke-width="1.5"/></svg>`
  L.marker(ll(mitte), { icon: L.divIcon({ className: 'velo-symbol', html, iconSize: [w, h], iconAnchor: [w / 2, h / 2] }),
    pane: OBEN_PANE, keyboard: false }).bindTooltip(tooltip + (schalten ? '<br><i>Klick: Sichtfeld dieses Fahrzeugs ein-/ausblenden</i>' : ''), { sticky: true })
    .on('click', e => { if (schalten) { L.DomEvent.stopPropagation(e); schalten() } }).addTo(ebene)
}

const KARTE_STUFEN = [30, 45, 70]   // Kartenhöhe auf dem Smartphone in % der Fensterhöhe

/** Schlüssel der zuletzt gesehenen Kartenansicht im Browser (nur Bequemlichkeit, darf fehlen) */
const ANSICHT_SCHLUESSEL = 'sichtweitencheck.karteAnsicht'

export default function Karte(props: {
  mitte: [number, number]
  av: AvFlaeche[] | null
  kantone: string[]
  knoten: OsmKnoten[]
  /** LSA-Knoten (Lichtsignal in OSM am Knoten bzw. auf einem Arm) im geladenen Umkreis */
  lsa?: Set<number>
  strassennamen: Strassenname[]
  gewaehlt: number | null
  rechnung: Rechnung | null
  zufahrt: string | null
  hindernisse: Hindernis[]                           // Eingaben des Falls (von Hand, bestätigte Vorschläge)
  werkzeug: Werkzeug
  knotenWerkzeug: KnotenWerkzeug                     // E2b: Haltelinie bzw. Zufahrt setzen
  zufahrtVorschau?: ZufahrtEntwurf | null
  onZufahrtRichtung?: (p: P) => void
  zufahrtErster: P | null                            // Zufahrt setzen: erster Klick (wartet auf die Richtung)
  zeichnung: P[]
  bearbeiten: string | null                          // Id des gewählten bzw. bearbeiteten Hindernisses (Ecken ziehen)
  hervor?: P[] | null                                // Massnahmen (E3a): Umriss eines Hindernisses hervorheben
  onKnoten: (k: OsmKnoten) => void
  onZufahrt: (key: string) => void
  onKlick: (p: P) => void
  onKnotenKlick: (p: P) => void                      // Klick mit einem Werkzeug zum Knoten
  onD: (p: P) => void                                // D gezogen (D von Hand)
  fahrzeugeBearbeiten: boolean                       // Griffe an F_A und F_B zeigen
  halteBearbeiten: boolean                           // Griffe an der Halte- oder Wartelinie zeigen
  onFbRichtung: (richtung: P) => void                // F_B um D gedreht
  onFbVersatz: (versatz: number) => void             // F_B seitlich verschoben: Zufahrtsachse von Hand
  onFaHand: (r: Richtung, lage: FahrzeugLageHand) => void   // F_A verschoben bzw. gedreht
  onVeloHand: (r: Richtung, versatz: number) => void        // Velo mit Vortritt seitlich verschoben: Veloachse von Hand
  onHaltelinie: (mitte: P, richtung: P) => void      // Halte- oder Wartelinie verschoben bzw. gedreht
  onDtrottoir: (p: P) => void                        // D' der Phase Trottoir gezogen (K0, D' von Hand)
  onDoppelklick: () => void
  onEcke: (id: string, i: number, p: P) => void
  onHindernis: (id: string) => void
  onAusschnitt: () => void                           // nach jedem Verschieben bzw. Zoomen (moveend)
  hinweis: KartenHinweis | null
  kartenRef: React.MutableRefObject<L.Map | null>
  /** gelesene Objekte je Quelle (quellenEbenen.ts), im Fenster «Geladene Quellen» einzeln einblendbar */
  quellenEbenen?: EbenenDaten
  /** OSM-Tags der Strassen nach Weg-Id: der Tooltip eines Arms nennt die Tags, die die Rechnung liest (S6, seit 01.11.2026) */
  osmTags?: ReadonlyMap<number, Record<string, string>> | null
}) {
  const { mitte, av, kantone, knoten, strassennamen, gewaehlt, rechnung, zufahrt, hindernisse, werkzeug, knotenWerkzeug, fahrzeugeBearbeiten, halteBearbeiten, zufahrtErster,
    zeichnung, bearbeiten, kartenRef, hervor = null } = props
  /** ein Werkzeug ist aktiv: Klicks auf Knoten, Arme und Hindernisse gehen an das Werkzeug */
  const werkzeugAktiv = () => !!(cb.current.werkzeug || cb.current.knotenWerkzeug)
  const [sicht, sichtSetzen] = useSichtWahl()
  const [hkMap, setHkMap] = useState<L.Map | null>(null)
  const hk = useHoehenkurven(hkMap, av)
  const [avAn, setAvAn] = useState(true)
  const [avArten, setAvArten] = useState(() => { try { return avArtenLesen(localStorage.getItem('swc.avArten')) } catch { return avArtenLesen(null) } })
  const avArtSetzen = (art: string, an: boolean) => setAvArten(alt => { const neu = new Set(alt); if (an) neu.add(art); else neu.delete(art); return neu })

  const sichtKlick = (art: SichtArt, id?: string) => {
    if (werkzeugAktiv()) return
    sichtSetzen(art, !sichtZeigen(sicht, art, id), id)
  }
  const autoMitSicht = (...args: Parameters<typeof autoZeichnen>) => autoZeichnen(...args.slice(0, 6) as [L.LayerGroup, P, P, string, string, string], args[6])
  const veloMitSicht = (...args: Parameters<typeof veloZeichnen>) => veloZeichnen(...args.slice(0, 6) as [L.LayerGroup, P, P, string, string, string], args[6])

  const elRef = useRef<HTMLDivElement>(null)
  const ebenenRef = useRef<Record<string, L.LayerGroup> | null>(null)
  const cb = useRef(props)
  cb.current = props
  // «Geladene Quellen» (seit 01.11.2026, wie VeloroutenCheck und fgsCheck): Fenster unten links, an der Kopfzeile verschiebbar; Wahl gemerkt
  const [qAn, setQAn] = useState<Set<EbeneId>>(() => {
    try { const v = JSON.parse(localStorage.getItem('swc.quellen') ?? 'null'); if (Array.isArray(v)) return new Set(v as EbeneId[]) } catch { /* ohne Speicher */ }
    return new Set<EbeneId>()
  })
  const qSchalten = (id: EbeneId, an: boolean) => setQAn(prev => {
    const n = new Set(prev); if (an) n.add(id); else n.delete(id)
    try { localStorage.setItem('swc.quellen', JSON.stringify([...n])) } catch { /* nur für diese Sitzung */ }
    return n
  })
  const [qOffen, setQOffen] = useState(false)
  const [profilAuswahl, setProfilAuswahl] = useState<string | null>(null)
  const [alleGelaendeProfile, setAlleGelaendeProfile] = useState(false)
  const [qPos, setQPos] = useState<{ x: number; y: number } | null>(() => {
    try { const v = JSON.parse(localStorage.getItem('swc.quellenPos') ?? 'null'); return v && Number.isFinite(v.x) && Number.isFinite(v.y) ? v : null } catch { return null }
  })
  const [qZoom, setQZoom] = useState(18)
  const qFensterRef = useRef<HTMLDivElement>(null)
  const quellenRef = useRef<L.LayerGroup | null>(null)
  const qTrefferRef = useRef<((p: P, tolM: number) => string | null) | null>(null)
  const qZiehen = (e: React.PointerEvent<HTMLDivElement>) => {
    const fenster = qFensterRef.current, rahmen = fenster?.parentElement
    if (!fenster || !rahmen || (e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    const r = rahmen.getBoundingClientRect(), f = fenster.getBoundingClientRect(), dx = e.clientX - f.left, dy = e.clientY - f.top
    let zuletzt: { x: number; y: number } | null = null
    const bewegen = (ev: PointerEvent) => {
      zuletzt = { x: Math.round(Math.min(Math.max(0, ev.clientX - r.left - dx), Math.max(0, r.width - f.width))),
        y: Math.round(Math.min(Math.max(0, ev.clientY - r.top - dy), Math.max(0, r.height - 40))) }
      setQPos(zuletzt)
    }
    const los = () => {
      window.removeEventListener('pointermove', bewegen); window.removeEventListener('pointerup', los); window.removeEventListener('pointercancel', los)
      if (zuletzt) try { localStorage.setItem('swc.quellenPos', JSON.stringify(zuletzt)) } catch { /* nur für diese Sitzung */ }
    }
    window.addEventListener('pointermove', bewegen); window.addEventListener('pointerup', los); window.addEventListener('pointercancel', los)
  }
  useEffect(() => {
    const fenster = qFensterRef.current, rahmen = fenster?.parentElement
    if (qOffen && qPos && fenster && rahmen && (qPos.x + 60 > rahmen.clientWidth || qPos.y + 60 > rahmen.clientHeight)) setQPos(null)
  }, [qOffen])   // eslint-disable-line react-hooks/exhaustive-deps
  const markerRef = useRef(new Map<number, { k: OsmKnoten; m: L.CircleMarker }>())
  const namenRef = useRef<{ s: Strassenname; m: L.Marker | null }[]>([])
  // Nummernschilder der Arme: Abstand vom Knoten je Zoom (NR_MIN_PX)
  const schilderRef = useRef<{ m: L.Marker; lage: (abstand: number) => P }[]>([])
  const namenAbgleich = () => {
    const map = kartenRef.current, eb = ebenenRef.current
    if (!map || !eb) return
    const b = map.getBounds().pad(MARKER_RAND), an = map.getZoom() >= NAMEN_ZOOM
    // Namen, die ein Nummernschild treffen würden, ausblenden (Breite geschätzt: 12 px fett, rund 6,8 px je Zeichen)
    const schilder = schilderRef.current.map(x => map.latLngToContainerPoint(x.m.getLatLng()))
    const aufSchild = (s: Strassenname) => {
      const q = map.latLngToContainerPoint([s.lat, s.lon]), halb = s.name.length * 3.4 + 13
      return schilder.some(p => Math.abs(p.x - q.x) < halb && Math.abs(p.y - q.y) < 19)
    }
    for (const x of namenRef.current) {
      const zeigen = an && b.contains([x.s.lat, x.s.lon]) && !aufSchild(x.s)
      if (zeigen && !x.m) x.m = L.marker([x.s.lat, x.s.lon], { pane: NAMEN_PANE, interactive: false, keyboard: false,
        icon: L.divIcon({ className: 'strassenname', iconSize: [0, 0], html: `<span>${esc(x.s.name)}</span>` }) }).addTo(eb.namen)
      else if (!zeigen && x.m) { eb.namen.removeLayer(x.m); x.m = null }
    }
  }
  const schildAbstand = () => {
    const map = kartenRef.current
    if (!map) return NR_ABSTAND_M
    const mpx = 40075016.686 * Math.cos(map.getCenter().lat * Math.PI / 180) / 2 ** (map.getZoom() + 8)
    return Math.min(ARM_KARTE_M, Math.max(NR_ABSTAND_M, NR_MIN_PX * mpx))   // höchstens am Ende des gezeichneten Arms
  }
  const schilderAbgleich = () => { const d = schildAbstand(); for (const x of schilderRef.current) x.m.setLatLng(ll(x.lage(d))) }
  const gewaehltRef = useRef<number | null>(null)
  const markerAbgleich = () => {
    const map = kartenRef.current, eb = ebenenRef.current
    if (!map || !eb) return
    const b = map.getBounds().pad(MARKER_RAND)
    for (const { k, m } of markerRef.current.values()) {
      const zeigen = k.id === cb.current.gewaehlt || b.contains([k.lat, k.lon])
      if (zeigen && !eb.knoten.hasLayer(m)) m.addTo(eb.knoten)
      else if (!zeigen && eb.knoten.hasLayer(m)) eb.knoten.removeLayer(m)
    }
  }
  // Standort: nur Anzeige auf der Karte, wird nirgends gespeichert oder gesendet
  const [standortHinweis, setStandortHinweis] = useState<KartenHinweis | null>(null)
  useEffect(() => {
    if (!standortHinweis?.fehler) return
    const t = setTimeout(() => setStandortHinweis(null), 8000)
    return () => clearTimeout(t)
  }, [standortHinweis])

  useEffect(() => {
    if (!elRef.current || kartenRef.current) return
    // letzte Kartenansicht dieses Browsers (29.10.2026, wie fgsCheck): nach einem Neuladen dort weiter statt am Startort; nur Schweiz
    const gemerkt = ((): { c: [number, number]; z: number } | null => {
      try {
        const v = JSON.parse(localStorage.getItem(ANSICHT_SCHLUESSEL) ?? 'null') as { c: [number, number]; z: number } | null
        return v && v.c[0] > 45.7 && v.c[0] < 47.9 && v.c[1] > 5.9 && v.c[1] < 10.6 && v.z >= 8 && v.z <= 22 ? v : null
      } catch { return null }
    })()
    const map = L.map(elRef.current, { maxZoom: 22, doubleClickZoom: false }).setView(gemerkt?.c ?? mitte, gemerkt?.z ?? 18)
    map.on('moveend', () => {
      const c = map.getCenter()
      try { localStorage.setItem(ANSICHT_SCHLUESSEL, JSON.stringify({ c: [c.lat, c.lng], z: map.getZoom() })) } catch { /* ohne Speicher */ }
    })
    // Quellenangabe: auf dem Smartphone einzeilig gekürzt (index.css), Tippen klappt sie auf (seit 28.10.2026, wie VeloroutenCheck)
    map.attributionControl.getContainer()?.addEventListener('click', ev => (ev.currentTarget as HTMLElement).classList.toggle('offen'))
    const luftbild = L.tileLayer(HINTERGRUND_LUFTBILD, { maxZoom: 22, maxNativeZoom: 20, attribution: '© swisstopo' }).addTo(map)
    const landeskarte = L.tileLayer(HINTERGRUND_KARTE, { maxZoom: 22, maxNativeZoom: 18, attribution: '© swisstopo' })
    const namenPane = map.createPane(NAMEN_PANE)
    namenPane.style.zIndex = '450'
    namenPane.style.pointerEvents = 'none'
    map.createPane(HIND_PANE).style.zIndex = '410'
    // Geladene Quellen: über den Hindernissen (410), unter den Treffern (420), ohne Mausereignisse (Tooltip über den Treffertest)
    const qPane = map.createPane(Q_PANE)
    qPane.style.zIndex = '415'
    const qFlaeche = map.createPane(Q_FLAECHE_PANE); qFlaeche.style.zIndex = '403'; qFlaeche.style.pointerEvents = 'none'
    const qProfil = map.createPane(Q_PROFIL_PANE); qProfil.style.zIndex = '580'; qProfil.style.pointerEvents = 'none'
    qPane.style.pointerEvents = 'none'
    const qWert = map.createPane(Q_WERT_PANE); qWert.style.zIndex = '610'; qWert.style.pointerEvents = 'none'
    quellenRef.current = L.layerGroup().addTo(map)
    const qTip = L.tooltip({ direction: 'top', offset: [0, -12] })
    let qRaf = 0
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (qRaf) return
      qRaf = requestAnimationFrame(() => {
        qRaf = 0
        const ziel = e.originalEvent.target as Element | null
        const frei = !ziel?.closest?.('.leaflet-interactive, .leaflet-marker-icon, .leaflet-control')
        const m = 7 * 40075016 * Math.cos(e.latlng.lat * Math.PI / 180) / (256 * 2 ** map.getZoom())
        const x = frei && qTrefferRef.current ? qTrefferRef.current(lv95(e.latlng.lat, e.latlng.lng), m) : null
        if (!x) { map.closeTooltip(qTip); return }
        qTip.setContent(esc(x)); qTip.setLatLng(e.latlng)
        if (!map.hasLayer(qTip)) map.openTooltip(qTip)
      })
    })
    map.on('mouseout', () => map.closeTooltip(qTip))
    map.on('zoomend', () => setQZoom(map.getZoom()))
    map.createPane(TREFFER_PANE).style.zIndex = '420'
    map.createPane(OBEN_PANE).style.zIndex = '430'
    map.createPane(SCHILD_PANE).style.zIndex = '455'
    map.createPane(D_PANE).style.zIndex = '460'
    const eb: Record<string, L.LayerGroup> = {
      masse: L.layerGroup().addTo(map), av: L.layerGroup().addTo(map), sicht: L.layerGroup().addTo(map), hind: L.layerGroup().addTo(map), treffer: L.layerGroup().addTo(map),
      arme: L.layerGroup().addTo(map), knoten: L.layerGroup().addTo(map), namen: L.layerGroup().addTo(map), standort: L.layerGroup().addTo(map),
      zeichnen: L.layerGroup().addTo(map), zufahrtVorschau: L.layerGroup().addTo(map), fahrzeug: L.layerGroup().addTo(map),
    }
    L.control.layers({ 'Luftbild (SWISSIMAGE)': luftbild, 'Landeskarte (swisstopo)': landeskarte }, {
      'Knoten (OSM)': eb.knoten, 'Strassennamen (OSM)': eb.namen, 'Fahrzeuge und Personen': eb.fahrzeug, 'Hindernisse': eb.hind,
      'Verdecker im Sichtdreieck': eb.treffer, 'Arme': eb.arme },
    { collapsed: true }).addTo(map)
    L.control.scale({ imperial: false }).addTo(map)
    const standortKnopf = new L.Control({ position: 'topleft' })
    standortKnopf.onAdd = () => {
      const div = L.DomUtil.create('div', 'leaflet-bar standort-knopf')
      const a = L.DomUtil.create('a', '', div)
      a.href = '#'; a.title = 'Zum eigenen Standort'; a.setAttribute('role', 'button'); a.setAttribute('aria-label', 'Zum eigenen Standort')
      a.innerHTML = STANDORT_SYMBOL
      L.DomEvent.disableClickPropagation(div)
      L.DomEvent.on(a, 'click', e => { L.DomEvent.preventDefault(e); standort() })
      return div
    }
    standortKnopf.addTo(map)
    const standort = () => {
      if (!window.isSecureContext) { setStandortHinweis({ text: 'Standort nur über eine sichere Verbindung (https) abrufbar.', fehler: true }); return }
      if (!('geolocation' in navigator)) { setStandortHinweis({ text: 'Dieser Browser kann den Standort nicht bestimmen.', fehler: true }); return }
      setStandortHinweis({ text: 'Standort wird bestimmt …' })
      navigator.geolocation.getCurrentPosition(pos => {
        if (kartenRef.current !== map) return
        const { latitude: lat, longitude: lon, accuracy } = pos.coords
        eb.standort.clearLayers()
        L.circle([lat, lon], { radius: accuracy, color: STANDORT_FARBE, weight: 1, fillColor: STANDORT_FARBE, fillOpacity: 0.12,
          interactive: false }).addTo(eb.standort)
        L.circleMarker([lat, lon], { radius: 6, color: '#ffffff', weight: 2, fillColor: STANDORT_FARBE, fillOpacity: 1, interactive: false })
          .addTo(eb.standort)
        if (accuracy > STANDORT_UNGENAU_M) map.fitBounds(L.latLng(lat, lon).toBounds(2 * accuracy))
        else map.setView([lat, lon], STANDORT_ZOOM)
        setStandortHinweis(null)
      }, err => setStandortHinweis({ text: standortFehlerText(err.code), fehler: true }),
      { enableHighAccuracy: true, timeout: STANDORT_MS, maximumAge: 30000 })
    }
    map.attributionControl.addAttribution('© OpenStreetMap-Mitwirkende')
    // Zeichnen (E2a, wie fgsCheck): Klick setzt einen Punkt, Doppelklick schliesst (Doppelklick-Zoom ist dafür aus)
    map.on('click', (e: L.LeafletMouseEvent) => {
      const p = lv95(e.latlng.lat, e.latlng.lng)
      if (cb.current.werkzeug) cb.current.onKlick(p)
      else if (cb.current.knotenWerkzeug) cb.current.onKnotenKlick(p)
    })
    map.on('dblclick', () => { if (cb.current.werkzeug) cb.current.onDoppelklick() })
    map.on('moveend', () => { markerAbgleich(); namenAbgleich(); cb.current.onAusschnitt() })
    map.on('zoomend', () => schilderAbgleich())
    kartenRef.current = map
    setHkMap(map)
    ebenenRef.current = eb
    return () => { map.remove(); kartenRef.current = null; ebenenRef.current = null; quellenRef.current = null }
  }, [mitte, kartenRef])

  useEffect(() => {
    const el = elRef.current
    if (el) el.style.cursor = werkzeug || knotenWerkzeug ? 'crosshair' : ''
  }, [werkzeug, knotenWerkzeug])

  // Beim Laden neuer AV-Daten die für die Prüfung wichtigen Flächen automatisch einblenden.
  // Innerhalb derselben Prüfung bleiben die einzelnen Arten weiterhin von Hand schaltbar.
  useEffect(() => {
    if (!av?.length) return
    setAvAn(true)
    setAvArten(alt => {
      const grundlagen = ['trottoir', 'verkehrsinsel', 'gebaeude']
      return grundlagen.every(art => alt.has(art)) ? alt : new Set([...alt, ...grundlagen])
    })
  }, [av])

  // AV-Bodenbedeckung
  useEffect(() => {
    const map = kartenRef.current, eb = ebenenRef.current
    if (!map || !eb) return
    eb.av.clearLayers()
    try { localStorage.setItem('swc.avArten', JSON.stringify([...avArten])) } catch { /* Sitzung */ }
    if (avAn && !map.hasLayer(eb.av)) eb.av.addTo(map)
    else if (!avAn && map.hasLayer(eb.av)) map.removeLayer(eb.av)
    if (!av) return
    for (const f of av) {
      if (!avArtSichtbar(f.art, avAn, avArten)) continue
      const { farbe, deckkraft } = avKartenStil(f.art)
      L.polygon(f.ringe.map(r => r.map(ll)), { color: farbe, weight: 1, fillColor: farbe, fillOpacity: deckkraft, interactive: false })
        .addTo(eb.av)
    }
    const text = `Amtliche Vermessung, Kanton ${kantone.join(', ') || '?'}, geodienste.ch`
    map.attributionControl.addAttribution(text)
    return () => { map.attributionControl.removeAttribution(text) }
  }, [av, kantone, kartenRef, avAn, avArten])

  // Strassennamen (OSM)
  useEffect(() => {
    const eb = ebenenRef.current
    if (!eb) return
    eb.namen.clearLayers()
    namenRef.current = strassennamen.map(s => ({ s, m: null }))
    namenAbgleich()
  }, [strassennamen])

  // Knoten zum Anklicken: Marker je Knoten einmal erzeugt, gezeichnet nur im Sichtbereich mit Rand
  useEffect(() => {
    const vorher = markerRef.current, neu = new Map<number, { k: OsmKnoten; m: L.CircleMarker }>()
    for (const k of knoten) {
      const alt = vorher.get(k.id)
      if (alt && alt.k === k) { neu.set(k.id, alt); vorher.delete(k.id); continue }
      const m = L.circleMarker([k.lat, k.lon], markerStil(k.id === cb.current.gewaehlt, !!k.tags[KREISEL_TAG]))
        .bindTooltip(knotenTip(k, cb.current.lsa))
        .on('click', e => { if (werkzeugAktiv()) return; L.DomEvent.stopPropagation(e); cb.current.onKnoten(k) })
      neu.set(k.id, { k, m })
    }
    for (const { m } of vorher.values()) m.remove()
    markerRef.current = neu
    markerAbgleich()
  }, [knoten])
  // LSA-Knoten im Tooltip kennzeichnen
  useEffect(() => {
    for (const { k, m } of markerRef.current.values()) m.setTooltipContent(knotenTip(k, props.lsa))
  }, [props.lsa, knoten])
  useEffect(() => {
    const n = markerRef.current
    for (const id of new Set([gewaehltRef.current, gewaehlt])) {
      const x = id === null ? undefined : n.get(id)
      if (x) x.m.setStyle(markerStil(id === gewaehlt, !!x.k.tags[KREISEL_TAG]))
    }
    gewaehltRef.current = gewaehlt
    markerAbgleich()
    const x = gewaehlt === null ? undefined : n.get(gewaehlt)
    if (x && ebenenRef.current?.knoten.hasLayer(x.m)) x.m.bringToFront()
  }, [gewaehlt])

  // K1: Kreisel: Aussenrand, Mittelinsel, Innenring-Vorschlag, Arme (Ein- und Ausfahrt) mit Nummernschild ausserhalb des Rings; noch keine
  // Wahl der Zufahrt
  const kreiselZeichnen = (kn: KnotenInfo, ebene: L.LayerGroup) => {
    const k = kn.kreisel!, v = k.vermessung, geschaetzt = v.quelle === 'osm' ? ' (aus OSM geschätzt)' : ' (AV)'
    const zArm = k.zufahrt?.arm ?? null
    const nr = (key: string) => k.arme.find(a => a.key === key)?.nr ?? '?'
    // Arme: Klick wählt die Einfahrt (nur Arme mit Einfahrt); Bypass gestrichelt (E10)
    for (const a of k.arme) {
      const istZ = a.key === zArm
      const tip = `${esc(armText(a))}${a.getrennt ? ' – Einfahrt und Ausfahrt getrennt' : ''}${istZ ? ' – gewählte Einfahrt' : ''}` +
        (a.ein ? '<br><i>Klick: als Einfahrt wählen</i>' : '<br>nur Ausfahrt')
      const waehlen = (ev: L.LeafletEvent) => { if (werkzeugAktiv() || !a.ein) return; L.DomEvent.stopPropagation(ev); cb.current.onZufahrt(a.key) }
      for (const l of a.linien) L.polyline(l.map(ll), { color: istZ ? ZUFAHRT_FARBE : '#94a3b8', weight: istZ ? 7 : 5, opacity: 0.85, pane: OBEN_PANE })
        .bindTooltip(tip, { sticky: true }).on('click', waehlen).addTo(ebene)
      for (const bp of a.bypass) L.polyline(bp.linie.map(ll), { color: '#94a3b8', weight: 4, opacity: 0.85, dashArray: '6 6', pane: OBEN_PANE })
        .bindTooltip(`Bypass von ${esc(armText(a))} (OSM-Weg ${bp.wid}): mündet ${Math.round(bp.abstand)} m vor der Ausfahrt ` +
          `${esc(bp.vor)}; keine Einfahrt, Einfädeln nicht geprüft`, { sticky: true }).addTo(ebene)
      for (const vb of a.velobypass) for (const l of vb.linien) L.polyline(l.map(ll), { color: VELO_FARBE, weight: 4, opacity: 0.9,
        dashArray: '6 6', pane: OBEN_PANE }).bindTooltip(`Velobypass von ${esc(armText(a))} zu Arm ${esc(vb.zu)} (OSM-Weg ` +
        `${vb.wege.join(', ')}): Querungen und Einmündungen nicht geprüft`, { sticky: true }).addTo(ebene)
      const lage = (abstand: number) => add(kn.p, a.richtung, profilWert(v.aussen, winkelGrad(a.richtung)) + abstand / 2)
      const schild = L.marker(ll(lage(schildAbstand())), { icon: nrIcon(a, istZ), pane: SCHILD_PANE, keyboard: false, zIndexOffset: 1000 })
        .bindTooltip(tip).on('click', waehlen).addTo(ebene)
      schilderRef.current.push({ m: schild, lage })
    }
    // Form (E9): Insel, Innenring je Richtung, Aussenrand, Fahrlinie mit Vortritt (dünn)
    if (v.inselR > 0) L.polygon(profilLinie(kn.p, v.insel).map(ll), { color: KREISEL_INSEL_FARBE, weight: 1, fillColor: KREISEL_INSEL_FARBE,
      fillOpacity: 0.3, pane: OBEN_PANE }).bindTooltip(`Mittelinsel${geschaetzt}, Durchmesser ${f1(2 * v.inselR)} m im Mittel` +
      (v.inselErgaenzt ? `, Rand auf ${v.inselErgaenzt}° ergänzt` : ''), { sticky: true }).addTo(ebene)
    const stuecke: P[][] = []
    for (let g = 0; g <= 360; g++) {
      const r = v.innenring[g % 360]
      if (r === null) { if (stuecke.length && stuecke[stuecke.length - 1].length) stuecke.push([]); continue }
      if (!stuecke.length) stuecke.push([])
      stuecke[stuecke.length - 1].push(add(kn.p, [Math.cos(g * Math.PI / 180), Math.sin(g * Math.PI / 180)], r))
    }
    for (const st of stuecke.filter(x => x.length > 1)) L.polyline(st.map(ll), { color: KREISEL_INNENRING_FARBE, weight: 2, dashArray: '6 4',
      pane: OBEN_PANE }).bindTooltip(`Innenring (Vorschlag), ${f2(INNENRING_AB_M)} m innerhalb des Aussenrands`, { sticky: true }).addTo(ebene)
    L.polyline(profilLinie(kn.p, v.aussen).map(ll), { color: KREISEL_RAND_FARBE, weight: 3, pane: OBEN_PANE, ...(v.quelle === 'osm' ? { dashArray: '8 5' } : {}) })
      .bindTooltip(`Aussenrand${geschaetzt}, Durchmesser ${f1(v.durchmesser)} m${v.dMax / v.dMin >= 1.1 ? ` im Mittel (${f1(v.dMin)} bis ` +
        `${f1(v.dMax)} m)` : ''}`, { sticky: true }).addTo(ebene)
    L.polyline(profilLinie(kn.p, v.fahrlinie).map(ll), { color: KREISEL_FAHRLINIE_FARBE, weight: 1.5, opacity: 0.7, dashArray: '2 5',
      interactive: false, pane: OBEN_PANE }).addTo(ebene)
    // K3: Konstruktion je aktiver Fahrbeziehung (Hilfslinie gepunktet, Tangenten, β am Schnitt), die massgebende kräftig
    for (const x of k.beta.beziehungen.filter(y => y.aktiv && y.gueltig)) {
      const mass = x.key === k.beta.massgebend, farbe = mass ? KREISEL_BETA_FARBE : '#e2e8f0'
      for (const h of [x.hilfEin, x.hilfAus]) if (h) L.polyline(h.map(ll), { color: farbe, weight: 1.5, dashArray: '1 4', interactive: false, pane: OBEN_PANE }).addTo(ebene)
      const text = `β ${nr(x.von)} → ${nr(x.nach)}: ${f1(x.betaGon!)} gon (${f1(x.betaGrad!)}°), Fall ${x.fall}${mass ? ', massgebend' : ''}` +
        `${x.re2Ein ? `; R<sub>e2</sub> Einfahrt ${f1(x.re2Ein)} m` : '; Einfahrt ohne Ausrundung'}${x.re2Aus ? `, Ausfahrt ${f1(x.re2Aus)} m` : ''}`
      L.polyline([ll(x.startEin!), ll(add(x.tangEin!, sub(x.tangEin!, x.startEin!), 0.3))], { color: farbe, weight: mass ? 3 : 1.5, pane: OBEN_PANE })
        .bindTooltip(text, { sticky: true }).addTo(ebene)
      L.polyline([ll(add(x.tangAus!, sub(x.tangAus!, x.startAus!), 0.3)), ll(x.startAus!)], { color: farbe, weight: mass ? 3 : 1.5, pane: OBEN_PANE })
        .bindTooltip(text, { sticky: true }).addTo(ebene)
      if (mass) L.marker(ll(x.tangEin!), { icon: L.divIcon({ className: 'lsa-marke', iconSize: [0, 0], html: `<span>β ${f1(x.betaGon!)} gon</span>` }),
        pane: OBEN_PANE, keyboard: false, interactive: false }).addTo(ebene)
    }
    // K2: gewählte Einfahrt: Fahrlinie der Einfahrt bis K, Fahrlinie mit Vortritt von links, Wartelinie, K, D
    const z = k.zufahrt
    if (!z) return
    L.polyline(z.vortrittLinie.map(ll), { color: KREISEL_FAHRLINIE_FARBE, weight: 4, opacity: 0.9, pane: OBEN_PANE })
      .bindTooltip('Fahrlinie mit Vortritt (Verkehr von links, in der Mitte der Kreiselfahrbahn)', { sticky: true }).addTo(ebene)
    L.polyline(z.achse.map(ll), { color: ACHSE_FARBE, weight: 2, dashArray: '6 4', pane: OBEN_PANE })
      .bindTooltip(`Fahrlinie der Einfahrt (${esc(z.lageQuelle)})`, { sticky: true }).addTo(ebene)
    const t = einheit(sub(z.K, z.rand)), q: P = [-t[1], t[0]]
    L.polyline([ll(add(z.rand, q, -2)), ll(add(z.rand, q, 2))], { color: '#ffffff', weight: 3, pane: OBEN_PANE })
      .bindTooltip('Rand der Kreiselfahrbahn (Wartelinie)').addTo(ebene)
    L.circleMarker(ll(z.K), { radius: 5, color: D_RAND_FARBE, weight: 2, fillColor: KREISEL_FAHRLINIE_FARBE, fillOpacity: 1, pane: D_PANE })
      .bindTooltip('K: Schnitt der Fahrlinie der Einfahrt mit der Fahrlinie mit Vortritt').addTo(ebene)
    L.circleMarker(ll(z.D), { radius: 6, color: D_RAND_FARBE, weight: 2, fillColor: D_FARBE, fillOpacity: 1, pane: D_PANE })
      .bindTooltip(`D: ${f2(z.B)} m hinter der Wartelinie, am Fahrer*innensitz`).addTo(ebene)
    // K4: Sichtberme schraffiert (freihalten), Rest der Insel «Durchsicht verhindern», Sichtdreiecke Ak (bzw. Velo, wenn länger) und Az
    const s = k.sicht
    if (!s) return
    for (const r of s.durchsicht) L.polygon(r.map(ll), { color: '#14532d', weight: 1, fillColor: '#14532d', fillOpacity: 0.45, pane: OBEN_PANE })
      .bindTooltip('Durchsicht verhindern (VSS 40 263 Ziffer 13.3): ausserhalb des Sichtfelds; ein Hindernis hier ist erwünscht', { sticky: true }).addTo(ebene)
    for (const r of s.berme.flaechen) {
      L.polygon(r.map(ll), { color: '#b45309', weight: 1.5, fillOpacity: 0, pane: OBEN_PANE })
        .bindTooltip(`Sichtberme: freihalten zwischen 0,60 und 3,00 m Höhe${s.berme.ganz ? ' (ganze Insel)' : `, bis ${f1(s.berme.tiefe)} m ab dem Inselrand`}` +
          (s.berme.hindernisse.length ? `<br>darin: ${esc(s.berme.hindernisse.join(', '))} – nicht erfüllt` : ''), { sticky: true }).addTo(ebene)
      for (const l of schraffur(r)) L.polyline(l.map(ll), { color: '#b45309', weight: 1, opacity: 0.8, interactive: false, pane: OBEN_PANE }).addTo(ebene)
    }
    const fan = (t: KreiselSichtTeil, name: string, farbe: string, ebene: L.LayerGroup) => {
      if (t.dreieckFrei.length > 2) L.polygon(t.dreieckFrei.map(ll), { color: farbe, weight: 1, fillColor: farbe, fillOpacity: 0.15, pane: OBEN_PANE })
        .bindTooltip(`${name}: frei bis ${f1(Math.min(t.vorhanden, t.oben))} m (nötig ${f1(t.A)} m)`, { sticky: true }).addTo(ebene)
      if (t.dreieckVerdeckt.length > 2) L.polygon(t.dreieckVerdeckt.map(ll), { color: VERDECKT_FARBE, weight: 1, fillColor: VERDECKT_FARBE,
        fillOpacity: 0.2, pane: OBEN_PANE }).bindTooltip(`${name}: verdeckt ab ${f1(t.vorhanden)} m${t.verdecker ? ` durch ${esc(t.verdecker.name)}` : ''}`,
          { sticky: true }).addTo(ebene)
    }
    const sid = (art: string) => kreiselSichtId(kn.id, s.arm + '|' + art)
    const ak = sichtGruppe('auto', sid('Ak')), az = sichtGruppe('auto', sid('Az')), vk = sichtGruppe('velo', sid('Velo'))
    fan(s.auto, 'Ak (Motorfahrzeuge)', STATUS_FARBE[s.auto.status], ak)
    // Fahrzeuge wie am Knoten: wartendes Auto F_B bei D, Auto F_A mit Vortritt am Ende von Ak, Velo am Ende seiner Linie, Auto in der
    // Nachbarzufahrt am Ende von Az (alle auf K bzw. den Ring zu)
    const fb = fbLage(z.Dachse, z.rand)
    autoMitSicht(ebenenRef.current!.fahrzeug, fb[0], fb[1], FB_FARBE, '#ffffff', 'F<sub>B</sub>: wartendes Fahrzeug in der Einfahrt, Fahrer*innenauge bei D')
    const fa = kreiselFahrzeug(s.auto.achse, s.auto.A, faLage)
    if (fa) autoMitSicht(ebenenRef.current!.fahrzeug, fa[0], fa[1], FA_FARBE, '#111827', `F<sub>A</sub> auf der Kreiselfahrbahn: Front am Ende von Ak, ${f1(s.auto.A)} m`, () => sichtKlick('auto', sid('Ak')))
    const fv = kreiselFahrzeug(s.velo.achse, s.velo.A, veloLage)
    if (fv) veloMitSicht(ebenenRef.current!.fahrzeug, fv[0], fv[1], VELO_FARBE, '#ffffff', `Velo auf der Kreiselfahrbahn: Vorderrad am Ende der nötigen Sicht, ${s.velo.A} m`, () => sichtKlick('velo', sid('Velo')))
    if (s.az) {
      const fz = kreiselFahrzeug(s.az.achse, s.az.A, faLage)
      if (fz) autoMitSicht(ebenenRef.current!.fahrzeug, fz[0], fz[1], FA_FARBE, '#111827', `Fahrzeug in der Zufahrt links (${esc(s.azLinks ?? '')}): Front am Ende von Az, ` +
        `${s.az.A} m (Vergleichswert)`, () => sichtKlick('auto', sid('Az')))
    }
    fan(s.velo, 'Velo', VELO_FARBE, vk)
    if (s.az) {
      L.polyline(s.az.achse.map(ll), { color: STATUS_FARBE[s.az.status], weight: 2, dashArray: '8 5', pane: OBEN_PANE })
        .bindTooltip(`Az zur Zufahrt links (${esc(s.azLinks ?? '')}), Vergleichswert: vorhanden ${f1(s.az.vorhanden)} m, Regelfall ${s.az.A} m, ` +
          `Minimal ${s.az.minimal} m`, { sticky: true }).addTo(az)
      if (s.az.dreieckVerdeckt.length > 2) L.polygon(s.az.dreieckVerdeckt.map(ll), { color: VERDECKT_FARBE, weight: 1, fillColor: VERDECKT_FARBE,
        fillOpacity: 0.15, pane: OBEN_PANE }).addTo(az)
    }
  }


  const sichtGruppe = (art: SichtArt, id: string): L.FeatureGroup => {
    const g = L.featureGroup().on('click', e => { if (!werkzeugAktiv()) { L.DomEvent.stopPropagation(e); sichtKlick(art, id) } })
    if (sichtZeigen(sicht, art, id)) g.addTo(ebenenRef.current!.sicht)
    return g
  }

  // Arme des gewählten Knotens (Klick: Zufahrt wählen), Ergebnis: Sichtdreiecke, Achsen, D, K, verdeckende Gebäude
  useEffect(() => {
    const eb = ebenenRef.current
    if (!eb) return
    eb.sicht.clearLayers(); eb.arme.clearLayers(); eb.fahrzeug.clearLayers()
    for (const art of ['auto', 'velo', 'trottoir', 'ueberholen'] as const) {
      eb[art] = L.featureGroup()
      if (sichtZeigen(sicht, art)) eb[art].addTo(eb.sicht)
    }
    schilderRef.current = []
    const kn = rechnung?.knoten
    if (!kn) { namenAbgleich(); return }
    if (kn.kreisel) { kreiselZeichnen(kn, eb.arme); namenAbgleich(); return }
    const z = rechnung?.ergebnis?.zufahrt ?? zufahrt
    const vortritt = rechnung?.ergebnis?.vortritt ?? kn.vortritt
    // Rechtsvortritt (E3c): Vortritt vor der Zufahrt hat nur der Arm rechts davon
    const rvRechts = rechnung?.ergebnis?.rechtsvortritt ? rechnung.ergebnis.rechtsvortritt.arm.rechts : undefined
    const e = rechnung?.ergebnis
    for (const a of kn.arme) {
      const istZ = a.key === z, istV = rvRechts !== undefined ? a.key === rvRechts : vortritt?.includes(a.key)
      const linie = L.polyline([ll(kn.p), ll(add(kn.p, a.richtung, ARM_KARTE_M))], { color: istZ ? ZUFAHRT_FARBE : istV ? '#e2e8f0' : '#94a3b8',
        weight: istZ ? 7 : 5, opacity: 0.85, pane: OBEN_PANE })
      // Nummernschild am Anfang des Arms (über den Armen, Tooltip und Klick wie der Arm); Grundstückzufahrt «Z» am Zufahrtspunkt
      const zp = kn.grundstueck && istZ ? e?.zufahrtspunkt ?? null : null
      const lage = (abstand: number) => nrLage(kn, a, zp?.eingabe, abstand)
      const schild = L.marker(ll(lage(schildAbstand())), { icon: nrIcon(a, istZ), pane: SCHILD_PANE,
        keyboard: false, zIndexOffset: 1000, bubblingMouseEvents: true })
      // Grundstückzufahrt: Arme ab dem Knotenpunkt, keine Wahl der Zufahrt
      if (kn.grundstueck) {
        const tip = `${esc(armText(a))}${istZ ? '' : ' – vortrittsberechtigt'}${osmTagZeile(a.wid, cb.current.osmTags)}`
        linie.bindTooltip(tip, { sticky: true })
        schild.bindTooltip(zp ? `${tip}<br>Zufahrtspunkt (geklickt${zp.weg !== null ? `, OSM-Weg ${zp.weg}` : ''}), Richtung ` +
          `${zp.herkunft ? ZUFAHRT_HERKUNFT[zp.herkunft] : zp.gezeichnet ? 'gezeichnet' : zp.weg !== null ? 'entlang des Wegs' : 'senkrecht zum Rand'}${zp.winkel != null ? `, ${f1(zp.winkel)}°` : ''}` : tip)
      } else {
        const tip = `${esc(armText(a))}${istZ ? ' – Zufahrt' : istV ? (rvRechts !== undefined ?
          ' – von rechts (Rechtsvortritt)' : ' – vortrittsberechtigt') : ''}${osmTagZeile(a.wid, cb.current.osmTags)}<br><i>Klick: als Zufahrt wählen</i>`
        const waehlen = (ev: L.LeafletEvent) => { if (werkzeugAktiv()) return; L.DomEvent.stopPropagation(ev); cb.current.onZufahrt(a.key) }
        linie.bindTooltip(tip, { sticky: true }).on('click', waehlen)
        schild.bindTooltip(tip).on('click', waehlen)
      }
      linie.addTo(eb.arme)
      schild.addTo(eb.arme)
      schilderRef.current.push({ m: schild, lage })
    }
    namenAbgleich()
    // Gewählter LSA-Knoten mit Kennzeichnung
    if (kn.lsa) L.marker(ll(kn.p), { icon: L.divIcon({ className: 'lsa-marke', iconSize: [0, 0], html: '<span>LSA</span>' }), pane: OBEN_PANE,
      keyboard: false, interactive: false }).addTo(eb.arme)
    if (!e) return
    // Rechtsvortritt, schmale Zufahrt (Abb. 5, Konstruktion nach bfu BM.021 Abb. 4; Block 5): Pfad von D über den Schnitt der Achsen
    // auf den rechten Arm (strichpunktiert), Fächer der Sichtlinien von D zu seinen Punkten; frei dünn grau, verdeckt rot, die erste
    // verdeckte dick
    const m = e.rechtsvortritt?.arm.sichtfeld
    if (m) {
      const ziel = sichtGruppe('auto', richtungSichtId(e, { richtung: 'rechts' }))
      L.polyline(m.pfad.map(ll), { color: '#111827', weight: 1.5, dashArray: '8 3 2 3', interactive: false, pane: OBEN_PANE }).addTo(ziel)
      for (const l of m.linien.filter(x => x.frei))
        L.polyline([ll(m.D), ll(l.p)], { color: '#64748b', weight: 1, opacity: 0.45, interactive: false }).addTo(ziel)
      for (const l of m.linien.filter(x => !x.frei)) {
        const erste = !!m.erste && l.s === m.erste.s
        L.polyline([ll(m.D), ll(l.p)], { color: VERDECKT_FARBE, weight: erste ? 4 : 2, opacity: 0.9, pane: OBEN_PANE })
          .bindTooltip(`Abb. 5: Sichtlinie zum Punkt bei ${f1(l.s)} m Pfadlänge (${f1(l.sRechts)} m auf dem rechten Arm) verdeckt` +
            `${l.verdecker ? ` durch ${esc(l.verdecker)}` : ''}${erste ? ' (erste verdeckte)' : ''}`, { sticky: true }).addTo(ziel)
      }
      for (const l of m.linien)
        L.circleMarker(ll(l.p), { radius: 2, color: '#111827', weight: 1, fillColor: '#ffffff', fillOpacity: 1, interactive: false, pane: OBEN_PANE })
          .addTo(ziel)
    }
    for (const r of e.richtungen) {
      const id = richtungSichtId(e, r), ziel = { auto: sichtGruppe('auto', id), velo: sichtGruppe('velo', id), ueberholen: sichtGruppe('ueberholen', id) }
      const name = `${lageNach(r)} (${esc(r.strasse)})`
      // Motorfahrzeuge; ohne Verkehr von dieser Seite nur das Velo (E4: Velo gegen die Einbahn)
      if (r.status !== 'keine_zufahrt') {
        if (r.dreieckFrei.length >= 3)
          L.polygon(r.dreieckFrei.map(ll), { color: FREI_FARBE, weight: 1, fillColor: FREI_FARBE, fillOpacity: 0.3 })
            .bindTooltip(`Sichtdreieck ${name}: frei bis ${f1(Math.min(r.vorhanden, r.massgebend))} m`, { sticky: true }).addTo(ziel.auto)
        if (r.dreieckVerdeckt.length >= 3)
          L.polygon(r.dreieckVerdeckt.map(ll), { color: VERDECKT_FARBE, weight: 1, fillColor: VERDECKT_FARBE, fillOpacity: 0.3 })
            .bindTooltip(`Sichtdreieck ${name}: verdeckt ab ${f1(r.vorhanden)} m (erforderlich ${r.massgebend} m)`, { sticky: true }).addTo(ziel.auto)
        L.polyline(r.achse.map(ll), { color: ACHSE_FARBE, weight: 2, dashArray: '6 5', interactive: false, pane: OBEN_PANE }).addTo(ziel.auto)
        // Überholfall (Block 5, Ziffer 6): zweites Sichtdreieck auf den Gegenfahrstreifen, schwächer und gestrichelt
        const u = r.ueberholfall
        if (u) {
          if (u.dreieckFrei.length >= 3)
            L.polygon(u.dreieckFrei.map(ll), { color: FREI_FARBE, weight: 1, dashArray: '2 4', fillColor: FREI_FARBE, fillOpacity: 0.1 })
              .bindTooltip(`Überholfall ${name} (Sichtlinie S' auf den Gegenfahrstreifen): frei bis ${f1(Math.min(u.vorhanden, u.A))} m ` +
                `(erforderlich ${u.A} m)`, { sticky: true }).addTo(ziel.ueberholen)
          if (u.dreieckVerdeckt.length >= 3)
            L.polygon(u.dreieckVerdeckt.map(ll), { color: VERDECKT_FARBE, weight: 1, dashArray: '2 4', fillColor: VERDECKT_FARBE, fillOpacity: 0.15 })
              .bindTooltip(`Überholfall ${name}: verdeckt ab ${f1(u.vorhanden)} m (erforderlich ${u.A} m)`, { sticky: true }).addTo(ziel.ueberholen)
          L.polyline(u.achse.map(ll), { color: ACHSE_FARBE, weight: 1, dashArray: '2 5', opacity: 0.8, interactive: false, pane: OBEN_PANE })
            .addTo(ziel.ueberholen)
        }
        // Fläche, die die Sichtweite begrenzt: innerhalb von A in der Liste der Verdecker (unten, rot); verdeckt sie erst
        // ausserhalb von A, orange
        if (r.verdecker && !r.verdeckerListe.some(t => t.id === r.verdecker!.id)) {
          const innen = r.dreieckVerdeckt.length >= 3, farbe = innen ? VERDECKT_FARBE : SPAETER_FARBE
          L.polygon(r.verdecker.ring.map(ll), { color: innen ? '#7f1d1d' : '#9a3412', weight: 2, fillColor: farbe, fillOpacity: 0.55 })
            .bindTooltip(`${esc(verdeckerName(r.verdecker))}: verdeckt ${name} ab rund ${f1(r.vorhanden)} m` +
              (innen ? '' : `, erst nach der erforderlichen Sichtweite (${r.massgebend} m)`), { sticky: true }).addTo(ziel.auto)
        }
        // Ende der massgebenden Sichtweite A auf der Achse
        const iA = Math.min(r.massgebend, r.sichtpunkte.length - 1)
        if (iA > 0) L.circleMarker(ll(r.sichtpunkte[iA]), { radius: 4, color: '#111827', weight: 1.5, fillColor: STATUS_FARBE[r.status], fillOpacity: 1,
          pane: OBEN_PANE })
          .bindTooltip(`Ende der erforderlichen Sichtweite (A) ${name}: ${r.massgebend} m`).addTo(ziel.auto)
        // FA: vortrittsberechtigtes Fahrzeug mit der Front am Ende von A, auf K zu fahrend
        const fa = faAnzeige(r.faHand, r.sichtpunkte, iA), h = r.faHand
        if (fa) autoMitSicht(eb.fahrzeug, fa[0], fa[1], FA_FARBE, h ? '#f59e0b' : '#111827', h ?
          `F<sub>A</sub> ${name} von Hand: Front ${f1(h.abstandK)} m ab K, ${f1(h.seitlich)} m neben der Fahrstreifenachse<br><i>Status und Sichtdreieck bleiben auf der Fahrstreifenachse</i>` :
          `F<sub>A</sub> ${name}: Front am Ende der erforderlichen Sichtweite, ${r.massgebend} m`, () => sichtKlick('auto', id))
        if (h) L.polyline([ll(e.D), ll(h.front)], { color: h.verdecker ? VERDECKT_FARBE : FREI_FARBE, weight: 2, dashArray: '3 5', pane: OBEN_PANE })
          .bindTooltip(`Sichtlinie von D auf F<sub>A</sub> von Hand: ${h.verdecker ? `verdeckt durch ${esc(h.verdecker)}` : 'frei'}`, { sticky: true }).addTo(eb.fahrzeug)
        if (fa && fahrzeugeBearbeiten && !werkzeug && !knotenWerkzeug) {
          const [m, u] = [fa[0], einheit(fa[1])], zeige = vorschauZeichnen(eb.fahrzeug)
          griffZeichnen(eb.fahrzeug, m, 'schieben', `F<sub>A</sub> ${name} verschieben`, q => zeige(autoUmriss(q, u)),
            q => cb.current.onFaHand(r.richtung, { mitte: q, richtung: u }))
          griffZeichnen(eb.fahrzeug, add(m, u, PW_LAENGE_M / 2 + GRIFF_VOR_FRONT_M), 'drehen', `F<sub>A</sub> ${name} drehen`,
            q => zeige(autoUmriss(m, einheit(sub(q, m)))), q => cb.current.onFaHand(r.richtung, { mitte: m, richtung: einheit(sub(q, m)) }), m)
        }
      }
      // Velo (E3b): Sichtdreieck Türkis gestrichelt, Fläche schwach; verdeckter Teil rot gestrichelt; Velo am Ende von A
      const v = r.velo
      if (v) {
        const vn = `Velo ${name}`
        if (v.dreieckFrei.length >= 3)
          L.polygon(v.dreieckFrei.map(ll), { color: VELO_FARBE, weight: 2, dashArray: '6 4', fillColor: VELO_FARBE, fillOpacity: 0.08 })
            .bindTooltip(`Sichtdreieck ${vn}: frei bis ${f1(Math.min(v.vorhanden, v.A))} m (erforderlich ${v.A} m)`, { sticky: true }).addTo(ziel.velo)
        if (v.dreieckVerdeckt.length >= 3)
          L.polygon(v.dreieckVerdeckt.map(ll), { color: VERDECKT_FARBE, weight: 2, dashArray: '6 4', fillColor: VERDECKT_FARBE, fillOpacity: 0.12 })
            .bindTooltip(`Sichtdreieck ${vn}: verdeckt ab ${f1(v.vorhanden)} m (erforderlich ${v.A} m)`, { sticky: true }).addTo(ziel.velo)
        L.polyline(v.achse.map(ll), { color: VELO_FARBE, weight: 2, dashArray: '3 4', interactive: false, pane: OBEN_PANE }).addTo(ziel.velo)
        const iV = Math.min(v.A, v.sichtpunkte.length - 1)
        const vl = veloLage(v.sichtpunkte, iV)
        if (vl) veloMitSicht(eb.fahrzeug, vl[0], vl[1], VELO_FARBE, v.veloHand ? '#f59e0b' : '#ffffff',
          `Velo ${name}: Vorderrad am Ende der erforderlichen Sichtweite, ${v.A} m${v.veloHand ? '; Veloachse von Hand versetzt' : ''}`, () => sichtKlick('velo', id))
        // Velo seitlich verschieben (Veloachse von Hand): nur der Anteil quer zur Achse zählt
        if (vl && fahrzeugeBearbeiten && !werkzeug && !knotenWerkzeug && v.achse.length >= 2) {
          const [m, u] = vl, zeige = vorschauZeichnen(eb.fahrzeug), quer = rechts(u)
          const seit = (q: P) => dot(sub(q, m), quer)
          griffZeichnen(eb.fahrzeug, m, 'schieben', `Velo ${name} seitlich verschieben (Veloachse)`, q => zeige(veloTeile(add(m, quer, seit(q)), u).flat()),
            q => cb.current.onVeloHand(r.richtung, (v.veloHand?.versatz ?? 0) + lageAnAchse(v.achse, add(m, quer, seit(q))).seitlich))
        }
      }
    }
    // K je geprüfte Richtung als beschrifteter Punkt wie D
    for (const k of kreuzungspunkte(e))
      L.marker(ll(k.p), { icon: L.divIcon({ className: 'k-punkt', iconSize: [12, 12], html: `<span>${k.text}</span>` }), pane: OBEN_PANE,
        keyboard: false, zIndexOffset: 800 }).bindTooltip(esc(k.tooltip)).addTo(eb.auto)
    // Trottoir (E3b): zwei kleine Dreiecke von D' zu den Trottoirpunkten (Bernstein), Zufussgehende am Ende von A
    const tp = e.trottoirPruefung
    if (tp) {
      for (const t of tp.richtungen) {
        const id = richtungSichtId(e, t), ziel = sichtGruppe('trottoir', id)
        const tn = `Trottoir ${lageWort(t)}`
        if (t.dreieckFrei.length >= 3)
          L.polygon(t.dreieckFrei.map(ll), { color: TROTTOIR_FARBE, weight: 1.5, fillColor: TROTTOIR_FARBE, fillOpacity: 0.25 })
            .bindTooltip(`Sichtdreieck ${tn}: frei bis ${f1(Math.min(t.vorhanden, t.A))} m (erforderlich ${t.A} m)`, { sticky: true }).addTo(ziel)
        if (t.dreieckVerdeckt.length >= 3)
          L.polygon(t.dreieckVerdeckt.map(ll), { color: VERDECKT_FARBE, weight: 1.5, fillColor: VERDECKT_FARBE, fillOpacity: 0.25 })
            .bindTooltip(`Sichtdreieck ${tn}: verdeckt ab ${f1(t.vorhanden)} m (erforderlich ${t.A} m)`, { sticky: true }).addTo(ziel)
        L.polyline(t.achse.map(ll), { color: TROTTOIR_FARBE, weight: 1.5, dashArray: '2 4', interactive: false, pane: OBEN_PANE }).addTo(ziel)
        const iT = Math.min(t.A, t.sichtpunkte.length - 1)
        if (iT > 0) {
          L.circleMarker(ll(t.sichtpunkte[iT]), { radius: 7, color: TROTTOIR_FARBE, weight: 3, fill: false, pane: OBEN_PANE, interactive: false })
            .addTo(eb.fahrzeug)
          L.circleMarker(ll(t.sichtpunkte[iT]), { radius: 3, color: '#111827', weight: 1, fillColor: STATUS_FARBE[t.status], fillOpacity: 1, pane: OBEN_PANE })
            .bindTooltip(`Zufussgehende ${tn}: am Ende der erforderlichen Sichtweite, ${t.A} m; Klick: Trottoirsicht ein-/ausblenden`)
            .on('click', e => { if (!werkzeugAktiv()) { L.DomEvent.stopPropagation(e); sichtKlick('trottoir', id) } }).addTo(eb.fahrzeug)
        }
      }
      // Trottoirüberfahrt (K0): D' zum Ziehen wie D (D' von Hand); sonst fester Punkt
      const dtHand = e.trottoirueberfahrt?.DtrottoirQuelle === 'hand'
      if (tp.gehlinie) L.marker(ll(tp.D), { draggable: !(werkzeug || knotenWerkzeug), keyboard: false, pane: D_PANE, zIndexOffset: 900,
        bubblingMouseEvents: true, icon: L.divIcon({ className: dtHand ? 'd-punkt dstrich hand' : 'd-punkt dstrich', iconSize: [14, 14],
          html: "<span>D'</span>" }) })
        .bindTooltip(dtHand ? "Beobachtungspunkt D' der Phase Trottoir von Hand<br><i>ziehen: verschieben; im Panel zurücksetzen</i>" :
          "Beobachtungspunkt D' der Phase Trottoir (B 3,00 m hinter dem hinteren Rand der Trottoirüberfahrt, VSS 40 273 Ziffer 13.2)" +
          "<br><i>ziehen: D' von Hand</i>")
        .on('dragend', (ev: L.LeafletEvent) => { const g = (ev.target as L.Marker).getLatLng(); cb.current.onDtrottoir(lv95(g.lat, g.lng)) })
        .addTo(eb.sicht)
      else L.circleMarker(ll(tp.D), { radius: 5, color: '#111827', weight: 2, fillColor: TROTTOIR_FARBE, fillOpacity: 1, pane: OBEN_PANE })
        .bindTooltip("Beobachtungspunkt D' für das Trottoir (B 3,00 m hinter der Trottoirhinterkante, VSS 40 273 Ziffer 13.2)").addTo(eb.sicht)
    }
    // Trottoirüberfahrt (K0): Band vom vorderen Rand (Bordkante) zum hinteren Rand auf der Zufahrtsachse, Querlinie am hinteren Rand
    const tue = e.trottoirueberfahrt
    if (tue) {
      const t = einheit(sub(tue.hinterkante, tue.vorderkante))
      const text = `Trottoirüberfahrt, Breite ${f2(tue.breite)} m (${TUE_BREITE_KURZ[tue.breiteQuelle]})`
      L.polyline([tue.vorderkante, tue.hinterkante].map(ll), { color: TROTTOIR_FARBE, weight: 6, opacity: 0.8, pane: OBEN_PANE })
        .bindTooltip(text, { sticky: true }).addTo(eb.sicht)
      if (t[0] || t[1]) L.polyline(querlinie(tue.hinterkante, t, 2).map(ll), { color: '#111827', weight: 2, dashArray: '4 3', pane: OBEN_PANE })
        .bindTooltip(`hinterer Rand der Trottoirüberfahrt: Nullpunkt der Phase Trottoir (D' = B ${f2(B_INNERORTS_M)} m dahinter, VSS 40 273 ` +
          'Ziffer 13.2)', { sticky: true })
        .addTo(eb.sicht)
    }
    L.polyline(e.zufahrtAchse.map(ll), { color: ZUFAHRT_FARBE, weight: 2, dashArray: '6 5', interactive: false, pane: OBEN_PANE }).addTo(eb.sicht)
    // Halte- oder Wartelinie (E2b, Feld haltelinie): Querlinie an der Vorderkante, weiss mit dunklem Rand
    if (e.haltelinie) {
      const h = e.haltelinie, q = h.quer.map(ll)
      const text = `Halte- oder Wartelinie (Vorderkante: Beginn von B), ${f1(Math.abs(h.abstand))} m ${h.abstand >= 0 ? 'hinter' : 'vor'} der Kante${h.vorverlegt ? ' (vorverlegt)' : ''}`
      L.polyline(q, { color: '#111827', weight: 8, opacity: 0.9, pane: OBEN_PANE, interactive: false }).addTo(eb.sicht)
      L.polyline(q, { color: HALTELINIE_FARBE, weight: 5, opacity: 1, pane: OBEN_PANE }).bindTooltip(text, { sticky: true }).addTo(eb.sicht)
      if (halteBearbeiten && !werkzeug && !knotenWerkzeug) {
        const halb = dist(h.quer[0], h.quer[1]) / 2, zeige = vorschauZeichnen(eb.sicht)
        const linie = (m: P, r: P): P[] => [add(m, r, -halb), add(m, r, halb)]
        griffZeichnen(eb.sicht, h.mitte, 'schieben', 'Halte- oder Wartelinie verschieben', x => zeige(linie(x, h.richtung)), x => cb.current.onHaltelinie(x, h.richtung))
        griffZeichnen(eb.sicht, add(h.mitte, h.richtung, halb + GRIFF_VOR_FRONT_M), 'drehen', 'Halte- oder Wartelinie drehen',
          x => zeige(linie(h.mitte, einheit(sub(x, h.mitte)))), x => cb.current.onHaltelinie(h.mitte, einheit(sub(x, h.mitte))), h.mitte)
      }
    }
    L.circleMarker(ll(e.rand), { radius: 3, color: ZUFAHRT_FARBE, weight: 2, fillColor: '#ffffff', fillOpacity: 1, pane: OBEN_PANE })
      .bindTooltip(`Kante des Fahrstreifens mit Vortritt${dist(e.rand, e.nullpunkt) < 0.05 ? ' (Beginn der Beobachtungsdistanz B)' : ''}`).addTo(eb.sicht)
    if (e.trottoir && !e.trottoirueberfahrt && dist(e.trottoir.hinterkante, e.nullpunkt) >= 0.05)
      L.circleMarker(ll(e.trottoir.hinterkante), { radius: 3, color: '#64748b', weight: 2, fillColor: '#ffffff', fillOpacity: 1, pane: OBEN_PANE })
        .bindTooltip(`Trottoirhinterkante (AV), Trottoir ${f1(e.trottoir.breite)} m`).addTo(eb.sicht)
    if (dist(e.rand, e.nullpunkt) >= 0.05)
      L.circleMarker(ll(e.nullpunkt), { radius: 4, color: '#111827', weight: 2, fillColor: ZUFAHRT_FARBE, fillOpacity: 1, pane: OBEN_PANE })
        .bindTooltip(`Beginn der Beobachtungsdistanz B: ${esc(e.nullpunktText)}`).addTo(eb.sicht)
    // Zufahrtspunkt einer Grundstückzufahrt (geklickt): das Schild «Z» bei den Armen
    // FB: vortrittsbelastetes Fahrzeug auf der Zufahrt, Lenker (D) 2,0 m hinter der Front; folgt D von Hand. Velo gegen die Einbahn
    // auf der Zufahrt (E4): F_B als Velo (schwarz wie das Auto F_B, weiss umrandet), der velofahrende Person bei D
    const fbA = e.fbDachse ?? e.Dachse
    if (e.zufahrtVelo) {
      const fv = fbVeloLage(fbA, add(fbA, e.fbRichtung))
      veloMitSicht(eb.fahrzeug, fv[0], fv[1], FB_FARBE, '#ffffff',
        `F<sub>B</sub>: Velo gegen die Einbahn, velofahrende Person bei D`)
    } else {
      const fb = fbLage(fbA, add(fbA, e.fbRichtung))
      autoMitSicht(eb.fahrzeug, fb[0], fb[1], FB_FARBE, e.fbHand ? '#f59e0b' : '#ffffff',
        `F<sub>B</sub>: wartendes Fahrzeug, Fahrer*innenauge bei D${e.fbHand ? ', von Hand gedreht' : ''}<br><i>Verschieben und drehen: Block Zufahrt, «Fahrzeuge anpassen»</i>`)
    }
    // D zum Ziehen (E2b): D von Hand; nicht, solange ein Werkzeug aktiv ist
    const aktiv = !!(werkzeug || knotenWerkzeug)
    // F_B drehen: Griff vor der Front, Drehpunkt D (das Auge bleibt, wo es ist)
    if (fahrzeugeBearbeiten && !aktiv) {
      const seite = dist(e.D, fbA), zeige = vorschauZeichnen(eb.fahrzeug), fbR = einheit(e.fbRichtung)
      const umriss = (r: P, d = e.D) => { const a = add(d, rechts(r), seite); return e.zufahrtVelo ? autoUmriss(...fbVeloLage(a, add(a, r)), VELO_LAENGE_M, VELO_BREITE_M) : autoUmriss(...fbLage(a, add(a, r))) }
      // Seitlich verschieben nimmt die Zufahrtsachse mit, längs bleibt B (nur der Anteil quer zur Achse zählt); ein D von Hand geht
      // dabei in den Versatz über. Griff im Heck, damit er D nicht zudeckt
      const schiebGriff = add(e.D, fbR, -FB_GRIFF_HINTER_D_M), quer = rechts(lageAnAchse(e.zufahrtAchse, e.D).t)
      const seit = (q: P) => dot(sub(q, schiebGriff), quer)
      griffZeichnen(eb.fahrzeug, schiebGriff, 'schieben', 'F<sub>B</sub> seitlich verschieben (mit der Zufahrtsachse)', q => zeige(umriss(fbR, add(e.D, quer, seit(q)))),
        q => cb.current.onFbVersatz((e.zufahrtVersatz ?? 0) + e.Dlage.seitlich - (e.zufahrtVelo ? 0 : FAHRERSITZ_M) + seit(q)))
      griffZeichnen(eb.fahrzeug, add(e.D, fbR, LENKER_VOR_FRONT_M + GRIFF_VOR_FRONT_M), 'drehen', 'F<sub>B</sub> um D drehen',
        q => zeige(umriss(einheit(sub(q, e.D)))), q => cb.current.onFbRichtung(einheit(sub(q, e.D))), e.D)
    }
    // bubblingMouseEvents: bei aktivem Werkzeug geht ein Klick auf D an die Karte (Haltelinie bzw. Zufahrt setzen)
    L.marker(ll(e.D), { draggable: !aktiv, keyboard: false, pane: D_PANE, zIndexOffset: 1000, bubblingMouseEvents: true,
      icon: L.divIcon({ className: e.Dhand ? 'd-punkt hand' : 'd-punkt', iconSize: [16, 16], html: '<span>D</span>' }) })
      .bindTooltip(e.Dhand ? `Beobachtungspunkt D von Hand<br><i>ziehen: verschieben; im Panel zurücksetzen</i>` :
        `Beobachtungspunkt D (${e.zufahrtVelo ? 'velofahrende Person' : 'Fahrer*innensitz'})<br><i>ziehen: D von Hand</i>`)
      .on('dragend', (ev: L.LeafletEvent) => { const g = (ev.target as L.Marker).getLatLng(); cb.current.onD(lv95(g.lat, g.lng)) })
      .addTo(eb.sicht)
  }, [rechnung, zufahrt, werkzeug, knotenWerkzeug, sicht, fahrzeugeBearbeiten, halteBearbeiten])

  // Hindernisse (Eingaben), Vorschläge (gestrichelt), amtliche Parkfelder (durchgezogen nach Klasse, verworfene gepunktet);
  // Klick wählt (Panel: bearbeiten, verwerfen, bestätigen); beim Bearbeiten Ecken ziehen
  useEffect(() => {
    const eb = ebenenRef.current
    if (!eb) return
    eb.hind.clearLayers()
    const ks = rechnung?.knoten?.kreisel?.sicht ?? null
    const stand = rechnung?.ergebnis?.hindernis ?? ks?.hindernis
    // Tooltip-Zusatz: verdeckt in welcher Richtung ab wo (am Kreisel je Teil: Ak, Velo, Az)
    const verdeckt = new Map<string, string[]>()
    const eintragen = (liste: VerdeckerEintrag[], wofuer: string) => { for (const t of liste)
      verdeckt.set(t.id, [...(verdeckt.get(t.id) ?? []), `${t.wirkung === 'hinweis' ? 'im Sichtfeld' : 'verdeckt'} für ${wofuer} ab ${f1(t.sErst)} m` +
        (t.wirkung === 'palisade' ? ' (Palisade)' : t.wirkung === 'hinweis' ? ' (nur Hinweis)' : '')]) }
    for (const r of rechnung?.ergebnis?.richtungen ?? []) eintragen(r.verdeckerListe, lageText(r))
    if (ks) { eintragen(ks.auto.verdeckerListe, 'Ak'); if (ks.az) eintragen(ks.az.verdeckerListe, 'Az') }
    for (const id of ks?.berme.ids ?? []) verdeckt.set(id, [...(verdeckt.get(id) ?? []), 'liegt in der Sichtberme: nicht erfüllt'])
    const zusatz = (id: string) => (verdeckt.get(id) ?? []).map(t => `<br>${esc(t)}`).join('')
    const klick = (id: string) => (e: L.LeafletMouseEvent) => { if (werkzeugAktiv()) return; L.DomEvent.stopPropagation(e); cb.current.onHindernis(id) }
    for (const h of hindernisse) {
      const farbe = hindernisFarbe(h)
      const aus = (h.art === 'hecke' || h.art === 'mauer' || h.art === 'uebrige') && !h.sichtbehindernd
      hindernisEbene(h, { color: farbe, weight: h.id === bearbeiten ? 4 : 2, fillColor: farbe, fillOpacity: aus ? 0.1 : 0.4, opacity: aus ? 0.6 : 1 })
        .bindTooltip(esc(hindernisText(h)) + (aus ? ' – nicht sichtbehindernd' : '') + zusatz(h.id) + '<br><i>Klick: wählen</i>', { sticky: true })
        .on('click', klick(h.id)).addTo(eb.hind)
    }
    for (const v of stand?.vorschlaege ?? []) {
      const farbe = hindernisFarbe(v.hindernis)
      hindernisEbene(v.hindernis, { color: farbe, weight: v.id === bearbeiten ? 4 : 2, dashArray: STRICH_VORSCHLAG, fillColor: farbe, fillOpacity: 0.12 })
        .bindTooltip(`Vorschlag: ${esc(v.hindernis.name ?? 'Hindernis')}<br>${esc(v.grund)}<br><i>Klick: wählen, im Panel bestätigen oder verwerfen</i>`,
          { sticky: true })
        .on('click', klick(v.id)).addTo(eb.hind)
    }
    for (const v of stand?.amtlich ?? []) {
      const farbe = hindernisFarbe(v.hindernis)
      hindernisEbene(v.hindernis, { color: farbe, weight: v.id === bearbeiten ? 4 : 1.5, fillColor: farbe, fillOpacity: 0.35 })
        .bindTooltip(`${esc(hindernisText(v.hindernis))}${zusatz(v.id)}<br><i>Klick: wählen, im Panel verwerfen</i>`, { sticky: true })
        .on('click', klick(v.id)).addTo(eb.hind)
    }
    for (const v of stand?.amtlichVerworfen ?? []) {
      const farbe = hindernisFarbe(v.hindernis)
      hindernisEbene(v.hindernis, { color: farbe, weight: v.id === bearbeiten ? 3 : 1.5, dashArray: STRICH_VERWORFEN, opacity: 0.6, fillColor: farbe,
        fillOpacity: 0.05 })
        .bindTooltip(`${esc(v.hindernis.name ?? 'Parkfeld')} – verworfen, zählt nicht<br><i>Klick: wählen, im Panel wieder zählen</i>`, { sticky: true })
        .on('click', klick(v.id)).addTo(eb.hind)
    }
    // Ecken des bearbeiteten Hindernisses verschieben
    const h = hindernisse.find(x => x.id === bearbeiten)
    if (h) {
      const pts = h.art === 'parkfeld' ? h.ring : h.art === 'baum' ? [h.p] : h.art === 'laengsparkierung' || h.art === 'zaun' ? h.linie : h.ring ?? h.linie ?? []
      pts.forEach((p, i) => {
        L.marker(ll(p), { draggable: true, icon: L.divIcon({ className: 'ecke', iconSize: [12, 12] }) })
          .on('dragend', (e: L.LeafletEvent) => { const g = (e.target as L.Marker).getLatLng(); cb.current.onEcke(h.id, i, lv95(g.lat, g.lng)) })
          .addTo(eb.hind)
      })
    }
  }, [hindernisse, rechnung, bearbeiten])

  // Verdecker im Sichtdreieck (bis A) hervorheben: voll rot, Palisade gelb, Hinweis violett gestrichelt
  useEffect(() => {
    const eb = ebenenRef.current
    if (!eb) return
    eb.treffer.clearLayers()
    const treffer = (rechnung?.ergebnis?.richtungen ?? []).flatMap(r => [
      ...(sichtZeigen(sicht, 'auto', richtungSichtId(rechnung!.ergebnis!, r)) ? r.verdeckerListe : []),
      ...(sichtZeigen(sicht, 'velo', richtungSichtId(rechnung!.ergebnis!, r)) ? r.velo?.verdeckerListe ?? [] : []),
      ...(sichtZeigen(sicht, 'ueberholen', richtungSichtId(rechnung!.ergebnis!, r)) ? r.ueberholfall?.verdeckerListe ?? [] : []),
    ])
    for (const t of rechnung?.ergebnis?.trottoirPruefung?.richtungen ?? []) if (sichtZeigen(sicht, 'trottoir', richtungSichtId(rechnung!.ergebnis!, t))) treffer.push(...t.verdeckerListe)
    for (const t of treffer) {
      const farbe = TREFFER_FARBE[t.wirkung], gebaeude = t.quelle === 'AV'
      L.polygon(t.ring.map(ll), { color: t.wirkung === 'voll' ? '#7f1d1d' : farbe, weight: 3, dashArray: t.wirkung === 'hinweis' ? '4 3' : undefined,
        fillColor: farbe, fillOpacity: gebaeude ? 0.55 : 0.2, interactive: gebaeude, pane: TREFFER_PANE })
        .bindTooltip(`${esc(verdeckerName(t))}: ${t.wirkung === 'hinweis' ? 'im Sichtfeld' : 'verdeckt'} ab ${f1(t.sErst)} m` +
          (t.wirkung === 'palisade' ? ' (Palisade)' : t.wirkung === 'hinweis' ? ' (nur Hinweis)' : ''), { sticky: true }).addTo(eb.treffer)
    }
    // Massnahmen (E3a): gewähltes Hindernis hervorheben und in die Karte holen
    if (hervor && hervor.length >= 3) {
      L.polygon(hervor.map(ll), { color: HERVOR_FARBE, weight: 5, dashArray: '6 4', fill: false, interactive: false, pane: TREFFER_PANE })
        .addTo(eb.treffer)
      const map = kartenRef.current, b = L.latLngBounds(hervor.map(ll))
      if (map && !map.getBounds().contains(b)) map.panTo(b.getCenter())
    }
  }, [rechnung, hervor, sicht])

  // Zeichnung in Arbeit; Zufahrt setzen: erster Klick (wartet auf die Richtung)
  useEffect(() => {
    const eb = ebenenRef.current
    if (!eb) return
    eb.zeichnen.clearLayers()
    if (zufahrtErster)
      L.circleMarker(ll(zufahrtErster), { radius: 6, color: ZUFAHRTSPUNKT_FARBE, weight: 3, dashArray: '3 3', fillColor: '#ffffff', fillOpacity: 1,
        interactive: false }).addTo(eb.zeichnen)
    if (!zeichnung.length) return
    L.polyline(zeichnung.map(ll), { color: '#f43f5e', weight: 2, dashArray: '3 3', interactive: false }).addTo(eb.zeichnen)
    for (const p of zeichnung) L.circleMarker(ll(p), { radius: 4, color: '#f43f5e', fillColor: '#ffffff', fillOpacity: 1, interactive: false }).addTo(eb.zeichnen)
  }, [zeichnung, zufahrtErster])

  // Vorschau gehört ausschliesslich zum aktiven Setzwerkzeug, nie zu einem bestehenden Knoten.
  useEffect(() => {
    const eb = ebenenRef.current
    if (!eb) return
    eb.zufahrtVorschau.clearLayers()
    const v = props.zufahrtVorschau
    if (knotenWerkzeug !== 'zufahrt' || !v) return
    const g = v.geo, p = v.eingabe.p, r = g.richtung, t = strassenRichtung(einheit(v.basis.strassenRichtung))
    const ende = add(p, r, 12), achse = g.weg === null ? [g.kp, ende] : g.zMl(20)
    const winkel = zufahrtWinkel(g.strassenRichtung, r)
    const gruppe = eb.zufahrtVorschau
    const pfeil = (a: P, u: P, farbe: string) => {
      const q: P = [-u[1], u[0]], spitze = add(a, u, 2)
      L.polyline([add(a, q, 0.8), spitze, add(a, q, -0.8)].map(ll), { color: farbe, weight: 3, interactive: false, pane: D_PANE }).addTo(gruppe)
    }
    L.polyline([add(v.basis.kp, t, -14), add(v.basis.kp, t, 14)].map(ll), { color: '#475569', weight: 3, dashArray: '5 4', interactive: false, pane: D_PANE }).addTo(gruppe)
    pfeil(add(v.basis.kp, t, 12), t, '#475569')
    L.marker(ll(add(v.basis.kp, t, 16)), { interactive: false, pane: D_PANE,
      icon: L.divIcon({ className: 'zufahrt-winkel-label', html: '0°', iconSize: [30, 22] }) }).addTo(gruppe)
    L.polyline(achse.map(ll), { color: '#f59e0b', weight: 4, dashArray: '7 4', interactive: false, pane: D_PANE }).addTo(gruppe)
    pfeil(add(p, r, 9), r, '#b45309')
    const griff = L.marker(ll(ende), { draggable: true, keyboard: true, bubblingMouseEvents: false, pane: D_PANE,
      icon: L.divIcon({ className: 'zufahrt-richtungsgriff', html: '<span>↔</span>', iconSize: [26, 26], iconAnchor: [13, 13] }) })
      .bindTooltip(`Richtung ins Grundstück: ${f1(winkel)}°. Ziehen: Winkel wählen; danach «Zufahrt übernehmen».`, { permanent: true, direction: 'top' })
      .on('click', e => L.DomEvent.stopPropagation(e))
      .on('dragend', (e: L.LeafletEvent) => { const x = (e.target as L.Marker).getLatLng(); cb.current.onZufahrtRichtung?.(lv95(x.lat, x.lng)) })
      .addTo(gruppe)
    // Fahrzeug fährt aus dem Grundstück auf die Strasse; Achsenpfeil bezeichnet die Gegenrichtung ins Grundstück.
    autoZeichnen(gruppe, add(p, r, 5), [-r[0], -r[1]], FB_FARBE, '#ffffff', 'Vorschau: Fahrzeug fährt zur Strasse')
    return () => { griff.remove(); gruppe.clearLayers() }
  }, [props.zufahrtVorschau, knotenWerkzeug])

  useEffect(() => {
    const eb = ebenenRef.current
    if (!eb) return
    eb.masse.clearLayers()
    if (!sicht.masse) return
    const da = new Set<string>()
    for (const m of swcSichtMasse(rechnung?.ergebnis ?? null, rechnung?.knoten ?? null)) {
      if (!sichtMassZeigen(sicht, m)) continue
      const key = JSON.stringify([m.text, m.p, m.linien]); if (da.has(key)) continue; da.add(key)
      for (const l of m.linien) {
        L.polyline(l.map(ll), { color: '#ffffff', weight: 4, interactive: false, pane: Q_PROFIL_PANE }).addTo(eb.masse)
        L.polyline(l.map(ll), { color: '#111827', weight: 1.3, ...(m.rolle === 'bezug' ? { dashArray: '6 5' } : {}), interactive: false, pane: Q_PROFIL_PANE }).addTo(eb.masse)
      }
      L.marker(ll(m.p), { interactive: false, keyboard: false, pane: Q_WERT_PANE, title: m.hinweis,
        icon: L.divIcon({ className: 'sicht-mass', html: esc(m.text), iconSize: [0, 0], iconAnchor: [0, 20] }) }).addTo(eb.masse)
    }
  }, [rechnung, sicht])

  const ortWaehlen = (o: Ort) => kartenRef.current?.setView([o.lat, o.lon], ortZoom(o.art))
  const hinweise = [props.hinweis, standortHinweis].filter((h): h is KartenHinweis => !!h)
  // Kartenhöhe auf dem Smartphone (seit 28.10.2026, wie VeloroutenCheck): Knopf ▾/▴ schaltet 30 → 45 → 70 % der Fensterhöhe; nur
  // unter 700 px sichtbar (index.css .karte-hoehe; vorher fest 60 %, dem Panel blieben bei 375 × 812 px rund 325 px). Der Browser
  // merkt sich die Stufe (nur Bequemlichkeit).
  const [stufe, setStufe] = useState(() => {
    try { const v = Number(localStorage.getItem('swc.karteStufe')); return KARTE_STUFEN.includes(v) ? v : 45 } catch { return 45 }
  })
  const stufeWeiter = () => setStufe(v => {
    const neu = KARTE_STUFEN[(KARTE_STUFEN.indexOf(v) + 1) % KARTE_STUFEN.length]
    try { localStorage.setItem('swc.karteStufe', String(neu)) } catch { /* ohne Speicher: nur für diese Sitzung */ }
    return neu
  })
  useEffect(() => {
    const raf = requestAnimationFrame(() => kartenRef.current?.invalidateSize())
    return () => cancelAnimationFrame(raf)
  }, [stufe, kartenRef])
  // Geladene Quellen zeichnen: Linien mit dunklem Rand, Flächen, Punkte als Quadrate mit Zeichen; ab BESCHRIFT_ZOOM der Wert
  useEffect(() => {
    const g = quellenRef.current
    if (!g) return
    g.clearLayers()
    const daten = props.quellenEbenen ?? {}
    const profilId = standardProfil((daten.gelaende ?? []).flatMap(o => o.hoehenprofil ? [o.hoehenprofil] : []), profilAuswahl)?.id
    const aktiv: { o: EbenenObjekt; farbe: string; symbol: string }[] = []
    for (const def of EBENEN) if (def.id !== 'av' && qAn.has(def.id))
      for (const o of def.id === 'gelaende' ? profilObjekteWaehlen(daten.gelaende ?? [], profilAuswahl, alleGelaendeProfile) : daten[def.id] ?? [])
        aktiv.push({ o, farbe: ebenenFarbe(def, o.klasse), symbol: ebenenSymbol(def, o.klasse) })
    const marke = (p: P, text: string, farbe: string) => L.marker(ll(p), { pane: Q_WERT_PANE, interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'q-wert', iconSize: [0, 0], html: `<span style="border-color:${farbe}">${esc(text)}</span>` }) }).addTo(g)
    for (const { o, farbe, symbol } of aktiv) {
      if (o.ringe) L.polygon(o.ringe.map(r => r.map(ll)), { pane: Q_FLAECHE_PANE, interactive: false, color: farbe, weight: 1.5, fillColor: farbe, fillOpacity: o.deckkraft ?? 0.3 }).addTo(g)
      if (o.linien) {
        const lls = o.linien.map(l => l.map(ll))
        L.polyline(lls, { pane: o.profil ? Q_PROFIL_PANE : Q_PANE, interactive: false, color: o.profil ? '#ffffff' : '#111827', weight: o.profil ? 10 : 7, opacity: o.profil ? 1 : 0.75 }).addTo(g)
        L.polyline(lls, { pane: o.profil ? Q_PROFIL_PANE : Q_PANE, interactive: false, color: farbe, weight: o.profil ? 5 : 4, opacity: 1, ...(o.profil ? { dashArray: '9 5' } : o.gestrichelt ? { dashArray: '6 6' } : {}) }).addTo(g)
        if (o.profil) for (const l of o.linien) for (const p of [l[0], l[l.length - 1]]) L.circleMarker(ll(p), { pane: Q_PROFIL_PANE, radius: 4, color: farbe, weight: 2, fillColor: '#ffffff', fillOpacity: 1, interactive: false }).addTo(g)
        if ((o.profil || qZoom >= BESCHRIFT_ZOOM) && o.wert) { const l = o.linien.reduce((a, b) => (b.length > a.length ? b : a)); marke(l[l.length >> 1], o.profil ? `Profil ${o.wert}` : o.wert, farbe) }
        if (o.hoehenprofil && o.hoehenprofil.id === profilId) {
          L.polyline(lls, { pane: Q_PROFIL_PANE, interactive: false, color: '#ffffff', weight: 11 }).addTo(g)
          L.polyline(lls, { pane: Q_PROFIL_PANE, interactive: false, color: '#0369a1', weight: 5 }).addTo(g)
        }
      }
      if (o.punkt) {
        L.marker(ll(o.punkt), { pane: Q_PANE, interactive: false, keyboard: false,
          icon: L.divIcon({ className: 'q-punkt', iconSize: [18, 18], html: `<span style="background:${farbe}">${esc(symbol)}</span>` }) }).addTo(g)
        if (qZoom >= BESCHRIFT_ZOOM && o.wert) marke(o.punkt, o.wert, farbe)
      }
    }
    const abst = (p: P, l: P[]) => {
      let d = Infinity
      for (let i = 1; i < l.length; i++) {
        const a = l[i - 1], b = l[i], vx = b[0] - a[0], vy = b[1] - a[1], q = vx * vx + vy * vy
        const t = q ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / q)) : 0
        d = Math.min(d, Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy))
      }
      return d
    }
    const innen = (p: P, r: P[]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) c = !c } return c }
    qTrefferRef.current = aktiv.length ? (p, tol) => {
      let best: { d: number; t: string } | null = null
      const nimm = (d: number, t: string) => { if (d <= tol && (!best || d < best.d)) best = { d, t } }
      for (const { o } of aktiv) if (o.punkt) nimm(Math.hypot(p[0] - o.punkt[0], p[1] - o.punkt[1]) * 0.7, o.text)
      if (best) return (best as { t: string }).t
      for (const { o } of aktiv) for (const l of o.linien ?? []) nimm(abst(p, l), o.text)
      if (best) return (best as { t: string }).t
      for (const { o } of aktiv) if (o.ringe?.[0] && innen(p, o.ringe[0])) return o.text
      return null
    } : null
  }, [props.quellenEbenen, qAn, qZoom, profilAuswahl, alleGelaendeProfile])

  return (
    <div className="kartenrahmen" style={{ '--karte-h': `${stufe}dvh` } as CSSProperties}>
      <div ref={elRef} className="karte" />
      <button type="button" className="karte-hoehe" onClick={stufeWeiter}
              aria-label={`Kartenhöhe ${stufe} % – ${stufe === 70 ? 'kleiner' : 'grösser'}`}
              title={`Karte ${stufe === 70 ? 'kleiner' : 'grösser'} (jetzt ${stufe} % der Höhe)`}>
        {stufe === 70 ? '▴' : '▾'}
      </button>
      <button type="button" className={'q-knopf' + (qOffen ? ' offen' : '')} aria-expanded={qOffen} onClick={() => setQOffen(o => !o)}
              title="Kartenebenen zeigen: geladene Daten auf der Karte">
        Kartenebenen{(() => { const k = (hk.an ? 1 : 0) + ebenenSichtbar(props.quellenEbenen ?? {}).zeigen.filter(e => e.id === 'av' ? avAn && (props.quellenEbenen?.av ?? []).some(o => avArten.has(o.klasse)) : qAn.has(e.id)).length; return k ? ` (${k})` : '' })()} ▴
      </button>
      {qOffen && (() => {
        const { zeigen, ohne, laedt, fehler } = ebenenSichtbar(props.quellenEbenen ?? {})
        return (
          <div className="q-fenster" role="group" aria-label="Kartenebenen" ref={qFensterRef}
               style={qPos ? { left: qPos.x, top: qPos.y, bottom: 'auto', maxHeight: `calc(100% - ${qPos.y + 10}px)` } : undefined}>
            <div className="q-kopf" onPointerDown={qZiehen} title="An dieser Zeile ziehen, um das Fenster zu verschieben (Doppelklick: zurück an den Ursprung)"
                 onDoubleClick={() => { setQPos(null); try { localStorage.removeItem('swc.quellenPos') } catch { /* egal */ } }}>
              <span><span className="griff" aria-hidden="true">⠿</span> Kartenebenen</span>
              <button type="button" onClick={() => setQOffen(false)} aria-label="Schliessen">×</button>
            </div>
            {[...zeigen.map(e => ({ id: e.id as string, titel: e.titel })), { id: 'hoehenkurven', titel: hk.titel }].sort((a,b)=>a.titel.localeCompare(b.titel,'de-CH')).map(eintrag => {
              if (eintrag.id === 'hoehenkurven') return <HoehenkurvenWahl key={eintrag.id} an={hk.an} setzen={hk.setzen} stand={hk.stand} klasse="q-ebene" />
              const e = zeigen.find(e => e.id === eintrag.id)!
              return e.id === 'av' ? <AvEbenenWahl key={e.id} quelle={e.quelle} objekte={props.quellenEbenen?.av ?? []}
              an={avAn} setzen={setAvAn} arten={avArten} artSetzen={avArtSetzen} /> : (
              <EbenenGruppe key={e.id} mitProfil={e.id === 'gelaende'} titel={e.titel}><label className="q-ebene" title={e.quelle}>
                <input type="checkbox" checked={qAn.has(e.id)} onChange={x => qSchalten(e.id, x.target.checked)} />
                <span><b>{e.titel}</b> <small className="zahl">{(props.quellenEbenen?.[e.id] ?? []).length} im Ausschnitt</small><small>{e.quelle}</small>
                  {qAn.has(e.id) && <span className="q-legende">{e.legende.map(([k, farbe, text, symbol]) => <span key={k}>{symbol ? <i className="sym" style={{ background: farbe }}>{symbol}</i> : <i style={{ background: farbe }} />}{text}</span>)}</span>}
                </span>
              </label>
              {e.id === 'gelaende' && <HoehenprofilAnsicht profile={(props.quellenEbenen?.gelaende ?? []).flatMap(o => o.hoehenprofil ? [o.hoehenprofil] : [])}
                onAuswahl={id => { setProfilAuswahl(id); if (id) qSchalten('gelaende', true) }} kartenAlle={alleGelaendeProfile}
                onKartenAlle={an => { setAlleGelaendeProfile(an); if (an) qSchalten('gelaende', true) }} />}
              </EbenenGruppe>
            )})}
            {laedt.length > 0 && <p className="q-fuss" role="status">Lädt: {laedt.map(e => e.titel).join(', ')}.</p>}
            {fehler.length > 0 && <p className="q-fuss" role="status">Fehler beim Laden: {fehler.map(e => e.titel).join(', ')}. Einzelheiten unter «Datenquellen und Ladezustand».</p>}
            {ohne.length > 0 && <p className="q-fuss">Ohne Daten im Ausschnitt: {ohne.map(e => e.titel).join(', ')}.</p>}
            <p className="q-fuss">Gezeigt wird, was beim Laden gelesen wurde; ab Zoomstufe {BESCHRIFT_ZOOM} mit dem Wert. Überfahren zeigt die Angaben.</p>
          </div>
        )
      })()}
      <div className="kartenkopf">
        <Ortssuche onOrt={ortWaehlen} />
        {hinweise.map(h => (
          <div key={h.text} className={'kartenhinweis' + (h.fehler ? ' fehler' : '')} role="status">
            {h.text}
            {h.erneut && <>{' '}<button className="zweit klein" onClick={h.erneut}>erneut suchen</button></>}
          </div>
        ))}
      </div>
    </div>
  )
}
