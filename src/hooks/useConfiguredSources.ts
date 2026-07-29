import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { SourceId } from '../types/artwork'

interface ConfigResponse {
  configured: SourceId[]
}

const EMPTY: Set<SourceId> = new Set()

/**
 * Which key-gated museums this deployment can actually serve.
 *
 * The keys live in server-side env vars and are never sent to the browser, so
 * the client has to ask. The answer can only change on a redeploy, hence the
 * effectively-infinite staleTime and no retry-on-focus.
 *
 * A failed or in-flight request resolves to "none configured", which is the
 * safe default: those sources render disabled and the seven keyless ones keep
 * working, exactly as when no keys are set at all.
 */
export function useConfiguredSources(): Set<SourceId> {
  const { data } = useQuery<ConfigResponse>({
    queryKey: ['source-config'],
    queryFn: async ({ signal }) => {
      const res = await fetch('/api/config', { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status} from /api/config`)
      return (await res.json()) as ConfigResponse
    },
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
  })

  return useMemo(() => (data ? new Set(data.configured) : EMPTY), [data])
}
