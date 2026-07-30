import type { Artwork, SourceId } from '../types/artwork'
import type { ArtTypeId } from '../lib/artTypes'

export interface MuseumSource {
  id: SourceId
  label: string
  /**
   * True for sources that need an API key (Smithsonian, Harvard, Europeana).
   * Their keys live server-side, so whether one is actually present comes from
   * /api/config at runtime — see isSourceAvailable() in ./index.
   */
  requiresKey?: boolean
  /**
   * Run a search. `query` may be empty, meaning "browse" — adapters should
   * return a reasonable default page of artwork rather than nothing.
   * `page` is 0-indexed.
   *
   * `type` narrows to a kind of object (paintings, sculpture, prints…).
   * Adapters resolve it through getTypeFilter() and send their own
   * classification param; when that returns null the source has no usable
   * facet and should fall back to withTypeKeyword() instead — see
   * ../lib/artTypes.
   */
  search(
    query: string,
    page: number,
    signal: AbortSignal,
    type?: ArtTypeId,
  ): Promise<Artwork[]>
}

/** Page size every adapter should target, so the merged wall fills evenly. */
export const PAGE_SIZE = 24
