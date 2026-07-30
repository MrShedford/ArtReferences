import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Artwork, SourceId } from '../types/artwork'
import type { MuseumSource } from '../sources'
import { allSources, isSourceAvailable } from '../sources'
import type { ArtTypeId } from '../lib/artTypes'
import { createSeededRng, seededIndex, shuffleWithRng } from '../lib/random'
import { useBrowseSeed } from './useBrowseSeed'
import { getBrowseSubject, getBrowseTerm } from '../lib/browseTerms'

export interface SourceStatus {
  status: 'success' | 'error'
  count: number
  error?: string
}

interface ArtworkPage {
  artworks: Artwork[]
  statuses: Partial<Record<SourceId, SourceStatus>>
}

/**
 * Round-robin merge so the wall shows a mix of museums as soon as results
 * land, rather than 24 Met pieces before a single AIC one.
 */
function interleave(bySource: Artwork[][]): Artwork[] {
  const merged: Artwork[] = []
  let i = 0
  let more = true
  while (more) {
    more = false
    for (const arr of bySource) {
      if (i < arr.length) {
        merged.push(arr[i])
        more = true
      }
    }
    i++
  }
  return merged
}

/**
 * How many pages deep a browse session may start each museum. Broad browse
 * terms return thousands of results from every one of these collections, so a
 * few pages of jitter is free variety; anything a source can't reach falls back
 * to page 0 (see fetchSourcePage).
 */
const MAX_BROWSE_PAGE_OFFSET = 8

/**
 * One page from one museum. Browse mode starts each source at its own depth so
 * the wall isn't the same top-24 on every visit — but a narrow collection can
 * run out before that depth, and an empty array there would silently drop the
 * museum from the wall (and on page 0, via getNextPageParam, could end the
 * infinite scroll before it began). Falling back to the unoffset page costs an
 * extra request only in the case where the offset actually overshot.
 */
async function fetchSourcePage(
  source: MuseumSource,
  query: string,
  page: number,
  offset: number,
  signal: AbortSignal,
  type: ArtTypeId | undefined,
): Promise<Artwork[]> {
  if (offset === 0) return source.search(query, page, signal, type)
  const offsetResults = await source.search(query, page + offset, signal, type)
  if (offsetResults.length > 0) return offsetResults
  return source.search(query, page, signal, type)
}

/**
 * Fans a query out to every enabled + available museum source in parallel,
 * via Promise.allSettled so one slow or broken museum can't block the rest.
 * Backed by React Query's infinite query for caching, retry, and dedup of
 * in-flight requests across re-renders.
 *
 * `configuredSourceIds` comes from /api/config — see useConfiguredSources.
 */
export function useArtworkSearch(
  query: string,
  enabledSourceIds: Set<SourceId>,
  configuredSourceIds: Set<SourceId>,
  isConfigPending = false,
  type?: ArtTypeId,
) {
  const activeSources = useMemo(
    () =>
      allSources.filter(
        (s) => isSourceAvailable(s, configuredSourceIds) && enabledSourceIds.has(s.id),
      ),
    [enabledSourceIds, configuredSourceIds],
  )

  // Browse mode is the landing page with nothing typed. A typed search stays
  // fully deterministic and relevance-ordered — jittering it would bury the best
  // matches for "vermeer" under whatever page 6 happens to hold.
  const isBrowse = query.trim() === ''

  // Seeded from the session's browse seed, which only changes on a page load or
  // a Home tap from home — so scrolling, route changes and StrictMode's double
  // mount all keep the current wall. Inert (0) outside browse mode.
  const sessionSeed = useBrowseSeed()
  const browseSeed = isBrowse ? sessionSeed : 0

  // Round-robin always led with whichever museum sits first in allSources, so
  // the top-left card came from the same place every visit. Shuffling the arms
  // — not the results inside them — varies who leads while each museum keeps
  // its own ranking.
  const orderedSources = useMemo(
    () => (isBrowse ? shuffleWithRng(activeSources, createSeededRng(browseSeed)) : activeSources),
    [activeSources, isBrowse, browseSeed],
  )

  const infiniteQuery = useInfiniteQuery<ArtworkPage>({
    // browseSeed belongs in the key: without it React Query would serve the
    // previous visit's cached pages and none of the above would be observable.
    // type belongs in the key for the same reason browseSeed does: without it
    // switching type would serve the previous type's cached pages.
    queryKey: [
      'artworks',
      query,
      activeSources.map((s) => s.id).sort().join(','),
      browseSeed,
      type ?? '',
    ],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const page = pageParam as number
      const results = await Promise.allSettled(
        orderedSources.map((source) =>
          fetchSourcePage(
            source,
            // With a type filter on, browse draws from the subject-only pool:
            // the default pool contains medium words like 'sculpture', which
            // would fight the filter and empty the wall.
            isBrowse
              ? type
                ? getBrowseSubject(source.id, browseSeed)
                : getBrowseTerm(source.id, browseSeed)
              : query,
            page,
            isBrowse ? seededIndex(`page:${source.id}`, browseSeed, MAX_BROWSE_PAGE_OFFSET) : 0,
            signal,
            type,
          ),
        ),
      )

      const statuses: Partial<Record<SourceId, SourceStatus>> = {}
      const bySource: Artwork[][] = []

      results.forEach((result, idx) => {
        const source = orderedSources[idx]
        if (result.status === 'fulfilled') {
          statuses[source.id] = { status: 'success', count: result.value.length }
          bySource.push(result.value)
        } else {
          const message =
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          statuses[source.id] = { status: 'error', count: 0, error: message }
          bySource.push([])
        }
      })

      return { artworks: interleave(bySource), statuses }
    },
    getNextPageParam: (lastPage, allPages) => {
      // Sources don't expose a uniform "hasMore"/total we can trust across
      // seven very different APIs — stop once a fetched page comes back
      // completely empty rather than tracking per-source totals.
      if (lastPage.artworks.length === 0) return undefined
      return allPages.length
    },
    // Wait for /api/config: activeSources feeds the queryKey, so starting
    // before it resolves fetches page 0 with the keyless sources only, then
    // throws that away and refetches under a new key — a visible full-wall
    // rebuild a second into the session.
    enabled: !isConfigPending && activeSources.length > 0,
    staleTime: 5 * 60 * 1000,
  })

  const artworks = useMemo(() => {
    const seen = new Set<string>()
    const merged: Artwork[] = []
    for (const page of infiniteQuery.data?.pages ?? []) {
      for (const artwork of page.artworks) {
        if (!seen.has(artwork.uid)) {
          seen.add(artwork.uid)
          merged.push(artwork)
        }
      }
    }
    return merged
  }, [infiniteQuery.data])

  const sourceStatuses = useMemo(() => {
    const merged: Partial<Record<SourceId, SourceStatus>> = {}
    for (const page of infiniteQuery.data?.pages ?? []) {
      for (const [id, status] of Object.entries(page.statuses) as [SourceId, SourceStatus][]) {
        const prev = merged[id]
        merged[id] = {
          status: status.status,
          count: (prev?.count ?? 0) + status.count,
          error: status.error ?? prev?.error,
        }
      }
    }
    return merged
  }, [infiniteQuery.data])

  return {
    artworks,
    sourceStatuses,
    activeSources,
    isLoading: infiniteQuery.isLoading,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    fetchNextPage: infiniteQuery.fetchNextPage,
    isError: infiniteQuery.isError,
  }
}
