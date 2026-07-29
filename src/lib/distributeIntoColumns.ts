import type { Artwork } from '../types/artwork'

/**
 * Fallback shape for the ~6 of 10 sources that don't report image dimensions
 * (V&A, Met, Rijksmuseum, Smithsonian, SMK, Europeana). Slightly portrait,
 * which is the commonest orientation for framed artwork.
 */
export const DEFAULT_ASPECT_RATIO = 3 / 4

/**
 * Split artworks into fixed columns, shortest-column-first.
 *
 * This replaces CSS `column-count`. Balanced multi-column re-fragments the
 * *entire* wall whenever a child's height changes or items are appended, so
 * cards migrate between columns and whatever you were looking at moves. Here,
 * appending only ever adds to the bottom of one column and a card resizing
 * only affects cards below it in that same column.
 *
 * Heights are *estimated* from each artwork's aspect ratio, never measured
 * from the DOM — so there's no read-back, no thrash, and the result is a pure
 * function of its inputs.
 *
 * Stability matters as much as balance: because useArtworkSearch only ever
 * appends (interleave() works within a page, and dedup preserves first-seen
 * order), a prefix-stable input yields a prefix-stable assignment. Recomputing
 * from scratch therefore leaves already-placed cards exactly where they were,
 * which is why this needs no caching or refs.
 */
export function distributeIntoColumns(artworks: Artwork[], columnCount: number): Artwork[][] {
  const columns: Artwork[][] = Array.from({ length: columnCount }, () => [])
  // Running height per column, in units of one column width.
  const heights = new Array<number>(columnCount).fill(0)

  for (const artwork of artworks) {
    const ratio =
      artwork.width && artwork.height ? artwork.width / artwork.height : DEFAULT_ASPECT_RATIO

    let shortest = 0
    for (let i = 1; i < columnCount; i++) {
      if (heights[i] < heights[shortest]) shortest = i
    }

    columns[shortest].push(artwork)
    heights[shortest] += 1 / ratio
  }

  return columns
}
