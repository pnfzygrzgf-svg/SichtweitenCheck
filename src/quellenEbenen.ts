import { AV_LEGENDE, avKlasse } from './daten/anbieter/gemeinsam/avKarte'
import { regionalLegende } from './daten/anbieter/gemeinsam/regionalLegende'
import { ebenenQuellenText, objektQuellenText, regionalEbenenZustand, type QuellenLadeinfo } from './daten/anbieter/gemeinsam/ebenenQualitaet'
import { REGIONAL_DIENSTE } from './daten/anbieter/gemeinsam/regionalDienste'
import type { RegionalSnapshot } from './daten/anbieter/gemeinsam/regional'
import { zhStandText, type ZuerichSnapshot } from './daten/anbieter/gemeinsam/zuerich'
import { alphabetisch } from './daten/anbieter/gemeinsam/sortierung'
import { bavDatenstandText } from './daten/anbieter/gemeinsam/bav'
import { type QuellenQualitaet } from './daten/anbieter/gemeinsam/qualitaet'
// ── «Geladene Quellen» auf der Karte (seit 01.11.2026, wie VeloroutenCheck und fgsCheck) ───────────────────────────────────────
//
// Was die Rechnung aus abrufbaren Quellen liest (Tempo, Vortritt, Lichtsignal, Höhenprofile, Rad- und Fusswege, Kataster, AV, Strassentyp,
// Tram), ist je Quelle einzeln einblendbar (Fenster «Geladene Quellen» unten links, verschiebbar). Gezeigt werden die beim Laden
// gelesenen Objekte (keine neue Abfrage); das Menü zeigt nur Quellen mit Daten. Gleiche Farbstufen wie die beiden anderen Rechner;
// Punkte der Quellen sind Quadrate mit Zeichen, Linien haben einen dunklen Rand (Form statt Farbe allein),
// die Objekte der Prüfung (Knoten, Arme, Sichtdreiecke) bleiben, wie sie sind. Geometrie in LV95 (P). Nur Daten, keine Regeln.

import { lv95, type P } from './geo'
import type { OsmDaten, OsmWeg } from './daten/osm'
import type { TempoAmtlichLinie, HoehenVorgabe } from './rechner/typen'
import type { KatasterFeld } from './daten/parkkataster'
import type { KatasterBaum } from './daten/baumkataster'
import type { AvFlaeche } from './daten/av'
import type { BavSnapshot } from './daten/anbieter/gemeinsam/typen'

export type EbeneId = 'unfaelleFuss' | 'unfaelleVelo' | `regional.${string}` | 'zhTempo' | 'zhZonen' | 'tempo' | 'vortritt' | 'lsa' | 'steigung' | 'velofuss' | 'strassentyp' | 'parkfelder' | 'baeume' | 'av' | 'tram' | 'bav' | 'gelaende'

export interface EbenenObjekt {
  id: string
  linien?: P[][]
  punkt?: P
  ringe?: P[][]
  klasse: string
  wert?: string
  text: string
  profil?: true
  hoehenprofil?: import('./hoehenprofil/modell').HoehenProfil
  quelle?: string
  quellenSchluessel?: string
  datenstand?: string
  gestrichelt?: boolean
  deckkraft?: number
}
export type EbenenDaten = Partial<Record<EbeneId, EbenenObjekt[]>> & { metadaten?: Readonly<Record<string, QuellenLadeinfo>>; qualitaet?: Partial<Record<EbeneId, QuellenQualitaet>> }

export interface EbeneDef {
  id: EbeneId
  titel: string
  quellenHinweis?: string
  quelle: string
  /** symbol: Zeichen im Quadrat der Punkte */
  legende: [klasse: string, farbe: string, text: string, symbol?: string][]
}

export const BESCHRIFT_ZOOM = 18

