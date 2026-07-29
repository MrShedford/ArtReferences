import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Artwork } from '../types/artwork'
import type { List } from '../types/user'
import { userApi } from '../lib/userApi'
import { useSession } from './useSession'

interface ListsResponse {
  lists: List[]
}

export interface SavedItem {
  artwork: Artwork
  savedAt: string
}

const EMPTY_LISTS: List[] = []

export function useLists() {
  const { isSignedIn } = useSession()

  const { data, isPending, isError } = useQuery<ListsResponse>({
    queryKey: ['lists'],
    queryFn: ({ signal }) => userApi<ListsResponse>('/api/user/lists', { signal }),
    // Gated on auth for the same reason useArtworkSearch gates on /api/config:
    // firing before we know would just 401 and burn a retry.
    enabled: isSignedIn,
    staleTime: 60 * 1000,
  })

  return useMemo(() => {
    const lists = data?.lists ?? EMPTY_LISTS
    return {
      lists,
      // The Save button needs this to write optimistic cache entries — the
      // server accepts the literal "default", but the client can't guess which
      // id that resolves to.
      defaultListId: lists.find((list) => list.isDefault)?.id ?? null,
      isPending: isSignedIn && isPending,
      isError,
    }
  }, [data, isPending, isError, isSignedIn])
}

export function useListItems(listId: number | null) {
  return useQuery<{ items: SavedItem[] }>({
    queryKey: ['list-items', listId],
    queryFn: ({ signal }) =>
      userApi<{ items: SavedItem[] }>(`/api/user/lists/${listId}/items`, { signal }),
    enabled: listId !== null,
    staleTime: 60 * 1000,
  })
}

export function useCreateList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      userApi<{ list: List }>('/api/user/lists', { method: 'POST', body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  })
}

export function useRenameList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      userApi<{ list: List }>(`/api/user/lists/${id}`, { method: 'PATCH', body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['lists'] }),
  })
}

export function useDeleteList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => userApi<void>(`/api/user/lists/${id}`, { method: 'DELETE' }),
    onSuccess: (_result, id) => {
      void queryClient.invalidateQueries({ queryKey: ['lists'] })
      // Its items are gone from every card's saved state too.
      void queryClient.invalidateQueries({ queryKey: ['saved-map'] })
      queryClient.removeQueries({ queryKey: ['list-items', id] })
    },
  })
}
