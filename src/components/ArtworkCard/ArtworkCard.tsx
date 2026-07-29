import type { Artwork } from '../../types/artwork'
import styles from './ArtworkCard.module.scss'

interface ArtworkCardProps {
  artwork: Artwork
  onOpen: (artwork: Artwork) => void
}

export function ArtworkCard({ artwork, onOpen }: ArtworkCardProps) {
  const aspectRatio =
    artwork.width && artwork.height ? `${artwork.width} / ${artwork.height}` : undefined

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onOpen(artwork)}
      aria-label={`${artwork.title}${artwork.artist ? `, ${artwork.artist}` : ''} — ${artwork.sourceLabel}`}
    >
      <div
        className={styles.imageWrap}
        style={{
          aspectRatio,
          backgroundImage: artwork.blurDataUrl ? `url(${artwork.blurDataUrl})` : undefined,
        }}
      >
        <img
          src={artwork.thumbUrl}
          alt={artwork.alt || artwork.title}
          loading="lazy"
          className={styles.image}
        />
      </div>
      <div className={styles.overlay}>
        <p className={styles.title}>{artwork.title}</p>
        {artwork.artist && <p className={styles.artist}>{artwork.artist}</p>}
        <p className={styles.source}>{artwork.sourceLabel}</p>
      </div>
    </button>
  )
}
