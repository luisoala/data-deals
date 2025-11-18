'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  // NextAuth v4 automatically detects basePath from Next.js configuration
  // The API routes are at /neurips2025-data-deals/api/auth/* and NextAuth will find them
  // No baseUrl prop needed - Next.js handles the basePath automatically
  return <SessionProvider>{children}</SessionProvider>
}

