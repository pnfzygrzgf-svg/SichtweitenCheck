import { swcSichtMasse, massBildPunkte } from './sichtMasse'
import { ZUFAHRT_HERKUNFT } from './rechner/grundstueck'
import { MassBild, useSichtWahl, sichtZeigen, sichtMassZeigen, richtungSichtId, type SichtArt, type SichtWahl } from './Sichtfelder'
import { bundBelegText } from './daten/anbieter/gemeinsam/bundBelege'
import { signalText } from './daten/anbieter/gemeinsam/regionalSignale'
import { BerichtQuellenTabelle, berichtQuellenZeilen } from './BerichtQuellen'
// ── Bericht (E4a): Druckansicht eines Falls, als PDF über den Druckdialog des Browsers ──
//
// Vorlage: Bericht.tsx des fgsCheck. Eigene Ansicht über der App (die Karte bleibt darunter bestehen), als Portal direkt im body,
// A4 hoch per @media print (index.css). Das Kartenbild ist KEIN Leaflet-Ausschnitt (Kacheln laden beim Drucken oft nicht fertig,
// Leaflet verschiebt Ebenen mit CSS-Transforms), sondern ein einziges Luftbild per WMS (wms.geo.admin.ch, EPSG:2056) mit einer
// SVG-Zeichnung darüber, beides in LV95 (berichtbild.ts: Ausschnitt, Bildgrösse, Umrechnung). «Drucken» wird erst frei, wenn das
// Bild geladen ist bzw. nicht geladen werden konnte oder nach BILD_ZEITGRENZE_MS nicht da ist (dann ohne Hintergrund, mit
// Hinweis); danach lädt das Bild weiter und erscheint, sobald es eintrifft; «erneut versuchen» fragt die URL neu an.
// Normbezüge nur als Nummer, Ziffer, Tabelle und Zahlenwerte, kein Normtext. Status zusätzlich als Zeichen und Text (texte.ts),
// im Bild zusätzlich als Strichart (frei durchgezogen, verdeckt gestrichelt): schwarz-weiss lesbar.

import { memo, useEffect, useMemo, useState } from 'react'
import { regelnDesFalls, WERKE } from './regeln'
import { RegelnFall } from './RegelUebersicht'
import { createPortal } from 'react-dom'
import type { Fall } from './fall'
import { BEZEICHNUNG_MAX } from './fall'
import type { Ergebnis, Rechnung, RichtungErgebnis, Richtung, VerdeckerEintrag, RvArm, KnotenInfo } from './rechner/typen'
import { armText, nachNr } from './rechner/knoten'
import { lageKurz, lageText } from './rechner/lage'
import type { AvFlaeche } from './daten/av'
import { hindernisRing, type Hindernis } from './rechner/hindernisse'
import { autoUmriss, autoScheibe, fbLage, fbVeloLage, faAnzeige, veloTeile, veloLage, PW_LAENGE_M, VELO_LAENGE_M } from './rechner/fahrzeug'
import { wgs, add, dist, type P, sub } from './geo'
import { wmsBildUrl, ladeFlugjahr } from './daten/luftbild'
import { NR_GEWAEHLT_FARBE, AV_FARBEN, STATUS_FARBE, FREI_FARBE, VERDECKT_FARBE, D_FARBE, D_RAND_FARBE, D_HAND_FARBE, ZUFAHRT_FARBE, FB_FARBE, FA_FARBE, VELO_FARBE, TROTTOIR_FARBE,
  TREFFER_FARBE, hindernisFarbe, hindernisText } from './Karte'
import { ausschnitt, bildPixel, svgAbbildung, massstab, berichtPunkte, imAusschnitt, schilder, VB, type QuellenStand } from './berichtbild'
/** Farbprobe in der Bildlegende: Fläche, Linie (gestrichelt), Rand (Umriss) oder Punkt; dunkel: dunkler Grund für helle Farben */
function Probe({ art, farbe, rand, strich, deckung = 1, dunkel = false }: { art: 'flaeche' | 'linie' | 'rand' | 'punkt'; farbe: string; rand?: string
  strich?: string; deckung?: number; dunkel?: boolean }) {
  return <svg className="probe" viewBox="0 0 30 14" width="30" height="14" aria-hidden="true">
    {dunkel && <rect x="0" y="0" width="30" height="14" rx="2" fill="#4b5563" />}
    {art === 'flaeche' && <rect x="2" y="2" width="26" height="10" rx="2" fill={farbe} fillOpacity={deckung} stroke={rand ?? farbe} strokeWidth="1.5" />}
    {art === 'linie' && <line x1="2" y1="7" x2="28" y2="7" stroke={farbe} strokeWidth="2.5" strokeDasharray={strich} />}
    {art === 'rand' && <rect x="2" y="2" width="26" height="10" rx="2" fill="none" stroke={farbe} strokeWidth="2.5" strokeDasharray={strich} />}
    {art === 'punkt' && <circle cx="15" cy="7" r="5" fill={farbe} stroke={rand ?? '#111827'} strokeWidth="2" />}
  </svg>
}
/** Hindernisart für die Legende: «Parkfeld Auto», «Baum», … */
function hindernisArtText(h: Hindernis): string {
  const klasse: Record<string, string> = { auto: 'Auto', velo: 'Velo', motorrad: 'Motorrad' }
  const art: Record<string, string> = { laengsparkierung: 'Längsparkierung', baum: 'Baum', hecke: 'Hecke', mauer: 'Mauer', zaun: 'Zaun', uebrige: 'übriges Hindernis' }
  return h.art === 'parkfeld' ? `Parkfeld ${klasse[h.klasse] ?? h.klasse}` : art[h.art] ?? h.art
}
/** Satz zu den dargestellten Sichtfeldern: je Richtung und Art, mit den ausgeblendeten */
function sichtSatz(e: Ergebnis, w: SichtWahl): string {
  const an: string[] = [], aus: string[] = []
  const tu = (text: string, zeigt: boolean) => (zeigt ? an : aus).push(text)
  for (const r of e.richtungen) {
    if (r.status !== 'keine_zufahrt') tu(`Auto ${lageKurz(r)}`, sichtZeigen(w, 'auto', richtungSichtId(e, r)))
    if (r.velo) tu(`Velo ${lageKurz(r)}`, sichtZeigen(w, 'velo', richtungSichtId(e, r)))
    if (r.ueberholfall) tu(`Überholsicht ${lageKurz(r)}`, sichtZeigen(w, 'ueberholen', richtungSichtId(e, r)))
  }
  for (const t of e.trottoirPruefung?.richtungen ?? []) tu(`Trottoir ${lageKurz(t)}`, sichtZeigen(w, 'trottoir', richtungSichtId(e, t)))
  return `Sichtfelder im Bild: ${an.length ? an.join(', ') : 'keine'}${aus.length ? `; ausgeblendet: ${aus.join(', ')}` : ''}` +
    `${w.masse && an.length ? '; mit Vermassung' : ''}. Die Ergebnisse unten enthalten alle Sichtarten.`
}
/** Fahrzeugsymbole im Kartenbild mindestens so lang [px der Zeichenfläche VB], Velo 80 % davon (nur Darstellung, Front liegt richtig) */
const SYMBOL_MIN_PX = 48
import { f1, f2, fi, autoText, gesamtText, statusMarke, STATUS_TEXT_TEIL, RV_STATUS_TEXT, TUE_BREITE_KURZ, tuePhaseText } from './texte'
import { TUE_GEHLINIE_M } from './rechner/trottoirueberfahrt'
import { REGELUNG_TEXT, TEMPO_ART_TEXT, LSA_TEXT } from './rechner/rechnen'
import { STRASSENTYP_TEXT, UNGUNST_TEXT, NEIGUNG_EBEN_PROZENT, SCHWERVERKEHR_PROZENT, UNGUNST_MASSE_TEXT } from './rechner/sichtweite'
import { VELOFUEHRUNG_TEXT } from './rechner/velo'
import { WAHRNEHMBARKEIT_TEXT, ZUSTAND_TEXT, RV_A_M, RV_A_MIN_M, SCHMAL_M, ENG_LAENGE_M, ENG_SCHRITT_M } from './rechner/rechtsvortritt'
import { HALTELINIE_MIN_M } from './rechner/massnahmen'
import { bfuVelo, bfuTrottoir } from './rechner/bfu'
import { FAHRERSITZ_M, B_INNERORTS_M } from './rechner/beobachtung'

import { MARKE, APP_ADRESSE } from './marke'
const NEIGUNG_ZEITGRENZE_MS = 20000    // Längsneigung: danach Drucken mit vorläufig 0 % (Hinweis im Bericht)
const BILD_ZEITGRENZE_MS = 20000       // danach gilt das Bild als nicht geladen (Drucken ohne Hintergrund)
const WIRKUNG_TEXT: Record<string, string> = { voll: 'verdeckt', palisade: 'Palisade', hinweis: 'nur Hinweis' }
/** Strichart je Status im Bild (zusätzlich zur Farbe) */
const STRICH_VERDECKT = '14 7'
const STRICH_VELO = '12 7'
const STRICH_VELO_VERDECKT = '3 4'

const datum = (d: Date) => d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
const datumIso = (s: string | undefined) => (s ? datum(new Date(s)) : '–')
const tausender = (x: number) => x.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, '’').replace('.', ',')
/** Status mit dem oberen Wert als Zahl */
const gesamtMitWert = (r: RichtungErgebnis): string => gesamtText(r).replace('oberer Wert', `oberer Wert ${r.erforderlichOben} m`)
/** Werke, die der Bericht nennt, ohne dass sie das Ergebnis tragen: ihre Rolle steht dabei */
function nebenWerke(e: Ergebnis): string[] {
  const rs = e.richtungen.filter(r => r.status !== 'keine_zufahrt')
  const u = e.strasse.ungunst
  const ausgeloest = [u.fahrstreifen && 'Fahrstreifen', u.neigung && 'Gefälle', u.schwerverkehr && 'Schwerverkehr'].filter(Boolean)
  return [
    ...(rs.some(r => r.anhalte && !r.anhalteAngewendet) ? [`${WERKE['40090'].name} (2019-03), Abb. 2, S. 5: Anhaltesichtweite geprüft, hier nicht angewendet`] : []),
    ...(e.richtungen.some(r => r.velo) ? [`${WERKE.BFU.name} (2022), Tab. 2, S. 5: Vergleichswert Velo`] : []),
    ...(!e.rechtsvortritt ? [`${WERKE.SO.name}, S. 3: Masse für ungünstige Verhältnisse auch ausserhalb des Kantons angewendet; ${ausgeloest.length ? `ausgelöst durch ${ausgeloest.join(', ')}` : 'hier nicht ausgelöst'}`] : []),
  ]
}
const vorhandenText = (vorhanden: number, bisEnde: boolean) => `${bisEnde ? '≥ ' : ''}${f1(vorhanden)} m`

