import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MARKE } from './marke'
import type L from 'leaflet'
import Karte, { AV_FARBEN, STATUS_FARBE, KNOTEN_FARBE, FREI_FARBE, VERDECKT_FARBE, SPAETER_FARBE, D_FARBE, D_RAND_FARBE, ZUFAHRT_FARBE,
  FB_FARBE, FA_FARBE, HINDERNIS_FARBE, TREFFER_FARBE, HALTELINIE_FARBE, D_HAND_FARBE, HERVOR_FARBE, hindernisFarbe, hindernisText,
  VELO_FARBE, TROTTOIR_FARBE,
  type KartenHinweis, type Werkzeug, type KnotenWerkzeug } from './Karte'
import { ladeAvRoh, avParsen, type AvFlaeche, type GeoJson } from './daten/av'
import { ladeOsmRoh, ladeOsmUmKnoten, ladeKnoten, overpassSperre, strassennamen, namenKarte, type OsmKnoten,
  type StrassenMitte } from './daten/osm'
import { istAbbruch, type Abruf } from './daten/holen'
import { lv95, wgs, dist, sub, type P } from './geo'
import { richtungStreetView, richtungStreetViewTitel } from './streetview'
import { type Box, type CacheEintrag, enthaelt, abfrageBox, zuGross, imCache, aufnehmen, vereinigen, vereinigenNamen,
  vorrang } from './ausschnitt'
import { KEINE_ALLE_EINGABEN, KEINE_HINDERNISSE, REGELUNGEN, TEMPO_ARTEN, TEMPO_MIN, TEMPO_MAX, type Eingaben, type Ergebnis,
  type HindernisEingaben, type HindernisStand, type Rechnung, type Regelung, type Richtung, type RichtungErgebnis, type StrasseErgebnis,
  type TempoArt, type TempoEingabe, type ZufahrtspunktEingabe, type HoehenVorgabe, type SichtTeil, type TrottoirPruefung,
  type RechtsvortrittErgebnis, type RvArm, type RvStatus, type TempoAmtlichDaten, type TempoAmtlichLinie, type TueErgebnis,
  type TuePhase, type UeberholStand, TUE_BREITE_MIN, TUE_BREITE_MAX } from './rechner/typen'
import { WAHRNEHMBARKEITEN, WAHRNEHMBARKEIT_TEXT, WAHRNEHMBARKEIT_VORGABE, ZUSTAND_TEXT, RV_TEMPO, RV_B_M, RV_A_M,
  RV_A_MIN_M, SCHMAL_M, ENG_LAENGE_M, ENG_SCHRITT_M, type Wahrnehmbarkeit } from './rechner/rechtsvortritt'
import { VELOFUEHRUNGEN, VELOFUEHRUNG_TEXT, TAB3_EBIKE, TAB3_GRENZE, D_VELO_M, RADSTREIFEN_M,
  RADWEG_NAH_M, TROTTOIR_NEIGUNG_AUSLEGUNG, type Velofuehrung } from './rechner/velo'
import { ladeNeigung } from './daten/hoehen'
import { HOEHEN_QUELLE, PROFIL_MIN_M } from './rechner/neigung'
import { HALTELINIE_MIN_M, type Massnahme, type Uebernahme } from './rechner/massnahmen'
import { AV_RADIUS_M, OSM_RADIUS_M, KATASTER_RADIUS_M, avNachladen, REGELUNG_TEXT, TEMPO_ART_TEXT, LSA_TEXT, RV_TEMPO_TEXT } from './rechner/rechnen'
import { zufahrtspunktKey, zufahrtspunktLesen } from './rechner/grundstueck'
import { armText, nachNr, keineZufahrt } from './rechner/knoten'
import { lageText, lageNach } from './rechner/lage'
import { TAB1, ZIEL_FAKTOR, STRASSENTYP_TEXT, UNGUNST_TEXT, NEIGUNG_GROSS_PROZENT, NEIGUNG_EBEN_PROZENT, SCHWERVERKEHR_PROZENT,
  UNGUNST_MASSE_TEXT, ZWISCHENWERT_TEXT, neigungLesen, type Strassentyp, type Ungunst } from './rechner/sichtweite'
import { ANHALTESICHT_STUFEN, ANHALTESICHT_I_MIN } from './rechner/anhaltesicht'
import { FAHRERSITZ_M, B_INNERORTS_M, TROTTOIR_BIS_M, TROTTOIR_MAX_M } from './rechner/beobachtung'
import { D_MFZ_M } from './rechner/hauptachsen'
import { Anleitung, Datenschutz, Fusszeile, RechnungGrundlagen, DatenQuellen, QuellenTabelle, BegriffeListe, BegriffText } from './Hilfe'
import { RegelUebersicht } from './RegelUebersicht'
import { f1, f2, fi, STATUS_TEXT, rvStatusText, RV_STATUS_TEXT, STATUS_TEXT_TEIL, TUE_BREITE_KURZ, tuePhaseText } from './texte'
import Bericht from './Bericht'
import Info from './Info'
import Trenner from './Trenner'
import { ladeBreite } from './panelbreite'
import type { QuellenStand } from './berichtbild'
import { type Fall, leererFall, fallMerken, fallErinnern, fallErinnernZufahrt, fallLesen, fallSchreiben, eingabenZahl, eingabenGesetzt,
  ergebnisAuszug, BEGRUENDUNG_MAX } from './fall'
import { parkQuelleFuer, istParkId, type ParkQuelle, type KatasterFeld } from './daten/parkkataster'
import { baumQuelleFuer, type BaumQuelle, type KatasterBaum } from './daten/baumkataster'
import { ladeVsigBern, bernZustaendig, vsigRechnung, VSIG_QUELLENANGABE } from './daten/vsig'
import { TUE_GEHLINIE_M, TUE_BREITE_ANNAHME_M } from './rechner/trottoirueberfahrt'
import { BAUM_STAMM_M, LAENGS_BREITE_M, LINIE_PUFFER_M, KLASSE_TEXT, type Hindernis, type ParkKlasse } from './rechner/hindernisse'
import { PALISADE_MIN_M } from './rechner/sicht'

/** geladene Daten: OSM und AV um ort (LV95, Mitte des AV-Ausschnitts); nid: OSM-Knoten (null beim Laden um einen Zufahrtspunkt) */
interface Daten { osm: unknown; av: GeoJson; nid: number | null; ort: P; avRadius: number }
/** was geladen wird: Knoten aus der Karte bzw. der Fall-Datei, OSM-Id aus der Adresse, Zufahrtspunkt (Grundstückzufahrt) */
type Wahl = OsmKnoten | number | { zufahrtspunkt: P }
/** was gerechnet wird: Knoten und Zufahrt bzw. Zufahrtspunkt (aus dem Fall) */
interface Ziel { knoten: number | null; zufahrt: string | null; zufahrtspunkt: ZufahrtspunktEingabe | null }

// Startansicht: Beispielknoten Hallerstrasse / Alpeneggstrasse, Bern (OSM-Knoten 30949365, Startseite: ?knoten=30949365)
const START: [number, number] = [46.95456, 7.43811]
const WORKER_MS = 30000
// Knotensuche nach dem Verschieben bzw. Zoomen wie die Übergangssuche im fgsCheck: ab SUCHE_ZOOM, SUCHE_PAUSE_MS nach dem
// letzten moveend, zwischen zwei Abfragen mindestens SUCHE_ABSTAND_MS (Overpass Fair Use)
const SUCHE_ZOOM = 16
const SUCHE_PAUSE_MS = 800
const SUCHE_ABSTAND_MS = 2000
const SUCHE_NAME = 'OSM-Knoten und Strassennamen im Ausschnitt'
const ZU_WEIT: KartenHinweis = { text: 'Zum Suchen näher heranzoomen' }
const AV_NAME_KARTE: Record<string, string> = { Strasse_Weg: 'Fahrbahn', Gebaeude: 'Gebäude' }

const RV_STATUS_FARBE: Record<RvStatus, string> = { erfuellt: STATUS_FARBE.erfuellt, bedingt: STATUS_FARBE.massgebend,
  nicht_erfuellt: STATUS_FARBE.nicht_erfuellt, keine: STATUS_FARBE.keine_zufahrt }
// ---------------------------------------------------------------- Hindernisse (E2a, Werkzeuge aus fgsCheck)
const WERKZEUGE: [Exclude<Werkzeug, null>, string, string][] = [
  ['parkfeld', 'Parkfeld', 'Ecken anklicken, Doppelklick schliesst'],
  ['laengs', 'Längsparkierung', 'Mittellinie der Parkierung zeichnen, Doppelklick beendet'],
  ['baum', 'Baum', `Stamm anklicken (Kreis ${String(BAUM_STAMM_M).replace('.', ',')} m)`],
  ['hecke', 'Hecke', 'Linie zeichnen, Doppelklick beendet'],
  ['mauer', 'Mauer', 'Linie zeichnen, Doppelklick beendet'],
  ['zaun', 'Zaun', 'Zaun bzw. Geländer als Linie zeichnen, Doppelklick beendet'],
  ['flaeche', 'übriges', 'Fläche (Container, Plakat, Böschung, Schneehaufen): Ecken anklicken, Doppelklick schliesst'],
]
const MIN_PUNKTE: Record<Exclude<Werkzeug, null>, number> = { parkfeld: 3, flaeche: 3, laengs: 2, hecke: 2, mauer: 2, zaun: 2, baum: 1 }
let zaehler = 0
const neueId = (p: string) => `${p}-${Date.now().toString(36)}-${(zaehler++).toString(36)}`
/** amtliche Parkfelder und Baumkataster: Ausschnitt um den Knoten wie die AV (±150 m) */
interface ParkStand { quelle: ParkQuelle; nr: number; lat: number; lon: number; felder: KatasterFeld[] | null; laedt?: boolean; fehler?: string }
/** K0: signalisierte Höchstgeschwindigkeit Stadt Bern (Geoportal) um den Ladeort (mitte LV95), nur in Bern */
interface VsigStand { nr: number; lat: number; lon: number; mitte: P; linien: TempoAmtlichLinie[] | null; laedt?: boolean; fehler?: string }
interface BaumStand { quelle: BaumQuelle; nr: number; lat: number; lon: number; baeume: KatasterBaum[] | null; laedt?: boolean; fehler?: string }
const WIRKUNG_TEXT: Record<string, string> = { voll: 'verdeckt', palisade: 'Palisade', hinweis: 'nur Hinweis' }

const avName = (radius: number, nachgeladen = false) =>
  `Amtliche Vermessung (WFS, ±${radius} m${nachgeladen ? ', nachgeladen für die Zielpunkte' : ''})`

/** Knoten aus dem URL-Parameter ?knoten=<OSM-Id> */
function knotenAusUrl(): number | null {
  const v = new URLSearchParams(location.search).get('knoten')
  return v && /^\d+$/.test(v) ? Number(v) : null
}
/** Zufahrtspunkt (Grundstückzufahrt) aus dem URL-Parameter ?zufahrt=E,N (LV95) */
const zufahrtAusUrl = (): P | null => zufahrtspunktLesen(new URLSearchParams(location.search).get('zufahrt'))
/** gewählten Knoten bzw. Zufahrtspunkt in der Adresse festhalten (zum Wiederfinden), ohne neuen Verlaufseintrag */
function ortInUrl(o: { knoten: number } | { zufahrt: P }) {
  const u = new URL(location.href)
  u.searchParams.delete('knoten'); u.searchParams.delete('zufahrt')
  if ('knoten' in o) u.searchParams.set('knoten', String(o.knoten)); else u.searchParams.set('zufahrt', zufahrtspunktKey(o.zufahrt))
  history.replaceState(history.state, '', u.pathname + u.search + u.hash)
}
/** Zufahrtspunkt so nah an der Mitte der geladenen Daten: Grundstückzufahrt ohne neues Laden (AV ±150 m, OSM 300 m) */
const GRUND_OHNE_LADEN_M = 50
/** Schlüssel geladener Daten: Knoten bzw. Mitte (für «Nachladen gescheitert») */
const datenKey = (d: Daten) => (d.nid !== null ? `k${d.nid}` : `z${zufahrtspunktKey(d.ort)}`)
/** Längsneigung aus dem Höhenmodell (E3a): Messungen und wofür (Daten, Zufahrtspunkt, Zufahrt); vorschlag: Zufahrt war nicht gewählt */
interface HoehenStand { sig: string; arme: string; vorschlag: boolean; stand: HoehenVorgabe }
const zpSig = (z: ZufahrtspunktEingabe | null) => (z ? `${zufahrtspunktKey(z.p)}:${z.richtung ? z.richtung.join(',') : '-'}` : '')
const HOEHEN_NAME = 'Höhenmodell (swisstopo, swissALTI3D, Profile)'
/** LV95 auf cm (Eingaben von der Karte) */
const cm = (p: P): P => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]

/** Eingabefeld Längsneigung [%]; übernimmt den Wert 300 ms nach dem letzten Tastendruck (nicht jede Taste eine Rechnung).
 *  wert null = Vorgabe (aus dem Höhenmodell, E3a): das Feld zeigt die Vorgabe; eine Eingabe gilt als «von Hand». Vorgabe
 *  unbekannt (Entscheid 31.10.2026): das Feld bleibt leer mit «unbekannt» als Platzhalter */
const NEIGUNG_PAUSE_MS = 300
const neigungText = (x: number) => String(x).replace('.', ',').replace('-', '−')
function NeigungFeld({ wert, vorgabe, unbekannt, onWert, name }: { wert: number | null; vorgabe: number; unbekannt: boolean
  onWert: (v: number | null) => void; name: string }) {
  const gilt = wert ?? vorgabe
  const leer = wert === null && unbekannt
  const [text, setText] = useState(leer ? '' : neigungText(gilt))
  const timer = useRef(0)
  useEffect(() => { setText(t => (leer ? '' : neigungLesen(t) === gilt ? t : neigungText(gilt))) }, [gilt, leer])
  useEffect(() => () => clearTimeout(timer.current), [])
  const ok = neigungLesen(text) !== null
  return <>
    <input type="text" inputMode="decimal" aria-label={`Längsneigung ${name} in Prozent`} value={text} className={ok ? '' : 'falsch'}
      placeholder={leer ? 'unbekannt' : undefined} size={leer ? 9 : undefined}
      onChange={e => {
        setText(e.target.value)
        clearTimeout(timer.current)
        const v = neigungLesen(e.target.value)
        if (v !== null && (wert === null || v !== wert)) timer.current = window.setTimeout(() => onWert(v), NEIGUNG_PAUSE_MS)
      }} />
    {wert !== null && <>{' '}<button className="zweit klein" title="Vorgabe aus dem Höhenmodell übernehmen" onClick={() => {
      clearTimeout(timer.current); onWert(null) }}>Vorgabe</button></>}
    {!ok && <span className="fehler klein"> Zahl zwischen −30 und +30 eingeben (gilt weiter: {leer ? 'unbekannt' : `${fi(gilt)} %`})</span>}
  </>
}
/** Vorgabe der Längsneigung kurz: Zahl bzw. «unbekannt» */
const neigungVorgabeKurz = (r: RichtungErgebnis) => (r.neigungVorgabeUnbekannt ? 'unbekannt' : `${fi(r.neigungVorgabe)} %`)

/** Schwerverkehrsanteil von Hand [%] (Block 5): übernommen beim Verlassen des Felds bzw. mit Enter; leer = ohne Angabe */
const anteilLesen = (t: string): number | null | undefined => {
  const x = t.trim().replace(/%$/, '').trim().replace(',', '.')
  if (!x) return null
  const v = Number(x)
  return Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v * 10) / 10 : undefined
}
function AnteilFeld({ wert, onWert }: { wert: number | null; onWert: (v: number | null) => void }) {
  const [text, setText] = useState(wert === null ? '' : f1(wert))
  useEffect(() => { setText(t => (anteilLesen(t) === wert ? t : wert === null ? '' : f1(wert))) }, [wert])
  const v = anteilLesen(text)
  const uebernehmen = () => { if (v !== undefined && v !== wert) onWert(v) }
  return <>
    <input type="text" inputMode="decimal" size={5} aria-label="Schwerverkehrsanteil in Prozent" placeholder="leer" value={text}
      className={v === undefined ? 'falsch' : ''} onChange={e => setText(e.target.value)} onBlur={uebernehmen}
      onKeyDown={e => { if (e.key === 'Enter') uebernehmen() }} /> %
    {v === undefined && <span className="fehler klein"> Zahl zwischen 0 und 100 oder leer</span>}
  </>
}

/** Block «Erforderliche Sichtweite» (Schritt 3): Strassentyp, ungünstige Verhältnisse, Längsneigung je Richtung (E1); beim
 *  Rechtsvortritt nur die Längsneigung */
