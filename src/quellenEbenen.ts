// ── «Geladene Quellen» auf der Karte (seit 01.11.2026, wie VeloroutenCheck und fgsCheck) ───────────────────────────────────────
//
// Was die Rechnung aus abrufbaren Quellen liest (Tempo, Vortritt, Lichtsignal, Höhenprofile, Rad- und Fusswege, Kataster, AV, Strassentyp,
// Tram), ist je Quelle einzeln einblendbar (Fenster «Geladene Quellen» unten links, verschiebbar). Gezeigt werden die beim Laden
// gelesenen Objekte (keine neue Abfrage); das Menü zeigt nur Quellen mit Daten. Gleiche Farbstufen wie die beiden anderen Rechner;
// Punkte der Quellen sind Quadrate mit Zeichen, Linien haben einen dunklen Rand (Form statt Farbe allein, Nutzerbefund 01.11.2026),
// die Objekte der Prüfung (Knoten, Arme, Sichtdreiecke) bleiben, wie sie sind. Geometrie in LV95 (P). Nur Daten, keine Regeln.

import { lv95, type P } from './geo'
import type { OsmDaten, OsmWeg } from './daten/osm'
import type { TempoAmtlichLinie, HoehenVorgabe } from './rechner/typen'
import type { KatasterFeld } from './daten/parkkataster'
import type { KatasterBaum } from './daten/baumkataster'
import type { AvFlaeche } from './daten/av'

export type EbeneId = 'tempo' | 'vortritt' | 'lsa' | 'steigung' | 'velofuss' | 'strassentyp' | 'parkfelder' | 'baeume' | 'av' | 'tram'

export interface EbenenObjekt {
  id: string
  linien?: P[][]
  punkt?: P
  ringe?: P[][]
  klasse: string
  wert?: string
  text: string
  gestrichelt?: boolean
  deckkraft?: number
}
export type EbenenDaten = Partial<Record<EbeneId, EbenenObjekt[]>>

