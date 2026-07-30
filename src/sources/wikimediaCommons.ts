import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { withTypeKeyword } from '../lib/artTypes'
import { PAGE_SIZE, type MuseumSource } from './types'

// Commons' search API returns wiki pages, not structured artwork data, so a
// second call is needed to resolve the actual image + metadata. MediaWiki
// accepts pipe-separated batched `titles=` (up to 50), so this is one search
// request + one batched resolve request per page — not an N+1 fanout like
// the Met or Rijksmuseum adapters.
const NS_FILE = 6

interface CommonsSearchResult {
  title: string
}

interface CommonsSearchResponse {
  query?: { search?: CommonsSearchResult[] }
}

interface CommonsExtMetadataField {
  value?: string
}

interface CommonsImageInfo {
  url?: string
  width?: number
  height?: number
  descriptionurl?: string
  extmetadata?: {
    Artist?: CommonsExtMetadataField
    DateTimeOriginal?: CommonsExtMetadataField
    Date?: CommonsExtMetadataField
  }
}

interface CommonsPage {
  title: string
  missing?: string
  imageinfo?: CommonsImageInfo[]
}

interface CommonsResolveResponse {
  query?: { pages?: Record<string, CommonsPage> }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim()
}

async function searchFiles(query: string, page: number, signal: AbortSignal): Promise<CommonsSearchResult[]> {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query || 'painting',
    srnamespace: String(NS_FILE),
    srlimit: String(PAGE_SIZE),
    sroffset: String(page * PAGE_SIZE),
    format: 'json',
    origin: '*', // MediaWiki's documented CORS opt-in
  })
  const url = `https://commons.wikimedia.org/w/api.php?${params}`
  const json = await fetchJson<CommonsSearchResponse>('wikimediaCommons', url, {}, signal)
  return json.query?.search ?? []
}

async function resolve(titles: string[], signal: AbortSignal): Promise<Map<string, CommonsPage>> {
  const params = new URLSearchParams({
    action: 'query',
    titles: titles.join('|'),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|size',
    format: 'json',
    origin: '*',
  })
  const url = `https://commons.wikimedia.org/w/api.php?${params}`
  const json = await fetchJson<CommonsResolveResponse>('wikimediaCommons', url, {}, signal)
  const pages = json.query?.pages ?? {}

  const byTitle = new Map<string, CommonsPage>()
  for (const page of Object.values(pages)) {
    byTitle.set(page.title, page)
  }
  return byTitle
}

export const wikimediaCommonsSource: MuseumSource = {
  id: 'wikimediaCommons',
  label: 'Wikimedia Commons',

  async search(query, page, signal, type) {
    // Commons has no classification facet. `incategory:` only matches the one
    // flat category (105 hits for paintings) and `deepcategory:` walks the
    // whole subtree — accurate, but slow enough to trip fetchJson's timeout.
    // Folding the word into srsearch is approximate but fast and reliable.
    const results = await searchFiles(withTypeKeyword('wikimediaCommons', query, type), page, signal)
    if (results.length === 0) return []

    // query.pages is keyed by pageid and unordered relative to the search
    // results — resolve into a map, then walk the original search order so
    // ranking is preserved.
    const byTitle = await resolve(
      results.map((r) => r.title),
      signal,
    )

    const artworks: Artwork[] = []
    for (const result of results) {
      const commonsPage = byTitle.get(result.title)
      const info = commonsPage?.imageinfo?.[0]
      if (!commonsPage || commonsPage.missing !== undefined || !info?.url) continue

      const rawArtist = info.extmetadata?.Artist?.value
      const rawDate = info.extmetadata?.DateTimeOriginal?.value ?? info.extmetadata?.Date?.value
      // "File:Some Title.jpg" -> "Some Title"
      const displayTitle = result.title.replace(/^File:/, '').replace(/\.[a-zA-Z0-9]+$/, '')

      artworks.push({
        uid: `wikimediaCommons:${result.title}`,
        sourceId: 'wikimediaCommons',
        sourceLabel: 'Wikimedia Commons',
        title: displayTitle,
        artist: rawArtist ? stripHtml(rawArtist) : undefined,
        date: rawDate ? stripHtml(rawDate) : undefined,
        thumbUrl: info.url,
        fullUrl: info.url,
        width: info.width,
        height: info.height,
        objectUrl: info.descriptionurl,
      })
    }
    return artworks
  },
}
