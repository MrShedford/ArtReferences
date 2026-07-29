/**
 * Everything behind a signed-in user: session, profile, lists, saved items.
 *
 * DELIBERATELY SELF-CONTAINED — no relative imports, for the same reason
 * api/museum.ts has none. Vercel runs this under Node ESM ("type": "module"),
 * and a relative specifier crashed the deployed function with
 * FUNCTION_INVOCATION_FAILED even with an explicit .ts extension (d26bf67,
 * then c8d2736). Bare specifiers from node_modules resolve down a different
 * path and are fine — that's how @neondatabase/serverless gets in here.
 *
 * That constraint is why this is ONE file rather than four. Every endpoint
 * needs the same db()/readSession()/jsonError() helpers, and ~150 lines of
 * crypto duplicated four ways is well past the point where duplication beats
 * an import. One file means there is nothing to share, so nothing to resolve.
 *
 * Routes (all relative to /api/user):
 *   POST   /session                  sign in with a Google ID token
 *   DELETE /session                  sign out
 *   GET    /me                       { user } or { user: null }
 *   PATCH  /me                       { displayName }
 *   GET    /lists                    all lists with item counts
 *   POST   /lists                    { name }
 *   PATCH  /lists/:id                { name }
 *   DELETE /lists/:id                (refuses the default list)
 *   GET    /lists/:id/items          artworks in one list
 *   POST   /lists/:id/items          { artwork }
 *   DELETE /lists/:id/items/:uid
 *   GET    /saved                    { uid: listId[] } for the whole account
 * `:id` also accepts the literal "default", so saving needs no prior lookup.
 */

import { neon } from '@neondatabase/serverless'
// Type-only, and a builtin specifier rather than a relative one, so the
// no-relative-imports rule above still holds. tsconfig.node.json omits the DOM
// lib deliberately, so CryptoKey/JsonWebKey come from Node's webcrypto rather
// than from the browser globals.
import type { webcrypto } from 'node:crypto'

type CryptoKey = webcrypto.CryptoKey
type JsonWebKey = webcrypto.JsonWebKey

type Sql = ReturnType<typeof neon>
type Row = Record<string, unknown>

// ─────────────────────────────────────────────────────────────── database ───

/**
 * Lazy on purpose: neon('') throws, and a throw at module scope is exactly the
 * FUNCTION_INVOCATION_FAILED this file is shaped to avoid. Unconfigured
 * deployments return 503 instead, matching how api/museum.ts handles a
 * missing key.
 */
let cachedSql: Sql | null = null

function db(): Sql | null {
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
    // api/config.ts's s-maxage would be actively dangerous on these.
    'Cache-Control': 'no-store',
    Vary: 'Cookie',
  })
  for (const [name, value] of extraHeaders) headers.append(name, value)
  return new Response(JSON.stringify(body), { status, headers })
}

function jsonError(message: string, status: number): Response {
  return json({ error: message }, status)
}

function noContent(extraHeaders: [string, string][] = []): Response {
  const headers = new Headers({ 'Cache-Control': 'no-store' })
  for (const [name, value] of extraHeaders) headers.append(name, value)
  return new Response(null, { status: 204, headers })
}

// ──────────────────────────────────────────── google id token verification ───

const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com']
const JWKS_TTL_MS = 60 * 60 * 1000

interface GoogleJwk extends JsonWebKey {
  kid: string
  alg: string
}

// Module scope, so warm invocations reuse it rather than refetching per login.
let jwksCache: { keys: GoogleJwk[]; fetchedAt: number } | null = null

