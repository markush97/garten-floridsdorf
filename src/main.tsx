import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { Toaster } from 'sonner'
import { queryClient } from '~/lib/query-client'
import { routeTree } from '~/routeTree.gen'
import { TooltipProvider } from '~/ui/tooltip'
import '~/styles/index.css'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

const tree = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" richColors />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
)

if (rootElement.dataset.prerendered === 'true') {
  hydrateRoot(rootElement, tree)
} else {
  createRoot(rootElement).render(tree)
}
