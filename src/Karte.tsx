import { useEffect, useRef, useState, type CSSProperties } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { AvFlaeche } from './daten/av'
import type { OsmKnoten, Strassenname } from './daten/osm'
import type { Rechnung, ArmInfo } from './rechner/typen'
import { armText, nrLage, NR_ABSTAND_M } from './rechner/knoten'
import { lageNach, lageText, lageWort } from './rechner/lage'
import { wgs, lv95, add, dist, sub, einheit, type P } from './geo'
import { querlinie, B_INNERORTS_M } from './rechner/beobachtung'
import { TUE_BREITE_KURZ, f2 } from './texte'
import { hindernisRing, artText, quelleText, type Hindernis } from './rechner/hindernisse'
import { abschneiden as abschneidenM } from './rechner/netz'
import Ortssuche from './Ortssuche'
import { ortZoom, type Ort } from './daten/ortssuche'
import { autoUmriss, autoScheibe, fbLage, fbVeloLage, faLage, veloLage } from './rechner/fahrzeug'

// Unterbau aus fgsCheck (Karte.tsx): Hintergründe, Standort, Strassennamen, Ortssuche, Hinweise. Neu in E0: Knoten statt
// Übergänge, Arme zum Wählen der Zufahrt, Beobachtungspunkt D, Sichtdreiecke, Fahrstreifenachsen, verdeckende Gebäude.
// E2a aus fgsCheck: Zeichenwerkzeuge (Klick setzt Punkte, Doppelklick schliesst, Fadenkreuz), Hindernisse und Vorschläge,
// Ecken ziehen; neu: Verdecker im Sichtdreieck hervorgehoben (voll rot, Palisade gelb, Hinweis violett gestrichelt).
// E3b: Velo-Sichtdreieck (Petrol gestrichelt), Veloachse und Velosymbol am Ende von A; Trottoir: Dreiecke von D' zu den
// Trottoirpunkten (Bernstein), Fussgänger (Punkt mit Ring) am Ende von A, D'.
// E2b: Werkzeuge «Haltelinie setzen» und «Zufahrt setzen» (Grundstückzufahrt, zweiter Klick zeichnet die Richtung), D zum
// Ziehen (D von Hand), Haltelinie als Querlinie, Nullpunkt von B, Zufahrtspunkt.

// AV-Farben wie fgsCheck (Gebäude neutral dunkelgrau, damit Rot für «verdeckt» bleibt)
export const AV_FARBEN: Record<string, string> = {
  Strasse_Weg: '#6e6e6e',
  Trottoir: '#e6e6c8',
  Verkehrsinsel: '#96c878',
  Gebaeude: '#3f3f46',
}
const AV_DECKKRAFT: Record<string, number> = { Strasse_Weg: 0.25, Trottoir: 0.45, Verkehrsinsel: 0.6, Gebaeude: 0.5 }
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
/** E3b: Velo-Prüfung (Petrol, wie VeloroutenCheck) und Trottoir-Prüfung (Bernstein, wie fgsCheck) */
export const VELO_FARBE = '#0f766e'
export const TROTTOIR_FARBE = '#d97706'
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
export type KnotenWerkzeug = null | 'haltelinie' | 'zufahrt' | 'd'      // 'd': Beobachtungspunkt D mit Klick setzen (E4, Befund 17.10.)
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
export const HERVOR_FARBE = '#06b6d4'
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
const markerStil = (g: boolean): L.CircleMarkerOptions => ({
  radius: g ? 9 : 6, color: g ? '#0f172a' : '#ffffff', weight: g ? 3 : 2, fillColor: KNOTEN_FARBE, fillOpacity: 0.95, pane: OBEN_PANE,
})
/** Nummernschild eines Arms (divIcon, Klasse arm-nr; gewählte Zufahrt gefüllt) */
export const nrIcon = (a: Pick<ArmInfo, 'nr'>, gewaehlt: boolean): L.DivIcon =>
  L.divIcon({ className: gewaehlt ? 'arm-nr gewaehlt' : 'arm-nr', iconSize: [22, 22], html: `<span>${esc(a.nr)}</span>` })
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
const f1 = (x: number) => x.toFixed(1).replace('.', ',')
/** Verdecker im Tooltip: Name ohne Quelle in Klammern am Schluss; Art davor, wenn der Name sie nicht schon nennt */
function verdeckerName(v: { art: string; name: string }): string {
  const name = v.name.replace(/\s*\([^()]*\)\s*$/, '') || v.name
  return name === v.art || v.name === 'Gebäude (AV)' ? v.art : name.split(' ')[0] === v.art.split(' ')[0] ? name : `${v.art}: ${name}`
}

