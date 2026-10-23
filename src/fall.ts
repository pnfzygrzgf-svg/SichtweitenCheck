// ── Fall-Datei: alle Eingaben eines Knotens bzw. einer Grundstückzufahrt (E2a Hindernisse, E2b Eingaben und Datei) ──
//
// Vorlage: fall.ts des fgsCheck. JSON mit App, Version, Ort (WGS84; Knoten bzw. Zufahrtspunkt in LV95), Quellenstand, Eingaben
// und beim Speichern einem Auszug des Ergebnisses (beim Laden neu gerechnet); Koordinaten in LV95 (m). Gespeichert und geladen
// als Datei («Fall speichern», «Fall laden») und im localStorage je Knoten bzw. Zufahrtspunkt (Zugriffe mit try/catch, die App
// läuft auch ohne). Kein Server.
// Inhalt: Zufahrt bzw. Zufahrtspunkt, Eingaben zur erforderlichen Sichtweite (E1: Strassentyp, Häkchen, Neigung) und zum Knoten
// (E2b: Vortrittsregelung, Haltelinie, D, Trottoir, Tempo je Richtung), Hindernisse (von Hand, bestätigte Vorschläge),
// verworfene Vorschläge und amtliche Parkfelder, Häkchen der Quellen (Baumkataster zugeschaltet, amtliche Parkfelder
// abgeschaltet). Version 1 (E2a, ohne Eingaben) wird weiter gelesen.
// Version 3 (E3a): Längsneigung je Richtung null = Vorgabe aus dem Höhenmodell (wird beim Laden neu geholt, nicht gespeichert), Zahl
// = von Hand; in Version 2 war 0 die Vorgabe und wird als Vorgabe gelesen. Dazu die abgehakten Bedingungen für einen Spiegel
// (Massnahmen nach Ziffer 14) und im Auszug des Ergebnisses die Neigung mit Quelle.
// Version 4 (E3b): Veloführung je Richtung (null = Vorgabe aus OSM) und «schnelle E-Bikes verboten»; im Auszug des Ergebnisses Velo,
// Trottoir und Gesamtstatus. Version 1 bis 3 werden weiter gelesen (ohne Velo-Eingaben: Vorgabe).
// Version 5 (E3c): Wahrnehmbarkeit des Knotens (null = Vorgabe «gut») und «alle Arme prüfen» beim Rechtsvortritt; im Auszug des
// Ergebnisses der Rechtsvortritt (Zustand nach Abb. 6, Paarmatrix). Version 1 bis 4 werden weiter gelesen.
// Version 6 (E4a): Bezeichnung des Falls (ort.bezeichnung, frei eingebbar im Bericht, höchstens BEZEICHNUNG_MAX Zeichen; zu lange
// werden gekürzt, ungültige übergangen und gemeldet). Version 1 bis 5 werden weiter gelesen (ohne Bezeichnung).
// Version 7 (K0): Trottoirüberfahrt über die Einmündung der Zufahrt (eingaben.trottoirueberfahrt: { breite } bzw. fehlt = kein Modus;
// Breite von Hand TUE_BREITE_MIN bis TUE_BREITE_MAX m oder null), Quelle «vsig» (signalisierte Höchstgeschwindigkeit Stadt Bern); im
// Auszug des Ergebnisses die Trottoirüberfahrt je Phase. Version 1 bis 6 werden weiter gelesen (ohne Trottoirüberfahrt).

import type { P } from './geo'
import type { Hindernis, ParkKlasse } from './rechner/hindernisse'
import { KEINE_ALLE_EINGABEN, REGELUNGEN, TEMPO_ARTEN, TEMPO_MIN, TEMPO_MAX, TUE_BREITE_MIN, TUE_BREITE_MAX, type Eingaben, type Regelung, type Richtung,
  type TempoArt, type TempoEingabe, type ZufahrtspunktEingabe, type Ergebnis } from './rechner/typen'
import { zufahrtspunktKey } from './rechner/grundstueck'
import { VELOFUEHRUNGEN, type Velofuehrung } from './rechner/velo'
import { WAHRNEHMBARKEITEN, type Wahrnehmbarkeit } from './rechner/rechtsvortritt'

