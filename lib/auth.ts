import { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'

// Ensure NEXTAUTH_URL is set correctly
const nextAuthUrl = process.env.NEXTAUTH_URL
if (!nextAuthUrl) {
  console.error('ERROR: NEXTAUTH_URL is not set! Authentication will fail.')
  console.error('Please set NEXTAUTH_URL in your .env file to your production URL')
  console.error('Current env vars:', {
    NODE_ENV: process.env.NODE_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  })
}

// Log the URL being used (for debugging)
if (nextAuthUrl) {
  console.log('NextAuth configured with URL:', nextAuthUrl)
}

// Validate required environment variables
const githubClientId = process.env.GITHUB_CLIENT_ID
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET

if (!githubClientId || !githubClientSecret) {
  console.error('ERROR: GitHub OAuth credentials not configured!')
  console.error('Missing:', {
    GITHUB_CLIENT_ID: !githubClientId,
    GITHUB_CLIENT_SECRET: !githubClientSecret,
  })
  console.error('Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in your .env file')
  console.error('Current env check:', {
    hasClientId: !!githubClientId,
    hasClientSecret: !!githubClientSecret,
    clientIdLength: githubClientId?.length || 0,
    clientSecretLength: githubClientSecret?.length || 0,
  })
} else {
  console.log('✓ GitHub OAuth credentials found')
  console.log('  Client ID:', githubClientId.substring(0, 10) + '...')
  console.log('  Client Secret:', githubClientSecret.substring(0, 10) + '...')
}

// Get base path from environment (matches next.config.js)
const basePath = process.env.BASE_PATH || '/neurips2025-data-deals'

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: githubClientId || '',
      clientSecret: githubClientSecret || '',
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        session.user.githubUsername = token.githubUsername as string
        session.user.isAdmin = token.isAdmin as boolean
      }
      return session
    },
    async jwt({ token, profile }) {
      if (profile && 'login' in profile) {
        const githubProfile = profile as { login: string }
        token.githubUsername = githubProfile.login
        const adminUsernames = (process.env.ADMIN_GITHUB_USERNAMES || '').split(',').map(u => u.trim())
        token.isAdmin = adminUsernames.includes(githubProfile.login)
      }
      return token
    },
    async redirect({ url, baseUrl }) {
      // Ensure redirects include the base path
      // baseUrl should already include the base path from NEXTAUTH_URL
      if (url.startsWith('/')) {
        // Relative URL - prepend baseUrl (which includes basePath)
        return `${baseUrl}${url}`
      } else if (new URL(url).origin === baseUrl) {
        // Same origin - return as is
        return url
      }
      // External URL or fallback
      return baseUrl
    },
  },
  pages: {
    signIn: `${basePath}/auth/signin`,
  },
  // Ensure NextAuth uses the correct base path for API routes
  // NEXTAUTH_URL should include /api/auth at the end
}

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null
      email?: string | null
      image?: string | null
      githubUsername?: string
      isAdmin?: boolean
    }
  }
}

