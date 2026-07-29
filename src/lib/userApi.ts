/**
 * Thin fetch wrapper for the /api/user endpoints.
 *
 * Not built on lib/fetchJson.ts: that one is museum-specific (it requires a
 * SourceId to tag failures with, and wraps everything in SourceFetchError for
 * the status bar). useConfiguredSources already set the precedent of using
 * bare fetch for app-level calls.
 *
 * No `credentials` option anywhere on purpose — fetch defaults to
 * 'same-origin' and every path here is relative, so the session cookie is
 * sent and Set-Cookie honoured without asking.
 */

export class UserApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'UserApiError'
    this.status = status
  }
}

interface UserApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

export async function userApi<T>(path: string, options: UserApiOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options

  const response = await fetch(path, {
    method,
    signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) {
    // Surface the server's own message where there is one — the list endpoints
    // return usable text for 409s ("You already have a list called ...") that
    // the UI shows inline.
    let message = `HTTP ${response.status} from ${path}`
    try {
      const parsed = (await response.json()) as { error?: unknown }
      if (typeof parsed.error === 'string') message = parsed.error
    } catch {
      // Non-JSON body (a proxy error page, say). Keep the generic message.
    }
    throw new UserApiError(message, response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