function ErforderlichBlock({ s, eingaben, setEingaben, richtungen, rv = false, ueber = null }: { s: StrasseErgebnis; eingaben: Eingaben;
  setEingaben: (f: (e: Eingaben) => Eingaben) => void; richtungen: RichtungErgebnis[]; rv?: boolean; ueber?: UeberholStand | null }) {
  // Zustand der Bedienelemente aus den Eingaben (sofort), Vorgaben aus dem Ergebnis bzw. aus der eingegebenen Neigung
  const typ = eingaben.typ ?? s.typVorgabe
  // Neigung wie gerechnet: von Hand (sofort), sonst die Vorgabe aus dem Höhenmodell (aus dem Ergebnis)
  const neigungVorgabe = richtungen.some(r => Math.abs(eingaben.neigung[r.richtung] ?? r.neigungVorgabe) > NEIGUNG_GROSS_PROZENT + 1e-9)
  // Neigung einer Richtung unbekannt (ohne Eingabe von Hand): die Vorgabe «grosse Längsneigung» bleibt aus (Entscheid 31.10.2026)
  const neigungOffen = !neigungVorgabe && richtungen.some(r => r.neigungVorgabeUnbekannt && eingaben.neigung[r.richtung] === null)
  const anteil = eingaben.schwerverkehrAnteil ?? null
  const anteilUngunst = anteil !== null && anteil > SCHWERVERKEHR_PROZENT + 1e-9
  const gesetzt: Ungunst = { fahrstreifen: eingaben.fahrstreifen ?? s.ungunstVorgabe.fahrstreifen,
    neigung: eingaben.neigungGross ?? neigungVorgabe, schwerverkehr: eingaben.schwerverkehr }
  const haekchen = (k: keyof Ungunst, quelle: string, warn = false) => (
    <label key={k}><input type="checkbox" checked={gesetzt[k]} onChange={ev => {
      const v = ev.target.checked
      setEingaben(e => k === 'fahrstreifen' ? { ...e, fahrstreifen: v } : k === 'neigung' ? { ...e, neigungGross: v } : { ...e, schwerverkehr: v })
    }} /> {UNGUNST_TEXT[k]} <span className={warn ? 'klein warnung' : 'klein'}>({quelle})</span></label>
  )
  const vorgabe = (b: boolean) => (b ? 'ja' : 'nein')
  const ohneWirkung = typ !== 'hvs' && (gesetzt.fahrstreifen || gesetzt.neigung || gesetzt.schwerverkehr || anteilUngunst)
  return (
    <div className="eingabe">
      <table className="zahlen">
        <tbody>
          {!rv && <><tr><td>Strassentyp (Vortrittsstrasse)<Info titel="Strassentyp">
            <p>Wert der Tab. 1 nach Strassentyp: Erschliessungs-, Sammel- und Verbindungsstrassen der untere Wert, Hauptverkehrsstrassen
              der Zwischenwert ({ZWISCHENWERT_TEXT}), mit ungünstigen Verhältnissen der obere Wert.</p>
            <p>Vorgabe aus OSM als Annahme der App: trunk, primary, secondary, tertiary und deren links = Hauptverkehrsstrasse (tertiary
              damit auf der sicheren Seite), sonst Erschliessungsstrasse (hier {s.typQuelle}: {STRASSENTYP_TEXT[s.typVorgabe]}); im Feld
              wählbar.</p></Info></td><td>
            <select value={typ} aria-label="Strassentyp der Vortrittsstrasse"
              onChange={ev => { const t = ev.target.value as Strassentyp; setEingaben(e => ({ ...e, typ: t })) }}>
              {(['es', 'hvs'] as Strassentyp[]).map(t => <option key={t} value={t}>{STRASSENTYP_TEXT[t]}</option>)}
            </select>
            <div className="klein">{eingaben.typ !== null ? `(gewählt; Vorgabe ${TYP_KURZ[s.typVorgabe]})` :
              <span className="warnung">({annahmeText(s.typQuelle)})</span>}</div>
          </td></tr>
          <tr><td>Ungünstige Verhältnisse<Info titel="Ungünstige Verhältnisse">
            <p>Bei einer Hauptverkehrsstrasse hebt ein Häkchen den Wert der Tab. 1 vom Zwischenwert auf den oberen Wert. Bei
              Erschliessungs-, Sammel- und Verbindungsstrassen sind ungünstige Verhältnisse nur ein Hinweis: der untere Wert bleibt.</p>
            <p>Vorgaben: mehr als ein Fahrstreifen je Richtung aus OSM (lanes:forward bzw. lanes:backward, sonst lanes: bei einer
              Einbahn ab 2, sonst ab 3; hier {s.fahrstreifenQuelle}); grosse Längsneigung bei einem Gefälle über{' '}
              {NEIGUNG_GROSS_PROZENT} % in einer Richtung, also |i| über {NEIGUNG_GROSS_PROZENT} % (bei unbekannter Neigung nicht gesetzt:
              kein Mass bekannt); hoher Schwerverkehrsanteil über {SCHWERVERKEHR_PROZENT} % aus dem eingegebenen Anteil, das Häkchen setzt
              ihn von Hand (dann unabhängig vom Anteil).</p>
            <p>{UNGUNST_MASSE_TEXT}.</p></Info></td><td>
            {haekchen('fahrstreifen', eingaben.fahrstreifen === null ? `Vorgabe ${quelleText(s.fahrstreifenQuelle)}` :
              `gewählt; Vorgabe ${vorgabe(s.ungunstVorgabe.fahrstreifen)}`)}
            {haekchen('neigung', eingaben.neigungGross === null ? `Vorgabe aus der Längsneigung${neigungOffen ? '; unbekannt, nicht gesetzt' :
              ''}` : `gewählt; Vorgabe ${vorgabe(neigungVorgabe)}`, eingaben.neigungGross === null && neigungOffen)}
            {haekchen('schwerverkehr', eingaben.schwerverkehr ? 'von Hand gesetzt: gilt unabhängig vom Anteil' :
              anteilUngunst ? `nicht von Hand; aus dem Anteil über ${SCHWERVERKEHR_PROZENT} %: ungünstig` : 'von Hand bzw. aus dem Anteil')}
            <div className="klein">Schwerverkehrsanteil{' '}
              <AnteilFeld wert={anteil} onWert={v => setEingaben(e => ({ ...e, schwerverkehrAnteil: v }))} />{' '}
              {anteilUngunst ? <span className="warnung">über {SCHWERVERKEHR_PROZENT} %: ungünstig</span> :
                anteil !== null ? `(höchstens ${SCHWERVERKEHR_PROZENT} %: nicht ungünstig)` : `(ungünstig über ${SCHWERVERKEHR_PROZENT} %)`}</div>
            {ohneWirkung && <div className="klein warnung">Häkchen ohne Wirkung: bei einer Erschliessungsstrasse bleibt der untere Wert.</div>}
          </td></tr>
          {ueber && <tr><td>Überholfall<Info titel="Überholfall (Ziffer 6)">
            <p>Ausserorts, wo Überholen erlaubt ist, prüft die App eine zweite Sichtlinie S' von D auf die Achse des Gegenfahrstreifens
              (VSS 40 273 Ziffer 6, S. 4; Abb. 1, S. 5): das überholende Fahrzeug fährt {f2(D_MFZ_M)} m vom anderen Fahrbahnrand, die Zielpunkte
              reichen bis zur selben erforderlichen Sichtweite A, die Hindernisse wie für Motorfahrzeuge. Der Teil zählt zum Status der
              Richtung.</p>
            <p>Vorgabe aus OSM (overtaking=no bzw. overtaking:forward/backward=no für den Verkehr zum Knoten: verboten, sonst erlaubt; hier{' '}
              {ueber.vorgabeQuelle}); das Häkchen gilt für beide Richtungen. Innerorts und beim Rechtsvortritt keine Prüfung.</p></Info></td><td>
            <label style={ueber.ausserorts ? undefined : { opacity: 0.55 }}><input type="checkbox" checked={eingaben.ueberholen ?? ueber.vorgabe}
              onChange={ev => { const v = ev.target.checked; setEingaben(e => ({ ...e, ueberholen: v })) }} /> Überholen im Knotenbereich
              erlaubt</label>
            {(eingaben.ueberholen ?? null) !== null && <>{' '}<button className="zweit klein"
              onClick={() => setEingaben(e => ({ ...e, ueberholen: null }))}>Vorgabe</button></>}
            <div className="klein">{(eingaben.ueberholen ?? null) !== null ? <>(<Hand />; Vorgabe {ueber.vorgabe ? 'erlaubt' : 'verboten'},{' '}
              {ueber.vorgabeQuelle})</> : <span className={ueber.vorgabe && ueber.ausserorts ? 'warnung' : ''}>(Vorgabe: {ueber.vorgabeQuelle})</span>}</div>
            {!ueber.ausserorts && <div className="klein">innerorts: ohne Wirkung (Überholfall nur ausserorts)</div>}
            {ueber.ausserorts && !ueber.geprueft && ueber.grund && <div className="klein">nicht geprüft: {ueber.grund}</div>}
          </td></tr>}</>}
          <tr><td>Längsneigung i<Info titel="Längsneigung">
            {rv && <p>Rechtsvortritt: Tab. 1, Strassentyp und ungünstige Verhältnisse gelten nicht (ausgeblendet); die Längsneigung wirkt
              nur auf das Velo (Tab. 3).</p>}
            <p>Neigung der Strecke, auf der dieser Verkehr auf den Knoten zu fährt, in seiner Fahrtrichtung: fährt er bergab, ist i
              negativ. Auf einer durchgehenden Steigung haben die beiden Richtungen entgegengesetzte Vorzeichen.</p>
            <p>Vorgabe aus dem Höhenmodell swissALTI3D (Ausgleichsgerade über das Profil der Fahrstreifenachse ab K bis A massgebend,
              mindestens {PROFIL_MIN_M} m); von Hand überschreibbar. Die Anhaltesichtweite gilt ab |i| über {NEIGUNG_EBEN_PROZENT} % als
              Untergrenze (die unteren Werte der Tab. 1 gelten für i ≤ ±{NEIGUNG_EBEN_PROZENT} %, VSS 40 273 Ziffer 13.1).</p>
            <p>Ohne Messung (kein Höhenprofil, zu kurz, Dienst-Fehler) ist die Neigung unbekannt: die App nimmt den strengsten Wert der
              Tab. 3 (Spalte ≤ −4 %) und die Anhaltesichtweite bei {fi(ANHALTESICHT_I_MIN)} % (Entscheid 31.10.2026); eine Neigung von
              Hand verfeinert das. Solange das Höhenmodell lädt, vorerst 0 %.</p>
            <ul>{richtungen.map(r => <li key={r.richtung}>{lageText(r)}: {eingaben.neigung[r.richtung] !== null ?
              `von Hand; Vorgabe ${neigungVorgabeKurz(r)} (${r.neigungVorgabeQuelle})` : `Vorgabe: ${r.neigungQuelle}`}</li>)}</ul></Info></td><td>
            {richtungen.map(r => {
              const hand = eingaben.neigung[r.richtung] !== null
              const modell = r.neigungQuelle.startsWith(HOEHEN_QUELLE + ',')
              return <div key={r.richtung} className="neigungzeile"><label>{lageText(r)}, {r.strasse}:{' '}
                <NeigungFeld wert={eingaben.neigung[r.richtung]} vorgabe={r.neigungVorgabe} unbekannt={r.neigungVorgabeUnbekannt} name={lageText(r)}
                  onWert={v => setEingaben(e => ({ ...e, neigung: { ...e.neigung, [r.richtung as Richtung]: v } }))} /> %{' '}
                <span className={hand || modell ? 'klein' : 'klein warnung'}>
                  {hand ? <>(<Hand />; Vorgabe {neigungVorgabeKurz(r)})</> : modell ? '(Höhenmodell)' :
                  `(${r.neigungQuelle})`}</span></label></div>
            })}
          </td></tr>
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------- Ergebnis (Schritt 4): je Richtung Auto, Velo, Trottoir
type TrottoirRichtung = TrottoirPruefung['richtungen'][number]
/** Feld eines Teils in der Statuszeile bzw. Status in der Spalte: Text (immer dabei, schwarz-weiss lesbar) und Farbe */
interface TeilStand { feld: string; kurz: string; farbe: string }
const GRAU = STATUS_FARBE.keine_zufahrt
const STUFE_KURZ: Record<RichtungErgebnis['typStufe'], string> = { unten: 'unterer Wert', zwischen: 'Zwischenwert', oben: 'oberer Wert' }
/** Rechtsvortritt: von dieser Seite nicht geprüft (dieser Verkehr muss der Zufahrt den Vortritt lassen bzw. keine Prüfung) */
const rvNichtGeprueft = (r: RichtungErgebnis) => r.status === 'keine_zufahrt' && !!r.rvKeine
function autoStand(r: RichtungErgebnis): TeilStand {
  if (r.status === 'keine_zufahrt') return rvNichtGeprueft(r) ? { feld: 'Auto nicht geprüft', kurz: 'nicht geprüft', farbe: GRAU } :
    { feld: 'keine Autos', kurz: 'keine Autos', farbe: GRAU }
  const kurz = r.status === 'erfuellt' ? 'erfüllt' : r.status === 'massgebend' ? (r.rv ? 'bedingt' : 'massgebend erfüllt') : 'nicht erfüllt'
  return { feld: `Auto ${kurz}`, kurz, farbe: STATUS_FARBE[r.status] }
}
function veloStand(r: RichtungErgebnis): TeilStand {
  if (r.velo) return { feld: `Velo ${STATUS_TEXT_TEIL[r.velo.status]}`, kurz: STATUS_TEXT_TEIL[r.velo.status], farbe: STATUS_FARBE[r.velo.status] }
  return rvNichtGeprueft(r) ? { feld: 'Velo nicht geprüft', kurz: 'nicht geprüft', farbe: GRAU } :
    { feld: 'kein Veloverkehr', kurz: 'kein Veloverkehr', farbe: GRAU }
}
/** Überholfall (Block 5): nur, wenn geprüft */
const ueberStand = (r: RichtungErgebnis): TeilStand | null => (r.ueberholfall ? { feld: `Überholfall ${STATUS_TEXT_TEIL[r.ueberholfall.status]}`,
  kurz: STATUS_TEXT_TEIL[r.ueberholfall.status], farbe: STATUS_FARBE[r.ueberholfall.status] } : null)
const trottoirStand = (t: TrottoirRichtung | null): TeilStand => (t ? { feld: `Trottoir ${STATUS_TEXT_TEIL[t.status]}`,
  kurz: STATUS_TEXT_TEIL[t.status], farbe: STATUS_FARBE[t.status] } : { feld: 'Trottoir keines', kurz: 'keines', farbe: GRAU })
/** graue Zeile der Statusübersicht: auf dieser Seite liegt kein Arm (der andere Arm liegt gegenüber) */
const OhneArm = ({ seite }: { seite: Richtung }) => <li className="klein"><span className="richtungsname"><span className="farbe rund"
  style={{ background: GRAU }} />{seite}: kein Arm</span></li>
const Feld = ({ s }: { s: TeilStand }) => <span className="feld" style={{ borderColor: s.farbe, background: `${s.farbe}1f` }}>{s.feld}</span>
/** Verdecker kurz: Art und Name ohne Zusatz in Klammern am Schluss (Quelle), ohne Wiederholung der Art */
function verdeckerKurz(v: { art: string; name: string }) {
  const name = kurzQuelle(v.name)
  return name === v.art || v.name === 'Gebäude (AV)' ? v.art : name.split(' ')[0] === v.art.split(' ')[0] ? name : `${v.art}: ${name}`
}
const vorhandenText = (t: { vorhanden: number; bisEnde: boolean }) => `${t.bisEnde ? '≥ ' : ''}${f1(t.vorhanden)} m`
/** Tempo einer Richtung kurz für die Überschrift: «30 km/h, OSM maxspeed» */
const tempoKurz = (r: RichtungErgebnis) => (rvNichtGeprueft(r) ? 'Rechtsvortritt' : r.tempoArt ? `von Hand, ${TEMPO_ART_TEXT[r.tempoArt]}` :
  kurzQuelle(r.tempoQuelle))
/** Hinweise mit Folgen für das Ergebnis: Zielpunkte über den AV-Ausschnitt hinaus (weiter weg fehlen Gebäude) */
const avGrenze = (h: string[]) => h.filter(x => x.startsWith('Zielpunkte reichen über den AV-Ausschnitt'))

/** Liste «Im Sichtdreieck bis A» (Herleitung) */
function VerdeckerListe({ liste }: { liste: SichtTeil['verdeckerListe'] }) {
  if (!liste.length) return null
  return <><p>Im Sichtdreieck bis A:</p>
    <ul>{liste.map(t => <li key={t.id}><span className="farbe" style={{ background: TREFFER_FARBE[t.wirkung] }} />{verdeckerKurz(t)},
      {' '}{t.quelle}: {WIRKUNG_TEXT[t.wirkung]} ab {f1(t.sErst)} m, {f1(t.strecke)} m bis A</li>)}</ul></>
}
/** Zeilen «geprüft bis» und erster verdeckter Zielpunkt (Herleitung) */
const SichtHerleitung = ({ t, faktorText }: { t: Pick<SichtTeil, 'bisEnde' | 'sMax' | 'verdecker' | 'verdeckerListe'>; faktorText?: string }) => <>
  {t.bisEnde && <li>Vorhandene Sichtweite bis zum Ende der Zielpunkte frei: geprüft bis {t.sMax} m{faktorText ? ` = ${faktorText}` : ''}.</li>}
  {t.verdecker && <li>Verdeckt durch {verdeckerKurz(t.verdecker)}, {t.verdecker.quelle}; erster verdeckter Zielpunkt bei{' '}
    {f1(t.verdecker.sVerdeckt)} m.</li>}
</>

/** Spalte eines Teils (Auto, Velo, Trottoir): vier Zeilen, die Herleitung im Info-Zeichen */
function TeilSpalte({ name, farbe, zusatz, stand, A, Aquelle, t, herleitung, leer }: { name: string; farbe?: string; zusatz?: string
  stand: TeilStand; A?: number; Aquelle?: string; t?: { vorhanden: number; bisEnde: boolean; verdecker: { art: string; name: string } | null }
  herleitung: React.ReactNode; leer?: string }) {
  return (
    <div className="teil">
      <h4>{farbe && <span className="farbe" style={{ background: farbe }} />}{name}{zusatz && <span className="klein"> {zusatz}</span>}
        <Info titel={`Herleitung ${name}`}>{herleitung}</Info></h4>
      {leer || !t ? <p className="klein">{leer ?? stand.kurz}</p> : <dl>
        <dt>Sichtweite erforderlich</dt><dd><b>{A} m</b> <span className="klein">({Aquelle})</span></dd>
        <dt>Sichtweite vorhanden</dt><dd><b>{vorhandenText(t)}</b></dd>
        <dt>Status</dt><dd><b style={{ color: stand.farbe }}>{stand.kurz}</b></dd>
        <dt>Verdeckt durch</dt><dd>{t.verdecker ? verdeckerKurz(t.verdecker) : '–'}</dd>
      </dl>}
    </div>
  )
}

/** Ergebnis einer Richtung (Schritt 4): Überschrift mit Tempo, darunter Auto, Velo und (mit Trottoir) Trottoir nebeneinander */
function RichtungZeile({ r, t, mitTrottoir, achseQuelle, velo, gehlinie = false, D }: { r: RichtungErgebnis; t: TrottoirRichtung | null
  mitTrottoir: boolean; achseQuelle: string; velo: boolean; gehlinie?: boolean; D: P }) {
  const v = r.velo
  const nichtGeprueft = rvNichtGeprueft(r)
  // Rechtsvortritt, Verkehr von links bzw. Gegenverkehr: nur die graue Statuszeile, keine Spalten (ausser ein Trottoir ist geprüft)
  if (nichtGeprueft && !v && !t) return null
  const warn = avGrenze([...r.hinweise, ...(v?.hinweise ?? []), ...(t?.hinweise ?? [])])
  const u = r.ueberholfall ?? null
  const auto = autoStand(r)
  // Street View (31.10.2026): Blick von D zum Ende von A, sonst zum Ende von A für die Velos
  const sv = r.sichtpunkte.length ? richtungStreetView(D, r.sichtpunkte, r.massgebend) : v ? richtungStreetView(D, v.sichtpunkte, v.A) : null
  const autoA = r.rv ? 'Abb. 6, Minimum' : r.anhalteAngewendet && r.massgebendText.startsWith('Anhaltesichtweite') ? 'Anhaltesichtweite' :
    `Tab. 1, ${STUFE_KURZ[r.typStufe]}`
  return (
    <div className="richtung">
      <h3>{lageText(r)}: {r.strasse}<span className="klein">, {r.spur === 'nah' ? 'nahe' : 'ferne'} Fahrspur</span>
        {' '}<span className={r.tempoAnnahme ? 'klein warnung' : 'klein'}>· {r.tempo} km/h, {tempoKurz(r)}</span>
        {sv && <>{' '}<a className="streetview-link klein" href={sv} target="_blank" rel="noopener noreferrer"
          title={richtungStreetViewTitel(lageText(r).toLowerCase(), r.strasse)}>Street View ↗</a></>}</h3>
      {warn.map(w => <p key={w} className="klein warnung">{w}</p>)}
      <div className={mitTrottoir && u ? 'teile vier' : mitTrottoir || u ? 'teile drei' : 'teile'}>
        <TeilSpalte name="Auto" stand={auto} A={r.massgebend} Aquelle={autoA} t={r}
          leer={r.status === 'keine_zufahrt' ? (nichtGeprueft ? 'nicht geprüft (Rechtsvortritt)' : 'keine Autos (Einbahn vom Knoten weg)') : undefined}
          herleitung={<>
            <p>A: erforderliche Sichtweite ab dem Kreuzungspunkt K entlang der Fahrstreifenachse (Knotensichtweite, VSS 40 273 Abb. 1).</p>
            <p>Motorfahrzeuge ({r.rv ? 'Rechtsvortritt, Teil E, Abb. 6' : r.status === 'keine_zufahrt' ? 'keine Prüfung' : 'Tab. 1'}).</p>
            <ul>
              <li>Tempo {r.tempo} km/h ({r.tempoQuelle}{r.tempoArt ? `; Vorgabe ${r.tempoVorgabe} km/h, ${r.tempoVorgabeQuelle}` : ''}).</li>
              {r.status === 'keine_zufahrt' ? <li>{r.keinGrund ?? STATUS_TEXT.keine_zufahrt}.</li> : <>
                {!r.rv && <li>Tab. 1 nach Strassentyp: {r.typWert} m ({r.typText}); Bereich {r.erforderlichUnten} … {r.erforderlichOben} m.</li>}
                {!r.rv && <li>Anhaltesichtweite (VSS 40 090b Abb. 2): {r.anhalte ? <>bei {fi(r.anhalte.i)} %{r.neigungUnbekannt ?
                  ' (Neigung unbekannt: strengster Wert)' : ''}: {r.anhalte.meter} m (VP{' '}
                  {r.anhalte.stufe} km/h{r.anhalteAngewendet ? '' : `; nicht angewendet, |i| bis ${NEIGUNG_EBEN_PROZENT} %`}
                  {r.anhalte.unsicher ? `; Kurve ${r.anhalte.verlaengert ? 'verlängert' : 'gestrichelt'}, unsicher` : ''}{r.anhalte.abweichung !== 0 ? `; Diagramm ` +
                  `${Math.ceil(r.anhalte.roh - 1e-9)} m, auf Tab. 1 verschoben: bei 0 % ${TAB1[r.anhalte.stufe][0] + r.anhalte.abweichung} ` +
                  `statt ${TAB1[r.anhalte.stufe][0]} m` : ''})</> : `unter ${ANHALTESICHT_STUFEN[0]} km/h keine Kurve`}.</li>}
                {r.rv && <li>{r.typText}.</li>}
                <li>Erforderliche Sichtweite A{r.rv ? ', mindestens (nicht zu sanieren)' : ', massgebend'}: {r.massgebend} m
                  ({r.massgebendText}).</li>
                <li>Fahrstreifenachse {f2(r.randAbstand)} m vom rechten Fahrbahnrand ({r.parkStreifen.abzug ? `d ${f2(D_MFZ_M)} m neben dem ` +
                  'Parkstreifen: ' : ''}{r.lageQuelle}).</li>
                <SichtHerleitung t={r} faktorText={`${String(ZIEL_FAKTOR).replace('.', ',')} × ${r.rv ? 'grösste Stufe der Abb. 6' :
                  r.massgebend > r.erforderlichOben ? 'massgebender' : 'oberer'} Wert`} />
                <li>Status: {r.rv ? rvStatusText(r, r.status) : STATUS_TEXT[r.status]}{r.statusZusatz.map(z => ` · ${z}`).join('')}.</li>
              </>}
            </ul>
            <VerdeckerListe liste={r.verdeckerListe} />
            {r.hinweise.length > 0 && <><p>Hinweise:</p><ul>{r.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
          </>} />
        {u && <TeilSpalte name="Überholfall" farbe={FREI_FARBE} stand={ueberStand(r)!} A={u.A} Aquelle="wie Auto" t={u}
          herleitung={<>
            <p>Überholfall (VSS 40 273 Ziffer 6, S. 4; Abb. 1, S. 5): ausserorts mit erlaubtem Überholen eine zweite Sichtlinie S' von D
              auf den Gegenfahrstreifen, auf dem das überholende Fahrzeug fährt.</p>
            <ul>
              <li>Achse: {u.lageText}; ohne Abzug eines Parkstreifens (Annahme).</li>
              <li>Erforderliche Sichtweite A {u.A} m, dieselbe wie für die Motorfahrzeuge dieser Richtung ({r.massgebendText}).</li>
              <SichtHerleitung t={u} />
            </ul>
            <VerdeckerListe liste={u.verdeckerListe} />
            {u.hinweise.length > 0 && <><p>Hinweise:</p><ul>{u.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
          </>} />}
        <TeilSpalte name="Velo" farbe={VELO_FARBE} zusatz={r.veloGegen ? 'gegen die Einbahn' : undefined} stand={veloStand(r)}
          A={v?.A} Aquelle="Tab. 3" t={v ?? undefined} leer={v ? undefined : nichtGeprueft ? 'nicht geprüft (Rechtsvortritt)' : 'kein Veloverkehr'}
          herleitung={<>
            <p>Veloverkehr (Tab. 3{r.veloGegen ? ', Velo gegen die Einbahn' : ''}): {VELOFUEHRUNG_TEXT[r.veloFuehrung]} ({r.veloGewaehlt ?
              `gewählt; Vorgabe ${VELOFUEHRUNG_TEXT[r.veloVorgabe]}, ${r.veloVorgabeQuelle}` : `Vorgabe: ${r.veloVorgabeQuelle}`}).</p>
            {v ? <>
              <ul>
                <li>Veloachse: {v.lageText}.</li>
                <li>Erforderliche Sichtweite A {v.A} m ({v.text}; {v.tempo} km/h zulässig, {v.tempoQuelle}; i {v.neigungUnbekannt ?
                  'unbekannt' : `${fi(v.neigung)} %`}).</li>
                <SichtHerleitung t={v} faktorText={`${String(ZIEL_FAKTOR).replace('.', ',')} × A`} />
              </ul>
              <VerdeckerListe liste={v.verdeckerListe} />
              {v.hinweise.length > 0 && <><p>Hinweise:</p><ul>{v.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
            </> : <p>{nichtGeprueft ? r.keinGrund : r.veloFuehrung === 'kein' ? 'Veloführung «kein Veloverkehr»: keine Prüfung.' :
              'Kein Verkehr von dieser Seite.'}</p>}
          </>} />
        {mitTrottoir && <TeilSpalte name="Trottoir" farbe={TROTTOIR_FARBE} stand={trottoirStand(t)} A={t?.A} Aquelle="Tab. 2"
          t={t ?? undefined} leer={t ? undefined : 'keines'}
          herleitung={t ? <>
            <p>Trottoir: Fussgänger und fahrzeugähnliche Geräte, die von dieser Seite auf dem Trottoir zur Zufahrt kommen (Tab. 2).</p>
            <ul>
              {gehlinie ? <li>Trottoirüberfahrt, Phase Trottoir (VSS 40 242 Ziffer 14.4): D' = B {f2(B_INNERORTS_M)} m hinter dem hinteren
                Rand der Überfahrt (VSS 40 273 Ziffer 13.2), {velo ? 'auf der Veloachse' : 'am Fahrersitz'}; Zielpunkte auf der Gehlinie{' '}
                {f2(TUE_GEHLINIE_M)} m vor dem hinteren Rand der Überfahrt ({achseQuelle}).</li> :
              <li>D' = B {f2(B_INNERORTS_M)} m hinter der Trottoirhinterkante (VSS 40 273 Ziffer 13.2), {velo ? 'auf der Veloachse' :
                'am Fahrersitz'}; Zielpunkte auf der Trottoirachse ({achseQuelle}).</li>}
              <li>Längsneigung in Gehrichtung zur Zufahrt {t.neigungUnbekannt ? 'unbekannt' : `${fi(t.neigung)} %`} ({t.neigungQuelle}).
                {' '}{TROTTOIR_NEIGUNG_AUSLEGUNG}.</li>
              <li>Erforderliche Sichtweite A {t.A} m ({t.text}).</li>
              <SichtHerleitung t={t} />
            </ul>
            <VerdeckerListe liste={t.verdeckerListe} />
            {t.hinweise.length > 0 && <><p>Hinweise:</p><ul>{t.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul></>}
          </> : <p>Von dieser Seite kein Trottoir quer über die Zufahrt.</p>} />}
      </div>
    </div>
  )
}

/** Grund, warum eine Seite beim Rechtsvortritt nicht geprüft ist; die allgemeinen Gründe («Rechtsvortritt: …») mit der Lage davor */
const rvGrundText = (r: RichtungErgebnis) => (r.keinGrund?.startsWith('Rechtsvortritt') ? `${lageText(r)}: ${r.keinGrund}` : r.keinGrund ?? '')
/** Rechtsvortritt (E3c, Teil E), oben im Ergebnis: wem die Zufahrt den Vortritt lassen muss, die nicht geprüfte Seite und der
 *  Zustand nach Abb. 6; alles Weitere im Info-Zeichen */
function RvBlock({ rv, links, linksName }: { rv: RechtsvortrittErgebnis; links: RichtungErgebnis | undefined; linksName: string }) {
  const a = rv.arm, m = a.sichtfeld
  const breite = (b: number | null) => (b === null ? 'ohne AV-Querschnitt' : `${f1(b)} m`)
  // die Zufahrt hat vortrittsbelasteten Verkehr und es gibt einen Arm rechts: der Verkehr von links muss ihr den Vortritt lassen, der
  // Gegenverkehr hat beim Geradeausfahren kein Vortrittsverhältnis
  const linksWartet = !!links && rvNichtGeprueft(links) && !!a.rechts && (a.status !== 'keine' || !!a.nurVelo || a.grund.startsWith('der Arm rechts'))
  return (
    <div className="rvblock">
      {a.rechts && <p>Die Zufahrt muss den Vortritt lassen: <b>{a.rechtsName}</b>, von rechts.<Info titel="Rechtsvortritt">
        <p>Rechtsvortritt nach VSS 40 273 Teil E (Ziffern 15 bis 18): alle Arme sind vortrittsbelastet; jeder muss dem Verkehr von rechts
          den Vortritt lassen. Geprüft wird {a.armName} gegen den Arm rechts: {a.rechtsName}.</p>
        <ul>
          <li>{RV_TEMPO_TEXT} B {f2(rv.B)} m (Abb. 4).</li>
          <li>Wahrnehmbarkeit {WAHRNEHMBARKEIT_TEXT[rv.wahrnehmbarkeit]} ({rv.wahrnehmbarkeitGewaehlt ? 'gewählt' : 'Vorgabe, Annahme'}).</li>
          {a.status !== 'keine' && <li>Sichtweite vorhanden {a.bisEnde ? '≥ ' : ''}{f1(a.vorhanden)} m; {RV_A_M} m anzustreben, {RV_A_MIN_M} m Minimum
            bei sehr guter Wahrnehmbarkeit (Ziffer 16).</li>}
          <li>Fahrbahnbreite: Zufahrt {breite(a.breite)}, rechter Arm {breite(a.breiteRechts)}{a.schmal ? ` (schmal, höchstens ${f2(SCHMAL_M)} m: ` +
            'Abb. 5)' : ''}.</li>
          {m && <li>Sichtfeld Abb. 5: {m.frei ? 'frei' : 'nicht frei'}, {m.sichtbar} von {m.linien.length} Sichtlinien frei
            ({Math.round(m.anteil * 100)} %){m.erste ? `; erste verdeckte bei ${f1(m.erste.s)} m Pfadlänge ab D (${f1(m.erste.sRechts)} m ` +
            `auf dem rechten Arm; ${m.erste.verdecker})` : ''}. Konstruktion nach bfu BM.021 Kap. 3.2.2, Abb. 4: Sichtlinien von D zu
            Punkten alle {ENG_SCHRITT_M} m auf einem Pfad von {ENG_LAENGE_M} m ab D über den Schnitt der Achsen ({f1(m.bisX)} m ab D) auf
            den rechten Arm (schmaler Arm: Fahrbahnmitte, breiter Arm: Fahrstreifen); gezählt der Schnittpunkt und die Punkte dahinter
            (Annahmen: Beobachter und Pfadbeginn in D).</li>}
          {a.status === 'keine' && a.grund && <li>Keine Prüfung nach Abb. 6: {a.grund}.</li>}
          {links?.keinGrund && <li>{rvGrundText(links)}.</li>}
        </ul></Info></p>}
      {linksWartet && (links!.lage === 'gegenueber' ? <p>Gegenverkehr aus {linksName}: <b>kein Vortrittsverhältnis</b> beim Geradeausfahren
        (Linksabbiegen nicht geprüft).</p> : <p>Verkehr von links ({linksName}) muss dieser Zufahrt den Vortritt lassen: <b>nicht geprüft</b>.</p>)}
      {a.status !== 'keine' ? <p><span className="farbe rund" style={{ background: RV_STATUS_FARBE[a.status] }} />Zustand nach Abb. 6:{' '}
        <b>{a.zustand ? ZUSTAND_TEXT[a.zustand] : '–'}</b> (Wahrnehmbarkeit {WAHRNEHMBARKEIT_TEXT[rv.wahrnehmbarkeit]}
        {rv.wahrnehmbarkeitGewaehlt ? '' : <span className="warnung">, Annahme</span>}, Sichtweite {a.bisEnde ? '≥ ' : ''}{f1(a.vorhanden)} m)</p> :
        a.nurVelo ? <p>Von rechts kommen keine Autos (Einbahn vom Knoten weg), nur Velos: geprüft nach Tab. 3.</p> :
        <p>Keine Prüfung nach Abb. 6: {a.grund}.{!a.rechts && <Info titel="Rechtsvortritt">
          <p>Rechtsvortritt nach VSS 40 273 Teil E (Ziffern 15 bis 18): jeder Arm muss dem Verkehr von rechts den Vortritt lassen.</p>
          {links?.keinGrund && <p>{rvGrundText(links)}.</p>}</Info>}</p>}
      {m && !m.frei && <p className="warnung">Sichtfeld nach Abb. 5 nicht frei: nicht erfüllt.</p>}
    </div>
  )
}
/** Rechtsvortritt «alle Arme prüfen»: je Arm gegen seinen rechten Nachbarn (Tabelle wie bisher) */
function RvAlle({ rv, armWaehlen }: { rv: RechtsvortrittErgebnis; armWaehlen: (key: string) => void }) {
  if (!rv.alle) return null
  return <>
    <h4>Alle Arme<Info titel="Alle Arme"><p>Nur Motorfahrzeuge nach Abb. 6 bzw. Abb. 5 (ohne Velo und Trottoir); der gewählte Arm mit
      seinen Eingaben, die übrigen mit den Vorgaben (ohne Halte- oder Wartelinie, D von Hand, Neigung). Ein Klick auf den Arm wählt ihn.</p>
      {rv.alle.filter(x => x.status === 'keine').map(x => <p key={x.arm}>{x.armName}: {x.grund}.</p>)}</Info></h4>
    <table className="zahlen">
      <thead><tr><th>Arm</th><th>gegen rechts</th><th>Sichtweite vorhanden</th><th>Status</th></tr></thead>
      <tbody>{rv.alle.map((x: RvArm) => <tr key={x.arm}>
        <td><button className={x.arm === rv.arm.arm ? 'aktiv klein' : 'zweit klein'} onClick={() => armWaehlen(x.arm)}
          title="Diesen Arm wählen: die Karte zeigt ihn">{x.armName}</button></td>
        <td>{x.rechtsName}</td>
        <td>{x.status === 'keine' ? '–' : `${x.bisEnde ? '≥ ' : ''}${f1(x.vorhanden)} m`}{x.schmal ? ' · schmal' : ''}</td>
        <td><b style={{ color: RV_STATUS_FARBE[x.status] }}>{RV_STATUS_TEXT[x.status]}</b>{x.sichtfeld && !x.sichtfeld.frei ?
          <span className="warnung"> · Abb. 5</span> : ''}</td>
      </tr>)}</tbody>
    </table>
  </>
}

/** Block «Veloverkehr» (Schritt 3, E3b): Veloführung je Richtung (Vorgabe OSM), schnelle E-Bikes verboten */
function VeloAbschnitt({ e, eingaben, setEingaben }: { e: Ergebnis; eingaben: Eingaben; setEingaben: (f: (x: Eingaben) => Eingaben) => void }) {
  const ueber30 = e.richtungen.some(r => r.velo && r.velo.tempo > TAB3_GRENZE)
  return (
      <table className="zahlen">
        <tbody>
          <tr><td>Veloführung je Richtung<Info titel="Veloführung">
            <p>Mischverkehr: Veloachse {f2(D_VELO_M)} m vom rechten Fahrbahnrand (Ziffer 10). Radstreifen: Mitte des Streifens
              ({f2(RADSTREIFEN_M)} m breit angenommen), die Autoachse liegt dann {f2(D_MFZ_M)} m daneben. Radweg: Achse des Radwegs; näher
              als {f2(RADWEG_NAH_M)} m am Fahrbahnrand gilt B ab seiner Aussenkante (Ziffer 12).</p>
            <ul>{e.richtungen.map(r => <li key={r.richtung}>{lageText(r)}: Vorgabe {VELOFUEHRUNG_TEXT[r.veloVorgabe]} aus{' '}
              {r.veloVorgabeQuelle}{r.veloGegen ? `; Einbahn vom Knoten weg mit Velo gegen die Einbahn (OSM ${r.veloGegen}): Veloachse am ` +
              'für das Velo rechten, aus Sicht des Autoverkehrs linken Fahrbahnrand' : ''}.</li>)}</ul>
            </Info></td><td>
            {e.richtungen.map(r => {
              const wert = eingaben.velo?.[r.richtung] ?? null
              return <div key={r.richtung} className="tempozeile">{lageText(r)}, {r.strasse}:{' '}
                <select value={wert ?? 'osm'} aria-label={`Veloführung ${lageText(r)}`} onChange={ev => {
                  const a = ev.target.value
                  setEingaben(x => ({ ...x, velo: { links: null, rechts: null, ...x.velo, [r.richtung]: a === 'osm' ? null : a as Velofuehrung } }))
                }}>
                  <option value="osm">Vorgabe ({VELOFUEHRUNG_TEXT[r.veloVorgabe]})</option>
                  {VELOFUEHRUNGEN.map(f => <option key={f} value={f}>{VELOFUEHRUNG_TEXT[f]}</option>)}
                </select>
                {' '}<span className="klein">({wert ? <><Hand />; Vorgabe {VELOFUEHRUNG_TEXT[r.veloVorgabe]}</> : r.veloVorgabeQuelle})</span>
                {r.veloGegen ? <div className="klein">nur Velos (Einbahn vom Knoten weg)</div> :
                  r.status === 'keine_zufahrt' ? <div className="klein">kein Verkehr von dieser Seite</div> : null}</div>
            })}
            {e.zufahrtVelo && <div className="tempozeile">Zufahrt: Velos gegen die Einbahn</div>}
          </td></tr>
          <tr><td>Schnelle E-Bikes<Info titel="Schnelle E-Bikes">
            <p>Tab. 3, Zeile «schnelle E-Bikes verboten»: {TAB3_EBIKE.talwaerts} m talwärts, {TAB3_EBIKE.eben} m eben,{' '}
              {TAB3_EBIKE.bergwaerts} m bergwärts. Gilt nur über {TAB3_GRENZE} km/h zulässiger Höchstgeschwindigkeit; sonst nicht wählbar.</p></Info></td><td>
            <label style={ueber30 ? undefined : { opacity: 0.55 }}><input type="checkbox" checked={!!eingaben.ebikeVerboten}
              disabled={!ueber30 && !eingaben.ebikeVerboten}
              onChange={ev => { const v = ev.target.checked; setEingaben(x => ({ ...x, ebikeVerboten: v })) }} /> schnelle E-Bikes verboten</label>
            {!ueber30 && (eingaben.ebikeVerboten ? <div className="klein warnung">Häkchen ohne Wirkung: keine Velo-Prüfung über {TAB3_GRENZE} km/h.</div> :
              <div className="klein">(nicht wählbar: höchstens {TAB3_GRENZE} km/h)</div>)}
          </td></tr>
        </tbody>
      </table>
  )
}

/** Block «Hindernisse» (Schritt 3, E2a): Werkzeuge, Liste der Eingaben, Vorschläge, Quellen (amtliche Parkfelder, Baumkataster) */
function HindernisAbschnitt(p: {
  fall: Fall; aendern: (f: (x: Fall) => Fall) => void; stand: HindernisStand | null
  werkzeug: Werkzeug; werkzeugWaehlen: (w: Werkzeug) => void; zeichnung: P[]; fertig: (pts: P[]) => void; abbrechen: () => void
  bearbeiten: string | null; setBearbeiten: (f: (b: string | null) => string | null) => void
  klasse: ParkKlasse; setKlasse: (k: ParkKlasse) => void; breite: number; setBreite: (b: number) => void
  sichtbehindernd: boolean; setSichtbehindernd: (b: boolean) => void; dicht: boolean; setDicht: (b: boolean) => void
  parkKat: ParkStand | null; setParkKat: (f: (k: ParkStand | null) => ParkStand | null) => void
  baumKat: BaumStand | null; setBaumKat: (f: (k: BaumStand | null) => BaumStand | null) => void
  hinweis: string | null
  abstandMitte: number                               // Knotenpunkt bis Mitte der geladenen Kataster-Daten [m]
}) {
  const { fall, aendern, stand, werkzeug, bearbeiten, setBearbeiten, parkKat, baumKat } = p
  const waehlen = (id: string) => setBearbeiten(b => (b === id ? null : id))
  const verwerfen = (id: string) => { aendern(f => { f.vorschlaege[id] = 'verworfen'; return f }); setBearbeiten(() => null) }
  // bis die neue Rechnung da ist, steht der Vorschlag noch in der Liste: nicht zweimal aufnehmen
  const bestaetigen = (h: Hindernis) => {
    aendern(f => { if (!f.hindernisse.some(x => x.id === h.id)) f.hindernisse.push({ ...h, name: `${h.name ?? 'Vorschlag'} – bestätigt` }); return f })
    setBearbeiten(() => null)
  }
  const osm = (stand?.vorschlaege ?? []).filter(v => v.hindernis.quelle === 'osm')
  const katBaeume = (stand?.vorschlaege ?? []).filter(v => v.hindernis.quelle === 'kataster' && v.hindernis.art === 'baum')
  const amtlich = stand?.amtlich ?? []
  const parkAn = fall.parkkataster !== false
  const parkVerworfen = parkKat ? Object.keys(fall.vorschlaege).filter(id => istParkId(id, parkKat.quelle)) : []
  const andereVerworfen = Object.keys(fall.vorschlaege).filter(id => !parkKat || !istParkId(id, parkKat.quelle))
  const gewaehltAmtlich = amtlich.find(v => v.id === bearbeiten) ?? null
  const gewaehltVerworfen = stand?.amtlichVerworfen.find(v => v.id === bearbeiten) ?? null
  const gewaehltBaum = katBaeume.find(v => v.id === bearbeiten) ?? null
  const klasseZahl = (kl: ParkKlasse) => amtlich.filter(v => v.hindernis.art === 'parkfeld' && v.hindernis.klasse === kl).length
  const w = WERKZEUGE.find(x => x[0] === werkzeug)
  const alsLinie = (h: Hindernis): h is Extract<Hindernis, { art: 'hecke' | 'mauer' | 'uebrige' }> =>
    h.art === 'hecke' || h.art === 'mauer' || h.art === 'uebrige'
  return (
    <>
      {p.hinweis && <p className="klein hinweisbox">{p.hinweis}</p>}
      <div className="werkzeuge">
        {WERKZEUGE.map(([wz, name]) => (
          <button key={wz} className={werkzeug === wz ? 'aktiv' : 'zweit'} onClick={() => p.werkzeugWaehlen(wz)}>{name}</button>
        ))}
        <Info titel="Hindernisse zeichnen">
          <p>Werkzeug wählen und auf dem Luftbild zeichnen; mit «bearbeiten» Ecken auf der Karte ziehen.</p>
          <p>Parkfelder gelten als belegt (Velo und Motorrad nur Hinweis). Höhe von Hecken, Mauern und Zäunen vor Ort prüfen: sie zählen,
            wenn «sichtbehindernd» bzw. «dicht». Bäume zählen als Palisade erst ab {f1(PALISADE_MIN_M)} m zusammenhängend verdeckter
            Strecke.</p></Info>
      </div>
      {werkzeug && w && (
        <div className="werkzeughilfe">
          <b>{w[1]}:</b> {w[2]}
          {werkzeug === 'parkfeld' && <label> Klasse <select value={p.klasse} onChange={e => p.setKlasse(e.target.value as ParkKlasse)}>
            {(['auto', 'velo', 'motorrad'] as ParkKlasse[]).map(k => <option key={k} value={k}>{KLASSE_TEXT[k]}</option>)}</select></label>}
          {werkzeug === 'laengs' && <label> Breite <input type="number" step="0.1" min="1" max="6" value={p.breite}
            onChange={e => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) p.setBreite(Math.min(6, Math.max(1, v))) }} /> m
            (1 bis 6 m)</label>}
          {(werkzeug === 'hecke' || werkzeug === 'mauer' || werkzeug === 'flaeche') &&
            <label> <input type="checkbox" checked={p.sichtbehindernd} onChange={e => p.setSichtbehindernd(e.target.checked)} /> sichtbehindernd</label>}
          {werkzeug === 'zaun' && <label> <input type="checkbox" checked={p.dicht} onChange={e => p.setDicht(e.target.checked)} /> dicht
            (sonst sichtdurchlässig: nur Hinweis)</label>}
          {werkzeug !== 'baum' && <div><button onClick={() => p.fertig(p.zeichnung)} disabled={p.zeichnung.length < MIN_PUNKTE[werkzeug]}>Fertig</button>{' '}
            <button className="zweit" onClick={p.abbrechen}>Abbrechen</button></div>}
          {werkzeug === 'baum' && <div><button className="zweit" onClick={p.abbrechen}>Abbrechen</button></div>}
        </div>
      )}
      {!fall.hindernisse.length && <p className="klein">Noch keine Eingaben von Hand.</p>}
      <ul className="liste">
        {fall.hindernisse.map(h => (
          <li key={h.id} className={bearbeiten === h.id ? 'aktiv' : ''}>
            <span className={h.art === 'baum' ? 'farbe rund' : 'farbe'} style={{ background: hindernisFarbe(h) }} />{hindernisText(h)}
            {alsLinie(h) && <label className="klein"> <input type="checkbox" checked={h.sichtbehindernd} onChange={e => aendern(f => {
              const x = f.hindernisse.find(y => y.id === h.id)
              if (x && (x.art === 'hecke' || x.art === 'mauer' || x.art === 'uebrige')) x.sichtbehindernd = e.target.checked
              return f
            })} /> sichtbehindernd</label>}
            {h.art === 'zaun' && <label className="klein"> <input type="checkbox" checked={h.dicht} onChange={e => aendern(f => {
              const x = f.hindernisse.find(y => y.id === h.id)
              if (x && x.art === 'zaun') x.dicht = e.target.checked
              return f
            })} /> dicht</label>}
            <span className="aktionen">
              <button className="zweit klein" title="Ecken auf der Karte ziehen" onClick={() => waehlen(h.id)}>{bearbeiten === h.id ? 'fertig' : 'bearbeiten'}</button>
              <button className="zweit klein" onClick={() => { aendern(f => { f.hindernisse = f.hindernisse.filter(x => x.id !== h.id); return f })
                if (bearbeiten === h.id) setBearbeiten(() => null) }}>löschen</button>
            </span>
          </li>
        ))}
      </ul>
      {osm.length > 0 && <>
        <h3>Vorschläge: Parkierung aus OSM im Sichtfeld, prüfen ({osm.length})<Info titel="Vorschläge aus OSM">
          <p>Aus OSM-Tags abgeleitet, Lage und Breite angenommen. Bestätigen übernimmt den Vorschlag als Eingabe; verwerfen blendet ihn
            aus.</p></Info></h3>
        <p className="klein warnung">Zählen erst nach «bestätigen».</p>
        <ul className="liste">
          {osm.map(v => (
            <li key={v.id} className={bearbeiten === v.id ? 'aktiv' : ''}><span className="farbe gestrichelt" style={{ borderColor: hindernisFarbe(v.hindernis) }} />
              {v.hindernis.name}
              <span className="aktionen">
                <button className="klein" onClick={() => bestaetigen(v.hindernis)}>bestätigen</button>
                <button className="zweit klein" onClick={() => verwerfen(v.id)}>verwerfen</button>
              </span>
            </li>
          ))}
        </ul>
      </>}
      {stand && stand.osmUeberdeckt > 0 && <p className="klein">{stand.osmUeberdeckt} OSM-Vorschläge entfallen: amtliche Parkfelder decken sie ab.</p>}
      {andereVerworfen.length > 0 && <p className="klein"><button className="zweit klein" onClick={() => aendern(f => {
        for (const id of andereVerworfen) delete f.vorschlaege[id]; return f })}>verworfene Vorschläge wieder einblenden ({andereVerworfen.length})</button></p>}

      <h3>Quellen</h3>
      {parkKat ? (
        <div className="klein parkkataster">
          <label>
            <input type="checkbox" checked={parkAn} onChange={e => aendern(f => {
              if (e.target.checked) { delete f.parkkataster; if (parkKat.felder) f.quellen.parkkataster = parkKat.quelle.quellenangabe }
              else { f.parkkataster = false; delete f.quellen.parkkataster }
              return f
            })} /> {parkKat.quelle.name}</label>
          <Info titel={parkKat.quelle.name}>
            <p>{parkKat.quelle.quellenangabe}; WFS map.bern.ch, Ausschnitt ±{KATASTER_RADIUS_M} m um den Knoten. Die Felder zählen ohne
              Bestätigung; einzelne auf der Karte anklicken und verwerfen.</p>
            <p>Nur öffentliche Felder: private Parkplätze von Hand ergänzen.</p></Info>
          {parkAn && !parkKat.felder && !parkKat.fehler && <div>werden geladen … (bis dahin ohne sie gerechnet)</div>}
          {parkKat.fehler && <div className="fehler">Nicht geladen: {parkKat.fehler}{' '}
            <button className="zweit klein" onClick={() => p.setParkKat(k => (k ? { ...k, felder: null, fehler: undefined, laedt: false } : k))}>erneut laden</button></div>}
          {parkAn && parkKat.felder && stand && <div>{amtlich.length} Felder bis {stand.reichweite} m vom Knoten zählen
            ({klasseZahl('auto')} Auto, {klasseZahl('velo')} Velo, {klasseZahl('motorrad')} Motorrad)
            {stand.reichweite + p.abstandMitte > KATASTER_RADIUS_M && <div className="warnung">Geladen nur bis ±{KATASTER_RADIUS_M} m
              um die Mitte der geladenen Daten{p.abstandMitte > 1 ? ` (${Math.round(p.abstandMitte)} m vom Knotenpunkt)` : ''}: weiter weg fehlen
              Felder.</div>}</div>}
          {gewaehltAmtlich && <div><button className="zweit klein" onClick={() => verwerfen(gewaehltAmtlich.id)}>gewähltes Parkfeld verwerfen</button>
            {' '}{gewaehltAmtlich.hindernis.name}</div>}
          {parkAn && gewaehltVerworfen && <div><button className="zweit klein" onClick={() => {
            aendern(f => { delete f.vorschlaege[gewaehltVerworfen.id]; return f }); setBearbeiten(() => null)
          }}>wieder zählen</button> {gewaehltVerworfen.hindernis.name} (verworfen)</div>}
          {parkVerworfen.length > 0 && <div><button className="zweit klein" onClick={() => aendern(f => {
            for (const id of parkVerworfen) delete f.vorschlaege[id]; return f })}>verworfene Parkfelder wieder einblenden ({parkVerworfen.length})</button></div>}
        </div>
      ) : <p className="klein">Amtliche Parkfelder: keine Quelle für diese Gemeinde<Info titel="Amtliche Parkfelder">
        <p>Bisher nur Stadt Bern. Parkierung von Hand zeichnen bzw. OSM-Vorschläge bestätigen.</p></Info></p>}
      {baumKat && (
        <div className="klein">
          <label><input type="checkbox" checked={fall.baumkataster} onChange={e => aendern(f => {
            f.baumkataster = e.target.checked
            if (!f.baumkataster) delete f.quellen.baumkataster
            return f
          })} /> {baumKat.quelle.name}</label>
          <Info titel={baumKat.quelle.name}>
            <p>{baumKat.quelle.quellenangabe}. Bäume bis zur Reichweite der Prüfung erscheinen als Vorschlag (gestrichelt, Stamm{' '}
              {f1(BAUM_STAMM_M)} m) und zählen erst nach «bestätigen»; einzelne auf der Karte anklicken.</p></Info>
          {fall.baumkataster && !baumKat.baeume && !baumKat.fehler && <div>wird geladen …</div>}
          {baumKat.fehler && <div className="fehler">Nicht geladen: {baumKat.fehler}{' '}
            <button className="zweit klein" onClick={() => p.setBaumKat(k => (k ? { ...k, baeume: null, fehler: undefined, laedt: false } : k))}>erneut laden</button></div>}
          {fall.baumkataster && baumKat.baeume && stand && <div>{katBaeume.length} Bäume bis {stand.reichweite} m als Vorschlag:
            zählen erst nach «bestätigen».
            {katBaeume.length > 0 && <>{' '}<button className="klein" onClick={() => aendern(f => {
              for (const v of katBaeume) if (!f.hindernisse.some(h => h.id === v.id)) f.hindernisse.push(v.hindernis)
              return f
            })}>alle bestätigen ({katBaeume.length})</button></>}</div>}
          {gewaehltBaum && <div>{gewaehltBaum.hindernis.name}:{' '}<button className="klein" onClick={() => bestaetigen(gewaehltBaum.hindernis)}>bestätigen</button>{' '}
            <button className="zweit klein" onClick={() => verwerfen(gewaehltBaum.id)}>verwerfen</button></div>}
        </div>
      )}
    </>
  )
}

// ---------------------------------------------------------------- Massnahmen (E3a, VSS 40 273 Ziffer 14)
/** Abschnitt «Massnahmen»: nur wenn eine Richtung nicht erfüllt ist; Klick auf ein Hindernis hebt es auf der Karte hervor,
 *  «übernehmen» setzt die Massnahme als Eingabe (Haltelinie, Stop, Tempo); Spiegel: Bedingungen zum Abhaken (im Fall gemerkt) */
function MassnahmenAbschnitt({ liste, hervor, setHervor, uebernehmen, spiegel, setSpiegel, laedt }: { liste: Massnahme[]; hervor: string | null
  setHervor: (id: string | null) => void; uebernehmen: (u: Uebernahme) => void; spiegel: string[]; setSpiegel: (k: string, an: boolean) => void
  laedt: boolean }) {
  const marke = (r: boolean | null) => (r === null ? null : <span className={r ? 'reicht' : 'reicht-nicht'}>{r ? 'reicht' : 'reicht nicht'}</span>)
  return (
    <section>
      <h2>5 Massnahmen <span className="klein">(VSS 40 273 Ziffer 14)</span><Info titel="Massnahmen">
        <p>Mindestens eine Richtung ist nicht erfüllt. Mögliche Massnahmen in der Reihenfolge der Ziffer 14, je als Variante der Rechnung
          ohne neue Daten; sie ändern das Ergebnis erst, wenn eine als Eingabe übernommen wird. Ab Massnahme 2 nur an bestehenden Knoten
          und Zufahrten, nicht bei Neuanlagen.</p>
        {liste.some(m => m.nr === 9) && <p>Rechtsvortritt: zuerst Ziffer 16 (Rechtsvortritt aufheben, wenn Sichtweite und Wahrnehmbarkeit
          nicht verhältnismässig zu verbessern sind) und die Wahrnehmbarkeit (Ziffer 18), dann die Massnahmen der Ziffer 14.</p>}
        <p>Ein Klick auf ein Hindernis hebt es auf der Karte hervor; «übernehmen» setzt die Massnahme als Eingabe.</p></Info></h2>
      {laedt && <p className="klein warnung">Die Längsneigung aus dem Höhenmodell lädt noch: vorläufig mit 0 % gerechnet.</p>}
      <ol className="massnahmen" style={laedt ? { opacity: 0.55 } : undefined}>
        {liste.map(m => <li key={m.nr}>
          {/* ohne Zeilen und Bedingungen ist der Text der Stand der Massnahme (z. B. «nicht anwendbar»): sichtbar, sonst im Info-Zeichen */}
          <b>{m.titel}</b>{m.text && (m.zeilen.length || m.bedingungen) ? <Info titel={m.titel}><p>{m.text}</p></Info> : null}
          {m.reicht !== null && <>{' · '}{marke(m.reicht)}</>}
          {m.text && !m.zeilen.length && !m.bedingungen && <div className="klein">{m.text}</div>}
          {m.zeilen.length > 0 && <ul className="liste">{m.zeilen.map((z, k) => <li key={k} className={z.id && z.id === hervor ? 'aktiv' : ''}>
            <span className="farbe rund" style={{ background: z.reicht === null ? '#94a3b8' : z.reicht ? STATUS_FARBE.erfuellt : STATUS_FARBE.nicht_erfuellt }} />
            {z.id ? <button className="verweis" title="auf der Karte hervorheben" onClick={() => setHervor(z.id === hervor ? null : z.id!)}>{z.text}</button> :
              <span>{z.text}</span>}
            {z.uebernehmen && <span className="aktionen"><button className="klein" onClick={() => uebernehmen(z.uebernehmen!)}>übernehmen</button></span>}
          </li>)}</ul>}
          {m.bedingungen && <div>
            <label><input type="checkbox" checked={!!m.sichtUnterMin} disabled /> direkte Sicht erst bei D unter
              {' '}{f2(HALTELINIE_MIN_M)} m hinter der Kante (gerechnet)</label>
            {m.bedingungen.map(([k, t]) => <label key={k}><input type="checkbox" checked={spiegel.includes(k)}
              onChange={e => setSpiegel(k, e.target.checked)} /> {t}</label>)}
            <div className="klein">{spiegel.filter(k => m.bedingungen!.some(b => b[0] === k)).length} von {m.bedingungen.length} Bedingungen
              abgehakt (ohne Bewertung)</div>
          </div>}
        </li>)}
      </ol>
    </section>
  )
}

// ---------------------------------------------------------------- Knoten und Zufahrt (E2b)
/** Tempo von Hand je Richtung: Art (Vorgabe OSM, signalisiert, VP, V85, fahrbar), Wert, Begründung; übernommen beim Verlassen
 *  des Felds bzw. mit Enter (nicht jede Taste eine Rechnung) */
function TempoZeile({ r, wert, setzen }: { r: RichtungErgebnis; wert: TempoEingabe | null; setzen: (t: TempoEingabe | null) => void }) {
  const [zahl, setZahl] = useState(String(wert?.wert ?? r.tempoVorgabe))
  const [text, setText] = useState(wert?.begruendung ?? '')
  useEffect(() => { setZahl(String(wert?.wert ?? r.tempoVorgabe)) }, [wert?.wert, r.tempoVorgabe])
  useEffect(() => { setText(wert?.begruendung ?? '') }, [wert?.begruendung])
  const n = Number(zahl.trim()), ok = zahl.trim() !== '' && Number.isInteger(n) && n >= TEMPO_MIN && n <= TEMPO_MAX
  const uebernehmen = () => {
    if (!wert) return
    const b = text.slice(0, BEGRUENDUNG_MAX)
    if ((ok && n !== wert.wert) || b !== wert.begruendung) setzen({ ...wert, wert: ok ? n : wert.wert, begruendung: b })
  }
  const enter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') uebernehmen() }
  const name = lageText(r)
  return (
    <div className="tempozeile">
      {name}, {r.strasse}:{' '}
      <select value={wert?.art ?? 'osm'} aria-label={`Tempo ${name}: Art`} onChange={ev => {
        const a = ev.target.value
        setzen(a === 'osm' ? null : { art: a as TempoArt, wert: wert?.wert ?? r.tempoVorgabe, begruendung: wert?.begruendung ?? '' })
      }}>
        <option value="osm">Vorgabe ({r.tempoVorgabe} km/h)</option>
        {TEMPO_ARTEN.map(a => <option key={a} value={a}>{TEMPO_ART_TEXT[a]}</option>)}
      </select>
      {wert && <>{' '}<input type="number" min={TEMPO_MIN} max={TEMPO_MAX} step={1} value={zahl} className={ok ? '' : 'falsch'}
        aria-label={`Tempo ${name} in km/h`} onChange={e => setZahl(e.target.value)} onBlur={uebernehmen} onKeyDown={enter} /> km/h
        <input type="text" className="begruendung" placeholder="Begründung (Quelle, Messung, Projekt)" maxLength={BEGRUENDUNG_MAX}
          aria-label={`Tempo ${name}: Begründung`} value={text} onChange={e => setText(e.target.value)} onBlur={uebernehmen} onKeyDown={enter} /></>}
      {wert && !ok && <span className="fehler klein"> ganze Zahl von {TEMPO_MIN} bis {TEMPO_MAX} eingeben (gilt weiter: {wert.wert} km/h)</span>}
      {wert ? <div className="klein">(<Hand />; Vorgabe {r.tempoVorgabe} km/h)</div> :
        <>{' '}<span className={r.tempoAnnahme ? 'klein warnung' : 'klein'}>({kurzQuelle(r.tempoVorgabeQuelle)})</span></>}
    </div>
  )
}

/** Hilfe zum Werkzeug «Zufahrt setzen» (Grundstückzufahrt) */
function ZufahrtHilfe({ erster, senkrecht, abbrechen }: { erster: P | null; senkrecht: () => void; abbrechen: () => void }) {
  return (
    <div className="werkzeughilfe">
      <b>Zufahrt setzen:</b> {erster ? 'zweiter Klick auf der Zufahrt (im Grundstück) zeichnet ihre Richtung; oder senkrecht zum Rand ' +
        'übernehmen.' : 'Punkt auf dem Fahrbahnrand der Vortrittsstrasse anklicken, in der Mitte der Zufahrt (bzw. auf einen OSM-Weg ' +
        'service nahe der Einmündung).'}
      <div><button onClick={senkrecht} disabled={!erster}>senkrecht zum Rand übernehmen</button>{' '}
        <button className="zweit" onClick={abbrechen}>Abbrechen</button></div>
    </div>
  )
}

/** Vortrittsregelung der Zufahrt (bzw. des Knotens beim Rechtsvortritt), über der Armwahl: Auswahl, Vorgabe aus den OSM-Signalen,
 *  beim Rechtsvortritt zusätzlich die Wahrnehmbarkeit und «alle Arme prüfen». Ohne Rechnung (noch kein Arm gewählt) nur die Auswahl. */
function RegelungAbschnitt({ e, eingaben, setEingaben }: { e: Ergebnis | null; eingaben: Eingaben
  setEingaben: (f: (x: Eingaben) => Eingaben) => void }) {
  const regelung = eingaben.regelung ?? e?.regelungVorgabe ?? 'vortritt'
  return (
    <table className="zahlen">
      <tbody>
          <tr><td>Regelung für die gewählte Zufahrt<Info titel="Regelung für die gewählte Zufahrt">
            <p>Die Regelung gilt für die gewählte Zufahrt: «Kein Vortritt» (Signal 3.02) bzw. «Stop» (Signal 3.01) heisst, diese Zufahrt
              muss den Vortritt gewähren; «Rechtsvortritt» ohne Signal.</p>
            <p>Vorgabe aus den Signalen in OSM an der Zufahrt (highway=stop: «Stop», highway=give_way: «Kein Vortritt»), sonst nach der
              Vortrittsstrasse{e ? `; hier ${e.regelungQuelle}: ` +
              `«${REGELUNG_TEXT[e.regelungVorgabe]}»` : ', sobald ein Arm gewählt ist'}.</p>
            {regelung === 'stop' && <p>Stop: B {f2(B_INNERORTS_M)} m auch ausserorts (Ziffer 12).</p>}
            {regelung === 'rechtsvortritt' && e?.zufahrtspunkt && <p>Rechtsvortritt gilt an einer Grundstückzufahrt nicht (VRV Art. 15
              Abs. 3): gerechnet wie «Kein Vortritt».</p>}
            {regelung === 'rechtsvortritt' && !e?.zufahrtspunkt && <p>Rechtsvortritt: Prüfung nach Teil E (Ziffern 15 bis 18), alle Arme
              vortrittsbelastet, geprüft gegen den Arm rechts der Zufahrt; B {f2(RV_B_M)} m; die Norm geht von {RV_TEMPO} km/h aus.</p>}</Info></td><td>
            <select value={regelung} aria-label="Regelung für die gewählte Zufahrt"
              onChange={ev => {
                const r = ev.target.value as Regelung
                // weg vom Rechtsvortritt: Wahrnehmbarkeit und «alle Arme» zurücksetzen (gelten nur dort)
                setEingaben(x => ({ ...x, regelung: r, ...(r !== 'rechtsvortritt' ? { wahrnehmbarkeit: null, alleArme: false, markierungRv: false } : {}) }))
              }}>
              {REGELUNGEN.map(r => <option key={r} value={r}>{REGELUNG_TEXT[r]}</option>)}
            </select>
            {eingaben.regelung !== null && e && <>{' '}<button className="zweit klein" onClick={() => setEingaben(x => ({ ...x, regelung: null }))}>Vorgabe</button></>}
            <div className="klein">{!e ? (eingaben.regelung !== null ? '(gewählt)' : '(Vorgabe aus OSM, sobald ein Arm gewählt ist)') :
              eingaben.regelung !== null ? `(gewählt; Vorgabe ${REGELUNG_TEXT[e.regelungVorgabe]})` :
              <span className="warnung">({annahmeText(e.regelungQuelle)})</span>}</div>
            {regelung === 'rechtsvortritt' && e?.zufahrtspunkt && <div className="klein warnung">Gilt an einer Grundstückzufahrt nicht:
              gerechnet wie «Kein Vortritt».</div>}
            {eingaben.regelung === 'rechtsvortritt' && eingaben.trottoirueberfahrt && !e?.zufahrtspunkt && <div className="klein warnung">Gilt an
              einer Trottoirüberfahrt nicht (VSS 40 242 Ziffer 12.3): gerechnet wie «Kein Vortritt».</div>}
          </td></tr>
          {regelung === 'rechtsvortritt' && !e?.zufahrtspunkt && !eingaben.trottoirueberfahrt && <tr><td>Wahrnehmbarkeit des Knotens<Info titel="Wahrnehmbarkeit">
            {/* Text vom Nutzer formuliert (31.10.2026) */}
            <p><b>Wahrnehmbarkeit:</b> Wie gut erkennen Fahrende rechtzeitig, dass hier eine Kreuzung mit Rechtsvortritt kommt? Je
              schlechter, desto mehr Sichtweite braucht es. Die App kann das nicht messen, bitte vor Ort einstufen.</p>
            <p>Eher gut (Beispiele Abb. 7–9, S. 12–13): Hecken oder Gärten enden vor der Kreuzung; ein Gehweg führt sichtbar um die Ecke;
              besondere Markierung «Rechtsvortritt» oder eine Aufpflästerung des Knotens.</p>
            <p>Aus Wahrnehmbarkeit und gemessener Sichtweite folgt der Zustand nach Abb. 6: anzustreben, zulässig oder zu sanieren.</p>
            <p>(VSS 40 273 Z. 9, S. 4; Z. 17 und 18, S. 11–13)</p>
            <p>«besondere Markierung Rechtsvortritt vorhanden»: die Markierung nach VSS 40 851 lässt sich aus den Daten nicht erkennen; das
              Häkchen erinnert an sie bei der Einstufung und erscheint im Bericht, die Rechnung bleibt gleich.</p>
            <p>«alle Arme prüfen»: Die App prüft nicht nur die gewählte Zufahrt, sondern jeden Arm gegen den Arm rechts davon und zeigt
              das Ergebnis als Tabelle.</p></Info></td><td>
            <select value={eingaben.wahrnehmbarkeit ?? 'vorgabe'} aria-label="Wahrnehmbarkeit des Knotens"
              onChange={ev => { const v = ev.target.value; setEingaben(x => ({ ...x, wahrnehmbarkeit: v === 'vorgabe' ? null : v as Wahrnehmbarkeit })) }}>
              <option value="vorgabe">Vorgabe ({WAHRNEHMBARKEIT_TEXT[WAHRNEHMBARKEIT_VORGABE]})</option>
              {WAHRNEHMBARKEITEN.map(w => <option key={w} value={w}>{WAHRNEHMBARKEIT_TEXT[w]}</option>)}
            </select>
            {' '}<span className={eingaben.wahrnehmbarkeit ? 'klein' : 'klein warnung'}>({eingaben.wahrnehmbarkeit ? 'gewählt' : 'Annahme'})</span>
            <div><label><input type="checkbox" checked={!!eingaben.markierungRv}
              onChange={ev => { const v = ev.target.checked; setEingaben(x => ({ ...x, markierungRv: v })) }} /> besondere Markierung
              «Rechtsvortritt» vorhanden</label>{' '}<span className="klein">(VSS 40 851; Hilfe zur Einstufung, ohne Wirkung auf die
              Rechnung)</span></div>
            <label><input type="checkbox" checked={!!eingaben.alleArme}
              onChange={ev => { const v = ev.target.checked; setEingaben(x => ({ ...x, alleArme: v })) }} /> alle Arme prüfen</label>
          </td></tr>}
      </tbody>
    </table>
  )
}

/** Breite der Trottoirüberfahrt von Hand [m] (K0): übernommen beim Verlassen des Felds bzw. mit Enter; leer = ohne Eingabe */
const breiteLesen = (t: string): number | null | undefined => {
  const x = t.trim().replace(',', '.')
  if (!x) return null
  const v = Number(x)
  return Number.isFinite(v) && v >= TUE_BREITE_MIN && v <= TUE_BREITE_MAX ? Math.round(v * 100) / 100 : undefined
}
function TueBreiteFeld({ wert, onWert }: { wert: number | null; onWert: (v: number | null) => void }) {
  const [text, setText] = useState(wert === null ? '' : f2(wert))
  useEffect(() => { setText(t => (breiteLesen(t) === wert ? t : wert === null ? '' : f2(wert))) }, [wert])
  const v = breiteLesen(text)
  const uebernehmen = () => { if (v !== undefined && v !== wert) onWert(v) }
  return <>
    <input type="text" inputMode="decimal" size={5} aria-label="Breite der Trottoirüberfahrt in Metern" placeholder="leer" value={text}
      className={v === undefined ? 'falsch' : ''} onChange={e => setText(e.target.value)} onBlur={uebernehmen}
      onKeyDown={e => { if (e.key === 'Enter') uebernehmen() }} /> m
    {v === undefined && <span className="fehler klein"> Zahl zwischen {f2(TUE_BREITE_MIN)} und {f2(TUE_BREITE_MAX)} m oder leer</span>}
  </>
}

/** Trottoirüberfahrt im Ergebnis (K0): Breite mit Herkunft, Vortritt, Status je Phase */
function TueBlock({ t }: { t: TueErgebnis }) {
  const zeile = (name: string, p: TuePhase, was: string) => <li>
    <span className="richtungsname"><span className="farbe rund" style={{ background: STATUS_FARBE[p.status] }} />{name}:{' '}
      <span className="klein">{was}</span></span>
    <span className="felder"><Feld s={{ feld: tuePhaseText(p), kurz: '', farbe: STATUS_FARBE[p.status] }} /></span></li>
  return (
    <div className="tue">
      <h3>Trottoirüberfahrt<Info titel="Trottoirüberfahrt (VSS 40 242)">
        <p>Sicht in zwei Phasen (VSS 40 242 Ziffer 14.4, Werte nach VSS 40 273):</p>
        <ul>
          <li>Phase Trottoir: D' = B {f2(B_INNERORTS_M)} m hinter dem hinteren Rand der Überfahrt (VSS 40 273 Ziffer 13.2), Zielpunkte
            auf der Gehlinie{' '}
            {f2(TUE_GEHLINIE_M)} m vor dem hinteren Rand der Überfahrt (Tab. 2, nach der Längsneigung des Trottoirs). Spalte «Trottoir» unten.</li>
          <li>Phase Fahrbahn: B ab der Bordkante (vorderer Rand der Überfahrt), Motorfahrzeuge Tab. 1, Velo Tab. 3. Spalten «Auto» und
            «Velo» unten.</li>
        </ul>
        <p>{t.regelungText}.</p>
        <p>Breite: {t.breiteText}. Reihenfolge: von Hand, AV-Trottoir quer über die Zufahrt, schmaleres angrenzendes AV-Trottoir
          (2,00 bis 3,50 m), sonst {f2(TUE_BREITE_ANNAHME_M)} m (Annahme). Hinterer Rand beidseits gleich weit hinter dem Fahrbahnrand;
          auf der Zufahrtsachse Breite / sin α.</p></Info></h3>
      <p className="klein">Breite {f2(t.breite)} m <span className={t.breiteQuelle === 'annahme' ? 'warnung' : ''}>
        ({TUE_BREITE_KURZ[t.breiteQuelle]})</span>, hinterer Rand {f2(t.laenge)} m hinter der Bordkante entlang der Zufahrtsachse;{' '}
        {t.regelungText.split(':')[0]}.</p>
      <ul className="gesamtstatus">
        {zeile('Phase Trottoir', t.phaseTrottoir, `ab dem hinteren Rand, Gehlinie ${f2(t.gehlinie)} m vor dem hinteren Rand der Überfahrt`)}
        {zeile('Phase Fahrbahn', t.phaseFahrbahn, 'ab der Bordkante (vorderer Rand)')}
      </ul>
    </div>
  )
}

/** Block «Zufahrt» (Schritt 3, E2b): Haltelinie, D, Trottoir, Tempo je Richtung; die Vortrittsregelung steht in Schritt 2 */
function KnotenAbschnitt({ e, eingaben, setEingaben, werkzeug, werkzeugWaehlen }: { e: Ergebnis; eingaben: Eingaben
  setEingaben: (f: (x: Eingaben) => Eingaben) => void; werkzeug: KnotenWerkzeug; werkzeugWaehlen: (w: KnotenWerkzeug) => void }) {
  const halteAktiv = werkzeug === 'haltelinie'
  const dAktiv = werkzeug === 'd'
  return (
      <table className="zahlen">
        <tbody>
          <tr><td>Halte- oder Wartelinie<Info titel="Halte- oder Wartelinie">
            <p>Bei «Stop» die Haltelinie (SSV Markierung 6.10), bei «Kein Vortritt» die Wartelinie (SSV Markierung 6.13). B gilt ab ihrem
              vorderen Rand, der Vorderkante (VSS 40 273 Ziffer 5, S. 4). Liegt sie vor der Kante bzw. Trottoirhinterkante (vorverlegt), ist
              das eine Ausnahme nach Ziffer 14: nur an bestehenden Knoten und Zufahrten.</p>
            <p>Setzen: Vorderkante (Seite zur Vortrittsstrasse) nahe der Zufahrtsachse anklicken; die App lotet den Punkt auf die Achse.</p></Info></td><td>
            {e.haltelinie ? <>{f2(Math.abs(e.haltelinie.abstand))} m {e.haltelinie.abstand >= 0 ? 'hinter' : 'vor'} der Kante{' '}
              <span className="klein">(<Hand />{e.haltelinie.vorverlegt && <span className="warnung">, vorverlegt</span>})</span>{' '}</> :
              eingaben.haltelinie ? <span className="warnung">gesetzt, aber nicht gerechnet (siehe Hinweise) </span> : <>keine{' '}</>}
            <button className={halteAktiv ? 'aktiv klein' : 'zweit klein'} onClick={() => werkzeugWaehlen(halteAktiv ? null : 'haltelinie')}>
              {eingaben.haltelinie ? 'neu setzen' : 'Halte- oder Wartelinie setzen'}</button>
            {eingaben.haltelinie && <>{' '}<button className="zweit klein" onClick={() => setEingaben(x => ({ ...x, haltelinie: null }))}>entfernen</button></>}
            {halteAktiv && <div className="werkzeughilfe"><b>Halte- oder Wartelinie:</b> Vorderkante (vorderer Rand, Seite zur
              Vortrittsstrasse) nahe der Zufahrtsachse anklicken; die App lotet den Punkt auf die Achse.{' '}
              <button className="zweit klein" onClick={() => werkzeugWaehlen(null)}>Abbrechen</button></div>}
          </td></tr>
          <tr><td>Beobachtungspunkt D<Info titel="Beobachtungspunkt D">
            <p>D ist das Auge von F<sub>B</sub>: {e.zufahrtVelo ? `Velofahrer auf der Achse des Velogegenverkehrs (${e.zufahrtVelo.lageText})` :
              `Fahrersitz, ${f2(FAHRERSITZ_M)} m links der Achse des Zufahrtsstreifens`}, B {f2(e.B)} m hinter der {e.nullpunktText}.</p>
            <p>«D setzen» und auf der Karte die neue Stelle anklicken, oder den Punkt D auf der Karte ziehen: dann gilt D von Hand;
              «zurücksetzen» stellt die Vorgabe wieder her.</p></Info></td><td>
            {e.Dhand ? <>{f2(e.Dlage.laengs)} m hinter der {e.nullpunktText}, {f2(Math.abs(e.Dlage.seitlich))} m{' '}
              {e.Dlage.seitlich >= 0 ? 'links' : 'rechts'} der Achse <span className="klein">(<Hand />)</span>{' '}</> :
              <>{e.zufahrtVelo ? 'Velofahrer' : 'Fahrersitz'}, B {f2(e.B)} m <span className="klein">(Vorgabe)</span>{' '}</>}
            <button className={dAktiv ? 'aktiv klein' : 'zweit klein'} onClick={() => werkzeugWaehlen(dAktiv ? null : 'd')}>
              {e.Dhand ? 'neu setzen' : 'D setzen'}</button>
            {e.Dhand && <>{' '}<button className="zweit klein" onClick={() => setEingaben(x => ({ ...x, D: null }))}>zurücksetzen</button></>}
            {dAktiv && <div className="werkzeughilfe"><b>D setzen:</b> auf der Karte die Stelle des Fahrersitzes anklicken (oder den Punkt D
              ziehen); D gilt dann von Hand, F<sub>B</sub> folgt.{' '}
              <button className="zweit klein" onClick={() => werkzeugWaehlen(null)}>Abbrechen</button></div>}
            {dWarnungen(e).map(w => <div key={w} className="klein warnung">{w}</div>)}
          </td></tr>
          <tr><td>Trottoirüberfahrt<Info titel="Trottoirüberfahrt (VSS 40 242)">
            <p>Häkchen, wenn über diese Einmündung eine Trottoirüberfahrt führt bzw. geplant ist. Dann gilt kein Rechtsvortritt (die Zufahrt
              ist vortrittsbelastet, VSS 40 242 Ziffer 12.3), und die Sicht wird in zwei Phasen geprüft (Ziffer 14.4): aufs Trottoir ab dem
              hinteren Rand der Überfahrt (D' = B {f2(B_INNERORTS_M)} m dahinter, VSS 40 273 Ziffer 13.2; Gehlinie {f2(TUE_GEHLINIE_M)} m vor
              dem hinteren Rand der Überfahrt,
              Tab. 2), auf die Fahrbahn ab der Bordkante (B ab dem vorderen Rand, Tab. 1 und Tab. 3).</p>
            <p>Breite der Überfahrt: von Hand, sonst AV-Trottoir quer über die Zufahrt, sonst das schmalere angrenzende AV-Trottoir links
              bzw. rechts, begrenzt auf 2,00 bis 3,50 m (an vielen Einmündungen ist die Zufahrt in der AV durchgehend Strasse), sonst
              {' '}{f2(TUE_BREITE_ANNAHME_M)} m als Annahme.</p></Info></td><td>
            <label><input type="checkbox" checked={!!eingaben.trottoirueberfahrt}
              onChange={ev => { const v = ev.target.checked; setEingaben(x => ({ ...x, trottoirueberfahrt: v ? { breite: null } : null })) }} />
              {' '}über diese Einmündung</label>
            {e.trottoirueberfahrt && <>{' '}<span className="klein">(Breite {f2(e.trottoirueberfahrt.breite)} m,{' '}
              <span className={e.trottoirueberfahrt.breiteQuelle === 'annahme' ? 'warnung' : ''}>{TUE_BREITE_KURZ[e.trottoirueberfahrt.breiteQuelle]}</span>)</span></>}
            {eingaben.trottoirueberfahrt && <div className="klein">Breite von Hand{' '}
              <TueBreiteFeld wert={eingaben.trottoirueberfahrt.breite}
                onWert={b => setEingaben(x => ({ ...x, trottoirueberfahrt: { breite: b } }))} />{' '}
              (geht der AV vor)</div>}
            {e.trottoirueberfahrt && <div className="klein">D' (Phase Trottoir): {e.trottoirueberfahrt.DtrottoirQuelle === 'hand' ?
              <><Hand />{' '}<button className="zweit klein" onClick={() => setEingaben(x => ({ ...x, Dtrottoir: null }))}>zurücksetzen</button></> :
              `B ${f2(B_INNERORTS_M)} m hinter dem hinteren Rand (VSS 40 273 Ziffer 13.2; Vorgabe, auf der Karte ziehen)`}</div>}
            {!e.trottoirueberfahrt && eingaben.Dtrottoir && <div className="klein warnung">D' von Hand gesetzt, gilt nur mit dem Häkchen{' '}
              <button className="zweit klein" onClick={() => setEingaben(x => ({ ...x, Dtrottoir: null }))}>entfernen</button></div>}
          </td></tr>
          <tr><td>Trottoir<Info titel="Trottoir">
            <p>Wählbar, wenn die AV ein Trottoir quer über die Zufahrt zeigt (Beginn höchstens {String(TROTTOIR_BIS_M).replace('.', ',')} m
              hinter der Kante, höchstens {TROTTOIR_MAX_M} m lang).{e.trottoir ? ` AV: Trottoir ${f1(e.trottoir.breite)} m zwischen Zufahrt und ` +
              'Vortrittsstrasse.' : ` Hier nicht wählbar: ${e.trottoirGrund}.`}</p>
            <p>Ohne Häkchen wartet F<sub>B</sub> vor dem Trottoir, B ab der Trottoirhinterkante; mit Häkchen («Trottoir ohne Hindernisse»)
              an der Bordkante, B ab der Bordkante (Ziffer 13.1). Eine Halte- oder Wartelinie geht vor.</p></Info></td><td>
            {e.trottoirueberfahrt ? <span className="klein">Trottoirüberfahrt: F<sub>B</sub> an der Bordkante (Phase Fahrbahn), D' = B{' '}
              {f2(B_INNERORTS_M)} m hinter dem hinteren Rand (Phase Trottoir, VSS 40 273 Ziffer 13.2); das Häkchen «ohne Hindernisse» gilt hier nicht.</span> : <>
            <label style={e.trottoir ? undefined : { opacity: 0.55 }}>
              <input type="checkbox" disabled={!e.trottoir && !eingaben.trottoirFrei} checked={eingaben.trottoirFrei}
                onChange={ev => { const v = ev.target.checked; setEingaben(x => ({ ...x, trottoirFrei: v })) }} /> ohne Hindernisse:
              F<sub>B</sub> an der Bordkante</label>
            {' '}<span className="klein">({e.trottoir ? `AV: ${f1(e.trottoir.breite)} m` : 'keines nach AV'})</span>
            {eingaben.trottoirFrei && !e.trottoir && <div className="klein warnung">Häkchen ohne Wirkung: kein Trottoir nach AV.</div>}
            {eingaben.trottoirFrei && e.trottoir && e.haltelinie && <div className="klein warnung">Häkchen ohne Wirkung auf B: die Halte- oder
              Wartelinie geht vor.</div>}</>}
          </td></tr>
          <tr><td>Tempo je Richtung<Info titel="Tempo">
            <p>Welches Tempo massgebend ist, regelt Ziffer 10 (signalisiert, Projektierungsgeschwindigkeit VP, V85 bzw. fahrbares Tempo);
              Art und Begründung festhalten.</p>
            {e.rechtsvortritt && <p>Rechtsvortritt: {RV_TEMPO_TEXT} Das Tempo wirkt hier auf die Velos (Tab. 3, S. 9).</p>}
            {<ul>{e.richtungen.map(r => <li key={r.richtung}>{lageText(r)}: Vorgabe {r.tempoVorgabe} km/h aus{' '}
                {r.tempoVorgabeQuelle}</li>)}</ul>}</Info></td><td>
            {e.richtungen.filter(r => !rvNichtGeprueft(r)).map(r => <TempoZeile key={r.richtung} r={r} wert={eingaben.tempo[r.richtung]}
              setzen={t => setEingaben(x => ({ ...x, tempo: { ...x.tempo, [r.richtung]: t } }))} />)}
            {e.rechtsvortritt && <div className="klein">{RV_TEMPO_TEXT}</div>}
          </td></tr>
        </tbody>
      </table>
  )
}

// ---------------------------------------------------------------- Eingabeblöcke (Schritt 3) und «Hinweise und Annahmen»
/** Aufklappzustand je Block im Browser (nur Bequemlichkeit, darf fehlen): «SichtweitenCheck.panel.<block>» = «1» bzw. «0» */
const PANEL_SPEICHER = 'SichtweitenCheck.panel.'
const BLOECKE = ['zufahrt', 'erforderlich', 'velo', 'hindernisse', 'hinweise'] as const
type BlockName = typeof BLOECKE[number]
function offenLesen(): Record<BlockName, boolean> {
  const o = {} as Record<BlockName, boolean>
  for (const b of BLOECKE) { try { o[b] = localStorage.getItem(PANEL_SPEICHER + b) === '1' } catch { o[b] = false } }
  return o
}
/** Strassentyp kurz für die Kurzzeile */
const TYP_KURZ: Record<Strassentyp, string> = { es: 'Erschliessungsstrasse', hvs: 'Hauptverkehrsstrasse' }

/** eingeklappter Block: in der summary Name und Kurzzeile (Stand, «von Hand», sobald im Block etwas gesetzt ist) */
function Block({ titel, stand, hand = false, offen, setOffen, children }: { titel: React.ReactNode; stand?: string; hand?: boolean
  offen: boolean; setOffen: (o: boolean) => void; children: React.ReactNode }) {
  return (
    <details className="abschnitt block" open={offen}
      onToggle={ev => { const o = (ev.currentTarget as HTMLDetailsElement).open; if (o !== offen) setOffen(o) }}>
      <summary><h3>{titel}</h3>{(stand || hand) && <span className="stand">{stand}{stand && hand ? ' · ' : ''}{hand &&
        <b>von Hand</b>}</span>}</summary>
      <div className="blockinhalt">{children}</div>
    </details>
  )
}

/** «OSM lanes=2» -> «aus OSM lanes=2», «ohne OSM lanes» bleibt («Vorgabe ohne OSM lanes») */
const quelleText = (q: string) => (q.startsWith('ohne') ? q : `aus ${q}`)
/** Stand einer Vorgabe, die eine Annahme ist: «Annahme aus OSM highway=residential», «Annahme, ohne Signal in OSM» */
const annahmeText = (q: string) => (q.startsWith('ohne') ? `Annahme, ${q}` : `Annahme aus ${q}`)
/** Quelle ohne Zusatz in Klammern: «OSM maxspeed (Mehrheit entlang der Achse)» -> «OSM maxspeed» */
const kurzQuelle = (q: string) => q.replace(/\s*\([^()]*\)\s*$/, '') || q
/** Warnungen zu D (Folge: Sicht falsch bzw. Hindernis nicht gerechnet), aus den Hinweisen der Rechnung */
const dWarnungen = (e: Ergebnis) => e.hinweise.filter(h => h.startsWith('D liegt '))
/** «von Hand» im Stand einer Zeile (braun wie die Annahmen) */
const Hand = () => <span className="warnung">von Hand</span>

export default function App({ onStartseite }: { onStartseite?: () => void } = {}) {
  const kartenRef = useRef<L.Map | null>(null)
  // Breite des Panels (Trenner wie fgsCheck, gespeichert in localStorage; CSS-Variable --panel-breite); danach Karte neu vermessen
  const [panelBreite, setPanelBreite] = useState(() => ladeBreite(window.innerWidth))
  const trennerFertig = useCallback(() => { requestAnimationFrame(() => kartenRef.current?.invalidateSize()) }, [])
  const workerRef = useRef<Worker | null>(null)
  const abbruchRef = useRef<AbortController | null>(null)
  const auftrag = useRef(0)
  const [knoten, setKnoten] = useState<OsmKnoten[]>([])
  const [gewaehlt, setGewaehlt] = useState<OsmKnoten | null>(null)
  const [daten, setDaten] = useState<Daten | null>(null)
  const [av, setAv] = useState<AvFlaeche[] | null>(null)
  const [rechnung, setRechnung] = useState<Rechnung | null>(null)
  const [rechnet, setRechnet] = useState(false)
  const [meldung, setMeldung] = useState<string>('Ort suchen bzw. Karte verschieben; dann einen Knoten (blauer Punkt) anklicken.')
  const [nochmals, setNochmals] = useState<{ wahl: Wahl; fall: Fall | null } | null>(null)   // nach einem Fehler beim Laden: «erneut laden»
  const [avFehler, setAvFehler] = useState<string | null>(null)               // Nachladen der AV gescheitert
  const [quellen, setQuellen] = useState<Record<string, QuellenStand>>({})
  const rechnungFuer = useRef('')                      // Daten und Ziel der angezeigten Rechnung (Höhenprofile, E3a)
  // mit Zeitpunkt des Abrufs, sobald geladen (Quellen im Bericht)
  const setzeQuelle = (k: string, s: QuellenStand) => {
    const x = s.ms !== undefined ? { ...s, zeit: new Date().toISOString() } : s
    setQuellen(q => ({ ...q, [k]: x }))
  }
  const [berichtOffen, setBerichtOffen] = useState(false)
  const berichtSchliessen = useCallback(() => setBerichtOffen(false), [])

  // ---------------------------------------------------------------- Worker
  const aktiv = useRef(true)
  const laufend = useRef(new Set<() => void>())
  const neuerWorker = () => {
    workerRef.current?.terminate()
    workerRef.current = aktiv.current ? new Worker(new URL('./rechner/worker.ts', import.meta.url), { type: 'module' }) : null
    return workerRef.current
  }
  useEffect(() => {
    aktiv.current = true
    neuerWorker()
    const offen = laufend.current
    return () => {
      aktiv.current = false
      auftrag.current++
      for (const f of [...offen]) f()
      abbruchRef.current?.abort()
      workerRef.current?.terminate(); workerRef.current = null
    }
  }, [])

  const rechnen = useCallback(async (d: Daten, ziel: Ziel, eg: Eingaben, hg: HindernisEingaben, hoehen: HoehenVorgabe | null,
    tempoAmtlich: TempoAmtlichDaten | null) => {
    const nr = ++auftrag.current
    const w = workerRef.current ?? neuerWorker()
    if (!w) return
    setRechnet(true)
    const antwort = await new Promise<{ ok: boolean; rechnung?: Rechnung; fehler?: string }>(res => {
      const fertig = (x: { ok: boolean; rechnung?: Rechnung; fehler?: string }) => {
        clearTimeout(t); w.removeEventListener('message', h); w.removeEventListener('error', fe); laufend.current.delete(abbrechen); res(x)
      }
      const abbrechen = () => fertig({ ok: false, fehler: 'abgebrochen' })
      laufend.current.add(abbrechen)
      const h = (ev: MessageEvent) => { if (ev.data.id === nr) fertig(ev.data) }
      const fe = (ev: ErrorEvent) => { neuerWorker(); fertig({ ok: false, fehler: `Worker-Fehler: ${ev.message || 'unbekannt'}` }) }
      const t = setTimeout(() => { neuerWorker(); fertig({ ok: false, fehler: `keine Antwort innert ${WORKER_MS / 1000} s` }) }, WORKER_MS)
      w.addEventListener('message', h)
      w.addEventListener('error', fe)
      w.postMessage({ id: nr, osm: d.osm, av: d.av, avRadius: d.avRadius, avZentrum: d.ort, knoten: ziel.knoten, zufahrt: ziel.zufahrt,
        zufahrtspunkt: ziel.zufahrtspunkt, eingaben: eg, hindernisse: hg, hoehen, tempoAmtlich })
    })
    if (nr !== auftrag.current) return
    setRechnet(false)
    // keine alten Zahlen zu neuen Eingaben stehen lassen
    if (!antwort.ok) { setRechnung(null); setBerichtOffen(false); setMeldung(`Fehler in der Rechnung: ${antwort.fehler}`); return }
    rechnungFuer.current = `${datenKey(d)}|${JSON.stringify(ziel)}`
    setRechnung(antwort.rechnung!)
    setMeldung(antwort.rechnung!.meldungen.join(' '))
  }, [])

  // ---------------------------------------------------------------- Fall (E2a Hindernisse, E2b Zufahrt und Eingaben)
  // Je Knoten bzw. Zufahrtspunkt im localStorage gemerkt (fall.ts); nach jeder Änderung neu gerechnet. Zufahrt, Zufahrtspunkt und
  // Eingaben (E1, E2b) stehen im Fall; für die Rechnung über ihren JSON-Text, damit eine andere Änderung am Fall nicht neu rechnet
  const [fall, setFall] = useState<Fall | null>(null)
  const [fallHinweis, setFallHinweis] = useState<string | null>(null)
  const aendern = useCallback((f: (x: Fall) => Fall) => setFall(x => (x ? f(structuredClone(x)) : x)), [])
  useEffect(() => { if (fall) fallMerken(fall) }, [fall])
  const fallRef = useRef<Fall | null>(null)
  fallRef.current = fall
  const zielJson = JSON.stringify(fall ? { knoten: fall.ort.knoten, zufahrt: fall.ort.zufahrt, zufahrtspunkt: fall.ort.zufahrtspunkt ?? null } : null)
  const ziel = useMemo<Ziel | null>(() => JSON.parse(zielJson), [zielJson])
  const egJson = JSON.stringify(fall?.eingaben ?? KEINE_ALLE_EINGABEN)
  const eingaben = useMemo<Eingaben>(() => JSON.parse(egJson), [egJson])
  const setEingaben = useCallback((f: (e: Eingaben) => Eingaben) => aendern(x => { x.eingaben = f(x.eingaben); return x }), [aendern])
  const zufahrt = ziel?.zufahrt ?? null
  const [knotenWerkzeug, setKnotenWerkzeug] = useState<KnotenWerkzeug>(null)
  const [zufahrtErster, setZufahrtErster] = useState<P | null>(null)
  const ladeNr = useRef(0)
  const [parkKat, setParkKat] = useState<ParkStand | null>(null)
  const [baumKat, setBaumKat] = useState<BaumStand | null>(null)
  const [vsigKat, setVsigKat] = useState<VsigStand | null>(null)
  // K0: amtliches Tempo für die Rechnung (nur geladene Linien des aktuellen Ladevorgangs)
  const vsigLinien = vsigKat?.linien ?? null, vsigMitte = vsigKat?.mitte ?? null
  const tempoAmtlich = useMemo<TempoAmtlichDaten | null>(() => (vsigLinien && vsigMitte ? vsigRechnung(vsigLinien, vsigMitte, KATASTER_RADIUS_M) :
    null), [vsigLinien, vsigMitte])
  const parkFelder = parkKat?.felder ?? null, parkAngabe = parkKat?.quelle.quellenangabe ?? ''
  const baeume = baumKat?.baeume ?? null, baumAngabe = baumKat?.quelle.quellenangabe ?? ''
  const fHind = fall?.hindernisse, fVorschl = fall?.vorschlaege, fPark = fall?.parkkataster !== false, fBaum = !!fall?.baumkataster
  const hindEingaben = useMemo<HindernisEingaben>(() => (fHind && fVorschl ? {
    hindernisse: fHind, verworfen: Object.keys(fVorschl),
    park: parkFelder && fPark ? { felder: parkFelder, quellenangabe: parkAngabe } : null,
    baeume: baeume && fBaum ? { baeume, quellenangabe: baumAngabe } : null,
  } : KEINE_HINDERNISSE), [fHind, fVorschl, fPark, fBaum, parkFelder, parkAngabe, baeume, baumAngabe])

  // Längsneigung aus dem Höhenmodell (E3a): gilt für Daten, Zufahrtspunkt und Zufahrt, zu denen sie geholt wurde
  const [hoehen, setHoehen] = useState<HoehenStand | null>(null)
  const hoehenVorgabe = useMemo<HoehenVorgabe | null>(() => {
    if (!hoehen || !daten || !ziel) return null
    const basis = `${datenKey(daten)}|${zpSig(ziel.zufahrtspunkt)}|`
    if (!hoehen.sig.startsWith(basis)) return null
    return (ziel.zufahrt === null ? hoehen.vorschlag : ziel.zufahrt === hoehen.sig.slice(basis.length)) ? hoehen.stand : null
  }, [hoehen, daten, ziel])
  useEffect(() => { if (daten && ziel) rechnen(daten, ziel, eingaben, hindEingaben, hoehenVorgabe, tempoAmtlich) },
    [daten, ziel, eingaben, hindEingaben, hoehenVorgabe, tempoAmtlich, rechnen])
  // andere Zufahrt: andere Vortrittsstrasse und andere Achse, die Eingaben (E1, E2b) gelten nicht mehr
  const zAktuell = useRef<string | null>(null)              // gerechnete bzw. gewählte Zufahrt (unten gesetzt)
  // Korrektur 31.10.2026 (Punkt 15): Arme mit sicherem Vortritt nur über den Schalter; nicht im Fall gespeichert
  const [auchVortritt, setAuchVortritt] = useState(false)
  const zufahrtWaehlen = useCallback((z: string | null) => {
    const neu = z !== zAktuell.current && zAktuell.current !== null   // erste Wahl ohne bisherige Zufahrt: Eingaben (Regelung) bleiben
    // Rechtsvortritt (E3c): Regelung, Wahrnehmbarkeit und «alle Arme» gelten für den Knoten und bleiben beim Wechsel des Arms
    const alt = fallRef.current?.eingaben
    const knotenweit = alt?.regelung === 'rechtsvortritt' ? { regelung: alt.regelung, wahrnehmbarkeit: alt.wahrnehmbarkeit ?? null,
      alleArme: !!alt.alleArme, markierungRv: !!alt.markierungRv } : null
    const n = alt ? eingabenGesetzt({ ...alt, ...(knotenweit ? { regelung: null, wahrnehmbarkeit: null, alleArme: false, markierungRv: false } : {}) }) : 0
    if (neu && n > 0 && !window.confirm(`Andere Zufahrt wählen? Die ${n} Eingaben zur bisherigen Zufahrt (Strassentyp, Neigung, ` +
      'Vortrittsregelung, Halte- oder Wartelinie, D, Trottoir, Tempo) werden zurückgesetzt; Hindernisse bleiben.')) return
    zAktuell.current = z
    aendern(f => { if (neu) { f.eingaben = { ...structuredClone(KEINE_ALLE_EINGABEN), ...knotenweit }; delete f.spiegel } f.ort.zufahrt = z; return f })
  }, [aendern])

  // ---------------------------------------------------------------- Knotensuche (automatisch, wie die Übergangssuche im fgsCheck)
  const suche = useRef<{ ctrl: AbortController | null; box: Box | null; timer: number; start: number; nachher: boolean;
    cache: CacheEintrag<OsmKnoten, StrassenMitte>[] }>({ ctrl: null, box: null, timer: 0, start: -Infinity, nachher: false, cache: [] })
  const [namenAusschnitt, setNamenAusschnitt] = useState<StrassenMitte[]>([])
  const [umkreisVorrang] = useState(vorrang)          // Knotensuche wartet, solange der Umkreis-Abruf (Overpass) läuft
  const [suchHinweis, setSuchHinweis] = useState<KartenHinweis | null>(null)
  const sichtBox = (map: L.Map): Box | null => {
    if (map.getZoom() < SUCHE_ZOOM) return null
    const b = map.getBounds()
    const sicht: Box = { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }
    return zuGross(sicht) ? null : sicht
  }
  const suchHinweisNach = (h: KartenHinweis | null) =>
    setSuchHinweis(kartenRef.current && !sichtBox(kartenRef.current) ? ZU_WEIT : h)
  const gesperrtHinweis = (ms: number): KartenHinweis => ({ text: `Overpass ausgelastet: nächste Knotensuche in rund ${Math.ceil(ms / 1000)} s` })

  const suchen = useCallback(async () => {
    const map = kartenRef.current, st = suche.current
    clearTimeout(st.timer)
    if (!map) return
    const sicht = sichtBox(map)
    if (!sicht) { setSuchHinweis(ZU_WEIT); return }
    const treffer = imCache(st.cache, sicht)
    if (treffer) { st.cache = treffer; if (!st.ctrl) setSuchHinweis(null); return }
    if (st.ctrl) { if (!(st.box && enthaelt(st.box, sicht))) st.nachher = true; return }
    if (!umkreisVorrang.darf()) return                  // nach dem Umkreis-Abruf nachgeholt (laden, osmFertig)
    const gesperrt = overpassSperre()
    if (gesperrt > 0) { setSuchHinweis(gesperrtHinweis(gesperrt)); st.timer = window.setTimeout(suchen, gesperrt + 100); return }
    const warten = st.start + SUCHE_ABSTAND_MS - performance.now()
    if (warten > 0) { st.timer = window.setTimeout(suchen, warten); return }
    const ctrl = new AbortController(), box = abfrageBox(sicht)
    Object.assign(st, { ctrl, box, start: performance.now(), nachher: false })
    setSuchHinweis({ text: 'Knoten werden gesucht …' })
    try {
      const r = await ladeKnoten(box.s, box.w, box.n, box.e, ctrl.signal)
      if (ctrl.signal.aborted) return
      st.cache = aufnehmen(st.cache, { box, daten: r.daten, namen: r.namen })
      const alle = vereinigen(st.cache)
      setKnoten(alle)
      setNamenAusschnitt(vereinigenNamen(st.cache))
      setzeQuelle('suche', { name: SUCHE_NAME, objekte: `${r.daten.length} Knoten und ${r.namen.length} benannte Strassenstücke im ` +
        `Ausschnitt, ${alle.length} Knoten angezeigt (letzte ${st.cache.length} Ausschnitte)`, ms: r.ms, bytes: r.bytes, server: r.quelle })
      suchHinweisNach(r.daten.length ? null : { text: 'Keine Knoten im Ausschnitt' })
    } catch (e) {
      if (ctrl.signal.aborted || istAbbruch(e)) return
      setzeQuelle('suche', { name: SUCHE_NAME, fehler: (e as Error).message })
      const gesperrt = overpassSperre()
      if (gesperrt > 0) {
        suchHinweisNach(gesperrtHinweis(gesperrt))
        st.nachher = false
        st.timer = window.setTimeout(suchen, gesperrt + 100)
      } else suchHinweisNach({ text: `Suche fehlgeschlagen: ${(e as Error).message}`, fehler: true, erneut: () => suchen() })
    } finally {
      if (st.ctrl === ctrl) { st.ctrl = null; st.box = null }
      if (st.nachher && !ctrl.signal.aborted) { st.nachher = false; suchen() }
    }
  }, [])
  const ausschnitt = useCallback(() => {
    const map = kartenRef.current, st = suche.current
    if (!map) return
    clearTimeout(st.timer)
    if (!sichtBox(map)) { setSuchHinweis(ZU_WEIT); return }
    setSuchHinweis(h => (h?.text === ZU_WEIT.text ? null : h))
    st.timer = window.setTimeout(suchen, SUCHE_PAUSE_MS)
  }, [suchen])
  useEffect(() => {
    const st = suche.current
    const t = setTimeout(suchen, 300)
    return () => { clearTimeout(t); clearTimeout(st.timer); st.ctrl?.abort(); st.ctrl = null; st.box = null; st.nachher = false }
  }, [suchen])

  // ---------------------------------------------------------------- Laden
  // wahl: Knoten aus der Karte (Lage bekannt: AV und OSM gleichzeitig) bzw. OSM-Id aus der Adresse (Direkteinstieg: Lage und
  // Umkreis in einer Overpass-Abfrage, danach die AV). Solange der Overpass-Abruf läuft, wartet die Knotensuche (umkreisVorrang)
  // und wird danach nachgeholt: die App fragt Overpass beim Direkteinstieg nacheinander, sonst höchstens zweimal gleichzeitig.
  // fallNeu: mitgebrachte Eingaben (Fall-Datei, Grundstückzufahrt), sonst der gemerkte Fall bzw. ein leerer
  const laden = useCallback(async (wahl: Wahl, fallNeu: Fall | null = null): Promise<boolean> => {
    abbruchRef.current?.abort()
    const ctrl = new AbortController()
    abbruchRef.current = ctrl
    umkreisVorrang.zu(ctrl)
    const osmFertig = () => { if (umkreisVorrang.auf(ctrl) && !ctrl.signal.aborted) ausschnitt() }   // abgebrochen: Seite verlassen
    auftrag.current++
    setRechnung(null); setAv(null); setDaten(null); setRechnet(false); setNochmals(null); setBerichtOffen(false)
    const nr = ++ladeNr.current
    setFall(null); setFallHinweis(null); setParkKat(null); setBaumKat(null); setVsigKat(null); setWerkzeug(null); setZeichnung([]); setBearbeiten(null)
    setKnotenWerkzeug(null); setZufahrtErster(null); setHoehen(null); hoehenLaeuft.current = null; setHervor(null)
    const zp = typeof wahl === 'object' && 'zufahrtspunkt' in wahl ? wahl.zufahrtspunkt : null
    const fallSetzen = (lat: number, lon: number, kid: number | null) => {
      const erinnert = fallNeu ? null : zp ? fallErinnernZufahrt(zp) : kid !== null ? fallErinnern(kid) : null
      setFall(fallNeu ?? erinnert ?? leererFall(lat, lon, kid, zp ? { p: zp, richtung: null } : null))
      if (erinnert) setFallHinweis(`Eingaben, Hindernisse und Quellen aus dem Browser übernommen${erinnert.gespeichert ? ` (Stand ${new Date(erinnert.gespeichert)
        .toLocaleString('de-CH')})` : ''}.`)
    }
    nachladenFehler.current = null; setAvFehler(null)
    const id = zp ? null : typeof wahl === 'number' ? wahl : (wahl as OsmKnoten).id
    ortInUrl(zp ? { zufahrt: zp } : { knoten: id! })
    const AV_NAME = avName(AV_RADIUS_M), OSM_NAME = `OpenStreetMap (Overpass, ${OSM_RADIUS_M} m)`
    // beim direkten Einstieg (?knoten=…) gab es noch keine Ausschnitt-Suche: keinen leeren Eintrag anlegen
    setQuellen(q => ({ ...(q.suche ? { suche: q.suche } : {}), av: { name: AV_NAME }, osm: { name: OSM_NAME } }))
    const quelleFehler = (key: string, name: string) => (err: unknown) => {
      if (!istAbbruch(err)) setzeQuelle(key, { name, fehler: (err as Error).message })
      throw err
    }
    const osmGeladen = <T extends Abruf<unknown>>(r: T) => {
      setzeQuelle('osm', { name: OSM_NAME, ms: r.ms, bytes: r.bytes, server: r.quelle }); return r
    }
    // Ort bekannt (Knoten aus der Karte bzw. der Fall-Datei, Zufahrtspunkt): AV und OSM gleichzeitig
    let ort: [number, number] | null = zp ? wgs(zp[0], zp[1]) : typeof wahl === 'number' ? null : [(wahl as OsmKnoten).lat, (wahl as OsmKnoten).lon]
    if (ort) fallSetzen(ort[0], ort[1], id)
    if (zp) { setGewaehlt(null); kartenRef.current?.setView(ort!, 19) }
    try {
      let osm: Promise<Abruf<unknown>>
      if (ort) {
        setMeldung('AV und OSM werden geladen …')
        osm = ladeOsmRoh(ort[0], ort[1], OSM_RADIUS_M, ctrl.signal).then(osmGeladen, quelleFehler('osm', OSM_NAME))
      } else {
        setMeldung(`OSM-Knoten ${id} wird gesucht …`)
        const r = await ladeOsmUmKnoten(id!, OSM_RADIUS_M, ctrl.signal).then(osmGeladen, quelleFehler('osm', OSM_NAME))
        if (ctrl.signal.aborted) return false
        if (!r.knoten) { setMeldung(`OSM-Knoten ${id} nicht gefunden.`); return false }
        const k = r.knoten
        ort = [k.lat, k.lon]
        setGewaehlt(k)
        fallSetzen(k.lat, k.lon, k.id)
        kartenRef.current?.setView([k.lat, k.lon], 19)
        setMeldung('AV wird geladen …')
        osm = Promise.resolve(r)
      }
      osm.then(osmFertig, osmFertig)
      const [e, n] = zp ?? lv95(ort[0], ort[1])
      const lat = ort[0], lon = ort[1]
      const [ra, ro] = await Promise.all([
        ladeAvRoh(e, n, AV_RADIUS_M, ctrl.signal).then(r => { setzeQuelle('av', { name: AV_NAME,
          objekte: `${r.daten.features?.length ?? 0} Flächen`, ms: r.ms, bytes: r.bytes, server: r.quelle }); return r }, quelleFehler('av', AV_NAME)),
        osm,
      ])
      if (ctrl.signal.aborted) return false
      const avF = avParsen(ra.daten)
      setAv(avF)
      // amtliche Parkfelder und Baumkataster der Gemeinde (BFS-Nummer aus der AV), geladen in den Effekten unten
      const bfs = avF.map(f => f.bfs), pq = parkQuelleFuer(bfs), bq = baumQuelleFuer(bfs)
      setParkKat(pq ? { quelle: pq, nr, lat, lon, felder: null } : null)
      setBaumKat(bq ? { quelle: bq, nr, lat, lon, baeume: null } : null)
      // K0: signalisierte Höchstgeschwindigkeit, wenn die AV-Fläche unter dem Knoten bzw. Zufahrtspunkt zur Stadt Bern gehört
      setVsigKat(bernZustaendig([e, n], avF) ? { nr, lat, lon, mitte: [e, n], linien: null } : null)
      // Quellenstand im Fall (Fall-Datei)
      setFall(f => (f ? { ...f, quellen: { ...f.quellen, osm: `OpenStreetMap über ${ro.quelle}`, av: `Amtliche Vermessung über ${ra.quelle}, ` +
        `Kanton ${[...new Set(avF.map(x => x.kanton).filter(x => x))].join(', ') || '?'}`, geladen: new Date().toISOString().slice(0, 10) } } : f))
      if (!avF.length) {
        setMeldung('Keine AV-Daten an diesem Ort: Kanton bzw. Gemeinde ohne freie AV über geodienste.ch (JU, LU, NE, NW, OW, VD ' +
          'nur mit Freigabe; im Wallis fehlen einzelne Gemeinden) bzw. ausserhalb der Schweiz. Rechnung nicht möglich.')
        return false
      }
      setMeldung('Rechnung läuft …')
      setDaten({ osm: ro.daten, av: ra.daten, nid: id, ort: [e, n], avRadius: AV_RADIUS_M })
      return true
    } catch (err) {
      if (ctrl.signal.aborted || istAbbruch(err)) return false
      setMeldung(`Laden fehlgeschlagen: ${(err as Error).message} (Details unter «Geladene Quellen»)`)
      setNochmals({ wahl, fall: fallNeu })
      return false
    } finally {
      osmFertig()
    }
  }, [umkreisVorrang, ausschnitt])

  const knotenWaehlen = useCallback((k: OsmKnoten) => { setGewaehlt(k); laden(k) }, [laden])

  // ---------------------------------------------------------------- Grundstückzufahrt (E2b)
  // Neuer Fall mit dem Zufahrtspunkt als Schlüssel; nahe der geladenen Daten ohne neues Laden. Gemerkter Fall des Punkts geht vor;
  // sonst übernimmt der neue Fall Hindernisse, verworfene Vorschläge und Quellen-Häkchen des bisherigen Falls.
  const zufahrtSetzen = useCallback((z: ZufahrtspunktEingabe) => {
    setKnotenWerkzeug(null); setZufahrtErster(null); setWerkzeug(null); setBearbeiten(null)
    const zn: ZufahrtspunktEingabe = { p: cm(z.p), richtung: z.richtung ? [Math.round(z.richtung[0] * 1e4) / 1e4, Math.round(z.richtung[1] * 1e4) / 1e4] : null }
    const [lat, lon] = wgs(zn.p[0], zn.p[1])
    const erinnert = fallErinnernZufahrt(zn.p)
    let neu: Fall, hinweis: string | null = null
    if (erinnert) {
      neu = erinnert
      const alt = erinnert.ort.zufahrtspunkt?.richtung ?? null
      if (JSON.stringify(alt) !== JSON.stringify(zn.richtung)) { neu.eingaben.haltelinie = null; neu.eingaben.D = null }
      neu.ort.zufahrtspunkt = { p: erinnert.ort.zufahrtspunkt!.p, richtung: zn.richtung }
      hinweis = 'Eingaben und Hindernisse dieser Grundstückzufahrt aus dem Browser übernommen.'
    } else {
      neu = leererFall(lat, lon, null, zn)
      // Hindernisse nur im Nahbereich übernehmen (gleiche geladene Daten)
      if (fall && daten && dist(zn.p, daten.ort) <= GRUND_OHNE_LADEN_M) {
        neu.hindernisse = structuredClone(fall.hindernisse); neu.vorschlaege = { ...fall.vorschlaege }; neu.baumkataster = fall.baumkataster
        if (fall.parkkataster === false) neu.parkkataster = false
        neu.quellen = { ...fall.quellen }
        if (fall.hindernisse.length || Object.keys(fall.vorschlaege).length) hinweis = 'Hindernisse und verworfene Vorschläge vom bisherigen Fall übernommen.'
      }
    }
    if (!daten || dist(zn.p, daten.ort) > GRUND_OHNE_LADEN_M) { laden({ zufahrtspunkt: zn.p }, neu); return }
    zAktuell.current = null
    setFall(neu); setFallHinweis(hinweis); ortInUrl({ zufahrt: zn.p })
  }, [fall, daten, laden])
  // zurück zum geladenen Knoten (gemerkter Fall bzw. leer)
  const zumKnoten = useCallback(() => {
    if (!daten || daten.nid === null) return
    const [lat, lon] = gewaehlt?.id === daten.nid ? [gewaehlt.lat, gewaehlt.lon] : wgs(daten.ort[0], daten.ort[1])
    const erinnert = fallErinnern(daten.nid)
    zAktuell.current = null
    setKnotenWerkzeug(null); setZufahrtErster(null); setBearbeiten(null)
    setFall(erinnert ?? leererFall(lat, lon, daten.nid))
    setFallHinweis(erinnert ? 'Eingaben, Hindernisse und Quellen des Knotens aus dem Browser übernommen.' : null)
    ortInUrl({ knoten: daten.nid })
  }, [daten, gewaehlt])

  // ---------------------------------------------------------------- Fall-Datei (E2b, wie fgsCheck)
  const speichern = () => {
    if (!fall) return
    const e = !rechnet ? rechnung?.ergebnis ?? null : null
    // vorgeschlagene Zufahrt fest eintragen: die Eingaben gelten für sie, auch wenn sich der Vorschlag mit OSM ändert
    const f = e && !fall.ort.zufahrtspunkt && fall.ort.zufahrt === null ? { ...fall, ort: { ...fall.ort, zufahrt: e.zufahrt } } : fall
    const blob = new Blob([fallSchreiben(f, e ? ergebnisAuszug(e, REGELUNG_TEXT[e.regelung]) : null)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const name = fall.ort.zufahrtspunkt ? `zufahrt_${zufahrtspunktKey(fall.ort.zufahrtspunkt.p).replace(',', '_')}` : String(fall.ort.knoten ?? 'ort')
    a.download = `SichtweitenCheck_${name}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const ladenDatei = async (datei: File) => {
    try {
      const [f, hinweise] = fallLesen(await datei.text())
      const text = `Fall «${datei.name}» geladen (${eingabenZahl(f)} Eingaben)` + (hinweise.length ? `; ${hinweise.length} ungültige Einträge ` +
        `übergangen bzw. auf die Vorgabe gesetzt (${[...new Set(hinweise)].join('; ')}).` : '.')
      let ok: boolean
      if (f.ort.zufahrtspunkt) ok = await laden({ zufahrtspunkt: f.ort.zufahrtspunkt.p }, f)
      else if (f.ort.knoten !== null) {
        const k: OsmKnoten = { id: f.ort.knoten, lat: f.ort.lat, lon: f.ort.lon, tags: {} }
        setGewaehlt(k)
        kartenRef.current?.setView([k.lat, k.lon], 19)
        ok = await laden(k, f)
      } else { setMeldung('Fall-Datei ohne Knoten und ohne Zufahrtspunkt: nichts zu rechnen.'); return }
      // nur, wenn der Ort dieses Falls geladen ist (nicht nach einem Fehler bzw. wenn ein anderer Ort das Laden abbrach)
      if (ok) setFallHinweis(text)
    } catch (e) { setMeldung(`Fall-Datei nicht lesbar: ${(e as Error).message}`) }
  }

  // ---------------------------------------------------------------- amtliche Parkfelder und Baumkataster (aus fgsCheck)
  // Parkfelder automatisch, wenn die Gemeinde eine Quelle hat und der Fall sie nicht abgeschaltet hat; bis sie da sind, rechnet
  // die App ohne sie. Bäume nur, wenn zugeschaltet. Abbruch mit dem Laden eines anderen Knotens (abbruchRef); ein später Abruf
  // schreibt nichts in einen neuen Knoten (Nummer des Ladevorgangs).
  const parkAus = fall?.parkkataster === false
  useEffect(() => {
    if (parkAus || !parkKat || parkKat.felder || parkKat.fehler || parkKat.laedt || parkKat.nr !== ladeNr.current) return
    const ctrl = abbruchRef.current, { quelle, nr } = parkKat
    const name = `${quelle.name} (WFS, ±${KATASTER_RADIUS_M} m)`
    const hier = (k: ParkStand | null) => !!k && k.nr === nr && ladeNr.current === nr && !ctrl?.signal.aborted
    setParkKat(k => (hier(k) ? { ...k!, laedt: true } : k))
    setzeQuelle('parkkataster', { name })
    quelle.laden(parkKat.lat, parkKat.lon, KATASTER_RADIUS_M, ctrl?.signal).then(r => {
      if (ctrl?.signal.aborted || ladeNr.current !== nr) return
      const n = (kl: string) => r.daten.filter(f => f.klasse === kl).length
      setParkKat(k => (hier(k) ? { ...k!, felder: r.daten, laedt: false } : k))
      setzeQuelle('parkkataster', { name, objekte: `${r.daten.length} Felder (${n('auto')} Auto, ${n('velo')} Velo, ${n('motorrad')} Motorrad)`,
        ms: r.ms, bytes: r.bytes, server: r.quelle })
      setFall(f => (f && f.parkkataster !== false ? { ...f, quellen: { ...f.quellen, parkkataster: quelle.quellenangabe } } : f))
    }, err => {
      if (istAbbruch(err) || ctrl?.signal.aborted || ladeNr.current !== nr) return
      setParkKat(k => (hier(k) ? { ...k!, laedt: false, fehler: (err as Error).message } : k))
      setzeQuelle('parkkataster', { name, fehler: `${(err as Error).message} (Dienst bzw. Zugriff aus dem Browser gesperrt?)` })
    })
  }, [parkAus, parkKat])
  // K0: signalisierte Höchstgeschwindigkeit Stadt Bern (Geoportal); bis sie da ist bzw. bei einem Fehler rechnet die App mit OSM
  useEffect(() => {
    if (!vsigKat || vsigKat.linien || vsigKat.fehler || vsigKat.laedt || vsigKat.nr !== ladeNr.current) return
    const ctrl = abbruchRef.current, { nr } = vsigKat
    const name = `Signalisierte Höchstgeschwindigkeit Stadt Bern (Geoportal, ±${KATASTER_RADIUS_M} m)`
    const hier = (k: VsigStand | null) => !!k && k.nr === nr && ladeNr.current === nr && !ctrl?.signal.aborted
    setVsigKat(k => (hier(k) ? { ...k!, laedt: true } : k))
    setzeQuelle('vsig', { name })
    ladeVsigBern(vsigKat.lat, vsigKat.lon, KATASTER_RADIUS_M, ctrl?.signal).then(r => {
      if (ctrl?.signal.aborted || ladeNr.current !== nr) return
      setVsigKat(k => (hier(k) ? { ...k!, linien: r.daten, laedt: false } : k))
      setzeQuelle('vsig', { name, objekte: `${r.daten.length} Abschnitte (${r.daten.filter(l => l.vSig !== null).length} mit Wert)`, ms: r.ms,
        bytes: r.bytes, server: r.quelle })
      setFall(f => (f ? { ...f, quellen: { ...f.quellen, vsig: VSIG_QUELLENANGABE } } : f))
    }, err => {
      if (istAbbruch(err) || ctrl?.signal.aborted || ladeNr.current !== nr) return
      setVsigKat(k => (hier(k) ? { ...k!, laedt: false, fehler: (err as Error).message } : k))
      setzeQuelle('vsig', { name, fehler: `${(err as Error).message}: Tempo aus OSM` })
    })
  }, [vsigKat])
  const baumAn = !!fall?.baumkataster
  useEffect(() => {
    if (!baumAn || !baumKat || baumKat.baeume || baumKat.fehler || baumKat.laedt || baumKat.nr !== ladeNr.current) return
    const ctrl = abbruchRef.current, { quelle, nr } = baumKat
    const name = `${quelle.name} (WFS, ±${KATASTER_RADIUS_M} m)`
    const hier = (k: BaumStand | null) => !!k && k.nr === nr && ladeNr.current === nr && !ctrl?.signal.aborted
    setBaumKat(k => (hier(k) ? { ...k!, laedt: true } : k))
    setzeQuelle('baumkataster', { name })
    quelle.laden(baumKat.lat, baumKat.lon, KATASTER_RADIUS_M, ctrl?.signal).then(r => {
      if (ctrl?.signal.aborted || ladeNr.current !== nr) return
      setBaumKat(k => (hier(k) ? { ...k!, baeume: r.daten, laedt: false } : k))
      setzeQuelle('baumkataster', { name, objekte: `${r.daten.length} Bäume`, ms: r.ms, bytes: r.bytes, server: r.quelle })
      setFall(f => (f && f.baumkataster ? { ...f, quellen: { ...f.quellen, baumkataster: quelle.quellenangabe } } : f))
    }, err => {
      if (istAbbruch(err) || ctrl?.signal.aborted || ladeNr.current !== nr) return
      setBaumKat(k => (hier(k) ? { ...k!, laedt: false, fehler: (err as Error).message } : k))
      setzeQuelle('baumkataster', { name, fehler: `${(err as Error).message} (Dienst bzw. Zugriff aus dem Browser gesperrt?)` })
    })
  }, [baumAn, baumKat])

  // ---------------------------------------------------------------- Zeichnen (aus fgsCheck)
  // Zeichnung zusätzlich in einer Ref, damit Klicks ohne Seiteneffekte in State-Updatern auskommen (StrictMode)
  const [werkzeug, setWerkzeug] = useState<Werkzeug>(null)
  const [zeichnung, setZeichnung] = useState<P[]>([])
  const [bearbeiten, setBearbeiten] = useState<string | null>(null)
  const [klasse, setKlasse] = useState<ParkKlasse>('auto')
  const [breite, setBreite] = useState(LAENGS_BREITE_M)
  const [sichtbehindernd, setSichtbehindernd] = useState(true)
  const [dicht, setDicht] = useState(true)
  const zeichnungRef = useRef<P[]>([])
  useEffect(() => { zeichnungRef.current = zeichnung }, [zeichnung])
  const fertig = useCallback((pts: P[]) => {
    if (!werkzeug) return
    const min = MIN_PUNKTE[werkzeug]
    if (pts.length < min) {
      setMeldung(`Zu wenige Punkte: ${WERKZEUGE.find(w => w[0] === werkzeug)![1]} braucht mindestens ${min}. Weiter klicken oder «Abbrechen».`)
      return
    }
    const id = neueId(werkzeug)
    let h: Hindernis | null = null
    if (werkzeug === 'parkfeld') h = { id, art: 'parkfeld', klasse, ring: pts, quelle: 'hand' }
    if (werkzeug === 'laengs') h = { id, art: 'laengsparkierung', linie: pts, breite, quelle: 'hand' }
    if (werkzeug === 'baum') h = { id, art: 'baum', p: pts[0], stamm: BAUM_STAMM_M, quelle: 'hand' }
    if (werkzeug === 'hecke' || werkzeug === 'mauer') h = { id, art: werkzeug, linie: pts, sichtbehindernd, quelle: 'hand' }
    if (werkzeug === 'zaun') h = { id, art: 'zaun', linie: pts, dicht, quelle: 'hand' }
    if (werkzeug === 'flaeche') h = { id, art: 'uebrige', ring: pts, sichtbehindernd, quelle: 'hand' }
    if (h) aendern(f => { f.hindernisse.push(h!); return f })
    setZeichnung([]); zeichnungRef.current = []; setWerkzeug(null)
  }, [werkzeug, klasse, breite, sichtbehindernd, dicht, aendern])
  const klick = useCallback((p: P) => {
    if (werkzeug === 'baum') { fertig([p]); return }
    const neu = [...zeichnungRef.current, p]
    zeichnungRef.current = neu
    setZeichnung(neu)
  }, [werkzeug, fertig])
  const doppelklick = useCallback(() => {
    // Doppelklick setzt zwei Klicks ab: den doppelten letzten Punkt weglassen
    const z = zeichnungRef.current
    fertig(z.length >= 2 && dist(z[z.length - 1], z[z.length - 2]) < 0.3 ? z.slice(0, -1) : z)
  }, [fertig])
  const ecke = useCallback((id: string, i: number, p: P) => aendern(f => {
    const h = f.hindernisse.find(x => x.id === id)
    if (h) {
      if (h.art === 'parkfeld') h.ring[i] = p
      else if (h.art === 'baum') h.p = p
      else if (h.art === 'laengsparkierung' || h.art === 'zaun') h.linie[i] = p
      else if (h.ring) h.ring[i] = p
      else if (h.linie) h.linie[i] = p
      if (h.quelle !== 'hand' && !(h.name ?? '').endsWith(' (angepasst)')) h.name = (h.name ?? '') + ' (angepasst)'
    }
    return f
  }), [aendern])
  const werkzeugWaehlen = (w: Werkzeug) => {
    setZeichnung([]); zeichnungRef.current = []; setBearbeiten(null); setKnotenWerkzeug(null); setZufahrtErster(null)
    setWerkzeug(x => (x === w ? null : w))
  }
  // Werkzeuge zum Knoten (E2b): Haltelinie (ein Klick), Zufahrt (Punkt am Rand, zweiter Klick für die Richtung)
  const knotenWerkzeugWaehlen = (w: KnotenWerkzeug) => {
    setWerkzeug(null); setZeichnung([]); zeichnungRef.current = []; setBearbeiten(null); setZufahrtErster(null); setKnotenWerkzeug(w)
  }
  const knotenKlick = useCallback((p: P) => {
    if (knotenWerkzeug === 'haltelinie') { setEingaben(e => ({ ...e, haltelinie: cm(p) })); setKnotenWerkzeug(null); return }
    if (knotenWerkzeug === 'd') { setEingaben(e => ({ ...e, D: cm(p) })); setKnotenWerkzeug(null); return }
    if (knotenWerkzeug !== 'zufahrt') return
    if (!zufahrtErster) { setZufahrtErster(p); return }
    const r = sub(p, zufahrtErster)
    zufahrtSetzen({ p: zufahrtErster, richtung: Math.hypot(r[0], r[1]) < 1 ? null : r })
  }, [knotenWerkzeug, zufahrtErster, setEingaben, zufahrtSetzen])
  const zufahrtHilfe = knotenWerkzeug === 'zufahrt' && <ZufahrtHilfe erster={zufahrtErster}
    senkrecht={() => { if (zufahrtErster) zufahrtSetzen({ p: zufahrtErster, richtung: null }) }}
    abbrechen={() => { setKnotenWerkzeug(null); setZufahrtErster(null) }} />

  // ---------------------------------------------------------------- AV nach Bedarf nachladen (E1)
  // Reichen die Zielpunkte über den AV-Ausschnitt hinaus (ab etwa 60 km/h), lädt die App die AV einmal mit dem nötigen Radius
  // (weitester Zielpunkt ab Knoten plus 20 m, höchstens 400 m) und rechnet neu. Abbruch mit dem Laden des Knotens.
  const nachLaedt = useRef(false)
  const nachladenFehler = useRef<string | null>(null)     // Daten (datenKey), bei denen das Nachladen scheiterte (kein zweiter Versuch)
  useEffect(() => {
    const e = rechnung?.ergebnis, d = daten, ctrl = abbruchRef.current
    // e.avRadius: Rechnung zu diesen Daten (eine ältere eines anderen Orts verwirft rechnen() über die Auftragsnummer)
    if (!e || !d || !ctrl || ctrl.signal.aborted || e.avRadius !== d.avRadius) return
    const radius = avNachladen(e.avBedarf, d.avRadius)
    if (radius === null || nachLaedt.current || nachladenFehler.current === datenKey(d)) return
    const name = avName(radius, true)
    nachLaedt.current = true
    setzeQuelle('av', { name })
    setMeldung(`Die Zielpunkte reichen über den AV-Ausschnitt (±${d.avRadius} m) hinaus: AV wird mit ±${radius} m nachgeladen …`)
    ladeAvRoh(d.ort[0], d.ort[1], radius, ctrl.signal).then(r => {
      if (ctrl.signal.aborted) return
      setzeQuelle('av', { name, objekte: `${r.daten.features?.length ?? 0} Flächen`, ms: r.ms, bytes: r.bytes, server: r.quelle })
      setAv(avParsen(r.daten))
      setDaten({ ...d, av: r.daten, avRadius: radius })
    }, err => {
      if (ctrl.signal.aborted || istAbbruch(err)) return
      nachladenFehler.current = datenKey(d)
      setzeQuelle('av', { name, fehler: (err as Error).message })
      setAvFehler(`AV nachladen (±${radius} m) fehlgeschlagen: ${(err as Error).message}. Gerechnet mit ±${d.avRadius} m: weiter weg fehlen ` +
        'Gebäude (Details unter «Geladene Quellen»).')
    }).finally(() => { nachLaedt.current = false })
  }, [rechnung, daten])

  // ---------------------------------------------------------------- Längsneigung aus dem Höhenmodell (E3a)
  // Nach der ersten Rechnung zu Daten und Zufahrt: je Richtung ein Profil entlang der Fahrstreifenachse (profilLinie) und eines der
  // Zufahrt, mit Trottoir an der Zufahrt dazu eines entlang der Trottoirachse (E3b), höchstens vier Abrufe je Fall (swisstopo profile.json). Erst nach dem Umkreis-Abruf (daten) und nicht während einer
  // Overpass-Abfrage (Knotensuche): sonst kurz warten. Abbruch mit dem Laden eines anderen Orts.
  const hoehenLaeuft = useRef<string | null>(null)
  const [hoehenTakt, setHoehenTakt] = useState(0)
  useEffect(() => {
    const e = rechnung?.ergebnis, d = daten, z = ziel, ctrl = abbruchRef.current
    if (!e || !d || !z || !ctrl || ctrl.signal.aborted) return
    if (rechnungFuer.current !== `${datenKey(d)}|${JSON.stringify(z)}`) return     // Rechnung zu einem früheren Ziel
    const sig = `${datenKey(d)}|${zpSig(z.zufahrtspunkt)}|${e.zufahrt}`
    // dazu die Arme links und rechts: beim Rechtsvortritt (E3c) können sie für dieselbe Zufahrt andere sein; K0: mit dem Häkchen
    // «Trottoirüberfahrt» kommt bzw. geht das Profil des Trottoirs (Gehlinie) für dieselbe Zufahrt
    const arme = e.vortritt.join(',') + (e.trottoirProfil.length >= 2 ? '|trottoir' : ''), lauf = `${sig}#${arme}`
    if ((hoehen?.sig === sig && hoehen.arme === arme) || hoehenLaeuft.current === lauf) return
    if (suche.current.ctrl || umkreisVorrang.laeuft()) {                            // Overpass läuft: später
      const t = setTimeout(() => setHoehenTakt(x => x + 1), 500)
      return () => clearTimeout(t)
    }
    hoehenLaeuft.current = lauf
    const linien = ([['links', e.richtungen.find(r => r.richtung === 'links')?.profilLinie ?? []],
      ['rechts', e.richtungen.find(r => r.richtung === 'rechts')?.profilLinie ?? []], ['zufahrt', e.zufahrtProfil],
      ['trottoir', e.trottoirProfil]] as
      [keyof HoehenVorgabe, P[]][]).filter(([, l]) => l.length >= 2)
    setzeQuelle('hoehen', { name: HOEHEN_NAME })
    Promise.all(linien.map(([k, l]) => ladeNeigung(l, ctrl.signal).then(r => [k, r] as const))).then(res => {
      if (ctrl.signal.aborted || hoehenLaeuft.current !== lauf) return
      const stand: HoehenVorgabe = Object.fromEntries(res.map(([k, [m]]) => [k, m]))
      setHoehen({ sig, arme, vorschlag: z.zufahrt === null, stand })
      const ok = res.filter(([, [, a]]) => typeof a !== 'string'), fehler = res.filter(([, [, a]]) => typeof a === 'string')
      const name = (k: string) => (k === 'zufahrt' ? 'Zufahrt' : k === 'trottoir' ? 'Trottoir' : `von ${k}`)
      const abrufe = ok.map(([, [, a]]) => a as Exclude<typeof a, string>)
      setzeQuelle('hoehen', { name: HOEHEN_NAME, objekte: `${res.length} Profile (${res.map(([k, [m]]) => `${name(k)} ${m.i === null ? 'Fehler' :
        `${fi(m.i)} %, ${m.punkte} Punkte`}`).join('; ')})`, ...(abrufe.length ? { ms: Math.max(...abrufe.map(a => a.ms)),
        bytes: abrufe.reduce((x, a) => x + a.bytes, 0), server: abrufe[0].quelle } : {}),
        ...(fehler.length ? { fehler: fehler.map(([k, [, a]]) => `${name(k)}: ${a}`).join('; ') + ' (Neigung unbekannt, strengster Wert)' } : {}) })
      if (abrufe.length) setFall(f => (f ? { ...f, quellen: { ...f.quellen, hoehen: `${HOEHEN_QUELLE} über ${abrufe[0].quelle}` } } : f))
    }, err => {
      if (ctrl.signal.aborted || istAbbruch(err)) return
      setzeQuelle('hoehen', { name: HOEHEN_NAME, fehler: (err as Error).message })
    }).finally(() => { if (hoehenLaeuft.current === lauf) hoehenLaeuft.current = null })
  }, [rechnung, daten, ziel, hoehen, hoehenTakt, umkreisVorrang])

  // Blöcke in Schritt 3 und «Hinweise und Annahmen»: Aufklappzustand im Browser; ein aktives Werkzeug klappt seinen Block auf
  const [offen, setOffenAlle] = useState(offenLesen)
  const setOffen = useCallback((b: BlockName, o: boolean) => {
    setOffenAlle(x => (x[b] === o ? x : { ...x, [b]: o }))
    try { localStorage.setItem(PANEL_SPEICHER + b, o ? '1' : '0') } catch { /* ohne Speicher: nur für diese Sitzung */ }
  }, [])
  useEffect(() => { if (knotenWerkzeug === 'haltelinie' || knotenWerkzeug === 'd') setOffen('zufahrt', true) }, [knotenWerkzeug, setOffen])
  useEffect(() => { if (werkzeug || bearbeiten) setOffen('hindernisse', true) }, [werkzeug, bearbeiten, setOffen])

  // Massnahmen (E3a): hervorgehobenes Hindernis, Übernahme als Eingabe, Bedingungen für einen Spiegel
  const [hervor, setHervor] = useState<string | null>(null)
  const uebernehmen = useCallback((u: Uebernahme) => {
    // Haltelinie ungerundet: genau die gerechnete Lage (cm könnte ein knappes «reicht» kippen)
    setEingaben(e => u.art === 'haltelinie' ? { ...e, haltelinie: u.p } : u.art === 'stop' ? { ...e, regelung: 'stop' } :
      { ...e, tempo: { ...e.tempo, [u.richtung]: { art: 'signalisiert', wert: u.wert, begruendung: 'Massnahme Tempo senken (VSS 40 273 Ziffer 14)' } } })
  }, [setEingaben])
  const setSpiegel = useCallback((k: string, an: boolean) => aendern(f => {
    const x = new Set(f.spiegel ?? [])
    if (an) x.add(k); else x.delete(k)
    if (x.size) f.spiegel = [...x]; else delete f.spiegel
    return f
  }), [aendern])

  // Beispiel bzw. Fall aus der Adresse: ?knoten=<OSM-Id>. Erst nach dem Effekt starten (setTimeout): im StrictMode der
  // Entwicklung läuft der Effekt zweimal, sonst ginge dieselbe Abfrage zweimal an Overpass (duplicate_query)
  useEffect(() => {
    const id = knotenAusUrl(), zp = zufahrtAusUrl()
    if (id === null && zp === null) return
    const t = setTimeout(() => (zp ? laden({ zufahrtspunkt: zp }) : laden(id!)), 0)
    return () => clearTimeout(t)
  }, [laden])

  // gewählter Knoten immer dabei, auch wenn sein Ausschnitt aus dem Cache der Suche gefallen ist
  // Korrektur 31.10.2026 (Punkte 12, 13, 16, 17): Gabelungen, Kreisel und Fahrbahnteilungen aus dem geladenen Umkreis ausblenden, LSA-Knoten kennzeichnen
  const [ausgeblendet, setAusgeblendet] = useState<Set<number>>(() => new Set())
  const [lsaIds, setLsaIds] = useState<Set<number>>(() => new Set())
  useEffect(() => {
    const kk = rechnung?.keinKnoten ?? [], ll = rechnung?.lsaKnoten ?? []
    if (kk.some(n => !ausgeblendet.has(n))) setAusgeblendet(a => new Set([...a, ...kk]))
    if (ll.some(n => !lsaIds.has(n))) setLsaIds(a => new Set([...a, ...ll]))
  }, [rechnung])   // eslint-disable-line react-hooks/exhaustive-deps
  const sichtbar = useMemo(() => {
    const k = knoten.filter(x => !ausgeblendet.has(x.id) || x.id === gewaehlt?.id)
    return gewaehlt && !k.some(x => x.id === gewaehlt.id) ? [...k, gewaehlt] : k
  }, [knoten, gewaehlt, ausgeblendet])
  // Klick auf einen Arm in der Karte: gesperrte Arme (Punkte 11, 15) wie die Knöpfe nicht wählbar
  const zufahrtAusKarte = (key: string | null) => {
    const a = kn?.arme.find(x => x.key === key)
    if (a && a.key !== zGewaehlt && (keineZufahrt(a) || (kn?.mitVortritt?.includes(a.key) && !auchVortritt && !erg?.rechtsvortritt))) return
    zufahrtWaehlen(key)
  }
  const namen = useMemo(() => {
    if (!daten) return namenKarte(namenAusschnitt)
    const ort = daten.ort
    return namenKarte(namenAusschnitt, strassennamen(daten.osm, ort, OSM_RADIUS_M), ort, OSM_RADIUS_M)
  }, [daten, namenAusschnitt, gewaehlt])
  const kantone = useMemo(() => [...new Set((av ?? []).map(f => f.kanton).filter(x => x))], [av])

  const kn = rechnung?.knoten ?? null
  const erg = rechnung?.ergebnis ?? null
  const zGewaehlt = zufahrt ?? erg?.zufahrt ?? null     // gewählt (sofort), sonst die vorgeschlagene der Rechnung
  zAktuell.current = zGewaehlt
  const vortritt = erg?.vortritt ?? kn?.vortritt ?? null       // in der Rechnung verwendetes Paar, sonst nach OSM
  const fehlerQuellen = Object.values(quellen).filter(q => q.fehler).length
  const hervorRing = useMemo(() => (hervor ? erg?.richtungen.flatMap(r => [...r.verdeckerListe, ...(r.velo?.verdeckerListe ?? []),
    ...(r.ueberholfall?.verdeckerListe ?? [])]).find(t => t.id === hervor)?.ring ?? null : null),
    [hervor, erg])
  const zp = fall?.ort.zufahrtspunkt ?? null

  // Kurzzeilen der Blöcke: Stand aus dem Ergebnis, «von Hand» aus den Eingaben (sofort)
  const kurz = (() => {
    if (!erg) return null
    const rs = erg.richtungen, rv = !!erg.rechtsvortritt
    const h = erg.haltelinie
    const halte = h ? `${f1(Math.abs(h.abstand))} m ${h.abstand >= 0 ? 'hinter' : 'vor'} der Kante` : eingaben.haltelinie ? 'nicht gerechnet' : 'keine'
    const zufahrtStand = [`Halte-/Wartelinie: ${halte}`, `D: ${erg.Dhand ? 'verschoben' : 'Vorgabe'}`,
      ...(erg.trottoirueberfahrt ? ['Trottoirüberfahrt'] : erg.trottoir ? [`Trottoir: ${eingaben.trottoirFrei ? 'Bordkante' : 'Hinterkante'}`] : []),
      `Tempo ${rs.filter(r => !rv || !rvNichtGeprueft(r)).map(r => (r.status === 'keine_zufahrt' ? '–' : r.tempo)).join('/')}`].join(' · ')
    const zufahrtHand = eingaben.haltelinie !== null || eingaben.D !== null || eingaben.trottoirFrei || !!eingaben.trottoirueberfahrt ||
      !!eingaben.Dtrottoir ||
      (!rv && (eingaben.tempo.links !== null || eingaben.tempo.rechts !== null))
    const neigung = `i ${rs.map(r => fi(eingaben.neigung[r.richtung] ?? r.neigungVorgabe)).join(' / ')} %`
    const ungunst = erg.strasse.ungunst.fahrstreifen || erg.strasse.ungunst.neigung || erg.strasse.ungunst.schwerverkehr
    const erfStand = rv ? neigung : `${TYP_KURZ[eingaben.typ ?? erg.strasse.typ]}${ungunst ? ' · ungünstig' : ''} · ${neigung}`
    const erfHand = eingaben.neigung.links !== null || eingaben.neigung.rechts !== null ||
      (!rv && (eingaben.typ !== null || eingaben.fahrstreifen !== null || eingaben.neigungGross !== null || eingaben.schwerverkehr ||
        (eingaben.schwerverkehrAnteil ?? null) !== null || (eingaben.ueberholen ?? null) !== null))
    // Velo gegen die Einbahn (E4): Führung mit dem Tag des Velozuflusses
    const veloStand = rs.map(r => (r.veloGegen ? `${VELOFUEHRUNG_TEXT[r.veloFuehrung]} gegen die Einbahn (${r.veloGegen})` :
      r.status === 'keine_zufahrt' ? '–' : VELOFUEHRUNG_TEXT[r.veloFuehrung])).join(' / ') +
      (erg.zufahrtVelo ? ' · Zufahrt: Velos gegen die Einbahn' : '') +
      (eingaben.ebikeVerboten ? ' · schnelle E-Bikes verboten' : '')
    const veloHand = !!(eingaben.velo?.links || eingaben.velo?.rechts || eingaben.ebikeVerboten)
    return { zufahrtStand, zufahrtHand, erfStand, erfHand, veloStand, veloHand }
  })()
  const amtlichZahl = erg?.hindernis.amtlich.length ?? 0, vorschlagZahl = erg?.hindernis.vorschlaege.length ?? 0
  const eigeneZahl = fall?.hindernisse.length ?? 0
  const hindStand = [eigeneZahl ? `${eigeneZahl} von Hand` : '', amtlichZahl ? `${amtlichZahl} amtlich` : '',
    vorschlagZahl ? `${vorschlagZahl} Vorschläge offen` : ''].filter(x => x).join(', ') || 'keine'

  return (
    <div className="app" style={{ '--panel-breite': `${panelBreite}px` } as CSSProperties}>
      <Karte mitte={START} av={av} kantone={kantone} knoten={sichtbar} strassennamen={namen} gewaehlt={gewaehlt?.id ?? null}
        rechnung={rechnung} zufahrt={zufahrt} hindernisse={fall?.hindernisse ?? []} werkzeug={werkzeug} knotenWerkzeug={knotenWerkzeug}
        zufahrtErster={zufahrtErster} zeichnung={zeichnung} bearbeiten={bearbeiten} onKnoten={knotenWaehlen} onZufahrt={zufahrtAusKarte}
        lsa={lsaIds}
        onKlick={klick} onKnotenKlick={knotenKlick} onD={p => setEingaben(e => ({ ...e, D: cm(p) }))}
        onDtrottoir={p => setEingaben(e => ({ ...e, Dtrottoir: cm(p) }))} onDoppelklick={doppelklick} onEcke={ecke}
        onHindernis={id => setBearbeiten(b => (b === id ? null : id))} onAusschnitt={ausschnitt} hinweis={suchHinweis} kartenRef={kartenRef}
        hervor={hervorRing} />
      <Trenner breite={panelBreite} setze={setPanelBreite} onFertig={trennerFertig} />
      <aside className="panel">
        <h1>
          <button className="logo-knopf" onClick={onStartseite} title="Zur Startseite" aria-label="Zur Startseite">
            <img className="logo" src={import.meta.env.BASE_URL + 'logo-klein.svg'} alt="" width={36} height={36} />
          </button>
          SichtweitenCheck <span className="marke">{MARKE}</span>
        </h1>
        <Anleitung />
        <div className="knopfzeile">
          <label className="knopf" title="Fall-Datei (JSON) des SichtweitenCheck laden: Ort, Zufahrt, alle Eingaben und Hindernisse">Fall laden
            <input type="file" accept=".json,application/json" hidden
              onChange={e => { const d = e.target.files?.[0]; if (d) ladenDatei(d); e.target.value = '' }} /></label>
          <button className={knotenWerkzeug === 'zufahrt' ? 'aktiv' : 'zweit'} onClick={() => knotenWerkzeugWaehlen(knotenWerkzeug === 'zufahrt' ? null : 'zufahrt')}
            title="Zufahrt zu einem Grundstück bzw. OSM-Weg service an einer Strasse prüfen: wird wie ein Arm gerechnet">Grundstückzufahrt prüfen</button>
          {fall && <button onClick={speichern} title={'Fall als Datei (JSON) speichern: Ort, Knoten bzw. Zufahrtspunkt, alle Eingaben, ' +
            'Hindernisse, Quellenstand und ein Auszug des Ergebnisses'}>Fall speichern</button>}
          {fall && <button onClick={() => setBerichtOffen(true)} disabled={!erg || rechnet}
            title={erg && !rechnet ? 'Druckansicht mit Kartenbild, Ergebnis, Verdeckern, Massnahmen, Eingaben und Quellen; als PDF über den Druckdialog' :
              'Erst nach der Rechnung'}>Bericht drucken / als PDF</button>}
        </div>
        {fallHinweis && fall && <p className="klein hinweisbox">{fallHinweis}{' '}
          <button className="zweit klein" onClick={() => setFallHinweis(null)}>ausblenden</button></p>}
        {!zp && zufahrtHilfe}

        {meldung && <p className="hinweis">{meldung}
          {nochmals !== null && <>{' '}<button className="zweit klein" onClick={() => laden(nochmals.wahl, nochmals.fall)}>erneut laden</button></>}</p>}
        {avFehler && <p className="hinweis">{avFehler}{' '}<button className="zweit klein" onClick={() => {
          nachladenFehler.current = null; setAvFehler(null); if (daten) setDaten({ ...daten })
        }}>erneut laden</button></p>}
        {rechnet && <p className="klein">Rechnung läuft …</p>}

        {/* 1 Knoten bzw. Grundstückzufahrt */}
        {zp ? (
          <section>
            <h2>1 Grundstückzufahrt</h2>
            {kn?.grundstueck && <p className="titel">{kn.name.replace(/^Grundstückzufahrt,\s*/, '')}</p>}
            <p className="klein">Zufahrtspunkt {zufahrtspunktKey(zp.p).replace(',', ' / ')} (LV95)<Info titel="Grundstückzufahrt">
              <p>Die Zufahrt wird wie ein Arm gerechnet: F<sub>B</sub> wartet auf ihr, geprüft wird die Sicht entlang der Vortrittsstrasse
                nach links und rechts.</p></Info>{erg?.zufahrtspunkt ?
              `, Richtung ${erg.zufahrtspunkt.gezeichnet ? 'gezeichnet' : erg.zufahrtspunkt.weg !== null ? `entlang des OSM-Wegs ${erg.zufahrtspunkt.weg} (service)` :
                'senkrecht zum Rand'}` : ''}{kn?.grundstueck && vortritt ? `; vortrittsberechtigt: ${vortritt.map(key => {
              const a = kn.arme.find(x => x.key === key)!
              return armText(a)
            }).join(' und ')}` : ''}.</p>
            <div className="knopfzeile">
              <button className={knotenWerkzeug === 'zufahrt' ? 'aktiv' : 'zweit'} onClick={() => knotenWerkzeugWaehlen(knotenWerkzeug === 'zufahrt' ? null : 'zufahrt')}>
                Zufahrt neu setzen</button>
              {daten?.nid !== null && daten?.nid !== undefined && <button className="zweit" onClick={zumKnoten}
                title="Grundstückzufahrt aufheben und zum geladenen Knoten zurück (dessen Eingaben bleiben im Browser)">zurück zum Knoten</button>}
            </div>
            {zufahrtHilfe}
          </section>
        ) : kn && !kn.grundstueck && (
          <section>
            <h2>1 Knoten: {kn.name}{kn.lsa ? ' (Lichtsignalanlage)' : ''}</h2>
            <details className="klein knotendaten">
              <summary>OSM-Knoten {kn.id}, {kn.arme.length} Arme</summary>
              <p>{erg?.rechtsvortritt ? `Rechtsvortritt: alle Arme vortrittsbelastet; ` +
                (erg.rechtsvortritt.arm.rechtsName === '–' ? 'vor der gewählten Zufahrt hat kein Arm Vortritt.' :
                `Vortritt vor der gewählten Zufahrt hat ${erg.rechtsvortritt.arm.rechtsName} (von rechts).`) : <>
                Vortrittsberechtigt{erg ? ' (Rechnung)' : ' nach OSM'}: {vortritt ? vortritt.map(key => {
                const a = kn.arme.find(x => x.key === key)!
                return armText(a)
              }).join(' und ') : '–'}{kn.vortrittGrund ? `, ${kn.vortrittGrund}` : ''}.</>}</p>
            </details>
          </section>
        )}

        {/* 2 Vortritt und Zufahrt: Regelung, dann die Armwahl (Grundstückzufahrt: nur die Regelung) */}
        {fall && (zp || (kn && !kn.grundstueck)) && (
          <section>
            <h2>2 Vortritt und Zufahrt</h2>
            <RegelungAbschnitt e={erg} eingaben={eingaben} setEingaben={setEingaben} />
            {!zp && kn && <>
              <h3>{(eingaben.regelung ?? erg?.regelungVorgabe) === 'rechtsvortritt' ? <>Zu prüfender Arm<Info titel="Zu prüfender Arm">
                <p>Rechtsvortritt: jeder Arm muss dem Arm rechts von ihm den Vortritt lassen. Geprüft wird die Sicht aus dem gewählten
                  Arm auf den Arm rechts davon; «von rechts» markiert diesen Arm.</p></Info></> : 'Zufahrt wählen (Arm ohne Vortritt)'}</h3>
              {/* Korrektur 31.10.2026 (Punkte 11, 15): Arme ohne Zufahrt bzw. mit sicherem Vortritt ausgegraut */}
              <div className="knopfzeile">
                {nachNr(kn.arme).map(a => {
                  const keine = keineZufahrt(a), mitV = !!kn.mitVortritt?.includes(a.key) && !(erg?.rechtsvortritt)
                  const gesperrt = a.key !== zGewaehlt && (keine || (mitV && !auchVortritt))
                  return <button key={a.key} className={a.key === zGewaehlt ? 'aktiv' : 'zweit'} onClick={() => zufahrtWaehlen(a.key)}
                    disabled={gesperrt} title={`OSM-Weg ${a.wid}, ${a.hw}${a.zufluss ? '' : `, Einbahn vom Knoten weg${a.veloZufluss ?
                      `, Velo gegen die Einbahn (${a.veloZuflussQuelle})` : ': keine Zufahrt'}`}${mitV ? `; Vortritt nach OSM: ${kn.vortrittSicher}` : ''}`}>
                    {armText(a)}{erg?.rechtsvortritt ? (erg.rechtsvortritt.arm.rechts === a.key ? ' · von rechts' : '') :
                      mitV ? ' · Vortritt, keine Zufahrt' : vortritt?.includes(a.key) ? ' · Vortritt' : ''}
                    {a.zufluss ? '' : a.veloZufluss ? ' · Einbahn, nur Velos' : ' · Einbahn vom Knoten weg, keine Zufahrt'}
                  </button>
                })}
              </div>
              {(kn.mitVortritt?.length ?? 0) > 0 && !erg?.rechtsvortritt && <label className="klein"><input type="checkbox" checked={auchVortritt}
                onChange={ev => setAuchVortritt(ev.target.checked)} /> auch Arme mit Vortritt wählen</label>}
              {(() => {
                const z = kn.arme.find(a => a.key === zGewaehlt)
                // kurz (Korrektur 31.10.2026, Punkt 7): Einzelheiten im Hinweis und in den Annahmen
                return z && !z.zufluss ? <p className="klein">Zufahrt {armText(z)}: Einbahn vom Knoten weg{z.veloZufluss ?
                  ', nur Velos gegen die Einbahn' : '; von hier fährt niemand an den Knoten heran, geprüft wird nichts'}.</p> : null
              })()}
            </>}
          </section>
        )}

        {/* 3 Eingaben: vier eingeklappte Blöcke */}
        {fall && daten && (
          <section>
            <h2>3 Eingaben</h2>
            {erg && kurz && <>
              <Block titel="Zufahrt" stand={kurz.zufahrtStand} hand={kurz.zufahrtHand} offen={offen.zufahrt} setOffen={o => setOffen('zufahrt', o)}>
                <KnotenAbschnitt e={erg} eingaben={eingaben} setEingaben={setEingaben} werkzeug={knotenWerkzeug} werkzeugWaehlen={knotenWerkzeugWaehlen} />
              </Block>
              <Block titel="Erforderliche Sichtweite" stand={kurz.erfStand} hand={kurz.erfHand} offen={offen.erforderlich}
                setOffen={o => setOffen('erforderlich', o)}>
                <ErforderlichBlock s={erg.strasse} eingaben={eingaben} setEingaben={setEingaben} richtungen={erg.richtungen}
                  rv={!!erg.rechtsvortritt} ueber={erg.ueberholen ?? null} />
              </Block>
              <Block titel="Veloverkehr" stand={kurz.veloStand} hand={kurz.veloHand} offen={offen.velo} setOffen={o => setOffen('velo', o)}>
                <VeloAbschnitt e={erg} eingaben={eingaben} setEingaben={setEingaben} />
              </Block>
            </>}
            <Block titel={`Hindernisse (${eigeneZahl + amtlichZahl})`} stand={hindStand} offen={offen.hindernisse}
              setOffen={o => setOffen('hindernisse', o)}>
              <HindernisAbschnitt fall={fall} aendern={aendern} stand={erg?.hindernis ?? null} werkzeug={werkzeug}
                werkzeugWaehlen={werkzeugWaehlen} zeichnung={zeichnung} fertig={fertig} abbrechen={() => { setZeichnung([]); zeichnungRef.current = []; setWerkzeug(null) }}
                bearbeiten={bearbeiten} setBearbeiten={setBearbeiten} klasse={klasse} setKlasse={setKlasse} breite={breite} setBreite={setBreite}
                sichtbehindernd={sichtbehindernd} setSichtbehindernd={setSichtbehindernd} dicht={dicht} setDicht={setDicht} parkKat={parkKat}
                setParkKat={setParkKat} baumKat={baumKat} setBaumKat={setBaumKat} hinweis={null}
                abstandMitte={kn && daten ? dist(kn.p, daten.ort) : 0} />
            </Block>
          </section>
        )}

        {/* 4 Ergebnis: nur lesen */}
        {erg && (
          <section>
            <h2>4 Ergebnis</h2>
            <p className="leitsatz">Sicht aus der {erg.zufahrtspunkt ? 'Grundstückzufahrt Z' : `Zufahrt ${erg.zufahrtName}`}{' '}
              {erg.richtungen.some(r => r.lage === 'gegenueber') ? erg.richtungen.map(lageNach).join(' und ') : 'nach links und rechts'}<Info titel="Ergebnis">
                <p>Je Richtung drei Teile: Motorfahrzeuge (Tab. 1, beim Rechtsvortritt Abb. 6), Velo (Tab. 3) und Trottoir (Tab. 2, nur mit
                  einem Trottoir quer über die Zufahrt bzw. mit dem Häkchen «Trottoirüberfahrt»). Der Punkt vor der Zeile zeigt den schlechtesten Teil.</p>
                <p>Trottoirüberfahrt: Trottoir = Phase Trottoir (ab dem hinteren Rand), Auto und Velo = Phase Fahrbahn (ab der Bordkante).</p>
                <p>Grün: erfüllt (≥ oberer Wert); gelb: massgebender Wert erfüllt (Rechtsvortritt: bedingt, zulässig als Ausnahme); rot:
                  nicht erfüllt; grau: kein Verkehr bzw. nicht geprüft.</p>
                <p>Unten je Richtung die erforderliche und die vorhandene Sichtweite, Status und der erste Verdecker; die Herleitung steht im Info-Zeichen des
                  Teils.</p></Info></p>
            {erg.lsa && <p className="hinweis">{LSA_TEXT}</p>}
            {erg.rechtsvortritt && (() => {
              const links = erg.richtungen.find(r => r.richtung === 'links')
              const la = links && kn ? kn.arme.find(x => x.key === links.arm) : undefined
              return <RvBlock rv={erg.rechtsvortritt} links={links} linksName={la ? armText(la) : links?.strasse ?? ''} />
            })()}
            <ul className="gesamtstatus">{erg.seiteOhneArm === 'links' && <OhneArm seite="links" />}{erg.richtungen.map(r => {
              const t = erg.trottoirPruefung?.richtungen.find(x => x.richtung === r.richtung) ?? null
              return <li key={r.richtung}>
                <span className="richtungsname"><span className="farbe rund" style={{ background: STATUS_FARBE[r.gesamt] }} />{lageText(r)}:{' '}
                  <span className="klein">{r.strasse}</span></span>
                <span className="felder">{rvNichtGeprueft(r) && !r.velo && !t ?
                  <Feld s={{ feld: r.lage === 'gegenueber' ? 'nicht geprüft (kein Vortrittsverhältnis)' : 'nicht geprüft (Rechtsvortritt)',
                    kurz: '', farbe: GRAU }} /> :
                  <><Feld s={autoStand(r)} />{ueberStand(r) && <Feld s={ueberStand(r)!} />}<Feld s={veloStand(r)} /><Feld s={trottoirStand(t)} /></>}</span></li>
            })}{erg.seiteOhneArm === 'rechts' && <OhneArm seite="rechts" />}</ul>
            {erg.trottoirueberfahrt && <TueBlock t={erg.trottoirueberfahrt} />}
            <table className="zahlen kopf">
              <tbody>
                <tr><td>Zufahrt</td><td>{erg.zufahrtName}{erg.zufahrtVelo ? ' (nur Velos)' : ''}</td></tr>
                <tr><td>Regelung für die gewählte Zufahrt</td><td>{REGELUNG_TEXT[erg.regelung]} <span className={erg.regelungGewaehlt ? '' : 'warnung'}>
                  ({erg.regelungGewaehlt ? 'gewählt' : annahmeText(erg.regelungQuelle)})</span></td></tr>
                <tr><td>Beobachtungsdistanz B</td><td>{f2(erg.B)} m ({erg.rechtsvortritt ? 'Rechtsvortritt, Abb. 4' : erg.ausserorts ? 'ausserorts' :
                  'innerorts'}{!erg.rechtsvortritt && erg.ausserorts && erg.regelung === 'stop' ? ', Stop' : ''}), ab der {erg.nullpunktText}{erg.radwegRand && !erg.haltelinie ? ' (Ziffer 12: Radweg näher als 2,00 m)' : ''}</td></tr>
                <tr><td>Beobachtungspunkt D</td><td>{erg.Dhand ? <><span className="warnung">von Hand</span>, {f2(erg.Dlage.laengs)} m hinter der{' '}
                  {erg.nullpunktText}, {f2(Math.abs(erg.Dlage.seitlich))} m {erg.Dlage.seitlich >= 0 ? 'links' : 'rechts'} der Achse</> :
                  erg.zufahrtVelo ? `Auge des Velofahrers (${erg.zufahrtVelo.lageText})` :
                  `Fahrersitz, ${f2(FAHRERSITZ_M)} m links der Achse des Zufahrtsstreifens`}</td></tr>
                <tr><td>Einbiegewinkel</td><td>rund {Math.round(erg.einbiegewinkel)}°</td></tr>
              </tbody>
            </table>
            {erg.rechtsvortritt && <RvAlle rv={erg.rechtsvortritt} armWaehlen={zufahrtWaehlen} />}
            {erg.richtungen.map(r => <RichtungZeile key={r.richtung} r={r} velo={!!erg.zufahrtVelo} mitTrottoir={!!erg.trottoirPruefung}
              t={erg.trottoirPruefung?.richtungen.find(t => t.richtung === r.richtung) ?? null} achseQuelle={erg.trottoirPruefung?.achseQuelle ?? ''}
              gehlinie={!!erg.trottoirPruefung?.gehlinie} D={erg.D} />)}
            <Block titel={`Hinweise und Annahmen (${erg.hinweise.length + erg.annahmen.length})`} offen={offen.hinweise}
              setOffen={o => setOffen('hinweise', o)}>
              {erg.hinweise.length > 0 && <>
                <h4>Hinweise</h4>
                <ul className="annahmen">{erg.hinweise.map((h, i) => <li key={i}>{h}</li>)}</ul>
              </>}
              <h4>Annahmen</h4>
              {/* Korrektur 31.10.2026 (Punkte 6, 7): je Thema ein Punkt, Begriffe als dezente Verweise; technische Herleitung ausklappbar */}
              {(() => { const gezeigt = new Set<string>()
                return <ul className="annahmen">{(erg.annahmenThemen ?? erg.annahmen.map(text => ({ thema: text, titel: '', text }))).map(t =>
                  <li key={t.thema}>{t.titel && <b>{t.titel}: </b>}<BegriffText text={t.text} gezeigt={gezeigt} /></li>)}</ul> })()}
              {(erg.herleitung?.length ?? 0) > 0 && <details className="klein herleitung">
                <summary>Herleitung (technisch)</summary>
                <ul>{erg.herleitung!.map((h, i) => <li key={i}>{h}</li>)}</ul>
              </details>}
              <p className="klein">Rechenzeit {Math.round(rechnung!.ms)} ms.</p>
            </Block>
          </section>
        )}

        {/* 5 Massnahmen */}
        {erg?.massnahmen && fall && <MassnahmenAbschnitt liste={erg.massnahmen} hervor={hervor} setHervor={setHervor} uebernehmen={uebernehmen}
          spiegel={fall.spiegel ?? []} setSpiegel={setSpiegel}
          laedt={erg.richtungen.some(r => !r.neigungHand && r.neigungQuelle.startsWith('Höhenmodell lädt'))} />}
        {erg && !erg.massnahmen && <section>
          <h2>5 Massnahmen</h2>
          <p className="klein">{erg.richtungen.every(r => r.status === 'keine_zufahrt') ?
            'Keine Richtung geprüft (kein vortrittsberechtigter Verkehr): keine Massnahmen.' :
            erg.richtungen.some(r => r.status === 'keine_zufahrt') ?
              'Motorfahrzeuge und Velo sind in der geprüften Richtung erfüllt: keine Massnahmen nach Ziffer 14 nötig.' :
              'Motorfahrzeuge und Velo sind in beiden Richtungen erfüllt: keine Massnahmen nach Ziffer 14 nötig.'}</p>
        </section>}

        <details className="abschnitt">
          <summary><h2>Legende</h2></summary>
          {/* Korrektur 31.10.2026 (Punkte 8 und 10): Alltagssprache, Farbnamen statt Code-Namen; Farben selbst unverändert */}
          <ul className="legende">
            <li><span className="farbe rund" style={{ background: KNOTEN_FARBE }} />Knoten: Punkt, an dem sich die Strassen in OSM treffen
              (Lage aus OSM). Gemessen wird ab K.</li>
            <li><span className="farbe" style={{ background: ZUFAHRT_FARBE }} /><span className="farbe" style={{ background: '#e2e8f0' }} />
              <span className="farbe" style={{ background: '#94a3b8' }} />Arme: Richtung der Strassen vom Knoten weg (gerade Linie, nur
              Orientierung); orange die gewählte Zufahrt, hellgrau Arme mit Vortritt, grau die übrigen.</li>
            <li><span className="arm-nr">1</span>Nummern: Arme im Uhrzeigersinn ab Norden, Z = Grundstückzufahrt (am Zufahrtspunkt);{' '}
              <span className="arm-nr gewaehlt">2</span>gewählte Zufahrt (Klick aufs Schild wählt den Arm)</li>
            <li><span className="farbe gestrichelt" style={{ borderColor: ZUFAHRT_FARBE }} />Fahrlinie der Zufahrt (orange gestrichelt):
              darauf stehen das wartende Fahrzeug F<sub>B</sub> und D.</li>
            <li><span className="farbe rund" style={{ background: D_FARBE, border: `2px solid ${D_RAND_FARBE}` }} />D: Auge des wartenden
              Lenkers (weisser Punkt). Auf der Karte verschiebbar; von Hand verschoben mit orangem Rand{' '}
              <span className="farbe rund" style={{ background: D_FARBE, border: `2px solid ${D_HAND_FARBE}` }} />.</li>
            <li><span className="farbe" style={{ background: HALTELINIE_FARBE, border: '2px solid #111827' }} />Halte- oder Wartelinie
              (weiss): ab ihrer Vorderkante wird B gemessen.{' '}<span className="farbe rund" style={{ background: ZUFAHRT_FARBE,
              border: '2px solid #111827' }} />Oranger Punkt: dort beginnt B, wenn nicht am Fahrbahnrand (z. B. hinter dem Trottoir).</li>
            <li><span className="farbe" style={{ background: FB_FARBE }} />F<sub>B</sub>: wartendes Fahrzeug (dunkel); an einer Einbahn mit
              Velo gegen die Einbahn ein Velo.</li>
            <li><span className="farbe" style={{ background: FA_FARBE, border: '1px solid #111827' }} />F<sub>A</sub>: Fahrzeug mit Vortritt
              (hell), seine Front am Ende der nötigen Sichtweite A.</li>
            <li><span className="farbe gestrichelt" style={{ borderColor: '#94a3b8' }} />Fahrlinie der Fahrzeuge mit Vortritt (weiss gestrichelt).</li>
            <li><span className="k-legende">K</span>K: wo sich die Fahrlinie der Zufahrt und die Fahrlinie mit Vortritt kreuzen; ab K wird A
              gemessen.</li>
            <li><span className="farbe rund" style={{ background: STATUS_FARBE.erfuellt, border: '1.5px solid #111827' }} /><span
              className="farbe rund" style={{ background: STATUS_FARBE.massgebend, border: '1.5px solid #111827' }} /><span className="farbe rund"
              style={{ background: STATUS_FARBE.nicht_erfuellt, border: '1.5px solid #111827' }} />A: Punkt am Ende der nötigen Sichtweite A;
              Farbe = Ergebnis (grün erfüllt, gelb nur der massgebende Wert, rot nicht erfüllt).</li>
            <li><span className="farbe" style={{ background: FREI_FARBE }} />Sichtdreieck frei (bis A)</li>
            <li><span className="farbe" style={{ background: VERDECKT_FARBE }} />Sichtdreieck verdeckt (ab der ersten Verdeckung bis A) und
              verdeckendes Gebäude</li>
            <li><span className="farbe gestrichelt" style={{ borderColor: FREI_FARBE, background: 'rgba(34,197,94,0.12)' }} />Überholfall
              (ausserorts): Sichtdreieck auf den Gegenfahrstreifen, schwächer und gestrichelt (rot gestrichelt: verdeckt bis A)</li>
            <li><span className="farbe gestrichelt" style={{ borderColor: VELO_FARBE, background: 'rgba(15,118,110,0.12)' }} />Sichtdreieck
              Velo (blaugrün gestrichelt, frei; rot gestrichelt: verdeckt bis A), Fahrlinie der Velos blaugrün fein gestrichelt</li>
            <li><span className="farbe" style={{ background: VELO_FARBE }} />Velo am Ende von A auf der Fahrlinie der Velos</li>
            <li><span className="farbe" style={{ background: TROTTOIR_FARBE }} />Sichtdreiecke Trottoir von D' (indigo; rot: verdeckt bis A),
              D' als indigofarbener Punkt mit dunklem Rand</li>
            <li><span className="farbe rund" style={{ background: '#ffffff', border: `3px solid ${TROTTOIR_FARBE}` }} />Fussgänger am Ende von A
              (Punkt mit Ring; Trottoirüberfahrt: auf der Gehlinie {f2(TUE_GEHLINIE_M)} m vor dem hinteren Rand der Überfahrt)</li>
            <li><span className="farbe" style={{ background: TROTTOIR_FARBE }} />Trottoirüberfahrt: breiter indigofarbener Strich auf der Fahrlinie
              der Zufahrt von der Bordkante bis zum hinteren Rand, dort eine gestrichelte Querlinie</li>
            <li><span className="farbe" style={{ background: SPAETER_FARBE }} />Hindernis, das die Sicht erst weiter weg als A verdeckt (ohne
              Wirkung).</li>
            <li><span className="farbe" style={{ background: 'transparent', border: `3px solid ${TREFFER_FARBE.voll}` }} />Verdecker im
              Sichtdreieck bis A (Rand rot: verdeckt; gelb: Baum, Palisade; violett gestrichelt: nur Hinweis, Zweirad bzw. durchlässiger Zaun)</li>
            <li><span className="farbe" style={{ background: HINDERNIS_FARBE.auto }} />Parkfeld Auto, Längsparkierung (amtlich bzw. von Hand; gilt als besetzt)</li>
            <li><span className="farbe" style={{ background: HINDERNIS_FARBE.velo }} />Parkfeld Velo, <span className="farbe" style={{ background: HINDERNIS_FARBE.motorrad }} />Parkfeld Motorrad (nur Hinweis)</li>
            <li><span className="farbe rund" style={{ background: HINDERNIS_FARBE.baum }} />Baum (Stamm {String(BAUM_STAMM_M).replace('.', ',')} m)</li>
            <li><span className="farbe" style={{ background: HINDERNIS_FARBE.hecke }} />Hecke, Mauer (Linie, {String(LINIE_PUFFER_M).replace('.', ',')} m beidseits)</li>
            <li><span className="farbe" style={{ background: HINDERNIS_FARBE.zaun }} />Zaun, Geländer (dicht durchgezogen, durchlässig gepunktet)</li>
            <li><span className="farbe" style={{ background: HINDERNIS_FARBE.uebrige }} />übriges Hindernis (Fläche)</li>
            <li><span className="farbe gestrichelt" style={{ borderColor: HINDERNIS_FARBE.auto }} />Vorschlag (OSM-Parkierung, Baumkataster): zählt erst nach «bestätigen»; verworfene amtliche Parkfelder gepunktet und blass</li>
            <li><span className="farbe gestrichelt" style={{ borderColor: HERVOR_FARBE }} />Massnahmen: in der Liste angeklicktes Hindernis</li>
            <li><span className="farbe" style={{ background: VERDECKT_FARBE }} />Enge Kreuzung (Fahrbahn bis 3,50 m): Sichtlinien vom wartenden
              Fahrzeug zu Punkten alle {ENG_SCHRITT_M} m auf den letzten 20 m um die Ecke; rot verdeckt, grau frei.</li>
            <li>{Object.entries(AV_FARBEN).filter(([k]) => AV_NAME_KARTE[k]).map(([k, c]) => <span key={k} className="farbe"
              style={{ background: c }} />)}Fahrbahn bzw. Gebäude (amtliche Vermessung)</li>
          </ul>
        </details>

        {/* Korrektur 31.10.2026 (Punkt 9, wie fgsCheck): Grundlagen und Quellen, Begriffe, Regeln; keine Normtabellen (lizenziert) */}
        <details className="abschnitt" id="abschnitt-grundlagen">
          <summary><h2>Grundlagen und Quellen</h2></summary>
          <h3>Rechnung und Sichtweiten</h3>
          <RechnungGrundlagen />
          <h3>Daten</h3>
          <DatenQuellen />
          <p className="klein">Die App ersetzt keine Beurteilung vor Ort. Eingaben bleiben im Browser bzw. in der Fall-Datei.</p>
          <h3>Quellen der Prüfungen</h3>
          <QuellenTabelle />
        </details>
        <details className="abschnitt" id="abschnitt-begriffe">
          <summary><h2>Begriffe</h2></summary>
          <p className="klein">Fachbegriffe der App in Alltagssprache.</p>
          <BegriffeListe />
        </details>
        <details className="abschnitt" id="abschnitt-regeln">
          <summary><h2>Regeln</h2></summary>
          <RegelUebersicht />
        </details>

        <details className="abschnitt">
          <summary><h2>Geladene Quellen{fehlerQuellen > 0 && <span className="fehler"> ({fehlerQuellen} Fehler)</span>}</h2></summary>
          <ul className="klein">
            {Object.entries(quellen).map(([k, q]) => (
              <li key={k}><b>{q.name}</b>: {q.fehler ? <span className="fehler">{q.fehler}</span> :
                q.ms !== undefined ? `${q.objekte ? q.objekte + ', ' : ''}${Math.round(q.ms)} ms, ${Math.round((q.bytes ?? 0) / 1024)} kB${q.server ? `, ${q.server}` : ''}` : 'lädt …'}</li>
            ))}
          </ul>
        </details>
        <Datenschutz />
        <Fusszeile />
      </aside>
      {berichtOffen && fall && rechnung?.ergebnis && av && <Bericht fall={fall} rechnung={rechnung} av={av} kantone={kantone} quellen={quellen}
        aendern={aendern} schliessen={berichtSchliessen} />}
    </div>
  )
}
