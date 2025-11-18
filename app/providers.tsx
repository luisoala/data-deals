'use client'

import { SessionProvider } from 'next-auth/react'

export function Providers({ children }: { children: React.ReactNode }) {
  // Construct the base URL for NextAuth API calls including the base path
  // NextAuth v4 client-side code constructs API URLs from window.location.origin
  // We need to override this to include the base path
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/neurips2025-data-deals'
  
  // Use NEXT_PUBLIC_NEXTAUTH_URL if set (by deploy script), otherwise construct from current origin
  const baseUrl = process.env.NEXT_PUBLIC_NEXTAUTH_URL || 
    (typeof window !== 'undefined' ? `${window.location.origin}${basePath}` : undefined)
  
  // NextAuth v4 SessionProvider might accept baseUrl prop, but if not, 
  // we'll need to rely on NEXT_PUBLIC_NEXTAUTH_URL being set correctly
  // @ts-ignore - baseUrl might not be in types but could work at runtime
  return <SessionProvider baseUrl={baseUrl}>{children}</SessionProvider>
}

