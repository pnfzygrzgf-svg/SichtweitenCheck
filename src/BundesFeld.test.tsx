import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BundesFeld } from './BundesFeld'
import { KEINE_ALLE_EINGABEN, type Ergebnis } from './rechner/typen'
import type { P } from './geo'
import type { RegionalSnapshot } from './daten/anbieter/gemeinsam/regional'
it('zeigt den bestätigungspflichtigen TLM-Chip direkt am Feld auch bei einer Achse mit zwei Stützpunkten',()=>{
 const p:P=[2600000,1200000],linie:P[]=[[2599950,1200000],[2600200,1200000]],s:RegionalSnapshot={version:1,mitte:p,radiusM:200,teile:[{id:'bund.strasse',datenstand:'24.02.2026',abgerufen:'2026-11-02T00:00:00Z',url:'',roh:{},objekte:[{id:'bund.strasse:1:a',name:'Teststrasse',teile:[linie],bund:{typ:'strasse',code:300},tempo:null,zone:null,stand:null,bestaetigen:true,hinweis:'Normklasse prüfen'}]}]}
 const html=renderToStaticMarkup(<BundesFeld feld="typ" daten={s} ergebnis={{nullpunkt:p,richtungen:[{achse:[p,[2600200,1200000]]}]} as Ergebnis} strassen={[{name:'Teststrasse',tags:{highway:'primary'},teile:[linie]}]} eingaben={KEINE_ALLE_EINGABEN} setzen={()=>{}} osmStand="02.11.2026 (OSM-Replikationsstand)" />)
 expect(html).toContain('swissTLM3D');expect(html).toContain('bestätigen');expect(html).toContain('Datenstand 24.02.2026');expect(html).toContain('02.11.2026 (OSM-Replikationsstand)')
 expect(html).toContain('keine direkte Normklassierung')
})
