// ── Einstiegshilfe, Datenschutz und Fusszeile (E4a, Vorlage fgsCheck Hilfe.tsx) ──

import { Fragment } from 'react'
import { OVERPASS_ENDPOINTS } from './daten/osm'
import { LUFTBILD_QUELLE } from './daten/luftbild'
import { VSIG_QUELLENANGABE } from './daten/vsig'
import { PARKKATASTER } from './daten/parkkataster'
import { BAUMKATASTER } from './daten/baumkataster'
import { HOEHEN_QUELLE } from './rechner/neigung'
import { PW_LAENGE_M, PW_BREITE_M, LENKER_VOR_FRONT_M, VELO_LAENGE_M, VELO_BREITE_M } from './rechner/fahrzeug'
import { WERKE, WERK_IDS, regelnJeWerk, werkAnker, regelWerkAnker, type WerkId } from './regeln'
import { begriffeAlphabetisch, begriffTeile } from './begriffe'
import { hilfeZeigen, regelnWerkZeigen } from './verweise'
import { MARKE, QUELLCODE } from './marke'
import { AV_RADIUS_M, OSM_RADIUS_M, AV_MAX_M, KATASTER_RADIUS_M } from './rechner/rechnen'
import { f1 } from './texte'

const host = (u: string) => new URL(u).host

/** Aufklappbare Einstiegshilfe «So funktioniert's»: nur die Handlungsschritte; Grenzen stehen auf der Startseite */
export function Anleitung() {
  return (
    <details className="hilfe">
      <summary>So funktioniert's</summary>
      <p><b>Ort suchen:</b> oben in der Karte Ort, Adresse oder Strasse eingeben oder den Standort-Knopf nutzen; heranzoomen, bis
        die Knoten als blaue Punkte erscheinen. Dann das Panel von oben nach unten:</p>
      {/* Korrektur 31.10.2026, Punkt 20 (Text vom Nutzer freigegeben): nur Bedienschritte; Rechenregeln stehen unter Begriffe und Regeln */}
      <ol>
        <li><b>Knoten:</b> blauen Punkt anklicken. Für eine Grundstückzufahrt oben «Grundstückzufahrt prüfen», auf den Fahrbahnrand
          klicken; ein zweiter Klick im Grundstück gibt die Richtung.</li>
        <li><b>Regelung und Zufahrt:</b> «Regelung für die gewählte Zufahrt» wählen (Kein Vortritt, Stop oder Rechtsvortritt), dann den
          Arm, aus dem die Sicht geprüft wird: im Panel oder auf der Karte den Arm bzw. sein Nummernschild anklicken; das wartende
          Fahrzeug ist schwarz. Ausgegraute Arme sind keine Zufahrt, etwa eine Einbahn vom Knoten weg oder ein Arm mit Vortritt.</li>
        <li><b>Eingaben:</b> Blöcke aufklappen und anpassen. Zufahrt: Halte- oder Wartelinie, «D setzen» oder D auf der Karte ziehen,
          Trottoirüberfahrt, Tempo. Erforderliche Sichtweite: Strassentyp, Längsneigung, ausserorts das Überholen. Veloverkehr.
          Hindernisse: auf dem Luftbild zeichnen, Vorschläge bestätigen. Alles rechnet sofort neu; «von Hand» zeigt, wo etwas gesetzt ist.</li>
        <li><b>Ergebnis:</b> Status je Richtung für Auto, Velo und Trottoir. Braun markiert sind Annahmen, die du prüfen solltest; wie
          gerechnet wurde, zeigt die aufklappbare Herleitung. Die Karte erklärt die «Legende».</li>
        <li><b>Massnahmen:</b> Reicht die Sicht nicht, zeigt das Panel Varianten; «übernehmen» setzt sie als Eingabe.</li>
        <li><b>Bericht und Fall:</b> «Bericht drucken / als PDF» für die Druckansicht, «Fall speichern» und «Fall laden» für die Datei.</li>
      </ol>
      <p>Was die Begriffe bedeuten und nach welchen Regeln die App rechnet, steht unter «Begriffe» und «Regeln».</p>
    </details>
  )
}

