/**
 * The nav's three glyphs, hand-written to match the inline SVGs already in
 * SearchBar and SaveButton: 24x24, currentColor, stroke-width 2, sized by CSS.
 * Three icons don't justify pulling in an icon library.
 *
 * Each is aria-hidden — the accessible name belongs on the control wrapping it.
 */

export function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H4a1 1 0 0 1-1-1v-9.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * The same bookmark SaveButton draws, so "save this" and "my lists" read as one
 * concept rather than two unrelated features.
 */
export function CollectionIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SignInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M4 21a8 8 0 0 1 16 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
