/// <reference types="vite/client" />

// The museum API keys are deliberately NOT declared here. They're server-side
// vars without a VITE_ prefix, read only by api/_shared/sources.ts, so nothing
// in src/ should ever reach for one via import.meta.env.
