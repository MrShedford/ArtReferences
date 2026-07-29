/**
 * Everything behind a signed-in user: session, profile, lists, saved items.
 *
 * DELIBERATELY SELF-CONTAINED — no relative imports, for the same reason
 * api/museum.ts has none. Vercel runs this under Node ESM ("type": "module"),
 * and a relative specifier crashed the deployed function with
 * FUNCTION_INVOCATION_FAILED even with an explicit .ts extension (d26bf67,
 * then c8d2736). Bare specifiers from node_modules are a different resolution
 * path and are fine — that's how @neondatabase/serverless gets in here.
 *
 * That constraint is why this is ONE file rather than four. Every endpoint
 * needs the same db()/readSession()/jsonError() helpers, and ~120 lines of
 * crypto duplicated four ways is well past the point where duplication beats
 * an import. One file means there is nothing to share, so nothing to resolve.
 */

import { neon } from '@neondatabase/serverless'

// ─────────────────────────────────────────────────────────────── database ───

/**
 * Lazy on purpose: neon('') throws, and a throw at module scope is exactly the
 * FUNCTION_INVOCATION_FAILED this file is shaped to avoid. Unconfigured
 * deployments return 503 instead, matching how api/museum.ts handles a
 * missing key.
 */
let cachedSql: ReturnType<typeof neon> | null = null

function db(): ReturnType<typeof neon> | null {
  const url = process.env.DATABASE_URL
  if (!url) return null
  cachedSql ??= neon(url)
  return cachedSql
}

// ────────────────────────────────────────────────────────────── responses ───

function json(body: unknown, status = 200, extraHeaders: [string, string][] = []): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    // Never edge-cached: unlike api/config.ts, every response here is per-user.
    'Cache-Control': 'no-store',
    Vary: 'Cookie',
  })
  for (const [name, value] of extraHeaders) headers.append(name, value)
  return new Response(JSON.stringify(body), { status, headers })
}

function jsonError(message: string, status: number): Response {
  return json({ error: message }, status)
}

// ─────────────────────────────────────────────────────────────── dispatch ───

export function GET(request: Request): Promise<Response> {
  return route('GET', request)
}
export function POST(request: Request): Promise<Response> {
  return route('POST', request)
}
export function PATCH(request: Request): Promise<Response> {
  return route('PATCH', request)
}
export function DELETE(request: Request): Promise<Response> {
  return route('DELETE', request)
}

async function route(method: string, request: Request): Promise<Response> {
  const segments = new URL(request.url).pathname
    .replace(/^\/api\/user\/?/, '')
    .split('/')
    .filter(Boolean)

  // Deliberately above the config gate: this is the health check that reports
  // whether the gate would pass, so it has to answer on an unconfigured
  // deployment too.
  if (method === 'GET' && segments.length === 1 && segments[0] === 'ping') {
    return json({ ok: true, hasDb: Boolean(process.env.DATABASE_URL) })
  }

  // TEMPORARY — proves the dev middleware round-trips method, body and cookies.
  // Removed at the end of Phase 2.
  if (segments.length === 1 && segments[0] === 'echo') {
    return json(
      {
        method,
        body: await request.text(),
        cookie: request.headers.get('cookie'),
      },
      200,
      [
        ['Set-Cookie', 'first=1; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT'],
        ['Set-Cookie', 'second=2; Path=/; HttpOnly'],
      ],
    )
  }

  if (!db()) {
    return jsonError('Accounts are not configured here — set DATABASE_URL.', 503)
  }

  return jsonError('Not found', 404)
}