/** Auto von oben als zwei Polygone (Umriss, Scheibe) mit Tooltip */
function autoZeichnen(ebene: L.LayerGroup, mitte: P, richtung: P, farbe: string, rand: string, tooltip: string): void {
  L.polygon(autoUmriss(mitte, richtung).map(ll), { color: rand, weight: 1.5, fillColor: farbe, fillOpacity: 0.9, pane: OBEN_PANE })
    .bindTooltip(tooltip, { sticky: true }).addTo(ebene)
  L.polygon(autoScheibe(mitte, richtung).map(ll), { color: SCHEIBE_FARBE, weight: 1, fillColor: SCHEIBE_FARBE, fillOpacity: 0.9,
    interactive: false, pane: OBEN_PANE }).addTo(ebene)
}

/** Velo als Piktogramm fester Grösse (Vogelperspektive, in Fahrtrichtung gedreht): das Velo von 1,8 × 0,6 m wäre als Polygon bei
 *  Zoom 18 nur wenige Pixel gross und ging unter dem D-Punkt unter. Länge VELO_SYMBOL_PX, Breite ein Drittel davon. */
const VELO_SYMBOL_PX = 34
function veloZeichnen(ebene: L.LayerGroup, mitte: P, richtung: P, farbe: string, rand: string, tooltip: string): void {
  const n = Math.hypot(richtung[0], richtung[1]) || 1
  // Bildschirm: x nach Osten, y nach Süden; CSS-Drehung im Uhrzeigersinn
  const grad = Math.atan2(-richtung[1] / n, richtung[0] / n) * 180 / Math.PI
  const w = VELO_SYMBOL_PX, h = Math.round(VELO_SYMBOL_PX / 3)
  // Vogelperspektive, Fahrt nach rechts: Hinterrad, Rahmen, Vorderrad, Lenker quer, Kopf des Fahrers
  const html = `<svg viewBox="0 0 60 20" width="${w}" height="${h}" style="display:block;overflow:visible;transform:rotate(${grad}deg)">` +
    `<rect x="2" y="7" width="20" height="6" rx="3" fill="${farbe}" stroke="${rand}" stroke-width="1.5"/>` +
    `<rect x="38" y="7" width="20" height="6" rx="3" fill="${farbe}" stroke="${rand}" stroke-width="1.5"/>` +
    `<rect x="18" y="8.5" width="24" height="3" fill="${farbe}" stroke="${rand}" stroke-width="1"/>` +
    `<rect x="40" y="1" width="3" height="18" rx="1.5" fill="${farbe}" stroke="${rand}" stroke-width="1"/>` +
    `<circle cx="27" cy="10" r="5" fill="${farbe}" stroke="${rand}" stroke-width="1.5"/></svg>`
  L.marker(ll(mitte), { icon: L.divIcon({ className: 'velo-symbol', html, iconSize: [w, h], iconAnchor: [w / 2, h / 2] }),
    pane: OBEN_PANE, keyboard: false }).bindTooltip(tooltip, { sticky: true }).addTo(ebene)
}

const KARTE_STUFEN = [30, 45, 70]   // Kartenhöhe auf dem Smartphone in % der Fensterhöhe

