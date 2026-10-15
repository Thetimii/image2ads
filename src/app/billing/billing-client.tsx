'use client'

import { getStoredFbc } from '@/lib/analytics'
import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import { type StripePlan } from '@/lib/stripe-plans'
import DashboardLayout from '@/components/DashboardLayout'
import PricingPlans from '@/components/PricingPlans'
import { marketingAllowed } from '@/lib/consent'
import {
  trackMetaAddPaymentInfo,
  trackMetaInitiateCheckout,
  trackMetaPurchase,
  trackMetaSubscribedButtonClick,
  trackMetaAddToCart,
  trackMetaStartTrial,
} from '@/lib/meta-events'

interface BillingClientProps {
  user: User
  profile: Profile
}

export default function BillingClient({ user, profile }: BillingClientProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [hasActiveDiscount, setHasActiveDiscount] = useState(false)
  const [discountPercentage, setDiscountPercentage] = useState(0)

  // Check if Pro discount is active
  useEffect(() => {
    const checkDiscount = async () => {
      try {
        const response = await fetch('/api/pro-discount-status')
        const data = await response.json()

        if (data.is_valid) {
          console.log('✅ Active 50% discount detected on billing page')
          setHasActiveDiscount(true)
          setDiscountPercentage(50)
        }
      } catch (error) {
        console.error('Error checking discount:', error)
      }
    }

    checkDiscount()
  }, [])

  // Check for promo parameter and redirect to Pro checkout with discount
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const promo = searchParams.get('promo')

    if (promo === 'pro20limited') {
      // Verify discount is still valid before redirecting
      const checkAndRedirect = async () => {
        try {
          // First check status
          const response = await fetch('/api/pro-discount-status')
          const data = await response.json()

          let isValid = data.is_valid

          // If expired but user has the special email link, REACTIVATE it for 1 hour
          if (!isValid) {
            console.log('🔄 Reactivating expired discount for email user...')
            const activateResponse = await fetch('/api/pro-discount-status', {
              method: 'POST',
            })
            if (activateResponse.ok) {
              isValid = true
              console.log('✅ Discount reactivated successfully')
            }
          }

          if (isValid) {
            console.log('✨ Pro 50% discount is valid, redirecting to checkout...')
            setIsLoading('pro')
            const metaOptions = {
              plan: 'pro' as const,
              couponId: 'fqVEydW3',
              source: 'billing_promo_redirect',
            }
            trackMetaSubscribedButtonClick(metaOptions)
            trackMetaInitiateCheckout(metaOptions)

            // Create checkout with discount
            const checkoutResponse = await fetch('/api/stripe/create-checkout-session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                fbc: getStoredFbc(),
                plan: 'pro',
                applyProDiscount: true, // Special flag for discount
                successUrl: `${window.location.origin}/billing?success=true`,
                cancelUrl: `${window.location.origin}/billing`,
              }),
            })

            if (checkoutResponse.ok) {
              const { url } = await checkoutResponse.json()
              trackMetaAddPaymentInfo(metaOptions)
              window.location.href = url
            } else {
              console.error('Failed to create checkout session')
              setIsLoading(null)
              window.history.replaceState({}, '', '/billing')
            }
          } else {
            console.log('⏰ Pro discount expired or not available')
            window.history.replaceState({}, '', '/billing')
          }
        } catch (error) {
          console.error('Error checking Pro discount:', error)
          setIsLoading(null)
          window.history.replaceState({}, '', '/billing')
        }
      }

      checkAndRedirect()
    }
  }, [])

  // Track successful purchase when user returns from Stripe. The value comes
  // from the checkout session itself (yearly plans and credit packs have
  // different amounts); the event id matches the webhook's CAPI event so
  // Meta dedupes them into one conversion.
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('success') !== 'true') return
    const stripeSessionId = searchParams.get('session_id')
    window.history.replaceState({}, '', '/billing')
    if (!stripeSessionId) return

    const eventId = `purchase_${stripeSessionId}`
    fetch(`/api/stripe/session-summary?session_id=${encodeURIComponent(stripeSessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((summary) => {
        if (!summary || !(summary.amount > 0)) return
        const planKey = summary.plan === 'starter' || summary.plan === 'pro' || summary.plan === 'business' ? summary.plan : undefined
        const contentName = summary.pack
          ? `Credit pack ${summary.pack}`
          : `${planKey ? planKey.charAt(0).toUpperCase() + planKey.slice(1) : 'Subscription'} Plan (${summary.interval === 'year' ? 'yearly' : 'monthly'})`
        const value = Number(summary.amount)

        if (typeof window !== 'undefined' && (window as any).fbq && marketingAllowed()) {
          if (summary.isTrial) {
            (window as any).fbq('track', 'StartTrial', { value, currency: summary.currency }, { eventID: eventId })
          } else {
            (window as any).fbq('track', 'Purchase', {
              value,
              currency: summary.currency,
              content_name: contentName,
              content_type: 'product',
              content_ids: [summary.pack || planKey || 'subscription'],
            }, { eventID: eventId })
          }
        }
        const opts = { ...(planKey ? { plan: planKey } : {}), value, contentName, source: 'billing_success', eventId }
        if (summary.isTrial) trackMetaStartTrial(opts)
        else trackMetaPurchase(opts)
      })
      .catch(() => {})
  }, [])

  // Function to determine plan display name based on subscription_id (which now contains product ID)
  const getPlanDisplayName = () => {
    // Debug: Log the current subscription info
    console.log('Debug - Profile subscription info:', {
      subscription_status: profile.subscription_status,
      subscription_id: profile.subscription_id,
      stripe_customer_id: profile.stripe_customer_id
    })

    if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
      // Check if subscription_id contains a product ID
      if (profile.subscription_id) {
        const subId = profile.subscription_id.toLowerCase()
        console.log('Debug - Checking subscription_id:', subId)

        switch (subId) {
          case 'starter':
          case 'prod_t2wztl6zmyzqda': // Stripe product ID for starter
            return 'Starter Plan'
          case 'pro':
          case 'prod_t2x00jxheiyfr4': // Stripe product ID for pro  
            return 'Pro Plan'
          case 'business':
          case 'prod_t2x1ll9q9hicqr': // Stripe product ID for business
            return 'Business Plan'
          default:
            console.log('Debug - No match found for subscription_id:', subId)
            return `Subscribed Plan (${profile.subscription_id})` // Show the actual value for debugging
        }
      }
      return 'Subscribed Plan'
    }
    if ((profile as { has_paid?: boolean }).has_paid) return 'Pay as you go'
    return 'Free Plan'
  }

  const getSubscriptionStatus = () => {
    if (profile.subscription_status === 'trialing') {
      return 'Trial'
    } else if (profile.subscription_status === 'active') {
      return 'Active'
    } else if (profile.subscription_status === 'canceled' || profile.subscription_status === 'cancelled') {
      return 'Cancelled'
    }
    return 'Free Plan'
  }

  const handleSubscribe = async (plan: StripePlan, couponId?: string, interval: 'month' | 'year' = 'month') => {
    setIsLoading(plan)
    const metaOptions = {
      plan,
      couponId,
      source: 'billing_page',
      interval,
    }
    trackMetaSubscribedButtonClick(metaOptions)
    trackMetaAddToCart(metaOptions)
    try {
      // 🚀 Track TikTok InitiateCheckout event
      try {
        await fetch('/api/tiktok-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'InitiateCheckout',
            contentId: plan,
            contentName: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
          }),
        });
        console.log(`✅ TikTok InitiateCheckout event tracked for ${plan} plan`);
      } catch (tikTokError) {
        console.error('❌ Failed to track TikTok InitiateCheckout:', tikTokError)
      }

      trackMetaInitiateCheckout(metaOptions)

      // Create checkout session via API
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fbc: getStoredFbc(),
          plan,
          interval,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing?cancelled=true`,
          // Apply discount if active and user is selecting Pro plan
          ...(hasActiveDiscount && plan === 'pro' && { applyProDiscount: true }),
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        trackMetaAddPaymentInfo(metaOptions)
        window.location.href = url
      } else {
        const errorData = await response.json()
        console.error('Failed to create checkout session:', errorData.error)
        alert('Failed to start checkout. Please try again.')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
    } finally {
      setIsLoading(null)
    }
  }

  const handleManageBilling = async () => {
    setIsLoading('portal')
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/billing`,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        const errorData = await response.json()
        console.error('Failed to create portal session:', errorData.error)
        alert('Failed to access billing portal. Please try again.')
      }
    } catch (error) {
      console.error('Error creating portal session:', error)
      alert('Failed to access billing portal. Please try again.')
    } finally {
      setIsLoading(null)
    }
  }

  // Lock navigation if tutorial not completed
  const isNavigationLocked = !profile.tutorial_completed

  return (
    <DashboardLayout user={user} profile={profile} isNavigationLocked={isNavigationLocked}>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Usage & Billing</h1>
          <p className="text-gray-600">
            Manage your subscription, view usage, and access billing information.
          </p>
        </div>

        {/* Current status */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available Credits</p>
                <p className="text-2xl font-bold text-gray-900">{profile.credits}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Current Plan</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getPlanDisplayName()}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${(profile.subscription_status === 'active' || profile.subscription_status === 'trialing') ? 'bg-purple-100' : 'bg-gray-100'
                }`}>
                <svg className={`w-6 h-6 ${(profile.subscription_status === 'active' || profile.subscription_status === 'trialing') ? 'text-purple-600' : 'text-gray-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Subscription Status</p>
                <p className="text-2xl font-bold text-gray-900">
                  {getSubscriptionStatus()}
                </p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${(profile.subscription_status === 'active' || profile.subscription_status === 'trialing') ? 'bg-green-100' :
                (profile.subscription_status === 'canceled' || profile.subscription_status === 'cancelled') ? 'bg-red-100' :
                  'bg-gray-100'
                }`}>
                <svg className={`w-6 h-6 ${(profile.subscription_status === 'active' || profile.subscription_status === 'trialing') ? 'text-green-600' :
                  (profile.subscription_status === 'canceled' || profile.subscription_status === 'cancelled') ? 'text-red-600' :
                    'text-gray-600'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {(profile.subscription_status === 'active' || profile.subscription_status === 'trialing') ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  ) : (profile.subscription_status === 'canceled' || profile.subscription_status === 'cancelled') ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  )}
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Next Billing</p>
                <p className="text-lg font-bold text-gray-900">
                  {profile.subscription_status === 'trialing'
                    ? 'After trial'
                    : profile.subscription_status === 'active'
                      ? 'Auto-renews'
                      : 'N/A'}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border border-gray-200 mb-8 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap gap-4">
              <button
                onClick={handleManageBilling}
                disabled={isLoading === 'portal'}
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl transition-colors duration-200 disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{isLoading === 'portal' ? 'Loading...' : 'Manage Billing'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Pricing plans */}
        <div className="bg-white rounded-2xl border border-gray-200 mb-8 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Plans & credits</h2>
            <p className="text-sm text-gray-600">Pay yearly and save about a third, or grab a one-time credit pack.</p>
          </div>

          <PricingPlans
            onSubscribeAction={handleSubscribe}
            isLoading={isLoading}
            variant="page"
            showAllPlans={true}
            discountPercentage={hasActiveDiscount ? 50 : undefined}
            couponId={hasActiveDiscount ? 'fqVEydW3' : undefined}
          />
        </div>

        {/* Usage information */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Usage Information</h2>
            <p className="text-sm text-gray-600">Important details about credits and billing.</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Credit System</h3>
                <ul className="space-y-2 text-sm text-gray-600">

                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    1 credit = 1 HD image · Pro images 6 · video 8 · music 3
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Monthly plans add credits every month; yearly plans add the whole year upfront
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Unused credits roll over, and credit packs never expire
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-3">Subscription Management</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Subscriptions renew automatically unless cancelled
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    You can upgrade or downgrade your plan at any time
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Upgrades take effect immediately with instant access
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Keep all credits and features until subscription ends
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Cancel anytime with no hidden fees
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}