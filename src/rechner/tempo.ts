// ── Tempo aus OSM: maxspeed, Zonen, Mehrheit entlang der Spur (aus fgsCheck) ──
//
// Übernommen aus fgsCheck (rechner/tempo.ts): wegTempo, zonenTempo, tempoBei, tempoEntlang. Die Tabellen der VSS 40 241 sind
// entfernt; die Stufen und Sichtweiten kommen aus der VSS 40 273 Tab. 1 (rechner/sichtweite.ts). Ohne Angabe 50 km/h
// (TEMPO_ERSATZ, als Annahme ausgewiesen).

import { type P, dot, einheit, sub, add, dist } from '../geo'
import type { OsmNetz } from './netz'
import { RASTER } from './netz'
import { punkteAufSpur } from './spur'
import { tempoStufe } from './sichtweite'

export const TEMPO_ERSATZ = 50
const TEMPO_SUCHRADIUS = 5.0
const ACHSE_MAX_WINKEL = 35 * Math.PI / 180

/** Zonen-Angaben (zone:maxspeed, maxspeed:type) -> km/h, z. B. CH:zone30, CH:zone20, CH:urban */
export function zonenTempo(v: string | undefined): number | null {
  if (!v) return null
  // CH:zone30 bzw. CH:30 (zone:maxspeed in der Schweiz oft ohne «zone»; Befund Prüfrunde E0)
  const z = /^CH:(?:zone)?(\d+)$/.exec(v.trim())
  if (z) return parseInt(z[1], 10)
  return ({ 'CH:urban': 50, 'CH:rural': 80, 'CH:trunk': 100, 'CH:motorway': 120, 'CH:living_street': 20 } as Record<string, number>)[v.trim()] ?? null
}

/** Tempo eines OSM-Wegs: maxspeed (OsmNetz.maxspeed), sonst zone:maxspeed bzw. maxspeed:type, sonst Begegnungszone
 * (living_street) 20 km/h; sonst null */
export function wegTempo(netz: OsmNetz, wid: number): [number, string] | null {
  const v = netz.maxspeed(wid)
  if (v) return [tempoStufe(v), 'OSM maxspeed']
  const t = netz.W.get(wid)?.t ?? {}
  const z = zonenTempo(t['zone:maxspeed']) ?? zonenTempo(t['maxspeed:type'])
  if (z) return [tempoStufe(z), 'OSM zone:maxspeed bzw. maxspeed:type']
  if (netz.W.get(wid)?.hw === 'living_street') return [20, 'OSM living_street']
  return null
}

/** Achsen.tempo_bei mit OSM: Tempo des nächsten zur Richtung parallelen Wegs bei p (TEMPO_SUCHRADIUS, ±35°) */
export function tempoBei(netz: OsmNetz, p: P, richtung: P, radius = TEMPO_SUCHRADIUS): number | null {
  let best: [number, number] | null = null
  const cx = Math.floor(p[0] / RASTER), cy = Math.floor(p[1] / RASTER)
  const gesehen = new Set<string>()
  for (let gx = cx - 1; gx <= cx + 1; gx++) for (let gy = cy - 1; gy <= cy + 1; gy++) {
    for (const [wid, k] of netz.raster.get(`${gx},${gy}`) ?? []) {
      const key = `${wid},${k}`
      if (gesehen.has(key)) continue
      gesehen.add(key)
      const t = wegTempo(netz, wid)
      if (!t) continue
      const nds = netz.w(wid).nds
      const a = netz.p(nds[k]), b = netz.p(nds[k + 1]), w = sub(b, a), l2 = dot(w, w)
      if (l2 === 0) continue
      const tt = Math.max(0, Math.min(1, dot(sub(p, a), w) / l2))
      const d = dist(p, add(a, w, tt))
      if (d <= radius && Math.abs(dot(einheit(w), richtung)) >= Math.cos(ACHSE_MAX_WINKEL) && (best === null || d < best[0]))
        best = [d, t[0]]
    }
  }
  return best ? best[1] : null
}

/**
 * Achsen.tempo_entlang (fgsCheck): das Tempo, das auf dem grössten Teil der Spur innerhalb der Länge laenge(tempo) gilt (alle
 * 2 m ab h; Gleichstand -> höheres), bis dreimal neu gerechnet; Pendel -> das höhere Tempo der Schleife (grössere Sichtweite).
 * -> [tempo, Treffer entlang der Spur, Pendel]
 */
export function tempoEntlang(netz: OsmNetz, weg: P[], tempoStart0: number, h: number, laenge: (tempo: number) => number):
  [number, boolean, number[] | null] {
  let tempo = tempoStart0, treffer = false
  const folge = [tempoStart0], ergebnis = new Map<number, number>()
  let pendel: number[] | null = null
  for (let runde = 0; runde < 3; runde++) {
    const sw = laenge(tempo)
    const zaehl = new Map<number, number>()
    const abst: number[] = []
    for (let k = 0; k <= Math.floor(sw / 2); k++) abst.push(h + k * 2)
    for (const [q, tRueck] of punkteAufSpur(weg, abst)) {
      const v = tempoBei(netz, q, tRueck)
      if (v) zaehl.set(v, (zaehl.get(v) ?? 0) + 2)
    }
    if (!zaehl.size) break
    treffer = true
    let neu = -1, nb = -1
    for (const [v, c] of zaehl) if (c > nb || (c === nb && v > neu)) { neu = v; nb = c }
    ergebnis.set(tempo, neu)
    if (neu === tempo) break
    if (folge.includes(neu)) {
      const schleife = [...new Set(folge.slice(folge.indexOf(neu)))].sort((a, b) => a - b)
      pendel = schleife
      const gross = schleife[schleife.length - 1]
      tempo = ergebnis.get(gross) ?? gross
      break
    }
    folge.push(neu)
    tempo = neu
  }
  return [tempo, treffer, pendel]
}