export const FALL_VERSION = 7
/** Bezeichnung des Falls (Bericht): höchstens so lang */
export const BEZEICHNUNG_MAX = 200

/** Auszug des Ergebnisses (nur beim Speichern geschrieben, beim Laden neu gerechnet) */
export interface FallErgebnis {
  zufahrt: string
  regelung: string
  B: number
  nullpunkt: string
  D: P
  Dhand: boolean
  richtungen: { richtung: string; strasse: string; tempo: number; tempoQuelle: string; neigung: number; neigungQuelle: string
    massgebend: number; vorhanden: number; bisEnde: boolean; status: string; statusZusatz: string[]
    // E3b
    velo?: { fuehrung: string; A: number; text: string; vorhanden: number; status: string } | null
    trottoir?: { neigung: number; A: number; vorhanden: number; status: string } | null
    gesamt?: string; gesamtFehlt?: string[] }[]
  // E3c
  rechtsvortritt?: { wahrnehmbarkeit: string; arme: { arm: string; rechts: string; vorhanden: number; zustand: string | null; status: string
    schmal: boolean; paare: { sichtbar: number; gesamt: number; erste: { s1: number; s2: number } | null } | null }[] } | null
  // K0
  trottoirueberfahrt?: { breite: number; breiteQuelle: string; laenge: number; phaseTrottoir: string; phaseFahrbahn: string } | null
}

export interface Fall {
  app: 'SichtweitenCheck'
  version: number
  ort: { lat: number; lon: number; knoten: number | null; zufahrt: string | null; zufahrtspunkt?: ZufahrtspunktEingabe; bezeichnung?: string }
  quellen: { osm?: string; av?: string; parkkataster?: string; baumkataster?: string; hoehen?: string; vsig?: string; geladen?: string }
  eingaben: Eingaben                               // E1 und E2b, gelten für die Zufahrt (ort.zufahrt bzw. die vorgeschlagene)
  hindernisse: Hindernis[]
  vorschlaege: Record<string, 'verworfen'>         // verworfene Vorschläge (OSM, Baumkataster) und amtliche Parkfelder
  baumkataster: boolean                            // Bäume aus dem Baumkataster laden (Vorgabe: nein)
  parkkataster?: boolean                           // amtliche Parkfelder laden (Vorgabe: ja; false = abgeschaltet)
  spiegel?: string[]                               // Massnahme Spiegel: abgehakte Bedingungen (Schlüssel, E3a)
  gespeichert?: string
  ergebnis?: FallErgebnis
}

export function leererFall(lat: number, lon: number, knoten: number | null, zufahrtspunkt: ZufahrtspunktEingabe | null = null): Fall {
  return { app: 'SichtweitenCheck', version: FALL_VERSION,
    ort: { lat, lon, knoten: zufahrtspunkt ? null : knoten, zufahrt: null, ...(zufahrtspunkt ? { zufahrtspunkt } : {}) }, quellen: {},
    eingaben: structuredClone(KEINE_ALLE_EINGABEN), hindernisse: [], vorschlaege: {}, baumkataster: false }
}

