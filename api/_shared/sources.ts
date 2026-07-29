/**
 * Server-side registry for the three museum APIs that require a key.
 *
 * These keys must never reach the browser (Harvard's in particular is
 * human-approved, non-commercial-only and capped at 2500 requests/day), so the
 * client calls `/api/museum?source=<id>` instead of the museum directly and
 * this module is the only place a key is ever read.
 *
 * Shared by the deployed functions (`api/museum.ts`, `api/config.ts`) and by
 * the dev-only middleware in `vite.config.ts`, so `npm run dev` and production
 * build byte-identical upstream URLs. Files under a `_`-prefixed directory are
 * not deployed as routes.
 */

export const KEYED_SOURCE_IDS = ['smithsonian', 'harvard', 'europeana'] as const

export type KeyedSourceId = (typeof KEYED_SOURCE_IDS)[number]

export type Env = Record<string, string | undefined>

interface KeyedSourceConfig {
  /** Hard-coded upstream endpoint. Never derived from request input. */
  endpoint: string
  /** Query param this museum expects its key in — all three differ. */
  keyParam: string
  envVar: string
  /** Only these params are forwarded upstream; everything else is dropped. */
  allowedParams: readonly string[]
}

export const KEYED_SOURCES: Record<KeyedSourceId, KeyedSourceConfig> = {
  smithsonian: {
    endpoint: 'https://api.si.edu/openaccess/api/v1.0/search',
    keyParam: 'api_key',
    envVar: 'SMITHSONIAN_API_KEY',
    allowedParams: ['q', 'rows', 'start'],
  },
  harvard: {
    endpoint: 'https://api.harvardartmuseums.org/object',
    keyParam: 'apikey',
    envVar: 'HARVARD_API_KEY',
    allowedParams: ['q', 'size', 'page', 'hasimage'],
  },
  europeana: {
    endpoint: 'https://api.europeana.eu/record/v2/search.json',
    keyParam: 'wskey',
    envVar: 'EUROPEANA_API_KEY',
    allowedParams: ['query', 'rows', 'start', 'reusability', 'media', 'profile'],
  },
}

export function isKeyedSourceId(value: string | null | undefined): value is KeyedSourceId {
  return typeof value === 'string' && (KEYED_SOURCE_IDS as readonly string[]).includes(value)
}

export function getKey(id: KeyedSourceId, env: Env): string | undefined {
  return env[KEYED_SOURCES[id].envVar] || undefined
}

/**
 * Which keyed sources actually have a key here — the entire `/api/config`
 * payload. Deliberately returns ids only, never a key or its length.
 */
export function configuredSourceIds(env: Env): KeyedSourceId[] {
  return KEYED_SOURCE_IDS.filter((id) => Boolean(getKey(id, env)))
}

/**
 * Build the upstream URL from the hard-coded endpoint plus an allowlisted
 * subset of the caller's params. Nothing in the request can influence the
 * host, so this cannot be turned into an open proxy.
 */
export function buildUpstreamUrl(
  id: KeyedSourceId,
  incoming: URLSearchParams,
  key: string,
): string {
  const config = KEYED_SOURCES[id]
  const params = new URLSearchParams()
  for (const name of config.allowedParams) {
    const value = incoming.get(name)
    if (value !== null) params.set(name, value)
  }
  params.set(config.keyParam, key)
  return `${config.endpoint}?${params}`
}
