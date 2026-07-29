import { useEffect, useRef } from 'react'

/**
 * Attaches an IntersectionObserver to a sentinel element; calls onIntersect
 * when it scrolls into view. Used to trigger loading the next page at the
 * bottom of the masonry wall.
 *
 * onIntersect is held in a ref rather than depended on. It used to be in the
 * dep array while callers passed an inline arrow, so the observer was torn
 * down and rebuilt on every render — and a freshly created observer always
 * fires once for the current intersection state, which turned "load more" into
 * a self-sustaining fetch loop (doubled again by StrictMode in dev).
 */
export function useInfiniteScrollSentinel(onIntersect: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const callbackRef = useRef(onIntersect)

  useEffect(() => {
    callbackRef.current = onIntersect
  }, [onIntersect])

  useEffect(() => {
    if (!enabled) return
    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) callbackRef.current()
      },
      // The sentinel now sits below the wall rather than inside it, so this is
      // a genuine "near the bottom" margin and can be modest.
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [enabled])

  return sentinelRef
}
