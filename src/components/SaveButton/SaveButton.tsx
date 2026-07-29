import { useCallback, useRef, useState } from 'react'
import type { Artwork } from '../../types/artwork'
import { useSession } from '../../hooks/useSession'
import { useCreateList, useLists } from '../../hooks/useLists'
import { useSavedMap, useToggleSave } from '../../hooks/useSaveMutations'
import { useDismissable } from '../../hooks/useDismissable'
import styles from './SaveButton.module.scss'

interface SaveButtonProps {
  artwork: Artwork
}

/**
 * Split control: save to the default list, or pick a list from the chevron.
 *
 * Renders nothing when signed out, so the wall stays exactly as it was for
 * anonymous visitors.
 */
export function SaveButton({ artwork }: SaveButtonProps) {
  const { isSignedIn } = useSession()
  const { lists, defaultListId } = useLists()
  const savedMap = useSavedMap()
  const toggleSave = useToggleSave()
  const createList = useCreateList()

  const [open, setOpen] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newListName, setNewListName] = useState('')
  const triggerRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    setCreating(false)
    setNewListName('')
  }, [])
  const containerRef = useDismissable<HTMLDivElement>(open, close)

  if (!isSignedIn) return null

  const savedIn = savedMap[artwork.uid] ?? []
  const isSaved = savedIn.length > 0

  const openMenu = () => {
    // Flip upward near the viewport bottom so the menu doesn't open offscreen.
    const rect = triggerRef.current?.getBoundingClientRect()
    if (rect) setDropUp(window.innerHeight - rect.bottom < 260)
    setOpen(true)
  }

  const handlePrimaryClick = () => {
    // In more than one list, a single click would have to guess which to
    // remove from — open the menu instead of destroying curated state.
    if (savedIn.length > 1) {
      openMenu()
      return
    }

    if (savedIn.length === 1) {
      toggleSave.mutate({ artwork, listId: savedIn[0], isSaved: true })
      return
    }

    // 'default' is resolved server-side; only needed before ['lists'] loads.
    toggleSave.mutate({ artwork, listId: defaultListId ?? 'default', isSaved: false })
  }

  const submitNewList = (event: React.FormEvent) => {
    event.preventDefault()
    const name = newListName.trim()
    if (name.length === 0) return

    createList.mutate(name, {
      onSuccess: (data) => {
        toggleSave.mutate({ artwork, listId: data.list.id, isSaved: false })
        close()
      },
    })
  }

  return (
    <div className={styles.container} ref={containerRef} data-open={open}>
      <div className={styles.group} ref={triggerRef}>
        <button
          type="button"
          className={styles.save}
          data-saved={isSaved}
          onClick={handlePrimaryClick}
          aria-pressed={isSaved}
          aria-label={isSaved ? `Saved — remove ${artwork.title}` : `Save ${artwork.title}`}
          title={isSaved ? 'Saved' : 'Save'}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
            <path
              d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z"
              fill={isSaved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          className={styles.chevron}
          onClick={() => (open ? close() : openMenu())}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Save ${artwork.title} to a specific list`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
            <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </div>

      {open && (
        <div className={styles.menu} role="menu" data-drop={dropUp ? 'up' : 'down'}>
          {lists.map((list) => {
            const inList = savedIn.includes(list.id)
            return (
              <button
                key={list.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={inList}
                className={styles.item}
                onClick={() => {
                  toggleSave.mutate({ artwork, listId: list.id, isSaved: inList })
                  close()
                }}
              >
                <span className={styles.check} aria-hidden="true">
                  {inList ? '✓' : ''}
                </span>
                <span className={styles.itemName}>{list.name}</span>
              </button>
            )
          })}

          <div className={styles.separator} role="none" />

          {creating ? (
            <form onSubmit={submitNewList} className={styles.createForm}>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus -- the user
                  explicitly chose "New list"; focus belongs here. */}
              <input
                autoFocus
                className={styles.createInput}
                value={newListName}
                onChange={(event) => setNewListName(event.target.value)}
                placeholder="List name"
                aria-label="New list name"
                maxLength={60}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setCreating(false)
                  }
                }}
              />
              <button type="submit" className={styles.createSubmit} disabled={createList.isPending}>
                {createList.isPending ? '...' : 'Add'}
              </button>
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              className={styles.item}
              onClick={() => setCreating(true)}
            >
              <span className={styles.check} aria-hidden="true">
                +
              </span>
              <span className={styles.itemName}>New list...</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
