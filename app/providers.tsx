'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  // NextAuth should automatically handle basePath when configured in next.config.js
  // and when NEXTAUTH_URL includes the base path (which it does)
  return <SessionProvider>{children}</SessionProvider>
}

