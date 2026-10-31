// ── Panel-Abschnitt «Regeln» (Korrektur 31.10.2026, Punkt 9c; Muster fgsCheck RegelUebersicht.tsx): alle Regeln des Katalogs (regeln.ts),
// umschaltbar nach Quelle (Normreihenfolge, nach Herkunft gegliedert) bzw. nach Thema. Je Regel Herkunft und Wirkung («fliesst in die
// Rechnung ein» bzw. «nur Hinweis»); Wert und Daten nur, wo es sie gibt. Sprung aus der Quellentabelle: Ereignis «swc-regel» mit dem Werk ──

import { Fragment, useEffect, useState } from 'react'
import { REGELN, THEMEN, WERKE, WIRKUNG_TEXT, regelGruppen, regelWerkAnker, regelnZaehlen, type Gliederung, type Regel,
  type WerkId } from './regeln'
import { REGEL_EREIGNIS, hilfeZeigen } from './verweise'

const themaName = new Map(THEMEN)

export function RegelUebersicht() {
  const [nach, setNach] = useState<Gliederung>('quelle')
  const [ziel, setZiel] = useState<string | null>(null)
  useEffect(() => {
    const h = (e: Event) => {
      const w = (e as CustomEvent<{ werk?: WerkId }>).detail?.werk
      if (w) { setNach('quelle'); setZiel(regelWerkAnker(w)) }
    }
    window.addEventListener(REGEL_EREIGNIS, h)
    return () => window.removeEventListener(REGEL_EREIGNIS, h)
  }, [])
  useEffect(() => {
    if (!ziel) return
    const t = window.setTimeout(() => { hilfeZeigen(ziel); setZiel(null) }, 0)
    return () => window.clearTimeout(t)
  }, [ziel, nach])
  const gruppen = regelGruppen(nach)
  const z = regelnZaehlen()
  return <div className="regel-uebersicht">
    <p className="klein">Alle {REGELN.length} Regeln, die die App anwendet: was sie prüft, Fundstelle (Ziffer und Seite), Wert und Daten,
      soweit es sie gibt. Herkunft: {z.herkunft.map(([h, n]) => `${h} ${n}`).join(', ')}. {z.wirkung['rechnet mit']} Regeln fliessen in
      die Rechnung ein, {z.wirkung['nur Hinweis']} geben nur einen Hinweis und ändern das Ergebnis nicht. Die Zahl «Regeln» in den Quellen
      der Prüfungen zählt die Regeln unter dem Werk. Die Normen sind kostenpflichtig; die App zeigt keine Normtabellen.</p>
    <div className="klein regel-steuerung" role="radiogroup" aria-label="Gliederung">Gliederung:{' '}
      {(['quelle', 'thema'] as const).map(x => <label key={x}><input type="radio" name="regel-gliederung" checked={nach === x}
        onChange={() => setNach(x)} /> nach {x === 'quelle' ? 'Quelle' : 'Thema'}</label>)}</div>
    {gruppen.map((g, i) => <Fragment key={g.schluessel}>
      {g.herkunft && g.herkunft !== gruppen[i - 1]?.herkunft && <div className="regel-herkunft klein">{g.herkunft}</div>}
      <details className="regel-gruppe" id={nach === 'quelle' ? regelWerkAnker(g.schluessel.slice(5) as WerkId) : undefined}>
        <summary><b>{g.name}</b> <span className="klein">({g.regeln.length})</span></summary>
        <ul className="regel-liste">{g.regeln.map(r => <li key={r.id}>
          <b>{r.titel}</b> <span className="regel-nr">({r.id})</span> · {r.herkunft} ·{' '}
          <span className={r.wirkung === 'nur Hinweis' ? 'regel-wirkung regel-hinweis' : 'regel-wirkung'}>{WIRKUNG_TEXT[r.wirkung]}</span>
          {nach === 'quelle' ? <span className="klein"> · {themaName.get(r.thema)}</span> : <span className="klein"> · {WERKE[r.werk].name}</span>}
          <dl className="regel-teile klein">
            <dt>Prüft:</dt><dd>{r.prueft}</dd>
            <dt>Fundstelle:</dt><dd>{WERKE[r.werk].name}, {r.fundstelle}</dd>
            {r.werte && <><dt>Wert:</dt><dd>{r.werte}</dd></>}
            {r.daten && <><dt>Daten:</dt><dd>{r.daten}</dd></>}
          </dl>
        </li>)}</ul>
      </details>
    </Fragment>)}
  </div>
}

/** Liste der Regeln eines Falls (Bericht): je Werk mit Herkunft die angewendeten Regeln mit Fundstelle; Regeln, die nur einen Hinweis
 *  geben, sind so bezeichnet */
export function RegelnFall({ gruppen }: { gruppen: { werk: WerkId; regeln: Regel[] }[] }) {
  return <ul className="klein">{gruppen.map(g => <li key={g.werk}><b>{WERKE[g.werk].name}</b> ({WERKE[g.werk].ausgabe};{' '}
    {WERKE[g.werk].herkunft}):{' '}
    {g.regeln.map((r, i) => <Fragment key={r.id}>{i ? '; ' : ''}{r.titel} ({r.fundstelle}{r.wirkung === 'nur Hinweis' ?
      `; ${WIRKUNG_TEXT[r.wirkung]}` : ''})</Fragment>)}</li>)}</ul>
}
