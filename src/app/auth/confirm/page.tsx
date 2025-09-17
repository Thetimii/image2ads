'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function ConfirmPage() {
  const [email, setEmail] = useState('')
  const [isSafari, setIsSafari] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Detect Safari
    const userAgent = navigator.userAgent.toLowerCase();
    setIsSafari(userAgent.includes('safari') && !userAgent.includes('chrome'));

    // Get email from URL params or localStorage if available
    const urlParams = new URLSearchParams(window.location.search)
    const emailParam = urlParams.get('email')
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo/Brand */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            {isSafari ? (
              // Safari-specific PNG fallback
              <Image
                src="/logo.png"
                alt="Image2Ad Logo"
                width={32}
                height={32}
                className="w-8 h-8"
                style={{
                  imageRendering: 'auto'
                } as React.CSSProperties}
              />
            ) : (
              // Standard SVG for other browsers
              <Image
                src="/logo.svg"
                alt="Image2Ad Logo"
                width={32}
                height={32}
                className="w-8 h-8"
              />
            )}
            <span className="text-xl font-semibold text-gray-900">Image2Ad</span>
          </Link>
        </div>

        {/* Main Card */}
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-xl shadow-gray-200/20 p-8">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 7.89a1 1 0 001.42 0L21 9" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Check your email
            </h2>
            
            <div className="text-gray-600 text-sm mb-6 space-y-2">
              <p>We've sent a confirmation link to:</p>
              {email && (
                <p className="font-medium text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                  {email}
                </p>
              )}
              <p className="text-xs leading-relaxed">
                Click the link in the email to confirm your account and start creating amazing ads with AI.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start space-x-2">
                <svg className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-left">
                  <p className="text-sm font-medium text-blue-900 mb-1">
                    Didn't receive the email?
                  </p>
                  <p className="text-xs text-blue-700">
                    Check your spam folder or{' '}
                    <Link href="/signin" className="underline hover:no-underline">
                      try signing up again
                    </Link>
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Link
                href="/signin"
                className="block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium py-3 px-4 rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg shadow-blue-500/20"
              >
                Back to Sign In
              </Link>
              
              <Link
                href="/"
                className="block w-full bg-white border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-gray-50 transition-all duration-200"
              >
                Back to Homepage
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Having trouble? Contact us at{' '}
            <a href="mailto:support@image2ad.com" className="text-blue-600 hover:text-blue-700">
              support@image2ad.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}