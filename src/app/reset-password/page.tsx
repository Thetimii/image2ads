'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [isSafari, setIsSafari] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
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

    // Validate password confirmation
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
      setIsLoading(false)
      return
    }

    // Validate password length
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long')
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      })
      
      if (error) throw error
      
      setMessage('Password updated successfully! Redirecting...')
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
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
              Reset your password
            </h2>
            <p className="text-gray-600 text-sm">
              Enter your new password below
            </p>
          </div>
          
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white/50"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white/50"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded-lg text-sm text-center ${
                message.includes('error') || message.includes('Error') || message.includes('do not match') || message.includes('characters')
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
                  <span>Updating...</span>
                </div>
              ) : (
                'Update Password'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/signin"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              Back to Sign In
            </Link>
          </div>
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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
    </div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}