/** Auszug des Ergebnisses für die Fall-Datei */
export function ergebnisAuszug(e: Ergebnis, regelungText: string): FallErgebnis {
  return { zufahrt: e.zufahrtName, regelung: regelungText, B: e.B, nullpunkt: e.nullpunktText, D: e.D, Dhand: e.Dhand,
    richtungen: e.richtungen.map(r => ({ richtung: r.richtung, strasse: r.strasse, tempo: r.tempo, tempoQuelle: r.tempoQuelle,
      neigung: r.neigung, neigungQuelle: r.neigungQuelle, massgebend: r.massgebend, vorhanden: Math.round(r.vorhanden * 10) / 10, bisEnde: r.bisEnde, status: r.status,
      statusZusatz: r.statusZusatz,
      velo: r.velo ? { fuehrung: r.velo.fuehrung, A: r.velo.A, text: r.velo.text, vorhanden: Math.round(r.velo.vorhanden * 10) / 10,
        status: r.velo.status } : null,
      trottoir: ((t) => (t ? { neigung: t.neigung, A: t.A, vorhanden: Math.round(t.vorhanden * 10) / 10, status: t.status } : null))(
        e.trottoirPruefung?.richtungen.find(t => t.richtung === r.richtung)),
      gesamt: r.gesamt, gesamtFehlt: r.gesamtFehlt })),
    rechtsvortritt: e.rechtsvortritt ? { wahrnehmbarkeit: e.rechtsvortritt.wahrnehmbarkeit,
      arme: (e.rechtsvortritt.alle ?? [e.rechtsvortritt.arm]).map(a => ({ arm: a.armName, rechts: a.rechtsName,
        vorhanden: Math.round(a.vorhanden * 10) / 10, zustand: a.zustand, status: a.status, schmal: a.schmal,
        paare: a.paare ? { sichtbar: a.paare.sichtbar, gesamt: a.paare.paare.length, erste: a.paare.erste ? { s1: a.paare.erste.s1,
          s2: a.paare.erste.s2 } : null } : null })) } : null,
    ...(e.trottoirueberfahrt ? { trottoirueberfahrt: { breite: Math.round(e.trottoirueberfahrt.breite * 100) / 100,
      breiteQuelle: e.trottoirueberfahrt.breiteQuelle, laenge: Math.round(e.trottoirueberfahrt.laenge * 100) / 100,
      phaseTrottoir: e.trottoirueberfahrt.phaseTrottoir.status, phaseFahrbahn: e.trottoirueberfahrt.phaseFahrbahn.status } } : {}) }
}

const zahl = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
/** echtes Objekt (kein Array, nicht null) */
const istObjekt = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const istP = (x: unknown): x is P => Array.isArray(x) && x.length === 2 && x.every(zahl)
const istPs = (x: unknown, min: number): x is P[] => Array.isArray(x) && x.length >= min && x.every(istP)
const KLASSEN: ParkKlasse[] = ['auto', 'velo', 'motorrad']
/** LV95 in der Schweiz (mit Rand) */
const istLv95 = (x: unknown): x is P => istP(x) && x[0] > 2400000 && x[0] < 2900000 && x[1] > 1000000 && x[1] < 1350000
/** Begründung eines Tempos von Hand: höchstens so lang */
export const BEGRUENDUNG_MAX = 500

/**
 * Eingaben (E1, E2b) prüfen: jedes Feld einzeln; ungültige Werte fallen auf die Vorgabe zurück und werden gemeldet, fehlende
 * Felder still (ältere Dateien). -> Eingaben
 */