export const TEMPO_FARBEN: [string, string, string][] = [
  ['t20', '#16a34a', '20 km/h und weniger'], ['t30', '#65a30d', '30 km/h'], ['t40', '#ca8a04', '40 km/h'],
  ['t50', '#ea580c', '50 km/h'], ['t60', '#dc2626', '60 km/h und mehr'],
]
export const tempoKlasse = (v: number): string => (v <= 20 ? 't20' : v <= 30 ? 't30' : v <= 40 ? 't40' : v <= 50 ? 't50' : 't60')
const neigungKlasse = (i: number | null): string => (i == null ? 'n?' : Math.abs(i) > 6 ? 'n6' : Math.abs(i) > 2 ? 'n2' : 'n0')
const HW_KLASSE: Record<string, string> = { motorway: 'haupt', trunk: 'haupt', primary: 'haupt', secondary: 'haupt', tertiary: 'verbindung',
  unclassified: 'sammel', residential: 'erschliessung', living_street: 'erschliessung', service: 'andere', pedestrian: 'andere', road: 'andere', busway: 'andere' }


export const EBENEN: readonly EbeneDef[] = [
  { id: 'gelaende', titel: 'Gelände (swissALTI3D, Höhenprofile)', quelle: '© swisstopo; Höhenprofile zur Längsneigung; keine Prüfung auf Sichtverdeckung durch Gelände',
    legende: [['profil', '#79512e', 'Geländeprofil der verwendeten Achse']] },
  ...[['unfaelleFuss','Unfälle mit Fussgängerbeteiligung (ASTRA)'],['unfaelleVelo','Unfälle mit Velobeteiligung (ASTRA)']].map(([id,titel]): EbeneDef => ({ id:id as EbeneId, titel, quelle:'© ASTRA; Unfälle mit Personenschaden; anonymisierte Lage, nur Kartenkontext, keine Regelwirkung', legende:regionalLegende('unfall') })),
  ...REGIONAL_DIENSTE.map((d): EbeneDef => ({ id: `regional.${d.id}`, titel: d.name, quellenHinweis: d.hinweis, quelle: `${d.anbieter}; ${d.lizenz}; ${d.hinweis}`, legende: regionalLegende(d.art) })),
  { id: 'zhTempo', titel: 'Tempo (Stadt Zürich)', quelle: 'Stadt Zürich, signalisierte Geschwindigkeiten; heutiger Zustand, CC0', legende: [...TEMPO_FARBEN, ['verbot', '#7f1d1d', 'Fahrverbot / ungeklärtes Regime']] },
  { id: 'zhZonen', titel: 'Verkehrszonen (Stadt Zürich)', quelle: 'Stadt Zürich, bestehende Verkehrszonen; CC0', legende: [['t30_zone', '#eab308', 'Tempo-30-Zone'], ['begegnungszone', '#16a34a', 'Begegnungszone'], ['fussgaengerzone', '#7c3aed', 'Fussgängerzone'], ['offen', '#64748b', 'ungeklärt']] },
  { id: 'bav', titel: 'Haltestellen BAV', quelle: '© BAV; Haltestellenpunkte, keine Haltekanten; nur Karte, keine Wirkung auf die Rechnung',
    legende: [['tram', '#b91c1c', 'Tram (auch mit Bus)', 'T'], ['bus', '#1d4ed8', 'Bus', 'B']] },
  { id: 'tempo', titel: 'Tempo', legende: TEMPO_FARBEN,
    quelle: 'Tempoquelle nicht geladen' },
  { id: 'vortritt', titel: 'Vortritt', quelle: 'OpenStreetMap highway=give_way, stop; priority_road',
    legende: [['give_way', '#b91c1c', 'Kein Vortritt', '▽'], ['stop', '#7f1d1d', 'Stop', '■'], ['prioritaet', '#ca8a04', 'Hauptstrasse (priority_road)']] },
  { id: 'lsa', titel: 'Lichtsignale', quelle: 'OpenStreetMap highway=traffic_signals', legende: [['lsa', '#0f172a', 'Lichtsignal', 'L']] },
  { id: 'steigung', titel: 'Längsneigung (Profile)', quelle: 'swissALTI3D (swisstopo), Profile der Fahrstreifen, der Zufahrt und des Trottoirs',
    legende: [['n0', '#16a34a', 'bis 2 %'], ['n2', '#ca8a04', 'über 2 %'], ['n6', '#dc2626', 'über 6 %'], ['n?', '#64748b', 'nicht bestimmbar']] },
  { id: 'velofuss', titel: 'Rad- und Fusswege', quelle: 'OpenStreetMap highway=cycleway, footway, path',
    legende: [['rad', '#0e7490', 'Radweg'], ['fuss', '#a16207', 'Fussweg, Querung'], ['weg', '#57534e', 'Weg (path)']] },
  { id: 'strassentyp', titel: 'Strassentyp', quelle: 'OpenStreetMap highway',
    legende: [['haupt', '#dc2626', 'Hauptstrasse'], ['verbindung', '#ea580c', 'Verbindungsstrasse'], ['sammel', '#ca8a04', 'Sammelstrasse'],
      ['erschliessung', '#16a34a', 'Erschliessungsstrasse'], ['andere', '#64748b', 'übrige']] },
  { id: 'parkfelder', titel: 'Parkfelder', quelle: 'Katasteranbieter nicht geladen',
    legende: [['auto', '#1d4ed8', 'Auto'], ['velo', '#0e7490', 'Velo'], ['motorrad', '#7c2d12', 'Motorrad']] },
  { id: 'baeume', titel: 'Bäume', quelle: 'Baumkataster, ganzer geladener Ausschnitt', legende: [['baum', '#166534', 'Baum', 'B']] },
  { id: 'av', titel: 'Amtliche Vermessung', quelle: 'geodienste.ch, amtliche Vermessung (Bodenbedeckung)', legende: AV_LEGENDE },
  { id: 'tram', titel: 'Tram und Übergänge', quelle: 'OpenStreetMap railway=tram; Fussgängerübergänge',
    legende: [['tram', '#b91c1c', 'Tramgleis'], ['uebergang', '#475569', 'Fussgängerübergang', 'Ü']] },
]