/** Werk im Lesetext: Verweis auf seine Zeile in den Quellen der Prüfungen (Titel und Beschreibung als Tooltip) */
export function WerkVerweis({ w, children }: { w: WerkId; children?: React.ReactNode }) {
  return <a href={`#${werkAnker(w)}`} className="werk-link" title={`${WERKE[w].titel} (${WERKE[w].ausgabe}): ${WERKE[w].beschreibung}`}
    onClick={e => { if (hilfeZeigen(werkAnker(w))) e.preventDefault() }}>{children ?? WERKE[w].name}</a>
}

/** «Rechnung und Sichtweiten» (Korrektur 31.10.2026, Punkt 9a): kurz in Alltagssprache, Werke als Verweise */
export function RechnungGrundlagen() {
  return <>
    {/* erster Satz vom Nutzer freigegeben (31.10.2026, Korrektur Punkt 18) */}
    <p className="klein">Die App prüft an Knoten und Grundstückzufahrten, ob wer warten muss, den Verkehr mit Vortritt früh genug sieht,
      beim Einbiegen wie beim Überqueren. Wartend ist ein Auto oder ein Velo in der gewählten Zufahrt; beim Rechtsvortritt wartet jede
      Zufahrt auf den Verkehr von rechts. An einer Lichtsignalanlage gilt die Prüfung für die ausgeschaltete Anlage. Sie setzt das Auge
      der wartenden Person (D) hinter den Rand der Strasse mit Vortritt bzw. hinter die Halte- oder Wartelinie, sucht den Punkt K, an dem
      sich die Fahrlinien kreuzen, und zieht von D aus Sichtlinien zu Punkten auf der Fahrlinie mit Vortritt. Wie weit die Sicht reichen
      muss, hängt vom Tempo, vom Strassentyp und von der Längsneigung ab (<WerkVerweis w="40273" />, Anhaltesichtweite nach{' '}
      <WerkVerweis w="40090" />, Strassentypen nach <WerkVerweis w="40040" />). Geprüft werden auch Velos und Fussgänger auf dem Trottoir,
      beim Rechtsvortritt die Sicht nach rechts (enge Kreuzungen nach <WerkVerweis w="BFU" />) und bei einer Trottoirüberfahrt beide
      Schritte nach <WerkVerweis w="40242" />. Für ungünstige Verhältnisse nimmt die App die Masse des Kantons Solothurn
      (<WerkVerweis w="SO" />), für Stop und Kein Vortritt die <WerkVerweis w="SSV" /> und die kantonale Praxis.</p>
    <p className="klein">Die App rechnet im Grundriss und prüft die Höhe von Hindernissen nicht. Die Fahrzeuge auf Karte und Bild dienen nur der
      Darstellung (Personenwagen {f1(PW_LAENGE_M)} × {f1(PW_BREITE_M)} m, Lenker {f1(LENKER_VOR_FRONT_M)} m hinter der Front; Velo{' '}
      {f1(VELO_LAENGE_M)} × {f1(VELO_BREITE_M)} m). Wo ein Werk kein Mass nennt, gilt eine <WerkVerweis w="ANNAHME">Annahme der App</WerkVerweis>{' '}
      bzw. ein <WerkVerweis w="ENTSCHEID">Projektentscheid</WerkVerweis>; alle Regeln stehen im Abschnitt «Regeln».</p>
  </>
}

/** «Daten» (Korrektur 31.10.2026, Punkt 9a): je Dienst mit Quellenangabe aus den Daten-Modulen */
export function DatenQuellen() {
  return <ul className="klein">
    <li>Amtliche Vermessung (Fahrbahn, Trottoir, Gebäude): Amtliche Vermessung der Kantone, geodienste.ch (WFS).</li>
    <li>Strassennetz, Tempo, Signale, Veloführung: © OpenStreetMap-Mitwirkende, ODbL (Overpass).</li>
    <li>Längsneigung: Höhenmodell {HOEHEN_QUELLE} (Profildienst api3.geo.admin.ch).</li>
    <li>Luftbild: {LUFTBILD_QUELLE} (Kartenkacheln und Bild des Berichts).</li>
    {PARKKATASTER.map(q => <li key={q.id}>{q.name}: {q.quellenangabe} (WFS map.bern.ch).</li>)}
    {BAUMKATASTER.map(q => <li key={q.id}>{q.name}: {q.quellenangabe} (WFS map.bern.ch, zuschaltbar).</li>)}
    <li>Tempo Stadt Bern: {VSIG_QUELLENANGABE} (Geoportal Stadt Bern, map.bern.ch; vor OSM).</li>
  </ul>
}

