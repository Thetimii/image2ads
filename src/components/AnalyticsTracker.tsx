'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { trackPageView, trackScrollDepth, flushOnHide, ping, captureClickIds, track, identify } from '@/lib/analytics'
import { createClient } from '@/lib/supabase/client'

const SCROLL_MILESTONES = [25, 50, 75, 100]
const PING_INTERVAL_MS = 30000

/**
 * Mounted once in the root layout. Automatically tracks:
 *  - page_view on every route change
 *  - scroll_depth milestones (25/50/75/100%) per page
 *  - page_left with time-on-page when the tab closes or hides
 *  - a ping every 30s while visible, so session duration stays accurate
 */
export default function AnalyticsTracker() {
  const pathname = usePathname()
  const pageEnteredAt = useRef(Date.now())
  const reachedMilestones = useRef(new Set<number>())

  // Page views + reset per-page state on route change
  useEffect(() => {
    pageEnteredAt.current = Date.now()
    reachedMilestones.current = new Set()
    trackPageView(pathname)

    // Checkout modals append ?checkout=cancelled to their Stripe cancel_url
    // so we can detect "started checkout, came back without paying" no
    // matter which page they land back on (billing/dashboard/generator).
    const params = new URLSearchParams(window.location.search)
    if (params.get('checkout') === 'cancelled') {
      track('checkout_cancelled', {})
      params.delete('checkout')
      const query = params.toString()
      window.history.replaceState({}, '', pathname + (query ? `?${query}` : ''))
    }
  }, [pathname])

  useEffect(() => {
    captureClickIds()

    // Safety net: if signup-time identification ever misses (network blip,
    // an OAuth edge case, etc.), re-establish the anonymous_id->user_id link
    // on the very next authenticated page load instead of losing it forever.
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user?.id) identify(data.user.id)
      })
      .catch(() => {})

    const onScroll = () => {
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      const depth =
        scrollable <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / scrollable) * 100))
      for (const milestone of SCROLL_MILESTONES) {
        if (depth >= milestone && !reachedMilestones.current.has(milestone)) {
          reachedMilestones.current.add(milestone)
          trackScrollDepth(milestone)
        }
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushOnHide(Math.round((Date.now() - pageEnteredAt.current) / 1000))
      }
    }

    const pingTimer = setInterval(() => {
      if (document.visibilityState === 'visible') ping()
    }, PING_INTERVAL_MS)

    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onVisibilityChange)

    return () => {
      clearInterval(pingTimer)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onVisibilityChange)
    }
  }, [])

  return null
}
