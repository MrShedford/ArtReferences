import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Artwork, SourceId } from '../types/artwork'
import { parseEnabledSources, searchRoute, serializeEnabledSources } from '../router'
import { useArtworkSearch } from '../hooks/useArtworkSearch'
import { useConfiguredSources } from '../hooks/useConfiguredSources'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { SearchBar } from '../components/SearchBar/SearchBar'
import { SourceFilter } from '../components/SourceFilter/SourceFilter'
import { SourceStatusBar } from '../components/SourceStatusBar/SourceStatusBar'
import { MasonryWall } from '../components/MasonryWall/MasonryWall'
import { Lightbox } from '../components/Lightbox/Lightbox'
import styles from './SearchPage.module.scss'

export function SearchPage() {
  const { q = '', sources } = searchRoute.useSearch()
  const navigate = searchRoute.useNavigate()

  // The input is local; the URL is the committed query. Typing updates the
  // draft immediately and the URL only after the debounce settles, so the
  // address bar doesn't churn on every keystroke.
  const [draft, setDraft] = useState(q)
  const debouncedDraft = useDebouncedValue(draft, 350)

  useEffect(() => {
    if (debouncedDraft === q) return
    void navigate({
      search: (prev) => ({ ...prev, q: debouncedDraft || undefined }),
      // Replace, not push: otherwise every settled keystroke is a history
      // entry and Back has to be pressed once per word.
      replace: true,
    })
  }, [debouncedDraft, q, navigate])

  // Back/forward changes the URL underneath us — follow it. During typing this
  // is a no-op, since q only ever lands on a value the draft already holds.
  useEffect(() => {
    setDraft(q)
  }, [q])

  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null)

  const enabledSourceIds = useMemo(() => parseEnabledSources(sources), [sources])
  const { ids: configuredSourceIds, isPending: isConfigPending } = useConfiguredSources()

  const {
    artworks,
    sourceStatuses,
    activeSources,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useArtworkSearch(q, enabledSourceIds, configuredSourceIds, isConfigPending)

  const toggleSource = useCallback(
    (id: SourceId) => {
      const next = new Set(enabledSourceIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      void navigate({
        search: (prev) => ({ ...prev, sources: serializeEnabledSources(next) }),
        replace: true,
      })
    },
    [enabledSourceIds, navigate],
  )

  const canLoadMore = useMemo(
    () => Boolean(hasNextPage) && !isFetchingNextPage,
    [hasNextPage, isFetchingNextPage],
  )

  // Stable identity: an inline arrow here made the sentinel's
  // IntersectionObserver rebuild on every render, which re-fired it and
  // spun up a fetch loop. See useInfiniteScrollSentinel.
  const handleLoadMore = useCallback(() => {
    void fetchNextPage()
  }, [fetchNextPage])

  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.heading}>Art References</h1>
        <p className={styles.subheading}>
          Come and see real artworks from museums and galleries around the world. Useful for
          artists, designers, and anyone looking for inspiration from real masters and
          unambiguously not AI.
        </p>
        <SearchBar value={draft} onChange={setDraft} />
        <SourceFilter
          enabledSourceIds={enabledSourceIds}
          configuredSourceIds={configuredSourceIds}
          onToggle={toggleSource}
        />
        <SourceStatusBar activeSources={activeSources} statuses={sourceStatuses} />
      </header>

      <main>
        {isLoading && <p className={styles.loading}>Loading artwork...</p>}
        {!isLoading && artworks.length === 0 && (
          <p className={styles.loading}>
            No results. Try a different search or enable more museums.
          </p>
        )}
        <MasonryWall
          artworks={artworks}
          onOpen={setSelectedArtwork}
          onLoadMore={handleLoadMore}
          canLoadMore={canLoadMore}
        />
        {isFetchingNextPage && <p className={styles.loading}>Loading more...</p>}
      </main>

      {selectedArtwork && (
        <Lightbox artwork={selectedArtwork} onClose={() => setSelectedArtwork(null)} />
      )}
    </>
  )
}
