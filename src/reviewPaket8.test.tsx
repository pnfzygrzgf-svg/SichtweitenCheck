import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DatenQuellen, Datenschutz } from './Hilfe'
import Startseite from './Startseite'
import { E6_DIENSTE } from './daten/anbieter/gemeinsam/e6'
it('nennt Beleuchtung, taktile Rillen und Wegnetz nicht mehr in der Datenhilfe und im Datenschutz',()=>{
 const html=renderToStaticMarkup(<DatenQuellen />)+renderToStaticMarkup(<Datenschutz />)
 for(const d of E6_DIENSTE){expect(html).not.toContain(d.name)}
 expect(html).not.toContain('kein Beleuchtungsnachweis')
 expect(html).not.toContain('Beleuchtungsstandorte')
})
it('nennt Kanton Zürich und St. Gallen als Empfänger bereits auf der Startseite',()=>{
 const html=renderToStaticMarkup(<Startseite onStart={()=>{}} />)
 expect(html).toContain('maps.zh.ch');expect(html).toContain('daten.stadt.sg.ch')
})
it('erklärt den Kartenkontext ohne internes Paketkürzel',()=>{
 const html=renderToStaticMarkup(<Datenschutz />)
 expect(html).not.toContain('E6-');expect(html).toContain('data.stadt-zuerich.ch')
})
