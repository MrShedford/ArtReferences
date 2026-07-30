import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import type { SourceId } from './types/artwork'
import type { ArtTypeId } from './lib/artTypes'
import { isArtTypeId } from './lib/artTypes'
import { allSources } from './sources'
import { RootLayout } from './routes/RootLayout'
import { SearchPage } from './routes/SearchPage'
import { ListsPage } from './routes/ListsPage'

/**
 * Code-based routes rather than the file-based plugin. Two routes don't
 * justify a codegen step plus a generated routeTree.gen.ts that lands inside
 * tsconfig.app.json's `include: ["src"]` and has to satisfy noUnusedLocals.
 * Type-safety of Link/useSearch is identical either way.
 */

const KNOWN_SOURCE_IDS = new Set<string>(allSources.map((source) => source.id))

export interface SearchParams {
  /** The active query. Absent rather than empty when there isn't one. */
  q?: string
  /**
   * Comma-joined enabled source ids. Absent means "all of them", which keeps
   * the default URL a clean `/` — an empty string means none are enabled,
   * which is a different thing and has to stay distinguishable.
   */
  sources?: string
  /**
   * The active art type (paintings, sculpture…). Absent means "all types",
   * so the default URL stays a clean `/`. Unlike `sources` this isn't
   * persisted — the museums someone picks are a standing preference, but a
   * type filter is what they're looking for right now.
   */
  type?: ArtTypeId
}

/** Hand-rolled, matching api/museum.ts's allowlist discipline. No zod. */
function validateSearchParams(search: Record<string, unknown>): SearchParams {
  const params: SearchParams = {}

  if (typeof search.q === 'string' && search.q.length > 0) {
    params.q = search.q.slice(0, 200)
  }

  if (typeof search.sources === 'string') {
    // Drop ids we don't recognise rather than rejecting the whole URL: a stale
    // bookmark from before a museum was removed should still load.
    params.sources = search.sources
      .split(',')
      .filter((id) => KNOWN_SOURCE_IDS.has(id))
      .join(',')
  }

  // Same discipline as `sources`: drop an unrecognised value rather than
  // rejecting the URL, so a link from before a type was renamed still loads.
  if (typeof search.type === 'string' && isArtTypeId(search.type)) {
    params.type = search.type
  }

  return params
}

/** `sources` param -> the Set the wall and filters actually use. */
export function parseEnabledSources(sources: string | undefined): Set<SourceId> {
  if (sources === undefined) return new Set(allSources.map((source) => source.id))
  if (sources === '') return new Set()
  return new Set(sources.split(',') as SourceId[])
}

const SOURCE_FILTER_STORAGE_KEY = 'museum-references.sources'

export function getSavedSourceSearchParam(): string | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    const value = window.localStorage.getItem(SOURCE_FILTER_STORAGE_KEY)
    return value === null ? undefined : value
  } catch {
    return undefined
  }
}

export function saveSourceSearchParam(value: string | undefined) {
  if (typeof window === 'undefined') return
  try {
    if (value === undefined) {
      window.localStorage.removeItem(SOURCE_FILTER_STORAGE_KEY)
    } else {
      window.localStorage.setItem(SOURCE_FILTER_STORAGE_KEY, value)
    }
  } catch {
    // Ignore storage failures.
  }
}

/** The inverse. Returns undefined when everything is on, so `/` stays clean. */
export function serializeEnabledSources(enabled: Set<SourceId>): string | undefined {
  if (enabled.size === allSources.length) return undefined
  return allSources
    .filter((source) => enabled.has(source.id))
    .map((source) => source.id)
    .join(',')
}

const rootRoute = createRootRoute({
  component: () => (
    <RootLayout>
      <Outlet />
    </RootLayout>
  ),
})

export const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: validateSearchParams,
  component: SearchPage,
})

export const listsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/lists',
  validateSearch: (search: Record<string, unknown>): { list?: number } => {
    const list = Number(search.list)
    return Number.isInteger(list) && list > 0 ? { list } : {}
  },
  component: ListsPage,
})

export const router = createRouter({
  routeTree: rootRoute.addChildren([searchRoute, listsRoute]),
  scrollRestoration: true,
  /**
   * Key the saved scroll offset by URL rather than by history entry.
   *
   * The default is `location.state.__TSR_key`, which is unique per history
   * entry — so browser Back restored the wall's position, but clicking Home in
   * the nav pushed a *new* entry, found nothing cached, and fell through to
   * scrollTo(0). With a nav rail that's the common way back, and landing at the
   * top of a wall you'd scrolled halfway down loses your place.
   *
   * Keying on href means any route to the same URL restores the same offset.
   * It also stays correct when the URL changes for a reason that *should*
   * reset: committing a new query makes it /?q=… , a key with nothing saved
   * against it, so a fresh search still starts at the top.
   */
  getScrollRestorationKey: (location) => location.href,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