async function googleKey(kid: string): Promise<CryptoKey | null> {
  const fresh = jwksCache !== null && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS
  let jwk = fresh ? jwksCache?.keys.find((key) => key.kid === kid) : undefined

  // A kid miss means Google rotated keys — refetch, but never cache the miss.
  if (!jwk) {
    const response = await fetch(GOOGLE_JWKS_URL, { signal: AbortSignal.timeout(5000) })
    if (!response.ok) return null
    const body = (await response.json()) as { keys: GoogleJwk[] }
    jwksCache = { keys: body.keys, fetchedAt: Date.now() }
    jwk = body.keys.find((key) => key.kid === kid)
  }

  if (!jwk || jwk.alg !== 'RS256') return null
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

interface GoogleClaims {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  iss: string
  aud: string
  exp: number
}

/**
 * Verifies a Google ID token.
 *
 * The classic JWT attacks are ruled out structurally rather than by checking
 * for them: `alg` from the header is never used to *select* a key — RS256 is
 * hard-required and the key can only ever come from Google's JWKS — so
 * `alg: none` and HS256 key-confusion have nowhere to land.
 */
async function verifyIdToken(token: string): Promise<GoogleClaims | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [encodedHeader, encodedPayload, encodedSignature] = parts

  let header: { alg?: string; kid?: string }
  try {
    header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString()) as typeof header
  } catch {
    return null
  }
  if (header.alg !== 'RS256' || !header.kid) return null

  const key = await googleKey(header.kid)
  if (!key) return null

  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    Buffer.from(encodedSignature, 'base64url'),
    Buffer.from(`${encodedHeader}.${encodedPayload}`),
  )
  if (!verified) return null

  let claims: GoogleClaims
  try {
    claims = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString()) as GoogleClaims
  } catch {
    return null
  }

  if (!GOOGLE_ISSUERS.includes(claims.iss)) return null
  // Same var the browser used to request the token — see .env.example for why
  // this one carries a VITE_ prefix despite being read server-side.
  if (claims.aud !== process.env.VITE_GOOGLE_CLIENT_ID) return null
  if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null
  if (!claims.sub || !claims.email || claims.email_verified !== true) return null

  return claims
}

// ──────────────────────────────────────────────────────────────── sessions ───

const COOKIE_NAME = 'mr_session'
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30

// Vercel sets this in every deployment. Locally it's unset, and http://127.0.0.1
// can't carry a Secure cookie in every browser, so it's conditional.
const isDeployed = Boolean(process.env.VERCEL)

async function hmacKey(): Promise<CryptoKey | null> {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/**
 * `base64url({ uid, exp }).base64url(HMAC-SHA256(secret, part1))`
 *
 * Deliberately not a JWT: with no header there is no `alg` field for anyone to
 * tamper with. Stateless, so no sessions table and no DB round trip on the
 * /me call every page load makes. The trade is no server-side revocation —
 * sign-out clears the cookie and the 30-day cap bounds the rest.
 */
async function signSession(userId: number): Promise<string | null> {
  const key = await hmacKey()
  if (!key) return null
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_S }),
  ).toString('base64url')
  const signature = await crypto.subtle.sign('HMAC', key, Buffer.from(payload))
  return `${payload}.${Buffer.from(signature).toString('base64url')}`
}

