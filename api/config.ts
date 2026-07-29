import { handleConfigRequest } from './_shared/handlers'

/**
 * Tells the client which key-gated sources this deployment can actually
 * serve, so the UI can disable the rest. Replaces the old client-side
 * isConfigured() check, which only worked when keys were in the bundle.
 */
export function GET(): Response {
  return handleConfigRequest(process.env)
}
