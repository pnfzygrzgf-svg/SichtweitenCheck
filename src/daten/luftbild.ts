// ── Luftbild SWISSIMAGE (© swisstopo) als WMS-Bild und Flugjahr, für den Bericht (E4a) ──
//
// WMS GetMap von wms.geo.admin.ch in LV95 (EPSG:2056), JPEG; CORS erlaubt (Access-Control-Allow-Origin: *).
// Flugjahr (Datenstand) je 1-km-Kachel aus den Metadaten (api3.geo.admin.ch identify, Layer
// ch.swisstopo.images-swissimage-dop10.metadata). Hinaus gehen nur der Kartenausschnitt bzw. die Kachel-Box.
// Die Streifen-Erkennung des fgsCheck ist in E0 entfernt; geladen werden Bild und Flugjahr nur beim Öffnen des Berichts.

import { holeJson } from './holen'

export const LUFTBILD_QUELLE = '© swisstopo, SWISSIMAGE'

/** WMS GetMap SWISSIMAGE in LV95 für einen beliebigen Ausschnitt (auch Kartenbild im Bericht) */
export function wmsBildUrl(box: [number, number, number, number], breitePx: number, hoehePx: number): string {
  const b = box.map(v => v.toFixed(1)).join(',')
  return 'https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ch.swisstopo.swissimage&STYLES=' +
    `&CRS=EPSG:2056&BBOX=${b}&WIDTH=${breitePx}&HEIGHT=${hoehePx}&FORMAT=image/jpeg`
}

export function flugjahrUrl(e: number, n: number): string {
  const e0 = Math.floor(e / 1000) * 1000 + 500, n0 = Math.floor(n / 1000) * 1000 + 500
  const g = `${e0},${n0},${e0 + 1},${n0 + 1}`
  return `https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometry=${g}&geometryType=esriGeometryEnvelope` +
    `&layers=all:ch.swisstopo.images-swissimage-dop10.metadata&mapExtent=${g}&imageDisplay=10,10,96&tolerance=0&sr=2056` +
    '&returnGeometry=false&lang=de&limit=1'
}

/** Flugjahr der Kachel (leer, wenn nicht verfügbar) */
export async function ladeFlugjahr(e: number, n: number, signal?: AbortSignal): Promise<string> {
  try {
    const r = await holeJson<{ results?: { attributes?: { datenstand?: string } }[] }>(flugjahrUrl(e, n), {}, 15000, signal)
    return String(r.daten.results?.[0]?.attributes?.datenstand ?? '')
  } catch { return '' }
}
