import { useState } from 'react'
import styles from './SearchBar.module.scss'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [draft, setDraft] = useState(value)

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
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value)
          onChange(e.target.value)
        }}
        aria-label="Search artworks across all museums"
      />
    </div>
  )
}
