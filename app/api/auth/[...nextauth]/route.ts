import NextAuth from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

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

// Wrap NextAuth handlers to fix redirect URLs that don't include base path
const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '/neurips2025-data-deals'

async function fixRedirectUrl(response: Response): Promise<Response> {
  const location = response.headers.get('location')
  if (location && location.startsWith('/api/auth/') && !location.startsWith(BASE_PATH)) {
    // Rewrite redirect URL to include base path
    const fixedLocation = `${BASE_PATH}${location}`
    console.log(`[NextAuth] Fixing redirect URL: ${location} -> ${fixedLocation}`)
    // Create new response with fixed location header
    const headers = new Headers(response.headers)
    headers.set('location', fixedLocation)
    
    // Read body if it exists
    const body = response.body ? await response.clone().text() : null
    
    return new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    })
  }
  return response
}

// NextAuth returns an object with GET and POST handlers
export const GET = async (req: NextRequest, context: any) => {
  const response = await handler.GET(req, context)
  return fixRedirectUrl(response)
}

export const POST = async (req: NextRequest, context: any) => {
  const response = await handler.POST(req, context)
  return fixRedirectUrl(response)
}

