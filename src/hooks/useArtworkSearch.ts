import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Artwork, SourceId } from '../types/artwork'
import { allSources, isSourceAvailable } from '../sources'

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
) {
  const activeSources = useMemo(
    () =>
      allSources.filter(
        (s) => isSourceAvailable(s, configuredSourceIds) && enabledSourceIds.has(s.id),
      ),
    [enabledSourceIds, configuredSourceIds],
  )

  const infiniteQuery = useInfiniteQuery<ArtworkPage>({
    queryKey: ['artworks', query, activeSources.map((s) => s.id).sort().join(',')],
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const page = pageParam as number
      const results = await Promise.allSettled(
        activeSources.map((s) => s.search(query, page, signal)),
      )

      const statuses: Partial<Record<SourceId, SourceStatus>> = {}
      const bySource: Artwork[][] = []

      results.forEach((result, idx) => {
        const source = activeSources[idx]
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
