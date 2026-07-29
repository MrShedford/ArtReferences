import type { ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { handleConfigRequest, handleMuseumRequest } from './api/_shared/handlers.ts'
import type { Env } from './api/_shared/sources.ts'

/**
 * `vite dev` doesn't run the api/ functions, so mount the same handlers as
 * middleware. Without this, the three key-gated museums would only work on a
 * deployed build (or under `vercel dev`), since their keys are deliberately
 * no longer readable from the browser.
 */
function museumApiDevServer(env: Env): Plugin {
  return {
    name: 'museum-api-dev-server',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/config', (_req, res) => {
        void send(res, handleConfigRequest(env))
      })

      server.middlewares.use('/api/museum', (req, res) => {
        // Connect strips the mount path from req.url, so read the full one.
        const url = new URL(req.originalUrl ?? req.url ?? '', 'http://127.0.0.1')
        void send(res, handleMuseumRequest(url.searchParams, env))
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
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), museumApiDevServer(env)],
    server: {
      // Bind explicitly to the IPv4 loopback: some museum image CDNs (AIC's
      // in particular) reject requests whose Referer contains the literal
      // string "localhost", and Vite's default "localhost" host can resolve
      // to the IPv6-only loopback on Windows, making 127.0.0.1 unreachable.
      host: '127.0.0.1',
    },
  }
})
