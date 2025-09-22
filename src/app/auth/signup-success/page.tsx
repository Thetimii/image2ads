'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SignupSuccessTracking() {
  const router = useRouter()

  useEffect(() => {
    // Fire Meta Pixel CompleteRegistration event for OAuth signups
    if (typeof window !== 'undefined' && (window as any).fbq) {
      const cookieConsent = localStorage.getItem('cookieConsent')
      if (cookieConsent === 'accepted') {
        (window as any).fbq('track', 'CompleteRegistration', {
          status: true,
          content_name: 'OAuth Signup Completion',
          value: 0,
          currency: 'USD'
        })
        console.log('Meta Pixel: CompleteRegistration event fired for OAuth signup completion')
      }
    }
    
    // Redirect to dashboard after a brief delay
    const timer = setTimeout(() => {
      router.push('/dashboard')
    }, 500)
    
    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Setting up your account...</p>
      </div>
    </div>
  )
}