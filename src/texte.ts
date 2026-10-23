// ── Textbausteine zum Status (Panel und Bericht, E4a) ──
//
// Aus App.tsx herausgelöst, damit Panel und Bericht dieselben Wörter brauchen. Der Bericht setzt vor jeden Status ein Zeichen
// (statusMarke), damit er auch schwarz-weiss gedruckt lesbar bleibt.

import type { RichtungErgebnis, RvStatus, TueBreiteQuelle, TuePhase } from './rechner/typen'

export const f1 = (x: number) => x.toFixed(1).replace('.', ',')
export const f2 = (x: number) => x.toFixed(2).replace('.', ',')
/** Neigung mit Vorzeichen, Dezimalkomma */
export const fi = (x: number) => (x > 0 ? '+' : x < 0 ? '−' : '±') + String(Math.abs(Math.round(x * 10) / 10)).replace('.', ',')

export const STATUS_TEXT: Record<string, string> = {
  erfuellt: 'erfüllt (≥ oberer Wert)', massgebend: 'massgebender Wert erfüllt', nicht_erfuellt: 'nicht erfüllt', keine_zufahrt: 'kein Verkehr von dieser Seite',
}
/** Rechtsvortritt (E3c): Status der Richtung nach Abb. 6 */
export const STATUS_RV: Record<string, string> = {
  erfuellt: 'erfüllt (anzustrebender Zustand)', massgebend: 'bedingt (zulässig als Ausnahme, Abb. 6)',
  nicht_erfuellt: 'nicht erfüllt (zu sanieren)',
}
/** Rechtsvortritt (E3c): «nicht erfüllt» nur wegen des Sichtfelds nach Abb. 5 (Abb. 6 nicht «zu sanieren») */
export const nurAbb5 = (r: RichtungErgebnis) => !!r.rv && r.statusZusatz.includes('Sichtfeld nach Abb. 5 nicht frei') &&
  !r.statusZusatz.some(z => z.includes('zu sanierender'))
export const rvStatusText = (r: RichtungErgebnis, st: string) =>
  (st === 'nicht_erfuellt' && nurAbb5(r) ? 'nicht erfüllt (Sichtfeld nach Abb. 5)' : STATUS_RV[st])
export const RV_STATUS_TEXT: Record<RvStatus, string> = { erfuellt: 'erfüllt', bedingt: 'bedingt', nicht_erfuellt: 'nicht erfüllt', keine: 'keine Prüfung' }
/** Status einer Sicht von D bzw. D' (Velo, Trottoir; E3b) */
export const STATUS_TEXT_TEIL: Record<string, string> = { erfuellt: 'erfüllt', nicht_erfuellt: 'nicht erfüllt' }

/** Trottoirüberfahrt (K0): Herkunft der Breite kurz und Status einer Phase (Panel und Bericht) */
export const TUE_BREITE_KURZ: Record<TueBreiteQuelle, string> = {
  av_quer: 'AV, Trottoir quer über die Zufahrt', av_neben: 'AV, wie das angrenzende Trottoir', eingabe: 'von Hand', annahme: 'Annahme',
}
export const tuePhaseText = (p: TuePhase) => (p.status === 'keine_zufahrt' ? 'nicht geprüft' : p.fehlt.length ?
  `nicht erfüllt (${p.fehlt.join(', ')})` : STATUS_TEXT[p.status])

/** Status Motorfahrzeuge einer Richtung als Text (Tab. 1 bzw. Abb. 6, ohne Zusätze) */
export const autoText = (r: RichtungErgebnis) => r.status === 'keine_zufahrt' ? r.keinGrund ?? STATUS_TEXT.keine_zufahrt :
  r.rv ? rvStatusText(r, r.status) : STATUS_TEXT[r.status]

/** Gesamtstatus je Richtung (E3b): schlechtester von Auto, Velo und Trottoir mit dem fehlenden Teil */
export const gesamtText = (r: RichtungErgebnis) => r.gesamt === 'keine_zufahrt' ? r.keinGrund ?? STATUS_TEXT.keine_zufahrt :
  r.gesamtFehlt.length ? `nicht erfüllt: ${r.gesamtFehlt.join(', ')}` : r.status === 'keine_zufahrt' ? 'erfüllt (ohne Motorfahrzeuge)' :
  r.rv ? rvStatusText(r, r.gesamt) : STATUS_TEXT[r.gesamt]

/**
 * Zeichen vor dem Status im Bericht (schwarz-weiss lesbar): ✓ erfüllt, (✓) bedingt (Rechtsvortritt «zulässig», RvStatus bedingt),
 * ✗ nicht erfüllt, – keine Prüfung bzw. kein Verkehr. Der massgebende Wert nach Tab. 1 gilt als erfüllt.
 */
export function statusMarke(status: string, rv = false): string {
  if (status === 'erfuellt') return '✓'
  if (status === 'massgebend') return rv ? '(✓)' : '✓'
  if (status === 'bedingt') return '(✓)'
  if (status === 'nicht_erfuellt') return '✗'
  return '–'
}
