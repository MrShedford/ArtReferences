import { useEffect, useRef } from 'react'
import type { Artwork } from '../../types/artwork'
import styles from './Lightbox.module.scss'

interface LightboxProps {
  artwork: Artwork
  onClose: () => void
}

export function Lightbox({ artwork, onClose }: LightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    closeButtonRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={artwork.title}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          &#x2715;
        </button>

        <div className={styles.imageColumn}>
          <img src={artwork.fullUrl ?? artwork.thumbUrl} alt={artwork.alt || artwork.title} />
        </div>

        <div className={styles.infoColumn}>
          <h2 className={styles.title}>{artwork.title}</h2>
          {artwork.artist && <p className={styles.artist}>{artwork.artist}</p>}

          <dl className={styles.meta}>
            {artwork.date && (
              <>
                <dt>Date</dt>
                <dd>{artwork.date}</dd>
              </>
            )}
            {artwork.medium && (
              <>
                <dt>Medium</dt>
                <dd>{artwork.medium}</dd>
              </>
            )}
            {artwork.department && (
              <>
                <dt>Department</dt>
                <dd>{artwork.department}</dd>
              </>
            )}
            {artwork.creditLine && (
              <>
                <dt>Credit</dt>
                <dd>{artwork.creditLine}</dd>
              </>
            )}
            <dt>Source</dt>
            <dd>{artwork.sourceLabel}</dd>
          </dl>

          {artwork.objectUrl && (
            <a
              href={artwork.objectUrl}
              target="_blank"
              rel="noreferrer"
              className={styles.link}
            >
              View at {artwork.sourceLabel} &#x2197;
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
