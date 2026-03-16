'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { trackMetaCompleteRegistration } from '@/lib/meta-events'
import { createClient } from '@/lib/supabase/client'

export default function SignupSuccessTracking() {
  const router = useRouter()

  useEffect(() => {
    const trackOAuthSignup = async () => {
      // 🚀 Generate Deduplication ID
      const eventId = `registration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Fire Meta Pixel CompleteRegistration event for OAuth signups
      if (typeof window !== 'undefined' && (window as any).fbq) {
        const cookieConsent = localStorage.getItem('cookieConsent')
        if (cookieConsent === 'accepted') {
          (window as any).fbq('track', 'CompleteRegistration', {
            status: true,
            content_name: 'OAuth Signup Completion',
            value: 0,
            currency: 'USD'
          }, { eventID: eventId })
          console.log(`Meta Pixel: CompleteRegistration event fired for OAuth signup completion [eventId: ${eventId}]`)
        }
      }

      // Fire Server-Side CAPI
      trackMetaCompleteRegistration({ method: 'google_oauth' }, eventId)

      // 🚀 track TikTok CompleteRegistration event
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await fetch('/api/tiktok-event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'CompleteRegistration',
              email: user.email,
              userId: user.id,
            }),
          })
          console.log('✅ TikTok CompleteRegistration event tracked from OAuth success')
        }
      } catch (tikTokError) {
        console.error('❌ Failed to track TikTok event from OAuth success:', tikTokError)
      }
    }

    trackOAuthSignup()
    
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