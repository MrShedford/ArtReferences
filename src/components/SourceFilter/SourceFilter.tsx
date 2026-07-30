import { useCallback } from 'react'
import type { SourceId } from '../../types/artwork'
import { allSources, isSourceAvailable } from '../../sources'
import { useDismissable } from '../../hooks/useDismissable'
import styles from './SourceFilter.module.scss'

interface SourceFilterProps {
  enabledSourceIds: Set<SourceId>
  /** Key-gated sources the server has a key for — from /api/config. */
  configuredSourceIds: Set<SourceId>
  onToggle: (id: SourceId) => void
  /**
   * Controlled by SearchPage rather than held here: this dropdown sits beside
   * TypeFilter, and two independently-open menus would overlap.
   */
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SourceFilter({
  enabledSourceIds,
  configuredSourceIds,
  onToggle,
  open,
  onOpenChange,
}: SourceFilterProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const dropdownRef = useDismissable<HTMLDivElement>(open, close)

  const availableSources = allSources.filter((source) =>
    isSourceAvailable(source, configuredSourceIds),
  )

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => onOpenChange(!open)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Sources ({enabledSourceIds.size}){' '}
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
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
