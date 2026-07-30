import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { AccountMenu } from '../AccountMenu/AccountMenu'
import { CollectionIcon, HomeIcon } from '../icons/Icons'
import { useSession } from '../../hooks/useSession'
import { useLastBrowseSearch } from '../../hooks/useLastBrowseSearch'
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

  return (
    <nav className={styles.nav} aria-label="Main">
      <ul className={styles.items}>
        <li>
          {/* Carries the wall's last query back with it, so returning from
              /lists lands on the URL you left — the same results, under the
              same scroll-restoration key, so you keep your place.

              includeSearch: false is what keeps the icon lit while a query is
              active: TanStack compares search params for active state by
              default, and there's a beat on first paint before the remembered
              params catch up with the URL. */}
          <NavItem
            to="/"
            search={browseSearch}
            activeOptions={{ includeSearch: false }}
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
}

function NavItem({ to, label, children, search, activeOptions }: NavItemProps) {
  return (
    <Link
      to={to}
      search={search}
      activeOptions={activeOptions}
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
