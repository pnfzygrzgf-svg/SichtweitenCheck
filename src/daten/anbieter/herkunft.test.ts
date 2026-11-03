import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import herkunft from './herkunft.json'

describe('gemeinsame Anbieter aus fgsCheck', () => {
  it('alle übernommenen Dateien entsprechen den gespeicherten Prüfsummen', () => {
    const root = join(__dirname, 'gemeinsam')
    const dateien = (dir: string, prefix = ''): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory()
      ? dateien(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]).sort()
    expect(dateien(root)).toEqual(Object.keys(herkunft.dateien).sort())
    for (const [name, hash] of Object.entries(herkunft.dateien))
      expect(createHash('sha256').update(readFileSync(join(root, name))).digest('hex'), name).toBe(hash)
    expect(herkunft.quelle).toBe('fgsCheck/fgsCheckWeb')
  })
})