/** Schlüssel der zuletzt gesehenen Kartenansicht im Browser (nur Bequemlichkeit, darf fehlen) */
const ANSICHT_SCHLUESSEL = 'sichtweitencheck.karteAnsicht'

export default function Karte(props: {
  mitte: [number, number]
  av: AvFlaeche[] | null
  kantone: string[]
  knoten: OsmKnoten[]
  strassennamen: Strassenname[]
  gewaehlt: number | null
  rechnung: Rechnung | null
  zufahrt: string | null
  hindernisse: Hindernis[]                           // Eingaben des Falls (von Hand, bestätigte Vorschläge)
  werkzeug: Werkzeug
  knotenWerkzeug: KnotenWerkzeug                     // E2b: Haltelinie bzw. Zufahrt setzen
  zufahrtErster: P | null                            // Zufahrt setzen: erster Klick (wartet auf die Richtung)
  zeichnung: P[]
  bearbeiten: string | null                          // Id des gewählten bzw. bearbeiteten Hindernisses (Ecken ziehen)
  hervor?: P[] | null                                // Massnahmen (E3a): Umriss eines Hindernisses hervorheben
  onKnoten: (k: OsmKnoten) => void
  onZufahrt: (key: string) => void
  onKlick: (p: P) => void
  onKnotenKlick: (p: P) => void                      // Klick mit einem Werkzeug zum Knoten
  onD: (p: P) => void                                // D gezogen (D von Hand)
  onDtrottoir: (p: P) => void                        // D' der Phase Trottoir gezogen (K0, D' von Hand)
  onDoppelklick: () => void
  onEcke: (id: string, i: number, p: P) => void
  onHindernis: (id: string) => void
  onAusschnitt: () => void                           // nach jedem Verschieben bzw. Zoomen (moveend)
  hinweis: KartenHinweis | null
  kartenRef: React.MutableRefObject<L.Map | null>
}) {
  const { mitte, av, kantone, knoten, strassennamen, gewaehlt, rechnung, zufahrt, hindernisse, werkzeug, knotenWerkzeug, zufahrtErster,
    zeichnung, bearbeiten, kartenRef, hervor = null } = props
  /** ein Werkzeug ist aktiv: Klicks auf Knoten, Arme und Hindernisse gehen an das Werkzeug */
  const werkzeugAktiv = () => !!(cb.current.werkzeug || cb.current.knotenWerkzeug)
  const elRef = useRef<HTMLDivElement>(null)
  const ebenenRef = useRef<Record<string, L.LayerGroup> | null>(null)
  const cb = useRef(props)
  cb.current = props
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
    map.createPane(TREFFER_PANE).style.zIndex = '420'
    map.createPane(OBEN_PANE).style.zIndex = '430'
    map.createPane(D_PANE).style.zIndex = '460'
    const eb: Record<string, L.LayerGroup> = {
      av: L.layerGroup().addTo(map), sicht: L.layerGroup().addTo(map), hind: L.layerGroup().addTo(map), treffer: L.layerGroup().addTo(map),
      arme: L.layerGroup().addTo(map), knoten: L.layerGroup().addTo(map), namen: L.layerGroup().addTo(map), standort: L.layerGroup().addTo(map),
      zeichnen: L.layerGroup().addTo(map),
    }
    L.control.layers({ 'Luftbild (SWISSIMAGE)': luftbild, 'Landeskarte (swisstopo)': landeskarte }, { 'Amtliche Vermessung': eb.av,
      'Knoten (OSM)': eb.knoten, 'Strassennamen (OSM)': eb.namen, 'Sichtdreiecke': eb.sicht, 'Hindernisse': eb.hind,
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
    ebenenRef.current = eb
    return () => { map.remove(); kartenRef.current = null; ebenenRef.current = null }
  }, [mitte, kartenRef])

  useEffect(() => {
    const el = elRef.current
    if (el) el.style.cursor = werkzeug || knotenWerkzeug ? 'crosshair' : ''
  }, [werkzeug, knotenWerkzeug])

  // AV-Bodenbedeckung
  useEffect(() => {
    const map = kartenRef.current, eb = ebenenRef.current
    if (!map || !eb) return
    eb.av.clearLayers()
    if (!av) return
    for (const f of av) {
      const farbe = AV_FARBEN[f.art]
      if (!farbe) continue
      L.polygon(f.ringe.map(r => r.map(ll)), { color: farbe, weight: 1, fillColor: farbe, fillOpacity: AV_DECKKRAFT[f.art] ?? 0.25, interactive: false })
        .addTo(eb.av)
    }
    const text = `Amtliche Vermessung, Kanton ${kantone.join(', ') || '?'}, geodienste.ch`
    map.attributionControl.addAttribution(text)
    return () => { map.attributionControl.removeAttribution(text) }
  }, [av, kantone, kartenRef])

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
      const m = L.circleMarker([k.lat, k.lon], markerStil(k.id === cb.current.gewaehlt))
        .bindTooltip(`<b>OSM-Knoten ${k.id}</b><br><i>Klick: Knoten wählen</i>`)
        .on('click', e => { if (werkzeugAktiv()) return; L.DomEvent.stopPropagation(e); cb.current.onKnoten(k) })
      neu.set(k.id, { k, m })
    }
    for (const { m } of vorher.values()) m.remove()
    markerRef.current = neu
    markerAbgleich()
  }, [knoten])
  useEffect(() => {
    const n = markerRef.current
    for (const id of new Set([gewaehltRef.current, gewaehlt])) {
      const x = id === null ? undefined : n.get(id)
      if (x) x.m.setStyle(markerStil(id === gewaehlt))
    }
    gewaehltRef.current = gewaehlt
    markerAbgleich()
    const x = gewaehlt === null ? undefined : n.get(gewaehlt)
    if (x && ebenenRef.current?.knoten.hasLayer(x.m)) x.m.bringToFront()
  }, [gewaehlt])

  // Arme des gewählten Knotens (Klick: Zufahrt wählen), Ergebnis: Sichtdreiecke, Achsen, D, K, verdeckende Gebäude
  useEffect(() => {
    const eb = ebenenRef.current
    if (!eb) return
    eb.sicht.clearLayers(); eb.arme.clearLayers()
    schilderRef.current = []
    const kn = rechnung?.knoten
    if (!kn) { namenAbgleich(); return }
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
      const schild = L.marker(ll(lage(schildAbstand())), { icon: nrIcon(a, istZ), pane: OBEN_PANE,
        keyboard: false, zIndexOffset: 1000, bubblingMouseEvents: true })
      // Grundstückzufahrt: Arme ab dem Knotenpunkt, keine Wahl der Zufahrt
      if (kn.grundstueck) {
        const tip = `${esc(armText(a))}${istZ ? '' : ' – vortrittsberechtigt'}`
        linie.bindTooltip(tip, { sticky: true })
        schild.bindTooltip(zp ? `${tip}<br>Zufahrtspunkt (geklickt${zp.weg !== null ? `, OSM-Weg ${zp.weg}` : ''}), Richtung ` +
          `${zp.gezeichnet ? 'gezeichnet' : zp.weg !== null ? 'entlang des Wegs' : 'senkrecht zum Rand'}` : tip)
      } else {
        const tip = `${esc(armText(a))}${istZ ? ' – Zufahrt' : istV ? (rvRechts !== undefined ?
          ' – von rechts (Rechtsvortritt)' : ' – vortrittsberechtigt') : ''}<br><i>Klick: als Zufahrt wählen</i>`
        const waehlen = (ev: L.LeafletEvent) => { if (werkzeugAktiv()) return; L.DomEvent.stopPropagation(ev); cb.current.onZufahrt(a.key) }
        linie.bindTooltip(tip, { sticky: true }).on('click', waehlen)
        schild.bindTooltip(tip).on('click', waehlen)
      }
      linie.addTo(eb.arme)
      schild.addTo(eb.arme)
      schilderRef.current.push({ m: schild, lage })
    }
    namenAbgleich()
    if (!e) return
    // Rechtsvortritt, schmale Zufahrt (Abb. 5): Fächer der Sichtlinien zwischen den Punkten beider Fahrbahnachsen; frei dünn grau,
    // verdeckt rot, die erste verdeckte Kombination dick
    const m = e.rechtsvortritt?.arm.paare
    if (m && e.rechtsvortritt?.fahrbahnachsen) {
      for (const ax of e.rechtsvortritt.fahrbahnachsen)
        L.polyline(abschneidenM(ax, m.s[m.s.length - 1]).map(ll), { color: '#111827', weight: 1.5, dashArray: '8 3 2 3', interactive: false,
          pane: OBEN_PANE }).addTo(eb.sicht)
      for (const p of m.paare.filter(x => x.frei))
        L.polyline([ll(m.punkte1[p.i]), ll(m.punkte2[p.j])], { color: '#64748b', weight: 1, opacity: 0.35, interactive: false }).addTo(eb.sicht)
      for (const p of m.paare.filter(x => !x.frei)) {
        const erste = m.erste && m.s[p.i] === m.erste.s1 && m.s[p.j] === m.erste.s2
        L.polyline([ll(m.punkte1[p.i]), ll(m.punkte2[p.j])], { color: VERDECKT_FARBE, weight: erste ? 4 : 2, opacity: 0.9, pane: OBEN_PANE })
          .bindTooltip(`Abb. 5: Sichtlinie ${f1(m.s[p.i])} m (Zufahrt) – ${f1(m.s[p.j])} m (rechter Arm) verdeckt${erste ?
            ' (erste verdeckte Kombination)' : ''}`, { sticky: true }).addTo(eb.sicht)
      }
      for (const q of [...m.punkte1, ...m.punkte2])
        L.circleMarker(ll(q), { radius: 2, color: '#111827', weight: 1, fillColor: '#ffffff', fillOpacity: 1, interactive: false, pane: OBEN_PANE })
          .addTo(eb.sicht)
    }
    for (const r of e.richtungen) {
      const name = `${lageNach(r)} (${esc(r.strasse)})`
      // Motorfahrzeuge; ohne Verkehr von dieser Seite nur das Velo (E4: Velo gegen die Einbahn)
      if (r.status !== 'keine_zufahrt') {
        if (r.dreieckFrei.length >= 3)
          L.polygon(r.dreieckFrei.map(ll), { color: FREI_FARBE, weight: 1, fillColor: FREI_FARBE, fillOpacity: 0.3 })
            .bindTooltip(`Sichtdreieck ${name}: frei bis ${f1(Math.min(r.vorhanden, r.massgebend))} m`, { sticky: true }).addTo(eb.sicht)
        if (r.dreieckVerdeckt.length >= 3)
          L.polygon(r.dreieckVerdeckt.map(ll), { color: VERDECKT_FARBE, weight: 1, fillColor: VERDECKT_FARBE, fillOpacity: 0.3 })
            .bindTooltip(`Sichtdreieck ${name}: verdeckt ab ${f1(r.vorhanden)} m (erforderlich ${r.massgebend} m)`, { sticky: true }).addTo(eb.sicht)
        L.polyline(r.achse.map(ll), { color: ACHSE_FARBE, weight: 2, dashArray: '6 5', interactive: false, pane: OBEN_PANE }).addTo(eb.sicht)
        // Fläche, die die Sichtweite begrenzt: innerhalb von A in der Liste der Verdecker (unten, rot); verdeckt sie erst
        // ausserhalb von A, orange
        if (r.verdecker && !r.verdeckerListe.some(t => t.id === r.verdecker!.id)) {
          const innen = r.dreieckVerdeckt.length >= 3, farbe = innen ? VERDECKT_FARBE : SPAETER_FARBE
          L.polygon(r.verdecker.ring.map(ll), { color: innen ? '#7f1d1d' : '#9a3412', weight: 2, fillColor: farbe, fillOpacity: 0.55 })
            .bindTooltip(`${esc(verdeckerName(r.verdecker))}: verdeckt ${name} ab rund ${f1(r.vorhanden)} m` +
              (innen ? '' : `, erst nach der erforderlichen Sichtweite (${r.massgebend} m)`), { sticky: true }).addTo(eb.sicht)
        }
        L.circleMarker(ll(r.K), { radius: 4, color: '#111827', weight: 1.5, fillColor: '#ffffff', fillOpacity: 1, pane: OBEN_PANE })
          .bindTooltip(`Kreuzungspunkt K ${name}, ${r.spur === 'nah' ? 'nahe' : 'ferne'} Fahrspur`).addTo(eb.sicht)
        // Ende der massgebenden Sichtweite A auf der Achse
        const iA = Math.min(r.massgebend, r.sichtpunkte.length - 1)
        if (iA > 0) L.circleMarker(ll(r.sichtpunkte[iA]), { radius: 4, color: '#111827', weight: 1.5, fillColor: STATUS_FARBE[r.status], fillOpacity: 1,
          pane: OBEN_PANE })
          .bindTooltip(`Ende der erforderlichen Sichtweite (A) ${name}: ${r.massgebend} m`).addTo(eb.sicht)
        // FA: vortrittsberechtigtes Fahrzeug mit der Front am Ende von A, auf K zu fahrend
        const fa = faLage(r.sichtpunkte, iA)
        if (fa) autoZeichnen(eb.sicht, fa[0], fa[1], FA_FARBE, '#111827',
          `F<sub>A</sub> ${name}: Front am Ende der erforderlichen Sichtweite, ${r.massgebend} m`)
      }
      // Velo (E3b): Sichtdreieck Petrol gestrichelt, Fläche schwach; verdeckter Teil rot gestrichelt; Velo am Ende von A
      const v = r.velo
      if (v) {
        const vn = `Velo ${name}`
        if (v.dreieckFrei.length >= 3)
          L.polygon(v.dreieckFrei.map(ll), { color: VELO_FARBE, weight: 2, dashArray: '6 4', fillColor: VELO_FARBE, fillOpacity: 0.08 })
            .bindTooltip(`Sichtdreieck ${vn}: frei bis ${f1(Math.min(v.vorhanden, v.A))} m (erforderlich ${v.A} m)`, { sticky: true }).addTo(eb.sicht)
        if (v.dreieckVerdeckt.length >= 3)
          L.polygon(v.dreieckVerdeckt.map(ll), { color: VERDECKT_FARBE, weight: 2, dashArray: '6 4', fillColor: VERDECKT_FARBE, fillOpacity: 0.12 })
            .bindTooltip(`Sichtdreieck ${vn}: verdeckt ab ${f1(v.vorhanden)} m (erforderlich ${v.A} m)`, { sticky: true }).addTo(eb.sicht)
        L.polyline(v.achse.map(ll), { color: VELO_FARBE, weight: 2, dashArray: '3 4', interactive: false, pane: OBEN_PANE }).addTo(eb.sicht)
        const iV = Math.min(v.A, v.sichtpunkte.length - 1)
        const vl = veloLage(v.sichtpunkte, iV)
        if (vl) veloZeichnen(eb.sicht, vl[0], vl[1], VELO_FARBE, '#ffffff',
          `Velo ${name}: Vorderrad am Ende der erforderlichen Sichtweite, ${v.A} m`)
      }
    }
    // Trottoir (E3b): zwei kleine Dreiecke von D' zu den Trottoirpunkten (Bernstein), Fussgänger am Ende von A
    const tp = e.trottoirPruefung
    if (tp) {
      for (const t of tp.richtungen) {
        const tn = `Trottoir ${lageWort(t)}`
        if (t.dreieckFrei.length >= 3)
          L.polygon(t.dreieckFrei.map(ll), { color: TROTTOIR_FARBE, weight: 1.5, fillColor: TROTTOIR_FARBE, fillOpacity: 0.25 })
            .bindTooltip(`Sichtdreieck ${tn}: frei bis ${f1(Math.min(t.vorhanden, t.A))} m (erforderlich ${t.A} m)`, { sticky: true }).addTo(eb.sicht)
        if (t.dreieckVerdeckt.length >= 3)
          L.polygon(t.dreieckVerdeckt.map(ll), { color: VERDECKT_FARBE, weight: 1.5, fillColor: VERDECKT_FARBE, fillOpacity: 0.25 })
            .bindTooltip(`Sichtdreieck ${tn}: verdeckt ab ${f1(t.vorhanden)} m (erforderlich ${t.A} m)`, { sticky: true }).addTo(eb.sicht)
        L.polyline(t.achse.map(ll), { color: TROTTOIR_FARBE, weight: 1.5, dashArray: '2 4', interactive: false, pane: OBEN_PANE }).addTo(eb.sicht)
        const iT = Math.min(t.A, t.sichtpunkte.length - 1)
        if (iT > 0) {
          L.circleMarker(ll(t.sichtpunkte[iT]), { radius: 7, color: TROTTOIR_FARBE, weight: 3, fill: false, pane: OBEN_PANE, interactive: false })
            .addTo(eb.sicht)
          L.circleMarker(ll(t.sichtpunkte[iT]), { radius: 3, color: '#111827', weight: 1, fillColor: STATUS_FARBE[t.status], fillOpacity: 1, pane: OBEN_PANE })
            .bindTooltip(`Fussgänger ${tn}: am Ende der erforderlichen Sichtweite, ${t.A} m`).addTo(eb.sicht)
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
    // Haltelinie (E2b): Querlinie an der Vorderkante, weiss mit dunklem Rand
    if (e.haltelinie) {
      const h = e.haltelinie, q = h.quer.map(ll)
      const text = `Haltelinie, ${f1(Math.abs(h.abstand))} m ${h.abstand >= 0 ? 'hinter' : 'vor'} der Kante${h.vorverlegt ? ' (vorverlegt)' : ''}`
      L.polyline(q, { color: '#111827', weight: 8, opacity: 0.9, pane: OBEN_PANE, interactive: false }).addTo(eb.sicht)
      L.polyline(q, { color: HALTELINIE_FARBE, weight: 5, opacity: 1, pane: OBEN_PANE }).bindTooltip(text, { sticky: true }).addTo(eb.sicht)
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
    // auf der Zufahrt (E4): F_B als Velo (schwarz wie das Auto F_B, weiss umrandet), der Velofahrer bei D
    if (e.zufahrtVelo) {
      const fv = fbVeloLage(e.Dachse, add(e.Dachse, e.fbRichtung))
      veloZeichnen(eb.sicht, fv[0], fv[1], FB_FARBE, '#ffffff',
        `F<sub>B</sub>: Velo gegen die Einbahn, Velofahrer bei D`)
    } else {
      const fb = fbLage(e.Dachse, add(e.Dachse, e.fbRichtung))
      autoZeichnen(eb.sicht, fb[0], fb[1], FB_FARBE, '#ffffff',
        `F<sub>B</sub>: wartendes Fahrzeug, Lenker bei D`)
    }
    // D zum Ziehen (E2b): D von Hand; nicht, solange ein Werkzeug aktiv ist
    const aktiv = !!(werkzeug || knotenWerkzeug)
    // bubblingMouseEvents: bei aktivem Werkzeug geht ein Klick auf D an die Karte (Haltelinie bzw. Zufahrt setzen)
    L.marker(ll(e.D), { draggable: !aktiv, keyboard: false, pane: D_PANE, zIndexOffset: 1000, bubblingMouseEvents: true,
      icon: L.divIcon({ className: e.Dhand ? 'd-punkt hand' : 'd-punkt', iconSize: [16, 16], html: '<span>D</span>' }) })
      .bindTooltip(e.Dhand ? `Beobachtungspunkt D von Hand<br><i>ziehen: verschieben; im Panel zurücksetzen</i>` :
        `Beobachtungspunkt D (${e.zufahrtVelo ? 'Velofahrer' : 'Fahrersitz'})<br><i>ziehen: D von Hand</i>`)
      .on('dragend', (ev: L.LeafletEvent) => { const g = (ev.target as L.Marker).getLatLng(); cb.current.onD(lv95(g.lat, g.lng)) })
      .addTo(eb.sicht)
  }, [rechnung, zufahrt, werkzeug, knotenWerkzeug])

  // Hindernisse (Eingaben), Vorschläge (gestrichelt), amtliche Parkfelder (durchgezogen nach Klasse, verworfene gepunktet);
  // Klick wählt (Panel: bearbeiten, verwerfen, bestätigen); beim Bearbeiten Ecken ziehen
  useEffect(() => {
    const eb = ebenenRef.current
    if (!eb) return
    eb.hind.clearLayers()
    const stand = rechnung?.ergebnis?.hindernis
    // Tooltip-Zusatz: verdeckt in welcher Richtung ab wo
    const verdeckt = new Map<string, string[]>()
    for (const r of rechnung?.ergebnis?.richtungen ?? []) for (const t of r.verdeckerListe)
      verdeckt.set(t.id, [...(verdeckt.get(t.id) ?? []), `${t.wirkung === 'hinweis' ? 'im Sichtfeld' : 'verdeckt'} für ${lageText(r)} ab ${f1(t.sErst)} m` +
        (t.wirkung === 'palisade' ? ' (Palisade)' : t.wirkung === 'hinweis' ? ' (nur Hinweis)' : '')])
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
    for (const r of rechnung?.ergebnis?.richtungen ?? []) for (const t of r.verdeckerListe) {
      const farbe = TREFFER_FARBE[t.wirkung], gebaeude = t.quelle === 'AV'
      L.polygon(t.ring.map(ll), { color: t.wirkung === 'voll' ? '#7f1d1d' : farbe, weight: 3, dashArray: t.wirkung === 'hinweis' ? '4 3' : undefined,
        fillColor: farbe, fillOpacity: gebaeude ? 0.55 : 0.2, interactive: gebaeude, pane: TREFFER_PANE })
        .bindTooltip(`${esc(verdeckerName(t))}: ${t.wirkung === 'hinweis' ? 'im Sichtfeld' : 'verdeckt'} für ${lageText(r)} ` +
          `ab ${f1(t.sErst)} m` + (t.wirkung === 'palisade' ? ' (Palisade)' : t.wirkung === 'hinweis' ? ' (nur Hinweis)' : ''), { sticky: true })
        .addTo(eb.treffer)
    }
    // Massnahmen (E3a): gewähltes Hindernis hervorheben und in die Karte holen
    if (hervor && hervor.length >= 3) {
      L.polygon(hervor.map(ll), { color: HERVOR_FARBE, weight: 5, dashArray: '6 4', fill: false, interactive: false, pane: TREFFER_PANE })
        .addTo(eb.treffer)
      const map = kartenRef.current, b = L.latLngBounds(hervor.map(ll))
      if (map && !map.getBounds().contains(b)) map.panTo(b.getCenter())
    }
  }, [rechnung, hervor])

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
  return (
    <div className="kartenrahmen" style={{ '--karte-h': `${stufe}dvh` } as CSSProperties}>
      <div ref={elRef} className="karte" />
      <button type="button" className="karte-hoehe" onClick={stufeWeiter}
              aria-label={`Kartenhöhe ${stufe} % – ${stufe === 70 ? 'kleiner' : 'grösser'}`}
              title={`Karte ${stufe === 70 ? 'kleiner' : 'grösser'} (jetzt ${stufe} % der Höhe)`}>
        {stufe === 70 ? '▴' : '▾'}
      </button>
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
