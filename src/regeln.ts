// ── Regeln des SichtweitenCheck (Korrektur 31.10.2026, Punkt 9c; Muster fgsCheck bedarf/regeluebersicht.ts und bedarf/quellen.ts) ──
//
// Katalog aller Regeln, die die App anwendet: was geprüft wird (eigene Worte, Alltagssprache für Planerinnen und Planer ohne
// Code-Kenntnis), Werk, Fundstelle (Ziffer UND gedruckte Seite), Wert (falls es einen gibt), Datenquelle in Worten (falls nötig),
// Herkunft und Wirkung. Grundlage: Sichtprüfungsliste Sichtpruefung_beide_Rechner_2026-10-30.csv (Zeilen «SichtweitenCheck» und
// «beide»), nachgeführt auf den Code-Stand vom 31.10.2026. Überarbeitung 31.10.2026 (Nutzer): «art» ersetzt durch «herkunft» (am Werk,
// damit sie nicht je Regel falsch gesetzt werden kann) und «wirkung» (fliesst in die Rechnung ein bzw. nur Hinweis, je Regel nach dem
// Code); Texte ohne Code-Wörter, Wert und Daten nur, wo es sie gibt. Lizenzierte Normen (VSS) und die bfu-Fachdokumentation: keine
// Sätze aus dem Werk, nur Ziffern, Seiten, Tabellen- und Abbildungsnummern, Zahlenwerte. Die App zeigt keine Normtabellen.
//
// Werke in Normreihenfolge, nach Herkunft gegliedert (Anzeige «nach Quelle»): Normen (VSS 40 273 Ziffer für Ziffer, 40 090b, 40 242,
// 40 213, 40 040b), Fachempfehlung (bfu), Recht (SSV, SVG, VRV), kantonale Praxis (SO, BE, LU, BS), Annahmen der App, Projektentscheide.
// gilt: ob die Regel im Fall angewendet ist (Bericht); ohne gilt gilt sie in jedem Fall.

import type { Ergebnis } from './rechner/typen'
import { TAB1_MIN, TAB1_MAX, NEIGUNG_GROSS_PROZENT, SCHWERVERKEHR_PROZENT, NEIGUNG_EBEN_PROZENT, ZIEL_FAKTOR } from './rechner/sichtweite'
import { B_INNERORTS_M, B_AUSSERORTS_M, FAHRERSITZ_M } from './rechner/beobachtung'
import { D_MFZ_M, VERLAENGERUNG_M, PARK_EIN_FELD_TREFFER, PARK_SONDE_RADIUS_M, BREITE_ANNAHME_M } from './rechner/hauptachsen'
import { PARKSTREIFEN, PARK_SONDE_M, PARK_MIN_TREFFER, LAGE_ERSATZ } from './rechner/fahrstreifen'
import { D_VELO_M, RADSTREIFEN_M, RADWEG_BREITE_M, RADWEG_NAH_M, TAB3_GRENZE, KURVE_GRAD } from './rechner/velo'
import { RV_TEMPO, RV_B_M, RV_A_M, RV_A_MIN_M, SCHMAL_M, ENG_LAENGE_M, ENG_SCHRITT_M, RECHTS_MIN_GRAD, ABB6_GRENZEN, RV_ZIEL_M } from './rechner/rechtsvortritt'
import { PALISADE_MIN_M } from './rechner/sicht'
import { BAUM_STAMM_M, LINIE_PUFFER_M, LAENGS_BREITE_M } from './rechner/hindernisse'
import { TUE_GEHLINIE_M, TUE_BREITE_ANNAHME_M, TUE_BREITE_Z16 } from './rechner/trottoirueberfahrt'
import { HALTELINIE_SCHRITT_M, HALTELINIE_MIN_M, SPIEGEL_ABSTAND_M, SPIEGEL_TEMPO_MAX } from './rechner/massnahmen'
import { PROFIL_MIN_M, ZUFAHRT_STEIL_PROZENT } from './rechner/neigung'
import { ANHALTESICHT_I_MIN } from './rechner/anhaltesicht'
import { TEMPO_ERSATZ } from './rechner/tempo'
import { GEGENUEBER_GRAD } from './rechner/lage'
import { TEILUNG_WINKEL_GRAD, TEILUNG_KREISEL_M } from './rechner/knoten'
import { PW_LAENGE_M, PW_BREITE_M, LENKER_VOR_FRONT_M, VELO_LAENGE_M, VELO_BREITE_M } from './rechner/fahrzeug'
import { EINBIEGEWINKEL_GRENZE_GRAD, HALTELINIE_SEITLICH_M, HALTELINIE_VOR_M, HALTELINIE_HINTER_M, D_HAND_WEIT_M } from './rechner/rechnen'

const m = (x: number, d = 2) => x.toFixed(d).replace('.', ',')
/** Neigung mit echtem Minuszeichen, z. B. «−12 %» */
const proz = (x: number) => `${x < 0 ? '−' : ''}${String(Math.abs(x)).replace('.', ',')} %`

// ── Herkunft und Wirkung ──

/** woher eine Regel stammt; folgt aus dem Werk (Werk.herkunft) */
export type Herkunft = 'Recht' | 'Norm' | 'Fachempfehlung' | 'Kantonale Praxis' | 'Annahme der App' | 'Projektentscheid'
/** Herkunft in der Reihenfolge der Anzeige (wie die Werke) */
export const HERKUNFT: readonly Herkunft[] = ['Norm', 'Fachempfehlung', 'Recht', 'Kantonale Praxis', 'Annahme der App', 'Projektentscheid']
/** was die Regel bewirkt: «rechnet mit» = bestimmt einen Wert, Status oder eine Lage in der Rechnung; «nur Hinweis» = die App zeigt
 *  nur einen Hinweis, das Ergebnis ändert sich nicht */
export type Wirkung = 'rechnet mit' | 'nur Hinweis'
/** Beschriftung der Wirkung in Anzeige und Bericht */
export const WIRKUNG_TEXT: Record<Wirkung, string> = { 'rechnet mit': 'fliesst in die Rechnung ein', 'nur Hinweis': 'nur Hinweis' }

// ── Werke ──

export type WerkId = '40273' | '40090' | '40242' | '40213' | '40040' | 'BFU' | 'SO' | 'SSV' | 'SVG' | 'VRV' | 'TBA_BE' | 'VIF_LU' | 'BS_SSV' |
  'ANNAHME' | 'ENTSCHEID'

export interface Werk {
  /** Kurzname in Tabelle und Fundstellen */
  name: string
  /** Titel bzw. voller Name */
  titel: string
  ausgabe: string
  /** Herkunft aller Regeln dieses Werks */
  herkunft: Herkunft
  /** eigene Beschreibung, ein bis zwei Sätze */
  beschreibung: string
  /** Seite des Herausgebers (nur, wo sicher bekannt) */
  link: string | null
  /** Vermerk zum Bezug, z. B. «kostenpflichtig» */
  bezug: string | null
}

export const WERKE: Record<WerkId, Werk> = {
  '40273': { name: 'VSS 40 273', titel: 'Knoten; Sichtverhältnisse in Knoten', ausgabe: 'VSS 40 273:2024', herkunft: 'Norm',
    link: null, bezug: 'kostenpflichtig', beschreibung: 'Schweizer Norm für die Sicht an Knoten und Grundstückzufahrten: wo der wartende ' +
      'Lenker sitzt, wie weit er sehen muss und was bei zu wenig Sicht hilft. Grundlage fast aller Prüfungen der App.' },
  '40090': { name: 'VSS 40 090b', titel: 'Projektierung, Grundlagen; Sichtweiten', ausgabe: 'VSS 40 090b:2019-03', herkunft: 'Norm',
    link: null, bezug: 'kostenpflichtig', beschreibung: 'Norm zu den Sichtweiten im Strassenentwurf. Die App nutzt daraus die ' +
      'Anhaltesichtweite bei Gefälle und Steigung.' },
  '40242': { name: 'VSS 40 242', titel: 'Querungen für den Langsamverkehr; Trottoirüberfahrten', ausgabe: 'VSS 40 242:2019', 
    herkunft: 'Norm', link: null, bezug: 'kostenpflichtig', beschreibung: 'Norm für Trottoirüberfahrten. Die App nutzt sie, wenn das ' +
      'Häkchen «Trottoirüberfahrt» gesetzt ist: Vortritt, Sicht in zwei Schritten, Breite und kurze Hinweise.' },
  '40213': { name: 'VSS 40 213', titel: 'Entwurf des Strassenraumes; Verkehrsberuhigungselemente', ausgabe: 'VSS 40 213:2019', 
    herkunft: 'Norm', link: null, bezug: 'kostenpflichtig', beschreibung: 'Norm für bauliche Elemente, die den Verkehr verlangsamen. Die ' +
      'App nennt sie nur als Vermerk bei den Massnahmen.' },
  '40040': { name: 'VSS 40 040b', titel: 'Projektierung, Grundlagen; Strassentypen', ausgabe: 'VSS 40 040b:2019-03', herkunft: 'Norm',
    link: null, bezug: 'kostenpflichtig', beschreibung: 'Norm, die Strassen nach ihrer Aufgabe im Netz in Typen einteilt. Daraus stammen ' +
      'die Strassentypen, nach denen die App die nötige Sicht wählt.' },
  BFU: { name: 'bfu BM.021', titel: 'bfu-Fachdokumentation «Sicht an Verzweigungen und Grundstückzufahrten»', ausgabe: 'bfu 2.443.01-2022/BM.021',
    herkunft: 'Fachempfehlung', link: 'https://www.bfu.ch/de/ratgeber/empfehlungen-strasseninfrastruktur-signalisation',
    bezug: null, beschreibung: 'Fachdokumentation der Beratungsstelle für Unfallverhütung zur Sicht an Einmündungen und Ausfahrten. Die App ' +
      'nutzt daraus die Konstruktion für enge Kreuzungen und einige Vergleichswerte.' },
  SO: { name: 'Kanton Solothurn AVT', titel: 'Richtlinien Strassenverkehrsanlagen «Sichtverhältnisse in Knoten und Grundstückzufahrten»',
    ausgabe: 'Ausgabe Dezember 2024', herkunft: 'Kantonale Praxis', bezug: null,
    link: 'https://so.ch/fileadmin/internet/bjd/bjd-avt/pdf/Downloads/Weisungen_und_Arbeitshilfen/Sichtverhaeltnisse_in_Knoten_und_Grundstueckzufahrten.pdf',
    beschreibung: 'Richtlinie des Amts für Verkehr und Tiefbau des Kantons Solothurn. Die App übernimmt daraus die Masse für ungünstige ' +
      'Verhältnisse, die in der VSS-Norm fehlen.' },
  SSV: { name: 'SSV', titel: 'Signalisationsverordnung', ausgabe: 'SR 741.21, geltende Fassung', herkunft: 'Recht',
    link: 'https://www.fedlex.admin.ch/eli/cc/1979/1961_1961_1961/de', bezug: null,
    beschreibung: 'Bundesverordnung über Signale und Markierungen. Die App nutzt daraus die Regeln zu Stop und Kein Vortritt und zur ' +
      'Halte- und Wartelinie.' },
  SVG: { name: 'SVG', titel: 'Strassenverkehrsgesetz', ausgabe: 'SR 741.01, geltende Fassung', herkunft: 'Recht',
    link: 'https://www.fedlex.admin.ch/eli/cc/1959/679_705_685/de', bezug: null,
    beschreibung: 'Bundesgesetz über den Strassenverkehr. Die App nutzt daraus den Rechtsvortritt ohne Signal und den Hinweis zu ' +
      'Hindernissen auf Privatgrund.' },
  VRV: { name: 'VRV', titel: 'Verkehrsregelnverordnung', ausgabe: 'SR 741.11, geltende Fassung', herkunft: 'Recht',
    link: 'https://www.fedlex.admin.ch/eli/cc/1962/1364_1409_1420/de', bezug: null,
    beschreibung: 'Bundesverordnung mit den Verkehrsregeln. Die App nutzt daraus, dass aus einer Ausfahrt oder über ein Trottoir kein ' +
      'Rechtsvortritt gilt.' },
  TBA_BE: { name: 'TBA Bern', titel: 'Kanton Bern, Tiefbauamt: Arbeitshilfe Vortritt', ausgabe: '1.2.2024', 
    herkunft: 'Kantonale Praxis',
    link: 'https://www.bvd.be.ch/content/dam/bvd/dokumente/de/tba/strassen/sm-signalisation-markierung/sm-ah-vortritt.pdf', bezug: null,
    beschreibung: 'Arbeitshilfe des Kantons Bern zur Wahl der Vortrittsregelung. ' +
      'Die App nutzt daraus, dass ein Stop nur nötig ist, wo die Sicht nicht reicht.' },
  VIF_LU: { name: 'vif Luzern', titel: 'Kanton Luzern, Verkehr und Infrastruktur (vif): Richtlinie 653.105', ausgabe: '653.105, 11/2018',
    herkunft: 'Kantonale Praxis', bezug: null,
    link: 'https://vif.lu.ch/-/media/VIF/Dokumente/download/fachordner/Verkehrsmassnahmen/653_Richtlinien_Verkehrsmassnahmen/653_105_Richtlinie_Vortritt.pdf',
    beschreibung: 'Richtlinie des Kantons Luzern zur ' +
      'Signalisation des Vortritts. Die App nutzt daraus, dass ein Stop nur nötig ist, wo die Sicht nicht reicht.' },
  BS_SSV: { name: 'Basel-Stadt AB-SSV', titel: 'Kanton Basel-Stadt, Bau- und Verkehrsdepartement, Mobilität: Ausführungsbestimmungen zur ' +
    'Signalisationsverordnung, Teil 1: Signale', ausgabe: '1.1.2023',
    herkunft: 'Kantonale Praxis', bezug: null,
    link: 'https://media.bs.ch/original_file/d6ef819a6cbd0b11365615191f35abefb79d5750/2023-01-signale.pdf', beschreibung: 'Kantonale ' +
      'Ausführungsbestimmungen zur Signalisationsverordnung. Die App nutzt daraus, dass ein Stop nur nötig ist, wo die Sicht für ' +
      '«Kein Vortritt» nicht reicht.' },
  ANNAHME: { name: 'Annahmen der App', titel: 'SichtweitenCheck: Annahmen', ausgabe: '2026-10', 
    herkunft: 'Annahme der App', link: null, bezug: null, beschreibung: 'Wo die Werke kein Mass nennen oder die Daten es nicht hergeben, ' +
      'rechnet die App mit eigenen Annahmen. Sie sind in der Anzeige als Annahme gekennzeichnet.' },
  ENTSCHEID: { name: 'Projektentscheide', titel: 'SichtweitenCheck: Projektentscheide', ausgabe: '2026-10', 
    herkunft: 'Projektentscheid', link: null, bezug: null, beschreibung: 'Festlegungen des Projekts, wo ein Werk einen Spielraum lässt, ' +
      'mit Datum des Entscheids.' },
}
/** Werke in Normreihenfolge, nach Herkunft gegliedert (Reihenfolge von HERKUNFT) */
export const WERK_IDS: readonly WerkId[] = ['40273', '40090', '40242', '40213', '40040', 'BFU', 'SSV', 'SVG', 'VRV', 'SO', 'TBA_BE', 'VIF_LU',
  'BS_SSV', 'ANNAHME', 'ENTSCHEID']
