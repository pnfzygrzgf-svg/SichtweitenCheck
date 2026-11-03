import { expect, it } from 'vitest'
import { fallLesen, fallSchreiben, leererFall, eingabenZahl, FALL_VERSION } from './fall'
import { bundBelegText, type BundBeleg } from './daten/anbieter/gemeinsam/bundBelege'
it('speichert bestätigte Ortslage samt Datenstand in aktueller Fall-Version; neue Rohdaten überschreiben keine Entscheidung',()=>{
 const f=leererFall(46.95,7.44,12)
 const b:BundBeleg={feld:'innerorts',wert:true,quelleId:'bund.bauzone',objektIds:['bund.bauzone:1:a'],datenstand:'01.01.2022',abgerufen:'2026-11-02T00:00:00Z',text:'Tatsächliche Ortslage geprüft'}
 f.eingaben.innerorts=true;f.eingaben.bundesbelege={innerorts:b}
 const [g,h]=fallLesen(fallSchreiben(f));expect(h).toEqual([]);expect(g.eingaben.innerorts).toBe(true);expect(g.eingaben.bundesbelege?.innerorts).toEqual(b)
 expect(g.version).toBe(FALL_VERSION);expect(eingabenZahl(g)).toBe(1);expect(bundBelegText(b)).toContain('Datenstand 01.01.2022')
 const x=JSON.parse(fallSchreiben(f));x.eingaben.innerorts=false
 const [g2,h2]=fallLesen(JSON.stringify(x));expect(g2.eingaben.innerorts).toBe(false);expect(g2.eingaben.bundesbelege).toBeUndefined();expect(h2.join(' ')).toContain('bundesbelege.innerorts')
})
