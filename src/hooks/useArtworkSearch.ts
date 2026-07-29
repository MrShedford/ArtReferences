import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { Artwork, SourceId } from '../types/artwork'
import { allSources } from '../sources'

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
 * Fans a query out to every enabled + configured museum source in parallel,
 * via Promise.allSettled so one slow or broken museum can't block the rest.
 * Backed by React Query's infinite query for caching, retry, and dedup of
 * in-flight requests across re-renders.
 */
export function useArtworkSearch(query: string, enabledSourceIds: Set<SourceId>) {
  const activeSources = useMemo(
    () => allSources.filter((s) => s.isConfigured() && enabledSourceIds.has(s.id)),
    [enabledSourceIds],
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
    enabled: activeSources.length > 0,
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
