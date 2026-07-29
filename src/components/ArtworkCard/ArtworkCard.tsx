import { useState } from 'react'
import type { Artwork } from '../../types/artwork'
import { DEFAULT_ASPECT_RATIO } from '../../lib/distributeIntoColumns'
import { SaveButton } from '../SaveButton/SaveButton'
import styles from './ArtworkCard.module.scss'

interface ArtworkCardProps {
  artwork: Artwork
  onOpen: (artwork: Artwork) => void
}

/**
 * Ratios discovered from decoded images, keyed by artwork uid.
 *
 * Cards unmount and remount whenever the column count changes or a source
 * filter is toggled. Without this, every such remount would replay the
 * placeholder-then-snap shift for the 6 of 10 sources that don't report
 * dimensions. Module-level so it survives the remount; bounded in practice by
 * the number of artworks the session has scrolled past.
 */
const resolvedRatios = new Map<string, number>()

export function ArtworkCard({ artwork, onOpen }: ArtworkCardProps) {
  // Always reserve space. A known ratio is exact; otherwise a portrait-ish
  // placeholder holds the slot until the image decodes and reports its own.
  // Previously this was left undefined, so the card was 0px tall until load.
  const [ratio, setRatio] = useState<number>(
    () =>
      (artwork.width && artwork.height ? artwork.width / artwork.height : undefined) ??
      resolvedRatios.get(artwork.uid) ??
      DEFAULT_ASPECT_RATIO,
  )

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget
    if (!naturalWidth || !naturalHeight) return
    const actual = naturalWidth / naturalHeight
    resolvedRatios.set(artwork.uid, actual)
    setRatio(actual)
  }

  // The root used to be the <button> itself. It can't be: HTML forbids nesting
  // interactive content inside a button, so the Save control had nowhere legal
  // to go. Making it a sibling also means its clicks never reach the open
  // handler, so nothing here needs stopPropagation.
  return (
    <article className={styles.card}>
      <button
        type="button"
        className={styles.openButton}
        onClick={() => onOpen(artwork)}
        aria-label={`${artwork.title}${artwork.artist ? `, ${artwork.artist}` : ''} — ${artwork.sourceLabel}`}
      >
        <div
          className={styles.imageWrap}
          style={{
            aspectRatio: String(ratio),
            backgroundImage: artwork.blurDataUrl ? `url(${artwork.blurDataUrl})` : undefined,
          }}
        >
          <img
            src={artwork.thumbUrl}
            alt={artwork.alt || artwork.title}
            loading="lazy"
            decoding="async"
            className={styles.image}
            onLoad={handleLoad}
          />
        </div>
        <div className={styles.overlay}>
          <p className={styles.title}>{artwork.title}</p>
          {artwork.artist && <p className={styles.artist}>{artwork.artist}</p>}
          <p className={styles.source}>{artwork.sourceLabel}</p>
        </div>
      </button>

      <div className={styles.actions}>
        <SaveButton artwork={artwork} />
      </div>
    </article>
  )
}
