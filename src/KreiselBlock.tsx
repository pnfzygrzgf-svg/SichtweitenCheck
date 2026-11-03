import { SichtTaste, SichtfelderWahl, kreiselSichtId } from './Sichtfelder'
// ── Kreisel im Panel (K1 bis K4): Typ mit Umschalter, Form und Masse aus der AV bzw. aus OSM geschätzt, Innenring-Vorschlag, Arme
//    mit Bypass, Wahl der Einfahrt (K2: Fahrlinien, K, D), Ablenkungswinkel β je Fahrbeziehung und Tempo auf der Kreiselfahrbahn (K3),
//    Ergebnis der Sicht (K4: Ak, Velo, Sichtberme, Az als Vergleichswert) ──

import type { KnotenInfo, KreiselTyp, KreiselBeziehung, KreiselSichtTeil } from './rechner/typen'
import { AZ_QUELLE } from './rechner/kreiselsicht'
import { STATUS_FARBE } from './Karte'
import { STATUS_TEXT } from './texte'
import { armText, nachNr } from './rechner/knoten'
import { KREISEL_TYP_TEXT, INNENRING_AB_M, KREISEL_ARM_GRAD, KREISEL_ARM_M, KREISEL_BREITE_OHNE_AV_M, MINI_D_MIN, MINI_D_MAX,
  KLEIN_D_MIN, KLEIN_D_MAX, NICHT_RUND_AB, BYPASS_M, VELOBYPASS_UMKREIS_M, VELOBYPASS_ARM_M } from './rechner/kreisel'
import { HILFSLINIE_M, BETA_40_UNTER_GON, BETA_30_UEBER_GON, BETA_EMPFOHLEN_GON, DREI_ARME_GON, TEMPO_OHNE_BETA, TEMPO_MINI,
  QUERSCHNITT_AUSSEN_M, FAHRSTREIFEN_ANNAHME_M } from './rechner/kreiselfahrt'
import { FAHRERSITZ_M } from './rechner/beobachtung'
import { f1, f2 } from './texte'
import Info from './Info'

const TYPEN: KreiselTyp[] = ['klein', 'mini']