export function eingabenPruefen(x: unknown, hinweise: string[], version = FALL_VERSION): Eingaben {
  const e: Eingaben = structuredClone(KEINE_ALLE_EINGABEN)
  if (x === undefined) return e
  if (!istObjekt(x)) { hinweise.push('Eingaben ungültig (kein Objekt), Vorgaben'); return e }
  const falsch = (k: string) => hinweise.push(`Eingabe «${k}» ungültig, Vorgabe`)
  const feld = <T>(k: string, ok: (v: unknown) => v is T, setzen: (v: T) => void) => {
    const v = x[k]
    if (v === undefined) return
    if (ok(v)) setzen(v); else falsch(k)
  }
  const oderNull = <T>(f: (v: unknown) => v is T) => (v: unknown): v is T | null => v === null || f(v)
  const bool = (v: unknown): v is boolean => typeof v === 'boolean'
  feld('typ', oderNull((v): v is 'es' | 'hvs' => v === 'es' || v === 'hvs'), v => { e.typ = v })
  feld('fahrstreifen', oderNull(bool), v => { e.fahrstreifen = v })
  feld('neigungGross', oderNull(bool), v => { e.neigungGross = v })
  feld('schwerverkehr', bool, v => { e.schwerverkehr = v })
  if (x.neigung !== undefined) {
    if (!istObjekt(x.neigung)) falsch('neigung')
    else for (const r of ['links', 'rechts'] as Richtung[]) {
      const v = x.neigung[r]
      if (v === undefined || v === null) continue
      // bis Version 2 war 0 die Vorgabe (heute: aus dem Höhenmodell)
      if (zahl(v) && Math.abs(v) <= 30) e.neigung[r] = version < 3 && v === 0 ? null : v; else falsch(`neigung.${r}`)
    }
  }
  feld('regelung', oderNull((v): v is Regelung => REGELUNGEN.includes(v as Regelung)), v => { e.regelung = v })
  feld('haltelinie', oderNull(istLv95), v => { e.haltelinie = v })
  feld('D', oderNull(istLv95), v => { e.D = v })
  feld('trottoirFrei', bool, v => { e.trottoirFrei = v })
  if (x.tempo !== undefined) {
    if (!istObjekt(x.tempo)) falsch('tempo')
    else for (const r of ['links', 'rechts'] as Richtung[]) {
      const v = x.tempo[r]
      if (v === undefined || v === null) continue
      const t = tempoPruefen(v)
      if (!t) { falsch(`tempo.${r}`); continue }
      e.tempo[r] = t
      const b = (v as Record<string, unknown>).begruendung
      if (b !== undefined && typeof b !== 'string') hinweise.push(`Eingabe «tempo.${r}.begruendung» ungültig, leer`)
      else if (typeof b === 'string' && b.length > BEGRUENDUNG_MAX) hinweise.push(`Eingabe «tempo.${r}.begruendung» auf ${BEGRUENDUNG_MAX} Zeichen gekürzt`)
    }
  }
  // E3b (Version 4): nur übernommen, wenn gesetzt (sonst Vorgabe)
  if (x.velo !== undefined) {
    if (!istObjekt(x.velo)) falsch('velo')
    else for (const r of ['links', 'rechts'] as Richtung[]) {
      const v = x.velo[r]
      if (v === undefined || v === null) continue
      if (VELOFUEHRUNGEN.includes(v as Velofuehrung)) e.velo = { links: null, rechts: null, ...e.velo, [r]: v as Velofuehrung }
      else falsch(`velo.${r}`)
    }
  }
  feld('ebikeVerboten', bool, v => { if (v) e.ebikeVerboten = true })
  // E3c (Version 5)
  feld('wahrnehmbarkeit', oderNull((v): v is Wahrnehmbarkeit => WAHRNEHMBARKEITEN.includes(v as Wahrnehmbarkeit)), v => { if (v) e.wahrnehmbarkeit = v })
  feld('alleArme', bool, v => { if (v) e.alleArme = true })
  // K0 (Version 7): Trottoirüberfahrt; ungültige Breite -> ohne Breite (Modus bleibt), gemeldet
  if (x.trottoirueberfahrt !== undefined && x.trottoirueberfahrt !== null) {
    const t = x.trottoirueberfahrt
    if (!istObjekt(t)) falsch('trottoirueberfahrt')
    else {
      const b = t.breite
      const ok = b === undefined || b === null || (zahl(b) && b >= TUE_BREITE_MIN && b <= TUE_BREITE_MAX)
      if (!ok) hinweise.push('Eingabe «trottoirueberfahrt.breite» ungültig, ohne Breite')
      e.trottoirueberfahrt = { breite: ok && zahl(b) ? b : null }
    }
  }
  return e
}

/** Tempo von Hand: Art, ganze Zahl im Bereich, Begründung (Text, gekürzt) -> TempoEingabe oder null */
export function tempoPruefen(v: unknown): TempoEingabe | null {
  if (!istObjekt(v) || !TEMPO_ARTEN.includes(v.art as TempoArt)) return null
  if (!zahl(v.wert) || !Number.isInteger(v.wert) || v.wert < TEMPO_MIN || v.wert > TEMPO_MAX) return null
  const b = typeof v.begruendung === 'string' ? v.begruendung.slice(0, BEGRUENDUNG_MAX) : ''
  return { art: v.art as TempoArt, wert: v.wert, begruendung: b }
}

/** Zufahrtspunkt prüfen: Punkt in LV95, Richtung (Vektor ungleich null) bzw. null -> Eingabe oder null */
export function zufahrtspunktPruefen(v: unknown): ZufahrtspunktEingabe | null {
  if (!istObjekt(v) || !istLv95(v.p)) return null
  const r = v.richtung
  if (r === null || r === undefined) return { p: v.p, richtung: null }
  if (!istP(r) || Math.hypot(r[0], r[1]) < 1e-6) return null
  const l = Math.hypot(r[0], r[1])
  return { p: v.p, richtung: [r[0] / l, r[1] / l] }
}

