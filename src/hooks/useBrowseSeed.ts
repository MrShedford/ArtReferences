import { useSyncExternalStore } from 'react'

/**
 * The seed every browse-mode decision is drawn from — which museum leads the
 * round-robin, which term each one browses, how deep it starts. Rolled once per
 * page load, and again when you tap Home while already on a bare `/` (see
 * AppNav): that tap is the in-app equivalent of reloading the tab, and a new
 * seed is what makes it produce a different wall.
 *
 * Module scope rather than component state, same as useLastBrowseSearch: it has
 * to survive StrictMode's double mount, route changes and back/forward without
 * changing, or the wall would rebuild underneath whoever is looking at it. The
 * writer (AppNav) and the reader (useArtworkSearch, via SearchPage) are also
 * siblings, so there's no shared owner to hang state off.
 *
 * Everything downstream stays deterministic given the seed — see random.ts.
 */
function roll(): number {
  return (Math.random() * 2 ** 32) >>> 0
}

let browseSeed = roll()
const listeners = new Set<() => void>()

export function rollBrowseSeed(): void {
  browseSeed = roll()
  for (const listener of listeners) listener()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot(): number {
  return browseSeed
}

export function useBrowseSeed(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
