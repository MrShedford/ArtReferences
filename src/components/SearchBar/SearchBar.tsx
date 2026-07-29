import styles from './SearchBar.module.scss'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

/**
 * Fully controlled. It used to mirror `value` into local draft state, which
 * was fine while the only writer was the parent's useState — but the query
 * now lives in the URL, so Back/forward can change it underneath the input
 * and a second copy of the value would go stale.
 */
export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className={styles.searchBar}>
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" />
      </svg>
      <input
        type="search"
        className={styles.input}
        placeholder="Search artworks, artists, subjects..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search artworks across all museums"
      />
    </div>
  )
}
