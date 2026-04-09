// frontend/src/main.tsx — chunk 6
//
// Bootstraps:
// - QueryClientProvider (TanStack Query for all API calls + caching)
// - BrowserRouter (react-router v6 — replaces v1's hand-rolled hash routing)
// - AuthProvider (login state, JWT in localStorage)
// - ThemeProvider (light/dark)
// - Toaster (sonner-style notifications)

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './styles/tailwind.css'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from './components/ui/toaster'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time of 30s — most pages don't need fresher data than that.
      // Mutations explicitly invalidate the queries they affect.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider defaultTheme="system" storageKey="volunteer-theme">
          <AuthProvider>
            <App />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
