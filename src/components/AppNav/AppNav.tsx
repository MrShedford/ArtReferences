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
  const { user, isSignedIn, label } = useSession()
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

        {/* In the list rather than beside it: on the tab bar every slot has to
            get an equal share of the width, and one flex container splitting
            evenly between however many slots there are does that for both the
            signed-in three and the signed-out two. Outside the list it was two
            containers splitting 50/50, which bunched the links into the left
            half. The rail pins it back to the bottom — see the md block. */}
        <li className={styles.account}>
          {/* Signed in the slot is a plain link to /profile, not a popover:
              everything that used to be in the menu is a page now, and a
              dropdown holding one item that navigates is just a slower link.
              Signed out it stays AccountMenu, which exists to house Google's
              fixed-size button — that can't be squeezed into a 4rem rail.
              isSignedIn is false while the session is still loading, so
              AccountMenu's skeleton keeps covering that moment. */}
          {isSignedIn ? (
            <NavItem to="/profile" label={label} ariaLabel={`Account: ${label}`} tooltipOnly>
              {user?.pictureUrl ? (
                <img
                  className={styles.avatar}
                  src={user.pictureUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className={styles.avatarFallback} aria-hidden="true">
                  {label.slice(0, 1).toUpperCase()}
                </span>
              )}
            </NavItem>
          ) : (
            <AccountMenu />
          )}
        </li>
      </ul>
    </nav>
  )
}

interface NavItemProps {
  to: '/' | '/lists' | '/profile'
  label: string
  children: ReactNode
  search?: SearchParams
  activeOptions?: { includeSearch: boolean }
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  /**
   * Drop the caption on the tab bar, keep the tooltip on the rail. For the
   * avatar: it's already its own caption, and the account name spelled out
   * under it was noise on a bar where the other slots say one word.
   */
  tooltipOnly?: boolean
  /**
   * Accessible name, when it needs to say more than the caption does. The
   * profile link's tooltip is just your name — enough beside your own avatar,
   * not enough read aloud on its own.
   */
  ariaLabel?: string
}

function NavItem({
  to,
  label,
  children,
  search,
  activeOptions,
  onClick,
  tooltipOnly,
  ariaLabel,
}: NavItemProps) {
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
      aria-label={ariaLabel ?? label}
    >
      {children}
      <span
        className={tooltipOnly ? `${styles.navLabel} ${styles.tooltipOnly}` : styles.navLabel}
        aria-hidden="true"
      >
        {label}
      </span>
    </Link>
  )
}
