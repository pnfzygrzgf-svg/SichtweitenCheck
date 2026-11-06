// ── Quellen im Bericht: Tabelle Quelle | Für | Anbieter | Stand | Lizenz, nur die genutzten Quellen (wie fgsCheck, BerichtQuellenTabelle) ──
//
// Quellen, die nur auf der Karte als Kontext liegen (Unfälle, Bauzonen, BAV-Punkte, Gebietsbestimmung), stehen nicht im Bericht.
//
// Der SichtweitenCheck hat kein Quellenregister wie fgsCheck: Die Zeilen entstehen aus dem Fall (fall.quellen, amtliche und regionale Daten)
// und dem Ladestand (quellen). Lizenzen im Wortlaut des fgsCheck. Stand: fachlicher Datenstand; darunter Abruf und Vollständigkeit
// (die Abrufzeit ist kein Datenstand, qualitaet.ts).

import type { ReactNode } from 'react'
import type { Fall } from './fall'
import type { QuellenStand } from './berichtbild'
import { regionalDienst } from './daten/anbieter/gemeinsam/regionalDienste'
import { zhStandText } from './daten/anbieter/gemeinsam/zuerich'
import { BERN_DTM_KURZ } from './daten/bernDtm'

const SWISSTOPO_LIZENZ = 'frei, Quellenangabe «© swisstopo»'
const BERN_LIZENZ = 'Open Data Stadt Bern: freie Nutzung, Quellenangabe Pflicht'
const AV_LIZENZ = 'frei mit Quellenangabe (Bedingungen je Kanton)'
const OSM_LIZENZ = 'ODbL, © OpenStreetMap-Mitwirkende'

interface Zeile { quelle: string; fuer: string; anbieter: string; stand: string; zusatz: string; lizenz: string; url?: string }
const iso = (z?: string) => (z ? new Date(z).toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '')

/** Quellenangabe «Anbieter, Name» in ihre Teile */
const teile = (angabe: string): [string, string] => { const i = angabe.indexOf(', '); return i < 0 ? [angabe, angabe] : [angabe.slice(i + 2), angabe.slice(0, i)] }

/** Adresse einer Quelle für den Link im Bericht (Firefox übernimmt ihn ins PDF) */
const urlVon = (z: Zeile): { url?: string } => {
  const url = z.quelle.startsWith('Luftbild') ? 'https://www.swisstopo.admin.ch/de/orthobilder-swissimage-10-cm'
    : z.quelle.includes('swissALTI3D') ? 'https://www.swisstopo.admin.ch/de/hoehenmodell-swissalti3d'
    : z.quelle.startsWith('Amtliche Vermessung') ? 'https://www.geodienste.ch/' : z.quelle.startsWith('OpenStreetMap') ? 'https://www.openstreetmap.org/'
    : z.anbieter.includes('Stadt Bern') ? 'https://map.bern.ch/' : z.anbieter.includes('Stadt Zürich') ? 'https://www.stadt-zuerich.ch/geodaten/' : undefined
  return url ? { url } : {}
}

