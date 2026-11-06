// Fussgängerquerungen am Knoten: jede einzeln, nie eine still gewählte
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { lv95 } from './geo'
import { QUERUNG_KNOTEN_M, QuerungenAmKnoten, querungenAmKnoten } from './querungenAmKnoten'

const K = lv95(46.95, 7.45)
const u = (id: number, lat: number, lon: number, tags: Record<string, string>) => ({ id, lat, lon, tags })
const osm = {
  uebergaenge: [u(1, 46.9502, 7.45, { highway: 'crossing', crossing: 'zebra' }), u(2, 46.94985, 7.45, { highway: 'crossing', crossing: 'unmarked' }),
    u(3, 46.96, 7.45, { highway: 'crossing' })],
  wege: [{ id: 9, tags: { name: 'Bernstrasse' }, knoten: [1, 7], geom: [] }],
}

describe('querungenAmKnoten', () => {
  it('nur im Suchbereich, die nächste zuerst, mit Strasse, Richtung und Art', () => {
    const l = querungenAmKnoten(osm, K)
    expect(l.map(q => q.id)).toEqual([2, 1])
    expect(l[1]).toMatchObject({ strasse: 'Bernstrasse', himmel: 'Nord', art: 'Fussgängerstreifen' })
    expect(l[0]).toMatchObject({ strasse: 'Strasse ohne Namen', himmel: 'Süd', art: 'unmarkierte Querung' })
    expect(l.every(q => q.abstandM <= QUERUNG_KNOTEN_M)).toBe(true)
  })
})

describe('QuerungenAmKnoten', () => {
  it('jeder Eintrag öffnet genau seinen Übergang', () => {
    const html = renderToStaticMarkup(<QuerungenAmKnoten liste={querungenAmKnoten(osm, K)} ort={{ lat: 46.95, lon: 7.45 }} />)
    expect(html).toContain('uebergang=1')
    expect(html).toContain('uebergang=2')
    expect(html).not.toContain('uebergang=3')
  })
  it('ohne Treffer: kein Nachweis, dass es keine Querung gibt', () => {
    const html = renderToStaticMarkup(<QuerungenAmKnoten liste={[]} ort={{ lat: 46.95, lon: 7.45 }} />)
    expect(html).toContain('Das heisst nicht, dass es keine gibt')
    expect(html).toContain('Querung hier auswählen oder planen')
    expect(html).not.toContain('uebergang=')
  })
})
