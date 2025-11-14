'use client'

import { signIn } from 'next-auth/react'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function SignInContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'

  useEffect(() => {
    signIn('github', { callbackUrl })
  }, [callbackUrl])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-xl">Redirecting to GitHub...</div>
    </div>
  )
}

export default function SignIn() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
}

