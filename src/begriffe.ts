// ── Begriffe (Korrektur 31.10.2026, Punkt 9b; Muster fgsCheck bedarf/begriffe.ts) ──
//
// Je Begriff ein Name und eine eigene Erklärung in Alltagssprache (ein bis zwei Sätze), kein Text aus Normen. muster: Wortformen, an
// denen die Anzeige den Begriff in einem Text erkennt (reguläre Ausdrücke ohne Flags; ganze Wörter, Gross- und Kleinschreibung wie
// angegeben). Das Panel listet alle alphabetisch (Abschnitt «Begriffe») und markiert sie in den Annahmen dezent, der Bericht listet nur
// die im Fall vorkommenden.

export interface Begriff {
  id: string
  /** Name in der Liste */
  name: string
  /** eigene Erklärung, ein bis zwei Sätze */
  text: string
  /** Wortformen (reguläre Ausdrücke, ganze Wörter) */
  muster: readonly string[]
}

export const BEGRIFFE: readonly Begriff[] = [
  { id: 'anhaltesicht', name: 'Anhaltesichtweite', muster: ['Anhaltesichtweiten?'],
    text: 'Strecke, die ein Fahrzeug vom Erkennen eines Hindernisses bis zum Stillstand braucht. Sie wächst mit dem Tempo und bei Gefälle.' },
  { id: 'arm', name: 'Arm', muster: ['Arme?', 'Armen', 'Arms'],
    text: 'Eine Strasse, die vom Knoten wegführt. Die App nummeriert die Arme im Uhrzeigersinn ab Norden.' },
  { id: 'b', name: 'Beobachtungsdistanz B', muster: ['Beobachtungsdistanz'],
    text: 'Wie weit hinter dem Rand der Strasse mit Vortritt das Auge des wartenden Lenkers liegt. Sie hängt von der Ortslage und von der Vortrittsregelung ab.' },
  { id: 'd', name: "Beobachtungspunkt D und D'", muster: ['Beobachtungspunkte?', "D'"],
    text: "Der Punkt, von dem aus die App die Sicht prüft: das Auge des wartenden Lenkers oder Velofahrers. D' ist der Punkt für die Sicht aufs Trottoir, etwas weiter hinten." },
  { id: 'fa', name: 'F_A (Fahrzeug mit Vortritt)', muster: ['F_A'],
    text: 'Ein vortrittsberechtigtes Fahrzeug, das sich dem Knoten nähert. Die App zeigt es dort, wo es gerade noch gesehen werden muss.' },
  { id: 'fb', name: 'F_B (wartendes Fahrzeug)', muster: ['F_B', 'FB'],
    text: 'Das Fahrzeug in der Zufahrt, das warten muss, bevor es einbiegt oder die Strasse überquert. Fahren aus einer Einbahn nur Velos gegen die Einbahn, ist es ein Velo.' },
  { id: 'fahrlinie', name: 'Fahrlinie', muster: ['Fahrlinien?', 'Fahrstreifenachsen?'],
    text: 'Die Linie, auf der die Mitte eines Fahrzeugs oder Velos fährt. Die App misst die Sicht entlang der Fahrlinie der Fahrzeuge mit Vortritt.' },
  { id: 'fahrbahnteilung', name: 'Fahrbahnteilung', muster: ['Fahrbahnteilung(?:en)?'],
    text: 'Stelle, an der sich eine Strasse mit Gegenverkehr in zwei Einbahnen teilt, etwa um eine Insel vor einem Kreisel. Weil sich die Fahrströme dort nicht kreuzen, rechnet die App an solchen Stellen nicht.' },
  { id: 'faeg', name: 'fäG (fahrzeugähnliche Geräte)', muster: ['fäG'],
    text: 'Trottinette, Inlineskates, Kickboards und ähnliche Geräte. Auf dem Trottoir sind sie schneller als Fussgänger.' },
  { id: 'gehlinie', name: 'Gehlinie', muster: ['Gehlinie'],
    text: 'Die Linie, auf der Fussgänger über eine Trottoirüberfahrt gehen. Die App prüft, ob der Lenker Fussgänger auf dieser Linie früh genug sieht.' },
  { id: 'haltelinie', name: 'Halte- und Wartelinie', muster: ['Halte- (?:oder|und) Wartelinie', 'Haltelinie', 'Wartelinie'],
    text: 'Weisse Markierung quer zur Fahrbahn am Ende der Zufahrt: bei «Stop» die durchgezogene Haltelinie, bei «Kein Vortritt» die Wartelinie aus einer Reihe weisser Dreiecke. Ab ihrer Vorderkante misst die App die Beobachtungsdistanz.' },
  { id: 'stop', name: 'Kein Vortritt und Stop', muster: ['Kein Vortritt', 'Stop'],
    text: 'Bei «Kein Vortritt» darf man ohne Anhalten weiterfahren, wenn die Strasse frei ist; bei «Stop» muss man immer anhalten. Stop ist nur dort richtig, wo die Sicht für «Kein Vortritt» nicht reicht.' },
  { id: 'knoten', name: 'Knoten', muster: ['Knoten', 'Knotens'],
    text: 'Stelle, an der sich drei oder mehr Strassen treffen, also eine Kreuzung oder Einmündung. Die App nimmt die Knoten aus OpenStreetMap.' },
  { id: 'a', name: 'Knotensichtweite A', muster: ['Knotensichtweiten?', 'Sichtweite A'],
    text: 'Wie weit der wartende Lenker auf der Strasse mit Vortritt sehen muss, gemessen ab K. Sie hängt vom Tempo, vom Strassentyp und von der Längsneigung ab.' },
  { id: 'k', name: 'Kreuzungspunkt K', muster: ['Kreuzungspunkte?'],
    text: 'Der Punkt, an dem sich die Fahrlinie der Zufahrt und die Fahrlinie der Fahrzeuge mit Vortritt kreuzen. Ab K misst die App die Sichtweite.' },
  { id: 'neigung', name: 'Längsneigung', muster: ['Längsneigung(?:en)?', 'Gefälle', 'Steigung'],
    text: 'Wie steil die Strasse in Fahrtrichtung steigt oder fällt, in Prozent; abwärts ist negativ. Bei Gefälle braucht es mehr Sicht, weil der Bremsweg länger wird.' },
  { id: 'misch', name: 'Mischverkehr', muster: ['Mischverkehr'],
    text: 'Velos fahren ohne eigenen Streifen auf der Fahrbahn zusammen mit den Autos.' },
  { id: 'palisade', name: 'Palisadenwirkung', muster: ['Palisade(?:nwirkung)?'],
    text: 'Mehrere Bäume oder Pfosten nebeneinander verdecken zusammen die Sicht wie ein Zaun, obwohl jeder einzelne schmal ist.' },
  { id: 'rv', name: 'Rechtsvortritt', muster: ['Rechtsvortritts?'],
    text: 'Ohne Signal hat der Verkehr von rechts Vortritt. Jede Zufahrt muss dann dem Arm rechts von ihr den Vortritt lassen.' },
  { id: 'sichtfeld', name: 'Sichtfeld und Sichtdreieck', muster: ['Sichtfeld(?:er|s)?', 'Sichtdreiecke?'],
    text: 'Die Fläche zwischen dem Auge des wartenden Lenkers und der Fahrlinie mit Vortritt bis zur nötigen Sichtweite. Darin darf nichts die Sicht verdecken.' },
  { id: 'sichtlinie', name: 'Sichtlinie', muster: ['Sichtlinien?'],
    text: 'Gerade Linie vom Auge des wartenden Lenkers zu einem Punkt auf der Fahrlinie mit Vortritt. Ist sie frei, sieht er ein Fahrzeug an diesem Punkt.' },
  { id: 'strassentyp', name: 'Strassentyp (Hauptverkehrs- oder Erschliessungsstrasse)', muster: ['Strassentyp', 'Hauptverkehrsstrassen?',
    'Erschliessungsstrassen?'],
    text: 'Hauptverkehrsstrassen tragen den Durchgangsverkehr, Erschliessungsstrassen führen zu Wohnungen und Betrieben. An Hauptverkehrsstrassen verlangt die App mehr Sicht.' },
  { id: 'tue', name: 'Trottoirüberfahrt', muster: ['Trottoirüberfahrt(?:en)?'],
    text: 'Das Trottoir läuft auf gleicher Höhe über die Einmündung weiter. Wer aus der Zufahrt kommt, fährt über das Trottoir und hat keinen Vortritt.' },
  { id: 'ueberholfall', name: 'Überholfall', muster: ['Überholfalls?'],
    text: 'Ausserorts kann ein überholendes Fahrzeug auf dem Gegenfahrstreifen auf den Knoten zukommen. Die App prüft dann auch die Sicht auf diesen Streifen.' },
  { id: 'ungunst', name: 'Ungünstige Verhältnisse', muster: ['[Uu]ngünstige[nr]? Verhältnisse'],
    text: 'Umstände, die mehr Sicht verlangen: mehrere Fahrstreifen je Richtung, starkes Gefälle oder viele Lastwagen. An Hauptverkehrsstrassen gilt dann der obere Wert.' },
  { id: 'v85', name: 'V85', muster: ['V85'],
    text: 'Das Tempo, unter dem 85 von 100 gemessenen Fahrzeugen bleiben. Es zeigt, wie schnell an einer Stelle tatsächlich gefahren wird.' },
  { id: 'velogegen', name: 'Velo gegen die Einbahn', muster: ['Velos? gegen die Einbahn', 'Velogegenverkehrs?'],
    text: 'In manchen Einbahnstrassen dürfen Velos auch in der Gegenrichtung fahren, wenn es signalisiert ist. Die App liest das aus den Angaben in OpenStreetMap.' },
  { id: 'vortrittsstrasse', name: 'Vortrittsstrasse', muster: ['Vortrittsstrassen?'],
    text: 'Die Strasse, deren Verkehr Vortritt hat; wer aus der Zufahrt kommt, muss ihn abwarten.' },
  { id: 'wahrnehmbarkeit', name: 'Wahrnehmbarkeit', muster: ['Wahrnehmbarkeit'],
    text: 'Wie gut ein Knoten mit Rechtsvortritt als solcher erkennbar ist, etwa an Gestaltung und Übersicht. Je schlechter er erkennbar ist, desto mehr Sicht braucht es.' },
  { id: 'zusammenfuehrung', name: 'Zusammenführung', muster: ['Zusammenführung(?:en)?'],
    text: 'Stelle, an der zwei Einbahnen spitz zusammenlaufen und der Verkehr einfädelt, etwa eine Autobahnauffahrt. Solche Stellen rechnet die App vorerst nicht.' },
  { id: 'zufahrt', name: 'Zufahrt', muster: ['Zufahrt(?:en)?'],
    text: 'Der Arm, aus dem ein Fahrzeug in den Knoten fährt und dabei den Vortritt gewähren muss. Von dort prüft die App die Sicht.' },
  { id: 'av', name: 'Amtliche Vermessung (AV)', muster: ['[Aa]mtliche[nr]? Vermessung', 'AV'],
    text: 'Die amtlichen Pläne mit Grundstücken, Gebäuden, Fahrbahnen und Trottoirs. Die App holt sie bei geodienste.ch.' },
  { id: 'osm', name: 'OpenStreetMap (OSM)', muster: ['OpenStreetMap', 'OSM'],
    text: 'Frei bearbeitbare Karte, an der Freiwillige mitarbeiten. Die App nimmt daraus Strassen, Tempo, Signale und Velowege.' },
  { id: 'swissalti3d', name: 'swissALTI3D', muster: ['swissALTI3D'],
    text: 'Höhenmodell der ganzen Schweiz von swisstopo. Die App misst daraus die Längsneigung der Strassen.' },
]

