import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind explicitly to the IPv4 loopback: some museum image CDNs (AIC's
    // in particular) reject requests whose Referer contains the literal
    // string "localhost", and Vite's default "localhost" host can resolve
    // to the IPv6-only loopback on Windows, making 127.0.0.1 unreachable.
    host: '127.0.0.1',
  },
})
