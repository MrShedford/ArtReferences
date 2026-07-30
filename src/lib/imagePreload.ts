/**
 * URLs already handed to the browser. The Image objects themselves are not
 * retained — once the fetch settles the bytes live in the HTTP cache and the
 * element is garbage. This set only exists to stop us re-issuing the same
 * request every time a pointer crosses the same card.
 */
const requested = new Set<string>()

/**
 * Fire-and-forget warm of the browser's HTTP cache.
 *
 * The Lightbox loads a larger variant than the wall does (AIC 400w vs 843w,
 * Rijksmuseum 400w vs max, and so on), so opening a card is otherwise always a
 * cold fetch. Starting it on hover intent means the bytes are usually already
 * there by the time the click lands.
 */
export function preloadImage(url: string | undefined): void {
  if (!url || requested.has(url)) return
  requested.add(url)
  const img = new Image()
  img.decoding = 'async'
  img.src = url
}
