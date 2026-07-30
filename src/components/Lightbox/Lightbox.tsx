import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Artwork } from '../../types/artwork'
import { getAspectRatio } from '../../lib/aspectRatios'
import styles from './Lightbox.module.scss'

interface LightboxProps {
  artwork: Artwork
  onClose: () => void
}

export function Lightbox({ artwork, onClose }: LightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  // The wall's thumbnail is a guaranteed cache hit — the user was just looking
  // at it — but fullUrl is a *different* URL for 9 of 10 sources, so it always
  // starts cold. Show the thumb straight away against a box whose shape is
  // already known, and cross-fade once the real image arrives.
  const ratio = getAspectRatio(artwork)
  // Nothing better to load: Wikimedia, plus any record whose adapter fell back
  // to the thumb. One layer, and it carries the real alt text.
  const fullSrc = artwork.fullUrl && artwork.fullUrl !== artwork.thumbUrl ? artwork.fullUrl : null
  const [fullStatus, setFullStatus] = useState<'pending' | 'loaded' | 'failed'>('pending')

  // Blur the thumb only while a bigger image is genuinely on its way. If there
  // is none, or the fetch failed, the thumb is the artwork and must be sharp —
  // an unconditional blur here left Wikimedia (and every adapter fallback)
  // permanently out of focus.
  const showingPlaceholder = fullSrc !== null && fullStatus === 'pending'
  const thumbIsPrimary = fullSrc === null || fullStatus === 'failed'

  // A cached full image can finish decoding before React attaches onLoad, which
  // would strand it at opacity 0. Reopening the same artwork hits this every
  // time, so the ref has to check for itself rather than trust the event.
  // complete with a zero natural width means it resolved to nothing — a dead
  // fullUrl, which these APIs hand out often enough to matter.
  const markIfComplete = useCallback((node: HTMLImageElement | null) => {
    if (!node?.complete) return
    setFullStatus(node.naturalWidth > 0 ? 'loaded' : 'failed')
  }, [])

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
          <div className={styles.frame} style={{ '--artwork-ratio': ratio } as CSSProperties}>
            <img
              className={styles.thumb}
              src={artwork.thumbUrl}
              alt={thumbIsPrimary ? artwork.alt || artwork.title : ''}
              aria-hidden={thumbIsPrimary ? undefined : true}
              data-placeholder={showingPlaceholder}
            />
            {fullSrc && fullStatus !== 'failed' && (
              <img
                className={styles.full}
                src={fullSrc}
                alt={artwork.alt || artwork.title}
                data-loaded={fullStatus === 'loaded'}
                ref={markIfComplete}
                onLoad={() => setFullStatus('loaded')}
                onError={() => setFullStatus('failed')}
              />
            )}
          </div>
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
