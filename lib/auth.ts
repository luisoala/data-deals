import { NextAuthOptions } from 'next-auth'
import GitHubProvider from 'next-auth/providers/github'

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
      if (profile?.login) {
        token.githubUsername = profile.login
        const adminUsernames = (process.env.ADMIN_GITHUB_USERNAMES || '').split(',').map(u => u.trim())
        token.isAdmin = adminUsernames.includes(profile.login)
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

