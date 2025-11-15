'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  // NextAuth should automatically handle basePath when configured in next.config.js
  // and when NEXTAUTH_URL includes the base path (which it does)
  // The basePath prop on SessionProvider is not needed - Next.js handles it automatically
  return <SessionProvider>{children}</SessionProvider>
}