export function berichtQuellenZeilen({ fall, quellen, kantone, luftbild, avFuer, osmFuer }: { fall: Fall; quellen: Record<string, QuellenStand>; kantone: string[]
  luftbild?: { flugjahr: string; geladen: boolean; abgerufen: string }; avFuer: string; osmFuer: string }): Zeile[] {
  /** Datenstand und Zusatz aus dem Ladestand einer Quelle */
  const aus = (k: string) => { const q = quellen[k]
    return { stand: q?.datenstand || 'unbekannt', zusatz: `${q?.zeit ? `Abgerufen ${iso(q.zeit)}; ` : ''}Vollständigkeit ${q?.vollstaendigkeit || 'unbekannt'}` } }
  const lizenzVon = (anbieter: string) => (anbieter.includes('Stadt Bern') ? BERN_LIZENZ : 'gemäss Anbieter')
  const z: Zeile[] = []
  if (luftbild) z.push({ quelle: 'Luftbild SWISSIMAGE 10 cm', fuer: 'Kartenbild', anbieter: 'swisstopo',
    stand: luftbild.flugjahr ? `Flugjahr ${luftbild.flugjahr}` : 'unbekannt',
    zusatz: `${luftbild.geladen ? `Abgerufen ${luftbild.abgerufen}` : 'Nicht geladen, Kartenbild ohne Luftbild'}; Vollständigkeit unbekannt`, lizenz: SWISSTOPO_LIZENZ })
  const dtm = !!quellen.hoehenBern || !!fall.quellen.hoehen?.startsWith(BERN_DTM_KURZ)
  if (fall.quellen.hoehen || luftbild) z.push({ quelle: dtm ? BERN_DTM_KURZ : 'Höhenmodell swissALTI3D', fuer: 'Längsneigung', anbieter: dtm ? 'Geodaten Stadt Bern' : 'swisstopo',
    ...(fall.quellen.hoehen ? aus(dtm ? 'hoehenBern' : 'hoehen') : { stand: 'nicht geladen', zusatz: '' }), lizenz: dtm ? BERN_LIZENZ : SWISSTOPO_LIZENZ })
  z.push({ quelle: 'Amtliche Vermessung (Bodenbedeckung)', fuer: avFuer, anbieter: `Kanton ${kantone.join(', ') || '–'} über geodienste.ch`, ...aus('av'), lizenz: AV_LIZENZ })
  z.push({ quelle: 'OpenStreetMap (Overpass)', fuer: osmFuer, anbieter: 'OpenStreetMap', ...aus('osm'), lizenz: OSM_LIZENZ })
  if (fall.quellen.parkkataster) { const [name, anbieter] = teile(fall.quellen.parkkataster)
    z.push({ quelle: name, fuer: 'Parkfelder', anbieter, ...aus('parkkataster'), lizenz: lizenzVon(anbieter) }) }
  if (fall.quellen.baumkataster) { const [name, anbieter] = teile(fall.quellen.baumkataster)
    z.push({ quelle: name, fuer: 'Bäume', anbieter, ...aus('baumkataster'), lizenz: lizenzVon(anbieter) }) }
  if (fall.quellen.vsig) { const [name, anbieter] = teile(fall.quellen.vsig)
    z.push({ quelle: name, fuer: 'Tempo (vor OSM)', anbieter, ...aus('vsig'), lizenz: lizenzVon(anbieter) }) }
  for (const t of fall.regional?.teile ?? []) { const d = regionalDienst(t.id)
    if (d?.art === 'tempo' || d?.art === 'zone') z.push({ quelle: `${d.name} (${t.objekte.length} Objekte)`, fuer: 'Tempo', anbieter: d.anbieter,
      stand: t.datenstand, zusatz: `Abgerufen ${iso(t.abgerufen)}; Vollständigkeit unbekannt`, lizenz: d.lizenz }) }
  for (const k of ['tempo', 'zonen'] as const) { const q = fall.zuerich?.[k]
    if (q) z.push({ quelle: `${k === 'tempo' ? 'Signalisierte Geschwindigkeiten' : 'Verkehrszonen'} (${q.objekte.length} Objekte)`, fuer: 'Tempo',
      anbieter: 'Stadt Zürich, Dienstabteilung Verkehr', stand: zhStandText(q), zusatz: `Abgerufen ${iso(q.abgerufen)}; Vollständigkeit unbekannt`, lizenz: 'CC0, Stadt Zürich' }) }
  return z.map(x => ({ ...x, ...urlVon(x) }))
}

/** Tabelle wie im fgsCheck; children: weitere Punkte unter der Tabelle */
export function BerichtQuellenTabelle({ zeilen, children }: { zeilen: Zeile[]; children?: ReactNode }) {
  return <>
    <table className="quellen-tabelle bericht-quellen">
      <thead><tr><th>Quelle</th><th>Für</th><th>Anbieter</th><th>Stand</th><th>Lizenz</th></tr></thead>
      <tbody>{zeilen.map(q => <tr key={q.quelle}><td>{q.url ? <a href={q.url}>{q.quelle}</a> : q.quelle}</td><td>{q.fuer}</td><td>{q.anbieter}</td>
        <td>{q.stand}{q.zusatz && <div className="klein">{q.zusatz}</div>}</td><td>{q.lizenz}</td></tr>)}</tbody>
    </table>
    {children}
  </>
}
