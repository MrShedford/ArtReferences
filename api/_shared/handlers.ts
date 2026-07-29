/**
 * The actual request handling for `/api/museum` and `/api/config`, written
 * against Web-standard `Response` so it runs unchanged in a Vercel function
 * and behind the dev middleware in `vite.config.ts`.
 */

import {
  buildUpstreamUrl,
  configuredSourceIds,
  getKey,
  isKeyedSourceId,
  KEYED_SOURCES,
  type Env,
} from './sources'

const UPSTREAM_TIMEOUT_MS = 10_000

/**
 * Edge-cache identical searches briefly. Keeps repeat queries off Harvard's
 * 2500/day quota, and five minutes is far inside their two-week limit on
 * caching API results.
 */
const SEARCH_CACHE_CONTROL = 's-maxage=300, stale-while-revalidate=600'

function jsonResponse(body: unknown, status: number, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cacheControl,
    },
  })
}

/** Reports which keyed sources have a key configured — ids only, no values. */
export function handleConfigRequest(env: Env): Response {
  return jsonResponse({ configured: configuredSourceIds(env) }, 200, SEARCH_CACHE_CONTROL)
}

export async function handleMuseumRequest(
  searchParams: URLSearchParams,
  env: Env,
): Promise<Response> {
  const source = searchParams.get('source')
  if (!isKeyedSourceId(source)) {
    return jsonResponse({ error: `Unknown source: ${source ?? '(missing)'}` }, 400)
  }

  const key = getKey(source, env)
  if (!key) {
    return jsonResponse(
      {
        error: `${source} is not configured here — set ${KEYED_SOURCES[source].envVar}.`,
      },
      503,
    )
  }

  let upstream: Response
  try {
    upstream = await fetch(buildUpstreamUrl(source, searchParams, key), {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return jsonResponse({ error: `${source} request failed: ${message}` }, 502)
  }

  // Forward the status so the client can distinguish a bad key from a rate
  // limit, but never the body — an upstream auth error can echo the key back.
  if (!upstream.ok) {
    return jsonResponse({ error: `HTTP ${upstream.status} from ${source}` }, upstream.status)
  }

  return new Response(await upstream.text(), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': SEARCH_CACHE_CONTROL,
    },
  })
}
