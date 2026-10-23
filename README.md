# SichtweitenCheck (Beta)

Sichtverhältnisse an Knoten und Grundstückzufahrten im Browser: Beobachtungspunkt D, Sichtdreiecke nach links und rechts, erforderliche und vorhandene
Knotensichtweite A nach VSS 40 273 (Tab. 1, Motorfahrzeuge) mit Strassentyp und Anhaltesichtweite nach VSS 40 090b (Abb. 2), für
den Veloverkehr (Tab. 3, Mischverkehr, Radstreifen, Radweg) und den Trottoirverkehr an Trottoirüberfahrten (Tab. 2),
verdeckende Gebäude aus der Amtlichen Vermessung und Hindernisse (amtliche Parkfelder der Stadt Bern, Parkierung, Bäume, Hecken,
Mauern, Zäune; von Hand bzw. als Vorschlag). Vortrittsregelung, Haltelinie, Beobachtungspunkt, Trottoir und Tempo lassen sich von
Hand setzen; ein Fall lässt sich als Datei speichern und laden. Die Längsneigung je Richtung kommt aus dem Höhenmodell swissALTI3D
(ganze Schweiz), bei ungenügender Sicht rechnet die App die Massnahmen nach Ziffer 14 als Varianten durch. Knoten mit
Rechtsvortritt prüft sie nach Teil E (Ziffern 15 bis 18): Wahrnehmbarkeit und Knotensichtweite nach Abb. 6, schmale Zufahrten
nach Abb. 5. Ein Bericht (Druckansicht, PDF über den Druckdialog) fasst den Fall mit Kartenbild zusammen.
Code: https://github.com/pnfzygrzgf-svg/SichtweitenCheck; Veröffentlichung unter https://sichtweitencheck.ch/.

Vibecoding. Don't trust, verify!

## Start

```bash
npm install
npm run dev      # Entwicklungsserver, Adresse steht in der Ausgabe
npm test         # Tests (vitest)
npm run build    # Typprüfung und Build nach dist/
```

Beispiel: `http://localhost:5173/?knoten=30949365` öffnet direkt den Knoten Hallerstrasse / Alpeneggstrasse in Bern
(Tempo 30, die Alpeneggstrasse mündet in die Hallerstrasse; amtliche Parkfelder an der Hallerstrasse: Achsen neben dem
Parkstreifen, beide Seiten nur der untere Wert erfüllt).
`?knoten=32865596` ist Brückfeldstrasse / Fischerweg (Parkfeld an der Brückfeldstrasse verdeckt nach links). Weitere Knoten zum Ausprobieren: `?knoten=33117199`
(Gesellschaftsstrasse / Sennweg), `?knoten=438227925` (Engehaldenstrasse / Schwyzerstärnweg, Tempo 50).
Zur Längsneigung: `?knoten=306255273` (Lerberstrasse / Aargauerstalden, 50 km/h, rund ±7 %) und `?knoten=559648141` (Brechbühlerstrasse
/ Bitziusstrasse, 30 km/h, rund +8 / −8 %).
`?zufahrt=2599903.4,1200347.2` öffnet eine Grundstückzufahrt an der Hallerstrasse mit Trottoir (B ab der Trottoirhinterkante bzw.
mit dem Häkchen «Trottoir ohne Hindernisse» ab der Bordkante).

## Bedienung

1. Ort finden (Ortssuche oben in der Karte, Standort-Knopf). Ab Zoom 16 sucht die App die Knoten im Ausschnitt (OSM-Knoten mit
   drei und mehr Strassenarmen) und zeigt sie als blaue Punkte.
2. Knoten anklicken: die App lädt AV (±150 m) und OSM (300 m) und rechnet im Web Worker. Reichen die Zielpunkte über den
   AV-Ausschnitt hinaus (ab etwa 60 km/h), lädt sie die AV einmal mit dem nötigen Radius nach (weitester Zielpunkt ab Knoten plus
   20 m, höchstens 400 m) und rechnet neu; der Radius steht unter «Geladene Quellen». Bei einer Einmündung schlägt sie
   die Zufahrt vor (einziger Arm ausserhalb der Vortrittsstrasse); sonst im Panel (Schritt 2 «Vortritt und Zufahrt») bzw. auf
   der Karte einen Arm bzw. sein Nummernschild als Zufahrt wählen. Die Arme tragen je Knoten feste Nummern im Uhrzeigersinn ab
   Norden (1, 2, 3 …; Grundstückzufahrt «Z»), überall gleich: Schild auf der Karte rund 12 m vom Knoten auf der Armachse (bei Zoom 17 und
   kleiner mindestens 28 px, höchstens am Ende des Arms; Strassennamen, die ein Schild träfen, ausgeblendet; gewählte Zufahrt grün),
   Kartenbild im Bericht, Panel, Bericht und Texte als «1 Jolimontstrasse (Nordwest)» (`armText` in `rechner/knoten.ts`). Das Panel führt in fünf nummerierten Schritten durch die Prüfung: 1 Knoten (bzw.
   Grundstückzufahrt), 2 Vortritt und Zufahrt, 3 Eingaben (vier eingeklappte Blöcke Zufahrt, Erforderliche Sichtweite,
   Veloverkehr, Hindernisse; je mit einer Kurzzeile zum Stand und «von Hand», sobald etwas gesetzt ist; der Aufklappzustand
   bleibt im Browser, Schlüssel «SichtweitenCheck.panel.<Block>»), 4 Ergebnis (nur lesen), 5 Massnahmen. Jede Zeile zeigt nur
   ihren Stand (Wert, Quelle in Klammern, «von Hand» bzw. «Annahme» braun); die Erklärung (Normziffer, Rechenregel, Herleitung)
   steht im Info-Zeichen «i» hinter der Zeile (`Info.tsx`: Klick bzw. Fingertipp, auf dem Desktop auch Überfahren, Tastatur mit
   Enter bzw. Leertaste, Escape schliesst; höchstens eine Sprechblase offen, innerhalb des Panels). Warnungen mit Folgen
   («Häkchen ohne Wirkung», «D liegt in einem Gebäude», AV-Grenze, Höhenmodell lädt) bleiben sichtbar. Der Knoten steht danach in der Adresse (`?knoten=…`), eine Grundstückzufahrt als Zufahrtspunkt (`?zufahrt=E,N`, LV95). Beim direkten Einstieg über `?knoten=…` holt die App Lage
   und Umkreis des Knotens in einer Overpass-Abfrage, danach die AV. Solange der Umkreis lädt, wartet die Knotensuche im
   Ausschnitt; danach holt die App sie nach. So gehen die Overpass-Abfragen nacheinander hinaus. Scheitert das Laden, nennt
   die Meldung jeden versuchten Overpass-Server mit Status bzw. Fehler und bietet «erneut laden» an.
