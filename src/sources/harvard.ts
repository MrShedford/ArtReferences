import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { PAGE_SIZE, type MuseumSource } from './types'

// Harvard Art Museums requires an API key requested via a manual-approval
// Google Form (not instant self-serve). Their terms restrict use to
// non-commercial purposes, cap it at 2500 requests/day, and forbid caching
// results beyond two weeks — noted in the README. The key is held server-side
// and injected by /api/museum, which is what keeps that named, quota-limited
// key out of the public bundle.

interface HarvardImage {
  baseimageurl?: string
  iiifbaseuri?: string
  width?: number
  height?: number
}

interface HarvardRecord {
  id: number
  title?: string
  people?: { name?: string; role?: string }[]
  dated?: string
  medium?: string
  department?: string
  images?: HarvardImage[]
  primaryimageurl?: string
  creditline?: string
  url?: string
}

interface HarvardSearchResponse {
  records: HarvardRecord[]
}

export const harvardSource: MuseumSource = {
  id: 'harvard',
  label: 'Harvard Art Museums',
  requiresKey: true,

  async search(query, page, signal) {
    const params = new URLSearchParams({
      source: 'harvard',
      q: query || 'painting',
      size: String(PAGE_SIZE),
      page: String(page + 1), // Harvard pages are 1-indexed
      hasimage: '1',
    })
    const url = `/api/museum?${params}`
    const json = await fetchJson<HarvardSearchResponse>('harvard', url, {}, signal)

    return json.records
      .filter((rec) => rec.primaryimageurl || rec.images?.[0]?.baseimageurl)
      .map((rec): Artwork => {
        const image = rec.images?.[0]
        const artist = rec.people?.find((p) => p.role === 'Artist')?.name ?? rec.people?.[0]?.name
        return {
          uid: `harvard:${rec.id}`,
          sourceId: 'harvard',
          sourceLabel: 'Harvard Art Museums',
          title: rec.title || 'Untitled',
          artist,
          date: rec.dated,
          medium: rec.medium,
          department: rec.department,
          thumbUrl: image?.baseimageurl ?? rec.primaryimageurl!,
          fullUrl: rec.primaryimageurl ?? image?.baseimageurl,
          width: image?.width,
          height: image?.height,
          creditLine: rec.creditline,
          objectUrl: rec.url,
        }
      })
  },
}
