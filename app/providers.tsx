'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  // SessionProvider accepts basePath prop pointing to where NextAuth API routes are mounted
  // This tells the client-side code to use /neurips2025-data-deals/api/auth instead of /api/auth
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/neurips2025-data-deals'
  const authBasePath = `${basePath}/api/auth`
  
  return <SessionProvider basePath={authBasePath}>{children}</SessionProvider>
}

