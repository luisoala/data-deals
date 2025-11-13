'use client'

import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import AdminDashboard from '@/components/AdminDashboard'

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn('github')
    }
  }, [status])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (!(session.user as any)?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-red-600">
          You are not authorized to access this page.
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">
            Review and approve suggestions for data deals
          </p>
          <div className="mt-4">
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Back to Main Page
            </button>
          </div>
        </header>
        <AdminDashboard />
      </div>
    </main>
  )
}

