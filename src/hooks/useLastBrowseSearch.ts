import { useSyncExternalStore } from 'react'
import type { SearchParams } from '../router'

/**
 * The browse route's last search params, so the nav's Home icon can point back
 * at the URL you actually left rather than a bare `/`.
 *
 * It has to be remembered rather than read from the current location: /lists
 * has its own search schema and carries nothing of the wall's query, so by the
 * time you're looking at your lists the only record of `?q=vermeer&type=…` is
 * the history entry you've already navigated off.
 *
 * Same useSyncExternalStore shape as useColumnCount — the value lives outside
 * React because the writer (SearchPage) and the reader (AppNav) are siblings,
 * and threading it through the router's context for one string would be a lot
 * of plumbing for a breadcrumb.
 */
let lastBrowseSearch: SearchParams = {}
const listeners = new Set<() => void>()

function isSameSearch(a: SearchParams, b: SearchParams): boolean {
  return a.q === b.q && a.sources === b.sources && a.type === b.type
}

export function setLastBrowseSearch(next: SearchParams): void {
  // Compared rather than assigned outright: getSnapshot has to return a stable
  // reference between real changes or useSyncExternalStore re-renders forever.
  if (isSameSearch(lastBrowseSearch, next)) return
  lastBrowseSearch = next
  for (const listener of listeners) listener()
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function getSnapshot(): SearchParams {
  return lastBrowseSearch
}

export function useLastBrowseSearch(): SearchParams {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
