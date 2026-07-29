import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { PAGE_SIZE, type MuseumSource } from './types'

// Europeana aggregates ~4000 European institutions with wildly inconsistent
// metadata quality. `dcCreator` is frequently a bare VIAF/agent URI rather
// than a readable name — extractArtist() below is a best-effort heuristic,
// not a guarantee; many results will legitimately show no artist.
function getApiKey(): string | undefined {
  return import.meta.env.VITE_EUROPEANA_API_KEY as string | undefined
}

interface EuropeanaItem {
  title?: string[]
  dcCreator?: string[]
  year?: string[]
  dataProvider?: string[]
  edmPreview?: string[]
  edmIsShownBy?: string[]
  guid?: string
  link?: string
}

interface EuropeanaSearchResponse {
  items: EuropeanaItem[]
}

function extractArtist(item: EuropeanaItem): string | undefined {
  const candidate = item.dcCreator?.[0]
  if (!candidate || candidate.startsWith('http')) return undefined
  return candidate
}

export const europeanaSource: MuseumSource = {
  id: 'europeana',
  label: 'Europeana',
  requiresKey: true,
  isConfigured: () => Boolean(getApiKey()),

  async search(query, page, signal) {
    const wskey = getApiKey()
    if (!wskey) return []

    const params = new URLSearchParams({
      wskey,
      query: query || 'painting',
      rows: String(PAGE_SIZE),
      start: String(page * PAGE_SIZE + 1), // Europeana's start is 1-indexed
      reusability: 'open',
      media: 'true',
      profile: 'rich',
    })
    const url = `https://api.europeana.eu/record/v2/search.json?${params}`
    const json = await fetchJson<EuropeanaSearchResponse>('europeana', url, {}, signal)

    return json.items
      .filter((item) => item.edmPreview?.[0] || item.edmIsShownBy?.[0])
      .map((item, idx): Artwork => {
        const thumb = item.edmPreview?.[0] ?? item.edmIsShownBy![0]
        return {
          uid: `europeana:${item.guid ?? item.link ?? idx}`,
          sourceId: 'europeana',
          sourceLabel: 'Europeana',
          title: item.title?.[0] || 'Untitled',
          artist: extractArtist(item),
          date: item.year?.[0],
          department: item.dataProvider?.[0],
          thumbUrl: thumb,
          fullUrl: item.edmIsShownBy?.[0] ?? thumb,
          objectUrl: item.guid ?? item.link,
        }
      })
  },
}