export const ebenenFarbe = (e: EbeneDef, klasse: string): string => e.legende.find(l => l[0] === klasse)?.[1] ?? '#334155'
export const ebenenSymbol = (e: EbeneDef, klasse: string): string => e.legende.find(l => l[0] === klasse)?.[3] ?? '•'

/** Menü: nur Quellen mit Daten; die übrigen nennt eine Zeile «Ohne Daten» */
export function ebenenSichtbar(daten: EbenenDaten): { zeigen: EbeneDef[]; ohne: EbeneDef[]; laedt: EbeneDef[]; fehler: EbeneDef[] } {
  const gruppen = { zeigen: [] as EbeneDef[], ohne: [] as EbeneDef[], laedt: [] as EbeneDef[], fehler: [] as EbeneDef[] }
  for (const e of EBENEN) {
    const vorhanden = Object.prototype.hasOwnProperty.call(daten, e.id)
    if (e.id === 'gelaende' && !vorhanden) continue
    const objekte = daten[e.id] ?? []
    // Gebietsfremde Quellen sind kein leerer örtlicher Bestand. Ein Metadateneintrag allein belegt nur den Ladestart.
    const regional = e.id.startsWith('regional.')
    const zh = e.id === 'zhTempo' || e.id === 'zhZonen'
    if (!objekte.length && zh && !daten.metadaten?.[e.id] && !daten.qualitaet?.[e.id]) continue
    const zustand = regional ? regionalEbenenZustand(vorhanden, objekte.length, daten.metadaten?.[e.id]) : objekte.length ? 'zeigen' : 'ohne'
    if (zustand === null) continue
    const def = { ...e, quelle: ebenenQuellenText(objekte, e.quelle, daten.qualitaet?.[e.id], daten.metadaten) }
    gruppen[zustand].push(def)
  }
  for (const gruppe of Object.values(gruppen)) gruppe.sort((a, b) => alphabetisch(a.titel, b.titel))
  return gruppen
}

