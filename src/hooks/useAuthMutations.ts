import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SessionUser } from '../types/user'
import { userApi } from '../lib/userApi'
import { loadGoogleIdentity } from '../lib/loadGoogleIdentity'

/** Everything a signed-in session puts in the cache, cleared together. */
const USER_SCOPED_KEYS = [['session'], ['lists'], ['saved-map']] as const

export function useSignIn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (credential: string) =>
      userApi<{ user: SessionUser }>('/api/user/session', {
        method: 'POST',
        body: { credential },
      }),
    onSuccess: (data) => {
      // Seed rather than invalidate: the response already carries the user, so
      // this avoids a round trip to /me right after the one to /session.
      queryClient.setQueryData(['session'], { user: data.user })
      void queryClient.invalidateQueries({ queryKey: ['lists'] })
      void queryClient.invalidateQueries({ queryKey: ['saved-map'] })
    },
  })
}

export function useSignOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      await userApi<void>('/api/user/session', { method: 'DELETE' })
      // Without this, One Tap silently re-authenticates on the next page load
      // and signing out appears not to have worked.
      try {
        const api = await loadGoogleIdentity()
        api.disableAutoSelect()
      } catch {
        // The script failing to load doesn't invalidate the sign-out itself.
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['session'], { user: null })
      // Targeted removal, not queryClient.clear(): clearing would also evict
      // the artworks cache and blank the wall behind them.
      for (const key of USER_SCOPED_KEYS) {
        if (key[0] !== 'session') queryClient.removeQueries({ queryKey: key })
      }
      queryClient.removeQueries({ queryKey: ['list-items'] })
    },
  })
}
