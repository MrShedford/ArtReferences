import { useCallback } from 'react'
import type { ArtTypeId } from '../../lib/artTypes'
import { ART_TYPES } from '../../lib/artTypes'
import { useDismissable } from '../../hooks/useDismissable'
import styles from './TypeFilter.module.scss'

interface TypeFilterProps {
  /** undefined means "all types" — the default, which keeps the URL clean. */
  value: ArtTypeId | undefined
  onChange: (value: ArtTypeId | undefined) => void
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ALL_TYPES_LABEL = 'All types'

export function TypeFilter({ value, onChange, open, onOpenChange }: TypeFilterProps) {
  const close = useCallback(() => onOpenChange(false), [onOpenChange])
  const dropdownRef = useDismissable<HTMLDivElement>(open, close)

  const activeLabel = ART_TYPES.find((t) => t.id === value)?.label ?? ALL_TYPES_LABEL

  // Radios, not checkboxes: one type at a time. Every museum API here takes a
  // single classification value, so multi-select would mean one request per
  // type per source — see src/lib/artTypes.ts.
  const select = (next: ArtTypeId | undefined) => {
    onChange(next)
    onOpenChange(false)
  }

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => onOpenChange(!open)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        Type: {activeLabel} <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <label className={styles.option}>
            <input
              type="radio"
              name="art-type"
              checked={value === undefined}
              onChange={() => select(undefined)}
            />
            <span>{ALL_TYPES_LABEL}</span>
          </label>

          {ART_TYPES.map((type) => (
            <label key={type.id} className={styles.option}>
              <input
                type="radio"
                name="art-type"
                checked={value === type.id}
                onChange={() => select(type.id)}
              />
              <span>{type.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
