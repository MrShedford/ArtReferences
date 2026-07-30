import type { ReactNode } from 'react'
import { AppNav } from '../components/AppNav/AppNav'
import styles from './RootLayout.module.scss'

/**
 * The app shell: the nav and the column the routes render into. The nav is a
 * left rail on desktop and a bottom tab bar on mobile — see AppNav.
 *
 * Everything else — the search box, the museum filters, the status bar —
 * belongs to the search page and unmounts when you leave it.
 */
export function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.app}>
      {/* First in the DOM so it leads tab order on desktop, where it's also
          first visually. On mobile it's fixed to the bottom of the viewport. */}
      <AppNav />
      <div className={styles.content}>{children}</div>
    </div>
  )
}
