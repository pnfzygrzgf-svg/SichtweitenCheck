# SichtweitenCheck (Beta)

Prüft im Browser die Sicht an Knoten, Kreiseln und Grundstückzufahrten nach VSS 40 273 und VSS 40 090b, für Motorfahrzeuge, Velos
und den Trottoirverkehr. Die App nutzt Daten der Amtlichen Vermessung und von OpenStreetMap, zeigt Sichtdreiecke und verdeckende
Hindernisse, rechnet Massnahmen durch und erstellt einen Bericht.

App: https://sichtweitencheck.ch/ · Code: https://github.com/pnfzygrzgf-svg/SichtweitenCheck

Vibecoding. Don't trust, verify!

Die Bedienung steht in der App unter «So funktioniert's», die Rechenregeln mit Normstellen unter «Regeln» und «Begriffe».

## Start

```bash
npm install
npm run dev      # Entwicklungsserver, Adresse steht in der Ausgabe
npm test         # Tests (vitest)
npm run build    # Typprüfung und Build nach dist/
```

Direkt einsteigen: `?knoten=30949365` öffnet den Knoten Hallerstrasse / Alpeneggstrasse in Bern.

## Aufbau

React, TypeScript und Vite, Karte mit Leaflet. Es gibt keinen eigenen Server; gerechnet wird im Web Worker.

| Ort | Inhalt |
|---|---|
| `src/rechner/` | Rechenkern ohne Oberfläche, Einstieg `rechnen.ts`, Kreisel in `kreisel*.ts` |
| `src/daten/` | Abruf und Einlesen der Quellen |
| `src/daten/anbieter/gemeinsam/` | gemeinsame Datenmodule, Kopie aus dem fgsCheck |
| `src/hoehenkurven/`, `src/hoehenprofil/` | Höhenkurven und Geländeschnitte, Kopie aus dem fgsCheck |
| `src/regeln.ts`, `src/begriffe.ts` | Regeln und Begriffe, wie sie die App anzeigt |
| `src/fall.ts` | Fall-Datei und Speicherung im Browser |

Die kopierten Module werden im fgsCheck geändert und von dort übernommen; `herkunft.json` und `herkunft.test.ts` prüfen die Kopie:

```bash
node scripts/anbieter_uebernehmen.mjs ../../SichtweitenCheck/SichtweitenCheckWeb   # im App-Ordner des fgsCheck
```

Umgekehrt ist der Rechenkern hier führend: Der fgsCheck holt ihn für seine Knotensicht mit `scripts/knotensicht_holen.mjs`.

## Datenquellen

Reihenfolge je Wert: eigene Angabe, amtliche örtliche Quelle, OSM. Fehlt eine örtliche Quelle oder schlägt ihr Abruf fehl, zeigt die
App das an, statt «keines» anzunehmen. Welche Quellen an einem Ort gelten, steht unter «Datenquellen und Ladezustand».

- Luftbild, Landeskarte, Höhenmodell swissALTI3D (Profile; ausserhalb der Stadt Bern), swissTLM3D, Gemeindegrenzen: © swisstopo
- Haltestellen, Bauzonen, Unfälle: BAV, ARE und ASTRA über geo.admin.ch
- Bodenbedeckung: Amtliche Vermessung der Kantone über geodienste.ch
- Strassennetz, Tempo, Veloführung: © OpenStreetMap-Mitwirkende, ODbL (Overpass API)
- Parkfelder, Bäume, Tempo, Geländemodell DTM 2023 (Höhenprofile) Stadt Bern: Geodaten Stadt Bern
- Tempo, Zonen, Signale und Kartenkontext weiterer Kantone und Städte: je nach Ort, Anbieter und Lizenz nennt die App

Normen erscheinen nur als Nummern, Ziffern, Seiten und Zahlenwerte, nie als Normtext. Sie liegen nicht im Repository.
Lizenzen der eingebundenen Bibliotheken und Daten stehen unter `public/licenses/`.

## Datenschutz

Keine Anmeldung, kein eigener Server. Eingaben, Bezeichnung und Ergebnisse werden nicht gesendet; sie bleiben im Browser
(localStorage) oder in der Fall-Datei. Der Browser holt Karten und Daten direkt bei den Diensten. Diese erhalten nur Koordinaten,
Ausschnitte und Suchbegriffe und sehen technisch die IP-Adresse und Browserangaben. Seitenaufrufe zählt GoatCounter ohne Cookies und
ohne Speicherung der IP-Adresse. Die vollständige Liste der Dienste steht in der App unter «Datenschutz».

## Grenzen

- Stadt Luzern: Statt der Amtlichen Vermessung rechnet die App mit den Strassenflächen der Stadt und den Gebäudegrundrissen des Kantons; Einzelobjekte fehlen.
- Amtliche Vermessung: LU, VD, NE, NW, OW und JU sind nur mit Freigabe zugänglich, das Wallis nur teilweise. Dort rechnet die App nicht.
- Gerechnet wird in der Ebene: Höhe der Hindernisse und Höhenbereich sind vor Ort zu prüfen.
- Die Längsneigung ist eine mittlere Neigung aus dem Geländemodell, auf Brücken und in Unterführungen ist sie von Hand einzugeben.
- Amtliche Parkfelder gibt es nur für die Stadt Bern und nur für öffentliche Felder.
- Rechtsvortritt: Die Wahrnehmbarkeit ist eine Eingabe, Linksabbieger gegen den Gegenverkehr sind nicht geprüft.
- Kreisel: Die Sicht aus der Einfahrt ist geprüft, die Anhaltesichtweite auf dem Ring und in die Ausfahrt noch nicht. Velobypässe
  erkennt die App nur, wenn sie in OSM kartiert sind.
