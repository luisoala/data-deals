'use client'

import { signIn } from 'next-auth/react'
import { useEffect, Suspense, useState } from 'react'
import { useSearchParams } from 'next/navigation'

function SignInContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const error = searchParams.get('error')
  const [hasAttempted, setHasAttempted] = useState(false)

  useEffect(() => {
    // Don't retry if there's an error - show error message instead
    if (error) {
      console.error('OAuth error:', error)
      setHasAttempted(true)
      return
    }

    // Only attempt sign-in once
    if (!hasAttempted) {
      setHasAttempted(true)
      signIn('github', { callbackUrl })
    }
  }, [callbackUrl, error, hasAttempted])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Error</h1>
          <div className="text-red-600 mb-4">
            {error === 'OAuthSignin' && (
              <div>
                <p className="font-semibold mb-2">GitHub OAuth configuration error</p>
                <p className="text-sm text-gray-600 mb-4">
                  The callback URL in your GitHub OAuth app doesn't match the server configuration.
                </p>
                <div className="bg-gray-100 p-3 rounded text-xs font-mono break-all">
                  <p className="font-semibold mb-1">Required callback URL:</p>
                  <p>http://100.30.119.82/api/auth/callback/github</p>
                </div>
                <p className="text-sm text-gray-600 mt-4">
                  Update your GitHub OAuth app settings:
                </p>
                <ol className="list-decimal list-inside text-sm text-gray-600 mt-2 space-y-1">
                  <li>Go to GitHub → Settings → Developer settings → OAuth Apps</li>
                  <li>Click on your OAuth app</li>
                  <li>Set Authorization callback URL to the URL above</li>
                  <li>Save and try again</li>
                </ol>
              </div>
            )}
            {error !== 'OAuthSignin' && (
              <p>Error: {error}</p>
            )}
          </div>
          <button
            onClick={() => window.location.href = callbackUrl}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

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

