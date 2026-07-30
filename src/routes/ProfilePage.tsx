import { useSession } from '../hooks/useSession'
import { useSignOut } from '../hooks/useAuthMutations'
import { DisplayNameField } from '../components/DisplayNameField/DisplayNameField'
import { GoogleSignInButton } from '../components/GoogleSignInButton/GoogleSignInButton'
import styles from './ProfilePage.module.scss'

/**
 * The account surface. Picture, name, email, sign out — the four things that
 * were previously split between /lists' header and the nav's account popover.
 *
 * The nav only offers this route when you're signed in, but the URL is still
 * typeable and bookmarkable, so the signed-out state is a sign-in prompt rather
 * than a beforeLoad redirect: arriving at the wall having never been told why
 * reads like the page is broken. Signing in *does* move you to the wall — see
 * useSignIn — but by then you've been asked and answered.
 */
export function ProfilePage() {
  const { user, isSignedIn, isPending, label } = useSession()
  const signOut = useSignOut()

  if (isPending) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        <span className={styles.spinner} aria-hidden="true" />
        <span className={styles.loadingLabel}>Loading your profile…</span>
      </div>
    )
  }

  if (!isSignedIn || !user) {
    return (
      <div className={styles.signedOut}>
        <h1 className={styles.signedOutHeading}>Your profile</h1>
        <p className={styles.message}>
          Sign in to set the name you go by and manage your account.
        </p>
        <GoogleSignInButton />
      </div>
    )
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.srOnly}>Your profile</h1>

      {/* Read-only: the picture comes from Google on every sign-in, and there's
          nowhere to upload one. alt="" because the name sits right below it —
          a screen reader announcing the avatar would just say it twice. */}
      {user.pictureUrl ? (
        <img className={styles.avatar} src={user.pictureUrl} alt="" referrerPolicy="no-referrer" />
      ) : (
        <span className={styles.avatarFallback} aria-hidden="true">
          {label.slice(0, 1).toUpperCase()}
        </span>
      )}

      <DisplayNameField />

      <p className={styles.email}>{user.email}</p>

      {/* No redirect on success: useSignOut resets the session cache, so this
          component re-renders into its own signed-out branch and says so. */}
      <button
        type="button"
        className={styles.signOut}
        disabled={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        {signOut.isPending ? 'Signing out...' : 'Sign out'}
      </button>
    </main>
  )
}