export interface EbeneDef {
  id: EbeneId
  titel: string
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
const AV_KLASSE = (art: string): string => (art === 'Strasse_Weg' ? 'strasse' : art === 'Trottoir' || art === 'Verkehrsinsel' ? art.toLowerCase()
  : art === 'Gebaeude' ? 'gebaeude' : /humus|Gartenanlage|Acker|Wiese|Wald|bestockt|Gebuesch/i.test(art) ? 'gruen' : 'uebrige')

export const EBENEN: readonly EbeneDef[] = [
  { id: 'tempo', titel: 'Tempo', legende: TEMPO_FARBEN,
    quelle: 'Geoportal Stadt Bern, Signalisierte Höchstgeschwindigkeit; gestrichelt OpenStreetMap maxspeed' },
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
  { id: 'parkfelder', titel: 'Parkfelder', quelle: 'Kataster der Parkfelder (Stadt Bern bzw. Zürich), ganzer geladener Ausschnitt',
    legende: [['auto', '#1d4ed8', 'Auto'], ['velo', '#0e7490', 'Velo'], ['motorrad', '#7c2d12', 'Motorrad']] },
  { id: 'baeume', titel: 'Bäume', quelle: 'Baumkataster, ganzer geladener Ausschnitt', legende: [['baum', '#166534', 'Baum', 'B']] },
  { id: 'av', titel: 'Amtliche Vermessung (alle Arten)', quelle: 'geodienste.ch, amtliche Vermessung (Bodenbedeckung)',
    legende: [['strasse', '#6e6e6e', 'Strasse, Weg'], ['trottoir', '#c9c98f', 'Trottoir'], ['verkehrsinsel', '#96c878', 'Verkehrsinsel'],
      ['gebaeude', '#3f3f46', 'Gebäude'], ['gruen', '#65a30d', 'Grünfläche, Wald'], ['uebrige', '#a8a29e', 'übrige befestigte']] },
  { id: 'tram', titel: 'Tram und Übergänge', quelle: 'OpenStreetMap railway=tram; Fussgängerübergänge',
    legende: [['tram', '#b91c1c', 'Tramgleis'], ['uebergang', '#475569', 'Fussgängerübergang', 'Ü']] },
]

export const ebenenFarbe = (e: EbeneDef, klasse: string): string => e.legende.find(l => l[0] === klasse)?.[1] ?? '#334155'
export const ebenenSymbol = (e: EbeneDef, klasse: string): string => e.legende.find(l => l[0] === klasse)?.[3] ?? '•'

/** Menü: nur Quellen mit Daten; die übrigen nennt eine Zeile «Ohne Daten» */
export function ebenenSichtbar(daten: EbenenDaten): { zeigen: EbeneDef[]; ohne: EbeneDef[] } {
  const zeigen: EbeneDef[] = [], ohne: EbeneDef[] = []
  for (const e of EBENEN) ((daten[e.id] ?? []).length ? zeigen : ohne).push(e)
  return { zeigen, ohne }
}

const f1 = (x: number) => x.toFixed(1).replace('.', ',')
const wegLinie = (w: OsmWeg): P[] => w.geom.map(([lat, lon]) => lv95(lat, lon))
const name = (w: OsmWeg) => (w.tags.name ? `, ${w.tags.name}` : '')

/** Profillinie der Längsneigung (Ergebnis: profilLinie je Richtung, zufahrtProfil, trottoirProfil) mit der Messung */
export interface ProfilAnzeige { key: keyof HoehenVorgabe; linie: P[] }
const PROFIL_NAME: Record<keyof HoehenVorgabe, string> = { links: 'Fahrstreifen von links', rechts: 'Fahrstreifen von rechts', zufahrt: 'Zufahrt', trottoir: 'Trottoir' }

export interface QuellenEingang {
  osm: OsmDaten | null
  vsig: TempoAmtlichLinie[] | null
  park: KatasterFeld[] | null
  baeume: KatasterBaum[] | null
  av: AvFlaeche[] | null
  profile: ProfilAnzeige[]
  hoehen: HoehenVorgabe | null
}

export function ebenenAusDaten(x: QuellenEingang): EbenenDaten {
  const d: EbenenDaten = {}
  const wege = x.osm?.wege ?? []
  d.tempo = [
    ...(x.vsig ?? []).filter(l => l.vSig != null).map(l => ({ id: `vs:${l.id}`, linien: l.teile, klasse: tempoKlasse(l.vSig!), wert: String(l.vSig),
      text: `Tempo ${l.vSig} km/h${l.strasse ? `, ${l.strasse}` : ''} (Geoportal Stadt Bern)` })),
    ...(x.vsig?.length ? [] : wege.filter(w => /^\d+$/.test(w.tags.maxspeed ?? '')).map(w => {
      const v = Number(w.tags.maxspeed)
      return { id: `osm:${w.id}`, linien: [wegLinie(w)], klasse: tempoKlasse(v), wert: String(v), gestrichelt: true,
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
    return { id: `pr:${p.key}`, linien: [p.linie], klasse: neigungKlasse(i), ...(i != null ? { wert: `${f1(i)} %` } : {}),
      text: i != null ? `${PROFIL_NAME[p.key]}: Längsneigung ${f1(i)} % (${m!.quelle})` : `${PROFIL_NAME[p.key]}: Neigung ${m ? 'nicht bestimmbar' : 'noch nicht geladen'}` }
  })
  d.velofuss = (x.osm?.querungen ?? []).map(w => ({ id: `vf:${w.id}`, linien: [wegLinie(w)],
    klasse: w.tags.highway === 'cycleway' || w.tags.bicycle === 'designated' ? 'rad' : w.tags.highway === 'path' ? 'weg' : 'fuss',
    text: `highway=${w.tags.highway}${w.tags.footway ? `, footway=${w.tags.footway}` : ''}${w.tags.bicycle ? `, bicycle=${w.tags.bicycle}` : ''}${name(w)} (OpenStreetMap)` }))
  d.strassentyp = wege.filter(w => w.tags.highway).map(w => ({ id: `hw:${w.id}`, linien: [wegLinie(w)],
    klasse: HW_KLASSE[w.tags.highway.replace('_link', '')] ?? 'andere', text: `highway=${w.tags.highway}${name(w)} (OpenStreetMap)` }))
  d.parkfelder = (x.park ?? []).filter(f => f.ring.length >= 3).map(f => ({ id: `pk:${f.id}`, ringe: [f.ring], klasse: f.klasse, deckkraft: 0.4,
    text: `${f.name || 'Parkfeld'} (Kataster)` }))
  d.baeume = (x.baeume ?? []).map(b => ({ id: `bm:${b.id}`, punkt: b.p, klasse: 'baum', text: `${b.name || 'Baum'} (Baumkataster)` }))
  d.av = (x.av ?? []).filter(f => f.ringe[0]?.length >= 3).map((f, k) => ({ id: `av:${k}:${f.art}`, ringe: f.ringe, klasse: AV_KLASSE(f.art),
    deckkraft: 0.3, text: `AV: ${f.art.replace(/_/g, ' ')}` }))
  d.tram = [
    ...(x.osm?.tram ?? []).map(w => ({ id: `tr:${w.id}`, linien: [wegLinie(w)], klasse: 'tram', text: `Tramgleis${name(w)} (OpenStreetMap railway=tram)` })),
    ...(x.osm?.uebergaenge ?? []).map(k => ({ id: `ue:${k.id}`, punkt: lv95(k.lat, k.lon), klasse: 'uebergang',
      text: `Fussgängerübergang${k.tags.crossing ? ` (crossing=${k.tags.crossing})` : ''} (OpenStreetMap)` })),
  ]
  return d
}
