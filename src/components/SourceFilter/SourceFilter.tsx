import { useEffect, useRef, useState } from 'react'
import type { SourceId } from '../../types/artwork'
import { allSources, isSourceAvailable } from '../../sources'
import styles from './SourceFilter.module.scss'

interface SourceFilterProps {
  enabledSourceIds: Set<SourceId>
  /** Key-gated sources the server has a key for — from /api/config. */
  configuredSourceIds: Set<SourceId>
  onToggle: (id: SourceId) => void
}

export function SourceFilter({
  enabledSourceIds,
  configuredSourceIds,
  onToggle,
}: SourceFilterProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const availableSources = allSources.filter((source) =>
    isSourceAvailable(source, configuredSourceIds)
  )

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Sources ({enabledSourceIds.size}){" "}
        <span className={styles.arrow}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          {availableSources.map((source) => (
            <label key={source.id} className={styles.option}>
              <input
                type="checkbox"
                checked={enabledSourceIds.has(source.id)}
                onChange={() => onToggle(source.id)}
              />
              <span>{source.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}