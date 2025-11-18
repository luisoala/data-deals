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

// NextAuth v4 returns handlers directly - export them
const handler = NextAuth(authOptions)

// Wrap NextAuth handlers to fix redirect URLs that don't include base path
const BASE_PATH = process.env.BASE_PATH || process.env.NEXT_PUBLIC_BASE_PATH || '/neurips2025-data-deals'

async function fixRedirectUrl(response: Response): Promise<Response> {
  const location = response.headers.get('location')
  console.log(`[NextAuth] Response status: ${response.status}, location: ${location}, BASE_PATH: ${BASE_PATH}`)
  
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

// NextAuth v4 returns an object with GET and POST handlers
// Export them with redirect URL fixing
export const GET = async (req: NextRequest, context: any) => {
  try {
    // Check if handler has GET method
    if (handler && typeof handler.GET === 'function') {
      const response = await handler.GET(req, context)
      return fixRedirectUrl(response)
    } else {
      // Log error for debugging
      console.error('[NextAuth] ERROR: handler.GET is not a function')
      console.error('[NextAuth] Handler type:', typeof handler)
      if (handler && typeof handler === 'object') {
        console.error('[NextAuth] Handler keys:', Object.keys(handler))
      }
      // Try to call handler directly if it's a function
      if (typeof handler === 'function') {
        const response = await handler(req, context)
        return fixRedirectUrl(response)
      }
      return new NextResponse('Internal Server Error', { status: 500 })
    }
  } catch (error) {
    console.error('[NextAuth] GET handler error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export const POST = async (req: NextRequest, context: any) => {
  try {
    // Check if handler has POST method
    if (handler && typeof handler.POST === 'function') {
      const response = await handler.POST(req, context)
      return fixRedirectUrl(response)
    } else {
      // Log error for debugging
      console.error('[NextAuth] ERROR: handler.POST is not a function')
      console.error('[NextAuth] Handler type:', typeof handler)
      if (handler && typeof handler === 'object') {
        console.error('[NextAuth] Handler keys:', Object.keys(handler))
      }
      // Try to call handler directly if it's a function
      if (typeof handler === 'function') {
        const response = await handler(req, context)
        return fixRedirectUrl(response)
      }
      return new NextResponse('Internal Server Error', { status: 500 })
    }
  } catch (error) {
    console.error('[NextAuth] POST handler error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