3. Panel, Schritt 3, Block «Erforderliche Sichtweite»: Strassentyp der Vortrittsstrasse (Vorgabe aus OSM `highway`), drei Häkchen für
   ungünstige Verhältnisse (Vorgaben aus OSM `lanes` und der Neigung, Schwerverkehr von Hand), Längsneigung je Richtung in %
   (Vorgabe aus dem Höhenmodell, Stand «(Höhenmodell)», die Quelle «swissALTI3D (swisstopo), Profil x m, n Punkte» im Info-Zeichen; eine Eingabe gilt «von Hand»,
   «Vorgabe» setzt zurück; bis das Profil da ist bzw. bei einem Fehler des Dienstes 0 % mit Hinweis). Je Richtung Tempo mit Quelle, A nach Strassentyp, Anhaltesichtweite bei i, A massgebend mit Herkunft,
   vorhandene Sichtweite, Status, verdeckendes Gebäude stehen im Ergebnis (Schritt 4) unter «Verkehr von links / rechts» bzw. «Gegenverkehr»; dazu
   Vortrittsregelung, B mit Nullpunkt, D und eingeklappt «Hinweise und Annahmen» mit der Rechenzeit.
   Die Eingaben gelten für die gewählte Zufahrt (eine andere Zufahrt setzt sie zurück) und bleiben im Browser bzw. in der
   Fall-Datei. Karte: D (weisser Punkt mit dunklem Rand und Beschriftung «D», am Fahrersitz von F<sub>B</sub>), Achse des Zufahrtsstreifens (orange), Fahrstreifenachsen (weiss
   gestrichelt) mit K, Sichtdreiecke (grün frei, rot ab der ersten Verdeckung bis A), verdeckendes Gebäude (rot). Fahrzeuge aus der Vogelperspektive (nur Darstellung, Personenwagen 4,5 × 1,8 m angenommen):
   F<sub>B</sub> dunkel auf der Zufahrt mit dem Lenker D 2,0 m hinter der Front, F<sub>A</sub> hell je Richtung mit der Front am Ende der
   massgebenden Sichtweite A, auf den Knoten zu fahrend (`rechner/fahrzeug.ts`).
4. Panel, Schritt 3, Block «Hindernisse» (E2a):
   - **Werkzeuge:** Parkfeld (Ecken anklicken, Doppelklick schliesst; Klasse Auto, Velo oder Motorrad), Längsparkierung
     (Mittellinie, Breite Vorgabe 2,0 m), Baum (Stamm anklicken), Hecke, Mauer (Linie; Häkchen «sichtbehindernd», Vorgabe ja),
     Zaun (Linie; Häkchen «dicht», sonst sichtdurchlässig), übriges (Fläche; «sichtbehindernd»). «Fertig» bzw. Doppelklick
     schliesst, «Abbrechen» verwirft. Liste der Eingaben mit «bearbeiten» (Ecken auf der Karte ziehen) und «löschen»; die
     Häkchen lassen sich in der Liste umstellen. Nach jeder Änderung rechnet die App neu.
   - **Amtliche Parkfelder** (Stadt Bern, Häkchen, Vorgabe an): zählen sofort als Hindernis. Ein Feld auf der Karte anklicken und
     «gewähltes Parkfeld verwerfen»; verworfene erscheinen gepunktet, «wieder zählen» bzw. «verworfene wieder einblenden».
   - **Vorschläge:** Parkierung aus OSM (`parking:left/right/both` = lane, half_on_kerb, street_side bzw. `parking:lane:*`) im
     Sichtfeld, gestrichelt, mit «bestätigen» und «verwerfen»; Vorschläge, die amtliche Auto-Felder zu 30 % decken, entfallen.
     Baumkataster Bern (Häkchen, Vorgabe aus): Bäume bis zur Reichweite der Rechnung als Vorschlag, einzeln (auf der Karte
     anklicken) oder «alle bestätigen».
   - Je Richtung im Ergebnis: Liste «Im Sichtdreieck bis A» mit Art, Name, Quelle, Wirkung, erstem verdecktem Meter und
     verdeckter Strecke; Statuszusatz «Hinweis: Zweiräder», «Hinweis: Zaun» bzw. «Hinweis: Palisade x %». Karte: Hindernisse nach
     Art eingefärbt, Verdecker im Sichtdreieck mit Rand rot (verdeckt), gelb (Baum, Palisade) bzw. violett gestrichelt (nur
     Hinweis); Tooltip mit Art, Name und «verdeckt für Verkehr von links ab x m». Die Tooltips der Karte sind kurz (Stand in einer
     Zeile; Annahmen wie die Grösse der Fahrzeuge stehen in der Legende), brechen um und sind höchstens 260 px bzw. 45 % der
     Kartenbreite breit, so dass sie neben dem Mauszeiger ganz in der Karte bleiben.
   - Hindernisse, verworfene Vorschläge und die Häkchen der Quellen bleiben je Knoten bzw. Zufahrtspunkt im Browser (localStorage);
     beim nächsten Öffnen übernimmt die App sie (Hinweis unter den Knöpfen «Fall laden» / «Fall speichern»).
5. Panel, Schritt 2 «Vortritt und Zufahrt» und Schritt 3, Block «Zufahrt» (E2b):
   - **Vortrittsregelung** (Schritt 2, über der Armwahl): Vortritt, Stop, Rechtsvortritt. Vorgabe aus OSM `highway=stop` an der Zufahrt (Stop) bzw. `give_way`
     (Vortritt); ohne Signal nach der Vortrittsstrasse (`rechner/rechnen.ts` regelungVorgabe): Hauptverkehrsstrasse (trunk, primary,
     secondary, tertiary und deren links, `priority_road`, `maxspeed` ab 50) Vortritt, Quartierstrasse (residential, living_street) mit
     Tempo 30 bzw. 20 oder unclassified in einer Tempo-30-Zone Rechtsvortritt (SVG Art. 36 Abs. 2), sonst Vortritt; Grundstückzufahrt
     immer Vortritt. Ohne Signal ist die Vorgabe eine Annahme (braun, mit Grund); «Vorgabe» setzt zurück. Rechtsvortritt: siehe Punkt 9.
   - **Haltelinie:** «Haltelinie setzen», dann die Vorderkante (Seite zur Vortrittsstrasse) nahe der Zufahrtsachse anklicken; die
     App lotet den Punkt auf die Achse, B gilt ab dort. «neu setzen», «entfernen». Karte: weisse Querlinie mit dunklem Rand.
   - **D:** «D setzen» und auf der Karte klicken, oder den Punkt auf der Karte ziehen (D von Hand, Rand Bernstein); Panel und Ergebnis nennen den Abstand hinter dem Nullpunkt und links
     bzw. rechts der Achse; «zurücksetzen». F<sub>B</sub> folgt D.
   - **Trottoir:** Häkchen «Trottoir ohne Hindernisse: F<sub>B</sub> wartet an der Bordkante», nur wählbar, wenn die AV ein Trottoir
     quer über die Zufahrt zeigt (Beginn höchstens 1,5 m hinter der Kante, höchstens 8 m lang); sonst ausgegraut mit Grund.
   - **Tempo je Richtung:** Art (Vorgabe aus OSM, signalisierte Höchstgeschwindigkeit, Projektierungsgeschwindigkeit VP, V85,
     fahrbares Tempo bei Verkehrsberuhigung), Wert (10 bis 120 km/h, ganze Zahl) und Begründung; übernommen beim Verlassen des Felds.
     Die Art steht im Ergebnis bei der Tempo-Quelle, die Vorgabe daneben.
   - **Grundstückzufahrt:** oben in der Knopfzeile «Grundstückzufahrt prüfen», dann auf den Fahrbahnrand der Vortrittsstrasse klicken, in der
     Mitte der Zufahrt (bzw. auf einen OSM-Weg `service` nahe der Einmündung); ein zweiter Klick im Grundstück zeichnet die Richtung,
     sonst «senkrecht zum Rand übernehmen». Bis 50 m von der Mitte der geladenen Daten rechnet die App ohne neues Laden und übernimmt
     Hindernisse und verworfene Vorschläge des bisherigen Falls (ausser der Zufahrtspunkt ist im Browser schon gemerkt); weiter weg
     lädt sie AV und OSM um den Zufahrtspunkt. Schritt 1 heisst dann «Grundstückzufahrt», mit «Zufahrt neu setzen» und
     «zurück zum Knoten»; Schritt 2 zeigt nur die Vortrittsregelung. Ein Wechsel auf einen anderen Arm setzt die
     Eingaben zurück (Rückfrage, wenn welche gesetzt sind).
