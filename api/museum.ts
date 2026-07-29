import { handleMuseumRequest } from './_shared/handlers'

/**
 * Key-holding proxy for the three museums that require one. The browser never
 * sees a key; it calls /api/museum?source=<id>&<the museum's own params>.
 */
export function GET(request: Request): Promise<Response> {
  return handleMuseumRequest(new URL(request.url).searchParams, process.env)
}
