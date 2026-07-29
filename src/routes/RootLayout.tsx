import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AccountMenu } from '../components/AccountMenu/AccountMenu'
import { useSession } from '../hooks/useSession'
import styles from './RootLayout.module.scss'

/**
 * The one persistent chrome across routes: wordmark, nav, account control.
 * Everything else — the search box, the museum filters, the status bar —
 * belongs to the search page and unmounts when you leave it.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  const { isSignedIn } = useSession()

  return (
    <div className={styles.app}>
      <nav className={styles.nav} aria-label="Main">
        {/* Deliberately drops the search params: this is "start over", and
            Back still restores the previous query. */}
        <Link to="/" className={styles.wordmark} search={{}}>
          Art References
        </Link>

        {isSignedIn && (
          <Link to="/lists" className={styles.navLink} activeProps={{ 'data-active': true }}>
            My lists
          </Link>
        )}

        <div className={styles.spacer} />
        <AccountMenu />
      </nav>

      {children}
    </div>
  )
}
