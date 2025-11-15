'use client'

import { SessionProvider } from 'next-auth/react'

// Base path for NextAuth API calls (matches next.config.js basePath)
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/neurips2025-data-deals'

export function Providers({ children }: { children: React.ReactNode }) {
  // Configure SessionProvider with baseUrl to ensure client-side API calls include the base path
  // Use baseUrl (full URL) instead of basePath to ensure OAuth callback URLs are constructed correctly
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}${BASE_PATH}/api/auth`
    : undefined

  return (
    <SessionProvider baseUrl={baseUrl}>
      {children}
    </SessionProvider>
  )
}

