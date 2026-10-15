'use client'

/**
 * Main paywall (pricing v2). Shown when free credits run out, on the header
 * "Upgrade" button and on locked features. Leads with yearly plans (the whole
 * year paid upfront = ad spend paid back on day one), with monthly plans and
 * one-time credit packs as alternatives. File name kept for its many callers.
 */

import { useEffect, useState } from 'react'
import PricingPlans from './PricingPlans'
import { type BillingInterval, type StripePlan } from '@/lib/stripe-plans'
import {
  trackMetaAddPaymentInfo,
  trackMetaInitiateCheckout,
  trackMetaSubscribedButtonClick,
} from '@/lib/meta-events'

interface ProTrialModalProps {
  onCloseAction: () => void
  onStartTrialAction?: () => void
  source?: 'trial_button' | 'auto'
  /** Optional headline override */
  title?: string
  /** Billing interval selected first (yearly by default) */
  defaultInterval?: BillingInterval
}

export default function ProTrialModal({ onCloseAction, source = 'auto', title, defaultInterval = 'year' }: ProTrialModalProps) {
  const [loading, setLoading] = useState<string | null>(null)

  useEffect(() => {
    import('@/lib/analytics').then(({ track }) => track('paywall_viewed', { paywall: 'pricing_v2', source })).catch(() => {})
  }, [source])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseAction()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCloseAction])

  const subscribe = async (plan: StripePlan, _couponId?: string, interval: BillingInterval = 'year') => {
    setLoading(plan)
    const metaOptions = { plan, source: `paywall_${source}_${interval}` }
    trackMetaSubscribedButtonClick(metaOptions)
    trackMetaInitiateCheckout(metaOptions)
    import('@/lib/analytics').then(({ track }) => track('checkout_started', { plan, interval, source: `paywall_${source}` })).catch(() => {})
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          interval,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}${window.location.pathname}?checkout=cancelled`,
        }),
      })
      if (!response.ok) throw new Error(`checkout ${response.status}`)
      const { url } = await response.json()
      trackMetaAddPaymentInfo(metaOptions)
      window.location.href = url
    } catch (error) {
      console.error('Checkout failed:', error)
      alert('Failed to start checkout. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      onClick={onCloseAction}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCloseAction}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full text-2xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close"
        >
          ×
        </button>

        <div className="px-6 pt-8 text-center sm:px-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Keep creating</p>
          <h2 id="paywall-title" className="mt-2 text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {title ?? 'Unlock HD ads with no watermark'}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-gray-600">
            Everything you already made gets unlocked too. Clean downloads, HD quality, AI video and Nano Banana Pro.
          </p>
        </div>

        <PricingPlans
          onSubscribeAction={subscribe}
          isLoading={loading}
          variant="popup"
          defaultInterval={defaultInterval}
          source={`paywall_${source}`}
        />

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-gray-100 px-6 py-4 text-xs text-gray-500">
          <span>🔒 Secure checkout by Stripe</span>
          <span>Cancel anytime</span>
          <span>Commercial use included</span>
        </div>
      </div>
    </div>
  )
}
