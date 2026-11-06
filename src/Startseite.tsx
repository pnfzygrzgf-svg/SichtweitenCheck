// ── Startseite (Einstieg) wie bei fgsCheck, KnotenCheck und VeloroutenCheck: Logo, Knopf zur Prüfung, kurze Beschreibung,
// Querverweise und Datenspeicherung (Text E4a: Stand nach E3c mit Bericht). Die Prüfung (App) lädt erst nach «Zur Sichtprüfung», damit die Startseite
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
      <p className="start-untertitel">Sichtverhältnisse an Knoten <span className="marke">{MARKE} v{__APP_VERSION__}</span></p>
      <div className="start-knopf-zeile">
        <button className="start-knopf" onClick={onStart}>Zur Sichtprüfung →</button>
      </div>

      <p>
        <b>Funktion:</b> SichtweitenCheck prüft, ob man aus einer Strasse ohne Vortritt oder aus einer Grundstückzufahrt genug weit
        nach links und rechts sieht. Ein Klick auf einen Knoten genügt: Die App setzt den Beobachtungspunkt, zeichnet die
        Sichtdreiecke und vergleicht die vorhandene Sicht mit der nötigen Sichtweite, getrennt für Autos, Velos und das Trottoir.
        Bei Rechtsvortritt prüft sie, ob die Fahrzeuge einander rechtzeitig sehen.
      </p>
      <p>
        Gebäude, Parkfelder, Bäume, Hecken und Mauern verdecken die Sicht; sie werden automatisch erkannt oder von Hand ergänzt.
        Vortritt, Haltelinie, Tempo, Gefälle und Veloführung lassen sich anpassen. Reicht die Sicht nicht, zeigt die App, was
        helfen würde: Haltelinie vorziehen, Parkfelder aufheben, Tempo senken. Der Bericht fasst den Fall mit Kartenbild als PDF
        zusammen, der Fall lässt sich als Datei speichern.
      </p>
      <p>
        <b>Daten:</b> Verwendet werden offene Daten: das Luftbild SWISSIMAGE und das Höhenmodell von swisstopo, die Amtliche
        Vermessung über geodienste.ch und OpenStreetMap, aus dem Tempo und Veloführung stammen. In Zürich fliessen amtliche
        Tempoabschnitte und Verkehrszonen ein. In der Stadt Bern fliessen die öffentlichen Parkfelder, der Baumkataster und das
        Geländemodell der Stadt automatisch ein.
      </p>
      <p>
        <b>Bewertungsgrundlage:</b> Die App prüft nach VSS 40 273 und VSS 40 090b. Die einzelnen Regeln stehen im Rechner unter
        «Regeln».
      </p>
      <p><b>Die App ersetzt keine Beurteilung vor Ort.</b></p>

      <Querverweis href="https://fgscheck.ch/" bild="fgscheck.svg" titel="fgsCheck"
        text="Sichtprüfung an Fussgängerstreifen." />
      <Querverweis href="https://veloroutencheck.ch/" bild="veloroutencheck.svg" titel="VeloroutenCheck"
        text="Qualität der Veloinfrastruktur bewerten." />
      <Querverweis href="https://knotencheck.ch/" bild="knotencheck.png" titel="KnotenCheck"
        text="Werkzeug zur Leistungsbeurteilung von Knoten innerorts." />

      {/* Unterstützen (Ko-fi, 31.10.2026): wie im VeloroutenCheck als eigene Karte auf der Startseite */}
      <div className="start-spende">
        <div className="start-spende-text">
          <div className="start-spende-titel">SichtweitenCheck unterstützen</div>
          <div className="start-spende-hinweis">
            Der Rechner ist frei nutzbar und quelloffen. Wer die Weiterentwicklung unterstützen möchte, kann über
            Ko-fi spenden.
          </div>
        </div>
        <a className="start-spende-knopf" href="https://ko-fi.com/pnfzygrzgfsvg" target="_blank" rel="noopener noreferrer">
          Über Ko-fi unterstützen ↗
        </a>
      </div>

      <div className="start-daten">
        <div className="start-daten-titel">Datenspeicherung</div>
        <div>Alle Berechnungen laufen im Browser. Eingaben und Ergebnisse werden an keinen Server übermittelt.</div>
        <ul>
          <li>Eingaben merkt sich der Browser je Knoten bzw. Grundstückzufahrt (lokaler Speicher). Die Fall-Datei und der
            PDF-Bericht werden lokal gespeichert, ohne Upload.</li>
          <li>Für Karte, Rechnung und Bericht fragt die App den Kartenausschnitt bei swisstopo, geodienste.ch, OpenStreetMap
            (Overpass), in Bern bei map.bern.ch und gisapp.bern.ch, in Zürich bei den Geodatendiensten der Stadt und des Kantons
            (www.ogd.stadt-zuerich.ch, data.stadt-zuerich.ch, maps.zh.ch) und in St. Gallen bei daten.stadt.sg.ch ab; gesendet
            werden nur Koordinaten. Den Suchbegriff der Ortssuche erhält swisstopo; der eigene Standort bleibt im Browser. Die Dienste sehen technisch die IP-Adresse.
            Die Links «Street View ↗» öffnen Google Maps erst auf Klick; dabei gehen die Koordinaten an Google. Die vollständige Liste
            der Dienste steht in der App unter «Datenschutz».</li>
          <li>Nutzungsstatistik: Seitenaufrufe werden mit GoatCounter gezählt, ohne Cookies und ohne Speicherung der
            IP-Adresse. GitHub Pages protokolliert Zugriffe wie jeder Webserver.</li>
        </ul>
      </div>
      <p className="start-fuss">
        SichtweitenCheck {MARKE} v{__APP_VERSION__} · Code unter <a href="https://opensource.org/license/mit" target="_blank" rel="noopener noreferrer">MIT</a>, eigene Inhalte unter{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/deed.de" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
        {' '}(eingebundene Daten behalten ihre eigenen Lizenzen) · <a href={QUELLCODE} target="_blank" rel="noopener noreferrer">Quellcode auf GitHub</a>
        {' '}· <a href="https://ko-fi.com/pnfzygrzgfsvg" target="_blank" rel="noopener noreferrer">Unterstützen ↗</a>
      </p>
    </main>
  )
}
