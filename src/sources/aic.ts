import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { getTypeFilter } from '../lib/artTypes'
import { PAGE_SIZE, type MuseumSource } from './types'

const FIELDS = 'id,title,artist_title,date_display,image_id,thumbnail,department_title'

interface AicThumbnail {
  width?: number
  height?: number
  lqip?: string
  alt_text?: string
}

interface AicArtworkRecord {
  id: number
  title: string
  artist_title?: string
  date_display?: string
  department_title?: string
  image_id?: string | null
  thumbnail?: AicThumbnail | null
}

interface AicSearchResponse {
  data: AicArtworkRecord[]
  config: { iiif_url: string; website_url: string }
}

export const aicSource: MuseumSource = {
  id: 'aic',
  label: 'Art Institute of Chicago',

  async search(query, page, signal, type) {
    const params = new URLSearchParams({
      q: query || 'painting',
      limit: String(PAGE_SIZE),
      page: String(page + 1), // AIC pages are 1-indexed
      fields: FIELDS,
    })
    // `match`, not `term`: classification_title is analyzed, so a term query
    // for "painting" matches nothing at all.
    const classification = type && getTypeFilter('aic', type)
    if (classification) params.set('query[match][classification_title]', classification)
    const url = `https://api.artic.edu/api/v1/artworks/search?${params}`
    const json = await fetchJson<AicSearchResponse>('aic', url, {}, signal)
    const iiifBase = json.config.iiif_url

    return json.data
      .filter((rec): rec is AicArtworkRecord & { image_id: string } => Boolean(rec.image_id))
      .map((rec): Artwork => ({
        uid: `aic:${rec.id}`,
        sourceId: 'aic',
        sourceLabel: 'Art Institute of Chicago',
        title: rec.title,
        artist: rec.artist_title,
        date: rec.date_display,
        department: rec.department_title,
        thumbUrl: `${iiifBase}/${rec.image_id}/full/400,/0/default.jpg`,
        fullUrl: `${iiifBase}/${rec.image_id}/full/843,/0/default.jpg`,
        width: rec.thumbnail?.width,
        height: rec.thumbnail?.height,
        blurDataUrl: rec.thumbnail?.lqip,
        alt: rec.thumbnail?.alt_text,
        objectUrl: `https://www.artic.edu/artworks/${rec.id}`,
      }))
  },
}
