// ── Bericht am Kreisel (K4): Druckansicht mit Skizze (SVG in LV95, ohne Luftbild), Masse, Ablenkungswinkel, Sicht aus der gewählten
//    Einfahrt (Ak, Velo, Sichtberme, Az als Vergleichswert), Annahmen, Hinweise und Quellen. Gleicher Druckrahmen wie Bericht.tsx; der
//    vollständige Bericht mit Luftbild, Regeln und Begriffen folgt in K6. ──

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Fall } from './fall'
import { BEZEICHNUNG_MAX } from './fall'
import type { KnotenInfo, KreiselSichtTeil } from './rechner/typen'
import { armText, nachNr } from './rechner/knoten'
import { profilLinie, KREISEL_TYP_TEXT } from './rechner/kreisel'
import { AZ_QUELLE } from './rechner/kreiselsicht'
import { hindernisRing } from './rechner/hindernisse'
import { wgs, type P } from './geo'
import { STATUS_FARBE, FREI_FARBE, VERDECKT_FARBE, VELO_FARBE, D_FARBE, D_RAND_FARBE, ZUFAHRT_FARBE, FB_FARBE, FA_FARBE } from './Karte'
import { autoUmriss, autoScheibe, fbLage, faLage, veloLage, veloTeile, kreiselFahrzeug } from './rechner/fahrzeug'
import { f1, f2, statusMarke, STATUS_TEXT } from './texte'
import { kreiselStatusText, nochText } from './KreiselBlock'
import type { QuellenStand } from './berichtbild'
import { MARKE, APP_ADRESSE } from './marke'

const datum = (d: Date) => d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
const datumIso = (s: string | undefined) => (s ? datum(new Date(s)) : '–')
const tausender = (x: number) => x.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, '’').replace('.', ',')
/** Skizze: halbe Seite des Ausschnitts um die Kreiselmitte [m] */
const SKIZZE_M = 45

