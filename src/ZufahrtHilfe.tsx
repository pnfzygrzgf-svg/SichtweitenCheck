import { ZUFAHRT_HERKUNFT, zufahrtWinkel } from './rechner/grundstueck'
import type { ZufahrtHerkunft } from './rechner/typen'
import type { ZufahrtEntwurf } from './zufahrtEntwurf'
import type { P } from './geo'

export function ZufahrtHilfe({ erster, entwurf, laden, fehler, art, grad, osm, waehlen, winkel, uebernehmen, abbrechen }: {
  erster: P | null; entwurf: ZufahrtEntwurf | null; laden: boolean; fehler: string | null; art: ZufahrtHerkunft; grad: string; osm: boolean
  waehlen: (a: ZufahrtHerkunft) => void; winkel: (text: string) => void; uebernehmen: () => void; abbrechen: () => void
}) {
  return <div className="werkzeughilfe">
    <b>Grundstückszufahrt setzen:</b> {!erster ? 'Auf den Fahrbahnrand klicken, auf der Seite des Grundstücks.' :
      'Zweiten Punkt im Grundstück setzen, den Richtungsgriff ziehen oder den Winkel eingeben. Danach übernehmen.'}
    {erster && <>
      {laden && <p className="klein">Strassenachse und Fahrbahnrand für die Vorschau werden geladen …</p>}
      <div className="knopfzeile">
        <button className={art === 'senkrecht' ? 'aktiv' : 'zweit'} onClick={() => waehlen('senkrecht')}>Senkrecht (90°)</button>
        <button className={art === 'osm' ? 'aktiv' : 'zweit'} disabled={!osm} onClick={() => waehlen('osm')}>Erkannte OSM-Zufahrt</button>
      </div>
      <label>Winkel zur Strassenachse{' '}<input aria-label="Winkel der Grundstückszufahrt in Grad" type="number" min={20} max={160} step="any"
        value={art === 'winkel' ? grad : entwurf ? Number(zufahrtWinkel(entwurf.geo.strassenRichtung, entwurf.geo.richtung).toFixed(1)) : ''}
        onChange={e => winkel(e.target.value)} /> °</label>
      <div className="klein">Eigene Winkel: 20°–160°; 90° = rechtwinklig. 0° folgt dem grauen Pfeil der lokalen Strassenachse, 180° zeigt in die Gegenrichtung.
        Der orange Pfeil zeigt vom Rand ins Grundstück; das Fahrzeug fährt zur Strasse.</div>
      {entwurf && <p className="klein">Vorschau: {ZUFAHRT_HERKUNFT[art]}, {zufahrtWinkel(entwurf.geo.strassenRichtung, entwurf.geo.richtung).toFixed(1).replace('.', ',')}°;
        {' '}{entwurf.geo.strasse}.</p>}
      {fehler && <p className="fehler" role="status">{fehler}</p>}
    </>}
    <div><button onClick={uebernehmen} disabled={!entwurf || laden}>Zufahrt übernehmen</button>{' '}
      <button className="zweit" onClick={abbrechen}>Abbrechen</button></div>
  </div>
}
