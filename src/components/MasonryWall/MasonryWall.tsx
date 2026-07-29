import type { Artwork } from '../../types/artwork'
import { ArtworkCard } from '../ArtworkCard/ArtworkCard'
import { useInfiniteScrollSentinel } from '../../hooks/useInfiniteScrollSentinel'
import styles from './MasonryWall.module.scss'

interface MasonryWallProps {
  artworks: Artwork[]
  onOpen: (artwork: Artwork) => void
  onLoadMore: () => void
  canLoadMore: boolean
}

export function MasonryWall({ artworks, onOpen, onLoadMore, canLoadMore }: MasonryWallProps) {
  const sentinelRef = useInfiniteScrollSentinel(onLoadMore, canLoadMore)

  return (
    <div className={styles.wall}>
      {artworks.map((artwork) => (
        <ArtworkCard key={artwork.uid} artwork={artwork} onOpen={onOpen} />
      ))}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
    </div>
  )
}