6. Panel, Schritt 3, Block «Veloverkehr» (E3b): je Richtung die **Veloführung** (Vorgabe aus OSM, mit Quelle: Mischverkehr, Radstreifen
   aus `cycleway:*=lane`, Radweg aus `highway=cycleway` bzw. Fuss- und Radweg mit `bicycle=designated` neben der Strasse oder
   `cycleway:*=track`, kein Veloverkehr bei `bicycle=no` bzw. Autobahn und Autostrasse); «Vorgabe» bzw. eine Führung wählen.
   Velo gegen die Einbahn (E4): ist ein Arm der Vortrittsstrasse eine Einbahn vom Knoten weg, aber für Velos offen
   (`oneway:bicycle=no`, `cycleway*=opposite*`, `cycleway:*:oneway` gegen die Einbahn), steht bei dieser Richtung «nur Velos» mit dem
   Tag; Vorgabe Radstreifen bei `opposite_lane`, Radweg bei `opposite_track`, sonst Mischverkehr. Ist die Zufahrt eine solche Einbahn,
   nennt der Block die Zufahrt mit dem Tag: F<sub>B</sub> ist dann ein Velo.
   Häkchen **«schnelle E-Bikes verboten»** (nur über 30 km/h wählbar). Im Ergebnis zuoberst der Leitsatz («Sicht aus der Zufahrt …
   nach links und rechts»), dann je Richtung eine **Statuszeile** mit Punkt (schlechtester Teil) und drei farbigen Feldern mit Text
   (z. B. «Auto nicht erfüllt», «Velo erfüllt», «Trottoir keines»; «keine Autos» bei Einbahn, «kein Veloverkehr»), darunter die
   Kopfzeilen und je Richtung («Verkehr von links / rechts», mit Tempo und Quelle; liegt ein Arm höchstens 30° neben der
   Geradeausrichtung, heisst er «Gegenverkehr», und die Statusübersicht zeigt grau «links: kein Arm» bzw. «rechts: kein Arm»,
   wenn auf dieser Seite kein Arm liegt; dieselben Wörter in Eingaben, Karte, Bericht und Massnahmen) die Teile Auto, Velo und mit Trottoir an der
   Zufahrt Trottoir nebeneinander (auf schmalem Panel untereinander), je mit A erforderlich (Herkunft kurz: Tab. 1 mit Stufe,
   Anhaltesichtweite, Tab. 3, Tab. 2), A vorhanden, Status und erstem Verdecker; Tempo, Bereich, Anhaltesichtweite, Achsen, Liste
   im Sichtdreieck und Hinweise im Info-Zeichen «Herleitung» des Teils. Karte: Velo-Sichtdreieck Petrol
   gestrichelt (Fläche schwach, verdeckter Teil rot gestrichelt), Veloachse Petrol gestrichelt, Velo von oben (1,8 × 0,6 m) mit dem
   Vorderrad bei A (bei «nur Velos» ohne F<sub>A</sub>); Trottoir: zwei kleine Dreiecke von D' (Bernstein-Punkt) zu den Trottoirpunkten, Fussgänger (Punkt mit Ring) bei A.
   Hecken und Zäune an der Grundstücksgrenze im Block «Hindernisse» zeichnen; sie zählen auch für das Trottoir.
7. Panel, Schritt 5 «Massnahmen» (E3a, unter dem Ergebnis, nur wenn eine Richtung für Motorfahrzeuge oder Velo nicht erfüllt ist): die Massnahmen der Ziffer 14
   in ihrer Reihenfolge, je mit Rechnung und «reicht» bzw. «reicht nicht» oder als Vermerk. Klick auf ein Hindernis in der Liste
   hebt es auf der Karte hervor (türkis gestrichelt); «übernehmen» setzt Haltelinie, Stop bzw. Tempo (signalisiert, mit Begründung)
   als Eingabe. Beim Spiegel die Bedingungen abhaken (im Fall gemerkt; die App zählt nur).
8. **Fall-Datei:** «Fall speichern» schreibt eine JSON-Datei (App, Version 6, Ort, Knoten bzw. Zufahrtspunkt, gewählte Zufahrt,
   Bezeichnung, alle Eingaben aus E1 bis E3c, Hindernisse, verworfene Vorschläge, Häkchen der Quellen, Quellenstand, Auszug des Ergebnisses). «Fall
   laden» liest sie, prüft jedes Feld (ungültige Werte fallen auf die Vorgabe zurück und werden gemeldet, ungültige Hindernisse
   übergangen, eine fremde Datei wird abgewiesen), lädt den Ort und rechnet neu.
