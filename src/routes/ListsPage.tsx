import { useMemo, useState } from 'react'
import type { Artwork } from '../types/artwork'
import { listsRoute } from '../router'
import { useSession } from '../hooks/useSession'
import { useCreateList, useDeleteList, useListItems, useLists, useRenameList } from '../hooks/useLists'
import { UserApiError } from '../lib/userApi'
import { DisplayNameField } from '../components/DisplayNameField/DisplayNameField'
import { MasonryWall } from '../components/MasonryWall/MasonryWall'
import { Lightbox } from '../components/Lightbox/Lightbox'
import { GoogleSignInButton } from '../components/GoogleSignInButton/GoogleSignInButton'
import styles from './ListsPage.module.scss'

export function ListsPage() {
  const { user, isSignedIn, isPending: isSessionPending } = useSession()
  const { list: selectedFromUrl } = listsRoute.useSearch()
  const navigate = listsRoute.useNavigate()

  const { lists, defaultListId, isPending: areListsPending } = useLists()
  const createList = useCreateList()
  const renameList = useRenameList()
  const deleteList = useDeleteList()

  const [newListName, setNewListName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null)

  // The URL wins when it names a list we actually have; otherwise fall back to
  // the default list, so a stale ?list= from a deleted list doesn't dead-end.
  const activeListId = useMemo(() => {
    if (selectedFromUrl && lists.some((list) => list.id === selectedFromUrl)) {
      return selectedFromUrl
    }
    return defaultListId
  }, [selectedFromUrl, lists, defaultListId])

  const { data: itemsData, isPending: areItemsPending } = useListItems(activeListId)
  const artworks = useMemo(
    () => (itemsData?.items ?? []).map((item) => item.artwork),
    [itemsData],
  )

  const activeList = lists.find((list) => list.id === activeListId) ?? null

  if (isSessionPending) {
    return <p className={styles.message}>Loading...</p>
  }

  if (!isSignedIn || !user) {
    return (
      <div className={styles.signedOut}>
        <h1 className={styles.signedOutHeading}>Your lists</h1>
        <p className={styles.message}>
          Sign in to save artworks from the wall into lists you can come back to.
        </p>
        <GoogleSignInButton />
      </div>
    )
  }

  const submitNewList = (event: React.FormEvent) => {
    event.preventDefault()
    const name = newListName.trim()
    if (name.length === 0) return

    createList.mutate(name, {
      onSuccess: (data) => {
        setNewListName('')
        setFormError(null)
        void navigate({ search: { list: data.list.id } })
      },
      onError: (error) => {
        setFormError(error instanceof UserApiError ? error.message : "Couldn't create that list.")
      },
    })
  }

  const promptRename = () => {
    if (!activeList) return
    const next = window.prompt('Rename list', activeList.name)
    if (next === null) return
    renameList.mutate(
      { id: activeList.id, name: next },
      {
        onError: (error) => {
          setFormError(error instanceof UserApiError ? error.message : "Couldn't rename that list.")
        },
      },
    )
  }

  const confirmDelete = () => {
    if (!activeList || activeList.isDefault) return
    const confirmed = window.confirm(
      `Delete "${activeList.name}"? The ${activeList.itemCount} artwork${
        activeList.itemCount === 1 ? '' : 's'
      } in it will be removed from your saved items.`,
    )
    if (!confirmed) return

    deleteList.mutate(activeList.id, {
      onSuccess: () => void navigate({ search: {} }),
      onError: (error) => {
        setFormError(error instanceof UserApiError ? error.message : "Couldn't delete that list.")
      },
    })
  }

  return (
    <>
      <header className={styles.header}>
        <div className={styles.profile}>
          {user.pictureUrl ? (
            <img className={styles.avatar} src={user.pictureUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true" />
          )}
          <div>
            <DisplayNameField />
            <p className={styles.email}>{user.email}</p>
          </div>
        </div>

        <div className={styles.listRow} role="group" aria-label="Your lists">
          {areListsPending && <span className={styles.muted}>Loading lists...</span>}
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              className={styles.chip}
              data-active={list.id === activeListId}
              onClick={() => void navigate({ search: { list: list.id } })}
              aria-pressed={list.id === activeListId}
            >
              {list.name}
              <span className={styles.count}>{list.itemCount}</span>
            </button>
          ))}
        </div>

        <form className={styles.newListForm} onSubmit={submitNewList}>
          <input
            className={styles.newListInput}
            value={newListName}
            onChange={(event) => {
              setNewListName(event.target.value)
              setFormError(null)
            }}
            placeholder="New list name"
            aria-label="New list name"
            maxLength={60}
          />
          <button
            type="submit"
            className={styles.newListButton}
            disabled={newListName.trim().length === 0 || createList.isPending}
          >
            {createList.isPending ? 'Creating...' : 'Create list'}
          </button>

          {activeList && (
            <>
              <button type="button" className={styles.secondary} onClick={promptRename}>
                Rename
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={confirmDelete}
                disabled={activeList.isDefault || deleteList.isPending}
                title={
                  activeList.isDefault
                    ? 'The default list can be renamed, but not deleted.'
                    : undefined
                }
              >
                Delete
              </button>
            </>
          )}
        </form>

        {formError && <p className={styles.error}>{formError}</p>}
      </header>

      <main>
        {activeListId !== null && areItemsPending && (
          <p className={styles.message}>Loading saved artworks...</p>
        )}
        {activeListId !== null && !areItemsPending && artworks.length === 0 && (
          <p className={styles.message}>
            Nothing saved here yet. Hit Save on any artwork to add it.
          </p>
        )}
        <MasonryWall
          artworks={artworks}
          onOpen={setSelectedArtwork}
          // Saved lists are fetched whole; there's no next page to request.
          onLoadMore={() => {}}
          canLoadMore={false}
        />
      </main>

      {selectedArtwork && (
        <Lightbox artwork={selectedArtwork} onClose={() => setSelectedArtwork(null)} />
      )}
    </>
  )
}
