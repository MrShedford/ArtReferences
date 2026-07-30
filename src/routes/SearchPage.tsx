import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Artwork, SourceId } from '../types/artwork'
import type { ArtTypeId } from '../lib/artTypes'
import { getSavedSourceSearchParam, parseEnabledSources, saveSourceSearchParam, searchRoute, serializeEnabledSources } from '../router'
import { useArtworkSearch } from '../hooks/useArtworkSearch'
import { useConfiguredSources } from '../hooks/useConfiguredSources'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { SearchBar } from '../components/SearchBar/SearchBar'
import { SourceFilter } from '../components/SourceFilter/SourceFilter'
import { TypeFilter } from '../components/TypeFilter/TypeFilter'
import { MasonryWall } from '../components/MasonryWall/MasonryWall'
import { Lightbox } from '../components/Lightbox/Lightbox'
import styles from './SearchPage.module.scss'

export function SearchPage() {
  const { q = '', sources, type } = searchRoute.useSearch()
  const navigate = searchRoute.useNavigate()

  // One open-menu slot shared by both header dropdowns: they sit side by side,
  // so two independently-open menus would overlap each other.
  const [openFilter, setOpenFilter] = useState<'sources' | 'type' | null>(null)

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
  const hasLoadedSavedSources = useRef(false)

  useEffect(() => {
    if (sources !== undefined || hasLoadedSavedSources.current) return

    const savedSources = getSavedSourceSearchParam()
    if (savedSources === undefined) {
      hasLoadedSavedSources.current = true
      return
    }

    hasLoadedSavedSources.current = true
    void navigate({
      search: (prev) => ({ ...prev, sources: savedSources }),
      replace: true,
    })
  }, [navigate, sources])

  useEffect(() => {
    if (!hasLoadedSavedSources.current) return
    saveSourceSearchParam(sources)
  }, [sources])

  const {
    artworks,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useArtworkSearch(q, enabledSourceIds, configuredSourceIds, isConfigPending, type)

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

  const handleTypeChange = useCallback(
    (next: ArtTypeId | undefined) => {
      void navigate({
        search: (prev) => ({ ...prev, type: next }),
        replace: true,
      })
    },
    [navigate],
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
        Come and see real artworks from museums and galleries around the world. 
          Useful for artists, designers, and anyone looking for inspiration from
          real artworks.
        </p>
        <SearchBar value={draft} onChange={setDraft} />
        <div className={styles.filters}>
          <SourceFilter
            enabledSourceIds={enabledSourceIds}
            configuredSourceIds={configuredSourceIds}
            onToggle={toggleSource}
            open={openFilter === 'sources'}
            onOpenChange={(next) => setOpenFilter(next ? 'sources' : null)}
          />
          <TypeFilter
            value={type}
            onChange={handleTypeChange}
            open={openFilter === 'type'}
            onOpenChange={(next) => setOpenFilter(next ? 'type' : null)}
          />
        </div>
      </header>

      <main>
        {isLoading && (
          <div className={styles.loading} role="status" aria-live="polite">
            <span className={styles.spinner} aria-hidden="true" />
            <span className={styles.loadingLabel}>Loading artwork…</span>
          </div>
        )}
        {!isLoading && artworks.length === 0 && (
          <p className={styles.loading}>
            {type
              ? 'No results. Try a different search, another art type, or enable more museums.'
              : 'No results. Try a different search or enable more museums.'}
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
