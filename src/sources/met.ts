import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { pLimit } from '../lib/pLimit'
import { PAGE_SIZE, type MuseumSource } from './types'

interface MetSearchResponse {
  total: number
  objectIDs: number[] | null
}

interface MetObjectResponse {
  objectID: number
  title: string
  artistDisplayName?: string
  objectDate?: string
  medium?: string
  department?: string
  primaryImage?: string
  primaryImageSmall?: string
  creditLine?: string
  isPublicDomain?: boolean
  objectURL?: string
}

const limit = pLimit(6)

export const metSource: MuseumSource = {
  id: 'met',
  label: 'The Metropolitan Museum of Art',

  async search(query, page, signal) {
    // The Met's search endpoint only returns a (potentially huge) list of IDs.
    // Free-text browsing with an empty query works too, since q= still requires
    // a term server-side, so fall back to a broad one.
    const params = new URLSearchParams({
      q: query || 'art',
      hasImages: 'true',
    })
    const url = `https://collectionapi.metmuseum.org/public/collection/v1/search?${params}`
    const searchJson = await fetchJson<MetSearchResponse>('met', url, {}, signal)
    const ids = searchJson.objectIDs ?? []

    const pageIds = ids.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
    if (pageIds.length === 0) return []

    const objects = await Promise.allSettled(
      pageIds.map((id) =>
        limit(() =>
          fetchJson<MetObjectResponse>(
            'met',
            `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
            {},
            signal,
          ),
        ),
      ),
    )

    return objects
      .filter((r): r is PromiseFulfilledResult<MetObjectResponse> => r.status === 'fulfilled')
      .map((r) => r.value)
      // hasImages=true still returns some records with an empty image string.
      .filter((rec) => rec.primaryImageSmall)
      .map(
        (rec): Artwork => ({
          uid: `met:${rec.objectID}`,
          sourceId: 'met',
          sourceLabel: 'The Metropolitan Museum of Art',
          title: rec.title,
          artist: rec.artistDisplayName || undefined,
          date: rec.objectDate,
          medium: rec.medium,
          department: rec.department,
          thumbUrl: rec.primaryImageSmall!,
          fullUrl: rec.primaryImage || rec.primaryImageSmall,
          creditLine: rec.creditLine,
          isPublicDomain: rec.isPublicDomain,
          objectUrl: rec.objectURL,
        }),
      )
  },
}