/** Werke, die eine Seitenangabe brauchen (lizenzierte Normen, bfu, Solothurn) */
export const MIT_SEITE: readonly WerkId[] = ['40273', '40090', '40242', '40213', '40040', 'BFU', 'SO']

// ── Regeln ──

export type RegelThema = 'knoten' | 'wartend' | 'motorfahrzeuge' | 'neigung' | 'velo' | 'trottoir' | 'rechtsvortritt' | 'hindernisse' |
  'massnahmen' | 'darstellung'
export const THEMEN: readonly [RegelThema, string][] = [
  ['knoten', 'Knoten und Vortritt'], ['wartend', 'Wartendes Fahrzeug (B und D)'], ['motorfahrzeuge', 'Verkehr mit Vortritt und nötige Sicht'],
  ['neigung', 'Längsneigung'], ['velo', 'Veloverkehr'], ['trottoir', 'Trottoir und Trottoirüberfahrt'], ['rechtsvortritt', 'Rechtsvortritt'],
  ['hindernisse', 'Hindernisse'], ['massnahmen', 'Massnahmen'], ['darstellung', 'Darstellung'],
]

/** eine Regel, wie sie im Katalog steht (ohne Herkunft: die folgt aus dem Werk) */
interface RegelEintrag {
  id: string
  /** kurz und verständlich */
  titel: string
  /** was die App tut und warum, Alltagssprache, ein bis zwei kurze Sätze */
  prueft: string
  werk: WerkId
  /** Ziffer, Tabelle bzw. Abbildung UND gedruckte Seite; bei Gesetzen der Artikel */
  fundstelle: string
  /** Reihenfolge innerhalb des Werks (Ziffer als Zahl, z. B. 13.1 -> 13.1) */
  ordnung: number
  /** konkreter Wert, Schwelle oder Grenze mit Einheit; fehlt, wo es keinen gibt */
  werte?: string
  /** woher die Angabe kommt, in Worten; fehlt, wo keine Daten nötig sind */
  daten?: string
  wirkung: Wirkung
  thema: RegelThema
  /** im Fall angewendet (Bericht); ohne: immer */
  gilt?: (e: Ergebnis) => boolean
}
export interface Regel extends RegelEintrag {
  /** aus dem Werk (WERKE[werk].herkunft) */
  herkunft: Herkunft
}

const rv = (e: Ergebnis) => !!e.rechtsvortritt
const nichtRv = (e: Ergebnis) => !e.rechtsvortritt
const tue = (e: Ergebnis) => !!e.trottoirueberfahrt
const mitVelo = (e: Ergebnis) => e.richtungen.some(r => !!r.velo)
const mitTrottoir = (e: Ergebnis) => !!e.trottoirPruefung
const mitAuto = (e: Ergebnis) => e.richtungen.some(r => r.status !== 'keine_zufahrt')
const hinweis = (e: Ergebnis, t: string) => e.hinweise.some(h => h.includes(t)) ||
  e.richtungen.some(r => [...r.hinweise, ...(r.velo?.hinweise ?? [])].some(h => h.includes(t)))

/** Kein Vortritt statt Stop: Prüfsatz der kantonalen Praxis (Muster vom Nutzer freigegeben, 31.10.2026) */
const STATT_STOP = 'Reicht die Sicht in alle Richtungen, meldet die App, dass «Kein Vortritt» genügt und ein Stop nicht nötig ist.'
const stattStop = (e: Ergebnis) => hinweis(e, 'Kein Vortritt statt Stop')

