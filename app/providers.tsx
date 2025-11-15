'use client'

import { SessionProvider } from 'next-auth/react'

// Base path for NextAuth API calls (matches next.config.js basePath)
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '/neurips2025-data-deals'

export function Providers({ children }: { children: React.ReactNode }) {
  // Configure SessionProvider with basePath to ensure client-side API calls include it
  return (
    <SessionProvider basePath={`${BASE_PATH}/api/auth`}>
      {children}
    </SessionProvider>
  )
}