- Die App ersetzt keine Beurteilung vor Ort.

## Veröffentlichung

`.github/workflows/deploy.yml` baut bei jedem Push auf `main` (`npm ci`, Tests, `npm run build`) und veröffentlicht `dist/` auf
GitHub Pages unter https://sichtweitencheck.ch/. Name, Marke und Adresse stehen in `src/marke.ts`.

## Lizenz

Der Rechner ist frei nutzbar. Wer die Weiterentwicklung unterstützen möchte, kann über Ko-fi spenden: [ko-fi.com/pnfzygrzgfsvg](https://ko-fi.com/pnfzygrzgfsvg).

Code: **[MIT](LICENSE)** (Copyright (c) 2026 pnfzygrzgf-svg). Eigene Inhalte (Texte, Dokumentation, Berichte, eigene Grafiken):
**[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.de)**. Name und Logo sind ausgenommen; Überblick in
[LICENSE-INHALTE.md](LICENSE-INHALTE.md). Bis zur Version 0.7.0 (31.10.2026) galt CC BY-NC 4.0. Die eingebundenen Dritt-Daten
behalten ihre eigenen Lizenzen; Werte aus den VSS-Normen erscheinen nur als Ziffern, Seiten und Zahlen.

### Parkplatzgeometrie und Nachweise

Katasterpolygone bleiben als Quelle unverändert. Für eindeutig einer Strasse zugeordnete, konvexe Längsparkflächen von Autos wird eine
schmalere Prüffläche ausschliesslich zur Fahrbahn hin auf mindestens 1,90 m ergänzt, im Kanton Zürich auf 2,00 m. Der äussere Rand und
die Länge bleiben erhalten. Handgeometrien und breitere Polygone werden nicht geändert. Ohne eindeutige Längsrichtung
oder Fahrbahnseite bleibt das Polygon mit einem Prüfhinweis unverändert; Schräg-/Senkrechtparkierung wird nicht mit Längsmassen ergänzt.

Rechnung, Karte und Bericht verwenden dieselben Prüfflächen, in der 3D-Ansicht des fgsCheck auch die Parkquader. Die ursprünglichen
Katasterumrisse ergänzter Flächen erscheinen grau gestrichelt. Tooltip und Tabelle «Parkflächen: Annahmen und Katasterumrisse» nennen
Katasterbreite, verwendete Breite, Ergänzung und Grundlage. Vorhandene Plan-Seitenräume werden erst danach abgezogen.

Die regionale Vorgabe gilt auch für den Abzug eines erkannten Parkstreifens von der Fahrbahnbreite; die Fahrlinie wird aus der
verbleibenden Breite bestimmt. Erkennungsregeln und Eingaben von Hand bleiben bestehen. Katasterpolygone sind keine Vor-Ort-Messung.

Grundlagen: **SN 640 291a – Parkieren, Anordnung und Geometrie der Parkierungsanlagen**, gültig ab 1. Februar 2006, Tabelle 2,
Komfortstufen A/B (1,90 m; C: 2,00 m). **Kanton Zürich, Richtlinie Parkieren entlang von Staatsstrassen, 601.14.01**, Version 1.0 vom
1.11.2022, Kapitel 4.1 (2,00 m). Deren Geltung auf Staatsstrassen wird als solche ausgewiesen; die Verwendung von 2,00 m im ganzen
Kanton ist eine Modellannahme. Die App weist damit keine heutige Normkonformität nach und addiert keine Überhang-/Sicherheitsstreifen.

Parkverbotsfelder (`Parkverbot`, Anzeige «Parkverbotsfeld») werden ebenfalls geladen und wie belegte Auto-Parkfelder für Sichtverdeckung und Parkstreifenerkennung berücksichtigt und nach derselben Mindestbreitenregel
zur Fahrbahn hin ergänzt. Die Bezeichnung «Parkverbotsfeld» und das ursprüngliche Katasterpolygon als Quelle bleiben erhalten.

Örtliche Grundlagen der Stadt Bern: **Bern baut C 2.10.22 – Parkfelder 1/2 (Auto)**, revidiert März 2019 (Längspark- und
Parkverbotsfelder 1,90 m), sowie **C 2.10.23 – Parkfelder 2/2**, revidiert April 2011. Danach erhalten `Parkplatz_Velo_Mofa`
1,90 m Tiefe quer zur Strasse und `Parkplatz_Motorrad` je Anordnung längs 1,20 m, senkrecht 2,30 m oder schräg 45° 1,90 m.
Diese Zweiradmasse gelten ausserhalb Berns als ausdrücklich ausgewiesene Modellannahme. Der Berner Motorrad-Kataster hat kein
Anordnungsfeld: Auswahl je Fläche im Panel, bis dahin Originalumriss mit Hinweis. Die Auswahl wird mit dem Fall gespeichert.
Velo/Mofa und Motorrad bleiben bei der Sichtprüfung nur Hinweis. Gemessen wird die Tiefe der Gruppe quer zur Strasse, nicht die
Breite eines einzelnen Velo-/Motorradstellplatzes. Auch hier erfolgt eine Ergänzung ausschliesslich zur Fahrbahn hin, ohne Kürzung.