/** Skizze des Kreisels in LV95 (Norden oben, Massstabsbalken 10 m) */
function Skizze({ kn, fall }: { kn: KnotenInfo; fall: Fall }) {
  const k = kn.kreisel!, v = k.vermessung, s = k.sicht!, z = k.zufahrt!
  const m = v.mitte
  // Fahrzeuge wie auf der Karte: F_B bei D, F_A am Ende von Ak, Velo am Ende seiner Linie, Fahrzeug in der Zufahrt links am Ende von Az
  const fahrzeuge: { lage: [P, P]; farbe: string; rand: string; velo: boolean }[] = []
  const fb = fbLage(z.Dachse, z.rand)
  fahrzeuge.push({ lage: fb, farbe: FB_FARBE, rand: '#ffffff', velo: false })
  for (const [t, velo] of [[s.auto, false], [s.velo, true], ...(s.az ? [[s.az, false]] : [])] as [KreiselSichtTeil, boolean][]) {
    const l = kreiselFahrzeug(t.achse, t.A, velo ? veloLage : faLage)
    if (l) fahrzeuge.push({ lage: l, farbe: velo ? VELO_FARBE : FA_FARBE, rand: '#111827', velo })
  }
  const xy = (p: P) => `${(p[0] - m[0] + SKIZZE_M).toFixed(2)},${(SKIZZE_M - (p[1] - m[1])).toFixed(2)}`
  const pfad = (pts: P[], zu = false) => (pts.length ? `M${pts.map(xy).join('L')}${zu ? 'Z' : ''}` : '')
  const linie = (pts: P[]) => pts.map(xy).join(' ')
  const teil = (t: KreiselSichtTeil, farbe: string) => <>
    {t.dreieckFrei.length > 2 && <path d={pfad(t.dreieckFrei, true)} fill={farbe} fillOpacity={0.18} stroke="none" />}
    {t.dreieckVerdeckt.length > 2 && <path d={pfad(t.dreieckVerdeckt, true)} fill={VERDECKT_FARBE} fillOpacity={0.2} stroke="none" />}
  </>
  return (
    <svg className="bericht-bild" viewBox={`0 0 ${2 * SKIZZE_M} ${2 * SKIZZE_M}`} role="img" aria-label="Skizze des Kreisels">
      <defs>
        <pattern id="berme" patternUnits="userSpaceOnUse" width="1.2" height="1.2" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="1.2" stroke="#b45309" strokeWidth="0.35" />
        </pattern>
      </defs>
      <rect x="0" y="0" width={2 * SKIZZE_M} height={2 * SKIZZE_M} fill="#f8fafc" />
      {nachNr(k.arme).map(a => a.linien.map((l, i) => <polyline key={`${a.key}${i}`} points={linie(l)} fill="none" stroke="#94a3b8" strokeWidth={0.8} />))}
      <path d={pfad(profilLinie(m, v.aussen), true)} fill="#e2e8f0" stroke="#334155" strokeWidth={0.3} />
      {v.inselR > 0 && <path d={pfad(profilLinie(m, v.insel), true)} fill="#86efac" stroke="#15803d" strokeWidth={0.2} />}
      {s.durchsicht.map((r, i) => <path key={i} d={pfad(r, true)} fill="#15803d" fillOpacity={0.45} stroke="none" />)}
      {s.berme.flaechen.map((r, i) => <path key={i} d={pfad(r, true)} fill="url(#berme)" stroke="#b45309" strokeWidth={0.2} />)}
      {teil(s.velo, VELO_FARBE)}
      {teil(s.auto, FREI_FARBE)}
      {fall.hindernisse.map(h => { const r = hindernisRing(h); return r.length ? <path key={h.id} d={pfad(r, true)} fill="#7c3aed" fillOpacity={0.4} stroke="#7c3aed" strokeWidth={0.2} /> : null })}
      <polyline points={linie(profilLinie(m, v.fahrlinie))} fill="none" stroke="#0284c7" strokeWidth={0.2} strokeDasharray="0.6 0.8" />
      <polyline points={linie(z.vortrittLinie)} fill="none" stroke="#0284c7" strokeWidth={0.5} />
      {s.az && <polyline points={linie(s.az.achse)} fill="none" stroke={STATUS_FARBE[s.az.status]} strokeWidth={0.4} strokeDasharray="1.5 0.8" />}
      <polyline points={linie(z.achse)} fill="none" stroke={ZUFAHRT_FARBE} strokeWidth={0.5} />
      {fahrzeuge.map((f, i) => f.velo ? <g key={i}>{veloTeile(f.lage[0], f.lage[1]).map((t, j) => <path key={j} d={pfad(t, true)} fill={f.farbe}
        stroke="#ffffff" strokeWidth={0.05} />)}</g> : <g key={i}><path d={pfad(autoUmriss(f.lage[0], f.lage[1]), true)} fill={f.farbe} stroke={f.rand}
          strokeWidth={0.15} /><path d={pfad(autoScheibe(f.lage[0], f.lage[1]), true)} fill="#94a3b8" stroke="none" /></g>)}
      <circle cx={xy(z.K).split(',')[0]} cy={xy(z.K).split(',')[1]} r={0.6} fill="#0284c7" stroke={D_RAND_FARBE} strokeWidth={0.15} />
      <circle cx={xy(s.D).split(',')[0]} cy={xy(s.D).split(',')[1]} r={0.8} fill={D_FARBE} stroke={D_RAND_FARBE} strokeWidth={0.25} />
      {nachNr(k.arme).map(a => { const p: P = [m[0] + a.richtung[0] * (v.aussenR + 9), m[1] + a.richtung[1] * (v.aussenR + 9)]
        const [x, y] = xy(p).split(',').map(Number)
        return <g key={a.key}><circle cx={x} cy={y} r={1.6} fill={a.key === s.arm ? '#15803d' : '#ffffff'} stroke="#111827" strokeWidth={0.2} />
          <text x={x} y={y + 0.6} fontSize={1.8} textAnchor="middle" fill={a.key === s.arm ? '#ffffff' : '#111827'}>{a.nr}</text></g> })}
      <g transform={`translate(3,${2 * SKIZZE_M - 3})`}><rect x="0" y="-0.6" width="10" height="0.6" fill="#111827" />
        <text x="0" y="-1.2" fontSize={1.6}>0</text><text x="10" y="-1.2" fontSize={1.6} textAnchor="middle">10 m</text></g>
      <text x={2 * SKIZZE_M - 3} y={5} fontSize={2.4} textAnchor="middle">N</text>
      <path d={`M${2 * SKIZZE_M - 3},6 l-1,3 l1,-0.8 l1,0.8 Z`} fill="#111827" />
    </svg>
  )
}

