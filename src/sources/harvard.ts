import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { PAGE_SIZE, type MuseumSource } from './types'

// Harvard Art Museums requires an API key requested via a manual-approval
// Google Form (not instant self-serve). Their terms also restrict use to
// non-commercial purposes and forbid caching results beyond two weeks —
// noted in the README. isConfigured() gates this source off entirely when
// no key is present, so the app runs fine without one.
function getApiKey(): string | undefined {
  return import.meta.env.VITE_HARVARD_API_KEY as string | undefined
}

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
  isConfigured: () => Boolean(getApiKey()),

  async search(query, page, signal) {
    const apikey = getApiKey()
    if (!apikey) return []

    const params = new URLSearchParams({
      apikey,
      q: query || 'painting',
      size: String(PAGE_SIZE),
      page: String(page + 1), // Harvard pages are 1-indexed
      hasimage: '1',
    })
    const url = `https://api.harvardartmuseums.org/object?${params}`
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
