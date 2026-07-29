import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { PAGE_SIZE, type MuseumSource } from './types'

// Smithsonian Open Access uses a free, instant api.data.gov key (unlike
// Harvard's manual-approval form). The key is held server-side and injected
// by /api/museum — see api/_shared/sources.ts.

interface SmithsonianMediaVariant {
  label?: string
  url?: string
}

interface SmithsonianMediaResource {
  type: string
  content?: string
  thumbnail?: string
  resources?: SmithsonianMediaVariant[]
}

interface SmithsonianFreetextItem {
  label: string
  content: string
}

interface SmithsonianDescriptiveNonRepeating {
  online_media?: { media?: SmithsonianMediaResource[] }
  record_link?: string
}

interface SmithsonianRow {
  id: string
  title?: string
  content: {
    descriptiveNonRepeating?: SmithsonianDescriptiveNonRepeating
    freetext?: {
      name?: SmithsonianFreetextItem[]
      date?: SmithsonianFreetextItem[]
      physicalDescription?: SmithsonianFreetextItem[]
      creditLine?: SmithsonianFreetextItem[]
    }
    indexedStructured?: {
      date?: string[]
      object_type?: string[]
    }
  }
}

interface SmithsonianSearchResponse {
  response: { rows: SmithsonianRow[] }
}

export const smithsonianSource: MuseumSource = {
  id: 'smithsonian',
  label: 'Smithsonian Institution',
  requiresKey: true,

  async search(query, page, signal) {
    // Verified live (with api.data.gov's DEMO_KEY): even with the
    // online_media_type:Images filter, most matching rows still lack actual
    // media (many Smithsonian records are library/archival text, not
    // objects). Over-fetch and filter client-side, then trim to PAGE_SIZE.
    const requestRows = PAGE_SIZE * 3
    const params = new URLSearchParams({
      source: 'smithsonian',
      q: `${query || 'painting'} AND online_media_type:Images`,
      rows: String(requestRows),
      start: String(page * requestRows),
    })
    const url = `/api/museum?${params}`
    const json = await fetchJson<SmithsonianSearchResponse>('smithsonian', url, {}, signal)

    return json.response.rows
      .map((row): Artwork | null => {
        const media = row.content.descriptiveNonRepeating?.online_media?.media?.find(
          (m) => m.type === 'Images',
        )
        if (!media?.content) return null

        const highRes = media.resources?.find((r) => r.label?.includes('JPEG'))?.url
        const freetext = row.content.freetext
        return {
          uid: `smithsonian:${row.id}`,
          sourceId: 'smithsonian',
          sourceLabel: 'Smithsonian Institution',
          title: row.title || 'Untitled',
          artist: freetext?.name?.[0]?.content,
          date: freetext?.date?.[0]?.content ?? row.content.indexedStructured?.date?.[0],
          medium: freetext?.physicalDescription?.[0]?.content,
          department: row.content.indexedStructured?.object_type?.[0],
          thumbUrl: media.content,
          fullUrl: highRes ?? media.content,
          creditLine: freetext?.creditLine?.[0]?.content,
          objectUrl: row.content.descriptiveNonRepeating?.record_link,
        }
      })
      .filter((a): a is Artwork => a !== null)
      .slice(0, PAGE_SIZE)
  },
}
