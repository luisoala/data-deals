import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// Log NEXTAUTH_URL at runtime to debug production issues
if (process.env.NEXTAUTH_URL) {
  console.log('[NextAuth] NEXTAUTH_URL:', process.env.NEXTAUTH_URL)
} else {
  console.error('[NextAuth] ERROR: NEXTAUTH_URL is not set!')
  console.error('[NextAuth] This will cause authentication to fail.')
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
