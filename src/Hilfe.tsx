// ── Einstiegshilfe, Datenschutz und Fusszeile (E4a, Vorlage fgsCheck Hilfe.tsx) ──

import { OVERPASS_ENDPOINTS } from './daten/osm'
import { MARKE, QUELLCODE } from './marke'
import { AV_RADIUS_M, OSM_RADIUS_M, AV_MAX_M, KATASTER_RADIUS_M } from './rechner/rechnen'

const host = (u: string) => new URL(u).host

/** Aufklappbare Einstiegshilfe «So funktioniert's»: nur die Handlungsschritte; Grenzen stehen auf der Startseite */
export function Anleitung() {
  return (
    <details className="hilfe">
      <summary>So funktioniert's</summary>
      <p><b>Ort suchen:</b> oben in der Karte Ort, Adresse oder Strasse eingeben oder den Standort-Knopf nutzen; heranzoomen, bis
        die Knoten als blaue Punkte erscheinen. Dann das Panel von oben nach unten:</p>
      <ol>
        <li><b>Knoten:</b> blauen Punkt anklicken. Für eine Grundstückzufahrt oben «Grundstückzufahrt prüfen», auf den Fahrbahnrand
          klicken, ein zweiter Klick im Grundstück gibt die Richtung.</li>
        <li><b>Vortritt und Zufahrt:</b> Vortrittsregelung wählen, dann den Arm, aus dem die Sicht geprüft wird (im Panel oder auf
          der Karte den Arm bzw. sein Nummernschild anklicken; das gewählte Fahrzeug ist schwarz).</li>
        <li><b>Eingaben:</b> Blöcke aufklappen und anpassen: Zufahrt (Haltelinie, «D setzen» oder D auf der Karte ziehen, Trottoir, Tempo),
          Erforderliche Sichtweite (Strassentyp, Längsneigung; auf Brücken von Hand), Veloverkehr, Hindernisse (auf dem Luftbild
          zeichnen, Vorschläge bestätigen, Höhe vor Ort prüfen). Alles rechnet sofort neu; «von Hand» zeigt, wo etwas gesetzt ist.</li>
        <li><b>Ergebnis:</b> Status je Richtung für Auto, Velo und Trottoir. Braun markiert sind Annahmen, die Sie prüfen sollten;
          die Karte erklärt die «Legende».</li>
        <li><b>Massnahmen:</b> reicht die Sicht nicht, zeigt das Panel Varianten; «übernehmen» setzt sie als Eingabe.</li>
      </ol>
      <p><b>Trottoirüberfahrt:</b> führt (bzw. soll) ein Trottoir durchgehend über die Einmündung, im Block «Zufahrt» das Häkchen
        «Trottoirüberfahrt» setzen. Dann gilt kein Rechtsvortritt, und die App prüft zwei Phasen: die Sicht aufs Trottoir ab dem hinteren
        Rand der Überfahrt (Fussgänger 0,50 m vor dem hinteren Trottoirrand) und die Sicht auf die Fahrbahn ab der Bordkante. Die
        Breite: die Eingabe, sonst aus der AV (Trottoir quer über die Zufahrt, sonst das schmalere angrenzende Trottoir, 2,00 bis
        3,50 m), sonst 2,00 m als Annahme. In der Stadt Bern rechnet die App mit dem signalisierten Tempo des Geoportals (OSM nur, wo es fehlt).</p>
      <p><b>Bericht und Fall:</b> «Bericht drucken / als PDF» für die Druckansicht, «Fall speichern» und «Fall laden» für die Datei.</p>
    </details>
  )
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
        <li>Eingaben (Hindernisse, Regelung, Haltelinie, D, Tempo, Neigung, Häkchen, Bezeichnung) bleiben im Browser: je Knoten bzw.
          Grundstückzufahrt mit Eingaben ein Eintrag im lokalen Speicher (localStorage, Schlüssel «SichtweitenCheck.fall.» und Nummer
          des Knotens bzw. «z» und Koordinaten des Zufahrtspunkts), sonst nur in der Fall-Datei, wenn Sie sie speichern. Ohne
          Eingaben wird nichts gespeichert; wer alle Eingaben eines Knotens entfernt, entfernt auch seinen Eintrag. Alle Einträge
          löschen Sie über die Website-Daten dieser Seite in den Browser-Einstellungen.</li>
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
        <li>Nutzungsstatistik: Seitenaufrufe werden mit GoatCounter gezählt, ohne Cookies und ohne Speicherung der IP-Adresse. Erfasst
          werden Seitenpfad, Herkunftsseite (Referrer), Bildschirmbreite, Browser und Betriebssystem, Sprache sowie das Land (aus der
          IP-Adresse abgeleitet), nicht Ihre Eingaben oder Ergebnisse. GitHub Pages protokolliert zudem Zugriffe (IP-Adresse,
          Browser), wie jeder Webserver.</li>
      </ul>
    </details>
  )
}

/** Fusszeile: Version und Lizenz */
export function Fusszeile() {
  return (
    <footer className="fuss klein">
      SichtweitenCheck v{__APP_VERSION__} ({MARKE}) · Code &amp; eigene Inhalte unter{' '}
      <a href="https://creativecommons.org/licenses/by-nc/4.0/deed.de" target="_blank" rel="noopener noreferrer">CC BY-NC 4.0</a>{' '}
      (eingebundene Daten behalten ihre eigenen Lizenzen) ·{' '}
      <a href={QUELLCODE} target="_blank" rel="noopener noreferrer">Quellcode auf GitHub</a> · Vibecoding. Don't trust, verify!
    </footer>
  )
}