/** Hindernisse für das Bild: Eingaben des Falls und die zählenden amtlichen Parkfelder */
function bildHindernisse(fall: Fall, e: Ergebnis): Hindernis[] {
  return [...fall.hindernisse, ...e.hindernis.amtlich.map(v => v.hindernis)]
}

const BerichtKarte = memo(function BerichtKarte({ e, kn, av, hindernisse, onBereit }: { e: Ergebnis; kn: KnotenInfo | null; av: AvFlaeche[]
  hindernisse: Hindernis[]; onBereit: (s: 'laedt' | 'ok' | 'fehler') => void }) {
  const [sicht] = useSichtWahl()
  const masse = useMemo(() => swcSichtMasse(e, kn), [e, kn])
  const box = useMemo(() => {
    const punkte = berichtPunkte(e, kn)
    let box = ausschnitt(punkte)
    if (sicht.masse) for (let i = 0; i < 3; i++) box = ausschnitt([...punkte,
      ...massBildPunkte(masse.filter(m => sichtMassZeigen(sicht, m)), box[2] - box[0])])
    return box
  }, [e, kn, masse, sicht])
  const wM = box[2] - box[0], hM = box[3] - box[1]
  const { breite: bw, hoehe: bh } = bildPixel(box)
  const { s, vh, xy } = svgAbbildung(box)
  // erneut versuchen: dieselbe Anfrage mit Zusatzparameter (der Dienst übergeht ihn; der Browser fragt neu an)
  const [versuch, setVersuch] = useState(0)
  const basis = wmsBildUrl(box, bw, bh)
  const url = versuch ? `${basis}&SWCVERSUCH=${versuch}` : basis
  const pt = (p: P) => { const [x, y] = xy(p); return `${x.toFixed(1)},${y.toFixed(1)}` }
  const pfad = (ringe: P[][], zu = true) => ringe.filter(x => x.length).map(x => 'M' + x.map(pt).join('L') + (zu ? 'Z' : '')).join(' ')
  const linie = (l: P[]) => l.map(pt).join(' ')
  // Ladezustand je Bild-URL: laedt, ok, fehler (onError) bzw. zeit (nach BILD_ZEITGRENZE_MS ohne Antwort: Drucken ohne
  // Hintergrund frei, das Bild lädt weiter und erscheint mit onLoad)
  const [geladen, setGeladen] = useState<{ url: string; stand: 'ok' | 'fehler' | 'zeit' } | null>(null)
  const status: 'laedt' | 'ok' | 'fehler' | 'zeit' = geladen?.url !== url ? 'laedt' : geladen.stand
  useEffect(() => { onBereit(status === 'zeit' ? 'fehler' : status) }, [status, onBereit])
  useEffect(() => {
    const t = setTimeout(() => setGeladen(g => (g?.url === url ? g : { url, stand: 'zeit' })), BILD_ZEITGRENZE_MS)
    return () => clearTimeout(t)
  }, [url])
  const mass = massstab(wM)
  const halo = { stroke: '#ffffff', strokeWidth: 5, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const }
  const flaechen = av.filter(f => (f.art === 'Strasse_Weg' || f.art === 'Gebaeude') && f.ringe[0] && imAusschnitt(f.ringe[0], box))
  const hind = hindernisse.map(h => ({ h, ring: hindernisRing(h) })).filter(x => x.ring.length >= 3 && imAusschnitt(x.ring, box))
  const treffer: VerdeckerEintrag[] = []
  for (const r of e.richtungen) { if (sichtZeigen(sicht, 'auto', richtungSichtId(e, r))) treffer.push(...r.verdeckerListe); if (r.velo && sichtZeigen(sicht, 'velo', richtungSichtId(e, r))) treffer.push(...r.velo.verdeckerListe)
    if (r.ueberholfall && sichtZeigen(sicht, 'ueberholen', richtungSichtId(e, r))) treffer.push(...r.ueberholfall.verdeckerListe) }
  for (const t of (e.trottoirPruefung?.richtungen ?? []).filter(t => sichtZeigen(sicht, 'trottoir', richtungSichtId(e, t)))) treffer.push(...t.verdeckerListe)
  const kreis = (p: P, r: number, fill: string, stroke = '#111827', w = 1.5) => {
    const [x, y] = xy(p)
    return <circle cx={x} cy={y} r={r} fill={fill} stroke={stroke} strokeWidth={w} />
  }
  const beschriftung = (p: P, text: string, dx = 8, dy = -8, gross = 18) => {
    const [x, y] = xy(p)
    return <text x={x + dx} y={y + dy} fontSize={gross} fontWeight={700} fill="#000000" {...halo}>{text}</text>
  }
  /** Beschriftung am Ende von A: in der rechten Bildhälfte nach links ausgerichtet (sonst am Bildrand abgeschnitten) */
  const beschriftungA = (p: P, text: string) => {
    const [x, y] = xy(p), rechts = x > VB / 2
    return <text x={x + (rechts ? -9 : 9)} y={y - 10} fontSize={17} fontWeight={700} fill="#000000" textAnchor={rechts ? 'end' : 'start'}
      {...halo}>{text}</text>
  }
  // Fahrzeuge als Symbole: bei grossem Ausschnitt (z. B. 190 m Breite) wäre ein Auto 15 px und ein Velo 6 px lang und im Bericht nicht
  // erkennbar. Darum mindestens SYMBOL_MIN_PX lang, vergrössert um den Ankerpunkt (die Front, die bei A bzw. an der Kante liegt).
  const pxJeM = VB / wM
  const vergroessert = (ring: P[], anker: P, laengeM: number, minPx: number): P[] => {
    const f = Math.max(1, minPx / (laengeM * pxJeM))
    return f === 1 ? ring : ring.map(q => add(anker, sub(q, anker), f))
  }
  const auto = (mitte: P, richtung: P, farbe: string, rand: string) => {
    const front = add(mitte, richtung, PW_LAENGE_M / 2)
    return <>
      <path d={pfad([vergroessert(autoUmriss(mitte, richtung), front, PW_LAENGE_M, SYMBOL_MIN_PX)])} fill={farbe} stroke={rand} strokeWidth={1.5} />
      <path d={pfad([vergroessert(autoScheibe(mitte, richtung), front, PW_LAENGE_M, SYMBOL_MIN_PX)])} fill="#94a3b8" stroke="#94a3b8" strokeWidth={1} />
    </>
  }
  const fbA = e.fbDachse ?? e.Dachse
  const fb = fbLage(fbA, add(fbA, e.fbRichtung))
  // Velo gegen die Einbahn auf der Zufahrt (E4): F_B als Velo, velofahrende Person bei D
  const fbVelo = e.zufahrtVelo ? fbVeloLage(fbA, add(fbA, e.fbRichtung)) : null
  const velo = (l: [P, P], key: string, fb = false) => veloTeile(l[0], l[1]).map((t, k) => <path key={key + k}
    d={pfad([vergroessert(t, add(l[0], l[1], VELO_LAENGE_M / 2), VELO_LAENGE_M, SYMBOL_MIN_PX * 0.8)])}
    fill={fb ? FB_FARBE : k === 3 ? '#111827' : VELO_FARBE} stroke={fb ? '#ffffff' : '#0f172a'} strokeWidth={1.5} paintOrder="stroke" />)
  const m = e.rechtsvortritt?.arm.sichtfeld
  // Legende: nur, was im Bild vorkommt, je Zeile eine Farbprobe und ein kurzer Text
  const zeigt = (art: SichtArt, r: { richtung: Richtung }) => sichtZeigen(sicht, art, richtungSichtId(e, r))
  const autoDa = e.richtungen.some(r => r.status !== 'keine_zufahrt' && zeigt('auto', r)) || !!m
  const veloDa = e.richtungen.some(r => r.velo && zeigt('velo', r))
  const trottoirDa = (e.trottoirPruefung?.richtungen ?? []).some(t => zeigt('trottoir', t))
  const ueberholDa = e.richtungen.some(r => r.ueberholfall && zeigt('ueberholen', r))
  const hindArten = [...new Map(hind.map(({ h }) => [hindernisFarbe(h) + hindernisArtText(h), { farbe: hindernisFarbe(h), text: hindernisArtText(h) }])).values()]
  const wirkungen = new Set(treffer.map(t => t.wirkung))
  const legende: { probe: React.ReactNode; text: React.ReactNode }[] = [
    { probe: <Probe art="flaeche" farbe={AV_FARBEN.Strasse_Weg} rand="#6b7280" />, text: 'Fahrbahn und Gebäude (amtliche Vermessung)' },
    ...(autoDa ? [{ probe: <><Probe art="linie" farbe={FREI_FARBE} /><Probe art="linie" farbe={VERDECKT_FARBE} strich="6 4" /></>,
      text: 'Sichtdreieck Auto von D bis A: grün frei, rot gestrichelt verdeckt' }] : []),
    ...(veloDa ? [{ probe: <Probe art="linie" farbe={VELO_FARBE} strich="6 4" />, text: 'Sichtdreieck Velo von D bis A (verdeckt rot fein gestrichelt); Veloachse fein gestrichelt' }] : []),
    ...(trottoirDa ? [{ probe: <Probe art="linie" farbe={TROTTOIR_FARBE} />, text: "Sichtdreieck Trottoir von D' (verdeckt rot gestrichelt); Zufussgehende als Ring am Ende von A" }] : []),
    ...(ueberholDa ? [{ probe: <Probe art="linie" farbe={FREI_FARBE} strich="2 3" />, text: 'Überholfall (ausserorts, Ziffer 6): feines Sichtdreieck auf den Gegenfahrstreifen' }] : []),
    { probe: <Probe art="linie" farbe="#ffffff" strich="6 4" dunkel />, text: 'Fahrstreifenachse ab K, Beschriftung am Ende von A' },
    { probe: <Probe art="linie" farbe={ZUFAHRT_FARBE} strich="6 4" dunkel />, text: e.zufahrtVelo ? 'Achse des Velogegenverkehrs auf der Zufahrt' : 'Zufahrtsachse' },
    ...(e.haltelinie ? [{ probe: <Probe art="linie" farbe="#ffffff" dunkel />, text: 'Halte- oder Wartelinie (Vorderkante)' }] : []),
    { probe: <Probe art="flaeche" farbe={FB_FARBE} rand="#ffffff" dunkel />, text: e.zufahrtVelo ? <>F<sub>B</sub>: Velo gegen die Einbahn auf der Zufahrt, velofahrende Person bei D</> :
      <>F<sub>B</sub>: wartendes Fahrzeug auf der Zufahrt, D am Fahrer*innensitz</> },
    ...(e.richtungen.some(r => r.status !== 'keine_zufahrt') ? [{ probe: <Probe art="flaeche" farbe={FA_FARBE} rand="#111827" />,
      text: <>F<sub>A</sub>: Fahrzeug mit Vortritt, Front am Ende von A (Symbol; bei grossem Ausschnitt vergrössert)</> }] : []),
    ...(e.richtungen.some(r => r.velo) ? [{ probe: <Probe art="flaeche" farbe={VELO_FARBE} rand={VELO_FARBE} />, text: 'Velo mit Vortritt, Vorderrad am Ende von A (Symbol)' }] : []),
    ...hindArten.map(x => ({ probe: <Probe art="flaeche" farbe={x.farbe} rand={x.farbe} deckung={0.4} />, text: `Hindernis: ${x.text}` })),
    ...(wirkungen.has('voll') ? [{ probe: <Probe art="rand" farbe={TREFFER_FARBE.voll} />, text: 'Rand dunkelrot: verdeckt das Sichtdreieck bis A' }] : []),
    ...(wirkungen.has('palisade') ? [{ probe: <Probe art="rand" farbe={TREFFER_FARBE.palisade} />, text: 'Rand gelb: Palisade (Bäume)' }] : []),
    ...(wirkungen.has('hinweis') ? [{ probe: <Probe art="rand" farbe={TREFFER_FARBE.hinweis} strich="6 4" />, text: 'Rand violett gestrichelt: nur Hinweis (Zweiräder, Zaun)' }] : []),
    { probe: <Probe art="punkt" farbe={D_FARBE} rand={e.Dhand ? D_HAND_FARBE : D_RAND_FARBE} />, text: `D: Augpunkt ${e.zufahrtVelo ? 'der velofahrenden Person' : 'am Fahrer*innensitz'}${e.Dhand ? ', oranger Rand: von Hand' : ''}` },
    ...(e.trottoirPruefung ? [{ probe: <Probe art="punkt" farbe={TROTTOIR_FARBE} rand="#111827" />, text: "D': Augpunkt für die Sicht aufs Trottoir" }] : []),
    { probe: <Probe art="punkt" farbe="#ffffff" rand="#111827" />, text: 'K: Kreuzungspunkt der Zufahrtsachse mit der Fahrstreifenachse' },
    ...(kn ? [{ probe: <Probe art="punkt" farbe={NR_GEWAEHLT_FARBE} rand="#0f172a" />, text: `Nummern: Arme im Uhrzeigersinn ab Norden${kn.grundstueck ? ', Z = Grundstückzufahrt' : ''}; grün die gewählte Zufahrt` }] : []),
    ...(m ? [{ probe: <Probe art="linie" farbe="#6b7280" strich="8 3 2 3" />, text: `Rechtsvortritt, schmale Zufahrt (Abb. 5): Sichtlinien von D alle ${ENG_SCHRITT_M} m auf dem Pfad über den Schnitt der Achsen; grau frei, rot verdeckt, dick rot die erste verdeckte` }] : []),
  ]
  return (
    <figure className="bericht-karte">
      <div className="bericht-bild" style={{ aspectRatio: `${bw} / ${bh}` }}>
        {(status === 'fehler' || status === 'zeit') && <div className="bericht-ohne-bild klein">ohne Luftbild</div>}
        {status !== 'fehler' && <img key={url} src={url} alt="Luftbild SWISSIMAGE des Ausschnitts"
          style={status === 'zeit' ? { visibility: 'hidden' } : undefined}
          onLoad={() => setGeladen({ url, stand: 'ok' })} onError={() => setGeladen({ url, stand: 'fehler' })} />}
        <svg viewBox={`0 0 ${VB} ${vh.toFixed(1)}`} preserveAspectRatio="none"
          aria-label="Sichtdreiecke, Achsen, Beobachtungspunkt, Fahrzeuge und Hindernisse">
          {/* AV dezent: Fahrbahn und Gebäude */}
          {flaechen.map((f, i) => <path key={'av' + i} d={pfad(f.ringe)} fillRule="evenodd" fill={AV_FARBEN[f.art]}
            fillOpacity={f.art === 'Gebaeude' ? 0.35 : 0.18} stroke={AV_FARBEN[f.art]} strokeOpacity={0.6} strokeWidth={1} />)}
          {/* Sichtdreiecke Auto: frei grün durchgezogen, verdeckt rot gestrichelt */}
          {e.richtungen.filter(r => sichtZeigen(sicht, 'auto', richtungSichtId(e, r)) && r.status !== 'keine_zufahrt').map(r => <g key={'d' + r.richtung}>
            {r.dreieckFrei.length >= 3 && <path d={pfad([r.dreieckFrei])} fill={FREI_FARBE} fillOpacity={0.3} stroke={FREI_FARBE} strokeWidth={2} />}
            {r.dreieckVerdeckt.length >= 3 && <path d={pfad([r.dreieckVerdeckt])} fill={VERDECKT_FARBE} fillOpacity={0.3} stroke={VERDECKT_FARBE}
              strokeWidth={2} strokeDasharray={STRICH_VERDECKT} />}
          </g>)}
          {/* Überholfall (Block 5): zweites Sichtdreieck auf den Gegenfahrstreifen, schwach und fein gestrichelt */}
          {e.richtungen.map(r => sichtZeigen(sicht, 'ueberholen', richtungSichtId(e, r)) && r.ueberholfall && <g key={'u' + r.richtung}>
            {r.ueberholfall.dreieckFrei.length >= 3 && <path d={pfad([r.ueberholfall.dreieckFrei])} fill={FREI_FARBE} fillOpacity={0.1}
              stroke={FREI_FARBE} strokeWidth={1.5} strokeDasharray="3 5" />}
            {r.ueberholfall.dreieckVerdeckt.length >= 3 && <path d={pfad([r.ueberholfall.dreieckVerdeckt])} fill={VERDECKT_FARBE} fillOpacity={0.12}
              stroke={VERDECKT_FARBE} strokeWidth={1.5} strokeDasharray="3 5" />}
          </g>)}
          {/* Trottoir: Bernstein, verdeckt rot gestrichelt */}
          {(e.trottoirPruefung?.richtungen ?? []).filter(t => sichtZeigen(sicht, 'trottoir', richtungSichtId(e, t))).map(t => <g key={'t' + t.richtung}>
            {t.dreieckFrei.length >= 3 && <path d={pfad([t.dreieckFrei])} fill={TROTTOIR_FARBE} fillOpacity={0.3} stroke={TROTTOIR_FARBE} strokeWidth={2} />}
            {t.dreieckVerdeckt.length >= 3 && <path d={pfad([t.dreieckVerdeckt])} fill={VERDECKT_FARBE} fillOpacity={0.3} stroke={VERDECKT_FARBE}
              strokeWidth={2} strokeDasharray={STRICH_VERDECKT} />}
            <polyline points={linie(t.achse)} fill="none" stroke={TROTTOIR_FARBE} strokeWidth={2} strokeDasharray="3 5" />
          </g>)}
          {/* Trottoirüberfahrt (K0): Band von der Bordkante zum hinteren Rand auf der Zufahrtsachse */}
          {e.trottoirueberfahrt && <polyline points={linie([e.trottoirueberfahrt.vorderkante, e.trottoirueberfahrt.hinterkante])} fill="none"
            stroke={TROTTOIR_FARBE} strokeWidth={6} strokeOpacity={0.8} />}
          {/* Hindernisse in den Kartenfarben */}
          {hind.map(({ h, ring }) => <path key={'h' + h.id} d={pfad([ring])} fill={hindernisFarbe(h)} fillOpacity={0.4}
            stroke={hindernisFarbe(h)} strokeWidth={2} />)}
          {/* Verdecker im Sichtdreieck bis A: Rand rot (verdeckt), gelb (Palisade), violett gestrichelt (nur Hinweis) */}
          {treffer.map((t, i) => <path key={'v' + i} d={pfad([t.ring])} fill="none" stroke={t.wirkung === 'voll' ? '#7f1d1d' : TREFFER_FARBE[t.wirkung]}
            strokeWidth={3} strokeDasharray={t.wirkung === 'hinweis' ? '6 4' : undefined} />)}
          {/* Velo: Türkis gestrichelt, verdeckt rot gestrichelt; Veloachse */}
          {e.richtungen.map(r => sichtZeigen(sicht, 'velo', richtungSichtId(e, r)) && r.velo && <g key={'velo' + r.richtung}>
            {r.velo.dreieckFrei.length >= 3 && <path d={pfad([r.velo.dreieckFrei])} fill={VELO_FARBE} fillOpacity={0.08} stroke={VELO_FARBE}
              strokeWidth={2.5} strokeDasharray={STRICH_VELO} />}
            {r.velo.dreieckVerdeckt.length >= 3 && <path d={pfad([r.velo.dreieckVerdeckt])} fill={VERDECKT_FARBE} fillOpacity={0.12}
              stroke={VERDECKT_FARBE} strokeWidth={3.5} strokeDasharray={STRICH_VELO_VERDECKT} />}
            <polyline points={linie(r.velo.achse)} fill="none" stroke={VELO_FARBE} strokeWidth={2} strokeDasharray="4 5" />
          </g>)}
          {/* Rechtsvortritt, schmale Zufahrt (Abb. 5, Konstruktion nach bfu BM.021 Abb. 4): Pfad und Fächer der Sichtlinien von D */}
          {m && sichtZeigen(sicht, 'auto', richtungSichtId(e, { richtung: 'rechts' })) && <g>
            <polyline points={linie(m.pfad)} fill="none" stroke="#111827" strokeWidth={1.5} strokeDasharray="8 3 2 3" />
            {m.linien.filter(l => l.frei).map((l, i) => <polyline key={'pf' + i} points={linie([m.D, l.p])}
              fill="none" stroke="#64748b" strokeOpacity={0.45} strokeWidth={1} />)}
            {m.linien.filter(l => !l.frei).map((l, i) => <polyline key={'pv' + i} points={linie([m.D, l.p])} fill="none"
              stroke={VERDECKT_FARBE} strokeWidth={m.erste && l.s === m.erste.s ? 4 : 2} />)}
          </g>}
          {/* Zufahrtsachse, Fahrstreifenachsen mit K und Ende von A */}
          <polyline points={linie(e.zufahrtAchse)} fill="none" stroke={ZUFAHRT_FARBE} strokeWidth={3} strokeDasharray="8 6" />
          {e.richtungen.filter(r => sichtZeigen(sicht, 'auto', richtungSichtId(e, r)) && r.status !== 'keine_zufahrt').map(r => <g key={'a' + r.richtung}>
            <polyline points={linie(r.achse)} fill="none" stroke="#111827" strokeWidth={4} strokeOpacity={0.6} />
            <polyline points={linie(r.achse)} fill="none" stroke="#ffffff" strokeWidth={2} strokeDasharray="8 6" />
          </g>)}
          {e.haltelinie && <>
            <polyline points={linie(e.haltelinie.quer)} fill="none" stroke="#111827" strokeWidth={8} />
            <polyline points={linie(e.haltelinie.quer)} fill="none" stroke="#ffffff" strokeWidth={5} />
          </>}
          {/* Fahrzeuge: FB auf der Zufahrt, FA am Ende von A, Velo am Ende von A Velo, Zufussgehende am Ende von A Trottoir */}
          {fbVelo ? velo(fbVelo, 'fb', true) : auto(fb[0], fb[1], FB_FARBE, '#ffffff')}
          {e.richtungen.filter(r => r.status !== 'keine_zufahrt' || r.velo).map(r => {
            const mfz = r.status !== 'keine_zufahrt'
            const iA = Math.min(r.massgebend, r.sichtpunkte.length - 1)
            const fa = mfz ? faAnzeige(r.faHand, r.sichtpunkte, iA) : null
            const v = r.velo, vl = v ? veloLage(v.sichtpunkte, Math.min(v.A, v.sichtpunkte.length - 1)) : null
            return <g key={'f' + r.richtung}>
              {fa && auto(fa[0], fa[1], FA_FARBE, '#111827')}
              {vl && velo(vl, 'v')}
              {mfz && kreis(r.K, 5, '#ffffff')}
              {mfz && beschriftung(r.K, 'K', 7, 18, 16)}
              {mfz && sichtZeigen(sicht, 'auto', richtungSichtId(e, r)) && iA > 0 && kreis(r.sichtpunkte[iA], 5, STATUS_FARBE[r.status])}
              {mfz && sicht.masse && sichtZeigen(sicht, 'auto', richtungSichtId(e, r)) && iA > 0 && beschriftungA(r.sichtpunkte[iA], `${lageKurz(r)}: A ${r.massgebend} m`)}
              {!mfz && vl && sicht.masse && sichtZeigen(sicht, 'velo', richtungSichtId(e, r)) && beschriftungA(vl[0], `${lageKurz(r)}: nur Velo, A ${v!.A} m`)}
            </g>
          })}
          {(e.trottoirPruefung?.richtungen ?? []).map(t => {
            const iT = Math.min(t.A, t.sichtpunkte.length - 1)
            return iT > 0 && <g key={'fg' + t.richtung}>{kreis(t.sichtpunkte[iT], 7, '#ffffff', TROTTOIR_FARBE, 3)}
              {kreis(t.sichtpunkte[iT], 3, STATUS_FARBE[t.status], '#111827', 1)}</g>
          })}
          {e.trottoirPruefung && <>{kreis(e.trottoirPruefung.D, 6, TROTTOIR_FARBE, '#111827', 2)}{beschriftung(e.trottoirPruefung.D, "D'", 8, 18, 16)}</>}
          {dist(e.rand, e.nullpunkt) >= 0.05 && kreis(e.nullpunkt, 4, ZUFAHRT_FARBE, '#111827', 2)}
          {/* Nummernschilder der Arme wie auf der Karte (Grundstückzufahrt «Z» am Zufahrtspunkt); gewählte Zufahrt grün */}
          {kn && schilder(kn, e).map(({ a, p, gewaehlt }) => { const [x, y] = xy(p)
            return <g key={'nr' + a.key}>
              <circle cx={x} cy={y} r={13} fill={gewaehlt ? NR_GEWAEHLT_FARBE : '#ffffff'} stroke="#0f172a" strokeWidth={2.5} />
              <text x={x} y={y} fontSize={15} fontWeight={700} fill={gewaehlt ? '#ffffff' : '#0f172a'} textAnchor="middle"
                dominantBaseline="central">{a.nr}</text>
            </g> })}
          {/* D wie auf der Karte: weiss mit dunklem Rand (von Hand: Bernstein), Beschriftung weiss mit dunklem Halo */}
          {kreis(e.D, 8, D_FARBE, e.Dhand ? D_HAND_FARBE : D_RAND_FARBE, e.Dhand ? 3 : 2)}
          {(() => { const [x, y] = xy(e.D)
            return <text x={x + 11} y={y - 6} fontSize={18} fontWeight={700} fill="#ffffff" stroke="#0f172a" strokeWidth={4}
              paintOrder="stroke" strokeLinejoin="round">D</text> })()}
          {/* Massstab und Nordpfeil */}
          <g transform={`translate(20 ${(vh - 24).toFixed(1)})`}>
            <rect x={-8} y={-30} width={mass * s + 16} height={44} fill="#ffffff" fillOpacity={0.85} />
            <rect x={0} y={0} width={mass * s / 2} height={6} fill="#000000" />
            <rect x={mass * s / 2} y={0} width={mass * s / 2} height={6} fill="#ffffff" stroke="#000000" strokeWidth={1} />
            <text x={0} y={-8} fontSize={16}>0</text>
            <text x={mass * s} y={-8} fontSize={16} textAnchor="end">{mass} m</text>
          </g>
          <g transform={`translate(${VB - 36} 40)`}>
            <path d="M0,-26 L9,4 L0,-3 L-9,4 Z" fill="#000000" stroke="#ffffff" strokeWidth={1.5} />
            <text x={0} y={24} fontSize={18} fontWeight={700} textAnchor="middle" {...halo}>N</text>
          </g>
          <text x={VB - 8} y={vh - 8} fontSize={13} textAnchor="end" {...halo} strokeWidth={4}>© swisstopo · AV geodienste.ch · © OpenStreetMap-Mitwirkende</text>
          <MassBild masse={masse} wahl={sicht} xy={pt} />
        </svg>
      </div>
      <figcaption className="klein">
        <p className="legende-satz">{sichtSatz(e, sicht)} Ausschnitt {Math.round(wM)} × {Math.round(hM)} m, Norden oben (LV95).{' '}
          {status === 'laedt' && <span className="nicht-drucken">Luftbild wird geladen … </span>}
          {(status === 'fehler' || status === 'zeit') && <span className="warnung">Luftbild nicht geladen: Kartenbild ohne Hintergrund. </span>}
          {(status === 'fehler' || status === 'zeit') && <span className="nicht-drucken">
            {status === 'zeit' ? `Noch keine Antwort nach ${BILD_ZEITGRENZE_MS / 1000} s; es erscheint, sobald es eintrifft. ` : ''}
            <button className="zweit klein" onClick={() => setVersuch(v => v + 1)}>erneut versuchen</button>{' '}</span>}</p>
        <ul className="bild-legende">{legende.map((l, i) => <li key={i}>{l.probe}<span>{l.text}</span></li>)}</ul>
      </figcaption>
    </figure>
  )
})
/** Zelle «kein Verkehr» bzw. ohne Prüfung */
const leer = (t: string) => <span className="klein">{t}</span>

