import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import './styles/globals.css'
import './styles/theme-light.css'
import client from './api/client'

// Use mock adapter only when VITE_USE_MOCK=true (local dev without backend)
if (import.meta.env.VITE_USE_MOCK === 'true') {
  const { mockAdapter } = await import('./mocks/adapter')
  client.defaults.adapter = mockAdapter
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
)
