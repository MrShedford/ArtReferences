import { useEffect, useRef, useState } from 'react'
import { loadGoogleIdentity } from '../../lib/loadGoogleIdentity'
import { useSignIn } from '../../hooks/useAuthMutations'
import styles from './GoogleSignInButton.module.scss'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export function GoogleSignInButton() {
  const containerRef = useRef<HTMLDivElement>(null)
  const signIn = useSignIn()
  const [loadError, setLoadError] = useState(false)

  // The mutation object is a new identity every render, so depending on it
  // would re-run this effect constantly and re-render the button each time.
  const signInRef = useRef(signIn)
  signInRef.current = signIn

  useEffect(() => {
    const container = containerRef.current
    if (!container || !CLIENT_ID) return

    let cancelled = false

    void loadGoogleIdentity()
      .then((api) => {
        if (cancelled) return

        api.initialize({
          client_id: CLIENT_ID,
          callback: (response) => signInRef.current.mutate(response.credential),
          // One Tap is deliberately never prompted, but auto_select also
          // governs the rendered button's account picker — off means always
          // ask, which is the honest behaviour on a shared machine.
          auto_select: false,
        })

        // renderButton APPENDS. StrictMode runs this effect twice, so without
        // clearing first the second pass stacks a second button on the first.
        container.replaceChildren()
        api.renderButton(container, {
          // The button is a cross-origin iframe and cannot be CSS-styled;
          // filled_black is the only variant that reads correctly against
          // $color-bg-elevated.
          theme: 'filled_black',
          size: 'medium',
          shape: 'pill',
          text: 'signin_with',
          logo_alignment: 'left',
        })
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })

    return () => {
      cancelled = true
      container.replaceChildren()
    }
  }, [])

  if (!CLIENT_ID) {
    return (
      <p className={styles.unavailable} title="Set VITE_GOOGLE_CLIENT_ID — see .env.example">
        Sign-in unavailable
      </p>
    )
  }

  if (loadError) {
    return <p className={styles.unavailable}>Sign-in unavailable</p>
  }

  // The box is sized up front so the nav doesn't reflow when Google's iframe
  // finally paints into it.
  return <div ref={containerRef} className={styles.slot} />
}