/** Ergebnis als Tabelle, je Richtung eine Spalte: Motorfahrzeuge (ohne Rechtsvortritt), Velo, Trottoir, Gesamtstatus */
function ErgebnisTabelle({ e }: { e: Ergebnis }) {
  const rs = e.richtungen
  const rv = !!e.rechtsvortritt
  const zeile = (titel: string, zelle: (r: RichtungErgebnis) => React.ReactNode, key = titel) =>
    <tr key={key}><td>{titel}</td>{rs.map(r => <td key={r.richtung}>{zelle(r)}</td>)}</tr>
  const auto = (z: (r: RichtungErgebnis) => React.ReactNode) => (r: RichtungErgebnis) => (r.status === 'keine_zufahrt' ? leer(r.keinGrund ?? 'kein Verkehr') : z(r))
  const tr = (r: RichtungErgebnis) => e.trottoirPruefung?.richtungen.find(t => t.richtung === r.richtung) ?? null
  return (
    <table className="bericht-tabelle bericht-ergebnis">
      <thead><tr><th></th>{rs.map(r => <th key={r.richtung}>{lageText(r)}: {r.strasse}<div className="klein">{r.spur === 'nah' ? 'nahe' : 'ferne'} Fahrspur</div></th>)}</tr></thead>
      <tbody>
        {!rv && <>
          <tr className="bericht-zwischen"><td colSpan={rs.length + 1}><b>Motorfahrzeuge</b> (VSS 40 273 Tab. 1){e.trottoirueberfahrt ?
            ' – Trottoirüberfahrt, Phase Fahrbahn (ab der Bordkante)' : ''}</td></tr>
          {zeile('Tempo', auto(r => <>{r.tempo} km/h<div className="klein">{r.tempoArt ? `von Hand: ${TEMPO_ART_TEXT[r.tempoArt]}` +
            `${r.tempoBegruendung ? ` («${r.tempoBegruendung}»)` : ''}; ${r.tempoVorgabeQuelle.startsWith('Annahme') ? 'Annahme' : 'Datenwert'}: ${r.tempoVorgabe} km/h (${r.tempoVorgabeQuelle})` :
            `${r.tempoQuelle}${r.tempoAnnahme ? ' (Annahme)' : ''}`}</div></>))}
          {zeile('Längsneigung i', auto(r => <>{r.neigungUnbekannt ? 'unbekannt' : `${fi(r.neigung)} %`}<div className="klein">{r.neigungQuelle}</div></>))}
          {zeile('A nach Strassentyp', auto(r => <>{r.typWert} m<div className="klein">{r.typText}; Tab. 1 {r.erforderlichUnten} bis {r.erforderlichOben} m</div></>))}
          {zeile('Anhaltesichtweite', auto(r => r.anhalte ? <>{r.anhalte.meter} m<div className="klein">VSS 40 090b Abb. 2, VP {r.anhalte.stufe} km/h;{' '}
            {r.anhalteAngewendet ? (r.neigungUnbekannt ? `angewendet, Neigung unbekannt (strengster Wert bei ${fi(r.anhalte.i)} %)` :
              r.anhalte.meter <= r.typWert ? 'geprüft, nicht höher als Tab. 1' : 'angewendet') :
              `nicht angewendet (|i| bis ${NEIGUNG_EBEN_PROZENT} %)`}{r.anhalte.unsicher ? `; Kurve ${r.anhalte.verlaengert ? 'verlängert' :
              'gestrichelt'}, unsicher` : ''}</div></> :
            leer('unter 30 km/h keine Kurve')))}
          {zeile('A massgebend', auto(r => <><b>{r.massgebend} m</b><div className="klein">{r.massgebendText}</div></>))}
          {zeile('A vorhanden', auto(r => <><b>{vorhandenText(r.vorhanden, r.bisEnde)}</b>{r.bisEnde && <div className="klein">geprüft bis {r.sMax} m</div>}</>))}
          {zeile('Status', auto(r => <><b>{statusMarke(r.status)} {autoText(r)}</b>{r.statusZusatz.length > 0 &&
            <div className="klein">{r.statusZusatz.join('; ')}</div>}</>))}
          {zeile('Überholfall', auto(r => r.ueberholfall ? <><b>{statusMarke(r.ueberholfall.status)} {STATUS_TEXT_TEIL[r.ueberholfall.status]}</b>
            {' '}({vorhandenText(r.ueberholfall.vorhanden, r.ueberholfall.bisEnde)} von {r.ueberholfall.A} m)<div className="klein">Ziffer 6,
            Abb. 1: Sichtlinie S' auf den Gegenfahrstreifen, {r.ueberholfall.lageText}</div></> :
            leer(`nicht geprüft (${e.ueberholen?.grund || 'Rechtsvortritt'})`)), 'ueber')}
        </>}
        <tr className="bericht-zwischen"><td colSpan={rs.length + 1}><b>Veloverkehr</b> (Tab. 3){e.trottoirueberfahrt ?
          ' – Phase Fahrbahn' : ''}</td></tr>
        {zeile('Veloführung', r => <>{VELOFUEHRUNG_TEXT[r.veloFuehrung]}<div className="klein">{r.veloGewaehlt ?
          `von Hand; aus Daten: ${VELOFUEHRUNG_TEXT[r.veloVorgabe]} (${r.veloVorgabeQuelle})` : r.veloVorgabeQuelle}</div></>)}
        {zeile('A Velo', r => r.velo ? <><b>{r.velo.A} m</b><div className="klein">{r.velo.text}; {r.velo.tempo} km/h, i {r.velo.neigungUnbekannt ?
          'unbekannt' : `${fi(r.velo.neigung)} %`}
          {r.velo.ebike ? '; schnelle E-Bikes verboten' : ''}; {r.velo.lageText}</div></> : leer('keine Prüfung'), 'A Velo')}
        {zeile('A vorhanden Velo', r => r.velo ? <b>{vorhandenText(r.velo.vorhanden, r.velo.bisEnde)}</b> : leer('–'), 'vV')}
        {zeile('Status Velo', r => r.velo ? <><b>{statusMarke(r.velo.status)} {STATUS_TEXT_TEIL[r.velo.status]}</b>{r.velo.veloHand &&
          <div className="klein">Veloachse von Hand</div>}</> : leer('–'), 'sV')}
        {zeile('Vergleich bfu', r => { if (!r.velo) return leer('–'); const b = bfuVelo(r.velo.neigung, r.velo.neigungUnbekannt)
          const belegt = r.velo.vorhanden >= b.A ? '' : r.velo.bisEnde ? `; geprüft bis ${f1(r.velo.vorhanden)} m, Vergleichswert damit nicht belegt` : '; nicht erreicht'
          return <>{b.A} m<div className="klein">{b.text}; Vergleichswert, ohne Wirkung (massgebend VSS 40 273 Tab. 3){belegt}</div></> }, 'bV')}
        <tr className="bericht-zwischen"><td colSpan={rs.length + 1}><b>Trottoir</b> (Tab. 2, von D'){e.trottoirueberfahrt ?
          ` – Trottoirüberfahrt, Phase Trottoir (D' = B ${f2(B_INNERORTS_M)} m hinter dem hinteren Rand, VSS 40 273 Ziffer 13.2; Gehlinie ` +
          `${f2(TUE_GEHLINIE_M)} m vor dem hinteren Rand der Überfahrt)` : ''}</td></tr>
        {e.trottoirPruefung ? <>
          {zeile('Längsneigung Trottoir', r => { const t = tr(r); return t ? <>{t.neigungUnbekannt ? 'unbekannt' : `${fi(t.neigung)} %`}
            <div className="klein">{t.neigungQuelle}</div></> : leer('–') }, 'iT')}
          {zeile('A Trottoir', r => { const t = tr(r); return t ? <><b>{t.A} m</b><div className="klein">{t.text}</div></> : leer('–') }, 'AT')}
          {zeile('A vorhanden Trottoir', r => { const t = tr(r); return t ? <b>{vorhandenText(t.vorhanden, t.bisEnde)}</b> : leer('–') }, 'vT')}
          {zeile('Status Trottoir', r => { const t = tr(r); return t ? <b>{statusMarke(t.status)} {STATUS_TEXT_TEIL[t.status]}</b> : leer('–') }, 'sT')}
          {zeile('Vergleich bfu', r => { const t = tr(r); if (!t) return leer('–'); const b = bfuTrottoir(t.neigung, t.neigungUnbekannt)
            return <>Zufussgehende, fäG, Kinder auf dem Velo {b.fuss} m; zugelassene Velos {b.velo} m<div className="klein">{b.text};
              Vergleichswerte, ohne Wirkung (massgebend VSS 40 273 Tab. 2)</div></> }, 'bT')}
        </> : <tr><td>Trottoir</td><td colSpan={rs.length}>{leer(`keine Prüfung (${e.trottoirGrund || 'kein Trottoir an der Zufahrt nach AV'})`)}</td></tr>}
        <tr className="bericht-gesamt"><td><b>Gesamtstatus</b></td>{rs.map(r => <td key={r.richtung}><b>{statusMarke(r.gesamt, !!r.rv)} {gesamtText(r)}</b></td>)}</tr>
      </tbody>
    </table>
  )
}

