// SW-04 (Prüfung 10.11.2026): Anzeige des Status «offen» (Zielpunkt bei A im Schatten eines Stamms); Rechnung in rechner/sw04.test.ts
import { expect, it } from 'vitest'
import { OFFEN_A_TEXT } from './rechner/sichtweite'
import { STATUS_RV, STATUS_TEXT, STATUS_TEXT_TEIL, statusMarke } from './texte'

it('Status «offen»: Text mit Ziffer 11, Marke «?», auch beim Rechtsvortritt und für Velo bzw. Überholfall', () => {
  expect(STATUS_TEXT.offen).toBe(OFFEN_A_TEXT)
  expect(STATUS_RV.offen).toBe(OFFEN_A_TEXT)
  expect(OFFEN_A_TEXT).toContain('Ziffer 11')
  expect(STATUS_TEXT_TEIL.offen).toContain('vor Ort prüfen')
  expect(statusMarke('offen')).toBe('?')
})