/** «Quellen der Prüfungen» (Korrektur 31.10.2026, Punkt 9a): Werk | Ausgabe | Herkunft | Beschreibung | Regeln (Zahl mit Sprung) */
export function QuellenTabelle() {
  const n = regelnJeWerk()
  return <div id="quellen-pruefungen">
    <p className="klein">Worauf sich die Prüfungen stützen. Regeln: wie viele Regeln der App das Werk als Quelle nennen (Klick zeigt sie).
      Die Links ↗ führen zum Herausgeber (neues Fenster); Normen sind kostenpflichtig, die App zeigt keine Normtabellen.</p>
    <div className="tabelle-rahmen"><table className="quellen-tabelle">
      <thead><tr><th>Werk</th><th>Ausgabe</th><th>Herkunft</th><th>Beschreibung</th><th>Regeln</th></tr></thead>
      <tbody>{WERK_IDS.filter(w => (n.get(w) ?? 0) > 0).map(w => <tr key={w} id={werkAnker(w)}>
        <td><b>{WERKE[w].name}</b><div>{WERKE[w].titel}</div>{WERKE[w].link && <div><a href={WERKE[w].link!} target="_blank" rel="noopener noreferrer"
          className="werk-extern" title={`${WERKE[w].titel}: Seite des Herausgebers, neues Fenster`}>Herausgeber ↗</a></div>}
          {WERKE[w].bezug && <div className="klein">({WERKE[w].bezug})</div>}</td>
        <td>{WERKE[w].ausgabe}</td><td>{WERKE[w].herkunft}</td><td>{WERKE[w].beschreibung}</td>
        <td className="zahl-zelle"><a href={`#${regelWerkAnker(w)}`} className="werk-link" title="diese Regeln im Abschnitt «Regeln» zeigen"
          onClick={e => { e.preventDefault(); regelnWerkZeigen(w) }}>{n.get(w) ?? 0}</a></td></tr>)}</tbody>
    </table></div>
  </div>
}

/** «Begriffe» (Korrektur 31.10.2026, Punkt 9b): alphabetisch, je eine eigene Erklärung */
export function BegriffeListe() {
  return <dl className="begriffe-liste">{begriffeAlphabetisch().map(b => <Fragment key={b.id}><dt id={`begriff-${b.id}`}>{b.name}</dt>
    <dd>{b.text}</dd></Fragment>)}</dl>
}

/** Text mit dezenten Verweisen auf die Begriffe (erstes Vorkommen je Begriff; Tooltip, Klick springt in «Begriffe») */
export function BegriffText({ text, gezeigt }: { text: string; gezeigt?: Set<string> }) {
  return <>{begriffTeile(text, gezeigt).map((t, i) => ('begriff' in t ? <a key={i} href={`#begriff-${t.begriff.id}`} className="begriff-link"
    title={`${t.begriff.name}: ${t.begriff.text}`} onClick={e => { if (hilfeZeigen(`begriff-${t.begriff.id}`)) e.preventDefault() }}>{t.text}</a> :
    <Fragment key={i}>{t.text}</Fragment>))}</>
}