const EINTRAEGE: readonly RegelEintrag[] = [
  // ── VSS 40 273, Ziffer für Ziffer ──
  { id: 'V273-1a', werk: '40273', ordnung: 1, fundstelle: 'Ziffer 1, S. 4', titel: 'Kreisel: keine Prüfung', wirkung: 'rechnet mit',
    thema: 'knoten', gilt: () => false,
    prueft: 'Für Kreisel gilt die Norm nicht, darum rechnet die App dort nicht. Sie bietet solche Punkte nicht als Knoten an und meldet es, ' +
      'wenn einer geladen wird.',
    daten: 'OpenStreetMap (Kreisel; junction=roundabout bzw. circular)' },
  { id: 'V273-1b', werk: '40273', ordnung: 1.1, fundstelle: 'Ziffer 1, S. 4', titel: 'Zufahrt auf der durchgehenden Strasse',
    wirkung: 'nur Hinweis', thema: 'knoten', gilt: e => hinweis(e, 'durchgehenden Strasse'),
    prueft: 'Liegt die gewählte Zufahrt auf der durchgehenden Strasse, braucht es die Sicht zum Gegenverkehr nur fürs Linksabbiegen. Die ' +
      'App rechnet diese Richtung trotzdem und weist darauf hin.',
    werte: `gegenüber: ein Arm höchstens ${GEGENUEBER_GRAD}° neben geradeaus (Annahme)`, daten: 'OpenStreetMap (Lage der Strassen)' },
  { id: 'V273-4', werk: '40273', ordnung: 4, fundstelle: 'Ziffer 4, S. 4', titel: 'Kreuzungspunkt K', wirkung: 'rechnet mit',
    thema: 'motorfahrzeuge', gilt: mitAuto,
    prueft: 'K ist der Punkt, an dem sich die Fahrlinie der Zufahrt und die Fahrlinie des Verkehrs mit Vortritt kreuzen. Ab K misst die ' +
      'App die Sichtweite.',
    werte: `Fahrlinien über den Knoten hinaus um ${VERLAENGERUNG_M} m verlängert (Annahme)`,
    daten: 'amtliche Vermessung (Fahrbahn), OpenStreetMap (Strassen)' },
  { id: 'V273-5', werk: '40273', ordnung: 5, fundstelle: 'Ziffer 5, S. 4', titel: 'Halte- oder Wartelinie als Ausgangspunkt',
    wirkung: 'rechnet mit', thema: 'wartend', gilt: e => !!e.haltelinie,
    prueft: 'Ist eine Halte- oder Wartelinie gesetzt, misst die App die Beobachtungsdistanz B ab ihrer Vorderkante statt ab dem Rand der ' +
      'Strasse mit Vortritt.',
    werte: `Klick höchstens ${HALTELINIE_SEITLICH_M} m neben der Fahrlinie der Zufahrt, von ${HALTELINIE_VOR_M} m vor bis ` +
      `${HALTELINIE_HINTER_M} m hinter dem Rand (Annahme)`,
    daten: 'Dein Klick auf der Karte' },
  { id: 'V273-6', werk: '40273', ordnung: 6, fundstelle: 'Ziffer 6, S. 4; Abb. 1, S. 5', titel: 'Überholfall ausserorts',
    wirkung: 'rechnet mit', thema: 'motorfahrzeuge', gilt: e => !!e.ueberholen?.geprueft,
    prueft: 'Ausserorts, wo Überholen erlaubt ist, prüft die App zusätzlich die Sicht auf ein Fahrzeug, das auf der Gegenfahrbahn ' +
      'überholt. Es gilt dieselbe nötige Sichtweite.',
    werte: `überholendes Fahrzeug ${m(D_MFZ_M)} m vom linken Fahrbahnrand; nicht auf Einbahnen`,
    daten: 'OpenStreetMap (Tempo, Überholverbot; overtaking), deine Wahl im Panel' },
  { id: 'V273-7', werk: '40273', ordnung: 7, fundstelle: 'Ziffern 6 und 7, S. 4; Ziffer 11, S. 7', titel: 'Vorhandene Sichtweite',
    wirkung: 'rechnet mit', thema: 'motorfahrzeuge',
    prueft: 'Vom Auge D aus prüft die App Sichtlinien zu Punkten auf der Fahrlinie mit Vortritt, Meter für Meter ab K. Die vorhandene ' +
      'Sichtweite reicht bis zum letzten Punkt, bis zu dem alle Sichtlinien frei sind.',
    werte: `Punkte alle 1 m ab K bis zum ${m(ZIEL_FAKTOR, 1)}-Fachen des oberen Werts`,
    daten: 'amtliche Vermessung (Gebäude), deine Hindernisse und die Parkfelder' },
  { id: 'V273-8', werk: '40273', ordnung: 8, fundstelle: 'Ziffer 8, S. 4; Ziffer 11 und Abb. 3, S. 7', titel: 'Bäume als Palisade',
    wirkung: 'rechnet mit', thema: 'hindernisse', gilt: e => e.richtungen.some(r => !!r.palisade),
    prueft: 'Einzelne Bäume verdecken kaum. Mehrere Bäume zählen erst als Verdeckung, wenn ihre Stämme innerhalb der nötigen Sicht eine ' +
      'zusammenhängende Strecke von einer Fahrzeuglänge verdecken.',
    werte: `Stamm ${m(BAUM_STAMM_M, 1)} m; Verdeckung ab ${m(PALISADE_MIN_M, 1)} m am Stück (Projektentscheid)`,
    daten: 'Deine Eingabe (Bäume), Baumkataster Stadt Bern' },
  { id: 'V273-10a', werk: '40273', ordnung: 10, fundstelle: 'Ziffer 10, S. 6–7', titel: 'Fahrlinie des Verkehrs mit Vortritt',
    wirkung: 'rechnet mit', thema: 'motorfahrzeuge', gilt: mitAuto,
    prueft: 'Fahrzeuge mit Vortritt fahren mit der Wagenmitte in festem Abstand zum rechten Fahrbahnrand. Wird am Rand parkiert oder ' +
      'liegt dort ein Radstreifen, rückt die Linie entsprechend zur Strassenmitte.',
    werte: `${m(D_MFZ_M)} m vom rechten Fahrbahnrand; mit Parkierung ${m(PARKSTREIFEN)} m weiter innen; neben einem Radstreifen ` +
      `${m(D_MFZ_M)} m neben diesem`,
    daten: 'amtliche Vermessung (Fahrbahn), Parkfelder' },
  { id: 'V273-10b', werk: '40273', ordnung: 10.1, fundstelle: 'Ziffer 10, S. 7', titel: 'Fahrlinie der Velos', wirkung: 'rechnet mit',
    thema: 'velo', gilt: mitVelo,
    prueft: 'Velos fahren im Mischverkehr nahe am rechten Rand, auf einem Radstreifen und auf einem Radweg in dessen Mitte.',
    werte: `Mischverkehr ${m(D_VELO_M)} m vom Rand; Radstreifen ${m(RADSTREIFEN_M)} m breit angenommen`,
    daten: 'amtliche Vermessung (Fahrbahn), OpenStreetMap (Veloführung) bzw. deine Wahl im Panel' },
  { id: 'V273-10c', werk: '40273', ordnung: 10.2, fundstelle: 'Ziffer 10, S. 7', titel: 'Höhe des Sichtraums', wirkung: 'nur Hinweis',
    thema: 'hindernisse',
    prueft: 'Die App rechnet im Grundriss und prüft die Höhe nicht. Ob eine Hecke, Mauer oder ein Zaun in den Sichtraum reicht, legst du ' +
      'beim Hindernis fest.',
    werte: 'Sichtraum 0,60 bis 3,00 m hoch',
    daten: 'Deine Angabe beim Hindernis («sichtbehindernd» bzw. «dicht»)' },
  { id: 'V273-10d', werk: '40273', ordnung: 10.3, fundstelle: 'Ziffer 10, S. 7', titel: 'Massgebendes Tempo', wirkung: 'rechnet mit',
    thema: 'motorfahrzeuge', gilt: nichtRv,
    prueft: 'Massgebend ist das Tempo der Fahrzeuge mit Vortritt. Die App nimmt das signalisierte Tempo; von Hand kannst du auch das ' +
      'Projektierungstempo, V85 oder das fahrbare Tempo eingeben.',
    werte: `ohne Angabe ${TEMPO_ERSATZ} km/h (Annahme)`,
    daten: 'OpenStreetMap (Tempo), in der Stadt Bern das Geoportal (signalisiertes Tempo), deine Eingabe im Panel' },
  { id: 'V273-10e', werk: '40273', ordnung: 10.4, fundstelle: 'Ziffer 10, S. 7', titel: 'Schräge Einmündung', wirkung: 'nur Hinweis',
    thema: 'knoten', gilt: e => hinweis(e, 'deutlich von 90°'),
    prueft: 'Mündet die Zufahrt sehr schräg ein, weist die App darauf hin. Das Ergebnis ändert sich nicht.',
    werte: `Hinweis unter ${EINBIEGEWINKEL_GRENZE_GRAD}° bzw. über ${180 - EINBIEGEWINKEL_GRENZE_GRAD}° (Annahme, angelehnt an ` +
      'VSS 40 242 Ziffer 14.3.4)',
    daten: 'OpenStreetMap (Lage der Strassen)' },
  { id: 'V273-11', werk: '40273', ordnung: 11, fundstelle: 'Ziffer 11, S. 7', titel: 'Durchsichtige Zäune', wirkung: 'nur Hinweis',
    thema: 'hindernisse', gilt: e => e.richtungen.some(r => r.statusZusatz.includes('Hinweis: Zaun')),
    prueft: 'Ein Zaun oder Geländer, durch das man hindurchsieht, zählt nicht als Verdeckung. Die App empfiehlt, die Durchsicht vor Ort ' +
      'zu prüfen.',
    daten: 'Deine Angabe beim Zaun (nicht «dicht»)' },
  { id: 'V273-12a', werk: '40273', ordnung: 12, fundstelle: 'Ziffer 12, S. 7–8', titel: 'Beobachtungsdistanz B', wirkung: 'rechnet mit',
    thema: 'wartend', gilt: nichtRv,
    prueft: 'B ist der Abstand vom Rand der Strasse mit Vortritt bis zum Auge des wartenden Lenkers. Ob der Knoten inner- oder ' +
      'ausserorts liegt, leitet die App aus dem Tempo ab.',
    werte: `innerorts ${m(B_INNERORTS_M)} m; ausserorts ${m(B_AUSSERORTS_M)} m, mit Stop ${m(B_INNERORTS_M)} m`,
    daten: 'OpenStreetMap (Tempo bzw. Ortslage)' },
  { id: 'V273-12b', werk: '40273', ordnung: 12.1, fundstelle: 'Ziffer 12, S. 8; Abb. 2, S. 6', titel: 'Radweg nahe am Fahrbahnrand',
    wirkung: 'rechnet mit', thema: 'wartend', gilt: e => !!e.radwegRand,
    prueft: 'Liegt zwischen Zufahrt und Strasse ein Radweg nahe am Fahrbahnrand, wartet das Fahrzeug davor. B zählt dann ab der äusseren ' +
      'Kante des Radwegs.',
    werte: `Radweg näher als ${m(RADWEG_NAH_M)} m am Rand; ohne Breite in den Daten ${m(RADWEG_BREITE_M)} m breit (Annahme)`,
    daten: 'OpenStreetMap (Radwege)' },
  { id: 'V273-12c', werk: '40273', ordnung: 12.2, fundstelle: 'Ziffer 12, S. 7–8; Ziffer 14, S. 9', titel: 'Punkt D von Hand zu nah',
    wirkung: 'nur Hinweis', thema: 'wartend', gilt: e => e.Dhand,
    prueft: `Setzt du den Punkt D von Hand näher an den Rand als B, weist die App darauf hin. Unter ${m(B_INNERORTS_M)} m ist das nur ` +
      'an bestehenden Knoten zulässig.',
    werte: `Hinweis unter B; «Lage prüfen» ab ${D_HAND_WEIT_M} m vom Ausgangspunkt`,
    daten: 'Dein Klick auf der Karte' },
  { id: 'V273-13.1a', werk: '40273', ordnung: 13.1, fundstelle: 'Ziffer 13.1 und Tab. 1, S. 8', titel: 'Nötige Sicht für Motorfahrzeuge',
    wirkung: 'rechnet mit', thema: 'motorfahrzeuge', gilt: e => nichtRv(e) && mitAuto(e),
    prueft: 'Wie weit die Sicht reichen muss, folgt aus dem Tempo. An Erschliessungsstrassen gilt der untere Wert, an ' +
      'Hauptverkehrsstrassen ein höherer.',
    werte: `Stufen ${TAB1_MIN} bis ${TAB1_MAX} km/h, Tempo auf die nächste Stufe aufgerundet; über ${TAB1_MAX} km/h die Stufe ` +
      `${TAB1_MAX} mit Hinweis`,
    daten: 'Tempo und Strassentyp (siehe dort)' },
  { id: 'V273-13.1b', werk: '40273', ordnung: 13.11, fundstelle: 'Ziffer 13.1, S. 8', titel: 'Ungünstige Verhältnisse',
    wirkung: 'rechnet mit', thema: 'motorfahrzeuge', gilt: e => nichtRv(e) && Object.values(e.strasse.ungunst).some(x => x),
    prueft: 'Mehrere Fahrstreifen, starkes Gefälle oder viel Schwerverkehr heben an Hauptverkehrsstrassen die nötige Sicht auf den oberen ' +
      'Wert. An Erschliessungsstrassen bleibt der untere Wert, die App weist nur darauf hin.',
    werte: 'Masse nach Kanton Solothurn (siehe dort)',
    daten: 'OpenStreetMap (Zahl der Fahrstreifen), Höhenmodell swissALTI3D, deine Wahl im Panel' },
  { id: 'V273-13.1c', werk: '40273', ordnung: 13.12, fundstelle: 'Ziffer 13.1, S. 8', titel: 'Untere Werte nur bei geringer Neigung',
    wirkung: 'rechnet mit', thema: 'neigung', gilt: nichtRv,
    prueft: 'Die unteren Werte gelten für fast ebene Strassen. Bei stärkerer Neigung nimmt die App mindestens die Anhaltesichtweite.',
    werte: `Neigung bis ±${NEIGUNG_EBEN_PROZENT} %`,
    daten: 'Höhenmodell swissALTI3D bzw. deine Eingabe im Panel' },
  { id: 'V273-13.1d', werk: '40273', ordnung: 13.13, fundstelle: 'Ziffer 13.1, S. 8', titel: 'Trottoir zwischen Zufahrt und Strasse',
    wirkung: 'rechnet mit', thema: 'wartend', gilt: e => !!e.trottoir && !e.trottoirueberfahrt,
    prueft: 'Liegt ein Trottoir vor der Strasse mit Vortritt, wartet das Fahrzeug davor, und B zählt ab der Hinterkante des Trottoirs. ' +
      'Steht auf dem Trottoir nichts im Weg, zählt B ab der Bordkante.',
    daten: 'amtliche Vermessung (Trottoir), dein Häkchen «Trottoir ohne Hindernisse»' },
  { id: 'V273-13.2', werk: '40273', ordnung: 13.2, fundstelle: 'Ziffer 13.2 und Tab. 2, S. 8', titel: 'Sicht aufs Trottoir',
    wirkung: 'rechnet mit', thema: 'trottoir', gilt: mitTrottoir,
    prueft: 'Liegt ein Trottoir an der Zufahrt, prüft die App, ob die wartende Person Fussgänger beidseits früh genug sieht. Wie weit die ' +
      'Sicht reichen muss, hängt von der Neigung des Trottoirs ab.',
    werte: `Auge D' ${m(B_INNERORTS_M)} m hinter der Trottoirhinterkante bzw. dem hinteren Rand der Überfahrt`,
    daten: 'amtliche Vermessung (Trottoir), Höhenmodell swissALTI3D' },
  { id: 'V273-13.3a', werk: '40273', ordnung: 13.3, fundstelle: 'Ziffer 13.3 und Tab. 3, S. 9', titel: 'Sicht auf Velos',
    wirkung: 'rechnet mit', thema: 'velo', gilt: mitVelo,
    prueft: 'Die nötige Sicht auf Velos folgt aus dem signalisierten Tempo und der Neigung in Fahrtrichtung der Velos. Ein von Hand ' +
      'eingegebenes V85 oder fahrbares Tempo ändert diesen Wert nicht.',
    werte: `Tempo bis ${TAB3_GRENZE} bzw. über ${TAB3_GRENZE} km/h; «schnelle E-Bikes verboten» wirkt nur über ${TAB3_GRENZE} km/h`,
    daten: 'Tempo, Höhenmodell swissALTI3D, deine Wahl im Panel (schnelle E-Bikes verboten)' },
  { id: 'V273-13.3b', werk: '40273', ordnung: 13.31, fundstelle: 'Ziffer 13.3, S. 9', titel: 'Velos in der Kurve', wirkung: 'nur Hinweis',
    thema: 'velo', gilt: e => hinweis(e, 'Veloachse in einer Kurve'),
    prueft: 'In einer Kurve fahren Velos langsamer, und die Norm erlaubt dann tiefere Werte. Die App rechnet ohne Abzug und weist darauf ' +
      'hin.',
    werte: `Hinweis bei mehr als ${KURVE_GRAD}° Richtungsänderung innerhalb der nötigen Sicht`,
    daten: 'Verlauf der Strasse (amtliche Vermessung, OpenStreetMap)' },
  { id: 'V273-14a', werk: '40273', ordnung: 14, fundstelle: 'Ziffer 14, S. 9', titel: 'Massnahmen bei zu wenig Sicht', wirkung: 'rechnet mit',
    thema: 'massnahmen', gilt: e => !!e.massnahmen?.length,
    prueft: 'Reicht die Sicht nicht, rechnet die App Massnahmen als Varianten durch und zeigt, welche genügen. Das Ergebnis ändert sich ' +
      'erst, wenn du eine Massnahme übernimmst.',
    werte: 'Reihenfolge: Hindernis entfernen, Halte- oder Wartelinie vorverlegen, Stop, Rechtsabbiegegebot, Tempo senken, Lichtsignal, ' +
      'Spiegel, Ausfahrt aufheben' },
  { id: 'V273-14b', werk: '40273', ordnung: 14.1, fundstelle: 'Ziffer 14, S. 9', titel: 'Vorverlegte Halte- oder Wartelinie',
    wirkung: 'nur Hinweis', thema: 'massnahmen', gilt: e => !!e.haltelinie?.vorverlegt || !!e.massnahmen?.length,
    prueft: 'Liegt die Halte- oder Wartelinie näher an der Strasse mit Vortritt als üblich, weist die App darauf hin. Das ist nur an ' +
      'bestehenden Knoten zulässig und braucht ergänzende Markierungen.',
    daten: 'Dein Klick auf der Karte bzw. die übernommene Massnahme' },
  { id: 'V273-14c', werk: '40273', ordnung: 14.2, fundstelle: 'Ziffer 14, S. 9', titel: 'Spiegel', wirkung: 'nur Hinweis',
    thema: 'massnahmen', gilt: e => !!e.massnahmen?.length,
    prueft: 'Den Spiegel nennt die App nur, wenn auch das Vorverlegen der Linie nicht genügt. Die Bedingungen der Norm hakst du ab; die ' +
      'App bewertet sie nicht.',
    werte: `unter anderem Abstand Haltelinie–Spiegel unter ${SPIEGEL_ABSTAND_M} m, Tempo höchstens ${SPIEGEL_TEMPO_MAX} km/h`,
    daten: 'Deine Häkchen bei der Massnahme' },
  { id: 'V273-15a', werk: '40273', ordnung: 15, fundstelle: 'Ziffer 15, S. 10', titel: 'Rechtsvortritt: Arm rechts und Tempo',
    wirkung: 'rechnet mit', thema: 'rechtsvortritt', gilt: rv,
    prueft: 'Beim Rechtsvortritt muss die Zufahrt dem Verkehr von rechts den Vortritt lassen. Die App prüft darum nur die Sicht nach ' +
      'rechts. Die nötige Sicht folgt Abb. 6; die Norm geht dabei von 30 km/h aus, ein tieferes Tempo ändert sie nicht. Liegt das Tempo ' +
      'darüber, weist die App darauf hin.',
    werte: `Norm: ${RV_TEMPO} km/h; rechts heisst mehr als ${RECHTS_MIN_GRAD}° rechts der Fahrtrichtung (Annahme)`,
    daten: 'OpenStreetMap (Lage der Strassen)' },
  { id: 'V273-15b', werk: '40273', ordnung: 15.1, fundstelle: 'Ziffer 15, S. 10', titel: 'Passt der Rechtsvortritt?', wirkung: 'nur Hinweis',
    thema: 'rechtsvortritt', gilt: rv,
    prueft: 'Ob Rechtsvortritt an diesem Knoten passt, etwa bei ähnlich wichtigen Strassen mit ähnlich viel Verkehr, kann die App aus ' +
      'den Daten nicht beurteilen. Sie weist darauf hin, das vor Ort zu prüfen.' },
  { id: 'V273-16a', werk: '40273', ordnung: 16, fundstelle: 'Ziffer 16 und Abb. 4, S. 10', titel: 'Rechtsvortritt: Beobachtungsdistanz',
    wirkung: 'rechnet mit', thema: 'rechtsvortritt', gilt: rv,
    prueft: 'Beim Rechtsvortritt liegt das Auge des wartenden Lenkers weiter hinten als sonst innerorts, gemessen ab dem Rand des Arms ' +
      'rechts.',
    werte: `B ${m(RV_B_M)} m`,
    daten: 'amtliche Vermessung (Fahrbahn des rechten Arms)' },
  { id: 'V273-16b', werk: '40273', ordnung: 16.1, fundstelle: 'Ziffer 16, S. 10', titel: 'Rechtsvortritt: nötige Sicht',
    wirkung: 'rechnet mit', thema: 'rechtsvortritt', gilt: rv,
    prueft: 'Geprüft wird die Sicht auf den Verkehr von rechts. Wie viel genügt, hängt davon ab, wie gut der Knoten wahrnehmbar ist.',
    werte: `${RV_A_M} m anzustreben; ${RV_A_MIN_M} m nur bei sehr guter Wahrnehmbarkeit; geprüft bis ${RV_ZIEL_M} m`,
    daten: 'amtliche Vermessung (Gebäude), deine Hindernisse und die Parkfelder' },
  { id: 'V273-16c', werk: '40273', ordnung: 16.2, fundstelle: 'Ziffer 16, S. 10', titel: 'Rechtsvortritt bei Gefälle', wirkung: 'nur Hinweis',
    thema: 'rechtsvortritt', gilt: e => rv(e) && hinweis(e, 'gelten ohne Längsneigung'),
    prueft: 'Die Werte für den Rechtsvortritt gelten für ebene Strassen. Bei Gefälle oder Steigung empfiehlt die App mehr Sicht, rechnet ' +
      'sie aber nicht.',
    werte: `Hinweis über ±${NEIGUNG_EBEN_PROZENT} %`,
    daten: 'Höhenmodell swissALTI3D bzw. deine Eingabe im Panel' },
  { id: 'V273-16d', werk: '40273', ordnung: 16.3, fundstelle: 'Ziffer 16, S. 10; Abb. 5, S. 11', titel: 'Rechtsvortritt: enge Kreuzung',
    wirkung: 'rechnet mit', thema: 'rechtsvortritt', gilt: e => !!e.rechtsvortritt?.arm.sichtfeld,
    prueft: 'Ist eine der Fahrbahnen schmal, prüft die App zusätzlich, ob sich zwei Fahrzeuge auf den letzten Metern vor der Ecke sehen. ' +
      'Ist das nicht der Fall, gilt die Sicht als ungenügend.',
    werte: `Fahrbahn höchstens ${m(SCHMAL_M)} m breit; Punkte alle ${ENG_SCHRITT_M} m auf ${ENG_LAENGE_M} m`,
    daten: 'amtliche Vermessung (Fahrbahn, Gebäude), deine Hindernisse' },
  { id: 'V273-16e', werk: '40273', ordnung: 16.4, fundstelle: 'Ziffer 16, S. 10', titel: 'Rechtsvortritt aufheben', wirkung: 'nur Hinweis',
    thema: 'massnahmen', gilt: e => e.rechtsvortritt?.arm.status === 'nicht_erfuellt',
    prueft: 'Reicht die Sicht beim Rechtsvortritt nicht, nennt die App als erste Massnahme, den Rechtsvortritt aufzuheben und den Vortritt ' +
      'zu signalisieren.' },
  { id: 'V273-16f', werk: '40273', ordnung: 16.5, fundstelle: 'Abb. 4, S. 10', titel: 'Rechtsvortritt mit Halte- oder Wartelinie',
    wirkung: 'nur Hinweis', thema: 'rechtsvortritt', gilt: e => rv(e) && !!e.haltelinie,
    prueft: 'An Knoten mit Rechtsvortritt gibt es meist keine solche Linie. Ist eine gesetzt, misst die App ab ihr und weist darauf hin.',
    daten: 'Dein Klick auf der Karte' },
  { id: 'V273-17', werk: '40273', ordnung: 17, fundstelle: 'Ziffer 17, S. 11; Abb. 6, S. 12', titel: 'Rechtsvortritt: Zustand',
    wirkung: 'rechnet mit', thema: 'rechtsvortritt', gilt: rv,
    prueft: 'Aus vorhandener Sicht und Wahrnehmbarkeit ergibt sich, ob der Zustand anzustreben, zulässig oder zu sanieren ist. «Zu ' +
      'sanieren» gilt als ungenügend.',
    werte: `Stufen bei ${ABB6_GRENZEN.join(', ')} m`,
    daten: 'Deine Wahl im Panel (Wahrnehmbarkeit)' },
  { id: 'V273-18', werk: '40273', ordnung: 18, fundstelle: 'Ziffer 18, S. 12–13', titel: 'Wahrnehmbarkeit', wirkung: 'rechnet mit',
    thema: 'rechtsvortritt', gilt: rv,
    prueft: 'Wie gut der Knoten erkennbar ist, schätzt du vor Ort ein. Ohne Eingabe nimmt die App «gut» an.',
    werte: 'sehr gut, gut, schlecht, sehr schlecht; Vorgabe «gut» (Annahme)',
    daten: 'Deine Wahl im Panel' },
  // ── VSS 40 090b ──
  { id: 'V090-6', werk: '40090', ordnung: 6, fundstelle: 'Ziffer 6, S. 4', titel: 'Keine Kürzung auf verkehrsberuhigten Strassen',
    wirkung: 'nur Hinweis', thema: 'neigung', gilt: e => hinweis(e, 'VSS 40 090b Ziffer 6'),
    prueft: 'Auf verkehrsberuhigten Strassen erlaubt die Norm eine kürzere Anhaltesichtweite. Die App kürzt nicht und weist darauf hin.',
    werte: 'Hinweis bei Tempo bis 30 km/h oder an Erschliessungsstrassen, wenn die Anhaltesichtweite zählt (Annahme)',
    daten: 'Tempo und Strassentyp (siehe dort)' },
  { id: 'V090-A2', werk: '40090', ordnung: 7, fundstelle: 'Abb. 2, S. 5', titel: 'Anhaltesichtweite bei Gefälle und Steigung',
    wirkung: 'rechnet mit', thema: 'neigung', gilt: e => e.richtungen.some(r => r.anhalteAngewendet && r.status !== 'keine_zufahrt'),
    prueft: 'Bergab braucht ein Fahrzeug länger zum Anhalten. Bei stärkerer Neigung nimmt die App darum mindestens die Anhaltesichtweite.',
    werte: `aus dem Diagramm abgelesen (±2 m); erst über ±${NEIGUNG_EBEN_PROZENT} %; unter 30 km/h nicht (keine Kurve); unbekannte ` +
      `Neigung: Wert bei ${proz(ANHALTESICHT_I_MIN)}`,
    daten: 'Tempo, Höhenmodell swissALTI3D bzw. deine Eingabe im Panel' },
  // ── VSS 40 242 ──
  { id: 'V242-12.3', werk: '40242', ordnung: 12.3, fundstelle: 'Ziffer 12.3, S. 8', titel: 'Kein Rechtsvortritt an der Trottoirüberfahrt',
    wirkung: 'rechnet mit', thema: 'trottoir', gilt: tue,
    prueft: 'Wer über eine Trottoirüberfahrt fährt, hat keinen Rechtsvortritt. Die App rechnet dort mit «Kein Vortritt», auch wenn ' +
      '«Rechtsvortritt» gewählt ist.',
    daten: 'Deine Wahl im Panel (Trottoirüberfahrt)' },
  { id: 'V242-14.1', werk: '40242', ordnung: 14.1, fundstelle: 'Ziffer 14.1, S. 10', titel: 'Trottoirüberfahrt nur innerorts',
    wirkung: 'nur Hinweis', thema: 'trottoir', gilt: e => tue(e) && e.ausserorts,
    prueft: 'Liegt die Überfahrt nach den Daten ausserorts, weist die App darauf hin.',
    daten: 'OpenStreetMap (Tempo bzw. Ortslage)' },
  { id: 'V242-14.2', werk: '40242', ordnung: 14.2, fundstelle: 'Ziffer 14.2, S. 11', titel: 'Trottoirüberfahrt nur über die einmündende Strasse',
    wirkung: 'nur Hinweis', thema: 'trottoir', gilt: e => !!e.trottoirueberfahrt?.durchgehend,
    prueft: 'Liegt die Zufahrt auf der durchgehenden Strasse statt auf der einmündenden, weist die App darauf hin.',
    daten: 'OpenStreetMap (Lage der Strassen)' },
  { id: 'V242-14.3.1', werk: '40242', ordnung: 14.31, fundstelle: 'Ziffer 14.3.1, S. 12', titel: 'Trottoirüberfahrt: Tempo',
    wirkung: 'nur Hinweis', thema: 'trottoir', gilt: e => tue(e) && hinweis(e, 'Ziffer 14.3.1'),
    prueft: 'Ist die Strasse mit Vortritt schneller signalisiert, weist die App darauf hin.',
    werte: 'höchstens 50 km/h',
    daten: 'Tempo (signalisiert, siehe dort)' },
  { id: 'V242-14.3.4', werk: '40242', ordnung: 14.34, fundstelle: 'Ziffer 14.3.4, S. 12', titel: 'Trottoirüberfahrt: Einmündungswinkel',
    wirkung: 'nur Hinweis', thema: 'trottoir', gilt: e => tue(e) && hinweis(e, 'Ziffer 14.3.4'),
    prueft: 'Mündet die Zufahrt sehr schräg ein, weist die App darauf hin.',
    werte: '45° bis 135°',
    daten: 'OpenStreetMap (Lage der Strassen)' },
  { id: 'V242-14.4a', werk: '40242', ordnung: 14.4, fundstelle: 'Ziffer 14.4, S. 13', titel: 'Sicht in zwei Schritten', wirkung: 'rechnet mit',
    thema: 'trottoir', gilt: tue,
    prueft: 'An einer Trottoirüberfahrt prüft die App zuerst die Sicht aufs Trottoir vom hinteren Rand der Überfahrt aus, dann die Sicht ' +
      'auf die Fahrbahn ab der Bordkante.',
    werte: `D' ${m(B_INNERORTS_M)} m hinter dem hinteren Rand der Überfahrt; B ab der Bordkante`,
    daten: 'amtliche Vermessung (Fahrbahn, Trottoir)' },
  { id: 'V242-14.4b', werk: '40242', ordnung: 14.41, fundstelle: 'Ziffer 14.4, S. 13', titel: 'Gehlinie', wirkung: 'rechnet mit',
    thema: 'trottoir', gilt: tue,
    prueft: 'Fussgänger werden auf einer Linie kurz vor dem hinteren Rand der Überfahrt erwartet; dorthin prüft die App die Sicht.',
    werte: `${m(TUE_GEHLINIE_M)} m vor dem hinteren Rand der Überfahrt`,
    daten: 'amtliche Vermessung (Fahrbahnrand)' },
  { id: 'V242-15.4.2', werk: '40242', ordnung: 15.42, fundstelle: 'Ziffer 15.4.2, S. 18', titel: 'Velos auf dem Trottoir', wirkung: 'nur Hinweis',
    thema: 'trottoir', gilt: e => tue(e) && hinweis(e, 'Velos auf dem Trottoir'),
    prueft: 'Sind Velos auf dem Trottoir erlaubt, wäre die Überfahrt wie ein Radweg zu prüfen. Die App rechnet das nicht und weist darauf ' +
      'hin.',
    daten: 'OpenStreetMap (Velos auf dem Trottoir erlaubt; sidewalk:bicycle)' },
  { id: 'V242-16', werk: '40242', ordnung: 16, fundstelle: 'Ziffer 16, S. 19–20', titel: 'Breite der Überfahrt', wirkung: 'rechnet mit',
    thema: 'trottoir', gilt: tue,
    prueft: 'Die Breite gibst du von Hand ein, sonst misst die App sie am Trottoir der amtlichen Vermessung. Fehlt beides, nimmt sie die ' +
      'kleinste Breite der Norm an.',
    werte: `aus dem angrenzenden Trottoir begrenzt auf ${m(TUE_BREITE_Z16[0])} bis ${m(TUE_BREITE_Z16[1])} m; ohne Angabe ` +
      `${m(TUE_BREITE_ANNAHME_M)} m (Annahme)`,
    daten: 'Deine Eingabe im Panel, amtliche Vermessung (Trottoir)' },
  // ── VSS 40 213, VSS 40 040b ──
  { id: 'V213', werk: '40213', ordnung: 1, fundstelle: 'Vermerk (ohne Ziffer)', titel: 'Bauliche Elemente zum Verlangsamen',
    wirkung: 'nur Hinweis', thema: 'massnahmen', gilt: e => !!e.massnahmen?.length,
    prueft: 'Bei den Massnahmen nennt die App bauliche Elemente zum Verlangsamen, etwa eine Aufpflästerung, ohne sie zu rechnen. Sie ' +
      'vermerkt, ob die Strasse dafür siedlungsorientiert ist.' },
  { id: 'V040-5', werk: '40040', ordnung: 5, fundstelle: 'Ziffer 5, S. 2', titel: 'Verkehrs- und siedlungsorientierte Strassen',
    wirkung: 'nur Hinweis', thema: 'massnahmen', gilt: e => !!e.massnahmen?.length || hinweis(e, 'siedlungsorientierten'),
    prueft: 'Ob eine Strasse siedlungsorientiert ist, steuert nur Hinweise: den Vermerk zu den Elementen zum Verlangsamen und den Hinweis ' +
      'zur Anhaltesichtweite.',
    werte: 'siedlungsorientiert: Erschliessungsstrasse oder Tempo bis 30 km/h (Annahme)',
    daten: 'Strassentyp und Tempo (siehe dort)' },
  { id: 'V040-8', werk: '40040', ordnung: 8, fundstelle: 'Ziffer 8, S. 3', titel: 'Strassentypen', wirkung: 'rechnet mit',
    thema: 'motorfahrzeuge', gilt: nichtRv,
    prueft: 'Die App unterscheidet Erschliessungs-, Sammel- und Verbindungsstrassen von Hauptverkehrsstrassen. Davon hängt ab, welcher ' +
      'Wert für Motorfahrzeuge gilt.',
    daten: 'OpenStreetMap (Strassenklasse), deine Wahl im Panel' },
  // ── bfu BM.021 ──
  { id: 'BFU-1', werk: 'BFU', ordnung: 1, fundstelle: 'Kap. 1, S. 1–2', titel: 'Hindernisse auf Privatgrund', wirkung: 'nur Hinweis',
    thema: 'massnahmen', gilt: e => !!e.massnahmen?.length,
    prueft: 'Bei der Massnahme «Hindernis entfernen» weist die App darauf hin, dass auf Privatgrund eigene Regeln gelten, etwa kantonale ' +
      'Pflanzabstände.' },
  { id: 'BFU-3.2', werk: 'BFU', ordnung: 3.2, fundstelle: 'Kap. 3.2 und Abb. 4, S. 3–4', titel: 'Enge Kreuzung: Konstruktion',
    wirkung: 'rechnet mit', thema: 'rechtsvortritt', gilt: e => !!e.rechtsvortritt?.arm.sichtfeld,
    prueft: 'Für die enge Kreuzung legt die App einen Weg über die Ecke und prüft Sichtlinien vom Auge D zu Punkten auf diesem Weg. Frei ' +
      'ist die Sicht nur, wenn alle Linien frei sind.',
    werte: `Weg ${ENG_LAENGE_M} m ab D, Punkte alle ${ENG_SCHRITT_M} m`,
    daten: 'amtliche Vermessung (Fahrbahn, Gebäude), deine Hindernisse' },
  { id: 'BFU-3.3', werk: 'BFU', ordnung: 3.3, fundstelle: 'Kap. 3.3 und Tab. 1/2, S. 5', titel: 'Halte- oder Wartelinie vorverlegen',
    wirkung: 'rechnet mit', thema: 'massnahmen', gilt: e => !!e.massnahmen?.length,
    prueft: `Beim Vorverlegen rückt die App das wartende Fahrzeug schrittweise vor, aber nie näher als ${m(HALTELINIE_MIN_M)} m an den ` +
      'Rand. Die Werte der bfu für die Sicht auf Velos zeigt der Bericht nur zum Vergleich.',
    werte: `Schritte von ${m(HALTELINIE_SCHRITT_M)} m; D höchstens bis ${m(HALTELINIE_MIN_M)} m hinter dem Rand` },
  { id: 'BFU-3.5', werk: 'BFU', ordnung: 3.5, fundstelle: 'Kap. 3.5 und Abb. 6, S. 6; Tab. 3, S. 7', titel: 'Richtung der Trottoirneigung',
    wirkung: 'rechnet mit', thema: 'trottoir', gilt: mitTrottoir,
    prueft: 'Die VSS-Tabelle für das Trottoir sagt nicht, in welche Richtung die Neigung zählt. Die App misst sie wie die bfu in Gehrichtung ' +
      'zur Zufahrt hin; die bfu-Werte für das Trottoir zeigt der Bericht zum Vergleich.',
    werte: 'abwärts negativ',
    daten: 'Höhenmodell swissALTI3D' },
  // ── SSV, SVG, VRV ──
  { id: 'SSV-36', werk: 'SSV', ordnung: 36, fundstelle: 'Art. 36 (Signale 3.01 und 3.02)', titel: 'Stop und Kein Vortritt',
    wirkung: 'rechnet mit', thema: 'knoten',
    prueft: 'Mit «Stop» oder «Kein Vortritt» muss die gewählte Zufahrt dem Verkehr auf der anderen Strasse den Vortritt lassen. Die ' +
      'Regelung gilt für diese Zufahrt.',
    daten: 'OpenStreetMap (Signale Stop und Kein Vortritt), deine Wahl im Panel' },
  { id: 'SSV-36.7', werk: 'SSV', ordnung: 36.7, fundstelle: 'Art. 36 Abs. 7', titel: 'Kein Vortritt statt Stop', wirkung: 'nur Hinweis',
    thema: 'knoten', gilt: stattStop,
    prueft: 'Ist «Stop» gewählt und reicht die Sicht in alle Richtungen, meldet die App, dass «Kein Vortritt» genügt. Ein Stop gehört nur ' +
      'dorthin, wo man wegen fehlender Sicht anhalten muss.',
    werte: `ausserorts geprüft mit B ${m(B_AUSSERORTS_M)} m wie bei «Kein Vortritt»`,
    daten: 'Ergebnis der Sichtprüfung dieser Zufahrt' },
  { id: 'SSV-75', werk: 'SSV', ordnung: 75, fundstelle: 'Art. 75 (Markierungen 6.10 und 6.13)', titel: 'Halte- und Wartelinie',
    wirkung: 'rechnet mit', thema: 'wartend', gilt: e => !!e.haltelinie,
    prueft: 'Zum «Stop» gehört die Haltelinie, zu «Kein Vortritt» die Wartelinie. Die App misst bei beiden gleich ab der Vorderkante.',
    daten: 'Dein Klick auf der Karte' },
  { id: 'SVG-4', werk: 'SVG', ordnung: 4, fundstelle: 'Art. 4', titel: 'Hindernisse auf Privatgrund', wirkung: 'nur Hinweis',
    thema: 'massnahmen', gilt: e => !!e.massnahmen?.length,
    prueft: 'Bei der Massnahme «Hindernis entfernen» verweist die App auf die gesetzliche Grundlage für Hindernisse auf Privatgrund.' },
  { id: 'SVG-36.2', werk: 'SVG', ordnung: 36.2, fundstelle: 'Art. 36 Abs. 2', titel: 'Rechtsvortritt ohne Signal', wirkung: 'rechnet mit',
    thema: 'knoten', gilt: e => e.regelungVorgabe === 'rechtsvortritt',
    prueft: 'Ohne Signal gilt Rechtsvortritt. Die App nimmt ihn an Quartierstrassen mit Tempo 30 als Vorgabe an; du kannst die Regelung ' +
      'im Panel ändern.',
    daten: 'OpenStreetMap (Signale, Strassenklasse, Tempo)' },
  { id: 'VRV-15.3', werk: 'VRV', ordnung: 15.3, fundstelle: 'Art. 15 Abs. 3', titel: 'Kein Rechtsvortritt aus Ausfahrten',
    wirkung: 'rechnet mit', thema: 'knoten', gilt: e => !!e.zufahrtspunkt || tue(e) || (!!e.trottoir && rv(e)),
    prueft: 'Wer aus einer Grundstückzufahrt oder über ein Trottoir in die Strasse fährt, hat nie Rechtsvortritt. Bei einer ' +
      'Grundstückzufahrt und mit dem Häkchen «Trottoirüberfahrt» rechnet die App mit «Kein Vortritt», auch wenn «Rechtsvortritt» gewählt ist. ' +
      'Liegt nach der amtlichen Vermessung ein Trottoir vor der Zufahrt und ist das Häkchen nicht gesetzt, weist sie nur darauf hin.',
    daten: 'Deine Wahl im Panel (Grundstückzufahrt bzw. Trottoirüberfahrt)' },
  // ── kantonale Praxis ──
  { id: 'SO-3', werk: 'SO', ordnung: 3, fundstelle: 'S. 3', titel: 'Masse der ungünstigen Verhältnisse (Solothurn)', wirkung: 'rechnet mit',
    thema: 'motorfahrzeuge', gilt: nichtRv,
    prueft: 'Die VSS-Norm nennt keine Masse für ungünstige Verhältnisse. Die App übernimmt die Masse des Kantons Solothurn.',
    werte: `mehr als ein Fahrstreifen je Richtung; Gefälle über ${NEIGUNG_GROSS_PROZENT} %; Schwerverkehrsanteil über ` +
      `${SCHWERVERKEHR_PROZENT} %`,
    daten: 'OpenStreetMap (Zahl der Fahrstreifen), Höhenmodell swissALTI3D, deine Eingabe (Schwerverkehrsanteil)' },
  { id: 'BE-2.3', werk: 'TBA_BE', ordnung: 2.3, fundstelle: 'Arbeitshilfe Vortritt, Kap. 2.3 «Stop-Strassen», S. 7', titel: 'Kein Vortritt statt Stop (Bern)',
    wirkung: 'nur Hinweis', thema: 'knoten', gilt: stattStop,
    prueft: `${STATT_STOP} Der Kanton Bern verlangt einen Stop nur, wo die Sicht nicht reicht.`,
    daten: 'Ergebnis der Sichtprüfung dieser Zufahrt' },
  { id: 'LU-653', werk: 'VIF_LU', ordnung: 1, fundstelle: 'Richtlinie 653.105, S. 2, Abschnitt «Stop-Signalisation»',
    titel: 'Kein Vortritt statt Stop (Luzern)', wirkung: 'nur Hinweis', thema: 'knoten', gilt: stattStop,
    prueft: `${STATT_STOP} Der Kanton Luzern lässt einen Stop nur zu, wo man wegen fehlender Sicht anhalten muss.`,
    daten: 'Ergebnis der Sichtprüfung dieser Zufahrt' },
  { id: 'BS-5.2', werk: 'BS_SSV', ordnung: 5.2, fundstelle: 'Teil 1, Kap. 5.2, Signal 3.01 (Stop), S. 17–18; Kap. 5.3, S. 22',
    titel: 'Kein Vortritt statt Stop (Basel-Stadt)', wirkung: 'nur Hinweis', thema: 'knoten', gilt: stattStop,
    prueft: `${STATT_STOP} Der Kanton Basel-Stadt verlangt einen Stop nur, wo die Sicht für «Kein Vortritt» nicht reicht.`,
    daten: 'Ergebnis der Sichtprüfung dieser Zufahrt' },
  // ── Annahmen der App ──
  { id: 'A-Knoten', werk: 'ANNAHME', ordnung: 1, fundstelle: 'Annahme', titel: 'Knoten und Strasse mit Vortritt', wirkung: 'rechnet mit',
    thema: 'knoten', gilt: e => !e.zufahrtspunkt,
    prueft: 'Welche Strasse Vortritt hat, liest die App aus OpenStreetMap; die Zufahrt wählst du im Panel.',
    werte: 'Knoten ab drei Strassenarmen (ohne Zufahrtswege); Vortritt hat dieselbe Strasse in OpenStreetMap, sonst die mit gleichem ' +
      'Namen, sonst die wichtigere Strassenklasse',
    daten: 'OpenStreetMap (Strassen, Namen, Strassenklasse)' },
  { id: 'A-Gabelung', werk: 'ANNAHME', ordnung: 1.1, fundstelle: 'Annahme', titel: 'Gabelungen sind keine Knoten', wirkung: 'rechnet mit',
    thema: 'knoten', gilt: () => false,
    prueft: 'Führt höchstens ein Arm zum Punkt hin, muss dort niemand warten. Die App bietet ihn nicht als Knoten an.',
    werte: 'höchstens ein Arm mit Verkehr zum Punkt (Velos gegen die Einbahn mitgezählt)',
    daten: 'OpenStreetMap (Einbahnen, Velos gegen die Einbahn)' },
  { id: 'A-Fahrbahnteilung', werk: 'ANNAHME', ordnung: 1.15, fundstelle: 'Annahme (Entscheid 31.10.2026)',
    titel: 'Fahrbahnteilungen sind keine Knoten', wirkung: 'rechnet mit', thema: 'knoten', gilt: () => false,
    prueft: 'Teilt sich eine Fahrbahn in zwei Einbahnen, ohne dass sich die Fahrströme kreuzen, muss dort niemand warten. Die App bietet ' +
      'den Punkt nicht als Knoten an.',
    werte: `drei Arme: einer in beiden Richtungen, eine Einbahn zum Punkt und eine rechts davon weg, höchstens ${TEILUNG_WINKEL_GRAD}° ` +
      `auseinander, ohne Velos gegen die wegführende Einbahn; führt eine Einbahn innert ${TEILUNG_KREISEL_M} m in einen Kreisel, gehört ` +
      'der Punkt zur Kreiselzufahrt',
    daten: 'OpenStreetMap (Einbahnen, Velos gegen die Einbahn, Kreisel)' },
  { id: 'A-Zusammenfuehrung', werk: 'ANNAHME', ordnung: 1.155, fundstelle: 'Annahme (Entscheid 31.10.2026)',
    titel: 'Zusammenführungen rechnet die App vorerst nicht', wirkung: 'rechnet mit', thema: 'knoten', gilt: () => false,
    prueft: 'Laufen zwei Einbahnen spitz zusammen und fädelt der Verkehr ein, passt das Sichtmodell der App nicht: man schaut über die ' +
      'Schulter zurück. Die App meldet solche Stellen und rechnet nicht; das Einfädeln ist vor Ort zu prüfen.',
    werte: `drei Arme: zwei Einbahnen zum Punkt, höchstens ${TEILUNG_WINKEL_GRAD}° auseinander, und eine Einbahn weg, ohne Velos gegen sie`,
    daten: 'OpenStreetMap (Einbahnen, Velos gegen die Einbahn)' },
  { id: 'A-Teilung', werk: 'ANNAHME', ordnung: 1.16, fundstelle: 'Annahme (Entscheid 31.10.2026)',
    titel: 'Arm teilt sich in zwei Einbahnen', wirkung: 'rechnet mit', thema: 'motorfahrzeuge',
    gilt: e => e.annahmen.some(x => x.includes('in zwei Einbahnen. Ab dort folgt')),
    prueft: 'Teilt sich die Fahrbahn eines Arms in eine Einbahn zum Knoten und eine vom Knoten weg, folgt die Fahrlinie ab der Teilung ' +
      'der Einbahn, auf der die Fahrzeuge zum Knoten fahren. Rand, Breite und Parkierung nimmt die App dann von dieser Fahrbahn. Teilt ' +
      'sich die Zufahrt, steht das wartende Fahrzeug ebenso auf der Einbahn zum Knoten.',
    werte: `Einbahnen höchstens ${TEILUNG_WINKEL_GRAD}° auseinander; Wechsel der Veloführung ab der Teilung auf 10 m (Annahme)`,
    daten: 'OpenStreetMap (Einbahnen, Veloführung), amtliche Vermessung (Fahrbahn)' },
  { id: 'A-LSA', werk: 'ANNAHME', ordnung: 1.2, fundstelle: 'Annahme', titel: 'Knoten mit Lichtsignalanlage', wirkung: 'rechnet mit',
    thema: 'knoten', gilt: e => !!e.lsa,
    prueft: 'Im Betrieb regelt das Lichtsignal. Die App rechnet für die ausgeschaltete oder gelb blinkende Anlage, nimmt dafür ohne Signal ' +
      'keinen Rechtsvortritt an und lässt die Massnahme «Lichtsignalanlage» weg.',
    werte: 'Lichtsignal am Knotenpunkt oder bis 30 m auf einem Arm',
    daten: 'OpenStreetMap (Lichtsignale; highway=traffic_signals)' },
  { id: 'A-Armende', werk: 'ANNAHME', ordnung: 1.3, fundstelle: 'Annahme (Entscheid 31.10.2026)', titel: 'Strasse über das Datenende hinaus',
    wirkung: 'rechnet mit', thema: 'knoten', gilt: e => hinweis(e, 'nimmt die App die Fahrlinie gerade an'),
    prueft: 'Endet eine Strasse mit Vortritt in den Daten kurz nach dem Knoten, verlängert die App ihre Fahrlinie gerade und weist darauf ' +
      'hin. Die Sicht dort ist vor Ort zu prüfen.',
    werte: 'gerade verlängert, wenn keine Strasse mit weniger als 45° Richtungsänderung weiterführt; Hinweis, wenn die nötige Sicht ' +
      'darüber hinausreicht',
    daten: 'OpenStreetMap (Strassen)' },
  { id: 'A-Rechts', werk: 'ANNAHME', ordnung: 2, fundstelle: 'Annahme', titel: 'Lage der Arme', wirkung: 'rechnet mit', thema: 'knoten',
    prueft: 'Ob ein Arm links, rechts oder gegenüber liegt, bestimmt die App aus seiner Richtung.',
    werte: `«von rechts»: mehr als ${RECHTS_MIN_GRAD}° rechts der Fahrtrichtung; «gegenüber»: höchstens ${GEGENUEBER_GRAD}° neben geradeaus`,
    daten: 'OpenStreetMap (Lage der Strassen)' },
  { id: 'A-Grundstueck', werk: 'ANNAHME', ordnung: 3, fundstelle: 'Annahme', titel: 'Grundstückzufahrt', wirkung: 'rechnet mit',
    thema: 'knoten', gilt: e => !!e.zufahrtspunkt,
    prueft: 'Eine Grundstückzufahrt rechnet die App wie einen Arm: einspurig, das Fahrzeug in ihrer Mitte, ohne Rechtsvortritt. Sie ' +
      'verläuft senkrecht zum Fahrbahnrand oder so, wie du sie zeichnest.',
    daten: 'Dein Klick auf der Karte, OpenStreetMap (Zufahrtsweg)' },
  { id: 'A-Fahrersitz', werk: 'ANNAHME', ordnung: 4, fundstelle: 'Annahme', titel: 'Auge am Fahrersitz', wirkung: 'rechnet mit',
    thema: 'wartend',
    prueft: 'Das Auge des wartenden Lenkers sitzt links der Wagenmitte. Bei einem Velo liegt es über dessen Fahrlinie.',
    werte: `${m(FAHRERSITZ_M)} m links der Fahrlinie der Zufahrt` },
  { id: 'A-Zufahrtsachse', werk: 'ANNAHME', ordnung: 5, fundstelle: 'Annahme', titel: 'Fahrlinie der Zufahrt', wirkung: 'rechnet mit',
    thema: 'wartend',
    prueft: 'Wo das wartende Fahrzeug steht, misst die App an vielen Stellen quer über die Fahrbahn der Zufahrt. Wird entlang der Zufahrt ' +
      'parkiert, rückt das Fahrzeug zur Mitte.',
    werte: `Mitte der rechten Fahrbahnhälfte (Einbahn: Mitte der Fahrbahn); Parkierung ${m(PARKSTREIFEN)} m abgezogen; ohne amtliche ` +
      `Vermessung ${m(LAGE_ERSATZ)} m rechts der Strassenlinie von OpenStreetMap`,
    daten: 'amtliche Vermessung (Fahrbahn), OpenStreetMap (Strassen), Parkfelder' },
  { id: 'A-Ortslage', werk: 'ANNAHME', ordnung: 6, fundstelle: 'Annahme', titel: 'Innerorts oder ausserorts', wirkung: 'rechnet mit',
    thema: 'wartend', gilt: nichtRv,
    prueft: 'Ob ein Knoten inner- oder ausserorts liegt, leitet die App aus dem Tempo der Strasse mit Vortritt in OpenStreetMap ab.',
    werte: 'ausserorts bei Tempo über 50 km/h oder der Angabe «ausserorts» (CH:rural)',
    daten: 'OpenStreetMap (Tempo; maxspeed)' },
  { id: 'A-Querschnitt', werk: 'ANNAHME', ordnung: 7, fundstelle: 'Annahme', titel: 'Fahrbahnbreite und Rand', wirkung: 'rechnet mit',
    thema: 'motorfahrzeuge',
    prueft: 'Den Fahrbahnrand misst die App an vielen Stellen entlang der Strasse. Fehlt die amtliche Vermessung, nimmt sie die Breite aus ' +
      'OpenStreetMap oder eine feste Breite.',
    werte: `ohne Angaben ${m(BREITE_ANNAHME_M, 1)} m breit`,
    daten: 'amtliche Vermessung (Fahrbahn), OpenStreetMap (Breite)' },
  { id: 'A-Parkierung', werk: 'ANNAHME', ordnung: 8, fundstelle: 'Annahme', titel: 'Parkierung entlang der Fahrlinie', wirkung: 'rechnet mit',
    thema: 'motorfahrzeuge',
    prueft: 'Ob entlang der Strasse mit Vortritt parkiert wird, erkennt die App an Prüfpunkten knapp innerhalb des Fahrbahnrands, die auf ' +
      'Parkfeldern liegen, auch auf Velo- und Motorradfeldern.',
    werte: `Prüfpunkte ${m(PARK_SONDE_M)} m innerhalb des Rands, alle 2 m; Parkierung ab ${PARK_MIN_TREFFER} Treffern an 2 Feldern bzw. ` +
      `${PARK_EIN_FELD_TREFFER} an einem Feld (Abstand bis ${m(PARK_SONDE_RADIUS_M, 1)} m); dann ${m(PARKSTREIFEN)} m abgezogen`,
    daten: 'Parkfelder (amtlich, von Hand, bestätigte Vorschläge)' },
  { id: 'A-Strassentyp', werk: 'ANNAHME', ordnung: 9, fundstelle: 'Annahme', titel: 'Strassentyp aus OpenStreetMap', wirkung: 'rechnet mit',
    thema: 'motorfahrzeuge', gilt: e => nichtRv(e) && !e.strasse.typGewaehlt,
    prueft: 'Den Strassentyp leitet die App aus der Strassenklasse in OpenStreetMap ab; du kannst ihn im Panel ändern.',
    werte: 'Hauptverkehrsstrasse: Klassen trunk, primary, secondary und tertiary (auch _link); sonst Erschliessungsstrasse',
    daten: 'OpenStreetMap (Strassenklasse; highway)' },
  { id: 'A-Tempo', werk: 'ANNAHME', ordnung: 10, fundstelle: 'Annahme', titel: 'Tempo ohne Angabe', wirkung: 'rechnet mit',
    thema: 'motorfahrzeuge', gilt: e => e.richtungen.some(r => r.tempoAnnahme),
    prueft: 'Fehlt das Tempo in OpenStreetMap und im Geoportal der Stadt Bern, rechnet die App mit einem festen Wert.',
    werte: `${TEMPO_ERSATZ} km/h`,
    daten: 'OpenStreetMap (Tempo), Geoportal Stadt Bern' },
  { id: 'A-Neigung', werk: 'ANNAHME', ordnung: 11, fundstelle: 'Annahme', titel: 'Längsneigung aus dem Höhenmodell', wirkung: 'rechnet mit',
    thema: 'neigung',
    prueft: 'Die App misst die mittlere Neigung entlang der Fahrlinie mit Vortritt über die nötige Sicht. Einzelne Kuppen und Senken ' +
      'prüft sie nicht.',
    werte: `gemessen ab K über mindestens ${PROFIL_MIN_M} m; steile Zufahrt über ${ZUFAHRT_STEIL_PROZENT} % nur Hinweis`,
    daten: 'Höhenmodell swissALTI3D (swisstopo)' },
  { id: 'A-Velo', werk: 'ANNAHME', ordnung: 12, fundstelle: 'Annahme', titel: 'Veloführung aus OpenStreetMap', wirkung: 'rechnet mit',
    thema: 'velo', gilt: mitVelo,
    prueft: 'Ob Velos im Mischverkehr, auf einem Radstreifen oder auf einem Radweg fahren, liest die App aus OpenStreetMap; du kannst es ' +
      'im Panel ändern.',
    werte: `Radstreifen ${m(RADSTREIFEN_M)} m breit; Radweg ohne eigene Linie ${m(RADWEG_BREITE_M)} m breit direkt am Fahrbahnrand`,
    daten: 'OpenStreetMap (Radstreifen, Radwege)' },
  { id: 'A-Velogegen', werk: 'ANNAHME', ordnung: 13, fundstelle: 'Annahme', titel: 'Velos gegen die Einbahn', wirkung: 'rechnet mit',
    thema: 'velo', gilt: e => !!e.zufahrtVelo || e.richtungen.some(r => !!r.veloGegen),
    prueft: 'Dürfen Velos gegen eine Einbahn fahren, rechnet die App sie am für sie rechten Fahrbahnrand. Ist die Zufahrt eine solche ' +
      'Einbahn, wartet dort ein Velo.',
    daten: 'OpenStreetMap (Velos gegen die Einbahn; oneway:bicycle)' },
  { id: 'A-Hindernisse', werk: 'ANNAHME', ordnung: 14, fundstelle: 'Annahme', titel: 'Was als Hindernis zählt', wirkung: 'rechnet mit',
    thema: 'hindernisse',
    prueft: 'Gebäude und Auto-Parkfelder verdecken immer; Parkfelder gelten als besetzt. Hecken, Mauern und Zäune verdecken so, wie du es ' +
      'beim Hindernis angibst; Velo- und Motorradfelder ergeben nur einen Hinweis.',
    werte: `Längsparkierung ${m(LAENGS_BREITE_M, 1)} m breit; gezeichnete Linien ${m(LINIE_PUFFER_M, 1)} m beidseits`,
    daten: 'amtliche Vermessung (Gebäude), Parkfelder, deine Hindernisse' },
  { id: 'A-Darstellung', werk: 'ANNAHME', ordnung: 15, fundstelle: 'Annahme', titel: 'Fahrzeuge auf der Karte', wirkung: 'nur Hinweis',
    thema: 'darstellung',
    prueft: 'Die Fahrzeuge auf Karte und Bild dienen nur der Anschauung. Gerechnet wird mit den Punkten D und K und den Fahrlinien.',
    werte: `Personenwagen ${m(PW_LAENGE_M, 1)} × ${m(PW_BREITE_M, 1)} m, Lenker ${m(LENKER_VOR_FRONT_M, 1)} m hinter der Front; Velo ` +
      `${m(VELO_LAENGE_M, 1)} × ${m(VELO_BREITE_M, 1)} m` },
  // ── Projektentscheide ──
  { id: 'E-1510a', werk: 'ENTSCHEID', ordnung: 1, fundstelle: 'Entscheid 15.10.2026', titel: 'Zwischenwert für Hauptverkehrsstrassen',
    wirkung: 'rechnet mit', thema: 'motorfahrzeuge', gilt: e => nichtRv(e) && e.strasse.typ === 'hvs',
    prueft: 'Für Hauptverkehrsstrassen nennt die Norm einen Bereich. Die App nimmt die Mitte zwischen unterem und oberem Wert.',
    werte: 'Mittel von unterem und oberem Wert, auf ganze Meter aufgerundet' },
  { id: 'E-1510b', werk: 'ENTSCHEID', ordnung: 2, fundstelle: 'Entscheid 15.10.2026', titel: 'Anhaltesichtweite an die Tabelle angeglichen',
    wirkung: 'rechnet mit', thema: 'neigung', gilt: e => e.richtungen.some(r => r.anhalteAngewendet && r.status !== 'keine_zufahrt'),
    prueft: 'Aus dem Diagramm der Anhaltesichtweite zählt nur, um wie viel die Neigung die Strecke verlängert. Bei 0 % trifft es den ' +
      'unteren Wert für Motorfahrzeuge.' },
  { id: 'E-1610a', werk: 'ENTSCHEID', ordnung: 3, fundstelle: 'Entscheid 16.10.2026 (Entscheid 1)', titel: 'Ergebnis je Richtung',
    wirkung: 'rechnet mit', thema: 'motorfahrzeuge',
    prueft: 'Das Ergebnis einer Richtung ist das schlechteste ihrer Teile: Motorfahrzeuge, Überholfall, Velos und Trottoir.' },
  { id: 'E-1610b', werk: 'ENTSCHEID', ordnung: 4, fundstelle: 'Entscheid 16.10.2026 (Entscheid 2)', titel: 'Baumreihe verdeckt ab 5 m',
    wirkung: 'rechnet mit', thema: 'hindernisse', gilt: e => e.richtungen.some(r => !!r.palisade),
    prueft: 'Die Norm nennt kein Mass, ab wann eine Baumreihe die Sicht verdeckt. Die App nimmt eine Fahrzeuglänge.',
    werte: `${m(PALISADE_MIN_M, 1)} m am Stück verdeckt` },
  { id: 'E-1710', werk: 'ENTSCHEID', ordnung: 5, fundstelle: 'Entscheid 17.10.2026', titel: 'Vorgabe der Vortrittsregelung',
    wirkung: 'rechnet mit', thema: 'knoten', gilt: e => !e.regelungGewaehlt,
    prueft: 'Ohne deine Wahl nimmt die App die Vortrittsregelung aus OpenStreetMap; du kannst sie im Panel ändern.',
    werte: 'Signal geht vor; Quartierstrasse mit Tempo bis 30 km/h: Rechtsvortritt; sonst «Kein Vortritt»',
    daten: 'OpenStreetMap (Signale, Strassenklasse, Tempo)' },
  { id: 'E-1710b', werk: 'ENTSCHEID', ordnung: 6, fundstelle: 'Entscheid 17.10.2026', titel: 'Rechtsvortritt: von rechts nur Velos',
    wirkung: 'rechnet mit', thema: 'rechtsvortritt', gilt: e => !!e.rechtsvortritt?.arm.nurVelo,
    prueft: 'Kommen beim Rechtsvortritt von rechts nur Velos, prüft die App die Sicht auf sie mit den Werten für Velos.',
    werte: 'VSS 40 273 Tab. 3 mit dem Tempo der Strasse statt Abb. 6',
    daten: 'OpenStreetMap (Velos gegen die Einbahn)' },
  { id: 'E-3110a', werk: 'ENTSCHEID', ordnung: 7, fundstelle: 'Entscheid 31.10.2026', titel: 'Neigung unbekannt: strengster Wert',
    wirkung: 'rechnet mit', thema: 'neigung',
    gilt: e => e.richtungen.some(r => r.neigungUnbekannt) || !!e.trottoirPruefung?.richtungen.some(t => t.neigungUnbekannt),
    prueft: 'Gibt es kein brauchbares Höhenprofil und keine Eingabe, rechnet die App auf der sicheren Seite mit dem strengsten Wert.',
    werte: `Velos: Spalte ≤ −4 %; Trottoir: Spalte ≤ −6 %; Anhaltesichtweite bei ${proz(ANHALTESICHT_I_MIN)}`,
    daten: 'Höhenmodell swissALTI3D' },
  { id: 'E-3110b', werk: 'ENTSCHEID', ordnung: 8, fundstelle: 'Entscheid 31.10.2026', titel: 'Gestrichelte Kurven im Diagramm',
    wirkung: 'nur Hinweis', thema: 'neigung', gilt: e => e.richtungen.some(r => r.anhalteAngewendet && r.status !== 'keine_zufahrt'),
    prueft: 'Wo die Kurve der Anhaltesichtweite nur gestrichelt ist, rechnet die App mit dem abgelesenen Wert, bezeichnet ihn aber als ' +
      'unsicher.' },
  { id: 'E-3110d', werk: 'ENTSCHEID', ordnung: 10, fundstelle: 'Entscheid 31.10.2026', titel: 'Nur Zufahrten mit Wartepflicht wählbar',
    wirkung: 'rechnet mit', thema: 'knoten',
    prueft: 'Arme, aus denen niemand zum Knoten fährt oder die sicher Vortritt haben, bietet die App nicht als Zufahrt an.',
    werte: 'Einbahn vom Knoten weg ohne Velos: keine Zufahrt; Arme der Strasse mit Vortritt bei Signal oder Hauptstrasse nur über den ' +
      'Schalter',
    daten: 'OpenStreetMap (Einbahnen, Signale, Hauptstrasse; priority_road)' },
  { id: 'E-3110e', werk: 'ENTSCHEID', ordnung: 11, fundstelle: 'Entscheid 31.10.2026', titel: 'Signal zählt nur mit Verkehr zum Knoten',
    wirkung: 'rechnet mit', thema: 'knoten',
    prueft: 'Ein Stop- oder Kein-Vortritt-Signal ordnet die App nur einem Arm zu, auf dem Verkehr zum Knoten fährt. Steht es auf einer ' +
      'Einbahn vom Knoten weg, gehört es zum nächsten Knoten.',
    daten: 'OpenStreetMap (Signale, Einbahnen)' },
  { id: 'E-3110c', werk: 'ENTSCHEID', ordnung: 9, fundstelle: 'Entscheid 31.10.2026', titel: 'Fahrlinien folgen der Fahrbahn',
    wirkung: 'rechnet mit', thema: 'motorfahrzeuge',
    prueft: 'Die Fahrlinien folgen dem Fahrbahnrand Stelle für Stelle, auch in Kurven und bei wechselnder Breite.',
    daten: 'amtliche Vermessung (Fahrbahn)' },
]