/** Hindernis prüfen (fgsCheck hindernisPruefen, dazu Zaun; ohne Insel) -> Hindernis oder null */
export function hindernisPruefen(h: unknown): Hindernis | null {
  if (!istObjekt(h)) return null
  const o = h
  if (typeof o.id !== 'string' || !o.id || typeof o.art !== 'string') return null
  const quelle = (['hand', 'osm', 'kataster'].includes(o.quelle as string) ? o.quelle : 'hand') as Hindernis['quelle']
  const name = typeof o.name === 'string' ? o.name : undefined
  const mitName = <T extends Hindernis>(x: T): T => (name === undefined ? x : { ...x, name })
  switch (o.art) {
    case 'parkfeld':
      return istPs(o.ring, 3) ? mitName({ id: o.id, art: 'parkfeld', klasse: KLASSEN.includes(o.klasse as ParkKlasse) ? o.klasse as ParkKlasse : 'auto',
        ring: o.ring, quelle }) : null
    case 'laengsparkierung':
      return istPs(o.linie, 2) ? mitName({ id: o.id, art: 'laengsparkierung', linie: o.linie,
        breite: zahl(o.breite) && o.breite > 0.5 && o.breite < 8 ? o.breite : 2.0, quelle }) : null
    case 'baum':
      return istP(o.p) ? mitName({ id: o.id, art: 'baum', p: o.p, stamm: zahl(o.stamm) && o.stamm > 0 && o.stamm < 5 ? o.stamm : 0.5, quelle }) : null
    case 'hecke': case 'mauer': case 'uebrige': {
      const linie = istPs(o.linie, 2) ? o.linie : undefined, ring = istPs(o.ring, 3) ? o.ring : undefined
      if (!linie && !ring) return null
      return mitName({ id: o.id, art: o.art, ...(linie ? { linie } : {}), ...(ring ? { ring } : {}), sichtbehindernd: o.sichtbehindernd !== false,
        quelle })
    }
    case 'zaun':
      return istPs(o.linie, 2) ? mitName({ id: o.id, art: 'zaun', linie: o.linie, dicht: o.dicht !== false, quelle }) : null
  }
  return null
}

/** Gebiet der App (Schweiz und Liechtenstein mit etwa 10 km Rand; fgsCheck) */
export const GEBIET = { latMin: 45.7, latMax: 47.9, lonMin: 5.8, lonMax: 10.6 }
export const imGebiet = (lat: number, lon: number): boolean =>
  lat >= GEBIET.latMin && lat <= GEBIET.latMax && lon >= GEBIET.lonMin && lon <= GEBIET.lonMax

const QUELLEN_SCHLUESSEL = ['osm', 'av', 'parkkataster', 'baumkataster', 'hoehen', 'vsig', 'geladen'] as const

/** Fall aus JSON lesen und prüfen -> [Fall, Hinweise]. Ausnahme nur bei fremder Datei, Version oder ungültigem Ort; ungültige
 * Listen bzw. Objekte und einzelne ungültige Einträge werden übergangen und gemeldet. Auch für den Browser-Speicher. */
