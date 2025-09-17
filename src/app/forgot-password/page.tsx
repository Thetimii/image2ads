'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import Image from 'next/image'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)
  const [isSafari, setIsSafari] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    // Detect Safari
    const userAgent = navigator.userAgent.toLowerCase();
    setIsSafari(userAgent.includes('safari') && !userAgent.includes('chrome'));
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/reset-password`,
      })
      
      if (error) throw error
      
      setIsSuccess(true)
      setMessage('Check your email for a password reset link!')
    } catch (error: unknown) {
      setMessage((error as Error).message || 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

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
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Forgot your password?
            </h2>
            <p className="text-gray-600 text-sm">
              Enter your email address and we'll send you a link to reset your password
            </p>
          </div>
          
          {!isSuccess ? (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white/50"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {message && (
                <div className={`p-3 rounded-lg text-sm text-center ${
                  message.includes('error') || message.includes('Error')
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium py-3 px-4 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/20"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Sending...</span>
                  </div>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <svg className="w-8 h-8 text-green-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-green-700 font-medium">Email sent!</p>
                <p className="text-green-600 text-sm mt-1">
                  Check your email for a password reset link. If you don't see it, check your spam folder.
                </p>
              </div>
              
              <Link
                href="/signin"
                className="inline-block w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium py-3 px-4 rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-lg shadow-blue-500/20 text-center"
              >
                Back to Sign In
              </Link>
            </div>
          )}

          {!isSuccess && (
            <div className="mt-6 text-center">
              <Link
                href="/signin"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                Remember your password? Sign in
              </Link>
            </div>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
          >
            ← Back to homepage
          </Link>
        </div>
      </div>
    </div>
  )
}