import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { PAGE_SIZE, type MuseumSource } from './types'

interface ClevelandImageVariant {
  url: string
  width?: string | number
  height?: string | number
}

interface ClevelandCreator {
  description?: string
}

interface ClevelandArtworkRecord {
  id: number
  title: string
  creation_date?: string
  technique?: string
  department?: string
  creators?: ClevelandCreator[]
  creditline?: string
  images?: {
    web?: ClevelandImageVariant
    print?: ClevelandImageVariant
  }
  url?: string
}

interface ClevelandSearchResponse {
  data: ClevelandArtworkRecord[]
}

export const clevelandSource: MuseumSource = {
  id: 'cleveland',
  label: 'Cleveland Museum of Art',

  async search(query, page, signal) {
    const params = new URLSearchParams({
      q: query || 'painting',
      limit: String(PAGE_SIZE),
      skip: String(page * PAGE_SIZE),
      has_image: '1',
    })
    const url = `https://openaccess-api.clevelandart.org/api/artworks/?${params}`
    const json = await fetchJson<ClevelandSearchResponse>('cleveland', url, {}, signal)

    return json.data
      .filter((rec) => rec.images?.web?.url)
      .map((rec): Artwork => {
        const web = rec.images!.web!
        const print = rec.images!.print
        return {
          uid: `cleveland:${rec.id}`,
          sourceId: 'cleveland',
          sourceLabel: 'Cleveland Museum of Art',
          title: rec.title,
          artist: rec.creators?.[0]?.description,
          date: rec.creation_date,
          medium: rec.technique,
          department: rec.department,
          thumbUrl: web.url,
          fullUrl: print?.url ?? web.url,
          width: web.width ? Number(web.width) : undefined,
          height: web.height ? Number(web.height) : undefined,
          creditLine: rec.creditline,
          objectUrl: rec.url,
        }
      })
  },
}
