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
  return (
    <div className={styles.filterRow} role="group" aria-label="Filter by museum">
      {allSources.map((source) => {
        const configured = isSourceAvailable(source, configuredSourceIds)
        const active = configured && enabledSourceIds.has(source.id)
        return (
          <button
            key={source.id}
            type="button"
            className={styles.chip}
            data-active={active}
            data-disabled={!configured}
            disabled={!configured}
            title={configured ? undefined : 'Needs an API key — see .env.example'}
            onClick={() => onToggle(source.id)}
            aria-pressed={active}
          >
            {source.label}
            {!configured && <span className={styles.keyBadge}>key needed</span>}
          </button>
        )
      })}
    </div>
  )
}
