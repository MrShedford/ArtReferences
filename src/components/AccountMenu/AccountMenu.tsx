import { useCallback, useState } from 'react'
import { useSession } from '../../hooks/useSession'
import { useDismissable } from '../../hooks/useDismissable'
import { GoogleSignInButton } from '../GoogleSignInButton/GoogleSignInButton'
import { SignInIcon } from '../icons/Icons'
import styles from './AccountMenu.module.scss'

/**
 * The signed-out half of the nav's account slot, and only that — once you're
 * signed in AppNav puts a link to /profile here instead, which is where the
 * avatar, your name and Sign out all live now.
 *
 * It's a popover rather than a link because Google's button is a fixed-size
 * iframe that can't be squeezed into a 4rem rail; a rail-width person outline
 * opens it. Rendering it inline was the alternative, and it doesn't fit.
 */
export function AccountMenu() {
  const { isPending } = useSession()
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])
  const containerRef = useDismissable<HTMLDivElement>(open, close)

  // A skeleton, not a spinner: same footprint as the real control, so a cold
  // database (Neon autosuspends) doesn't shift the nav when it resolves. This
  // covers the loading case for the whole slot — AppNav treats "still pending"
  // as signed out, so it renders us rather than the profile link.
  if (isPending) {
    return <div className={styles.skeleton} aria-hidden="true" />
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <button
        type="button"
        className={styles.navItem}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // The caption below is decorative — this is what names the control.
        aria-label="Sign in"
      >
        <SignInIcon />
        {/* A caption on the tab bar and a tooltip on the rail, same as the nav
            links either side of it. */}
        <span className={styles.navLabel} aria-hidden="true">
          Sign in
        </span>
      </button>

      {/* Not role="menu": the only thing in here is Google's iframe button, and
          a menu with no menuitem children lies to a screen reader about what
          it's going to find. */}
      {open && (
        <div className={styles.menu}>
          <GoogleSignInButton />
        </div>
      )}
    </div>
  )
}
