import type { Artwork } from '../types/artwork'
import { DEFAULT_ASPECT_RATIO } from './distributeIntoColumns'

/**
 * Ratios discovered from decoded images, keyed by artwork uid.
 *
 * Cards unmount and remount whenever the column count changes or a source
 * filter is toggled. Without this, every such remount would replay the
 * placeholder-then-snap shift for the 6 of 10 sources that don't report
 * dimensions. Module-level so it survives the remount; bounded in practice by
 * the number of artworks the session has scrolled past.
 *
 * The Lightbox reads it too, which is why this lives here rather than inside
 * ArtworkCard: by the time a card is clicked its thumbnail has decoded, so the
 * exact ratio is already known and the dialog can reserve the right box before
 * the full-resolution image has even started arriving.
 */
const resolvedRatios = new Map<string, number>()

/**
 * Best available width/height ratio for an artwork, in preference order:
 * the source's own dimensions, then a ratio measured from a decoded image,
 * then the portrait-ish fallback.
 *
 * Safe to use for `fullUrl` as well as `thumbUrl`: every adapter's full image
 * is the same photograph at a larger scale, so the two share a ratio even
 * though no source reports dimensions for the full variant.
 */
export function getAspectRatio(artwork: Artwork): number {
  if (artwork.width && artwork.height) return artwork.width / artwork.height
  return resolvedRatios.get(artwork.uid) ?? DEFAULT_ASPECT_RATIO
}

/** Record the true ratio of a decoded image. No-ops on undecodable images. */
export function rememberAspectRatio(
  uid: string,
  naturalWidth: number,
  naturalHeight: number,
): number | undefined {
  if (!naturalWidth || !naturalHeight) return undefined
  const ratio = naturalWidth / naturalHeight
  resolvedRatios.set(uid, ratio)
  return ratio
}
