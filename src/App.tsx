import { useCallback, useMemo, useState } from 'react'
import type { Artwork, SourceId } from './types/artwork'
import { allSources } from './sources'
import { useArtworkSearch } from './hooks/useArtworkSearch'
import { useDebouncedValue } from './hooks/useDebouncedValue'
import { SearchBar } from './components/SearchBar/SearchBar'
import { SourceFilter } from './components/SourceFilter/SourceFilter'
import { SourceStatusBar } from './components/SourceStatusBar/SourceStatusBar'
import { MasonryWall } from './components/MasonryWall/MasonryWall'
import { Lightbox } from './components/Lightbox/Lightbox'
import styles from './App.module.scss'

function App() {
  const [query, setQuery] = useState('')
  const [enabledSourceIds, setEnabledSourceIds] = useState<Set<SourceId>>(
    () => new Set(allSources.map((s) => s.id)),
  )
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null)

  const debouncedQuery = useDebouncedValue(query, 350)

  const {
    artworks,
    sourceStatuses,
    activeSources,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useArtworkSearch(debouncedQuery, enabledSourceIds)

  const toggleSource = useCallback((id: SourceId) => {
    setEnabledSourceIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const canLoadMore = useMemo(
    () => Boolean(hasNextPage) && !isFetchingNextPage,
    [hasNextPage, isFetchingNextPage],
  )

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.heading}>Museum References</h1>
        <p className={styles.subheading}>
          A wall of open-access artwork from museums around the world.
        </p>
        <SearchBar value={query} onChange={setQuery} />
        <SourceFilter enabledSourceIds={enabledSourceIds} onToggle={toggleSource} />
        <SourceStatusBar activeSources={activeSources} statuses={sourceStatuses} />
      </header>

      <main>
        {isLoading && <p className={styles.loading}>Loading artwork...</p>}
        {!isLoading && artworks.length === 0 && (
          <p className={styles.loading}>No results. Try a different search or enable more museums.</p>
        )}
        <MasonryWall
          artworks={artworks}
          onOpen={setSelectedArtwork}
          onLoadMore={() => fetchNextPage()}
          canLoadMore={canLoadMore}
        />
        {isFetchingNextPage && <p className={styles.loading}>Loading more...</p>}
      </main>

      {selectedArtwork && (
        <Lightbox artwork={selectedArtwork} onClose={() => setSelectedArtwork(null)} />
      )}
    </div>
  )
}

export default App
