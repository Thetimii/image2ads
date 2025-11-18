'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { trackMetaCompleteRegistration } from '@/lib/meta-events'

export default function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [message, setMessage] = useState('')
  const [isSafari, setIsSafari] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Detect Safari
    const userAgent = navigator.userAgent.toLowerCase();
    setIsSafari(userAgent.includes('safari') && !userAgent.includes('chrome'));
  }, []);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage('')
    setLoadingMessage('Validating your information...')

    // Validate password confirmation
    if (password !== confirmPassword) {
      setMessage('Passwords do not match')
      setIsLoading(false)
      setLoadingMessage('')
      return
    }

    // Validate password length
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters long')
      setIsLoading(false)
      setLoadingMessage('')
      return
    }

    try {
      setLoadingMessage('Creating your account...')
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`,
        },
      })
      
      if (error) throw error
      
      // 🔥 Fire Meta Pixel CompleteRegistration event
      if (typeof window !== 'undefined' && (window as any).fbq) {
        const cookieConsent = localStorage.getItem('cookieConsent');
        if (cookieConsent === 'accepted') {
          (window as any).fbq('track', 'CompleteRegistration', {
            status: true,
            content_name: 'Email Signup',
            value: 0,
            currency: 'USD'
          });
          console.log('Meta Pixel: CompleteRegistration event fired for email signup');
        }
      }

      trackMetaCompleteRegistration({ method: 'email_password' })

      // 🚀 Track TikTok CompleteRegistration event (server-side)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await fetch('/api/tiktok-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'CompleteRegistration',
              email: user.email,
              userId: user.id,
            }),
          });
          console.log('✅ TikTok CompleteRegistration event tracked');
        }
      } catch (tikTokError) {
        console.error('❌ Failed to track TikTok event:', tikTokError);
        // Don't block signup flow if TikTok tracking fails
      }
      
      setLoadingMessage('Setting up your dashboard...')
      setIsRedirecting(true)
      
      // Temporarily skip email confirmation and go directly to dashboard
      // TODO: Re-enable email confirmation when mail sender is fixed
      router.push('/dashboard')
      
      // Keep loading state active for a bit longer to show until navigation completes
      setTimeout(() => {
        setIsLoading(false)
        setLoadingMessage('')
        setIsRedirecting(false)
      }, 2000)
    } catch (error: unknown) {
      setMessage((error as Error).message || 'An error occurred')
      setLoadingMessage('')
      setIsLoading(false)
      setIsRedirecting(false)
    }
    // Don't set isLoading to false here - let the timeout handle it after redirect
  }

  const handleGoogleAuth = async () => {
    setIsLoading(true)
    setLoadingMessage('Connecting with Google...')
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      
      // 🔥 Fire Meta Pixel CompleteRegistration event for Google signup
      if (typeof window !== 'undefined' && (window as any).fbq) {
        const cookieConsent = localStorage.getItem('cookieConsent');
        if (cookieConsent === 'accepted') {
          (window as any).fbq('track', 'CompleteRegistration', {
            status: true,
            content_name: 'Google OAuth Signup',
            value: 0,
            currency: 'USD'
          });
          console.log('Meta Pixel: CompleteRegistration event fired for Google signup');
        }
      }

      trackMetaCompleteRegistration({ method: 'google_oauth' })
    } catch (error: unknown) {
      setMessage((error as Error).message || 'An error occurred')
      setIsLoading(false)
      setLoadingMessage('')
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
        <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl shadow-xl shadow-gray-200/20 p-8 relative">
          {/* Loading Overlay */}
          {(isLoading || isRedirecting) && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
              <div className="bg-white rounded-xl p-6 shadow-lg flex items-center space-x-3">
                <div className="w-6 h-6 border-3 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                <span className="text-gray-700 font-medium">{loadingMessage || 'Creating your account...'}</span>
              </div>
            </div>
          )}
          
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Create your account
            </h2>
            <p className="text-gray-600 text-sm">
              Start creating amazing ads with AI
            </p>
          </div>
          
          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="space-y-4">
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
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white/50"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 bg-white/50"
                  placeholder="Confirm your password"
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
              disabled={isLoading || isRedirecting}
              className={`w-full font-medium py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 shadow-lg ${
                (isLoading || isRedirecting)
                  ? 'bg-gray-400 cursor-not-allowed transform scale-98'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 hover:scale-105 shadow-blue-500/20'
              }`}
            >
              {(isLoading || isRedirecting) ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span className="text-white">{loadingMessage || 'Creating Account...'}</span>
                </div>
              ) : (
                <span className="text-white">Create Account</span>
              )}
            </button>
          </form>

          {/* Google Sign In */}
          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            disabled={isLoading || isRedirecting}
            className="w-full mt-4 bg-white border border-gray-300 text-gray-700 font-medium py-3 px-4 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm flex items-center justify-center space-x-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="mt-6 text-center space-y-3">
            <Link
              href="/signin"
              className="block text-sm text-gray-600 hover:text-gray-900 transition-colors duration-200"
            >
              Already have an account? Sign in
            </Link>
            <Link
              href="/forgot-password"
              className="block text-sm text-blue-600 hover:text-blue-700 transition-colors duration-200"
            >
              Forgot your password?
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-center text-xs text-gray-500">
              By continuing, you agree to our{' '}
              <Link href="/terms" className="text-blue-600 hover:text-blue-700">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-blue-600 hover:text-blue-700">
                Privacy Policy
              </Link>
            </p>
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