export default function KreiselBlock({ kn, setTyp, zufahrt, zufahrtWaehlen, setBeziehung }: { kn: KnotenInfo
  setTyp: (t: KreiselTyp | null) => void; zufahrt: string | null; zufahrtWaehlen: (key: string) => void
  setBeziehung: (key: string, an: boolean | null) => void }) {
  const k = kn.kreisel!
  const v = k.vermessung
  const geschaetzt = v.quelle === 'osm'
  const rund = v.dMax / v.dMin < NICHT_RUND_AB
  const nr = (key: string) => k.arme.find(a => a.key === key)?.nr ?? '?'
  const z = k.zufahrt
  const b = k.beta
  // Fahrbeziehungen: zuerst die nach der Regel bzw. von Hand aktiven, dann die übrigen (eingeklappt)
  const aktiv = b.beziehungen.filter(x => x.aktiv || x.vorgabe), weitere = b.beziehungen.filter(x => !x.aktiv && !x.vorgabe)
  const zeile = (x: KreiselBeziehung) => (
    <tr key={x.key} className={x.key === b.massgebend ? 'massgebend' : undefined}>
      <td><label><input type="checkbox" checked={x.aktiv} onChange={ev => setBeziehung(x.key, ev.target.checked === x.vorgabe ? null : ev.target.checked)} />
        {' '}{nr(x.von)} → {nr(x.nach)}</label>{x.aktiv !== x.vorgabe && <span className="warnung"> (von Hand)</span>}</td>
      <td>{x.gueltig ? <>{f1(x.betaGon!)} gon ({f1(x.betaGrad!)}°){x.key === b.massgebend ? ' · massgebend' : ''}</> : <span className="warnung">{x.grund}</span>}</td>
      <td className="klein">{x.fall ? `Fall ${x.fall}` : ''}</td>
    </tr>
  )
  return (
    <section>
      <h2>1 Kreisel: {kn.name}</h2>
      <details className="klein knotendaten">
        <summary>OSM-Ring mit {k.ringKnoten.length} Punkten, {k.arme.length} Arme</summary>
        <p>Ringwege (OSM junction=roundabout bzw. circular): {k.ringWege.join(', ')}; Kennung: kleinster Ringpunkt {kn.id}.</p>
      </details>
      <table className="zahlen">
        <tbody>
          <tr><td>Typ<Info titel="Klein- oder Minikreisel">
            <p>Kleinkreisel haben {KLEIN_D_MIN} bis {KLEIN_D_MAX} m Aussendurchmesser und eine nicht überfahrbare Mittelinsel, Minikreisel
              {' '}{MINI_D_MIN} bis {MINI_D_MAX} m und eine ganz oder teilweise überfahrbare Insel (VSS 40 263 Ziffern 3 und 4, S. 4).</p>
            <p>Die App wählt den Typ nach dem mittleren Aussendurchmesser, auf ganze Meter gerundet (Annahme für die Lücke zwischen
              {' '}{MINI_D_MAX} und {KLEIN_D_MIN} m). Liegt ein Kreisel an der Grenze oder ist die Insel anders gebaut, den Typ hier umschalten.</p>
            <p>Für Minikreisel nennt die Norm keine eigenen Sichtregeln; die App prüft sie wie Kleinkreisel, mit {TEMPO_MINI} km/h auf der
              Kreiselfahrbahn ohne Ablenkungswinkel (Annahme).</p></Info></td><td>
            <div className="knopfzeile">
              {TYPEN.map(t => <button key={t} className={k.typ === t ? 'aktiv' : 'zweit'} onClick={() => setTyp(t === k.typVorgabe ? null : t)}>
                {KREISEL_TYP_TEXT[t]}</button>)}
            </div>
            <div className="klein">{k.typGewaehlt ? `(gewählt; nach dem Durchmesser ${KREISEL_TYP_TEXT[k.typVorgabe]})` :
              '(nach dem Aussendurchmesser)'}</div>
          </td></tr>
          <tr><td>Aussendurchmesser<Info titel="Messung">
            {geschaetzt ? <p>Die AV zeigt an dieser Stelle keinen Kreisel. Die Form folgt der OSM-Linie des Rings: Die App nimmt an, dass
              die Linie in der Mitte einer {f2(KREISEL_BREITE_OHNE_AV_M)} m breiten Kreiselfahrbahn liegt (Annahme).</p> : <>
              <p>Gemessen auf der Fahrbahn der amtlichen Vermessung (AV, Strasse/Weg), mit Strahlen aus der Mitte im Abstand von 1°. Je
                Strahl zählt das Fahrbahnstück, auf dem die OSM-Linie des Rings liegt.</p>
              <p><b>Aussenrand:</b> je Richtung; zwischen den Armen gemessen ({v.strahlen} Randpunkte), in den Armen (dort läuft die
                Fahrbahn weiter) aus dem Abstand zur OSM-Linie ergänzt, dann geglättet. So bleibt auch ein Oval ein Oval.</p>
              <p><b>Mittelinsel:</b> die Fläche ohne Fahrbahn um die Mitte, gleich welche AV-Art (Verkehrsinsel, Grünfläche usw.). Führt
                eine Fahrbahn quer durch die Insel (etwa ein Tramtrassee), ergänzt die App den Inselrand über die Lücke.</p></>}
            <p>Als nicht kreisrund gilt ein Kreisel, wenn der grösste Aussendurchmesser mindestens {f1(NICHT_RUND_AB)}-mal so gross ist wie
              der kleinste (Annahme).</p>
            </Info></td>
            <td>{f1(v.durchmesser)} m{rund ? '' : ` im Mittel (${f1(v.dMin)} bis ${f1(v.dMax)} m)`}
              {geschaetzt && <span className="warnung"> (geschätzt)</span>}</td></tr>
          <tr><td>Kreiselfahrbahn</td><td>{f1(v.breite)} m breit{rund ? '' : ' im Mittel'}{geschaetzt && <span className="warnung"> (Annahme)</span>}</td></tr>
          <tr><td>Mittelinsel</td><td>{v.inselR > 0 ? `Durchmesser ${f1(2 * v.inselR)} m${rund ? '' : ' im Mittel'}` : 'keine (ganz Fahrbahn)'}
            {v.inselErgaenzt > 0 && v.inselR > 0 && ` (Rand auf ${v.inselErgaenzt}° ergänzt)`}
            {geschaetzt && <span className="warnung"> (geschätzt)</span>}</td></tr>
          <tr><td>Innenring (Vorschlag)<Info titel="Innenring">
            <p>Der Innenring ist der Teil der Kreiselfahrbahn, der über {f2(INNENRING_AB_M)} m Breite hinausgeht (VSS 40 263 Ziffer 16,
              S. 12).</p>
            <p>Die App schlägt ihn je Richtung {f2(INNENRING_AB_M)} m innerhalb des Aussenrands vor, wo die Kreiselfahrbahn breiter ist.
              Aus der AV lässt er sich nicht lesen: vor Ort bzw. im Luftbild prüfen. Ein nur markierter Innenring zählt wie ein gebauter.</p></Info></td>
            <td>{v.innenringR !== null ? `Durchmesser ${f1(2 * v.innenringR)} m, ${f1(v.innenringR - v.inselR)} m breit` +
              (v.innenringAnteil < 0.995 ? ` (auf ${Math.round(v.innenringAnteil * 100)} % des Umfangs)` : '') :
              `keiner (Fahrbahn höchstens ${f2(INNENRING_AB_M)} m)`}</td></tr>
        </tbody>
      </table>
      {k.ausserhalb && <p className="klein warnung">{k.ausserhalb}.</p>}

      <h3>Einfahrt wählen<Info titel="Arme und Einfahrt">
        <p>Strassen, die am Ring beginnen (OSM, ohne Zufahrtswege «service»). Getrennte Wege derselben Strasse, etwa Einfahrt und
          Ausfahrt um eine Leitinsel, bilden einen Arm, wenn sie {KREISEL_ARM_M} m vom Ring höchstens {KREISEL_ARM_GRAD}° auseinander
          liegen (Annahme). Wege, die ganz am Ring vorbeiführen, und Tramgleise sind keine Arme. Nummern im Uhrzeigersinn ab Norden.</p>
        <p><b>Bypass:</b> Mündet eine zweite Einfahrt eines Arms höchstens {BYPASS_M} m vor der Ausfahrt des nächsten Arms in den Ring,
          gilt sie als Bypass (Annahme): gestrichelt auf der Karte, keine Einfahrt zum Wählen; das Einfädeln prüft die App nicht.</p>
        <p><b>Velobypass:</b> ein Rad- bzw. Fuss- und Radweg (OSM highway=cycleway bzw. path/footway mit bicycle=designated oder yes), der
          den Ring nicht berührt, ganz innerhalb von {VELOBYPASS_UMKREIS_M} m um die Mitte liegt und mit beiden Enden höchstens
          {' '}{VELOBYPASS_ARM_M} m von zwei verschiedenen Armen entfernt ist (Annahme, auch für lückenhaft kartierte Wege). Er ist kein Arm;
          seine Querungen und Einmündungen prüft die App nicht. Velos auf dem Ring prüft die App wie die übrigen Fahrzeuge.</p>
        <p>Geprüft wird nur der Verkehr von links auf der Kreiselfahrbahn; einen Rechtsvortritt gibt es am Kreisel nicht.</p></Info></h3>
      <div className="knopfzeile">
        {nachNr(k.arme).map(a => <button key={a.key} className={a.key === zufahrt ? 'aktiv' : 'zweit'} disabled={!a.ein && a.key !== zufahrt}
          onClick={() => zufahrtWaehlen(a.key)} title={a.ein ? `Einfahrt OSM-Weg ${a.ein.split(':')[0]}` : 'nur Ausfahrt: keine Einfahrt'}>
          {armText(a)}{a.ein ? '' : ' · nur Ausfahrt'}{a.bypass.length ? ' · mit Bypass' : ''}</button>)}
      </div>
      {k.arme.some(a => a.velobypass.length) && <ul className="klein">
        {nachNr(k.arme).flatMap(a => a.velobypass.map(x => <li key={`${a.key}-${x.wege.join('-')}`}>Arm {a.nr}: Velobypass zu Arm {x.zu}</li>))}
      </ul>}
      {k.zufahrtFehler && <p className="klein warnung">{k.zufahrtFehler}</p>}
      {z && <table className="zahlen">
        <tbody>
          <tr><td>Fahrlinie der Einfahrt<Info titel="Fahrlinien, K und D">
            <p><b>Fahrlinie der Einfahrt:</b> Mitte des Einfahrtsfahrstreifens, aus dem AV-Querschnitt {QUERSCHNITT_AUSSEN_M} m ausserhalb
              des Kreisels (Einbahn: Mitte der Fahrbahn, mit Gegenverkehr: Mitte der rechten Hälfte; liegt die OSM-Linie auf einer
              Mittelinsel: Mitte der Fahrbahn rechts davon; benachbarte OSM-Wege, auch Radwege, begrenzen den Querschnitt; ist er zu breit
              oder fehlt er, gilt ein anderer Abstand; ohne Querschnitt {f2(FAHRSTREIFEN_ANNAHME_M)} m breite Fahrstreifen; Annahmen).</p>
            <p><b>Fahrlinie mit Vortritt:</b> je Richtung in der Mitte zwischen Aussenrand und Innenring bzw. Insel, im Gegenuhrzeigersinn
              von links auf die Einfahrt (Entscheid E2). K ist ihr Schnitt mit der Fahrlinie der Einfahrt.</p>
            <p><b>D:</b> B = {f2(z.B)} m hinter dem Rand der Kreiselfahrbahn (Wartelinie) auf der Fahrlinie der Einfahrt, am Fahrer*innensitz
              {' '}{f2(FAHRERSITZ_M)} m links davon (Annahme, wie am Knoten).</p></Info></td><td className="klein">{z.lageQuelle}</td></tr>
          <tr><td>D</td><td>B {f2(z.B)} m hinter der Wartelinie <span className="klein">({z.bGrund})</span></td></tr>
        </tbody>
      </table>}

      <h3>Ablenkungswinkel β<Info titel="Ablenkungswinkel">
        <p>Je Fahrbeziehung (Einfahrt → Ausfahrt) die Tangente an den Inselrand (Fall 1) bzw. den Rand des Innenrings (Fall 2) und an die
          Hilfslinie {f2(HILFSLINIE_M)} m innerhalb der Ausrundung R<sub>e2</sub> am rechten Rand der Einfahrt; die Ausfahrt spiegelbildlich.
          β ist der Winkel zwischen den beiden Tangenten (VSS 40 263 Ziffer 17, S. 12, Abb. 6).</p>
        <p>Die Ausrundung R<sub>e2</sub> ist ein Kreis durch den rechten AV-Rand an der Mündung, wo dieser zusammenhängend aufweitet und
          gut auf einen Kreis passt (Annahme). Fehlt sie (eckige Mündung, keine
          AV), läuft die Hilfslinie gerade {f2(HILFSLINIE_M)} m innerhalb des rechten Rands und die Tangente beginnt an der Wartelinie (Annahme).
          Die Startpunkte von Hand zu verschieben folgt später.</p>
        <p>Fahrbeziehungen: gegenüberliegende Arme; bei drei Armen nur, wenn die Arme mehr als {DREI_ARME_GON} gon einschliessen
          (Ziffer 17). Jede Fahrbeziehung lässt sich an- und abwählen.</p>
        <p>Tempo auf der Kreiselfahrbahn nach dem kleinsten β (Ziffer 13.2, S. 8–9): unter {BETA_40_UNTER_GON} gon 40 km/h,
          {' '}{BETA_40_UNTER_GON} bis {BETA_30_UEBER_GON} gon 35 km/h, darüber 30 km/h. Ohne gültige Konstruktion {TEMPO_OHNE_BETA} km/h,
          beim Minikreisel fest {TEMPO_MINI} km/h (Annahmen). Empfohlen sind mindestens {BETA_EMPFOHLEN_GON} gon (Ziffer 17, S. 13).</p></Info></h3>
      {b.beziehungen.length ? <table className="zahlen">
        <tbody>{aktiv.map(zeile)}</tbody>
      </table> : <p className="klein">Keine Fahrbeziehung (zu wenige Arme mit Ein- bzw. Ausfahrt).</p>}
      {weitere.length > 0 && <details className="klein"><summary>weitere Fahrbeziehungen ({weitere.length})</summary>
        <table className="zahlen"><tbody>{weitere.map(zeile)}</tbody></table></details>}
      <p>Tempo auf der Kreiselfahrbahn: <b>{b.tempo} km/h</b>{' '}
        <span className={b.annahme ? 'klein warnung' : 'klein'}>({b.tempoGrund})</span></p>

      {(k.hinweise.length > 0 || k.annahmen.length > 0) && <ul className="klein">
        {k.hinweise.map(h => <li key={h}>{h}</li>)}
        {k.annahmen.map(h => <li key={h}><span className="warnung">Annahme:</span> {h}</li>)}
      </ul>}
    </section>
  )
}