export function fallLesen(text: string): [Fall, string[]] {
  const roh: unknown = JSON.parse(text)
  if (!istObjekt(roh) || roh.app !== 'SichtweitenCheck') throw new Error('keine Fall-Datei des SichtweitenCheck')
  if (!zahl(roh.version) || !Number.isInteger(roh.version) || roh.version < 1 || roh.version > FALL_VERSION) throw new Error(`Fall-Datei Version ${String(roh.version)} wird nicht unterstützt`)
  const o = roh.ort
  if (!istObjekt(o) || !zahl(o.lat) || !zahl(o.lon)) throw new Error('Ort fehlt in der Fall-Datei')
  if (Math.abs(o.lat) > 90 || Math.abs(o.lon) > 180) throw new Error(`Ort ungültig (lat ${o.lat}, lon ${o.lon}: keine WGS84-Koordinaten)`)
  if (!imGebiet(o.lat, o.lon)) throw new Error(`Ort ausserhalb der Schweiz bzw. Liechtensteins (lat ${o.lat}, lon ${o.lon})`)
  const hinweise: string[] = []
  const zp = o.zufahrtspunkt === undefined ? null : zufahrtspunktPruefen(o.zufahrtspunkt)
  if (o.zufahrtspunkt !== undefined && !zp) hinweise.push('Zufahrtspunkt ungültig, übergangen')
  const fall = leererFall(o.lat, o.lon, Number.isInteger(o.knoten) && (o.knoten as number) > 0 ? o.knoten as number : null, zp)
  if (typeof o.zufahrt === 'string' && !zp) fall.ort.zufahrt = o.zufahrt
  if (o.knoten !== undefined && o.knoten !== null && !(Number.isInteger(o.knoten) && (o.knoten as number) > 0)) hinweise.push('Knoten ungültig, übergangen')
  if (o.zufahrt !== undefined && o.zufahrt !== null && typeof o.zufahrt !== 'string') hinweise.push('Zufahrt ungültig, übergangen')
  if (typeof o.bezeichnung === 'string' && o.bezeichnung.trim()) {
    fall.ort.bezeichnung = o.bezeichnung.slice(0, BEZEICHNUNG_MAX)
    if (o.bezeichnung.length > BEZEICHNUNG_MAX) hinweise.push(`Bezeichnung auf ${BEZEICHNUNG_MAX} Zeichen gekürzt`)
  } else if (o.bezeichnung !== undefined && typeof o.bezeichnung !== 'string') hinweise.push('Bezeichnung ungültig, übergangen')
  const liste = (k: string, name: string): unknown[] => {
    const x = roh[k]
    if (x === undefined) return []
    if (Array.isArray(x)) return x
    hinweise.push(`${name} ungültig (keine Liste), übergangen`); return []
  }
  const objekt = (k: string, name: string): [string, unknown][] => {
    const x = roh[k]
    if (x === undefined) return []
    // «__proto__» u. ä. nie als Schlüssel übernehmen (würde den Prototyp des Ziel-Objekts ersetzen)
    if (istObjekt(x)) return Object.entries(x).filter(([s]) => !['__proto__', 'constructor', 'prototype'].includes(s))
    hinweise.push(`${name} ungültig (kein Objekt), übergangen`); return []
  }
  for (const [k, v] of objekt('quellen', 'Quellen')) {
    if ((QUELLEN_SCHLUESSEL as readonly string[]).includes(k) && typeof v === 'string') fall.quellen[k as typeof QUELLEN_SCHLUESSEL[number]] = v
    else if ((QUELLEN_SCHLUESSEL as readonly string[]).includes(k)) hinweise.push(`Quelle «${k}» ungültig, übergangen`)
  }
  fall.eingaben = eingabenPruefen(roh.eingaben, hinweise, roh.version)
  for (const h of liste('hindernisse', 'Hindernisse')) {
    const x = hindernisPruefen(h)
    if (!x) { hinweise.push('Hindernis ungültig, übergangen'); continue }
    if (fall.hindernisse.some(y => y.id === x.id)) { hinweise.push(`Hindernis ${x.id} doppelt, übergangen`); continue }
    fall.hindernisse.push(x)
  }
  for (const [k, v] of objekt('vorschlaege', 'Vorschläge')) {
    if (v === 'verworfen') fall.vorschlaege[k] = 'verworfen'
    else hinweise.push(`Vorschlag ${k} ungültig, übergangen`)
  }
  fall.baumkataster = roh.baumkataster === true
  if (roh.parkkataster === false) fall.parkkataster = false
  if (Array.isArray(roh.spiegel)) fall.spiegel = [...new Set(roh.spiegel.filter((x): x is string => typeof x === 'string' && x.length <= 20))]
  else if (roh.spiegel !== undefined) hinweise.push('Spiegel-Bedingungen ungültig (keine Liste), übergangen')
  if (typeof roh.gespeichert === 'string') fall.gespeichert = roh.gespeichert
  return [fall, hinweise]
}

