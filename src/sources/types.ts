import type { Artwork, SourceId } from '../types/artwork'

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
   */
  search(query: string, page: number, signal: AbortSignal): Promise<Artwork[]>
}

/** Page size every adapter should target, so the merged wall fills evenly. */
export const PAGE_SIZE = 24
