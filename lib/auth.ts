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

export const authOptions: NextAuthOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
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
  },
  pages: {
    signIn: '/auth/signin',
  },
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

