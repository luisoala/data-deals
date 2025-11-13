'use client'

import { signIn } from 'next-auth/react'
import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

export default function SignIn() {
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

