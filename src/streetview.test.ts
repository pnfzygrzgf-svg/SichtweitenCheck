import { describe, expect, it } from 'vitest'
import { peilung, richtungStreetView, streetViewUrl } from './streetview'
import type { P } from './geo'

describe('Street View (Link, 31.10.2026)', () => {
  it('URL mit Standpunkt und Blickrichtung 0–359', () => {
    expect(streetViewUrl(46.9, 7.4, 370)).toBe('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=46.900000,7.400000&heading=10')
    expect(streetViewUrl(46.9, 7.4, null)).not.toContain('heading')
  })
  it('Peilung LV95: Nord 0°, Ost 90°, West 270°', () => {
    expect(peilung([0, 0], [0, 10])).toBe(0)
    expect(peilung([0, 0], [10, 0])).toBe(90)
    expect(peilung([0, 0], [-10, 0])).toBe(270)
  })
  it('je Richtung: von D zum Punkt bei A (begrenzt aufs Ende der Zielpunkte); ohne Zielpunkte null', () => {
    const D: P = [2600000, 1199990]
    const pts: P[] = Array.from({ length: 31 }, (_, i) => [2600000 - i, 1200000] as P)
    expect(richtungStreetView(D, pts, 10)).toContain('&heading=315')
    expect(richtungStreetView(D, pts, 999)).toContain('heading=')
    expect(richtungStreetView(D, [], 10)).toBeNull()
  })
})
