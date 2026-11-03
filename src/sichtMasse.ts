import { richtungSichtId, kreiselSichtId } from './SichtKennung'
import { add, sub, dist, einheit, type P } from './geo'
import type { SichtArt } from './Sichtfelder'

export interface SichtMass { rolle?: 'bezug'; objekt?: string; objekte?: string[]; art: SichtArt; linien: P[][]; p: P; text: string; hinweis: string }
const f = (x: number) => x.toFixed(1).replace('.', ',')
/** Exakte Bogenlänge, auch zwischen Stützpunkten; nie die Diagonale als Sichtweite ausgeben. */
export function massStrecke(linie: P[], soll: number): { linie: P[]; laenge: number } {
  if (!linie.length || !Number.isFinite(soll) || soll < 0) return { linie: [], laenge: 0 }
  const aus: P[] = [linie[0]]
  let rest = soll
  for (let i = 1; i < linie.length && rest > 1e-8; i++) {
    const a = linie[i - 1], b = linie[i], d = dist(a, b)
    if (d < 1e-8) continue
    if (d > rest) { aus.push(add(a, sub(b, a), rest / d)); rest = 0 }
    else { aus.push(b); rest -= d }
  }
  return { linie: aus, laenge: soll - rest }
}
export function massAchse(achse: P[], soll: number, name: string, art: SichtArt, versatz = 3): SichtMass | null {
  const m = massStrecke(achse, soll), l = m.linie
  if (l.length < 2 || m.laenge < 0.01) return null
  const u = einheit(sub(l[l.length - 1], l[0])), n: P = [-u[1], u[0]]
  const pl = l.map(p => add(p, n, versatz)), linien: P[][] = [pl, [l[0], pl[0]], [l[l.length - 1], pl[pl.length - 1]]]
  // Pfeile an beiden Enden, auf den Masslinien; kleine feste Länge in Meter.
  for (const [p, q] of [[pl[0], pl[1]], [pl[pl.length - 1], pl[pl.length - 2]]]) {
    const t = einheit(sub(q, p)), v: P = [-t[1], t[0]], a = add(p, t, Math.min(0.8, m.laenge / 4))
    linien.push([add(a, v, 0.3), p, add(a, v, -0.3)])
  }
  const mitte = massStrecke(pl, m.laenge / 2).linie
  const unvollstaendig = m.laenge + 0.05 < soll
  return { art, linien, p: mitte[mitte.length - 1], text: `${name} ${f(soll)} m${unvollstaendig ? ` (gezeichnet ${f(m.laenge)} m)` : ''}`,
    hinweis: unvollstaendig ? 'Die geladene Achse erreicht die erforderliche Sichtweite nicht; die Masslinie endet an der vorhandenen Geometrie.' :
      'Mass entlang der berechneten Achse; versetzte Masslinie mit Bezugslinien.' }
}
export function massPunkt(p: P, text: string, art: SichtArt, hinweis = ''): SichtMass { return { art, linien: [], p, text, hinweis } }
export function sichtLinie(D: P, ziel: P, text: string, art: SichtArt): SichtMass {
  return { art, linien: [[D, ziel]], p: add(D, sub(ziel, D), 0.65), text, hinweis: 'Sichtlinie, keine entlang der Strasse gemessene Sichtweite.' }
}
export function massGerade(a: P, b: P, name: string, art: SichtArt, versatz = 3): SichtMass | null {
  return massAchse([a, b], dist(a, b), name, art, versatz)
}

/** Schrift ist in SVG-Einheiten skaliert; ihr Platz gehört ebenfalls zum Bildausschnitt. */
export function massBildPunkte(masse: SichtMass[], breiteM: number, vb = 1000): P[] {
  return masse.flatMap(m => {
    const halb = (m.text.length * 8 + 12) * breiteM / vb / 2
    return [...m.linien.flat(), [m.p[0] - halb, m.p[1]] as P, [m.p[0] + halb, m.p[1] + 22 * breiteM / vb] as P]
  })
}