/** Aufklappbarer Datenschutz-Hinweis: was im Browser bleibt, welche Dienste was erhalten */
export function Datenschutz() {
  const [erster, ...weitere] = OVERPASS_ENDPOINTS.map(host)
  return (
    <details className="hilfe">
      <summary>Datenschutz</summary>
      <ul>
        <li>Keine Anmeldung, kein eigener Server: gerechnet wird im Browser (Web Worker). Nicht gesendet werden Eingaben,
          Bezeichnung, Zahlen und Status; die Dienste erhalten nur Koordinaten bzw. Ausschnitte (siehe unten).</li>
        <li>Eingaben (Hindernisse, Regelung, Halte- oder Wartelinie, D, Tempo, Neigung, Häkchen, Bezeichnung) bleiben im Browser: je Knoten bzw.
          Grundstückzufahrt mit Eingaben ein Eintrag im lokalen Speicher (localStorage, Schlüssel «SichtweitenCheck.fall.» und Nummer
          des Knotens bzw. «z» und Koordinaten des Zufahrtspunkts), sonst nur in der Fall-Datei, wenn du sie speicherst. Die zuletzt gesehene Kartenansicht (Mitte und Zoom) steht unter
          «sichtweitencheck.karteAnsicht»; nach einem Neuladen öffnet die Karte dort. Ohne
          Eingaben wird nichts gespeichert; wer alle Eingaben eines Knotens entfernt, entfernt auch seinen Eintrag. Alle Einträge
          löschst du über die Website-Daten dieser Seite in den Browser-Einstellungen.</li>
        <li>Der Browser holt die Daten direkt bei diesen Diensten; sie sehen dabei technisch die IP-Adresse und Browserangaben:
          <ul>
            <li>swisstopo (geo.admin.ch): Kartenkacheln (Luftbild bzw. Landeskarte) des sichtbaren Ausschnitts (wmts.geo.admin.ch);
              das Kartenbild des Berichts (wms.geo.admin.ch); bei der Ortssuche der eingegebene Suchbegriff, das Flugjahr des
              Luftbilds (Bericht) und für die Längsneigung bis vier Linien je Fall (Fahrstreifenachsen, Zufahrt, Trottoir) an den
              Höhendienst (api3.geo.admin.ch).</li>
            <li>geodienste.ch (Amtliche Vermessung): Rechteck ±{AV_RADIUS_M} m um den Knoten bzw. Zufahrtspunkt, bei weit reichenden
              Zielpunkten bis ±{AV_MAX_M} m.</li>
            <li>Overpass (OpenStreetMap): Kartenausschnitt (Knoten und Strassennamen) mit Rand bzw. Umkreis {OSM_RADIUS_M} m um den
              Knoten; Server {erster} (Swiss OpenStreetMap Association), bei Störung ersatzweise {weitere.join(', ')}.</li>
            <li>map.bern.ch (Geodaten Stadt Bern), nur in der Stadt Bern: Rechteck ±{KATASTER_RADIUS_M} m für die öffentlichen Parkfelder,
              die signalisierte Höchstgeschwindigkeit und, wenn zugeschaltet, das Baumkataster.</li>
          </ul>
          Der eigene Standort (Standort-Knopf) wird nur im Browser ermittelt und angezeigt, nicht gespeichert und nicht gesendet.</li>
        <li>Street View: die Links «Street View ↗» öffnen Google Maps erst auf Klick in einem neuen Fenster; dabei gehen die
          Koordinaten des Standpunkts und die Blickrichtung an Google. Die App bettet nichts von Google ein.</li>
        <li>Nutzungsstatistik: Seitenaufrufe werden mit GoatCounter gezählt, ohne Cookies und ohne Speicherung der IP-Adresse. Erfasst
          werden Seitenpfad, Herkunftsseite (Referrer), Bildschirmbreite, Browser und Betriebssystem, Sprache sowie das Land (aus der
          IP-Adresse abgeleitet), nicht deine Eingaben oder Ergebnisse. GitHub Pages protokolliert zudem Zugriffe (IP-Adresse,
          Browser), wie jeder Webserver.</li>
      </ul>
    </details>
  )
}

/** Fusszeile: Version und Lizenz */
export function Fusszeile() {
  return (
    <footer className="fuss klein">
      SichtweitenCheck v{__APP_VERSION__} ({MARKE}) · Code unter <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">MIT</a>, eigene Inhalte unter{' '}
      <a href="https://creativecommons.org/licenses/by/4.0/deed.de" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>{' '}
      (eingebundene Daten behalten ihre eigenen Lizenzen) ·{' '}
      <a href={QUELLCODE} target="_blank" rel="noopener noreferrer">Quellcode auf GitHub</a> · Vibecoding. Don't trust, verify!
      {' '}· <a href="https://ko-fi.com/pnfzygrzgfsvg" target="_blank" rel="noopener noreferrer">Unterstützen ↗</a>
    </footer>
  )
}
