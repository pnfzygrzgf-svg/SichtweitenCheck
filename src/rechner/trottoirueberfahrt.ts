// ── Trottoirüberfahrt über die Einmündung der Zufahrt (K0; VSS 40 242 Ziffern 12.3, 14.4 und 16, Werte nach VSS 40 273) ──
//
// Band der Überfahrt auf der Zufahrtsachse: vorderer Rand = Bordkante (Fahrbahnrand der Vortrittsstrasse), hinterer Rand =
// vorderer Rand plus Breite. Breite in dieser Reihenfolge (Nutzerentscheid 23.10.2026):
//   1. AV-Fläche Trottoir quer über die Zufahrt (beobachtung.trottoirAnZufahrt, Breite entlang der Zufahrtsachse);
//   2. Breite des angrenzenden AV-Trottoirs links bzw. rechts der Zufahrt (velo.trottoirNeben, Mittel der gefundenen Seiten) –
//      der häufige Planungsfall: die Einmündung ist in der AV durchgehend Strasse, das Trottoir läuft beidseits;
//   3. Breite von Hand;
//   4. Annahme TUE_BREITE_ANNAHME_M (2,00 m, kleinste Breite nach VSS 40 242 Ziffer 16).
// Hinterer Trottoirrand je Seite (Abstand von der Mittellinie des Arms): AV-Trottoir der Seite (äusserer Rand), sonst der hintere
// Rand der Überfahrt (AV quer) parallel zur Strasse, sonst Fahrbahnrand plus Breite. Gehlinie für die Sicht auf das Trottoir
// TUE_GEHLINIE_M (0,50 m) vor dem hinteren Trottoirrand (VSS 40 242 Ziffer 14.4). Nur Geometrie, keine Regeln der Sicht (rechnen.ts).

import { type P, dist, median } from '../geo'
import { punkteAufSpur } from './spur'
import { abschneiden } from './netz'
import { versetzt, mitVerlaengerung, schnittBei, lot } from './hauptachsen'

/** VSS 40 242 Ziffer 14.4: massgebende Geh- bzw. Fahrlinie so weit vor dem hinteren Rand des Trottoirs [m] */
export const TUE_GEHLINIE_M = 0.5
/** Breite der Überfahrt ohne AV und ohne Eingabe (Annahme; kleinste Breite nach VSS 40 242 Ziffer 16) [m] */
export const TUE_BREITE_ANNAHME_M = 2.0
/** VSS 40 242 Ziffer 16: unter dieser Breite des angrenzenden Trottoirs wird der hintere Rand der Überfahrt zurückgesetzt [m] */
export const TUE_BREITE_ZIFFER16_M = 2.0
/** hinterer Rand: so weit entlang der Arme gezeichnet bzw. geschnitten [m] */
const RAND_LAENGE_M = 60
/** hinterer Rand: Schnitt mit der Zufahrtsachse mindestens so weit hinter dem vorderen Rand, sonst vorderer Rand plus Breite [m] */
const MIN_LAENGE_M = 0.3

/** eine Seite der Zufahrt: Mittellinie des Arms (vom Knoten weg), Seite der Zufahrt (+1 links von u, −1 rechts), Abstand des
 *  Fahrbahnrands von der Mittellinie, AV-Trottoir neben dem Arm (velo.trottoirNeben) */
export interface TueSeite { ml: P[]; seite: 1 | -1; rand: number; t: { abstand: number; breite: number; n: number } | null }

export interface TueBand {
  breite: number
  quelle: 'av_quer' | 'av_neben' | 'eingabe' | 'annahme'
  sHinter: number             // hinterer Rand auf der Zufahrtsachse (Bogenlänge)
  laenge: number              // sHinter − sRand
  hinten: [number, number]    // hinterer Trottoirrand je Seite: Abstand von der Mittellinie [m]
  gehlinie: [number, number]  // Gehlinie je Seite: Abstand von der Mittellinie [m]
  herkunft: [string, string]  // Herkunft des hinteren Rands je Seite (Text)
  hinweise: string[]
}

