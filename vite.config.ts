import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Connect, type Plugin, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { GET as configGET } from './api/config.ts'
import { GET as museumGET } from './api/museum.ts'
import * as userApi from './api/user/[...path].ts'

type WebHandler = (request: Request) => Response | Promise<Response>
type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
type MethodHandlers = Partial<Record<HttpMethod, WebHandler>>

/**
 * `vite dev` doesn't run the api/ functions, so mount them as middleware.
 * Without this, the three key-gated museums and every account feature would
 * only work on a deployed build.
 *
 * This calls the functions' real method exports with a real Request, and reads
 * env from process.env exactly as Vercel does — an earlier version imported
 * their internals instead, which meant local dev exercised the handler logic
 * but never the module boundary, and shipped a function that crashed on load.
 */
function museumApiDevServer(): Plugin {
  return {
    name: 'museum-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      // config's GET takes no argument; adapt it to the common shape.
      mount(server, '/api/config', { GET: () => configGET() })
      mount(server, '/api/museum', { GET: museumGET })
      // Connect matches mounts by PREFIX, so this one also serves
      // /api/user/lists/3/items — which is what the catch-all function wants.
      mount(server, '/api/user', userApi)
    },
  }
}

function mount(server: ViteDevServer, path: string, handlers: MethodHandlers): void {
  server.middlewares.use(path, (req, res) => {
    void handle(req, res, handlers)
  })
}

// Connect.IncomingMessage, not node:http's — `originalUrl` is Connect's
// addition, and it's the only place the full pre-mount path survives.
async function handle(
  req: Connect.IncomingMessage,
  res: ServerResponse,
  handlers: MethodHandlers,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase()
  const handler = handlers[method as HttpMethod]
  if (!handler) {
    // Vercel returns 405 for a method the function doesn't export. Match it, so
    // a missing export fails the same way in both places.
    res.statusCode = 405
    res.setHeader('Allow', Object.keys(handlers).join(', '))
    res.end()
    return
  }

  // Connect strips the mount path from req.url, so read the full one.
  const url = new URL(req.originalUrl ?? req.url ?? '', 'http://127.0.0.1:5173')
  const hasBody = method !== 'GET' && method !== 'HEAD'

  await send(
    res,
    handler(
      new Request(url, {
        method,
        headers: toHeaders(req.headers),
        body: hasBody ? await readBody(req) : undefined,
      }),
    ),
  )
}

/** Node's header bag -> Web Headers, preserving repeated headers (Cookie et al). */
function toHeaders(raw: IncomingMessage['headers']): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(raw)) {
    // Hop-by-hop headers describe the Node socket, not the Web Request, and
    // undici rejects some of them outright.
    if (name === 'connection' || name === 'keep-alive' || name === 'transfer-encoding') continue
    if (Array.isArray(value)) for (const one of value) headers.append(name, one)
    else if (value !== undefined) headers.set(name, value)
  }
  return headers
}

/**
 * Buffered rather than streamed. A stream body would need RequestInit.duplex,
 * which isn't in the type surface api/ compiles under, and every body here is
 * a few hundred bytes of JSON.
 */
async function readBody(req: IncomingMessage): Promise<Uint8Array | undefined> {
  const chunks: Uint8Array[] = []
  for await (const chunk of req) chunks.push(chunk as Uint8Array)
  return chunks.length === 0 ? undefined : Buffer.concat(chunks)
}

/** Pipe a Web Response into Node's ServerResponse. */
async function send(res: ServerResponse, response: Response | Promise<Response>): Promise<void> {
  const resolved = await response
  res.statusCode = resolved.status

  // headers.forEach() joins repeated headers with ", ", which silently corrupts
  // multiple Set-Cookie values — a comma is legal inside an Expires date.
  // getSetCookie() is the only correct way to read them back, and Node's
  // setHeader takes an array to emit them as separate lines.
  const setCookie = resolved.headers.getSetCookie()
  resolved.headers.forEach((value, name) => {
    if (name.toLowerCase() !== 'set-cookie') res.setHeader(name, value)
  })
  if (setCookie.length > 0) res.setHeader('Set-Cookie', setCookie)

  // arrayBuffer, not text: a 204 has no body and text() on one is still fine,
  // but this also keeps any future non-UTF8 response byte-exact.
  res.end(Buffer.from(await resolved.arrayBuffer()))
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix: the museum keys and DB/session secrets are server-side only
  // and deliberately carry no VITE_ prefix, which Vite's default filtering
  // would otherwise hide. Copied onto process.env so the functions above read
  // them the same way they will on Vercel.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), museumApiDevServer()],
    server: {
      // Bind explicitly to the IPv4 loopback: some museum image CDNs (AIC's
      // in particular) reject requests whose Referer contains the literal
      // string "localhost", and Vite's default "localhost" host can resolve
      // to the IPv6-only loopback on Windows, making 127.0.0.1 unreachable.
      //
      // This is also the origin registered with Google for the sign-in button
      // — GIS treats 127.0.0.1 and localhost as different origins.
      host: '127.0.0.1',

      // Pinned, and strict so a clash fails loudly. Vite's default is to hop
      // to the next free port, but the sign-in origin is registered with
      // Google as exactly http://127.0.0.1:5173 — drifting to :5174 makes GIS
      // refuse to render the button and report it only to the console, which
      // reads as "login is broken" rather than "wrong port".
      port: 5173,
      strictPort: true,
    },
  }
})