9. **Rechtsvortritt** (E3c): in Schritt 2 «Vortritt und Zufahrt» die Regelung «Rechtsvortritt» wählen. Dann erscheinen die
   **Wahrnehmbarkeit des Knotens** (sehr gut, gut, schlecht, sehr schlecht; Vorgabe «gut» als Annahme, darunter die Merkmale der
   Ziffer 18 als Stichworte im Info-Zeichen) und das Häkchen **«alle Arme prüfen»**; das Tempo ist fest 30 km/h (keine Eingabe). Oben
   im Ergebnis ein kurzer Block: «Die Zufahrt muss den Vortritt lassen: <Arm rechts>, von rechts.», «Verkehr von links (…) muss
   dieser Zufahrt den Vortritt lassen: nicht geprüft.» bzw. bei einem Arm gegenüber «Gegenverkehr aus …: kein Vortrittsverhältnis
   beim Geradeausfahren (Linksabbiegen nicht geprüft).» und der Zustand nach Abb. 6 mit Wahrnehmbarkeit und Sichtweite (bzw. «Von rechts kommen
   keine Autos (Einbahn vom Knoten weg), nur Velos: geprüft nach Tab. 3.»); Tempo und B 5,00 m, Fahrbahnbreiten, bei schmaler
   Zufahrt (b ≤ 3,50 m) das Sichtfeld nach Abb. 5 (Anteil freier Sichtlinien, erste verdeckte Kombination) und die Begründungen im
   Info-Zeichen, «Sichtfeld nach Abb. 5 nicht frei» sichtbar. Status: erfüllt = anzustrebender Zustand, bedingt = zulässig, wenn der
   anzustrebende nicht erreichbar ist, nicht erfüllt = zu sanieren bzw. Abb. 5 nicht frei. Mit «alle Arme prüfen» eine Tabelle je
   Arm, ein Klick auf einen Arm wählt ihn als Zufahrt (Regelung, Wahrnehmbarkeit und Häkchen bleiben). Je Richtung: Verkehr von
   rechts Motorfahrzeuge nach Abb. 6 und Velo mit 30 km/h (Tab. 3); Verkehr von links eine graue Statuszeile «nicht geprüft
   (Rechtsvortritt)» ohne Spalten (dieser Verkehr ist vortrittsbelastet), Gegenverkehr «nicht geprüft (kein Vortrittsverhältnis)». Die Massnahmen beginnen
   bei «zu sanieren» bzw. verdecktem Sichtfeld mit «Rechtsvortritt aufheben und Vortritt signalisieren» (Ziffer 16). Karte: der
   gewählte Arm wie bisher (D, Sichtdreieck auf die Fahrstreifenachse des rechten Arms), der rechte Arm hell; bei schmaler Zufahrt
   die Fahrbahnachsen strichpunktiert mit den Punkten alle 2 m und der Fächer der Sichtlinien (frei dünn grau, verdeckt rot, die
   erste verdeckte Kombination dick). Unter «Grundlagen» die Matrix der Abb. 6.
10. **Bericht** (E4a): «Bericht drucken / als PDF» (neben «Fall speichern», frei nach der Rechnung) öffnet die Druckansicht über der
   Karte. Oben «Drucken / als PDF speichern» (frei, sobald das Luftbild geladen ist; nach 20 s ohne Antwort ohne Hintergrund, mit
   «erneut versuchen») und «Zurück zur Karte» (bzw. Escape). Im Feld «Bezeichnung» einen Namen für den Fall eingeben (Adresse,
   Projekt): er steht im Kopf des Berichts, im Dateinamen des PDF und in der Fall-Datei. Seite 1: Kopf (Ort, Koordinaten LV95 und
   WGS84, Knoten bzw. Zufahrtspunkt, Zufahrt, Vortrittsregelung, Strassentyp, B und D) und Kartenbild mit Massstab und Nordpfeil; ab
   Seite 2 Ergebnis je Richtung (Motorfahrzeuge mit Tempo, Neigung, A nach Strassentyp, Anhaltesichtweite, A massgebend, A vorhanden,
   Status; Velo; Trottoir; Gesamtstatus; beim Rechtsvortritt der Block Teil E), Verdecker, Massnahmen mit Spiegel-Häkchen, Eingaben
   von Hand, Annahmen, Hinweise, Quellen mit Abrufdatum und Flugjahr des Luftbilds, Normbezüge, Version und Haftungshinweis. Im
   Druckdialog «Als PDF speichern» wählen; Kopf- und Fusszeilen des Browsers entfallen (Rand aus dem Bericht).

## Stand

Beta (Stand nach E4a, Bericht und Hilfe). Gerechnet wird die Norm (VSS 40 273:2024, VSS 40 090b); einzige Praxisregel ist der
Zwischenwert bei Hauptverkehrsstrassen (Mittel des Bereichs, so rechnet der Kanton Zug). Alle Annahmen stehen im Panel unter
«Annahmen» und im Bericht. Im Code und in den Texten nur Ziffern, Tabellen und Zahlenwerte, kein Normtext.

### Was gerechnet wird

- **Knoten und Arme** (`rechner/knoten.ts`): OSM-Knoten mit drei und mehr Strassenarmen (ohne `service`, ohne Fahrverbot).
  Vortrittsstrasse: die beiden Arme desselben OSM-Wegs, sonst gleicher Name, sonst höhere `highway`-Klasse. Bei einer
  Einmündung schlägt die App die Zufahrt vor.
- **Vortrittsregelung** (`rechnen.ts`): Vortritt, Stop, Rechtsvortritt; Vorgabe aus OSM `highway=stop` an der Zufahrt, sonst
  Vortritt (Annahme). Stop: B 3,00 m auch ausserorts (Ziffer 12).
- **Erforderliche Sichtweite** (`rechner/sichtweite.ts`, Tab. 1): Tempo auf die Stufe aufgerundet (über 80 km/h wie 80, Hinweis).
  Erschliessungs-, Sammel- und Verbindungsstrassen der untere Wert, Hauptverkehrsstrassen der Zwischenwert (aufgerundet),
  mit ungünstigen Verhältnissen (mehr als zwei Fahrstreifen, |i| über 4 %, Schwerverkehr; Ziffer 13.1) der obere Wert. Vorgaben
  aus OSM `highway` und `lanes`. Massgebend = max(Wert nach Strassentyp, Anhaltesichtweite), die Anhaltesichtweite nur bei |i|
  über 2 %. Status: erfüllt (≥ oberer und ≥ massgebender Wert), massgebender Wert erfüllt, nicht erfüllt.
- **Anhaltesichtweite** (`rechner/anhaltesicht.ts`, VSS 40 090b Abb. 2): aus dem Diagramm abgelesen (±2 m), VP 30 bis 80 km/h,
  i −12 bis +12 %, linear dazwischen; jede Kurve so verschoben, dass sie bei 0 % den unteren Wert der Tab. 1 trifft (aus Abb. 2 zählt
  nur die Wirkung der Neigung). Kurven 70 und 80 km/h an den Rändern verlängert (unsicher).
- **Tempo** (`rechner/tempo.ts`): OSM `maxspeed`, sonst `zone:maxspeed` bzw. `maxspeed:type`, Mehrheit entlang der Achse; ohne
  Angabe 50 km/h (Annahme). Von Hand je Richtung mit Art (signalisiert, VP, V85, fahrbar; Ziffer 10) und Begründung.
- **Längsneigung** (`daten/hoehen.ts`, `rechner/neigung.ts`): je Richtung ein Profil entlang der Fahrstreifenachse ab K bis
  max(20 m, A), dazu Zufahrt und Trottoir, über `api3.geo.admin.ch/rest/services/profile.json` (swissALTI3D, 20 Punkte);
  Ausgleichsgerade mit Ausreisser-Regel, in Fahrtrichtung zum Knoten (bergab negativ), auf 0,1 %. Von Hand überschreibbar.
- **Achsen** (`rechner/hauptachsen.ts`, `fahrstreifen.ts`): Mittellinie je Arm entlang des OSM-Netzes, Querschnitt aus der
  AV-Fahrbahn; Fahrstreifenachse d = 1,50 m vom rechten Rand, nach links nahe, nach rechts ferne Fahrbahnhälfte. Parkstreifen aus
  zählenden Auto-Parkfeldern bzw. Längsparkierung (mindestens 2 Treffer an 2 Feldern bzw. 4 an einem): Achse 1,90 m weiter innen.
  Radstreifen: Autoachse 1,50 m neben dem Streifen. K = Schnitt mit der Achse des Zufahrtsstreifens.
