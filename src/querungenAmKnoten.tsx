// ── Fussgängerquerungen am Knoten (Verknüpfung, Etappe 3): öffnet jede Querung einzeln im fgsCheck ──
//
// Die Übergänge kommen aus den schon geladenen OSM-Daten. QUERUNG_KNOTEN_M ist nur der Suchbereich (Annahme): Die Liste ordnet nichts
// zu, gewählt wird von Hand. Fehlt ein Übergang in OSM, heisst das nicht, dass es keine Querung gibt.

import { dist, lv95, type P } from './geo'
import { markierung, type Markierung, type OsmDaten } from './daten/osm'
import { zielAdresse, type Ort } from './verknuepfung'
import { RechnerLogo } from './AndereRechner'

export const QUERUNG_KNOTEN_M = 40
const HIMMEL = ['Nord', 'Nordost', 'Ost', 'Südost', 'Süd', 'Südwest', 'West', 'Nordwest']
const ART: Record<Markierung, string> = { lsa: 'mit Lichtsignal', markiert: 'Fussgängerstreifen', vermutlich: 'vermutlich Fussgängerstreifen',
  unmarkiert: 'unmarkierte Querung', unbelegt: 'Art nicht angegeben' }

export interface QuerungAmKnoten { id: number; ort: Ort; strasse: string; abstandM: number; himmel: string; art: string }

/** Übergänge im Suchbereich um den Knoten, der nächste zuerst; Strasse aus dem Weg, auf dem der Übergang liegt */
export function querungenAmKnoten(osm: Pick<OsmDaten, 'uebergaenge' | 'wege'>, knoten: P): QuerungAmKnoten[] {
  return osm.uebergaenge.map(u => {
    const p = lv95(u.lat, u.lon), d = dist(p, knoten)
    const grad = (Math.atan2(p[0] - knoten[0], p[1] - knoten[1]) * 180 / Math.PI + 360) % 360
    const wege = osm.wege.filter(w => w.knoten.includes(u.id))
    return { id: u.id, ort: { lat: u.lat, lon: u.lon }, abstandM: d, himmel: HIMMEL[Math.round(grad / 45) % 8], art: ART[markierung(u.tags)],
      strasse: wege.find(w => w.tags.name)?.tags.name ?? 'Strasse ohne Namen' }
  }).filter(q => q.abstandM <= QUERUNG_KNOTEN_M).sort((a, b) => a.abstandM - b.abstandM || a.id - b.id)
}

/** Liste in der Kachel «In anderen Rechnern prüfen»; ohne Treffer der Hinweis und der Link zum Ort */
export function QuerungenAmKnoten({ liste, ort }: { liste: QuerungAmKnoten[]; ort: Ort }) {
  return <>
    <h3><RechnerLogo r="fgs" /> fgsCheck: Fussgängerquerungen am Knoten ({liste.length})</h3>
    {liste.length ? <>
      <ul className="ziele">{liste.map(q => <li key={q.id}>
        <a href={zielAdresse('fgs', 'swc', { ort: q.ort, uebergang: q.id })} target="_blank" rel="noopener noreferrer">{q.strasse}, {Math.round(q.abstandM)} m {q.himmel}&nbsp;↗</a>
        {' '}<span className="klein">{q.art}</span>
      </li>)}</ul>
      <p className="klein">Aus OpenStreetMap, bis {QUERUNG_KNOTEN_M} m vom Knoten (Annahme). Jeder Link öffnet genau diese Querung im fgsCheck. Ob sie dort schon
        geprüft ist, weiss der SichtweitenCheck nicht.</p>
    </> : <>
      <p className="klein">Keine Querung in OpenStreetMap gefunden. Das heisst nicht, dass es keine gibt.</p>
      <ul className="ziele"><li><a href={zielAdresse('fgs', 'swc', { ort })} target="_blank" rel="noopener noreferrer">Querung hier auswählen oder planen&nbsp;↗</a>
        {' '}<span className="klein">im fgsCheck</span></li></ul>
    </>}
  </>
}