/** alle Regeln; die Herkunft folgt aus dem Werk */
export const REGELN: readonly Regel[] = EINTRAEGE.map(r => ({ ...r, herkunft: WERKE[r.werk].herkunft }))

/** Regeln eines Werks in der Reihenfolge der Fundstellen */
export const regelnVonWerk = (w: WerkId): Regel[] => REGELN.filter(r => r.werk === w).sort((a, b) => a.ordnung - b.ordnung)
/** Zahl der Regeln je Werk (Quellentabelle) */
export function regelnJeWerk(): Map<WerkId, number> {
  const n = new Map<WerkId, number>(WERK_IDS.map(w => [w, 0]))
  for (const r of REGELN) n.set(r.werk, (n.get(r.werk) ?? 0) + 1)
  return n
}
/** Zahl der Regeln je Herkunft (in der Reihenfolge von HERKUNFT) und je Wirkung */
export function regelnZaehlen(): { herkunft: [Herkunft, number][]; wirkung: Record<Wirkung, number> } {
  const wirkung: Record<Wirkung, number> = { 'rechnet mit': 0, 'nur Hinweis': 0 }
  for (const r of REGELN) wirkung[r.wirkung]++
  return { herkunft: HERKUNFT.map(h => [h, REGELN.filter(r => r.herkunft === h).length] as [Herkunft, number]).filter(x => x[1] > 0), wirkung }
}
/** im Fall angewendete Regeln, je Werk in Normreihenfolge (Bericht) */
export function regelnDesFalls(e: Ergebnis): { werk: WerkId; regeln: Regel[] }[] {
  return WERK_IDS.map(w => ({ werk: w, regeln: regelnVonWerk(w).filter(r => !r.gilt || r.gilt(e)) })).filter(x => x.regeln.length)
}

