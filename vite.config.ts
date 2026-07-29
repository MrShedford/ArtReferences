import type { ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { GET as configGET } from './api/config.ts'
import { GET as museumGET } from './api/museum.ts'

/**
 * `vite dev` doesn't run the api/ functions, so mount them as middleware.
 * Without this, the three key-gated museums would only work on a deployed
 * build, since their keys are deliberately not readable from the browser.
 *
 * This calls the functions' real GET exports with a real Request, and reads
 * keys from process.env exactly as Vercel does — an earlier version imported
 * their internals instead, which meant local dev exercised the handler logic
 * but never the module boundary, and shipped a function that crashed on load.
 */
function museumApiDevServer(): Plugin {
  return {
    name: 'museum-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/config', (_req, res) => {
        void send(res, configGET())
      })

      server.middlewares.use('/api/museum', (req, res) => {
        // Connect strips the mount path from req.url, so read the full one.
        const url = new URL(req.originalUrl ?? req.url ?? '', 'http://127.0.0.1')
        void send(res, museumGET(new Request(url)))
      })
    },
  }
}

/** Pipe a Web Response into Node's ServerResponse. */
async function send(res: ServerResponse, response: Response | Promise<Response>): Promise<void> {
  const resolved = await response
  res.statusCode = resolved.status
  resolved.headers.forEach((value, name) => res.setHeader(name, value))
  res.end(await resolved.text())
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Empty prefix: the museum keys are server-side only and deliberately carry
  // no VITE_ prefix, which Vite's default filtering would otherwise hide.
  // Copied onto process.env so the functions above read them the same way
  // they will on Vercel.
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), museumApiDevServer()],
    server: {
      // Bind explicitly to the IPv4 loopback: some museum image CDNs (AIC's
      // in particular) reject requests whose Referer contains the literal
      // string "localhost", and Vite's default "localhost" host can resolve
      // to the IPv6-only loopback on Windows, making 127.0.0.1 unreachable.
      host: '127.0.0.1',
    },
  }
})
