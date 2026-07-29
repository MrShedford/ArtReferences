import { useEffect, useRef } from 'react'

/**
 * Escape-to-close, click-outside-to-close, and focus returned to whatever
 * opened it. The popup half of Lightbox's dismissal behaviour, minus the
 * modal parts — no body scroll lock and no focus trap, because these are
 * menus attached to a control, not dialogs over the page.
 *
 * Returns a ref for the element that counts as "inside".
 */
export function useDismissable<T extends HTMLElement>(open: boolean, onClose: () => void) {
  const containerRef = useRef<T>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    // Captured now rather than read in the cleanup: by the time cleanup runs
    // React may already have detached the subtree, and the ref would be null.
    const container = containerRef.current

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Stop the same Escape reaching an open Lightbox behind the menu.
        event.stopPropagation()
        onClose()
      }
    }

    // pointerdown, not click: closing on mousedown matches how native menus
    // behave, and it fires before a click on whatever is underneath.
    const onPointerDown = (event: PointerEvent) => {
      if (container && !container.contains(event.target as Node)) onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)

      // Only pull focus back if it's still inside the menu we're closing —
      // otherwise this steals it from wherever the user deliberately moved.
      // document.body is where focus lands when the focused node is removed,
      // which is the ordinary case for closing a menu with an item focused.
      const focusWasInside =
        container?.contains(document.activeElement) || document.activeElement === document.body
      if (focusWasInside) previouslyFocused.current?.focus()
    }
  }, [open, onClose])

  return containerRef
}