/** Fall als JSON (mit Zeitpunkt; ergebnis: Auszug, nur in der Datei) */
export function fallSchreiben(fall: Fall, ergebnis: FallErgebnis | null = null): string {
  const { ergebnis: _alt, ...rest } = fall
  return JSON.stringify({ ...rest, gespeichert: new Date().toISOString(), ...(ergebnis ? { ergebnis } : {}) }, null, 1)
}

/** Anzahl gesetzter Eingaben E1/E2b (abweichend von der Vorgabe) */
export function eingabenGesetzt(e: Eingaben): number {
  const v = KEINE_ALLE_EINGABEN
  return [e.typ !== v.typ, e.fahrstreifen !== v.fahrstreifen, e.neigungGross !== v.neigungGross, e.schwerverkehr !== v.schwerverkehr,
    e.neigung.links !== null, e.neigung.rechts !== null, e.regelung !== null, e.haltelinie !== null, e.D !== null, e.trottoirFrei,
    e.tempo.links !== null, e.tempo.rechts !== null, (e.velo?.links ?? null) !== null, (e.velo?.rechts ?? null) !== null,
    !!e.ebikeVerboten, (e.wahrnehmbarkeit ?? null) !== null, !!e.alleArme, !!e.trottoirueberfahrt,
    (e.trottoirueberfahrt?.breite ?? null) !== null].filter(x => x).length
}

/** Anzahl Eingaben (E1/E2b, Hindernisse, verworfene Vorschläge bzw. Parkfelder, Baumkataster zugeschaltet, Parkfelder abgeschaltet) */
export function eingabenZahl(f: Fall): number {
  return eingabenGesetzt(f.eingaben) + f.hindernisse.length + Object.keys(f.vorschlaege).length + (f.baumkataster ? 1 : 0) +
    (f.parkkataster === false ? 1 : 0) + (f.spiegel?.length ?? 0)
}
/** etwas zu merken: Eingaben, gewählte Zufahrt, gezeichnete Richtung einer Grundstückzufahrt oder Bezeichnung (ein Zufahrtspunkt
 *  allein nicht: ihn hält die Adresse) */
export const hatEingaben = (f: Fall): boolean => eingabenZahl(f) > 0 || f.ort.zufahrt !== null || !!f.ort.zufahrtspunkt?.richtung ||
  !!f.ort.bezeichnung?.trim()

// ---------------------------------------------------------------- localStorage (nur Bequemlichkeit, darf fehlen)
const SPEICHER = 'SichtweitenCheck.fall.'
/** Schlüssel im Browser: «SichtweitenCheck.fall.<Knoten>» bzw. «SichtweitenCheck.fall.z<E>,<N>» (Zufahrtspunkt) */
export const speicherKey = (f: Fall): string | null =>
  f.ort.zufahrtspunkt ? `${SPEICHER}z${zufahrtspunktKey(f.ort.zufahrtspunkt.p)}` : f.ort.knoten !== null ? SPEICHER + f.ort.knoten : null
/** Fall im Browser merken; ohne Eingaben wird ein vorhandener Eintrag entfernt */
export function fallMerken(fall: Fall): void {
  const key = speicherKey(fall)
  if (key === null) return
  try {
    if (hatEingaben(fall)) localStorage.setItem(key, fallSchreiben(fall))
    else localStorage.removeItem(key)
  } catch { /* ohne Speicher */ }
}
/** gemerkten Fall des Knotens lesen (null: keiner, ungültig oder kein Speicher) */
export function fallErinnern(knoten: number): Fall | null {
  try {
    const t = localStorage.getItem(SPEICHER + knoten)
    if (!t) return null
    const f = fallLesen(t)[0]
    return f.ort.knoten === knoten && !f.ort.zufahrtspunkt ? f : null
  } catch { return null }
}
/** gemerkten Fall eines Zufahrtspunkts lesen (Schlüssel auf 0,1 m) */
export function fallErinnernZufahrt(p: P): Fall | null {
  try {
    const t = localStorage.getItem(`${SPEICHER}z${zufahrtspunktKey(p)}`)
    if (!t) return null
    const f = fallLesen(t)[0]
    return f.ort.zufahrtspunkt && zufahrtspunktKey(f.ort.zufahrtspunkt.p) === zufahrtspunktKey(p) ? f : null
  } catch { return null }
}
