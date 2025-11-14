import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'

// Log environment variables at runtime to debug production issues
console.log('[NextAuth] Environment check:')
console.log('  NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '<not set>')
console.log('  GITHUB_CLIENT_ID:', process.env.GITHUB_CLIENT_ID ? process.env.GITHUB_CLIENT_ID.substring(0, 10) + '...' : '<not set>')
console.log('  GITHUB_CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? '***' + process.env.GITHUB_CLIENT_SECRET.slice(-4) : '<not set>')
console.log('  ADMIN_GITHUB_USERNAMES:', process.env.ADMIN_GITHUB_USERNAMES || '<not set>')

if (!process.env.NEXTAUTH_URL) {
  console.error('[NextAuth] ERROR: NEXTAUTH_URL is not set!')
  console.error('[NextAuth] This will cause authentication to fail.')
}

if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
  console.error('[NextAuth] ERROR: GitHub OAuth credentials missing!')
  console.error('[NextAuth] This will cause OAuthSignin errors.')
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
