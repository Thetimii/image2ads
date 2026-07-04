'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { trackMetaCompleteRegistration } from '@/lib/meta-events'
import { createClient } from '@/lib/supabase/client'

// The Meta Pixel script loads async; on this freshly-loaded redirect page it is
// usually NOT ready yet. Poll for it instead of checking once and giving up.
const waitForFbq = (timeoutMs = 3000): Promise<((...args: unknown[]) => void) | null> =>
  new Promise((resolve) => {
    const start = Date.now()
    const check = () => {
      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq
      if (fbq) return resolve(fbq)
      if (Date.now() - start > timeoutMs) return resolve(null)
      setTimeout(check, 100)
    }
    check()
  })

export default function SignupSuccessTracking() {
  const router = useRouter()

  useEffect(() => {
    let redirected = false
    const goToDashboard = () => {
      if (redirected) return
      redirected = true
      router.push('/dashboard')
    }

    const trackOAuthSignup = async () => {
      // 🚀 Generate Deduplication ID
      const eventId = `registration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Fire Server-Side CAPI first — it does not depend on the pixel script
      trackMetaCompleteRegistration({ method: 'google_oauth' }, eventId)

      // First-party analytics (Supabase analytics_events)
      import('@/lib/analytics').then(({ track }) => track('signup_completed', { method: 'google_oauth' })).catch(() => {})

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

      // Fire Meta Pixel CompleteRegistration event for OAuth signups
      const cookieConsent = localStorage.getItem('cookieConsent')
      if (cookieConsent === 'accepted') {
        const fbq = await waitForFbq()
        if (fbq) {
          fbq('track', 'CompleteRegistration', {
            status: true,
            content_name: 'OAuth Signup Completion',
            value: 0,
            currency: 'USD'
          }, { eventID: eventId })
          console.log(`Meta Pixel: CompleteRegistration event fired for OAuth signup completion [eventId: ${eventId}]`)
        } else {
          console.warn('Meta Pixel: fbq did not load in time, browser event skipped (CAPI already sent)')
        }
      }
    }

    trackOAuthSignup().finally(goToDashboard)

    // Hard fallback: never leave the user stuck on this page
    const timer = setTimeout(goToDashboard, 5000)

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
