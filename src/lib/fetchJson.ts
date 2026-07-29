import type { SourceId } from '../types/artwork'

/** Typed error carrying which museum source failed, so the UI can name it. */
export class SourceFetchError extends Error {
  sourceId: SourceId
  status?: number

  constructor(sourceId: SourceId, message: string, status?: number) {
    super(message)
    this.name = 'SourceFetchError'
    this.sourceId = sourceId
    this.status = status
  }
}

const DEFAULT_TIMEOUT_MS = 12_000

/**
 * fetch() wrapped with a timeout and a caller-supplied AbortSignal (React Query
 * passes one in on unmount/refetch). Throws SourceFetchError tagged with the
 * source id so a single museum failing never looks like an unlabeled crash.
 */
export async function fetchJson<T>(
  sourceId: SourceId,
  url: string,
  init: RequestInit = {},
  outerSignal?: AbortSignal,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs)

  const onOuterAbort = () => timeoutController.abort()
  outerSignal?.addEventListener('abort', onOuterAbort)

  try {
    const res = await fetch(url, { ...init, signal: timeoutController.signal })
    if (!res.ok) {
      throw new SourceFetchError(sourceId, `HTTP ${res.status} from ${sourceId}`, res.status)
    }
    return (await res.json()) as T
  } catch (err) {
    if (err instanceof SourceFetchError) throw err
    const message = err instanceof Error ? err.message : String(err)
    throw new SourceFetchError(sourceId, `${sourceId} request failed: ${message}`)
  } finally {
    clearTimeout(timer)
    outerSignal?.removeEventListener('abort', onOuterAbort)
  }
}