export default function KreiselBericht({ fall, kn, kantone, quellen, aendern, schliessen }: { fall: Fall; kn: KnotenInfo; kantone: string[]
  quellen: Record<string, QuellenStand>; aendern: (f: (x: Fall) => Fall) => void; schliessen: () => void }) {
  const k = kn.kreisel!, v = k.vermessung, s = k.sicht!, z = k.zufahrt!
  const arm = k.arme.find(a => a.key === s.arm)!
  const [lat, lon] = wgs(kn.p[0], kn.p[1])
  const heute = new Date()
  const [bez, setBez] = useState(fall.ort.bezeichnung ?? '')
  const bezUebernehmen = () => {
    const t = bez.slice(0, BEZEICHNUNG_MAX)
    if (t.trim() === (fall.ort.bezeichnung ?? '').trim()) return
    aendern(f => { if (t.trim()) f.ort.bezeichnung = t; else delete f.ort.bezeichnung; return f })
  }
  const titelTeil = (fall.ort.bezeichnung?.trim() || kn.name || String(kn.id)).replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, '_').slice(0, 60)
  useEffect(() => {
    const alt = document.title
    const d = new Date(), zz = (x: number) => String(x).padStart(2, '0')
    document.title = `SichtweitenCheck_Bericht_${titelTeil}_${d.getFullYear()}-${zz(d.getMonth() + 1)}-${zz(d.getDate())}`
    return () => { document.title = alt }
  }, [titelTeil])
  useEffect(() => {
    document.body.classList.add('bericht-offen')
    return () => document.body.classList.remove('bericht-offen')
  }, [])
  useEffect(() => {
    const esc = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && !(ev.target instanceof HTMLInputElement)) schliessen() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [schliessen])
  const abruf = (q: string) => (quellen[q]?.zeit ? `, abgerufen ${datumIso(quellen[q].zeit)}` : '')
  const nr = (key: string) => k.arme.find(a => a.key === key)?.nr ?? '?'
  const zeile = (name: string, t: KreiselSichtTeil, noetig: string, az = false) => <tr key={name}><td>{name}</td><td>{noetig}</td>
    <td>{f1(t.vorhanden)} m{t.bisEnde ? ' (Linie frei)' : t.verdecker ? `, verdeckt durch ${t.verdecker.name}` : ''}</td>
    <td><b>{statusMarke(t.status)} {kreiselStatusText(t, az)}</b></td></tr>
  const eingaben = [
    ...(k.typGewaehlt ? [`Typ von Hand: ${KREISEL_TYP_TEXT[k.typ]}`] : []),
    ...Object.entries(fall.eingaben.kreiselBeziehungen ?? {}).map(([key, an]) => { const [a, b] = key.split('>')
      return `Fahrbeziehung ${nr(a)} → ${nr(b)} von Hand ${an ? 'angewählt' : 'abgewählt'}` }),
    ...(fall.hindernisse.length ? [`${fall.hindernisse.length} Hindernisse von Hand bzw. bestätigt`] : []),
  ]
  const hinweise = [...new Set([...k.hinweise, ...s.auto.hinweise, ...s.velo.hinweise, ...(s.az?.hinweise ?? []), ...s.hinweise])]

  return createPortal(
    <div className="bericht" role="dialog" aria-label="Bericht">
      <div className="bericht-leiste nicht-drucken">
        <button onClick={() => window.print()}>Drucken / als PDF speichern</button>
        <button className="zweit" onClick={schliessen}>Zurück zur Karte</button>
      </div>
      <article className="bericht-seite">
        <table className="bericht-rahmen">
        <thead><tr><td><div className="bericht-rand-oben" /></td></tr></thead>
        <tfoot><tr><td><div className="bericht-rand-unten" /></td></tr></tfoot>
        <tbody><tr><td>
        <header>
          <h1><img className="logo" src={import.meta.env.BASE_URL + 'logo.svg'} alt="" width={36} height={36} />SichtweitenCheck
            {' '}<span className="bericht-marke">{MARKE}</span></h1>
          <p className="klein">Sicht am Kreisel nach VSS 40 263 und VSS 40 273 · Bericht vom {datum(heute)}</p>
        </header>
        <section className="bericht-block">
          <h2>Ort und Einfahrt</h2>
          <table className="bericht-zahlen"><tbody>
            <tr><td>Bezeichnung</td><td>
              <input className="nicht-drucken bericht-eingabe" type="text" maxLength={BEZEICHNUNG_MAX} value={bez}
                placeholder="z. B. Adresse, Projekt (erscheint im Bericht und in der Fall-Datei)"
                onChange={ev => setBez(ev.target.value)} onBlur={bezUebernehmen}
                onKeyDown={ev => { if (ev.key === 'Enter') ev.currentTarget.blur(); else if (ev.key === 'Escape') bezUebernehmen() }} />
              <span className="nur-drucken">{bez.trim() ? bez : '–'}</span></td></tr>
            <tr><td>Kreisel</td><td>{kn.name} (kleinster Ringpunkt OSM {kn.id})</td></tr>
            <tr><td>Koordinaten der Mitte</td><td>LV95 E {tausender(kn.p[0])}, N {tausender(kn.p[1])} · WGS84 {lat.toFixed(6)}, {lon.toFixed(6)}</td></tr>
            <tr><td>Arme</td><td>{nachNr(k.arme).map(armText).join(', ')}<div className="klein">Nummern im Uhrzeigersinn ab Norden</div></td></tr>
            <tr><td>Einfahrt</td><td>{armText(arm)}<div className="klein">Fahrlinie: {z.lageQuelle}</div></td></tr>
            <tr><td>Beobachtung</td><td>B {f2(z.B)} m hinter dem Rand der Kreiselfahrbahn (Wartelinie), D am Fahrersitz</td></tr>
            <tr><td>Daten geladen</td><td>{datumIso(fall.quellen.geladen)}</td></tr>
          </tbody></table>
        </section>
        <section className="bericht-block">
          <Skizze kn={kn} fall={fall} />
          <p className="klein">Skizze (Norden oben): Aussenrand grau, Insel grün, Sichtberme schraffiert (freihalten), dunkelgrün «Durchsicht
            verhindern», Sichtfeld Ak grün bzw. rot (verdeckt), Fahrlinie mit Vortritt blau, Az gestrichelt, Einfahrt orange, D weiss; Fahrzeuge:
            wartend dunkel bei D, mit Vortritt hell am Ende von Ak bzw. Az, Velo am Ende seiner Linie.</p>
        </section>
        </td></tr>
        <tr className="bericht-neue-seite"><td>
        <section className="bericht-block">
          <h2>Ergebnis</h2>
          <p><b>{statusMarke(s.gesamt)} {STATUS_TEXT[s.gesamt]}</b> (schlechtester von Ak, Velo und Sichtberme; Az ist ein Vergleichswert und
            zählt nicht dazu)</p>
          <table className="bericht-zahlen">
            <thead><tr><th>Teil</th><th>nötig</th><th>vorhanden</th><th>Status</th></tr></thead>
            <tbody>
              {zeile('Motorfahrzeuge (Ak, VSS 40 263 Ziffer 13.2, S. 8–9)', s.auto, nochText(s.auto, `${f1(s.auto.A)} m, oberer Wert ${f1(s.auto.oben)} m`) +
                ` (${s.auto.text})`)}
              {zeile('Velo (VSS 40 273 Tab. 3)', s.velo, nochText(s.velo, `${f1(s.velo.A)} m`))}
              <tr><td>Sichtberme (VSS 40 263 Ziffer 13.3, S. 9)</td><td>{s.berme.flaechen.length ? (s.berme.ganz ? 'ganze Insel' :
                `bis ${f1(s.berme.tiefe)} m ab dem Inselrand`) + (s.berme.innenring ? ', mit Innenring' : '') : 'keine Insel im Sichtfeld'}</td>
                <td>{s.berme.hindernisse.length ? s.berme.hindernisse.join(', ') : 'frei'}</td>
                <td><b>{statusMarke(s.berme.status)} {s.berme.status === 'erfuellt' ? 'frei' : 'nicht erfüllt'}</b></td></tr>
              {s.az ? zeile(`Az zur Zufahrt links (${s.azLinks}), Vergleichswert`, s.az, `Regelfall ${s.az.A} m, Minimal ${s.az.minimal} m`, true) :
                <tr><td>Az</td><td colSpan={3}>{s.azGrund}</td></tr>}
            </tbody>
          </table>
          <p className="klein">Tempo auf der Kreiselfahrbahn {s.tempo} km/h: {k.beta.tempoGrund}. Strassentyp: {s.typQuelle}. Az: {AZ_QUELLE}.</p>
        </section>
        <section className="bericht-block">
          <h2>Kreisel</h2>
          <table className="bericht-zahlen"><tbody>
            <tr><td>Typ</td><td>{KREISEL_TYP_TEXT[k.typ]}{k.typGewaehlt ? ' (von Hand)' : ''}</td></tr>
            <tr><td>Aussendurchmesser</td><td>{f1(v.durchmesser)} m im Mittel ({f1(v.dMin)} bis {f1(v.dMax)} m){v.quelle === 'osm' ? ', aus OSM geschätzt' : ', AV'}</td></tr>
            <tr><td>Kreiselfahrbahn</td><td>{f1(v.breite)} m breit im Mittel</td></tr>
            <tr><td>Mittelinsel</td><td>{v.inselR > 0 ? `Durchmesser ${f1(2 * v.inselR)} m im Mittel` : 'keine'}</td></tr>
            <tr><td>Innenring (Vorschlag)</td><td>{v.innenringR !== null ? `Durchmesser ${f1(2 * v.innenringR)} m` : 'keiner'}</td></tr>
          </tbody></table>
          <h3>Ablenkungswinkel β (VSS 40 263 Ziffer 17, S. 12)</h3>
          <table className="bericht-zahlen"><tbody>
            {k.beta.beziehungen.filter(x => x.aktiv).map(x => <tr key={x.key}><td>{nr(x.von)} → {nr(x.nach)}{x.key === k.beta.massgebend ? ' (massgebend)' : ''}</td>
              <td>{x.gueltig ? `${f1(x.betaGon!)} gon (${f1(x.betaGrad!)}°), Fall ${x.fall}` : x.grund}</td></tr>)}
            {!k.beta.beziehungen.some(x => x.aktiv) && <tr><td colSpan={2}>keine Fahrbeziehung</td></tr>}
          </tbody></table>
        </section>
        <section className="bericht-block">
          <h2>Eingaben von Hand</h2>
          {eingaben.length ? <ul className="klein">{eingaben.map(x => <li key={x}>{x}</li>)}</ul> : <p className="klein">Keine.</p>}
          <h3>Annahmen</h3>
          <ul className="klein">{[...k.annahmen, ...s.annahmen].map(x => <li key={x}>{x}</li>)}</ul>
        </section>
        {hinweise.length > 0 && <section className="bericht-block">
          <h2>Hinweise</h2>
          <ul className="klein">{hinweise.map(x => <li key={x}>{x}</li>)}</ul>
        </section>}
        <section className="bericht-block">
          <h2>Quellen</h2>
          <ul className="klein">
            <li>Bodenbedeckung (Fahrbahn, Insel, Gebäude): {fall.quellen.av ?? `Amtliche Vermessung, Kanton ${kantone.join(', ') || '–'}, geodienste.ch`}{abruf('av')}</li>
            <li>Kreisel, Arme, Velobypässe, Tram: © OpenStreetMap-Mitwirkende, ODbL{fall.quellen.osm ? ` (${fall.quellen.osm})` : ''}{abruf('osm')}</li>
            {fall.quellen.parkkataster && <li>Parkfelder: {fall.quellen.parkkataster}{abruf('parkkataster')}</li>}
            {fall.quellen.baumkataster && <li>Bäume: {fall.quellen.baumkataster}{abruf('baumkataster')}</li>}
            <li>Normen: VSS 40 263 (Kreisel), VSS 40 273 (Sichtverhältnisse); nur Fundstellen und Zahlenwerte, der Text ist im Original nachzulesen.</li>
          </ul>
        </section>
        <footer className="bericht-fuss">
          <p><b>Die App ersetzt keine Beurteilung vor Ort.</b> Daten aus offenen Quellen können veraltet oder unvollständig sein; die Höhe der
            Hindernisse und ob die Insel die Durchsicht verhindert, prüft die App nicht.</p>
          <p>SichtweitenCheck v{__APP_VERSION__} ({MARKE}, Stand {__BUILD_DATUM__}) · {APP_ADRESSE} · Code unter MIT, eigene Inhalte unter CC BY 4.0 ·
            eingebundene Daten unter ihren eigenen Lizenzen (siehe Quellen).</p>
        </footer>
        </td></tr></tbody>
        </table>
      </article>
    </div>,
    document.body,
  )
}
