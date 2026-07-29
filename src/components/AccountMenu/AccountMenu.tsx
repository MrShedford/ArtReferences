import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useSession } from '../../hooks/useSession'
import { useSignOut } from '../../hooks/useAuthMutations'
import { useDismissable } from '../../hooks/useDismissable'
import { GoogleSignInButton } from '../GoogleSignInButton/GoogleSignInButton'
import styles from './AccountMenu.module.scss'

export function AccountMenu() {
  const { user, isSignedIn, isPending, label } = useSession()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])
  const containerRef = useDismissable<HTMLDivElement>(open, close)

  // A skeleton, not a spinner: same footprint as the signed-in control, so a
  // cold database (Neon autosuspends) doesn't shift the nav when it resolves.
  if (isPending) {
    return <div className={styles.skeleton} aria-hidden="true" />
  }

  if (!isSignedIn || !user) {
    return <GoogleSignInButton />
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.pictureUrl ? (
          <img className={styles.avatar} src={user.pictureUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className={styles.avatarFallback} aria-hidden="true">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className={styles.label}>{label}</span>
      </button>

      {open && (
        <div className={styles.menu} role="menu">
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            onClick={() => {
              close()
              void navigate({ to: '/lists' })
            }}
          >
            My lists
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={signOut.isPending}
            onClick={() => {
              close()
              signOut.mutate()
            }}
          >
            {signOut.isPending ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  )
}
