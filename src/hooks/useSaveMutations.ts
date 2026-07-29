import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Artwork } from '../types/artwork'
import { userApi } from '../lib/userApi'
import { useSession } from './useSession'

/** uid -> every list id it's saved to. */
export type SavedMap = Record<string, number[]>

interface SavedResponse {
  saved: SavedMap
  truncated: boolean
}

const EMPTY: SavedMap = {}

/**
 * The whole account's saved state, in one request.
 *
 * The wall renders 100+ cards, each needing to know whether it's saved. This
 * is what keeps that at one request per session instead of one per card —
 * every SaveButton reads the same cache entry.
 */
export function useSavedMap() {
  const { isSignedIn } = useSession()

  const { data } = useQuery<SavedResponse>({
    queryKey: ['saved-map'],
    queryFn: ({ signal }) => userApi<SavedResponse>('/api/user/saved', { signal }),
    enabled: isSignedIn,
    staleTime: 60 * 1000,
  })

  return useMemo(() => data?.saved ?? EMPTY, [data])
}

interface ToggleArgs {
  artwork: Artwork
  /** Numeric id, or 'default' when the default list's id isn't known yet. */
  listId: number | 'default'
  /** True if it's currently in that list, i.e. this click removes it. */
  isSaved: boolean
}

export function useToggleSave() {
  const queryClient = useQueryClient()

  return useMutation({
    // Async so both branches share one return type — otherwise the union of
    // Promise<void> and Promise<{uid}> also breaks onMutate's context inference.
    mutationFn: async ({ artwork, listId, isSaved }: ToggleArgs): Promise<void> => {
      if (isSaved) {
        await userApi<void>(`/api/user/lists/${listId}/items/${encodeURIComponent(artwork.uid)}`, {
          method: 'DELETE',
        })
        return
      }
      // Stripped client-side as well as server-side: it's a 1-2 KB base64 blob
      // on AIC results and there's no reason to put it on the wire.
      const { blurDataUrl: _blurDataUrl, ...rest } = artwork
      await userApi<{ uid: string }>(`/api/user/lists/${listId}/items`, {
        method: 'POST',
        body: { artwork: rest },
      })
    },

    onMutate: async ({ artwork, listId, isSaved }) => {
      await queryClient.cancelQueries({ queryKey: ['saved-map'] })
      const previous = queryClient.getQueryData<SavedResponse>(['saved-map'])

      queryClient.setQueryData<SavedResponse>(['saved-map'], (old) => {
        const saved = { ...(old?.saved ?? {}) }
        const current = saved[artwork.uid] ?? []

        if (isSaved && typeof listId === 'number') {
          const kept = current.filter((id) => id !== listId)
          if (kept.length === 0) delete saved[artwork.uid]
          else saved[artwork.uid] = kept
        } else if (!isSaved && typeof listId === 'number') {
          if (!current.includes(listId)) saved[artwork.uid] = [...current, listId]
        }
        // A 'default' target can't be written optimistically — we don't know
        // which id it resolves to. onSettled refetches and fills it in.

        return { saved, truncated: old?.truncated ?? false }
      })

      return { previous }
    },

    onError: (_error, _args, context) => {
      if (context?.previous) queryClient.setQueryData(['saved-map'], context.previous)
    },

    onSettled: (_data, _error, { listId }) => {
      void queryClient.invalidateQueries({ queryKey: ['saved-map'] })
      // Item counts shown next to each list name.
      void queryClient.invalidateQueries({ queryKey: ['lists'] })
      if (typeof listId === 'number') {
        void queryClient.invalidateQueries({ queryKey: ['list-items', listId] })
      } else {
        void queryClient.invalidateQueries({ queryKey: ['list-items'] })
      }
    },
  })
}
