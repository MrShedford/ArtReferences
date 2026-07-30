import type { MouseEvent, ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { AccountMenu } from '../AccountMenu/AccountMenu'
import { CollectionIcon, HomeIcon } from '../icons/Icons'
import { useSession } from '../../hooks/useSession'
import { useLastBrowseSearch } from '../../hooks/useLastBrowseSearch'
import { rollBrowseSeed } from '../../hooks/useBrowseSeed'
import type { SearchParams } from '../../router'
import styles from './AppNav.module.scss'

/**
 * The app's only persistent chrome. One component, two layouts: a vertical
 * icon rail from $bp-md up, a fixed bottom tab bar below it. The switch is
 * pure CSS — a JS breakpoint here would be a second table to hand-sync
 * against $bp-*, and useColumnCount already carries that burden once.
 *
 * The search box and the museum filters are deliberately not here: they belong
 * to the browse route and unmount when you leave it.
 */
export function AppNav() {
  const { isSignedIn } = useSession()
  const browseSearch = useLastBrowseSearch()
  const location = useRouterState({ select: (state) => state.location })

  // Read straight off the location rather than off the remembered breadcrumb:
  // while you're on the wall the two agree, but the breadcrumb lags the URL by
  // an effect, and the whole question here is what the URL says *right now*.
  const isOnBrowse = location.pathname === '/'
  const currentBrowseSearch = isOnBrowse ? (location.search as SearchParams) : undefined
  const hasQuery = Boolean(currentBrowseSearch?.q)

  /**
   * Home means three different things depending on where you are:
   *
   * - From /lists, it carries the wall's last query back with it, so you land
   *   on the URL you left — the same results under the same scroll-restoration
   *   key, so you keep your place.
   * - Mid-search, it clears the query and drops you back into browsing. The
   *   filters survive: which museums and what kind of work you're looking at
   *   are settings, not part of the search you're backing out of.
   * - Already browsing, there's nothing to navigate to, so it refreshes
   *   instead — see handleHomeClick.
   */
  const homeSearch: SearchParams = isOnBrowse
    ? { ...currentBrowseSearch, q: undefined }
    : browseSearch

  const handleHomeClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Leave modified clicks to the browser: cmd/ctrl-click opens a new tab, and
    // a fresh wall in *this* one isn't what was asked for.
    if (event.defaultPrevented || event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    // Anywhere else the href is a real destination; let the Link do its job.
    if (!isOnBrowse || hasQuery) return

    event.preventDefault()
    // A new seed is a new wall — new lead museum, new browse terms, new depth.
    rollBrowseSeed()
    // The URL doesn't change, so the router won't scroll for us, and a refresh
    // that leaves you halfway down a wall you've never seen isn't one.
    window.scrollTo({ top: 0 })
  }

  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.items}>
        <li>
          {/* includeSearch: false is what keeps the icon lit while a query is
              active: TanStack compares search params for active state by
              default, and the target search deliberately differs from the URL
              whenever there's something for Home to clear. */}
          <NavItem
            to="/"
            search={homeSearch}
            activeOptions={{ includeSearch: false }}
            onClick={handleHomeClick}
            label="Home"
          >
            <HomeIcon />
          </NavItem>
        </li>

        {isSignedIn && (
          <li>
            <NavItem to="/lists" label="Lists">
              <CollectionIcon />
            </NavItem>
          </li>
        )}
      </ul>

      <div className={styles.account}>
        <AccountMenu />
      </div>
    </nav>
  )
}

interface NavItemProps {
  to: '/' | '/lists'
  label: string
  children: ReactNode
  search?: SearchParams
  activeOptions?: { includeSearch: boolean }
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

function NavItem({ to, label, children, search, activeOptions, onClick }: NavItemProps) {
  return (
    <Link
      to={to}
      search={search}
      activeOptions={activeOptions}
      onClick={onClick}
      className={styles.navItem}
      activeProps={{ 'data-active': true }}
      // The label span is the visible caption on mobile and the tooltip on
      // desktop; either way it's decorative, so the name lives here.
      aria-label={label}
    >
      {children}
      <span className={styles.navLabel} aria-hidden="true">
        {label}
      </span>
    </Link>
  )
}
