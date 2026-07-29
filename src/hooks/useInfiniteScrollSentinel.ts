import { useEffect, useRef } from 'react'

/**
 * Attaches an IntersectionObserver to a sentinel element; calls onIntersect
 * when it scrolls into view. Used to trigger loading the next page at the
 * bottom of the masonry wall.
 */
export function useInfiniteScrollSentinel(onIntersect: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!enabled) return
    const node = sentinelRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onIntersect()
      },
      { rootMargin: '600px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [onIntersect, enabled])

  return sentinelRef
}
