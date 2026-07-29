import { useSyncExternalStore } from 'react'

/**
 * Column counts per breakpoint. These MUST stay in step with the breakpoint
 * variables in src/styles/_variables.scss ($bp-sm/md/lg/xl) — the wall is laid
 * out in JS now, so the count can't come from a media query in SCSS.
 * Ordered widest-first so the first match wins.
 */
const BREAKPOINTS: readonly { minWidth: number; columns: number }[] = [
  { minWidth: 1500, columns: 5 },
  { minWidth: 1100, columns: 4 },
  { minWidth: 768, columns: 3 },
  { minWidth: 0, columns: 2 },
]

function getColumnCount(): number {
  const width = window.innerWidth
  return BREAKPOINTS.find((bp) => width >= bp.minWidth)?.columns ?? 2
}

function subscribe(onChange: () => void): () => void {
  const queries = BREAKPOINTS.filter((bp) => bp.minWidth > 0).map((bp) =>
    window.matchMedia(`(min-width: ${bp.minWidth}px)`),
  )
  for (const q of queries) q.addEventListener('change', onChange)
  return () => {
    for (const q of queries) q.removeEventListener('change', onChange)
  }
}

/**
 * How many masonry columns to render at the current viewport width.
 *
 * Listens to matchMedia rather than resize so it only re-renders when the
 * count actually changes — a resize listener would re-run the column
 * distribution on every pixel of a drag.
 */
export function useColumnCount(): number {
  return useSyncExternalStore(subscribe, getColumnCount, () => 2)
}