/** Status eines Teils am Kreisel in Worten (Az: Regelfall / nur Minimal / nicht erfüllt) */
export const kreiselStatusText = (t: KreiselSichtTeil, az = false): string => az ?
  (t.status === 'erfuellt' ? 'Regelfall erfüllt' : t.status === 'massgebend' ? 'nur Minimalwert erfüllt' : 'nicht erfüllt') :
  t.status === 'erfuellt' ? (t.oben > t.A ? 'erfüllt (≥ oberer Wert)' : 'erfüllt') : t.status === 'massgebend' ? 'massgebender Wert erfüllt' : 'nicht erfüllt'
const vorhandenText = (t: KreiselSichtTeil) => `${f1(t.vorhanden)} m${t.bisEnde ? ' (bis zum Ende der Linie frei)' : ''}`

/** nötiger Wert, auf eine Runde begrenzt (Annahme): mit dem ungekürzten Normwert */
export const nochText = (t: KreiselSichtTeil, normal: string): string => (t.begrenzt ? `${t.begrenzt.grund}: begrenzt auf ${f1(t.oben)} m ` +
  `(Annahme); ungekürzt ${t.begrenzt.oben > t.begrenzt.A ? `${f1(t.begrenzt.A)} m, oberer Wert ${f1(t.begrenzt.oben)} m` :
  `${f1(t.begrenzt.A)} m`}` : normal)

