import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router'
import type { SourceId } from './types/artwork'
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
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
