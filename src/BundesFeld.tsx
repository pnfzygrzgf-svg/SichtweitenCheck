import type { Eingaben, Ergebnis } from './rechner/typen'
import type { RegionalSnapshot } from './daten/anbieter/gemeinsam/regional'
import type { ZhStrasse } from './daten/anbieter/gemeinsam/zuerichZuordnung'
import { bundHinweise, bundProbe } from './daten/anbieter/gemeinsam/bundHinweise'
import { bundBelegText, type BundBeleg } from './daten/anbieter/gemeinsam/bundBelege'
export function BundesFeld({ feld, daten, ergebnis, strassen, eingaben, setzen, osmStand }: { osmStand?:string; feld:'typ'|'innerorts'; daten:RegionalSnapshot|null; ergebnis:Ergebnis; strassen:ZhStrasse[]; eingaben:Eingaben; setzen:(f:(e:Eingaben)=>Eingaben)=>void }) {
  const probe=bundProbe(ergebnis.richtungen[0]?.achse ?? []), p=probe?.p ?? ergebnis.nullpunkt, r=probe?.richtung
  const xs=bundHinweise(daten,p,r,strassen).filter(x=>x.objekt.bund?.typ===(feld==='typ'?'strasse':'bauzone'))
  const beleg=eingaben.bundesbelege?.[feld]
  const auswahl=xs.filter((x,i)=>xs.findIndex(y=>y.quelleId===x.quelleId && y.objekt.bund?.code===x.objekt.bund?.code)===i)
  return <div className="klein bundes-feld">
    <div>OpenStreetMap: Datenstand {osmStand || 'unbekannt'} (Datenquelle)</div>
    {feld==='typ' && eingaben.typ!==null && !beleg && <button type="button" className="zweit quelle-chip" onClick={()=>setzen(e=>({...e,typ:null}))}>Wieder aus OSM übernehmen</button>}
    {feld==='innerorts' && <label>Ortslage <select aria-label="Inner- oder ausserorts" value={eingaben.innerorts==null?'vorgabe':String(eingaben.innerorts)} onChange={ev=>{const v=ev.target.value;setzen(e=>({...e,innerorts:v==='vorgabe'?null:v==='true',bundesbelege:{...e.bundesbelege,innerorts:undefined}}))}}><option value="vorgabe">Aus OSM</option><option value="true">innerorts (eigene Prüfung)</option><option value="false">ausserorts (eigene Prüfung)</option></select></label>}
    {auswahl.map(x=>{const wert=feld==='typ'?(x.objekt.bund?.code===200?'hvs':'es'):true
      const b:BundBeleg={feld,wert,quelleId:feld==='typ'?'bund.strasse':'bund.bauzone',objektIds:xs.filter(y=>y.quelleId===x.quelleId && y.objekt.bund?.code===x.objekt.bund?.code).map(y=>y.objekt.id),datenstand:x.datenstand,abgerufen:x.abgerufen,text:x.text}
      return <div key={`${x.quelleId}:${x.objekt.bund?.code}`}><button type="button" className="zweit quelle-chip" title={x.text} onClick={()=>setzen(e=>({...e,[feld]:wert,bundesbelege:{...e.bundesbelege,[feld]:b}}))}>{feld==='typ'?`swissTLM3D · ${wert==='hvs'?'Hauptverkehrsstrasse':'Erschliessungs-/Sammel-/Verbindungsstrasse'} bestätigen`:'ARE Bauzone · Innerortslage bestätigen'}</button> Datenstand {x.datenstand}</div>
    })}
    {!!auswahl.length && <p>{feld==='typ'?'Die TLM-Verkehrsbedeutung ist keine direkte Normklassierung. Prüfe die Zuordnung zur Vortrittsstrasse.':'Eine Bauzone belegt keine Ortstafel. Tatsächliche Innerortslage vor der Übernahme prüfen; beeinflusst B und den Überholfall.'}</p>}
    {beleg && beleg.wert===eingaben[feld] && <p>{bundBelegText(beleg)} <button type="button" className="zweit quelle-chip" onClick={()=>setzen(e=>({...e,[feld]:null,bundesbelege:{...e.bundesbelege,[feld]:undefined}}))}>Wieder automatisch ermitteln</button></p>}
  </div>
}
