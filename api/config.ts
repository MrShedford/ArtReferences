// Explicit .ts extension: package.json sets "type": "module", so these files
// run under Node ESM rules, where relative specifiers must carry an extension.
// Extensionless works in Vite's dev resolver but crashes the deployed function.
import { handleConfigRequest } from './_shared/handlers.ts'

/**
 * Tells the client which key-gated sources this deployment can actually
 * serve, so the UI can disable the rest. Replaces the old client-side
 * isConfigured() check, which only worked when keys were in the bundle.
 */
export function GET(): Response {
  return handleConfigRequest(process.env)
}
