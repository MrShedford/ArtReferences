/// <reference types="vite/client" />

// The museum API keys are deliberately NOT declared here. They're server-side
// vars without a VITE_ prefix, read only by api/museum.ts, so nothing in src/
// should ever reach for one via import.meta.env.
//
// VITE_GOOGLE_CLIENT_ID is the one deliberate exception in this project. An
// OAuth *client ID* is designed to be public — the sign-in button can't work
// otherwise — so it carries the prefix and is compiled into the bundle. There
// is no client *secret* anywhere; the browser sends Google's ID token to
// /api/user/session, which verifies it against Google's public keys.
interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