import type { Ergebnis, KnotenInfo } from './rechner/typen'
export function swcSichtMasse(e: Ergebnis | null, kn: KnotenInfo | null = null): SichtMass[] {
  const out: SichtMass[] = []
  const dazu = (m: SichtMass | null) => { if (m) out.push(m) }
  const k = kn?.kreisel
  if (k?.sicht && k.zufahrt) {
    for (const [art, t] of [['auto', k.sicht.auto], ['velo', k.sicht.velo]] as const) dazu(massAchse(t.achse, t.A, `A ${art === 'auto' ? 'Auto' : 'Velo'}`, art, art === 'auto' ? 3 : -3))
    for (const art of ['auto', 'velo'] as const) dazu(massGerade(k.zufahrt.rand, k.zufahrt.Dachse, 'B', art, -3))
    if (k.sicht.az) dazu(massAchse(k.sicht.az.achse, k.sicht.az.A, 'Az Vergleich', 'auto', 5))
    const v = k.vermessung, mitte = v.mitte
    // Durchschnittliche Radien als solche bezeichnen; keine perfekte Kreisform vortäuschen.
    dazu(massGerade(mitte, add(mitte, [1, 0], v.aussenR), 'Rₐ mittel', 'auto', 2))
    if (v.inselR > 0) dazu(massGerade(mitte, add(mitte, [0, 1], v.inselR), 'Rᵢ mittel', 'auto', 2))
    const b = k.beta.betaGon
    for (const art of ['auto', 'velo'] as const) out.push(massPunkt(add(mitte,[0,-1],3), b == null ? `V ${k.beta.tempo} km/h (Annahme)` :
      `β ${f(b)} gon (${f(b * 0.9)}°); V ${k.beta.tempo} km/h${k.beta.annahme ? ' (Annahme)' : ''}`, art, k.beta.tempoGrund))
    for (const m of out) {
      const id = (art: string) => kreiselSichtId(kn!.id, k.sicht!.arm + '|' + art)
      if (m.art === 'velo') m.objekt = id('Velo')
      else if (m.text.startsWith('Az')) m.objekt = id('Az')
      else if (m.text.startsWith('A Auto')) m.objekt = id('Ak')
      else m.objekte = [id('Ak'), ...(k.sicht.az ? [id('Az')] : [])]
    }
    return out
  }
  if (!e) return out
  for (const r of e.richtungen) {
    const beginn = out.length
    const name = r.lage === 'gegenueber' ? 'gegenüber' : r.lage
    if (r.status !== 'keine_zufahrt') {
      dazu(massAchse(r.achse, r.massgebend, `A Auto ${name}`, 'auto'))
      const l = massStrecke(r.achse, r.massgebend).linie
      if (l.length) out.push(sichtLinie(e.D, l[l.length - 1], 'S', 'auto'))
      if (l.length >= 2 && r.randAbstand > 0) {
        const ziel = l[l.length - 1], u = einheit(sub(ziel, l[l.length - 2])), n: P = [-u[1], u[0]]
        dazu(massGerade(ziel, add(ziel, n, r.randAbstand), 'd', 'auto', 1))
      }
    }
    if (r.velo) {
      dazu(massAchse(r.velo.achse, r.velo.A, `A Velo ${name}`, 'velo', -3))
      const l = massStrecke(r.velo.achse, r.velo.A).linie
      if (l.length) out.push(sichtLinie(e.D, l[l.length - 1], 'S″', 'velo'))
    }
    if (r.ueberholfall) {
      dazu(massAchse(r.ueberholfall.achse, r.ueberholfall.A, `A Überholen ${name}`, 'ueberholen', 6))
      const l = massStrecke(r.ueberholfall.achse, r.ueberholfall.A).linie
      if (l.length) out.push(sichtLinie(e.D, l[l.length - 1], 'S′', 'ueberholen'))
    }
    for (const m of out.slice(beginn)) m.objekt = richtungSichtId(e, r)
  }
  // B wird im Rechenkern entlang der Zufahrtsachse gemessen; seitlicher Lenker-Versatz ist kein Teil von B.
  for (const art of (['auto', 'velo', 'ueberholen'] as const).filter(art => e.richtungen.some(r => art === 'auto' ? r.status !== 'keine_zufahrt' : art === 'velo' ? !!r.velo : !!r.ueberholfall))) dazu(massGerade(e.nullpunkt, e.Dachse, e.Dhand ? 'B wirksam' : 'B', art, -3))
  if (e.bBezug?.linie.length) for (const art of (['auto', 'velo', 'ueberholen'] as const).filter(art => e.richtungen.some(r =>
    art === 'auto' ? r.status !== 'keine_zufahrt' : art === 'velo' ? !!r.velo : !!r.ueberholfall))) out.push({
      art, rolle: 'bezug', linien: [e.bBezug.linie], p: e.bBezug.linie[0], text: 'B-Bezug (abgeleitet)', hinweis: e.bBezug.quelle })
  if (e.trottoirPruefung) {
    const t = e.trottoirPruefung
    dazu(massGerade(t.hinterkante, t.Dachse, 'B Trottoir', 'trottoir', 3))
    for (const r of t.richtungen) { const m = massAchse(r.achse, r.A, `A Trottoir ${r.lage}`, 'trottoir', 5); if (m) out.push({ ...m, objekt: richtungSichtId(e, r) }) }
  }
  for (const art of (['auto', 'velo', 'ueberholen'] as const).filter(art => e.richtungen.some(r => art === 'auto' ? r.status !== 'keine_zufahrt' : art === 'velo' ? !!r.velo : !!r.ueberholfall))) out.push(massPunkt(add(e.rand, e.fbRichtung, -5), `α ${f(e.einbiegewinkel)}°`, art, 'Einbiegewinkel aus der Rechnung; keine eigene Winkeleingabe.'))
  for (const m of out) if (!m.objekt && !m.objekte) m.objekte = e.richtungen.filter(r => m.art === 'auto' ? r.status !== 'keine_zufahrt' : m.art === 'velo' ? !!r.velo : m.art === 'ueberholen' ? !!r.ueberholfall : true).map(r => richtungSichtId(e, r))
  return out
}
