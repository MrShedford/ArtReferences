import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { PAGE_SIZE, type MuseumSource } from './types'

interface VamRecord {
  systemNumber: string
  _primaryTitle?: string
  _primaryMaker?: { name?: string }
  _primaryDate?: string
  objectType?: string
  _images?: {
    _iiif_image_base_url?: string
    _primary_thumbnail?: string
  }
}

interface VamSearchResponse {
  records: VamRecord[]
}

export const vamSource: MuseumSource = {
  id: 'vam',
  label: 'Victoria and Albert Museum',
  isConfigured: () => true,

  async search(query, page, signal) {
    const params = new URLSearchParams({
      q: query || 'painting',
      page: String(page + 1), // V&A pages are 1-indexed
      page_size: String(PAGE_SIZE),
      images_exist: '1',
    })
    const url = `https://api.vam.ac.uk/v2/objects/search?${params}`
    const json = await fetchJson<VamSearchResponse>('vam', url, {}, signal)

    return json.records
      .filter((rec) => rec._images?._iiif_image_base_url)
      .map((rec): Artwork => {
        const iiifBase = rec._images!._iiif_image_base_url!
        return {
          uid: `vam:${rec.systemNumber}`,
          sourceId: 'vam',
          sourceLabel: 'Victoria and Albert Museum',
          title: rec._primaryTitle || 'Untitled',
          artist: rec._primaryMaker?.name,
          date: rec._primaryDate,
          medium: rec.objectType,
          thumbUrl: `${iiifBase}full/!400,400/0/default.jpg`,
          fullUrl: `${iiifBase}full/!800,800/0/default.jpg`,
          objectUrl: `https://collections.vam.ac.uk/item/${rec.systemNumber}`,
        }
      })
  },
}