/** K4: Ergebnis der Sicht aus der gewählten Einfahrt (Schritt 4) */
export function KreiselErgebnis({ kn }: { kn: KnotenInfo }) {
  const k = kn.kreisel!, s = k.sicht!
  const arm = k.arme.find(a => a.key === s.arm)!
  const zeile = (name: string, t: KreiselSichtTeil, noetig: string, az = false) => (
    <tr><td>{name}</td><td>{noetig}<div className="klein">{t.text}</div></td><td>{vorhandenText(t)}{t.verdecker && !t.bisEnde &&
      <div className="klein">verdeckt ab {f1(t.verdecker.sVerdeckt)} m: {t.verdecker.name}</div>}</td>
      <td><SichtTaste id={kreiselSichtId(kn.id, s.arm + '|' + (az ? 'Az' : name.toLowerCase().includes('velo') ? 'Velo' : 'Ak'))} art={name.toLowerCase().includes('velo') ? 'velo' : 'auto'} className="feld" style={{ borderColor: STATUS_FARBE[t.status], backgroundColor: `${STATUS_FARBE[t.status]}1f` }}>{kreiselStatusText(t, az)}</SichtTaste></td></tr>)
  return (
    <section>
      <h2>4 Ergebnis</h2>
      <SichtfelderWahl arten={['auto', 'velo']} />
      <p className="leitsatz">Sicht aus der Einfahrt {armText(arm)} nach links auf die Kreiselfahrbahn: <b>{STATUS_TEXT[s.gesamt]}</b>
        <Info titel="Sicht am Kreisel">
          <p><b>Ak:</b> von D (B {f2(k.zufahrt!.B)} m hinter der Wartelinie, am Fahrer*innensitz) auf die Fahrlinie mit Vortritt, ab K gegen die
            Fahrtrichtung (VSS 40 263 Ziffer 13.2, S. 8–9). A nach VSS 40 273 Tab. 1 mit dem Tempo aus dem Ablenkungswinkel.</p>
          <p>Die Linie läuft höchstens eine ganze Runde auf der Fahrlinie mit Vortritt. Wäre die nötige Sicht länger, gilt die Rundenlänge als
            nötig (Annahme); der ungekürzte Wert steht daneben.</p>
          <p><b>Velo:</b> dieselbe Linie, A nach VSS 40 273 Tab. 3.</p>
          <p><b>Sichtberme:</b> der Teil der Insel bzw. des Innenrings im Sichtfeld; dort nichts zwischen 0,60 und 3,00 m Höhe. Liegt ein
            Hindernis darin, ist die Sicht nicht erfüllt.</p>
          <p><b>Az</b> (Sicht zur Zufahrt links): Vergleichswert, kein Normwert ({AZ_QUELLE}). Er zählt nicht zum Gesamtstatus.</p>
          <p>Gesamtstatus: schlechtester von Ak, Velo und Sichtberme.</p></Info></p>
      <table className="zahlen">
        <thead><tr><th>Teil</th><th>nötig</th><th>vorhanden</th><th>Status</th></tr></thead>
        <tbody>
          {zeile('Motorfahrzeuge (Ak)', s.auto, nochText(s.auto, s.auto.oben > s.auto.A ? `${f1(s.auto.A)} m (oberer Wert ${f1(s.auto.oben)} m)` : `${f1(s.auto.A)} m`))}
          {zeile('Velo', s.velo, nochText(s.velo, `${f1(s.velo.A)} m`))}
          <tr><td>Sichtberme</td><td>{s.berme.flaechen.length ? `${s.berme.ganz ? 'ganze Insel' : `bis ${f1(s.berme.tiefe)} m ab dem Inselrand`}` +
            (s.berme.innenring ? ', mit Innenring' : '') : 'keine Insel im Sichtfeld'}</td>
            <td>{s.berme.hindernisse.length ? `darin: ${s.berme.hindernisse.join(', ')}` : 'frei'}</td>
            <td><span className="feld" style={{ borderColor: STATUS_FARBE[s.berme.status], background: `${STATUS_FARBE[s.berme.status]}1f` }}>
              {s.berme.status === 'erfuellt' ? 'frei' : 'nicht erfüllt'}</span></td></tr>
          {s.az ? zeile(`Az zur Zufahrt links (${s.azLinks})`, s.az, `Regelfall ${s.az.A} m, Minimal ${s.az.minimal} m`, true) :
            <tr><td>Az</td><td colSpan={3} className="klein">{s.azGrund}</td></tr>}
        </tbody>
      </table>
      <p className="klein">Tempo auf der Kreiselfahrbahn {s.tempo} km/h ({k.beta.tempoGrund}); Strassentyp: {s.typQuelle}.</p>
      {[...s.auto.hinweise, ...s.velo.hinweise, ...(s.az?.hinweise ?? []), ...s.hinweise].length > 0 && <ul className="klein">
        {[...new Set([...s.auto.hinweise, ...s.velo.hinweise, ...(s.az?.hinweise ?? []), ...s.hinweise])].map(h => <li key={h}>{h}</li>)}
      </ul>}
      <ul className="klein">{s.annahmen.map(h => <li key={h}><span className="warnung">Annahme:</span> {h}</li>)}</ul>
    </section>
  )
}
