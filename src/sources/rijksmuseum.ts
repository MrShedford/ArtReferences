import type { Artwork } from '../types/artwork'
import { fetchJson } from '../lib/fetchJson'
import { pLimit } from '../lib/pLimit'
import type { MuseumSource } from './types'

// Rijksmuseum's legacy keyless collection API was shut down 2026-01-05
// (returns HTTP 410 Gone). The replacement Data Services API is Linked Art /
// CIDOC-CRM JSON-LD, keyless, but:
//  - no free-text `q` param — only structured fields (creator, title, type, material)
//  - search returns bare entity IDs, not data
//  - getting an actual image requires a 3-hop chain:
//      HumanMadeObject --shows--> VisualItem --digitally_shown_by--> DigitalObject --access_point--> IIIF URL
// This makes Rijksmuseum by far the slowest and heaviest of the seven sources.
// Keep the page tiny and concurrency capped.
const RIJKS_PAGE_SIZE = 8

const LANG_EN = 'http://vocab.getty.edu/aat/300388277'
const LANG_NL = 'http://vocab.getty.edu/aat/300388256'
const FORMER_TITLE = 'https://id.rijksmuseum.nl/22015528'

interface GettyRef {
  id?: string
  type?: string
  _label?: string
}

interface LinkedArtName {
  type: string
  content?: string
  language?: GettyRef[]
  classified_as?: GettyRef[]
}

interface LinkedArtTimespan {
  identified_by?: LinkedArtName[]
  begin_of_the_begin?: string
}

interface ProductionPart {
  carried_out_by?: GettyRef[]
}

interface LinkedArtProduction {
  carried_out_by?: GettyRef[]
  part?: ProductionPart | ProductionPart[]
  timespan?: LinkedArtTimespan
}

interface HumanMadeObject {
  id: string
  identified_by?: LinkedArtName[]
  produced_by?: LinkedArtProduction
  shows?: { id: string }[]
}

interface VisualItem {
  digitally_shown_by?: { id: string }[]
}

interface DigitalObject {
  access_point?: { id: string }[]
}

interface OrderedCollectionPage {
  orderedItems?: { id: string; type: string }[]
}

const limit = pLimit(4)

function asArray<T>(v: T | T[] | undefined): T[] {
  if (!v) return []
  return Array.isArray(v) ? v : [v]
}

function hasLang(entry: LinkedArtName, langId: string): boolean {
  return entry.language?.some((l) => l.id === langId) ?? false
}

function extractTitle(obj: HumanMadeObject): string {
  const names = (obj.identified_by ?? []).filter(
    (n): n is LinkedArtName & { content: string } =>
      n.type === 'Name' && Boolean(n.content) && !n.classified_as?.some((c) => c.id === FORMER_TITLE),
  )
  const english = names.find((n) => hasLang(n, LANG_EN))
  const dutch = names.find((n) => hasLang(n, LANG_NL))
  return english?.content ?? dutch?.content ?? names[0]?.content ?? 'Untitled'
}

function extractArtist(obj: HumanMadeObject): string | undefined {
  const production = obj.produced_by
  if (!production) return undefined
  const direct = production.carried_out_by
  const nested = asArray(production.part).flatMap((p) => p.carried_out_by ?? [])
  const person = (direct ?? [])[0] ?? nested[0]
  const label = person?._label
  return label
}

function extractDate(obj: HumanMadeObject): string | undefined {
  const timespan = obj.produced_by?.timespan
  const names = timespan?.identified_by ?? []
  const english = names.find((n) => n.type === 'Name' && hasLang(n, LANG_EN))
  if (english?.content) return english.content
  const year = timespan?.begin_of_the_begin?.slice(0, 4)
  return year
}

async function resolveImage(visualItemId: string, signal: AbortSignal): Promise<string | null> {
  const visualItem = await fetchJson<VisualItem>(
    'rijksmuseum',
    visualItemId,
    { headers: { Accept: 'application/ld+json' } },
    signal,
  )
  const digitalObjectId = visualItem.digitally_shown_by?.[0]?.id
  if (!digitalObjectId) return null

  const digitalObject = await fetchJson<DigitalObject>(
    'rijksmuseum',
    digitalObjectId,
    { headers: { Accept: 'application/ld+json' } },
    signal,
  )
  return digitalObject.access_point?.[0]?.id ?? null
}

async function resolveArtwork(objectId: string, signal: AbortSignal): Promise<Artwork | null> {
  const obj = await fetchJson<HumanMadeObject>(
    'rijksmuseum',
    objectId,
    { headers: { Accept: 'application/ld+json' } },
    signal,
  )
  const visualItemId = obj.shows?.[0]?.id
  if (!visualItemId) return null

  const imageUrl = await resolveImage(visualItemId, signal)
  if (!imageUrl) return null

  // access_point URLs look like https://iiif.micr.io/{id}/full/max/0/default.jpg
  const iiifBase = imageUrl.replace(/full\/max\/0\/default\.jpg$/, '')

  return {
    uid: `rijksmuseum:${objectId}`,
    sourceId: 'rijksmuseum',
    sourceLabel: 'Rijksmuseum',
    title: extractTitle(obj),
    artist: extractArtist(obj),
    date: extractDate(obj),
    thumbUrl: `${iiifBase}full/400,/0/default.jpg`,
    fullUrl: imageUrl,
    objectUrl: obj.id,
  }
}

async function searchIds(field: 'creator' | 'title', value: string, signal: AbortSignal) {
  const params = new URLSearchParams({ imageAvailable: 'true' })
  params.set(field, value)
  const url = `https://data.rijksmuseum.nl/search/collection?${params}`
  const json = await fetchJson<OrderedCollectionPage>('rijksmuseum', url, {}, signal)
  return json.orderedItems ?? []
}

export const rijksmuseumSource: MuseumSource = {
  id: 'rijksmuseum',
  label: 'Rijksmuseum',

  async search(query, page, signal) {
    // No free-text search on the new API: map the query to both creator= and
    // title= in parallel and dedupe. An empty query browses paintings broadly.
    const [byCreator, byTitle] = query
      ? await Promise.all([
          searchIds('creator', query, signal).catch(() => []),
          searchIds('title', query, signal).catch(() => []),
        ])
      : [await searchIds('title', 'landschap', signal).catch(() => []), []]

    const seen = new Set<string>()
    const ids = [...byCreator, ...byTitle]
      .map((item) => item.id)
      .filter((id) => (seen.has(id) ? false : (seen.add(id), true)))

    const pageIds = ids.slice(page * RIJKS_PAGE_SIZE, page * RIJKS_PAGE_SIZE + RIJKS_PAGE_SIZE)
    if (pageIds.length === 0) return []

    const resolved = await Promise.allSettled(
      pageIds.map((id) => limit(() => resolveArtwork(id, signal))),
    )

    return resolved
      .filter(
        (r): r is PromiseFulfilledResult<Artwork | null> =>
          r.status === 'fulfilled' && r.value !== null,
      )
      .map((r) => r.value as Artwork)
  },
}
