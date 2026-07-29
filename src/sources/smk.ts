import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { PAGE_SIZE, type MuseumSource } from './types'

interface SmkTitle {
  title?: string
}

interface SmkProductionDate {
  period?: string
}

interface SmkArtworkRecord {
  id: string
  titles?: SmkTitle[]
  artist?: string[]
  production_date?: SmkProductionDate
  techniques?: string[]
  image_thumbnail?: string
  image_native?: string
  frontend_url?: string
  public_domain?: boolean
}

interface SmkSearchResponse {
  items: SmkArtworkRecord[]
}

export const smkSource: MuseumSource = {
  id: 'smk',
  label: 'SMK (National Gallery of Denmark)',
  isConfigured: () => true,

  async search(query, page, signal) {
    const params = new URLSearchParams({
      keys: query || 'maleri', // Danish for "painting" — no neutral browse query exists
      rows: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      filters: '[has_image:true]',
    })
    const url = `https://api.smk.dk/api/v1/art/search/?${params}`
    const json = await fetchJson<SmkSearchResponse>('smk', url, {}, signal)

    return json.items
      .filter((rec) => rec.image_thumbnail)
      .map((rec): Artwork => ({
        uid: `smk:${rec.id}`,
        sourceId: 'smk',
        sourceLabel: 'SMK (National Gallery of Denmark)',
        title: rec.titles?.[0]?.title || 'Untitled',
        artist: rec.artist?.[0],
        date: rec.production_date?.period,
        medium: rec.techniques?.[0],
        thumbUrl: rec.image_thumbnail!,
        fullUrl: rec.image_native ?? rec.image_thumbnail!,
        objectUrl: rec.frontend_url,
        isPublicDomain: rec.public_domain,
      }))
  },
}