- **B und D** (`rechner/beobachtung.ts`): B 3,00 m innerorts, 5,00 m ausserorts (Ziffer 12) ab dem Nullpunkt: Vorderkante der
  Haltelinie (Ziffer 5), sonst Trottoirhinterkante (mit «Trottoir ohne Hindernisse» die Bordkante, Ziffer 13.1), sonst bei einem
  Radweg näher als 2,00 m seine Aussenkante (Ziffer 12), sonst die Kante des Fahrstreifens mit Vortritt. D am Fahrersitz 0,5 m
  links der Achse (Annahme) bzw. von Hand.
- **Sicht** (`rechner/sicht.ts`): Zielpunkte je 1 m ab K entlang der Achse bis 1,5 × oberer bzw. massgebender Wert, Sichtlinie D–Ziel
  gegen Gebäude der AV und Hindernisse; vorhanden = grösstes s, bis zu dem alle Punkte sichtbar sind (auf 1 mm). Bäume als
  Palisade (zählt ab 5 m zusammenhängend verdeckter Strecke innerhalb von A).
- **Hindernisse** (`rechner/hindernisse.ts`, `vorschlaege.ts`, `daten/parkkataster.ts`, `baumkataster.ts`): Parkfeld Auto und
  Längsparkierung verdecken (gilt als belegt), Velo und Motorrad nur Hinweis; Hecke, Mauer, übriges, wenn «sichtbehindernd»; Zaun
  dicht verdeckt, sichtdurchlässig nur Hinweis. Amtliche Parkfelder Stadt Bern zählen sofort, OSM-Parkierung und Baumkataster als
  Vorschlag (zählen nach «bestätigen»).
- **Grundstückzufahrt** (`rechner/grundstueck.ts`): Zufahrtspunkt am Fahrbahnrand, Richtung senkrecht zur Achse der
  Vortrittsstrasse, gezeichnet bzw. entlang eines OSM-Wegs `service`; danach wie ein Arm gerechnet. Kein Rechtsvortritt.
- **Velo** (`rechner/velo.ts`, Ziffer 13.3, Tab. 3): Veloführung je Richtung aus OSM (Mischverkehr 0,50 m vom Rand, Radstreifen in der
  Mitte, 1,50 m breit angenommen, Radweg auf seiner Achse) bzw. von Hand; Tab. 3 nach zulässiger Höchstgeschwindigkeit und Neigung,
  schnelle E-Bikes verboten (über 30 km/h). Status erfüllt bzw. nicht erfüllt.
- **Velo gegen die Einbahn** (E4, `netz.ts` `veloGegenTag`, Arm-Felder `veloZufluss`, `veloZuflussQuelle`): Einbahn vom Knoten weg
  mit `oneway:bicycle=no`, `cycleway`, `cycleway:left`, `cycleway:right` = `opposite`, `opposite_lane`, `opposite_track` bzw.
  `cycleway:*:oneway` gegen die Einbahn. Die Velos fahren auf der für sie rechten Seite (aus Sicht des Autoverkehrs der linken).
  Hauptarm: Motorfahrzeuge «keine Zufahrt», Velo nach Tab. 3 auf dieser Seite (Mischverkehr 0,50 m vom Rand, Gegenverkehrsstreifen in
  seiner Mitte), Profil der Neigung auf der Veloachse, Gesamtstatus aus Velo und Trottoir, Massnahmen mit dieser Richtung. Zufahrt: D
  auf der Achse des Velogegenverkehrs (ohne Fahrersitz-Versatz), B wie sonst, F<sub>B</sub> als Velo. Rechtsvortritt: ist die Zufahrt
  eine solche Einbahn, gewähren die Velos dem Arm rechts den Vortritt (Teil E von D auf der Veloachse, bei schmaler Zufahrt Abb. 5 mit
  den Punkten auf der Veloachse); ist der Arm rechts eine solche Einbahn, kommen von rechts nur Velos: keine Prüfung nach Abb. 6, das
  Velo von rechts nach Tab. 3 mit 30 km/h, nicht nach Abb. 6 (Entscheid vom 17.10.2026; Block Rechtsvortritt «nur Velos von rechts»).
- **Trottoir** (Ziffer 13.2, Tab. 2): nur mit Trottoir an der Zufahrt nach AV; D' 3,00 m hinter der Trottoirhinterkante, Zielpunkte auf
  der Trottoirachse, Neigung in Gehrichtung zur Zufahrt.
- **Gesamtstatus** je Richtung: schlechtester von Motorfahrzeugen, Velo und Trottoir, mit den fehlenden Teilen.
- **Rechtsvortritt** (`rechner/rechtsvortritt.ts`, Teil E, Ziffern 15 bis 18): alle Arme vortrittsbelastet, geprüft der Arm rechts der
  Zufahrt (mehr als 25° rechts der Fahrt), Tempo 30 km/h, B 5,00 m (Abb. 4); Zustand nach Abb. 6 aus Wahrnehmbarkeit (Eingabe,
  Vorgabe «gut») und Sichtweite (Spalten unter 15, 15 bis 20, 20 bis 25, ab 25 m). Schmale Zufahrt (b ≤ 3,50 m): Sichtlinien zwischen
  Punkten alle 2 m auf beiden Achsen, Paare mit zusammen höchstens 20 m (Auslegung der Abb. 5). Von links bzw. gegenüber keine Prüfung. Auf Wunsch
  alle Arme gegen ihren rechten Nachbarn.
- **Massnahmen** (`rechner/massnahmen.ts`, Ziffer 14): nur wenn eine Richtung (Auto oder Velo) nicht erfüllt ist, als Varianten der
  Rechnung: Hindernis entfernen, Haltelinie vorverlegen (bis D 1,50 m), Stop, Rechtsabbiegegebot (bei einem Arm gegenüber nicht anwendbar, dafür Vermerk Linksabbiegeverbot), Tempo senken, Lichtsignalanlage,
  Spiegel (Bedingungen zum Abhaken), Aufhebung der Ausfahrt; beim Rechtsvortritt zuerst «aufheben» (Ziffer 16) und Wahrnehmbarkeit.
- **Fall-Datei** (`fall.ts`, Version 6): Ort, Knoten bzw. Zufahrtspunkt, Zufahrt, Bezeichnung (E4a, höchstens 200 Zeichen), alle
  Eingaben, Hindernisse, verworfene Vorschläge, Häkchen der Quellen, Spiegel-Bedingungen, Quellenstand, beim Speichern ein Auszug
  des Ergebnisses. Prüfung je Feld (ungültig: Vorgabe bzw. übergangen, gemeldet); Versionen 1 bis 5 werden gelesen. Im Browser je
  Knoten (`SichtweitenCheck.fall.<Knoten>`) bzw. Zufahrtspunkt (`SichtweitenCheck.fall.z<E>,<N>`), nur mit Eingaben.
