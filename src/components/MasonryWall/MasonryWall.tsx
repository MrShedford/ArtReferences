import { useMemo } from 'react'
import type { Artwork } from '../../types/artwork'
import { ArtworkCard } from '../ArtworkCard/ArtworkCard'
import { useInfiniteScrollSentinel } from '../../hooks/useInfiniteScrollSentinel'
import { useColumnCount } from '../../hooks/useColumnCount'
import { distributeIntoColumns } from '../../lib/distributeIntoColumns'
import styles from './MasonryWall.module.scss'

interface MasonryWallProps {
  artworks: Artwork[]
  onOpen: (artwork: Artwork) => void
  onLoadMore: () => void
  canLoadMore: boolean
}

export function MasonryWall({ artworks, onOpen, onLoadMore, canLoadMore }: MasonryWallProps) {
  const sentinelRef = useInfiniteScrollSentinel(onLoadMore, canLoadMore)
  const columnCount = useColumnCount()

  const columns = useMemo(
    () => distributeIntoColumns(artworks, columnCount),
    [artworks, columnCount],
  )

  return (
    <>
      <div className={styles.wall}>
        {columns.map((column, index) => (
          // Column index is a stable key: the count only changes on a
          // breakpoint cross, which is a deliberate relayout anyway.
          <div key={index} className={styles.column}>
            {column.map((artwork) => (
              <ArtworkCard key={artwork.uid} artwork={artwork} onOpen={onOpen} />
            ))}
          </div>
        ))}
      </div>
      {/* Outside the wall on purpose. As a child it used to be laid out into
          one of the columns — often nowhere near the bottom — so it sat
          permanently intersecting and kept requesting pages. */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
    </>
  )
}
