/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_HARVARD_API_KEY?: string
  readonly VITE_SMITHSONIAN_API_KEY?: string
  readonly VITE_EUROPEANA_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
