/**
 * Loads Google Identity Services on demand.
 *
 * Injected when a sign-in button first mounts rather than from index.html, so
 * neither anonymous visitors nor already-signed-in ones pay for the script on
 * every page load.
 */

export interface GoogleCredentialResponse {
  credential: string
}

export interface GoogleIdApi {
  initialize(config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }): void
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void
  /** Stops One Tap re-selecting the account we just signed out of. */
  disableAutoSelect(): void
  cancel(): void
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

/**
 * Module scope, not a ref: React 19's StrictMode invokes effects twice, and a
 * per-instance ref wouldn't stop the second pass injecting a second <script>.
 * Sharing the in-flight promise makes concurrent mounts free.
 */
let loader: Promise<GoogleIdApi> | null = null

export function loadGoogleIdentity(): Promise<GoogleIdApi> {
  loader ??= new Promise<GoogleIdApi>((resolve, reject) => {
    const existing = window.google?.accounts.id
    if (existing) {
      resolve(existing)
      return
    }

    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => {
      const api = window.google?.accounts.id
      if (api) resolve(api)
      else reject(new Error('Google Identity Services loaded without accounts.id'))
    }
    script.onerror = () => {
      // Clear the cache so a later mount can retry — a failed load is usually
      // a blocked request or an offline tab, both of which recover.
      loader = null
      reject(new Error('Failed to load Google Identity Services'))
    }
    document.head.appendChild(script)
  })

  return loader
}