- **Bericht** (`Bericht.tsx`, `berichtbild.ts`, E4a): Druckansicht als Portal über der App, A4 hoch; Kartenbild als ein WMS-Luftbild
  in LV95 mit SVG darüber (Ausschnitt aus Sichtdreiecken, Verdeckern, D, Haltelinie und Fahrzeugen mit 5 m Rand, Höhe/Breite 0,55
  bis 0,7; 1200 bis 1400 px breit). «Drucken» erst mit geladenem Bild bzw. nach 20 s ohne (Hinweis «ohne Luftbild», «erneut
  versuchen»). Inhalt: Kopf, Kartenbild, Ergebnis je Richtung (bzw. Teil E), Verdecker, Massnahmen, Eingaben von Hand, Annahmen,
  Hinweise, Quellen mit Abrufdatum, Normbezüge, Version, Haftungshinweis. Status zusätzlich als Zeichen (✓, (✓), ✗, –) und im Bild
  als Strichart.

### Trottoirüberfahrt und amtliches Tempo (0.6.0, Etappe K0)

Häkchen «Trottoirüberfahrt» (Block «Zufahrt», je Zufahrt; Fall-Datei Version 7, Feld `eingaben.trottoirueberfahrt` mit `breite`):
kein Rechtsvortritt (VSS 40 242 Ziffer 12.3; Vorgabe Vortritt bzw. Stop aus OSM, «Rechtsvortritt» wird wie Vortritt gerechnet) und die
Sicht in zwei Phasen nach Ziffer 14.4 mit den Werten der VSS 40 273: Phase Fahrbahn mit B ab der Bordkante (vorderer Rand der
Überfahrt; Haltelinie und Radweg nach Ziffer 12 gehen vor), Motorfahrzeuge Tab. 1, Velo Tab. 3; Phase Trottoir mit D' 3,00 m hinter dem
hinteren Rand der Überfahrt und Zielpunkten auf der Gehlinie 0,50 m vor dem hinteren Trottoirrand, Tab. 2 nach der Längsneigung (Profil
entlang der Gehlinie). Breite der Überfahrt in dieser Reihenfolge (Ziffer 16): Eingabe von Hand, AV-Fläche Trottoir quer über die
Zufahrt, das schmalere angrenzende AV-Trottoir links bzw. rechts, begrenzt auf 2,00 bis 3,50 m (an vielen Einmündungen ist die Zufahrt in
der AV durchgehend Strasse, der Planungsfall), sonst 2,00 m als Annahme. Hinterer Rand der Überfahrt beidseits gleich weit hinter dem
Fahrbahnrand, auf der Zufahrtsachse Länge = Breite / sin α; die Gehlinie je Seite vor dem eigenen hinteren Trottoirrand (AV-Trottoir der
Seite, sonst Fahrbahnrand plus Breite). Kurze Hinweise nur, wenn sie zutreffen: ausserorts (Ziffer 14.1), Zufahrt auf der durchgehenden
Strasse (14.2), Tempo über 50 km/h (14.3.1), Winkel unter 45° bzw. über 135° (14.3.4), Velos auf dem Trottoir nach OSM (15.4.2). Ergebnis je Phase (Status, nicht erfüllte Teile) im Panel, auf der Karte (Band von der
Bordkante zum hinteren Rand, Sichtdreiecke von D und D') und im Bericht. Die Gehlinie gilt nur in diesem Modus; Knoten und
Grundstückzufahrten ohne Häkchen rechnen wie 0.5.0 (Trottoirachse, Nullpunkt an der Trottoirhinterkante). In der Stadt Bern (AV-Gemeinde
unter dem Knoten bzw. Zufahrtspunkt, BFS 351) holt die App die signalisierte Höchstgeschwindigkeit des Geoportals (map.bern.ch, Layer
`Signalisierte_Hoechstgeschwindigkeit`, Feld V_sig, ±150 m; Quellenangabe «Geodaten Stadt Bern») und rechnet je Richtung mit der Mehrheit
entlang des Arms (nächste Linie bis 8 m, längs, höchstens 35° Abweichung; Punkte bis 8 m vom Knoten und ausserhalb des geladenen
Bereichs zählen nicht; liegen nicht mehr Punkte an einer Linie mit Wert als an einer ohne Wert bzw. keine Linie, gilt OSM); Herkunft «Geoportal Stadt Bern» beim Tempo, Hinweis bei Abweichung von OSM; Tempo von Hand geht vor, ausserhalb Berns
und bei einem Fehler des Dienstes OSM. Schnittstelle des Kerns (für die Kopie in fgsCheck) im Kopf von `rechner/rechnen.ts`; Band und
Gehlinie in `rechner/trottoirueberfahrt.ts`, Zuordnung des Tempos in `rechner/tempo.ts`, Abruf in `daten/vsig.ts`; Tests
`rechner/trottoirueberfahrt.test.ts` und `rechner/tempoamtlich.test.ts`. Grenzen: Velos auf dem Trottoir (Ziffer 15.4.2) nur als Hinweis,
Trottoir nicht in den Massnahmen; Vortrittsvorgabe und «ausserorts» weiter nach OSM.

### Versionen

- 0.6.0 (23.10.2026): Trottoirüberfahrt (VSS 40 242 Ziffern 12.3, 14.4) und amtliches Tempo der Stadt Bern (V_sig), Fall-Datei Version 7.
- 0.5.0: Beta, Stand nach E4a (Bericht und Hilfe).

### Prüffälle

Daten vom 16.10.2026, amtliche Parkfelder an. Hallerstrasse / Alpeneggstrasse (`?knoten=30949365`, Tempo 30): links 27,5 m, rechts
24,5 m (A 20 m), massgebend erfüllt; Velo links 22,6 m < 25 m nicht erfüllt; mit Rechtsvortritt gegen die Hallerstrasse 19,6 m: gut zu
sanieren, sehr gut zulässig. Brückfeldstrasse / Fischerweg (`?knoten=32865596`): links 13,3 m nicht erfüllt (Parkfeld Nr. 1639),
Massnahme «ohne Parkfeld» reicht. Lerberstrasse / Aargauerstalden (`?knoten=306255273`, 50 km/h, −7,3 / +7,2 %): A 70 m (oberer Wert
wegen grosser Neigung), erfüllt. Seidenweg / Länggassstrasse (`?knoten=1022048`, Radstreifen): Auto links 78,0 m, Velo 53,7 m ≥ 50 m.
Grundstückzufahrt Hallerstrasse (`?zufahrt=2599903.4,1200347.2`, Trottoir 2,0 m): links 7,5 m nicht erfüllt, rechts 47,1 m; Trottoir
erfüllt. Prüfrunden je Etappe (Sonnet, Code-Lektüre, eigene Fälle): Abb. 2 nachgemessen, Abb. 6 in allen 16 Feldern bestätigt.

## Grenzen

- Amtliche Vermessung frei über geodienste.ch: 19 Kantone ganz, Wallis teilweise, Liechtenstein; LU, VD, NE, NW, OW und JU nur mit
  Freigabe: dort rechnet die App nicht. AV höchstens ±400 m.
- Rechnung in der Ebene: Höhenbereich 0,60 bis 3,00 m und Höhe der Hindernisse nicht geprüft (vor Ort).
- Längsneigung als mittlere Neigung (Kuppen und Wannen nicht), aus dem Geländemodell: auf Brücken und in Unterführungen falsch (von
  Hand eingeben); das Profil wird zu A der ersten Rechnung geholt.
- Trottoir nur erkannt, wenn es höchstens 1,5 m hinter der Kante beginnt (Radweg oder Grünstreifen dazwischen: keine Prüfung); D'
  fest 3,00 m hinter der Hinterkante; Trottoir nicht in den Massnahmen.
- Rechtsvortritt: Wahrnehmbarkeit nur als Eingabe, Abb. 6 ohne Längsneigung, Abb. 5 in der Auslegung «Summe höchstens 20 m», bei
  mehreren Armen rechts nur der nächste, Linksabbieger gegen den Gegenverkehr nicht geprüft, Tabelle «alle Arme» ohne Velo und Trottoir.
- Keine Kreisel, keine Lichtsignalanlagen (nur als Massnahme vermerkt), Kurven nur als Hinweis; Radstreifen- und Radwegbreite
  angenommen. Velo gegen die Einbahn nur aus OSM-Tags; auf der Zufahrt ohne Wahl der Veloführung.
- Massnahmen ohne Kombinationen; beim Entfernen eines Parkfelds bleibt die Achse. Grundstückzufahrt einspurig in der Mitte.
- Amtliche Parkfelder nur Stadt Bern und nur öffentliche Felder; Parkstreifen nur aus Parkfeldern.
- Die App ersetzt keine Beurteilung vor Ort.

## Aufbau

Unterbau als Kopie aus fgsCheck (`~/Documents/fgsCheck/fgsCheckWeb`), nicht verlinkt: `geo.ts`, `rechner/poly.ts`,
`flaechen.ts`, `netz.ts`, `achsen.ts`, `fahrstreifen.ts`, `spur.ts`, `hindernisse.ts`, `tempo.ts` (gekürzt), `daten/*`,
`ausschnitt.ts`, `Ortssuche.tsx`, `Einstieg.tsx`, `Startseite.tsx`, `Hilfe.tsx`, `index.css`. `Karte.tsx` und `App.tsx` sind auf
den Knoten umgebaut. Neu: `rechner/typen.ts`, `sichtweite.ts`, `knoten.ts`, `beobachtung.ts`, `hauptachsen.ts`, `sicht.ts`,
`rechnen.ts`, `fahrzeug.ts` (Fahrzeug-Umrisse für die Karte), `anhaltesicht.ts` (E1). E2a aus fgsCheck: `rechner/vorschlaege.ts`
(angepasst), Werkzeuge in `Karte.tsx` und der Abschnitt «Hindernisse» in `App.tsx`, `fall.ts` (Hindernisse, localStorage). E2b:
`rechner/grundstueck.ts` (Grundstückzufahrt), Abschnitt «Knoten und Zufahrt» und Fall-Datei in `App.tsx` (Knöpfe wie fgsCheck),
`fall.ts` Version 2 (alle Eingaben, Prüfung je Feld). E3a: `daten/hoehen.ts` (Höhenprofil), `rechner/neigung.ts` (Ausgleichsgerade),
`rechner/massnahmen.ts` (Ziffer 14), Abschnitt «Massnahmen» in `App.tsx`, `fall.ts` Version 3. E3b: `rechner/velo.ts` (Tab. 2 und 3,
Veloführung, Radwege aus OSM, Trottoirachse), Velo und Trottoir in `rechnen.ts`, Velosymbol in `fahrzeug.ts`, Abschnitt «Veloverkehr»
und Ergebniszeilen in `App.tsx`, Darstellung in `Karte.tsx`, `fall.ts` Version 4. E3c: `rechner/rechtsvortritt.ts` (Abb. 6,
rechter Arm, Paarmatrix nach Abb. 5), Rechtsvortritt in `rechnen.ts` und `massnahmen.ts`, Block «Rechtsvortritt» in `App.tsx`, Fächer
in `Karte.tsx`, `fall.ts` Version 5. E4a: `Bericht.tsx` (Druckansicht), `berichtbild.ts` (Ausschnitt,
Bildgrösse, LV95 -> SVG, Massstab), `texte.ts` (Textbausteine zum Status, aus `App.tsx`), Hilfe und Datenschutz in `Hilfe.tsx`,
Druckregeln in `index.css`, `fall.ts` Version 6. E4 Velo gegen die Einbahn: `veloGegenTag` und `veloZufluss` in `rechner/netz.ts`,
`veloVorgabe` mit Gegenverkehr in `rechner/velo.ts`, Richtung «nur Velos» und D auf der Veloachse in `rechnen.ts`, `fbVeloLage` in
`fahrzeug.ts`. Panel: `Info.tsx` (Info-Zeichen mit Sprechblase für die Erklärungen), Ergebnis je Richtung mit Statusfeldern und
den Teilen nebeneinander in `App.tsx`. Lage je Richtung (links, rechts, gegenüber) und ihre Wörter in `rechner/lage.ts`.

Tests: `rechner/sichtweite.test.ts` (Tab. 1, Strassentyp, ungünstige Verhältnisse, Neigung), `rechner/anhaltesicht.test.ts`
(Abb. 2: Kontrolle bei i = 0, Nachmessung der Prüfrunde, Interpolation, Rand, Monotonie), `rechner/sicht.test.ts` (rechtwinkliger Knoten, Handlösung nach Strahlensatz; E2a: Parkfeld in der Ecke, Längsparkierung,
Baumreihe, Alleebäume, Baum nahe D, Hecke ohne Wirkung, Zweirad und Zaun als Hinweis, Schatten der Stämme nach Formel),
`rechner/vorschlaege.test.ts` (OSM-Parkierung, amtliche Felder zählen und verwerfen, Überdeckung 30 %, Baumkataster, D im
Hindernis), `fall.test.ts` (Hindernisse hin und zurück, Prüfung, localStorage),
`rechner/knoten.test.ts` (Arme, Vortrittsstrasse, Zufahrt, Nummern im Uhrzeigersinn ab Norden, Anzeigename), `rechner/rechnen.test.ts` (Gesamtrechnung T-Knoten: Seiten, D, B,
K, Status; E1 Hauptverkehrsstrasse, Neigung, AV-Bedarf und Nachladen), `rechner/knoteneingaben.test.ts` (E2b: Stop und Vorgabe aus
OSM, Rechtsvortritt, Haltelinie mit Lot und Strahlensatz, vorverlegt, D von Hand und F<sub>B</sub>, Trottoirüberfahrt mit und ohne
Häkchen, Tempo von Hand, Grundstückzufahrt gegen den Arm, gezeichnete Richtung, OSM-Weg `service`, Meldungen), `fall.test.ts`
(E2b: alle Eingaben hin und zurück, ungültige Werte auf die Vorgabe, fremde Datei, Zufahrtspunkt im localStorage),
`rechner/neigung.test.ts` (E3a: 6 % mit Ausreisser, Vorzeichen je Richtung, Dienst-Fehler, Abruf mit Attrappe, Wirkung in der
Rechnung, Fall-Datei Version 2 und 3), `rechner/massnahmen.test.ts` (E3a: T-Knoten mit Parkfeld, Handlösung nach Strahlensatz für
Haltelinie, Tempo, Rechtsabbiegegebot, Spiegel, Stop ausserorts, Grundstückzufahrt; ohne Veloverkehr gerechnet),
`rechner/velo.test.ts` (E3b: Tab. 3 mit E-Bike-Variante, Tab. 2, Veloführung aus OSM, Veloachse bei Mischverkehr und Radstreifen
mit Handlösung nach Strahlensatz, Radweg mit B ab der Aussenkante, Trottoir am T-Knoten mit Hecke, Neigung des Trottoirs,
Gesamtstatus, Massnahmen mit Velo, Velosymbol, Fall-Datei Version 4), `rechner/rechtsvortritt.test.ts` (E3c: Abb. 6 mit allen 16
Feldern und Zwischenwerten, rechter Arm an Kreuzung, schiefen Knoten und T-Einmündung, T-Knoten mit Gebäudeecke nach Strahlensatz
je Wahrnehmbarkeit, alle Arme einer Kreuzung, Paarmatrix an einer schmalen Zufahrt 3,0 m mit Hauswand, Handlösung), dazu die
übernommenen Tests des Unterbaus. E4a: `berichtbild.test.ts` (Ausschnitt flach, hoch und Mindestgrösse, alle Dreiecke,
Verdecker und Fahrzeuge eines Ergebnisses im Bild, Bildgrösse, Verschiebung und Skalierung nach SVG, Massstab, Textbausteine je
Status), `fall.test.ts` (Version 6 mit Bezeichnung, Version 5 lesbar). E4: `rechner/velogegen.test.ts` (Tags des Velos gegen die
Einbahn, Veloführung, Hauptarm «nur Velos» mit Seite der Veloachse und Handlösung nach Strahlensatz, Massnahmen, Zufahrt mit D auf der
Veloachse, Einbahn ohne Velotags unverändert; Rechtsvortritt mit Velo gegen die Einbahn auf der Zufahrt bzw. auf dem Arm rechts), `rechner/lage.test.ts` (Zufahrt auf der durchgehenden Strasse: Gegenverkehr, Hinweis, Rechtsvortritt, «kein Arm»; T-Knoten
und Grundstückzufahrt links/rechts).

## Datenschutz und Quellen

Keine Anmeldung, kein eigener Server; gerechnet wird im Browser (Web Worker). Nicht gesendet werden Eingaben, Bezeichnung, Zahlen
und Status; die Dienste erhalten nur Koordinaten bzw. Ausschnitte (Tabelle). Im
Browser (localStorage) liegt je Knoten bzw. Grundstückzufahrt mit Eingaben ein Eintrag `SichtweitenCheck.fall.<Knoten>` bzw.
`SichtweitenCheck.fall.z<E>,<N>` (Eingaben, Hindernisse, Häkchen, Bezeichnung, Koordinaten); ohne Eingaben wird nichts gespeichert und
ein vorhandener Eintrag entfernt (`fallMerken` in `src/fall.ts`). Alle Einträge löscht man über die Website-Daten der Seite im
Browser. Der Browser fragt direkt an (die Dienste sehen technisch die IP-Adresse und Browserangaben):

| Dienst | Inhalt der Anfrage |
|---|---|
| wmts.geo.admin.ch (swisstopo) | Kartenkacheln (Luftbild bzw. Landeskarte) des sichtbaren Ausschnitts |
| wms.geo.admin.ch (swisstopo) | Kartenbild des Berichts (Ausschnitt um Sichtdreiecke und Fahrzeuge), nur beim Öffnen des Berichts |
| api3.geo.admin.ch (swisstopo) | Ortssuche: der eingegebene Suchbegriff; Flugjahr der 1-km-Kachel (Bericht); Höhenprofile: bis vier Linien je Fall (Fahrstreifenachsen, Zufahrt, Trottoir) |
| geodienste.ch (AV-WFS) | Rechteck ±150 m um den Knoten bzw. Zufahrtspunkt, nach Bedarf bis ±400 m |
| Overpass: overpass.osm.ch, ersatzweise overpass-api.de, overpass.kumi.systems, overpass.private.coffee | Kartenausschnitt (Knoten und Strassennamen) mit Rand bzw. Umkreis 300 m um den Knoten |
| map.bern.ch (nur Stadt Bern) | Rechteck ±150 m (amtliche Parkfelder, auf Wunsch Baumkataster; signalisierte Höchstgeschwindigkeit) |

Der eigene Standort wird nur im Browser ermittelt und angezeigt, nicht gespeichert und nicht gesendet. Eine Nutzungsstatistik mit
GoatCounter (sichtweiten.goatcounter.com; nur Seitenaufrufe und der Aufruf der Prüfung als Pfad «pruefen», ohne Cookies und ohne Speicherung der IP-Adresse).

- Luftbild SWISSIMAGE und Landeskarte: © swisstopo (WMTS für die Karte, WMS für das Kartenbild des Berichts, mit Flugjahr)
- Längsneigung: Höhenmodell swissALTI3D © swisstopo (Profil-Dienst api3.geo.admin.ch)
- Bodenbedeckung: Amtliche Vermessung, Kanton (je nach Ort), über geodienste.ch; Panel, Fall-Datei und Bericht nennen den Kanton
- Strassennetz, Tempo, Veloführung: © OpenStreetMap-Mitwirkende, ODbL (Overpass API)
- Parkfelder und Bäume Stadt Bern: Geodaten Stadt Bern (Parkplätze öffentlich, Baumkataster)
- Tempo Stadt Bern: Geodaten Stadt Bern (Signalisierte Höchstgeschwindigkeit, Geoportal)
- Normbezüge: VSS 40 273:2024 (Ziffern 5 und 10 bis 18, Tab. 1 bis 3, Abb. 3 bis 6), VSS 40 090b (Abb. 2), VSS 40 242:2019 (Ziffern 12.3,
  14.1 bis 14.4, 15.4.2, 16); nur Nummern, Ziffern und
  Zahlenwerte, kein Normtext
- Polygon-Operationen: polygon-clipping (MIT)

## Veröffentlichung

Wie bei fgsCheck: `.github/workflows/deploy.yml` baut bei jedem Push auf `main` (`npm ci`, Tests, `npm run build`) und
veröffentlicht `dist/` auf GitHub Pages (Pages-Quelle «GitHub Actions»). Eigene Domain https://sichtweitencheck.ch/ mit Vite
`base: '/'`: DNS bei Hostpoint (A- und AAAA-Einträge auf GitHub Pages, `www` als CNAME), die Custom domain steht in den
Pages-Einstellungen des Repos, keine `CNAME`-Datei nötig. Name, Marke und Adresse stehen in `src/marke.ts`. Nutzungsstatistik
GoatCounter in `index.html` (Site sichtweiten.goatcounter.com, versionierte `count.v4.js` mit Integritäts-Hash). Die Normen
liegen ausserhalb des Repos und kommen nicht hinein.

## Lizenz

Code und eigene Inhalte: **[CC BY-NC 4.0](LICENSE)**. Die eingebundenen Dritt-Daten behalten ihre eigenen Lizenzen.