const f2 = (x: number) => x.toFixed(2).replace('.', ',')

/**
 * Band der Trottoirüberfahrt. zAchse: Achse des Zufahrtsstreifens vom Knoten weg, sRand: Bordkante auf ihr, kp: Knoten, seiten:
 * links und rechts der Zufahrt (Reihenfolge wie die Richtungen), quer: AV-Trottoir quer über die Zufahrt (oder null), eingabe:
 * Breite von Hand (oder null).
 */
export function tueBand(zAchse: P[], sRand: number, kp: P, seiten: [TueSeite, TueSeite], quer: { sHinter: number; breite: number } | null,
  eingabe: number | null): TueBand {
  const hinweise: string[] = []
  const neben = seiten.filter(s => s.t).map(s => s.t!.breite)
  const [breite, quelle]: [number, TueBand['quelle']] = quer ? [quer.breite, 'av_quer'] : neben.length ? [median(neben), 'av_neben'] :
    eingabe !== null ? [eingabe, 'eingabe'] : [TUE_BREITE_ANNAHME_M, 'annahme']
  if (eingabe !== null && (quelle === 'av_quer' || quelle === 'av_neben'))
    hinweise.push(`Breite der Trottoirüberfahrt von Hand ${f2(eingabe)} m ohne Wirkung: die AV liefert die Breite (${f2(breite)} m; ` +
      'Reihenfolge AV quer über die Zufahrt, angrenzendes Trottoir, Eingabe, Annahme).')
  if ((quelle === 'av_quer' || quelle === 'av_neben') && breite < TUE_BREITE_ZIFFER16_M - 0.005)
    hinweise.push(`Trottoir nach AV ${f2(breite)} m breit, schmaler als ${f2(TUE_BREITE_ZIFFER16_M)} m: nach VSS 40 242 Ziffer 16 wäre der ` +
      'hintere Rand der Überfahrt zurückzusetzen; gerechnet mit der Breite nach AV.')
  // hinterer Rand der Überfahrt auf der Zufahrtsachse (AV quer) als Punkt, für die Seiten ohne eigenes AV-Trottoir
  const hQuer = quer ? punkteAufSpur(zAchse, [quer.sHinter])[0]?.[0] ?? null : null
  const hinten = seiten.map((s): [number, string] => {
    if (s.t) return [s.t.abstand + s.t.breite / 2, `hinterer Rand der AV-Fläche Trottoir, ${s.t.n} Querschnitte, Trottoir ${f2(s.t.breite)} m`]
    if (hQuer) return [dist(hQuer, lot(mitVerlaengerung(s.ml), hQuer).p), 'hinterer Rand des AV-Trottoirs quer über die Zufahrt, parallel zur Strasse']
    return [s.rand + breite, `Fahrbahnrand plus Breite der Überfahrt ${f2(breite)} m, parallel zur Strasse`]
  })
  // Gehlinie TUE_GEHLINIE_M vor dem hinteren Rand, höchstens in der Mitte des Trottoirs
  const geh = seiten.map((s, j) => hinten[j][0] - Math.min(TUE_GEHLINIE_M, Math.max(0, hinten[j][0] - s.rand) / 2))
  let sHinter: number
  if (quer) sHinter = quer.sHinter
  else {
    const teile = seiten.map((s, j) => versetzt(abschneiden(s.ml, RAND_LAENGE_M), s.seite * hinten[j][0]))
    const x = schnittBei(zAchse, [...[...teile[0]].reverse(), ...teile[1]], kp)
    if (x && x.sa > sRand + MIN_LAENGE_M) sHinter = x.sa
    else {
      sHinter = sRand + breite
      hinweise.push('Die Zufahrtsachse schneidet den hinteren Trottoirrand nicht: hinterer Rand der Überfahrt im Abstand der Breite ' +
        'hinter der Bordkante angenommen.')
    }
  }
  return { breite, quelle, sHinter, laenge: sHinter - sRand, hinten: [hinten[0][0], hinten[1][0]], gehlinie: [geh[0], geh[1]],
    herkunft: [hinten[0][1], hinten[1][1]], hinweise }
}
