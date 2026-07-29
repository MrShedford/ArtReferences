/**
 * Tells the client which key-gated sources this deployment can actually
 * serve, so the UI can disable the rest. Replaces the old client-side
 * isConfigured() check, which only worked when keys were in the bundle.
 *
 * Returns ids only — never a key, or even its length.
 *
 * Self-contained by design; see the note at the top of api/museum.ts. The
 * env var names are duplicated from there deliberately: three strings is a
 * cheaper price than a relative import the deployed runtime may not resolve.
 */

const ENV_VAR_BY_SOURCE = {
  smithsonian: 'SMITHSONIAN_API_KEY',
  harvard: 'HARVARD_API_KEY',
  europeana: 'EUROPEANA_API_KEY',
} as const

export function GET(): Response {
  const configured = Object.entries(ENV_VAR_BY_SOURCE)
    .filter(([, envVar]) => Boolean(process.env[envVar]))
    .map(([id]) => id)

  return new Response(JSON.stringify({ configured }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
    },
  })
}