async function readSession(request: Request): Promise<number | null> {
  const cookies = request.headers.get('cookie')
  if (!cookies) return null

  const match = new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`).exec(cookies)
  if (!match) return null

  const [payload, signature] = match[1].split('.')
  if (!payload || !signature) return null

  const key = await hmacKey()
  if (!key) return null

  // crypto.subtle.verify, not a string compare — no timing side channel.
  const verified = await crypto.subtle.verify(
    'HMAC',
    key,
    Buffer.from(signature, 'base64url'),
    Buffer.from(payload),
  )
  if (!verified) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      uid: number
      exp: number
    }
    if (typeof claims.uid !== 'number' || claims.exp * 1000 < Date.now()) return null
    return claims.uid
  } catch {
    return null
  }
}

function sessionCookie(token: string): string {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    // Lax, not Strict: Strict drops the cookie on a top-level navigation from
    // any external link, so arriving from a bookmark would look signed out.
    // Lax still withholds it from cross-site POST/fetch, the CSRF-relevant case.
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_S}`,
    isDeployed ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

const CLEAR_COOKIE = [
  `${COOKIE_NAME}=`,
  'Path=/',
  'HttpOnly',
  'SameSite=Lax',
  'Max-Age=0',
  isDeployed ? 'Secure' : '',
]
  .filter(Boolean)
  .join('; ')

// ────────────────────────────────────────────────────────────── validation ───

/**
 * The ten source ids, duplicated from src/types/artwork.ts on purpose. Ten
 * strings is a cheaper price than a relative import the runtime may not
 * resolve — the same trade api/config.ts makes with its env var names.
 */
const SOURCE_IDS = new Set([
  'aic',
  'cleveland',
  'vam',
  'met',
  'rijksmuseum',
  'harvard',
  'smithsonian',
  'smk',
  'europeana',
  'wikimediaCommons',
])

const MAX_LIST_NAME = 60
const MAX_DISPLAY_NAME = 50
const MAX_LISTS_PER_USER = 200
const MAX_ITEMS_PER_LIST = 5000
const MAX_SAVED_ROWS = 20_000

/** Trimmed non-empty string within a length cap, or undefined. */
function str(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length === 0 || trimmed.length > max ? undefined : trimmed
}

type Normalized<T> = { ok: true; value: T } | { ok: false; error: string }

function normalizeDisplayName(input: unknown): Normalized<string | null> {
  if (input === null || input === undefined) return { ok: true, value: null }
  if (typeof input !== 'string') return { ok: false, error: 'Display name must be text.' }

  // Strip every Unicode "other" category: control characters, and format
  // characters like zero-width joiner/space. They render as nothing, which
  // would let two accounts wear names that look identical.
  const cleaned = input.replace(/\p{C}/gu, '').trim()
  if (cleaned.length === 0) return { ok: true, value: null }

  // Code points, not UTF-16 units: [...s].length so an emoji counts as one and
  // doesn't get rejected at half the visible length.
  if ([...cleaned].length > MAX_DISPLAY_NAME) {
    return { ok: false, error: `Display name must be ${MAX_DISPLAY_NAME} characters or fewer.` }
  }
  return { ok: true, value: cleaned }
}

function normalizeListName(input: unknown): Normalized<string> {
  if (typeof input !== 'string') return { ok: false, error: 'List name must be text.' }
  const cleaned = input.replace(/\p{C}/gu, '').trim()
  if (cleaned.length === 0) return { ok: false, error: 'List name cannot be empty.' }
  if ([...cleaned].length > MAX_LIST_NAME) {
    return { ok: false, error: `List name must be ${MAX_LIST_NAME} characters or fewer.` }
  }
  return { ok: true, value: cleaned }
}

/**
 * Rebuilds the Artwork from an allowlist rather than storing what the client
 * sent — the same principle as api/museum.ts's allowedParams: nothing reaches
 * storage unless it's a field we named.
 *
 * blurDataUrl is dropped deliberately: a 1-2 KB base64 blob (AIC only) worth
 * it for a loading shimmer on the wall, not worth it on every saved row.
 */
function sanitizeArtwork(input: unknown): { uid: string; artwork: Record<string, unknown> } | null {
  if (typeof input !== 'object' || input === null) return null
  const source = input as Record<string, unknown>

  const sourceId =
    typeof source.sourceId === 'string' && SOURCE_IDS.has(source.sourceId) ? source.sourceId : null
  const uid = str(source.uid, 300)
  const title = str(source.title, 500)
  const thumbUrl = str(source.thumbUrl, 2000)

  if (!sourceId || !uid || !title || !thumbUrl) return null
  // uid is client-supplied and used as an identifier, so pin its shape.
  if (!uid.startsWith(`${sourceId}:`)) return null
  if (!thumbUrl.startsWith('https://')) return null

  const artwork: Record<string, unknown> = { uid, sourceId, title, thumbUrl }

  const optionalText = [
    ['sourceLabel', 100],
    ['artist', 300],
    ['date', 100],
    ['medium', 300],
    ['department', 200],
    ['alt', 500],
    ['creditLine', 1000],
  ] as const
  for (const [field, max] of optionalText) {
    const value = str(source[field], max)
    if (value !== undefined) artwork[field] = value
  }

  for (const field of ['fullUrl', 'objectUrl'] as const) {
    const value = str(source[field], 2000)
    if (value !== undefined && value.startsWith('https://')) artwork[field] = value
  }

  for (const field of ['width', 'height'] as const) {
    const value = source[field]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e6) {
      artwork[field] = value
    }
  }

  if (typeof source.isPublicDomain === 'boolean') artwork.isPublicDomain = source.isPublicDomain

  return { uid, artwork }
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed = (await request.json()) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────── shaping ───

function toUser(row: Row) {
  return {
    id: Number(row.id),
    email: String(row.email),
    name: (row.name as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    pictureUrl: (row.picture_url as string | null) ?? null,
  }
}

function toList(row: Row) {
  return {
    id: Number(row.id),
    name: String(row.name),
    isDefault: Boolean(row.is_default),
    itemCount: Number(row.item_count ?? 0),
    createdAt: String(row.created_at),
  }
}

/** Postgres unique-violation. Used to turn races into a clean 409. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

// ──────────────────────────────────────────────────────────────── handlers ───

async function createSession(sql: Sql, request: Request): Promise<Response> {
  const body = await readJsonBody(request)
  const credential = typeof body?.credential === 'string' ? body.credential : null
  if (!credential) return jsonError('Missing credential.', 400)

  const claims = await verifyIdToken(credential)
  if (!claims) return jsonError('Sign-in failed. That token could not be verified.', 401)

  const [row] = (await sql`
    insert into users (google_sub, email, name, picture_url)
    values (${claims.sub}, ${claims.email ?? ''}, ${claims.name ?? null}, ${claims.picture ?? null})
    on conflict (google_sub) do update
      set email        = excluded.email,
          name         = excluded.name,
          picture_url  = excluded.picture_url,
          last_seen_at = now()
    returning id, email, name, display_name, picture_url
  `) as Row[]

  // The partial unique index makes this safe when two tabs sign in at once.
  await sql`
    insert into lists (user_id, name, is_default)
    values (${Number(row.id)}, 'Saved', true)
    on conflict do nothing
  `

  const token = await signSession(Number(row.id))
  if (!token) return jsonError('Accounts are not configured here — set SESSION_SECRET.', 503)

  return json({ user: toUser(row) }, 200, [['Set-Cookie', sessionCookie(token)]])
}

async function getMe(sql: Sql, userId: number | null): Promise<Response> {
  if (userId === null) return json({ user: null })

  const [row] = (await sql`
    select id, email, name, display_name, picture_url from users where id = ${userId}
  `) as Row[]

  // Signed cookie for a user that no longer exists — treat as signed out and
  // clear it, rather than leaving a cookie that 404s forever.
  if (!row) return json({ user: null }, 200, [['Set-Cookie', CLEAR_COOKIE]])

  return json({ user: toUser(row) })
}

async function updateMe(sql: Sql, userId: number, request: Request): Promise<Response> {
  const body = await readJsonBody(request)
  if (!body) return jsonError('Expected a JSON object.', 400)

  const displayName = normalizeDisplayName(body.displayName)
  if (!displayName.ok) return jsonError(displayName.error, 400)

  const [row] = (await sql`
    update users set display_name = ${displayName.value}
    where id = ${userId}
    returning id, email, name, display_name, picture_url
  `) as Row[]
  if (!row) return jsonError('Sign in required.', 401)

  return json({ user: toUser(row) })
}

async function getLists(sql: Sql, userId: number): Promise<Response> {
  const rows = (await sql`
    select l.id, l.name, l.is_default, l.created_at,
           count(li.id)::int as item_count
    from lists l
    left join list_items li on li.list_id = l.id
    where l.user_id = ${userId}
    group by l.id
    order by l.is_default desc, lower(l.name)
  `) as Row[]

  return json({ lists: rows.map(toList) })
}

async function createList(sql: Sql, userId: number, request: Request): Promise<Response> {
  const body = await readJsonBody(request)
  const name = normalizeListName(body?.name)
  if (!name.ok) return jsonError(name.error, 400)

  const [{ count }] = (await sql`
    select count(*)::int as count from lists where user_id = ${userId}
  `) as Row[]
  if (Number(count) >= MAX_LISTS_PER_USER) {
    return jsonError(`You've reached the limit of ${MAX_LISTS_PER_USER} lists.`, 409)
  }

  try {
    const [row] = (await sql`
      insert into lists (user_id, name) values (${userId}, ${name.value})
      returning id, name, is_default, created_at, 0 as item_count
    `) as Row[]
    return json({ list: toList(row) }, 201)
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError(`You already have a list called "${name.value}".`, 409)
    }
    throw error
  }
}

async function renameList(
  sql: Sql,
  userId: number,
  listId: number,
  request: Request,
): Promise<Response> {
  const body = await readJsonBody(request)
  const name = normalizeListName(body?.name)
  if (!name.ok) return jsonError(name.error, 400)

  try {
    const [row] = (await sql`
      update lists set name = ${name.value}
      where id = ${listId} and user_id = ${userId}
      returning id, name, is_default, created_at,
                (select count(*)::int from list_items where list_id = lists.id) as item_count
    `) as Row[]
    if (!row) return jsonError('List not found.', 404)
    return json({ list: toList(row) })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return jsonError(`You already have a list called "${name.value}".`, 409)
    }
    throw error
  }
}

async function deleteList(sql: Sql, userId: number, listId: number): Promise<Response> {
  const [row] = (await sql`
    select is_default from lists where id = ${listId} and user_id = ${userId}
  `) as Row[]
  if (!row) return jsonError('List not found.', 404)
  if (row.is_default) {
    return jsonError('The default list can be renamed, but not deleted.', 409)
  }

  await sql`delete from lists where id = ${listId} and user_id = ${userId}`
  return noContent()
}

async function getListItems(sql: Sql, listId: number): Promise<Response> {
  const rows = (await sql`
    select artwork, saved_at from list_items
    where list_id = ${listId}
    order by saved_at desc
  `) as Row[]

  return json({
    items: rows.map((row) => ({ artwork: row.artwork, savedAt: String(row.saved_at) })),
  })
}

async function saveItem(sql: Sql, listId: number, request: Request): Promise<Response> {
  const body = await readJsonBody(request)
  const sanitized = sanitizeArtwork(body?.artwork)
  if (!sanitized) return jsonError('That artwork could not be saved.', 400)

  const [{ count }] = (await sql`
    select count(*)::int as count from list_items where list_id = ${listId}
  `) as Row[]
  if (Number(count) >= MAX_ITEMS_PER_LIST) {
    return jsonError(`That list is full (${MAX_ITEMS_PER_LIST} items).`, 409)
  }

  // Idempotent: saving twice is a no-op rather than an error, so a double
  // click or a retry can't fail.
  await sql`
    insert into list_items (list_id, uid, artwork)
    values (${listId}, ${sanitized.uid}, ${JSON.stringify(sanitized.artwork)}::jsonb)
    on conflict (list_id, uid) do nothing
  `

  return json({ uid: sanitized.uid, listId }, 201)
}

async function deleteItem(sql: Sql, listId: number, uid: string): Promise<Response> {
  await sql`delete from list_items where list_id = ${listId} and uid = ${uid}`
  return noContent()
}

/**
 * The whole account's saved state in one request, as { uid: listId[] }.
 *
 * The wall renders 100+ cards and each needs to know whether it's saved. One
 * request per session keeps that at zero requests per card, one cache entry,
 * and one thing to invalidate. Returning the list ids rather than a bare uid
 * list is what lets the Save dropdown tick the right lists without a second
 * query.
 */
async function getSavedMap(sql: Sql, userId: number): Promise<Response> {
  const rows = (await sql`
    select li.uid, li.list_id
    from list_items li
    join lists l on l.id = li.list_id
    where l.user_id = ${userId}
    limit ${MAX_SAVED_ROWS + 1}
  `) as Row[]

  if (rows.length > MAX_SAVED_ROWS) {
    // Nobody will hit this; degrading to optimistic-only state beats shipping
    // a multi-megabyte response.
    return json({ saved: {}, truncated: true })
  }

  const saved: Record<string, number[]> = {}
  for (const row of rows) {
    const uid = String(row.uid)
    ;(saved[uid] ??= []).push(Number(row.list_id))
  }

  return json({ saved, truncated: false })
}

/** Resolves ":id" (numeric, or the literal "default") to a list this user owns. */
async function resolveListId(sql: Sql, userId: number, param: string): Promise<number | null> {
  if (param === 'default') {
    const [row] = (await sql`
      select id from lists where user_id = ${userId} and is_default limit 1
    `) as Row[]
    return row ? Number(row.id) : null
  }

  const id = Number(param)
  if (!Number.isInteger(id) || id <= 0) return null

  // Scoped by user_id, so another account's list id is indistinguishable from
  // one that doesn't exist.
  const [row] = (await sql`
    select id from lists where id = ${id} and user_id = ${userId} limit 1
  `) as Row[]
  return row ? Number(row.id) : null
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
  const url = new URL(request.url)

  // Parsed from the pathname on both sides rather than from a Vercel-injected
  // param, so dev and production run the same code path.
  const segments = url.pathname.replace(/^\/api\/user\/?/, '').split('/').filter(Boolean)

  // Above the config gate: this is the health check that reports whether the
  // gate would pass, so it has to answer on an unconfigured deployment too.
  if (method === 'GET' && segments.length === 1 && segments[0] === 'ping') {
    return json({
      ok: true,
      hasDb: Boolean(process.env.DATABASE_URL),
      hasSessionSecret: Boolean(process.env.SESSION_SECRET),
      hasGoogleClientId: Boolean(process.env.VITE_GOOGLE_CLIENT_ID),
    })
  }

  const sql = db()
  if (!sql) return jsonError('Accounts are not configured here — set DATABASE_URL.', 503)
  if (!process.env.SESSION_SECRET) {
    return jsonError('Accounts are not configured here — set SESSION_SECRET.', 503)
  }

  // Defence in depth behind SameSite=Lax, which already withholds the cookie
  // from cross-site writes. Null Origin (curl, same-origin GET) is allowed.
  if (method !== 'GET') {
    const origin = request.headers.get('origin')
    if (origin !== null) {
      const host = request.headers.get('host') ?? url.host
      let originHost: string
      try {
        originHost = new URL(origin).host
      } catch {
        return jsonError('Bad Origin.', 403)
      }
      if (originHost !== host) return jsonError('Cross-origin request rejected.', 403)
    }
  }

  const [first, second, third, fourth] = segments

  // ── /session ──
  if (segments.length === 1 && first === 'session') {
    if (method === 'POST') return createSession(sql, request)
    if (method === 'DELETE') return noContent([['Set-Cookie', CLEAR_COOKIE]])
  }

  const userId = await readSession(request)

  // ── /me ── the only endpoint that answers when signed out.
  if (segments.length === 1 && first === 'me') {
    if (method === 'GET') return getMe(sql, userId)
    if (method === 'PATCH') {
      if (userId === null) return jsonError('Sign in required.', 401)
      return updateMe(sql, userId, request)
    }
  }

  // Everything past this point requires a session.
  if (userId === null) return jsonError('Sign in required.', 401)

  // ── /saved ──
  if (segments.length === 1 && first === 'saved' && method === 'GET') {
    return getSavedMap(sql, userId)
  }

  // ── /lists ──
  if (segments.length === 1 && first === 'lists') {
    if (method === 'GET') return getLists(sql, userId)
    if (method === 'POST') return createList(sql, userId, request)
  }

  if (first === 'lists' && second !== undefined) {
    const listId = await resolveListId(sql, userId, second)
    if (listId === null) return jsonError('List not found.', 404)

    // ── /lists/:id ──
    if (segments.length === 2) {
      if (method === 'PATCH') return renameList(sql, userId, listId, request)
      if (method === 'DELETE') return deleteList(sql, userId, listId)
    }

    // ── /lists/:id/items ──
    if (segments.length === 3 && third === 'items') {
      if (method === 'GET') return getListItems(sql, listId)
      if (method === 'POST') return saveItem(sql, listId, request)
    }

    // ── /lists/:id/items/:uid ──
    if (segments.length === 4 && third === 'items' && method === 'DELETE') {
      return deleteItem(sql, listId, decodeURIComponent(fourth))
    }
  }

  return jsonError('Not found.', 404)
}
