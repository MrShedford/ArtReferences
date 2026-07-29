import { useSession } from '../hooks/useSession'
import styles from './ListsPage.module.scss'

export function ListsPage() {
  const { isSignedIn, isPending } = useSession()

  if (isPending) {
    return <p className={styles.message}>Loading...</p>
  }

  if (!isSignedIn) {
    return <p className={styles.message}>Sign in to create lists and save artworks to them.</p>
  }

  return <p className={styles.message}>Lists coming in the next step.</p>
}
