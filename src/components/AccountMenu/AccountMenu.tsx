import { useCallback, useState } from 'react'
import { useSession } from '../../hooks/useSession'
import { useSignOut } from '../../hooks/useAuthMutations'
import { useDismissable } from '../../hooks/useDismissable'
import { GoogleSignInButton } from '../GoogleSignInButton/GoogleSignInButton'
import { SignInIcon } from '../icons/Icons'
import styles from './AccountMenu.module.scss'

/**
 * The account slot at the end of the nav. It's a rail-width icon in both
 * states — avatar when signed in, a person outline when not — because the
 * Google button is a fixed-size iframe that can't be squeezed into 4rem. It
 * gets rendered inside the popover instead.
 */
export function AccountMenu() {
  const { user, isSignedIn, isPending, label } = useSession()
  const signOut = useSignOut()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])
  const containerRef = useDismissable<HTMLDivElement>(open, close)

  // A skeleton, not a spinner: same footprint as the real control, so a cold
  // database (Neon autosuspends) doesn't shift the nav when it resolves.
  if (isPending) {
    return <div className={styles.skeleton} aria-hidden="true" />
  }

  const signedIn = isSignedIn && user !== undefined && user !== null

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.navItem}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="menu"
        aria-expanded={open}
        // The caption below is decorative — "You" is no use to a screen reader
        // when the account it belongs to is the thing worth announcing.
        aria-label={signedIn ? `Account: ${label}` : 'Sign in'}
      >
        {signedIn ? (
          user.pictureUrl ? (
            <img className={styles.avatar} src={user.pictureUrl} alt="" referrerPolicy="no-referrer" />
          ) : (
            <span className={styles.avatarFallback} aria-hidden="true">
              {label.slice(0, 1).toUpperCase()}
            </span>
          )
        ) : (
          <SignInIcon />
        )}
        <span className={styles.navLabel} aria-hidden="true">
          {signedIn ? 'You' : 'Sign in'}
        </span>
      </button>

      {open && (
        <div className={styles.menu} role={signedIn ? 'menu' : undefined}>
          {signedIn ? (
            // "My lists" used to live here too. It's a first-class nav icon
            // sitting a few pixels away now, so repeating it is just noise.
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
          ) : (
            <GoogleSignInButton />
          )}
        </div>
      )}
    </div>
  )
}