/** Rechtsvortritt (Teil E): Wahrnehmbarkeit, Sichtweite, Zustand nach Abb. 6, Abb. 5, auf Wunsch alle Arme */
function RvBerichtBlock({ e }: { e: Ergebnis }) {
  const rv = e.rechtsvortritt!
  const a = rv.arm, m = a.sichtfeld
  const breite = (b: number | null) => (b === null ? 'ohne AV-Querschnitt' : `${f1(b)} m`)
  return (
    <section className="bericht-block">
      <h3>Rechtsvortritt (VSS 40 273 Teil E, Ziffern 15 bis 18)</h3>
      <table className="bericht-zahlen"><tbody>
        <tr><td>Geprüft</td><td>{a.armName} gegen den Arm rechts: {a.rechtsName}</td></tr>
        <tr><td>Tempo, B</td><td>Norm: {rv.tempo} km/h (Ziffer 15, S. 10), B {f2(rv.B)} m (Abb. 4)</td></tr>
        <tr><td>Wahrnehmbarkeit</td><td>{WAHRNEHMBARKEIT_TEXT[rv.wahrnehmbarkeit]} ({rv.wahrnehmbarkeitGewaehlt ? 'von Hand' : 'Annahme der App'}; Ziffer 18){rv.markierung ? '; besondere Markierung «Rechtsvortritt» vorhanden (VSS 40 851)' : ''}</td></tr>
        {a.status === 'keine' ? <tr><td>Status</td><td><b>{statusMarke('keine')} {a.nurVelo ? 'keine Prüfung nach Abb. 6, nur Velos von rechts' :
          'keine Prüfung'}</b>: {a.grund}{a.nurVelo ? ' (Ergebnis in der Tabelle, Veloverkehr von rechts)' : ''}</td></tr> : <>
          <tr><td>Sichtweite vorhanden</td><td><b>{vorhandenText(a.vorhanden, a.bisEnde)}</b> ({RV_A_M} m anzustreben, {RV_A_MIN_M} m Minimum bei
            sehr guter Wahrnehmbarkeit; Ziffer 16)</td></tr>
          <tr><td>Zustand nach Abb. 6</td><td>{a.zustand ? ZUSTAND_TEXT[a.zustand] : '–'}</td></tr>
          <tr><td>Fahrbahnbreite</td><td>Zufahrt {breite(a.breite)}, rechter Arm {breite(a.breiteRechts)}{a.schmal ? ` · schmal (≤ ${f2(SCHMAL_M)} m): Abb. 5` : ''}</td></tr>
          {m && <tr><td>Sichtfeld Abb. 5</td><td>{m.frei ? 'frei' : 'nicht frei'}: {m.sichtbar} von {m.linien.length} Sichtlinien frei
            ({Math.round(m.anteil * 100)} %){m.erste ? `; erste verdeckte bei ${f1(m.erste.s)} m Pfadlänge ab D (${f1(m.erste.sRechts)} m auf ` +
            `dem rechten Arm; ${m.erste.verdecker})` : ''}<div className="klein">Konstruktion nach bfu BM.021 Kap. 3.2.2, Abb. 4: Pfad von{' '}
            {ENG_LAENGE_M} m ab D über den Schnitt der Achsen, Punkte alle {ENG_SCHRITT_M} m (Annahmen: beobachtende Person und Pfadbeginn in D).</div></td></tr>}
          <tr><td>Status</td><td><b>{statusMarke(a.status)} {RV_STATUS_TEXT[a.status]}</b>{m && !m.frei ? ' · Sichtfeld nach Abb. 5 nicht frei' : ''}</td></tr>
        </>}
      </tbody></table>
      {rv.alle && <>
        <h4>Alle Arme (je gegen den rechten Nachbarn)</h4>
        <table className="bericht-tabelle">
          <thead><tr><th>Arm</th><th>gegen rechts</th><th>Sichtweite</th><th>Zustand Abb. 6</th><th>Status</th></tr></thead>
          <tbody>{rv.alle.map((x: RvArm) => <tr key={x.arm}><td>{x.armName}{x.arm === a.arm ? ' (gewählt)' : ''}</td><td>{x.rechtsName}</td>
            <td>{x.status === 'keine' ? '–' : vorhandenText(x.vorhanden, x.bisEnde)}{x.schmal ? ' · schmal' : ''}</td>
            <td>{x.zustand ? ZUSTAND_TEXT[x.zustand] : '–'}</td>
            <td><b>{statusMarke(x.status)} {RV_STATUS_TEXT[x.status]}</b>{x.status === 'keine' ? ` (${x.grund})` : x.sichtfeld && !x.sichtfeld.frei ? ' · Abb. 5' : ''}</td></tr>)}</tbody>
        </table>
        <p className="klein">Nur Motorfahrzeuge nach Abb. 6 bzw. Abb. 5; der gewählte Arm mit seinen Eingaben, die übrigen mit den Daten und Annahmen der App.</p>
      </>}
    </section>
  )
}

