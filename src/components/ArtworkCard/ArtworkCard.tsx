import { useEffect, useRef, useState } from 'react'
import type { Artwork } from '../../types/artwork'
import { getAspectRatio, rememberAspectRatio } from '../../lib/aspectRatios'
import { preloadImage } from '../../lib/imagePreload'
import { SaveButton } from '../SaveButton/SaveButton'
import styles from './ArtworkCard.module.scss'

interface ArtworkCardProps {
  artwork: Artwork
  onOpen: (artwork: Artwork) => void
}

/**
 * How long a pointer has to rest on a card before we treat it as intent to
 * open. Without a threshold, sweeping the mouse across the wall would fire a
 * full-resolution request for every card it crossed.
 */
const HOVER_INTENT_MS = 120

export function ArtworkCard({ artwork, onOpen }: ArtworkCardProps) {
  // Always reserve space. A known ratio is exact; otherwise a portrait-ish
  // placeholder holds the slot until the image decodes and reports its own.
  // Previously this was left undefined, so the card was 0px tall until load.
  const [ratio, setRatio] = useState<number>(() => getAspectRatio(artwork))

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget
    const actual = rememberAspectRatio(artwork.uid, naturalWidth, naturalHeight)
    if (actual !== undefined) setRatio(actual)
  }

  // The Lightbox loads a larger variant than this card does, so opening is
  // otherwise always a cold fetch. Start it as soon as intent is clear.
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const cancelHoverIntent = () => {
    clearTimeout(hoverTimer.current)
    hoverTimer.current = undefined
  }

  const preloadNow = () => {
    cancelHoverIntent()
    preloadImage(artwork.fullUrl)
  }

  // A card can unmount mid-dwell — the wall reflows on column-count changes and
  // filter toggles — so the timer has to be cleaned up rather than left to fire.
  useEffect(() => cancelHoverIntent, [])

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
        onPointerEnter={() => {
          cancelHoverIntent()
          hoverTimer.current = setTimeout(preloadNow, HOVER_INTENT_MS)
        }}
        onPointerLeave={cancelHoverIntent}
        // Covers touch, which never hovers, and still buys the
        // pointerdown -> click -> render gap on a fast mouse click.
        onPointerDown={preloadNow}
        onFocus={preloadNow}
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
