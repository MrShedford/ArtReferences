import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { Analytics } from '@vercel/analytics/react'
import type { BeforeSendEvent } from '@vercel/analytics/react'
import './styles/main.scss'
import { router } from './router'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

/**
 * SearchPage commits the typed query to the URL, so the raw text someone typed
 * would otherwise reach Vercel — and give every distinct search its own row in
 * the Pages panel. `sources` stays: it's a bounded set of museum ids.
 */
function stripSearchQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url)
  url.searchParams.delete('q')
  return { ...event, url: url.toString() }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {/* Sibling of the router, not inside it: mounts once and survives every
          navigation. `mode` is explicit because auto-detection reads
          process.env.NODE_ENV, which only exists here by Vite substitution. */}
      <Analytics
        mode={import.meta.env.PROD ? 'production' : 'development'}
        beforeSend={stripSearchQuery}
      />
    </QueryClientProvider>
  </StrictMode>,
)
