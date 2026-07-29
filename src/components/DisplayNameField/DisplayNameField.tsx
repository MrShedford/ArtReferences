import { useEffect, useRef, useState } from 'react'
import { useSession } from '../../hooks/useSession'
import { useUpdateDisplayName } from '../../hooks/useUpdateDisplayName'
import { UserApiError } from '../../lib/userApi'
import styles from './DisplayNameField.module.scss'

/** Mirrors the server's cap. The server re-checks — this is only an affordance. */
const MAX_DISPLAY_NAME = 50

/**
 * Read -> edit -> save, inline.
 *
 * Deliberately not inside AccountMenu: a text input within a role="menu" is an
 * a11y problem — menus expect menuitem children and arrow-key navigation, and
 * a typing target inside one traps screen readers. /lists is already the
 * "your account" surface, so it lives there.
 */
export function DisplayNameField() {
  const { user, isPending, label } = useSession()
  const update = useUpdateDisplayName()
  const inputRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Escape hides the input, and removing a focused node can fire blur — which
  // would run commit() and save the very edit we just cancelled. This says
  // "the next commit isn't wanted" rather than relying on event ordering.
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  if (isPending || !user) {
    return <span className={styles.skeleton} aria-hidden="true" />
  }

  const startEditing = () => {
    setDraft(user.displayName ?? '')
    setError(null)
    cancelledRef.current = false
    setEditing(true)
  }

  const cancel = () => {
    cancelledRef.current = true
    setEditing(false)
    setError(null)
  }

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false
      return
    }

    const trimmed = draft.trim()

    if ([...trimmed].length > MAX_DISPLAY_NAME) {
      setError(`Must be ${MAX_DISPLAY_NAME} characters or fewer.`)
      return
    }

    // Empty means "use my Google name" — null, not ''.
    const next = trimmed.length === 0 ? null : trimmed
    if (next === (user.displayName ?? null)) {
      setEditing(false)
      return
    }

    setEditing(false)
    update.mutate(next, {
      onError: (mutationError) => {
        setError(
          mutationError instanceof UserApiError
            ? mutationError.message
            : "Couldn't save that name.",
        )
        setEditing(true)
      },
    })
  }

  if (!editing) {
    return (
      <div className={styles.field}>
        <span className={styles.name}>{label}</span>
        <button type="button" className={styles.edit} onClick={startEditing}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.icon}>
            <path
              d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          Edit name
        </button>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    )
  }

  return (
    <div className={styles.field}>
      <input
        ref={inputRef}
        className={styles.input}
        value={draft}
        maxLength={200}
        aria-label="Display name"
        aria-invalid={error !== null}
        placeholder={user.name ?? user.email}
        onChange={(event) => {
          setDraft(event.target.value)
          setError(null)
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            cancel()
          }
        }}
      />
      <span className={styles.hint}>
        {error ?? 'Enter to save, Escape to cancel. Leave blank to use your Google name.'}
      </span>
    </div>
  )
}