/** Verdecker je Richtung und Teil (Motorfahrzeuge, Velo, Trottoir) */
function VerdeckerBlock({ e }: { e: Ergebnis }) {
  const zeilen: { wo: string; t: VerdeckerEintrag }[] = []
  const zusatz: string[] = []
  for (const r of e.richtungen) {
    for (const t of r.verdeckerListe) zeilen.push({ wo: `${lageKurz(r)}, Motorfahrzeuge`, t })
    for (const t of r.velo?.verdeckerListe ?? []) zeilen.push({ wo: `${lageKurz(r)}, Velo`, t })
    for (const t of r.ueberholfall?.verdeckerListe ?? []) zeilen.push({ wo: `${lageKurz(r)}, Überholfall`, t })
    if (r.palisade && r.palisade.anteil > 0) zusatz.push(`${lageText(r)}: Bäume verdecken ${Math.round(r.palisade.anteil * 100)} % der Strecke ` +
      `K bis A, längste Strecke ${f1(r.palisade.laengste)} m (${r.palisade.zaehlt ? 'zählt als Palisade' : 'zählt nicht als Palisade'}).`)
    if (r.verdecker && !r.verdeckerListe.some(t => t.id === r.verdecker!.id)) zusatz.push(`${lageText(r)}: Sicht endet bei ${f1(r.vorhanden)} m, ` +
      `ausserhalb von A, an ${r.verdecker.name}.`)
  }
  for (const t of e.trottoirPruefung?.richtungen ?? []) for (const v of t.verdeckerListe) zeilen.push({ wo: `Trottoir ${lageKurz(t)}`, t: v })
  return (
    <section className="bericht-block">
      <h2>Verdecker im Sichtdreieck</h2>
      {zeilen.length ? <table className="bericht-tabelle">
        <thead><tr><th>Richtung</th><th>Art</th><th>Quelle</th><th>Wirkung</th><th>verdeckt ab</th><th>Strecke bis A</th></tr></thead>
        <tbody>{zeilen.map(({ wo, t }, i) => <tr key={i}><td>{wo}</td>
          <td>{t.art}{t.name !== t.art && t.name !== 'Gebäude (AV)' ? <div className="klein">{t.name}</div> : null}</td>
          <td>{t.quelle}</td><td>{WIRKUNG_TEXT[t.wirkung]}</td><td>{f1(t.sErst)} m</td><td>{f1(t.strecke)} m</td></tr>)}</tbody>
      </table> : <p className="klein">Keine Fläche schneidet eine Sichtlinie bis A.</p>}
      {zusatz.length > 0 && <ul className="klein">{zusatz.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      {zeilen.length > 0 && <p className="klein">Verdeckt ab: erster verdeckter Zielpunkt ab K entlang der Achse; Strecke: verdeckte Länge der
        Achse bis A. Palisade: Bäume zählen erst, wenn sie zusammenhängend eine Mindeststrecke verdecken.</p>}
    </section>
  )
}

function MassnahmenBlock({ e, spiegel }: { e: Ergebnis; spiegel: string[] }) {
  const liste = e.massnahmen
  const reicht = (r: boolean | null) => (r === null ? '' : r ? ' – reicht' : ' – reicht nicht')
  return (
    <section className="bericht-block">
      <h2>Massnahmen (VSS 40 273 Ziffer 14)</h2>
      {!liste ? <p className="klein">Keine Massnahmen berechnet: Motorfahrzeuge und Velo sind in beiden Richtungen erfüllt (das
        Trottoir gehört nicht zu den Massnahmen).</p> : <>
        <p className="klein">Varianten der Rechnung ohne neue Daten, in der Reihenfolge der Ziffer 14; ab Massnahme 2 nur an bestehenden
          Knoten und Zufahrten. «Reicht» heisst: mit dieser Massnahme wären alle Richtungen erfüllt.</p>
        {liste.some(m => m.nr === 9) && <p className="klein">Rechtsvortritt: zuerst Ziffer 16 (Rechtsvortritt aufheben) und die
          Wahrnehmbarkeit (Ziffer 18), dann die Massnahmen der Ziffer 14.</p>}
        <ol className="bericht-massnahmen">
          {liste.map(m => <li key={m.nr}><b>{m.titel}{reicht(m.reicht)}</b>
            <div className="klein">{m.text}</div>
            {m.zeilen.length > 0 && <ul className="klein">{m.zeilen.map((z, k) => <li key={k}>{z.reicht === null ? '' : z.reicht ? '✓ ' : '✗ '}{z.text}</li>)}</ul>}
            {m.bedingungen && <ul className="klein bericht-haken">
              <li>{m.sichtUnterMin ? '☑' : '☐'} direkte Sicht erst bei D unter {f2(HALTELINIE_MIN_M)} m hinter der Kante (gerechnet)</li>
              {m.bedingungen.map(([k, t]) => <li key={k}>{spiegel.includes(k) ? '☑' : '☐'} {t}</li>)}
              <li>{spiegel.filter(k => m.bedingungen!.some(b => b[0] === k)).length} von {m.bedingungen.length} Bedingungen von Hand abgehakt
                (die App bewertet sie nicht).</li>
            </ul>}
          </li>)}
        </ol>
      </>}
    </section>
  )
}

/** Eingaben von Hand (Abweichungen von den Vorgaben) als Liste */
export function eingabenListe(fall: Fall, e: Ergebnis): string[] {
  const g = fall.eingaben, aus: string[] = []
  const rName = (r: Richtung) => { const x = e.richtungen.find(y => y.richtung === r); return `${x ? lageText(x) : `Verkehr von ${r}`}${x ? `, ${x.strasse}` : ''}` }
  if (fall.ort.zufahrt !== null) aus.push(`Zufahrt gewählt: ${e.zufahrtName}`)
  if (e.zufahrtspunkt?.gezeichnet) aus.push('Richtung der Grundstückzufahrt gezeichnet')
  if (g.regelung !== null) aus.push(`Regelung für die gewählte Zufahrt: ${REGELUNG_TEXT[g.regelung]} (automatisch ermittelt: ${REGELUNG_TEXT[e.regelungVorgabe]}, ${e.regelungQuelle})`)
  for (const k of ['typ','innerorts'] as const) { const b=g.bundesbelege?.[k]; if(b && b.wert===g[k]) aus.push(bundBelegText(b)) }
  if (g.innerorts != null) aus.push(`Ortslage: ${g.innerorts ? 'innerorts' : 'ausserorts'} (bestätigt)`)
  if (g.typ !== null) aus.push(`Strassentyp: ${STRASSENTYP_TEXT[g.typ]} (aus OSM abgeleitet: ${STRASSENTYP_TEXT[e.strasse.typVorgabe]}, ${e.strasse.typQuelle})`)
  if (g.fahrstreifen !== null) aus.push(`${UNGUNST_TEXT.fahrstreifen}: ${g.fahrstreifen ? 'ja' : 'nein'}`)
  if (g.neigungGross !== null) aus.push(`${UNGUNST_TEXT.neigung}: ${g.neigungGross ? 'ja' : 'nein'}`)
  if (g.schwerverkehr) aus.push(`${UNGUNST_TEXT.schwerverkehr}: ja (von Hand, unabhängig vom Anteil)`)
  if ((g.schwerverkehrAnteil ?? null) !== null) aus.push(`Schwerverkehrsanteil: ${f1(g.schwerverkehrAnteil!)} % (ungünstig über ` +
    `${SCHWERVERKEHR_PROZENT} %; ${UNGUNST_MASSE_TEXT})`)
  for (const r of ['links', 'rechts'] as Richtung[]) {
    const n = g.neigung[r]
    if (n !== null) { const x = e.richtungen.find(y => y.richtung === r)
      aus.push(`Längsneigung ${rName(r)}: ${fi(n)} %${x ? ` (Höhenmodell: ${x.neigungVorgabeUnbekannt ? '' : `${fi(x.neigungVorgabe)} %, `}` +
        `${x.neigungVorgabeQuelle})` : ''}`) }
    const t = g.tempo[r]
    if (t) aus.push(`Tempo ${rName(r)}: ${t.wert} km/h, ${TEMPO_ART_TEXT[t.art]}${t.begruendung ? `, Begründung «${t.begruendung}»` : ''}`)
    const v = g.velo?.[r] ?? null
    if (v) aus.push(`Veloführung ${rName(r)}: ${VELOFUEHRUNG_TEXT[v]}`)
  }
  if (e.haltelinie) aus.push(`Halte- oder Wartelinie: Vorderkante ${f2(Math.abs(e.haltelinie.abstand))} m ${e.haltelinie.abstand >= 0 ? 'hinter' : 'vor'} der ` +
    `Kante${e.haltelinie.vorverlegt ? ' (vorverlegt)' : ''}${e.haltelinie.hand ? `, Lage von Hand${e.haltelinie.winkel >= 1 ? `, ${Math.round(e.haltelinie.winkel)}° schräg` : ''}` : ''}`)
  else if (g.haltelinie) aus.push('Halte- oder Wartelinie gesetzt, aber nicht gerechnet (siehe Hinweise)')
  if (g.Dtrottoir && e.trottoirueberfahrt) aus.push(`Beobachtungspunkt D' der Phase Trottoir von Hand`)
  if (e.Dhand) aus.push(`Beobachtungspunkt D von Hand: ${f2(e.Dlage.laengs)} m hinter der ${e.nullpunktText}, ${f2(Math.abs(e.Dlage.seitlich))} m ` +
    `${e.Dlage.seitlich >= 0 ? 'links' : 'rechts'} der Achse`)
  if (e.zufahrtVersatz) aus.push(`Zufahrtsachse von Hand ${f2(Math.abs(e.zufahrtVersatz))} m nach ${e.zufahrtVersatz > 0 ? 'links' : 'rechts'} versetzt: D, K und der Nullpunkt folgen`)
  if (e.fbHand) aus.push('Fahrzeug FB von Hand gedreht (nur Darstellung)')
  for (const r of e.richtungen) if (r.velo?.veloHand) aus.push(`Veloachse ${rName(r.richtung)} von Hand: ${f2(r.velo.randAbstand)} m statt ` +
    `${f2(r.velo.veloHand.randVorgabe)} m vom rechten Fahrbahnrand, die Velo-Prüfung rechnet auf dieser Linie`)
  for (const r of e.richtungen) if (r.faHand) aus.push(`Fahrzeug FA ${rName(r.richtung)} von Hand: ${r.fahrlinieHand ? `Fahrlinie ${f2(r.randAbstand)} m statt ${f2(r.fahrlinieHand.randVorgabe)} m ` +
    'vom rechten Fahrbahnrand, die Prüfung rechnet auf dieser Linie' : 'seitlich auf der berechneten Fahrlinie'}; Front ${f1(r.faHand.abstandK)} m ab K, ` +
    `Sicht von D ${r.faHand.verdecker ? `verdeckt durch ${r.faHand.verdecker}` : 'frei'}`)
  if (g.trottoirFrei) aus.push('Trottoir ohne Hindernisse: FB wartet an der Bordkante (Ziffer 13.1)')
  if (g.trottoirueberfahrt) aus.push(`Trottoirüberfahrt über diese Einmündung (VSS 40 242)${g.trottoirueberfahrt.breite !== null ?
    `, Breite von Hand ${f2(g.trottoirueberfahrt.breite)} m${e.trottoirueberfahrt?.breiteQuelle === 'eingabe' ? '' : ' (ohne Wirkung: Breite aus der AV)'}` : ''}`)
  if (g.ebikeVerboten) aus.push('Schnelle E-Bikes verboten (Tab. 3)')
  if (g.wahrnehmbarkeit) aus.push(`Wahrnehmbarkeit des Knotens: ${WAHRNEHMBARKEIT_TEXT[g.wahrnehmbarkeit]}`)
  if (g.alleArme) aus.push('Rechtsvortritt: alle Arme geprüft')
  if (g.markierungRv) aus.push('Besondere Markierung «Rechtsvortritt» vorhanden (VSS 40 851; ohne Wirkung auf die Rechnung)')
  for (const h of fall.hindernisse) aus.push(`Hindernis: ${hindernisText(h)}` + ((h.art === 'hecke' || h.art === 'mauer' || h.art === 'uebrige') ?
    (h.sichtbehindernd ? ', sichtbehindernd' : ', nicht sichtbehindernd') : ''))
  const verworfen = Object.keys(fall.vorschlaege).length
  if (verworfen) aus.push(`${verworfen} Vorschläge bzw. amtliche Parkfelder verworfen (zählen nicht)`)
  if (fall.baumkataster) aus.push('Baumkataster zugeschaltet')
  if (fall.parkkataster === false) aus.push('Amtliche Parkfelder abgeschaltet')
  return aus
}

/** Hinweise: Rechnung, je Richtung (Auto, Velo), Trottoir, Meldungen, offene Vorschläge */
export function hinweisListe(e: Ergebnis, meldungen: string[]): string[] {
  const aus: string[] = [...e.hinweise]
  for (const r of e.richtungen) {
    for (const h of r.hinweise) aus.push(h.toLowerCase().startsWith(lageText(r).toLowerCase()) ? h : `${lageText(r)}: ${h}`)
    for (const h of r.velo?.hinweise ?? []) aus.push(`Velo ${lageKurz(r)}: ${h}`)
    for (const h of r.ueberholfall?.hinweise ?? []) aus.push(`Überholfall ${lageKurz(r)}: ${h}`)
  }
  for (const t of e.trottoirPruefung?.richtungen ?? []) for (const h of t.hinweise) aus.push(`Trottoir ${lageKurz(t)}: ${h}`)
  const offen = e.hindernis.vorschlaege.length
  if (offen) aus.push(`${offen} Vorschläge (OSM-Parkierung, Baumkataster) nicht bestätigt: zählen nicht.`)
  if (e.hindernis.inD.length) aus.push(`D liegt in ${e.hindernis.inD.join(', ')} (nicht gerechnet).`)
  aus.push(...meldungen)
  return [...new Set(aus.filter(x => x.trim()))]
}

export default function Bericht({ fall, rechnung, av, kantone, quellen, aendern, schliessen }: {
  fall: Fall; rechnung: Rechnung; av: AvFlaeche[]; kantone: string[]; quellen: Record<string, QuellenStand>
  aendern: (f: (x: Fall) => Fall) => void; schliessen: () => void
}) {
  const e = rechnung.ergebnis!, kn = rechnung.knoten
  const [bild, setBild] = useState<'laedt' | 'ok' | 'fehler'>('laedt')
  // Längsneigung aus dem Höhenmodell noch unterwegs: Zahlen vorläufig (0 %), Drucken erst danach
  // Höchstens NEIGUNG_ZEITGRENZE_MS warten (z. B. Dienst hängt oder die Profile kommen wegen Overpass nicht): danach Drucken mit
  // 0 % und Hinweis frei
  const neigungLaedtJetzt = e.richtungen.some(r => !r.neigungHand && r.neigungQuelle.startsWith('Höhenmodell lädt'))
  const [neigungZeit, setNeigungZeit] = useState(false)
  useEffect(() => {
    if (!neigungLaedtJetzt) return
    const t = setTimeout(() => setNeigungZeit(true), NEIGUNG_ZEITGRENZE_MS)
    return () => clearTimeout(t)
  }, [neigungLaedtJetzt])
  const neigungLaedt = neigungLaedtJetzt && !neigungZeit
  const wartet = bild === 'laedt' || neigungLaedt
  const ort: P = fall.ort.zufahrtspunkt?.p ?? kn?.p ?? e.D
  const [lat, lon] = wgs(ort[0], ort[1])
  // Flugjahr der 1-km-Kachel (api3.geo.admin.ch); leer, wenn nicht verfügbar
  const [flugjahr, setFlugjahr] = useState('')
  useEffect(() => {
    const ctrl = new AbortController()
    ladeFlugjahr(ort[0], ort[1], ctrl.signal).then(j => { if (!ctrl.signal.aborted) setFlugjahr(j) })
    return () => ctrl.abort()
  }, [ort[0], ort[1]])
  const heute = new Date()
  const eingaben = eingabenListe(fall, e)
  const hinweise = hinweisListe(e, rechnung.meldungen)
  // Bezeichnung: lokal tippen, erst beim Verlassen des Felds (bzw. Enter, Escape) in den Fall übernehmen (Speichern im Browser)
  const [bez, setBez] = useState(fall.ort.bezeichnung ?? '')
  const bezUebernehmen = () => {
    const t = bez.slice(0, BEZEICHNUNG_MAX)
    if (t.trim() === (fall.ort.bezeichnung ?? '').trim()) return
    aendern(f => { if (t.trim()) f.ort.bezeichnung = t; else delete f.ort.bezeichnung; return f })
  }
  // Titel des Dokuments = Vorschlag für den Dateinamen beim Speichern als PDF
  const titelTeil = (fall.ort.bezeichnung?.trim() || kn?.name || (fall.ort.knoten !== null ? String(fall.ort.knoten) : 'Zufahrt'))
    .replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 60)
  useEffect(() => {
    const alt = document.title
    const d = new Date(), zz = (x: number) => String(x).padStart(2, '0')
    document.title = `SichtweitenCheck_Bericht_${titelTeil}_${d.getFullYear()}-${zz(d.getMonth() + 1)}-${zz(d.getDate())}`
    return () => { document.title = alt }
  }, [titelTeil])
  // gedruckt wird nur der Bericht (index.css: body.bericht-offen #root ausgeblendet)
  useEffect(() => {
    document.body.classList.add('bericht-offen')
    return () => document.body.classList.remove('bericht-offen')
  }, [])
  useEffect(() => {
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !(ev.target instanceof HTMLInputElement)) schliessen() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [schliessen])
  const rv = !!e.rechtsvortritt
  const hindernisse = useMemo(() => bildHindernisse(fall, e), [fall, e])

  return createPortal(
    <div className="bericht" role="dialog" aria-label="Bericht">
      <div className="bericht-leiste nicht-drucken">
        <button onClick={() => window.print()} disabled={wartet} title={wartet ? 'Luftbild bzw. Längsneigung wird noch geladen' : ''}>
          {bild === 'laedt' ? 'Luftbild lädt …' : neigungLaedt ? 'Längsneigung lädt …' : 'Drucken / als PDF speichern'}</button>
        <button className="zweit" onClick={schliessen}>Zurück zur Karte</button>
      </div>
      <article className="bericht-seite">
        {/* Druckrand als Rahmen (wie fgsCheck): Kopf und Fuss der Tabelle wiederholen sich auf jeder gedruckten Seite, so kommt der
            Bericht ohne Seitenrand aus (@page margin 0) und der Browser setzt keine eigene Kopf- und Fusszeile dazu. Zwei Zeilen:
            Seite 1 Kopf mit Ergebnis, Kartenbild und Legende, ab Seite 2 Ergebnistabelle und Grundlagen. */}
        <table className="bericht-rahmen">
        {/* Fallkennung auf jeder Seite (lose Blätter); der Seitenzähler bleibt im wiederholten Kopf in Firefox auf 0 */}
        <thead><tr><td><div className="bericht-rand-oben"><span className="bericht-kennung">SichtweitenCheck v{__APP_VERSION__} · {fall.ort.bezeichnung?.trim() || kn?.name || 'Zufahrt'} · {datum(heute)}</span></div></td></tr></thead>
        <tfoot><tr><td><div className="bericht-rand-unten" /></td></tr></tfoot>
        <tbody><tr><td>
        <header>
          <h1><img className="logo" src={import.meta.env.BASE_URL + 'logo.svg'} alt="" width={36} height={36} />SichtweitenCheck
            {' '}<span className="bericht-marke">{MARKE}</span></h1>
          <p className="klein">Sichtverhältnisse an Knoten und Grundstückzufahrten nach VSS 40 273 · Bericht vom {datum(heute)}</p>
        </header>

        <section className="bericht-block">
          <h2>Ort und Zufahrt</h2>
          <table className="bericht-zahlen"><tbody>
            <tr className={bez.trim() ? '' : 'nicht-drucken'}><td>Bezeichnung</td><td>
              <input className="nicht-drucken bericht-eingabe" type="text" maxLength={BEZEICHNUNG_MAX}
                placeholder="z. B. Adresse, Projekt (erscheint im Bericht und in der Fall-Datei)"
                value={bez} onChange={ev => setBez(ev.target.value)} onBlur={bezUebernehmen}
                onKeyDown={ev => { if (ev.key === 'Enter') ev.currentTarget.blur(); else if (ev.key === 'Escape') bezUebernehmen() }} />
              <span className="nur-drucken">{bez.trim() ? bez : '–'}</span>
            </td></tr>
            <tr><td>Strassen</td><td>{kn?.name || '–'}</td></tr>
            <tr><td>{fall.ort.zufahrtspunkt ? 'Grundstückzufahrt' : 'OSM-Knoten'}</td><td>{fall.ort.zufahrtspunkt ?
              `Zufahrtspunkt am Fahrbahnrand (LV95), Richtung ${e.zufahrtspunkt?.gezeichnet ? 'gezeichnet' : e.zufahrtspunkt?.weg != null ?
                `entlang des OSM-Wegs ${e.zufahrtspunkt.weg}` : 'senkrecht zum Rand'}${e.zufahrtspunkt?.herkunft ? ` (${ZUFAHRT_HERKUNFT[e.zufahrtspunkt.herkunft]})` : ''}${e.zufahrtspunkt?.winkel != null ? `, ${f1(e.zufahrtspunkt.winkel)}° zur lokalen Strassenachse` : ''}; Vortrittsstrasse ${e.zufahrtspunkt?.strasse ?? '–'}` :
              `Knoten ${fall.ort.knoten ?? kn?.id ?? '–'}${kn ? `, ${kn.arme.length} Arme` : ''}`}</td></tr>
            <tr><td>Zufahrt</td><td>{e.zufahrtName}{fall.ort.zufahrt === null && !fall.ort.zufahrtspunkt ? ' (Vorschlag der App)' : ''}
              {e.zufahrtVelo && <div className="klein">nur Velos gegen die Einbahn (Einzelheiten unter Annahmen und Hinweise)</div>}</td></tr>
            <tr><td>Regelung für die gewählte Zufahrt</td><td>{REGELUNG_TEXT[e.regelung]} ({e.regelungGewaehlt ? 'von Hand' : `automatisch ermittelt: ${e.regelungQuelle}`})</td></tr>
            <tr><td>Ergebnis</td><td>{e.seiteOhneArm === 'links' && <div>links: kein Arm</div>}{e.richtungen.map(r => <div key={r.richtung}>
              {lageText(r)}, {r.strasse}:{' '}<b>{statusMarke(r.gesamt, !!r.rv)} {gesamtMitWert(r)}</b></div>)}
              {e.seiteOhneArm === 'rechts' && <div>rechts: kein Arm</div>}
              <div className="klein">Geprüft im Grundriss; Hindernishöhen, Kuppen und Senken sind nicht geprüft.</div></td></tr>
          </tbody></table>
        </section>

        <BerichtKarte e={e} kn={kn} av={av} hindernisse={hindernisse} onBereit={setBild} />

        </td></tr>
        <tr className="bericht-neue-seite"><td>
        <section className="bericht-block">
          <h2>Ergebnis</h2>
          {e.lsa && <p className="klein"><b>{LSA_TEXT}</b></p>}
          <p className="klein">Gesamtstatus je Richtung: schlechtester Teil (Motorfahrzeuge, Überholfall, Velo, Trottoir). ✓ erfüllt, (✓) bedingt, ✗ nicht
            erfüllt, – keine Prüfung.</p>
          {e.trottoirueberfahrt && <ul className="bericht-status">
            <li>Trottoirüberfahrt, Phase Trottoir (ab dem hinteren Rand):{' '}
              <b>{statusMarke(e.trottoirueberfahrt.phaseTrottoir.status)} {tuePhaseText(e.trottoirueberfahrt.phaseTrottoir)}</b></li>
            <li>Trottoirüberfahrt, Phase Fahrbahn (ab der Bordkante):{' '}
              <b>{statusMarke(e.trottoirueberfahrt.phaseFahrbahn.status)} {tuePhaseText(e.trottoirueberfahrt.phaseFahrbahn)}</b></li>
          </ul>}
        </section>
        {rv && <RvBerichtBlock e={e} />}
        <section className="bericht-block">
          {rv && <h3>Velo und Trottoir</h3>}
          <ErgebnisTabelle e={e} />
        </section>

        <section className="bericht-block druck-block">
          <h2>Grundlagen</h2>
          <table className="bericht-zahlen"><tbody>
            <tr><td>Koordinaten</td><td>LV95 E {tausender(ort[0])}, N {tausender(ort[1])} · WGS84 {lat.toFixed(6)}, {lon.toFixed(6)}</td></tr>
            {kn && <tr><td>Arme</td><td>{nachNr(kn.arme).map(armText).join(', ')}<div className="klein">Nummern im Uhrzeigersinn ab Norden wie
              auf der Karte{kn.grundstueck ? ', Z = Grundstückzufahrt' : ''}</div></td></tr>}
            <tr><td>Strassentyp</td><td>{rv ? 'gilt beim Rechtsvortritt nicht (Teil E)' : `${STRASSENTYP_TEXT[e.strasse.typ]} (${e.strasse.typGewaehlt ?
              'von Hand' : `Annahme aus ${e.strasse.typQuelle}`})`}</td></tr>
            <tr><td>Beobachtung</td><td>B {f2(e.B)} m ({rv ? 'Rechtsvortritt, Abb. 4' : e.ausserorts ? 'ausserorts' : 'innerorts'}) ab der{' '}
              {e.nullpunktText}; D {e.Dhand ? 'von Hand' : e.zufahrtVelo ? 'bei der velofahrenden Person' :
                `am Fahrer*innensitz, ${f2(FAHRERSITZ_M)} m links der Achse`}; Einbiegewinkel rund
              {' '}{Math.round(e.einbiegewinkel)}°</td></tr>
            {e.trottoirueberfahrt && <tr><td>Trottoirüberfahrt</td><td>Breite {f2(e.trottoirueberfahrt.breite)} m
              ({TUE_BREITE_KURZ[e.trottoirueberfahrt.breiteQuelle]}), hinterer Rand {f2(e.trottoirueberfahrt.laenge)} m hinter der Bordkante;{' '}
              {e.trottoirueberfahrt.regelungText}<div className="klein">{e.trottoirueberfahrt.breiteText}</div></td></tr>}
            <tr><td>Daten geladen</td><td>{datumIso(fall.quellen.geladen)}</td></tr>
          </tbody></table>
        </section>

        <VerdeckerBlock e={e} />
        <MassnahmenBlock e={e} spiegel={fall.spiegel ?? []} />

        <section className="bericht-block druck-block">
          <h2>Eingaben von Hand</h2>
          {eingaben.length ? <ul className="klein">{eingaben.map((x, i) => <li key={i}>{x}</li>)}</ul> :
            <p className="klein">Keine. Ergebnis aus den geladenen Daten, Rechenregeln und ausgewiesenen Annahmen.</p>}
          <p className="klein">Die Eingaben lassen sich in der App mit «Fall speichern» als Fall-Datei (JSON) sichern und mit «Fall laden»
            wiederherstellen.</p>
        </section>

        <section className="bericht-block">
          <h2>Annahmen</h2>
          <p className="klein">Ziffern, Tabellen, Abbildungen und Seiten ohne Normnummer: VSS 40 273 (2024).</p>
          <ul className="klein">{(e.annahmenThemen ?? e.annahmen.map(text => ({ thema: text, titel: '', text }))).map(t => <li key={t.thema}>
            {t.titel && <b>{t.titel}: </b>}{t.text}</li>)}</ul>
        </section>

        {hinweise.length > 0 && <section className="bericht-block">
          <h2>Hinweise</h2>
          <ul className="klein">{hinweise.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>}

        <section className="bericht-block">
          <h2>Quellen</h2>
          <BerichtQuellenTabelle zeilen={berichtQuellenZeilen({ fall, quellen, kantone, luftbild: { flugjahr, geladen: bild === 'ok', abgerufen: datum(heute) },
            avFuer: 'Fahrbahn, Trottoir, Gebäude', osmFuer: 'Strassennetz, Tempo, Veloführung' })}>
            {(fall.signalEntscheide?.length ?? 0) > 0 && <ul className="klein">{fall.signalEntscheide!.map((x, i) => <li key={`signal:${i}`}>{signalText(x)}</li>)}</ul>}
          </BerichtQuellenTabelle>
        </section>

        {/* Werke und die im Fall angewendeten Regeln (regeln.ts), ohne Normtabellen; Herkunft je Werk und
            Vermerk «nur Hinweis» (Überarbeitung 31.10.2026) */}
        <section className="bericht-block">
          <h2>Werke und angewendete Regeln</h2>
          <RegelnFall gruppen={regelnDesFalls(e)} />
          {nebenWerke(e).length > 0 && <><p className="klein"><b>Geprüft oder zum Vergleich, ohne Wirkung auf das Ergebnis:</b></p>
            <ul className="klein">{nebenWerke(e).map(t => <li key={t}>{t}</li>)}</ul></>}
          <p className="klein">Je Werk die Herkunft (Recht, Norm, Fachempfehlung, kantonale Praxis, Annahme der App, Projektentscheid);
            Regeln mit dem Vermerk «nur Hinweis» ändern das Ergebnis nicht. Nur Fundstellen (Ziffer, Seite) und Zahlenwerte; die Normen sind
            kostenpflichtig, ihr Text ist im Original nachzulesen. Alle Regeln stehen in der App unter «Regeln».</p>
        </section>


        <footer className="bericht-fuss">
          <p><b>Die App ersetzt keine Beurteilung vor Ort.</b> Daten aus offenen Quellen können veraltet oder unvollständig sein (Parkierung,
            Hecken, Mauerhöhen, Signalisation); die Höhe der Hindernisse (Sichtraum) prüft die App nicht.</p>
          <p>SichtweitenCheck v{__APP_VERSION__} ({MARKE}, Stand {__BUILD_DATUM__.split('-').reverse().join('.')}) · {APP_ADRESSE} · Code unter MIT, eigene Inhalte unter CC BY 4.0 ·
            eingebundene Daten unter ihren eigenen Lizenzen (siehe Quellen).</p>
        </footer>
        </td></tr></tbody>
        </table>
      </article>
    </div>,
    document.body,
  )
}
