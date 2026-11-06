// Quellen im Bericht: nur Genutztes, kein Kartenkontext (Prüfung 06.11.2026)
import { describe, expect, it } from 'vitest'
import { berichtQuellenZeilen } from './BerichtQuellen'
import type { Fall } from './fall'

describe('Quellen im Bericht', () => {
  it('Kartenkontext und Gebietsbestimmung stehen nicht in der Tabelle, Tempo aus regionalen Daten schon; Links zu den Anbietern', () => {
    const fall = { quellen: { gebiet: 'g', vsig: 'Geodaten Stadt Bern, Signalisierte Höchstgeschwindigkeit' }, amtlicheQuellen: { bav: { halte: [] } },
      regional: { teile: [{ id: 'unbekannt', objekte: [], datenstand: 'x', abgerufen: '2026-11-06' }] } } as unknown as Fall
    const z = berichtQuellenZeilen({ fall, quellen: {}, kantone: ['BE'], avFuer: 'Fahrbahn', osmFuer: 'Strassennetz' })
    expect(z.map(x => x.quelle)).toEqual(['Amtliche Vermessung (Bodenbedeckung)', 'OpenStreetMap (Overpass)', 'Signalisierte Höchstgeschwindigkeit'])
    expect(z.every(x => x.fuer !== 'nur Kartenkontext')).toBe(true)
    expect(z.map(x => x.url)).toEqual(['https://www.geodienste.ch/', 'https://www.openstreetmap.org/', 'https://map.bern.ch/'])
  })
})
