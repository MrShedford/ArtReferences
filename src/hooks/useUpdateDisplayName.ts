import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SessionUser } from '../types/user'
import { userApi } from '../lib/userApi'

interface MeResponse {
  user: SessionUser | null
}

/**
 * Optimistic, because the name shows in the nav and a round trip's worth of
 * lag on your own typing reads as the save having failed.
 */
export function useUpdateDisplayName() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (displayName: string | null) =>
      userApi<MeResponse>('/api/user/me', { method: 'PATCH', body: { displayName } }),

    onMutate: async (displayName) => {
      await queryClient.cancelQueries({ queryKey: ['session'] })
      const previous = queryClient.getQueryData<MeResponse>(['session'])

      queryClient.setQueryData<MeResponse>(['session'], (old) =>
        old?.user ? { user: { ...old.user, displayName } } : old,
      )

      return { previous }
    },

    onError: (_error, _displayName, context) => {
      if (context?.previous) queryClient.setQueryData(['session'], context.previous)
    },

    // Trust the server's normalized value (trimmed, control chars stripped)
    // rather than the raw string we sent.
    onSuccess: (data) => queryClient.setQueryData(['session'], data),
  })
}
