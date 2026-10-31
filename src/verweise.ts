// ── Sprünge im Panel (Korrektur 31.10.2026, Muster fgsCheck Verweise.tsx hilfeZeigen): übergeordnete Aufklapper öffnen, zeigen und kurz
// hervorheben; Sprung aus der Quellentabelle in die Regelübersicht als Ereignis «swc-regel» ──

import type { WerkId } from './regeln'

export const REGEL_EREIGNIS = 'swc-regel'

/** Ziel im Panel zeigen; false, wenn es den Anker nicht gibt (Bericht, Test) */
export function hilfeZeigen(anker: string): boolean {
  if (typeof document === 'undefined') return false
  const el = document.getElementById(anker)
  if (!el) return false
  for (let d: HTMLElement | null = el; d; d = d.parentElement) if (d instanceof HTMLDetailsElement) d.open = true
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  el.classList.add('hervor')
  window.setTimeout(() => el.classList.remove('hervor'), 1600)
  return true
}

/** Regelübersicht nach Quelle öffnen und zum Werk springen */
export function regelnWerkZeigen(w: WerkId): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(REGEL_EREIGNIS, { detail: { werk: w } }))
}