const f1 = (x: number) => x.toFixed(1).replace('.', ',')
const wegLinie = (w: OsmWeg): P[] => w.geom.map(([lat, lon]) => lv95(lat, lon))
const name = (w: OsmWeg) => (w.tags.name ? `, ${w.tags.name}` : '')

/** Profillinie der Längsneigung (Ergebnis: profilLinie je Richtung, zufahrtProfil, trottoirProfil) mit der Messung */
export interface ProfilAnzeige { key: keyof HoehenVorgabe; linie: P[] }
const PROFIL_NAME: Record<keyof HoehenVorgabe, string> = { links: 'Fahrstreifen von links', rechts: 'Fahrstreifen von rechts', zufahrt: 'Zufahrt', trottoir: 'Trottoir' }

export interface QuellenEingang {
  regional?: RegionalSnapshot | null
  zuerich?: ZuerichSnapshot | null
  bav?: BavSnapshot | null
  osm: OsmDaten | null
  vsig: TempoAmtlichLinie[] | null
  parkQuelle?: string
  baumQuelle?: string
  park: KatasterFeld[] | null
  baeume: KatasterBaum[] | null
  av: AvFlaeche[] | null
  profile: ProfilAnzeige[]
  hoehen: HoehenVorgabe | null
}

export function ebenenAusDaten(x: QuellenEingang): EbenenDaten {
  const d: EbenenDaten = {}
  for (const t of x.regional?.teile ?? []) d[`regional.${t.id}`] = t.objekte.filter(o => ['tempo','zone'].includes(REGIONAL_DIENSTE.find(d => d.id === t.id)?.art ?? '') || !!o.kontext || !!o.verkehr || !!o.bund).flatMap<EbenenObjekt>(o => {
    const v = o.tempo ?? (o.zone === 't30_zone' ? 30 : o.zone === 'begegnungszone' ? 20 : null)
    const basis = { id: o.id, ...(o.bund?.typ === 'unfall' ? { quelle: '© ASTRA' } : {}), klasse: o.kontext ?? (o.bund ? o.bund.typ === 'strasse' && [200, 300].includes(o.bund.code ?? 0) ? `strasse${o.bund.code}` : o.bund.typ : o.verkehr ?? (v === null ? 'offen' : tempoKlasse(v))), wert: v === null ? undefined : String(v), text: o.bund?.typ === 'unfall' ? `${o.name}; ${o.hinweis}` : `${o.name}${o.kontext || o.bund ? '' : `: ${o.tempo ?? o.zone ?? 'unbekannt'}`}; ${o.hinweis}; ${o.bestaetigen ? 'Übernahme bestätigen; ' : ''}Datenstand ${t.datenstand}`, datenstand: o.stand ? `${o.stand.split('-').reverse().join('.')} (Objekt-/Exportstand)` : t.datenstand }
    return o.punkte ? o.punkte.map((punkt, i) => ({ ...basis, id: `${o.id}:${i}`, punkt })) : o.teile ? [{ ...basis, linien: o.teile }] : (o.polygone ?? []).map((ringe, i) => ({ ...basis, id: `${o.id}:${i}`, ringe, deckkraft: 0.12 }))
  })
  const zh = x.zuerich
  const unfall = x.regional?.teile.find(t => t.id === 'bund.unfaelle')
  for (const [id, art] of [['unfaelleFuss','fuss'],['unfaelleVelo','velo']] as const)
    d[id] = (unfall?.objekte ?? []).filter(o => o.bund?.[art]).flatMap(o => (o.punkte ?? []).map((punkt,i) => ({id:`${o.id}:${i}`,punkt,klasse:'unfall',quelle:'© ASTRA',text:`${o.name}; ${o.hinweis}`,datenstand:unfall!.datenstand})))
  d.zhTempo = (zh?.tempo?.objekte ?? []).map(l => ({ id: l.id, linien: l.teile, klasse: l.tempo === null ? 'verbot' : tempoKlasse(l.tempo),
    wert: l.tempo === null ? undefined : String(l.tempo), text: `${l.name}: ${l.regime} (${l.code}); ${l.signal} ${l.ausnahmen}; Stadt Zürich; umgesetzt ${l.umgesetzt ?? 'unbekannt'}; Datenstand ${zhStandText(zh!.tempo!)}` }))
  d.zhZonen = (zh?.zonen?.objekte ?? []).flatMap(z => z.polygone.map((ringe, i) => ({ id: `${z.id}:${i}`, ringe, klasse: z.art ?? 'offen', deckkraft: 0.14,
    text: `${z.regime} «${z.name}»; Stadt Zürich; umgesetzt ${z.umgesetzt ?? 'unbekannt'}; Datenstand ${zhStandText(zh!.zonen!)}` })))
  d.bav = (x.bav?.halte ?? []).map(h => ({ id: h.id, punkt: h.p, klasse: h.art === 'bus' ? 'bus' : 'tram', datenstand: bavDatenstandText(x.bav!),
    text: `${h.name} (${h.art === 'bus_tram' ? 'Bus / Tram' : h.art === 'bus' ? 'Bus' : 'Tram'}; BAV ${h.nummer}); ` +
      `Haltestellenpunkt, keine Haltekante; abgerufen ${x.bav!.abgerufen}; Datenstand ${bavDatenstandText(x.bav!)} (Ebene)` }))
  const wege = x.osm?.wege ?? []
  d.tempo = [
    ...(x.vsig ?? []).filter(l => l.vSig != null).map(l => ({ id: `vs:${l.id}`, quelle: 'Geoportal Stadt Bern, Signalisierte Höchstgeschwindigkeit', quellenSchluessel: 'vsig', linien: l.teile, klasse: tempoKlasse(l.vSig!), wert: String(l.vSig),
      text: `Tempo ${l.vSig} km/h${l.strasse ? `, ${l.strasse}` : ''} (Geoportal Stadt Bern)` })),
    ...(x.vsig?.length ? [] : wege.filter(w => /^\d+$/.test(w.tags.maxspeed ?? '')).map(w => {
      const v = Number(w.tags.maxspeed)
      return { id: `osm:${w.id}`, quelle: 'OpenStreetMap maxspeed · © OpenStreetMap-Mitwirkende, ODbL (gestrichelt)', quellenSchluessel: 'osm', linien: [wegLinie(w)], klasse: tempoKlasse(v), wert: String(v), gestrichelt: true,
        text: `Tempo ${v} km/h${name(w)} (OpenStreetMap maxspeed${w.tags['zone:maxspeed'] ? `, Zone ${w.tags['zone:maxspeed']}` : ''})` }
    })),
  ]
  d.vortritt = [
    ...(x.osm?.vortritt ?? []).map(k => ({ id: `vt:${k.id}`, punkt: lv95(k.lat, k.lon), klasse: k.tags.highway === 'stop' ? 'stop' : 'give_way',
      text: `${k.tags.highway === 'stop' ? 'Stop' : 'Kein Vortritt'}${k.tags.direction ? ` (Richtung ${k.tags.direction})` : ''} (OpenStreetMap)` })),
    ...wege.filter(w => w.tags.priority_road === 'designated' || w.tags.priority_road === 'yes').map(w => ({ id: `pr:${w.id}`, linien: [wegLinie(w)],
      klasse: 'prioritaet', text: `Hauptstrasse, priority_road=${w.tags.priority_road}${name(w)} (OpenStreetMap)` })),
  ]
  d.lsa = (x.osm?.ampeln ?? []).map(k => ({ id: `lsa:${k.id}`, punkt: lv95(k.lat, k.lon), klasse: 'lsa', text: 'Lichtsignal (OpenStreetMap highway=traffic_signals)' }))
  d.steigung = x.profile.filter(p => p.linie.length >= 2).map(p => {
    const m = x.hoehen?.[p.key], i = m ? m.i : null
    return { id: `pr:${p.key}`, profil: true as const, linien: [p.linie], klasse: neigungKlasse(i), ...(i != null ? { wert: `${f1(i)} %` } : {}),
      text: i != null ? `${PROFIL_NAME[p.key]}: Längsneigung ${f1(i)} % (${m!.quelle})` : `${PROFIL_NAME[p.key]}: Neigung ${m ? 'nicht bestimmbar' : 'noch nicht geladen'}` }
  })
  d.velofuss = (x.osm?.querungen ?? []).map(w => ({ id: `vf:${w.id}`, linien: [wegLinie(w)],
    klasse: w.tags.highway === 'cycleway' || w.tags.bicycle === 'designated' ? 'rad' : w.tags.highway === 'path' ? 'weg' : 'fuss',
    text: `highway=${w.tags.highway}${w.tags.footway ? `, footway=${w.tags.footway}` : ''}${w.tags.bicycle ? `, bicycle=${w.tags.bicycle}` : ''}${name(w)} (OpenStreetMap)` }))
  d.strassentyp = wege.filter(w => w.tags.highway).map(w => ({ id: `hw:${w.id}`, linien: [wegLinie(w)],
    klasse: HW_KLASSE[w.tags.highway.replace('_link', '')] ?? 'andere', text: `highway=${w.tags.highway}${name(w)} (OpenStreetMap)` }))
  d.parkfelder = (x.park ?? []).filter(f => f.ring.length >= 3).map(f => ({ id: `pk:${f.id}`, quelle: x.parkQuelle || 'Katasteranbieter unbekannt', quellenSchluessel: 'parkkataster', ringe: [f.ring], klasse: f.klasse, deckkraft: 0.4,
    text: `${f.name || 'Parkfeld'} (Kataster)` }))
  d.baeume = (x.baeume ?? []).map(b => ({ id: `bm:${b.id}`, quelle: x.baumQuelle || 'Baumkatasteranbieter unbekannt', quellenSchluessel: 'baumkataster', punkt: b.p, klasse: 'baum', text: `${b.name || 'Baum'} (Baumkataster)` }))
  d.av = (x.av ?? []).filter(f => f.ringe[0]?.length >= 3).map((f, k) => ({ id: `av:${k}:${f.art}`, quelle: `Amtliche Vermessung Kanton ${f.kanton || 'unbekannt'} über geodienste.ch`, quellenSchluessel: 'av', ringe: f.ringe, klasse: avKlasse(f.art),
    deckkraft: 0.3, text: `AV: ${f.art.replace(/_/g, ' ')}` }))
  d.tram = [
    ...(x.osm?.tram ?? []).map(w => ({ id: `tr:${w.id}`, linien: [wegLinie(w)], klasse: 'tram', text: `Tramgleis${name(w)} (OpenStreetMap railway=tram)` })),
    ...(x.osm?.uebergaenge ?? []).map(k => ({ id: `ue:${k.id}`, punkt: lv95(k.lat, k.lon), klasse: 'uebergang',
      text: `Fussgängerübergang${k.tags.crossing ? ` (crossing=${k.tags.crossing})` : ''} (OpenStreetMap)` })),
  ]
  return d
}

/** Quellen und Stand auch im Objekt-Tooltip, passend zum tatsächlichen Anbieter. */
export function ebenenBeschriften(d: EbenenDaten): EbenenDaten {
  const aus: EbenenDaten = { ...d }
  for (const e of EBENEN) if (d[e.id]) aus[e.id] = d[e.id]!.map(o => ({ ...o, text: objektQuellenText({ ...o, quellenHinweis: e.quellenHinweis }, e.quelle, d.qualitaet?.[e.id], d.metadaten) }))
  return aus
}
