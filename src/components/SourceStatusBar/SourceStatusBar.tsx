import type { SourceId } from '../../types/artwork'
import type { MuseumSource } from '../../sources/types'
import type { SourceStatus } from '../../hooks/useArtworkSearch'
import styles from './SourceStatusBar.module.scss'

interface SourceStatusBarProps {
  activeSources: MuseumSource[]
  statuses: Partial<Record<SourceId, SourceStatus>>
}

export function SourceStatusBar({ activeSources, statuses }: SourceStatusBarProps) {
  if (activeSources.length === 0) {
    return <p className={styles.empty}>No museums enabled — pick at least one above.</p>
  }

  return (
    <ul className={styles.list}>
      {activeSources.map((source) => {
        const status = statuses[source.id]
        return (
          <li key={source.id} className={styles.item} data-state={status?.status ?? 'pending'}>
            <span className={styles.dot} aria-hidden="true" />
            <span>{source.label}</span>
            {status?.status === 'success' && <span className={styles.count}>{status.count}</span>}
            {status?.status === 'error' && (
              <span className={styles.errorText} title={status.error}>
                failed
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