export type Gliederung = 'quelle' | 'thema'
export interface RegelGruppe { schluessel: string; name: string; regeln: Regel[]; herkunft?: Herkunft }
/** Gruppen für die Regelübersicht: nach Quelle (Werke in Normreihenfolge, mit Herkunft) bzw. nach Thema (Themen, darin
 *  Normreihenfolge) */
export function regelGruppen(nach: Gliederung): RegelGruppe[] {
  if (nach === 'quelle') return WERK_IDS.map(w => ({ schluessel: `werk-${w}`, name: `${WERKE[w].name} (${WERKE[w].ausgabe})`,
    herkunft: WERKE[w].herkunft, regeln: regelnVonWerk(w) })).filter(g => g.regeln.length)
  const rang = new Map(WERK_IDS.map((w, i) => [w, i]))
  return THEMEN.map(([t, name]) => ({ schluessel: `thema-${t}`, name, regeln: REGELN.filter(r => r.thema === t)
    .sort((a, b) => rang.get(a.werk)! - rang.get(b.werk)! || a.ordnung - b.ordnung) })).filter(g => g.regeln.length)
}
/** Anker der Werkzeile in der Quellentabelle bzw. der Werkgruppe in der Regelübersicht */
export const werkAnker = (w: WerkId) => `quelle-${w}`
export const regelWerkAnker = (w: WerkId) => `regeln-${w}`
