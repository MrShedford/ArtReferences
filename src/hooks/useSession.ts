import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SessionUser } from '../types/user'
import { userApi } from '../lib/userApi'

interface MeResponse {
  user: SessionUser | null
}

export interface Session {
  user: SessionUser | null
  isSignedIn: boolean
  isPending: boolean
  /** What to call this person. The one place the fallback chain lives. */
  label: string
}

/**
 * Who's signed in, if anyone.
 *
 * /api/user/me answers 200 { user: null } rather than 401 when signed out, so
 * "not signed in" never lands in React Query's error state — under the global
 * retry: 1 that would cost a second pointless request on every page load.
 */
export function useSession(): Session {
  const { data, isPending } = useQuery<MeResponse>({
    queryKey: ['session'],
    queryFn: ({ signal }) => userApi<MeResponse>('/api/user/me', { signal }),
    staleTime: 5 * 60 * 1000,
    // A failure here means the accounts backend is unreachable or
    // unconfigured; retrying just delays rendering the signed-out UI.
    retry: false,
  })

  return useMemo(() => {
    const user = data?.user ?? null
    return {
      user,
      isSignedIn: user !== null,
      isPending,
      label: user === null ? '' : (user.displayName ?? user.name ?? user.email),
    }
  }, [data, isPending])
}
