// ── Startseite (Einstieg) wie bei fgsCheck, KnotenCheck und VeloroutenCheck: Logo, Knopf zur Prüfung, kurze Beschreibung,
// Grenzen, Querverweise und Datenspeicherung (Text E4a: Stand nach E3c mit Bericht). Die Prüfung (App) lädt erst nach «Zur Sichtprüfung», damit die Startseite
// keine Abfragen an Overpass, geodienste.ch oder swisstopo auslöst. Direkter Einstieg über #pruefen bzw. ?knoten=<OSM-Id>.

import { MARKE, QUELLCODE } from './marke'
const BASIS = import.meta.env.BASE_URL

function Querverweis({ href, bild, titel, text }: { href: string; bild: string; titel: string; text: string }) {
  return (
    <a className="start-kachel" href={href} target="_blank" rel="noopener noreferrer">
      <img src={BASIS + bild} alt="" width={56} height={56} />
      <span>
        <span className="start-kachel-titel">{titel}&nbsp;↗</span><br />
        <span className="start-kachel-text">{text}</span>
      </span>
    </a>
  )
}

export default function Startseite({ onStart }: { onStart: () => void }) {
  return (
    <main className="start">
      <img className="start-logo" src={BASIS + 'logo.svg'} alt="" aria-hidden="true" title="Zur Sichtprüfung" onClick={onStart} />
      <h1 className="start-titel">SichtweitenCheck</h1>
      <p className="start-untertitel">Sichtverhältnisse an Knoten <span className="marke">{MARKE}</span></p>
      <div className="start-knopf-zeile">
        <button className="start-knopf" onClick={onStart}>Zur Sichtprüfung →</button>
      </div>

      <p>
        SichtweitenCheck prüft, ob man aus einer Strasse ohne Vortritt oder aus einer Grundstückzufahrt genug weit nach links und
        rechts sieht. Ein Klick auf einen Knoten genügt: Die App setzt den Beobachtungspunkt, zeichnet die Sichtdreiecke und
        vergleicht die vorhandene Sicht mit der nötigen Sichtweite nach VSS 40 273, getrennt für Autos, Velos und das Trottoir.
        Bei Rechtsvortritt prüft sie, ob die Fahrzeuge einander rechtzeitig sehen.
      </p>
      <p>
        Gebäude, Parkfelder, Bäume, Hecken und Mauern verdecken die Sicht; sie werden automatisch erkannt oder von Hand ergänzt.
        Vortritt, Haltelinie, Tempo, Gefälle und Veloführung lassen sich anpassen. Reicht die Sicht nicht, zeigt die App, was
        helfen würde: Haltelinie vorziehen, Parkfelder aufheben, Tempo senken. Der Bericht fasst den Fall mit Kartenbild als PDF
        zusammen, der Fall lässt sich als Datei speichern.
      </p>
      <p>
        Grundlage sind offene Daten: das Luftbild SWISSIMAGE und das Höhenmodell von swisstopo, die Amtliche Vermessung über
        geodienste.ch und OpenStreetMap, aus dem Tempo und Veloführung stammen. In der Stadt Bern fliessen die öffentlichen
        Parkfelder und der Baumkataster automatisch ein.
      </p>
      <p className="start-grenzen">
        Die App richtet sich an Fachleute und ersetzt keine Beurteilung vor Ort. Gerechnet werden kann dort, wo die Amtliche
        Vermessung frei verfügbar ist (19 Kantone, das Wallis teilweise, Liechtenstein). Nicht geprüft: Höhe der Hindernisse,
        Kreisel, Linksabbieger beim Rechtsvortritt; auf Brücken die Längsneigung von Hand eingeben.
      </p>

      <Querverweis href="https://fgscheck.ch/" bild="fgscheck.svg" titel="fgsCheck"
        text="Sichtprüfung an Fussgängerstreifen." />
      <Querverweis href="https://knotencheck.ch/" bild="knotencheck.png" titel="KnotenCheck"
        text="Werkzeug zur Leistungsbeurteilung von Knoten innerorts." />
      <Querverweis href="https://veloroutencheck.ch/" bild="veloroutencheck.svg" titel="VeloroutenCheck"
        text="Qualität der Veloinfrastruktur bewerten." />

      <div className="start-daten">
        <div className="start-daten-titel">Datenspeicherung</div>
        <div>Alle Berechnungen laufen im Browser. Eingaben und Ergebnisse werden an keinen Server übermittelt; sie bleiben im
          Speicher dieses Browsers (je Knoten bzw. Grundstückzufahrt) und in einer Fall-Datei, wenn du sie speicherst.</div>
        <ul>
          <li>Für Karte, Rechnung und Bericht fragt die App den Kartenausschnitt bei swisstopo, geodienste.ch, OpenStreetMap
            (Overpass) und in Bern bei map.bern.ch ab; gesendet werden nur Koordinaten. Den Suchbegriff der Ortssuche erhält
            swisstopo; der eigene Standort bleibt im Browser.</li>
          <li>Nutzungsstatistik: Seitenaufrufe werden mit GoatCounter gezählt, ohne Cookies und ohne Speicherung der
            IP-Adresse. GitHub Pages protokolliert Zugriffe wie jeder Webserver.</li>
        </ul>
      </div>
      <p className="start-fuss">
        SichtweitenCheck v{__APP_VERSION__} · Code unter <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">MIT</a>, eigene Inhalte unter{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/deed.de" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
        {' '}· <a href={QUELLCODE} target="_blank" rel="noopener noreferrer">Quellcode auf GitHub</a>
      </p>
    </main>
  )
}
