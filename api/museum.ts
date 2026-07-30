/**
 * Key-holding proxy for the three museums that require one. The browser never
 * sees a key; it calls /api/museum?source=<id>&<the museum's own params>.
 *
 * DELIBERATELY SELF-CONTAINED — no relative imports. Vercel runs this file
 * under Node ESM ("type": "module" in package.json), and how it resolves a
 * relative specifier depends on whether it bundles, transpiles, or strips
 * types. Importing a sibling module crashed the deployed function with
 * FUNCTION_INVOCATION_FAILED while working fine locally. With no imports to
 * resolve, the loader's behaviour stops mattering. Keep it that way.
 */

type KeyedSourceId = 'smithsonian' | 'harvard' | 'europeana'

interface KeyedSourceConfig {
  /** Hard-coded upstream endpoint. Never derived from request input. */
  endpoint: string
  /** Query param this museum expects its key in — all three differ. */
  keyParam: string
  envVar: string
  /** Only these params are forwarded upstream; everything else is dropped. */
  allowedParams: readonly string[]
}

const SOURCES: Record<KeyedSourceId, KeyedSourceConfig> = {
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
    // `classification` carries the art-type filter — see src/lib/artTypes.ts.
    allowedParams: ['q', 'size', 'page', 'hasimage', 'classification'],
  },
  europeana: {
    endpoint: 'https://api.europeana.eu/record/v2/search.json',
    keyParam: 'wskey',
    envVar: 'EUROPEANA_API_KEY',
    // `qf` carries the art-type filter as proxy_dc_type:<value>. It's a facet
    // expression rather than a bare value, but it still only reaches Europeana
    // — the endpoint stays hard-coded, so this can't redirect the request.
    allowedParams: ['query', 'rows', 'start', 'reusability', 'media', 'profile', 'qf'],
  },
}

const UPSTREAM_TIMEOUT_MS = 10_000

/**
 * Edge-cache identical searches briefly. Keeps repeat queries off Harvard's
 * 2500/day quota, and five minutes is far inside their two-week limit on
 * caching API results.
 */
const CACHE_CONTROL = 's-maxage=300, stale-while-revalidate=600'

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function GET(request: Request): Promise<Response> {
  const searchParams = new URL(request.url).searchParams
  const source = searchParams.get('source')

  if (source === null || !Object.hasOwn(SOURCES, source)) {
    return jsonError(`Unknown source: ${source ?? '(missing)'}`, 400)
  }
  const config = SOURCES[source as KeyedSourceId]

  const key = process.env[config.envVar]
  if (!key) {
    return jsonError(`${source} is not configured here — set ${config.envVar}.`, 503)
  }

  // Build the upstream URL from the hard-coded endpoint plus an allowlisted
  // subset of the caller's params, so nothing in the request can influence
  // the host and this can't be turned into an open proxy.
  const params = new URLSearchParams()
  for (const name of config.allowedParams) {
    const value = searchParams.get(name)
    if (value !== null) params.set(name, value)
  }
  params.set(config.keyParam, key)

  let upstream: Response
  try {
    upstream = await fetch(`${config.endpoint}?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return jsonError(`${source} request failed: ${message}`, 502)
  }

  // Forward the status so the client can distinguish a bad key from a rate
  // limit, but never the body — an upstream auth error can echo the key back.
  if (!upstream.ok) {
    return jsonError(`HTTP ${upstream.status} from ${source}`, upstream.status)
  }

  // Europeana echoes the key straight back on success — as a top-level
  // "apikey" field, and inside every item's `link` URL as ?wskey=... Scrub
  // each occurrence before it reaches the browser, or this proxy would leak
  // exactly what it exists to protect. Done by literal value rather than by
  // field name so it also covers whatever the other two choose to echo.
  const body = (await upstream.text()).split(key).join('REDACTED')

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': CACHE_CONTROL,
    },
  })
}