/** alphabetisch nach Name (Umlaute wie Grundbuchstaben, Gross- und Kleinschreibung gleich) */
export const begriffeAlphabetisch = (): Begriff[] =>
  [...BEGRIFFE].sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))

/** Muster eines Begriffs als ein regulärer Ausdruck (ganze Wörter; Buchstaben und Ziffern zählen als Wortteil) */
export const begriffRegex = (b: Begriff, flags = 'u'): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}_'])(?:${b.muster.join('|')})(?![\\p{L}\\p{N}_'])`, flags)

/** Begriffe, die in einem der Texte vorkommen (Bericht), alphabetisch */
export const begriffeImText = (texte: readonly string[]): Begriff[] =>
  begriffeAlphabetisch().filter(b => texte.some(t => begriffRegex(b).test(t)))

/** Teile eines Texts mit dem jeweils ersten Vorkommen je Begriff markiert (Panel: dezente Verweise) */
export type BegriffTeil = { text: string } | { text: string; begriff: Begriff }
export function begriffTeile(text: string, schonGezeigt: Set<string> = new Set()): BegriffTeil[] {
  const treffer: { i: number; l: number; b: Begriff }[] = []
  for (const b of BEGRIFFE) {
    if (schonGezeigt.has(b.id)) continue
    const m = begriffRegex(b).exec(text)
    if (m) treffer.push({ i: m.index, l: m[0].length, b })
  }
  treffer.sort((a, b) => a.i - b.i || b.l - a.l)
  const aus: BegriffTeil[] = []
  let pos = 0
  for (const t of treffer) {
    if (t.i < pos) continue
    if (t.i > pos) aus.push({ text: text.slice(pos, t.i) })
    aus.push({ text: text.slice(t.i, t.i + t.l), begriff: t.b })
    schonGezeigt.add(t.b.id)
    pos = t.i + t.l
  }
  if (pos < text.length) aus.push({ text: text.slice(pos) })
  return aus
}
