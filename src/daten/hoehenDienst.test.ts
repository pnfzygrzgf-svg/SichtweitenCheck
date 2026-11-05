// Tests Höhendienste (daten/hoehenDienst.ts): Wahl je Ort, Modellname in der Messung, Rückfall
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BERN_DTM, HOEHEN_DIENSTE, SWISSALTI, hoehenDienst, hoehenDienstFuer, hoehenName, ladeNeigungMit, mitRueckfall, neigungMit, rueckfallText } from './hoehenDienst'
import { HOEHEN_QUELLE, modellName } from '../rechner/neigung'
import { AbrufFehler } from './holen'

afterEach(() => vi.unstubAllGlobals())

describe('Wahl des Dienstes', () => {
  it('in der Stadt Bern zuerst das DTM der Stadt, dann swissALTI3D; sonst nur swissALTI3D', () => {
    expect(hoehenDienstFuer(true)).toEqual([BERN_DTM, SWISSALTI])
    expect(hoehenDienstFuer(false)).toEqual([SWISSALTI])
  })
  it('Kennungen, Schlüssel und Namen; Dienst zum Modellnamen bzw. Schlüssel', () => {
    expect(HOEHEN_DIENSTE.map(d => d.id)).toEqual(['swissalti', 'bern.dtm'])
    expect(SWISSALTI).toMatchObject({ kurz: 'swissALTI3D', host: 'api3.geo.admin.ch', schluessel: 'hoehen' })
    expect(BERN_DTM).toMatchObject({ kurz: 'DTM 2023 Stadt Bern', host: 'gisapp.bern.ch', schluessel: 'hoehenBern' })
    expect(hoehenDienst('hoehenBern')).toBe(BERN_DTM)
    expect(hoehenDienst('swissALTI3D')).toBe(SWISSALTI)
    expect(hoehenDienst(undefined)).toBeUndefined()
    expect(hoehenName(SWISSALTI)).toBe('Höhenmodell (swissALTI3D, swisstopo; Profile)')
    expect(hoehenName(BERN_DTM)).toBe('Höhenmodell (DTM 2023 Stadt Bern, Geodaten Stadt Bern; Profile)')
  })
})

describe('Modellname', () => {
  it('neigungMit: swissALTI3D wie der Kern, Bern mit dem Namen des DTM; Werte unverändert', () => {
    const profil = Array.from({ length: 21 }, (_, i) => ({ dist: i * 2.5, h: 500 + i * 0.05 }))
    const s = neigungMit(SWISSALTI, profil), b = neigungMit(BERN_DTM, profil)
    expect(s.quelle.startsWith(HOEHEN_QUELLE)).toBe(true)
    expect(b.quelle.startsWith('DTM 2023 Stadt Bern (Geodaten Stadt Bern), Profil')).toBe(true)
    expect([b.i, b.laenge, b.punkte]).toEqual([s.i, s.laenge, s.punkte])
    expect(neigungMit(BERN_DTM, new Error('HTTP 503')).quelle).toBe('DTM 2023 Stadt Bern (Geodaten Stadt Bern) nicht verfügbar')
    expect(modellName(b.quelle)).toBe('DTM 2023 Stadt Bern')
    expect(modellName(s.quelle)).toBe('swissALTI3D')
    expect(modellName('swissALTI3D (swisstopo) nicht verfügbar')).toBe('swissALTI3D')
    expect(modellName('von Hand')).toBe('von Hand')
  })
  it('ladeNeigungMit: Fehler des Dienstes ergibt i = null mit Fehlertext, Abbruch wird weitergereicht', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.signal?.aborted) throw new DOMException('abgebrochen', 'AbortError')
      return new Response('x', { status: 500 })
    }))
    const [m, a] = await ladeNeigungMit(BERN_DTM, [[2600000, 1200000], [2600050, 1200000]])
    expect(m.i).toBeNull()
    expect(a).toBe('HTTP 500')
    const ctrl = new AbortController(); ctrl.abort()
    await expect(ladeNeigungMit(BERN_DTM, [[2600000, 1200000], [2600050, 1200000]], ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('mitRueckfall', () => {
  it('erster Dienst wirft: Meldung einmal, zweiter liefert mit seinem Dienst; erster liefert: kein Rückfall', async () => {
    const meldungen: string[] = []
    const r = await mitRueckfall([BERN_DTM, SWISSALTI], async d => { if (d === BERN_DTM) throw new AbrufFehler('HTTP 503'); return 'ok' },
      (d, f, n) => meldungen.push(`${d.id}: ${rueckfallText(f, n)}`))
    expect(r).toEqual({ dienst: SWISSALTI, wert: 'ok' })
    expect(meldungen).toEqual(['bern.dtm: HTTP 503 (Rückfall auf swissALTI3D)'])
    const melden = vi.fn()
    expect(await mitRueckfall([BERN_DTM, SWISSALTI], async d => d.id, melden)).toEqual({ dienst: BERN_DTM, wert: 'bern.dtm' })
    expect(melden).not.toHaveBeenCalled()
  })
  it('beide werfen: Fehler des letzten; Abbruch sofort weitergereicht, ohne Meldung', async () => {
    const melden = vi.fn()
    await expect(mitRueckfall([BERN_DTM, SWISSALTI], async d => { throw new Error(`${d.id} kaputt`) }, melden)).rejects.toThrow('swissalti kaputt')
    expect(melden).toHaveBeenCalledTimes(1)
    const abbruch = vi.fn()
    await expect(mitRueckfall([BERN_DTM, SWISSALTI], async () => { throw new DOMException('abgebrochen', 'AbortError') }, abbruch)).rejects.toMatchObject({ name: 'AbortError' })
    expect(abbruch).not.toHaveBeenCalled()
  })
})
