'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import { type StripePlan } from '@/lib/stripe-plans'
import DashboardLayout from '@/components/DashboardLayout'
import PricingPlans from '@/components/PricingPlans'

interface BillingClientProps {
  user: User
  profile: Profile
}

export default function BillingClient({ user, profile }: BillingClientProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const searchParams = useSearchParams()

  // Track Meta Pixel Purchase event when returning from successful checkout
  useEffect(() => {
    const success = searchParams.get('success')
    
    if (success === 'true') {
      // Fire Meta Pixel Purchase event
      if (typeof window !== 'undefined' && (window as any).fbq) {
        const cookieConsent = localStorage.getItem('cookieConsent')
        if (cookieConsent === 'accepted') {
          const fbq = (window as any).fbq
          
          // Determine plan details from profile
          const planName = getPlanDisplayName()
          const planId = profile.subscription_id?.toLowerCase() || 'unknown'
          
          // Get plan value
          let value = 0
          if (planId.includes('starter')) value = 9.99
          else if (planId.includes('pro')) value = 29.99
          else if (planId.includes('business')) value = 99.99
          
          fbq('track', 'Purchase', {
            value: value,
            currency: 'USD',
            content_type: 'product',
            content_ids: [planId],
            content_name: planName,
            num_items: 1
          })
          
          console.log(`🔥 Meta Pixel Purchase event tracked: ${planName} ($${value})`)
        }
      }
      
      // Clean up URL by removing success parameter
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      window.history.replaceState({}, '', url.pathname)
    }
  }, [searchParams, profile.subscription_id])

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
    return 'Free Plan'
  }

  const getSubscriptionStatus = () => {
    if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
      return 'Active'
    } else if (profile.subscription_status === 'canceled' || profile.subscription_status === 'cancelled') {
      return 'Cancelled'
    }
    return 'Free Plan'
  }

  const handleSubscribe = async (plan: StripePlan) => {
    setIsLoading(plan)
    try {
      // � Track Meta Pixel InitiateCheckout event
      if (typeof window !== 'undefined' && (window as any).fbq) {
        const cookieConsent = localStorage.getItem('cookieConsent')
        if (cookieConsent === 'accepted') {
          const fbq = (window as any).fbq
          
          let value = 0
          if (plan === 'starter') value = 9.99
          else if (plan === 'pro') value = 29.99
          else if (plan === 'business') value = 99.99
          
          fbq('track', 'InitiateCheckout', {
            value: value,
            currency: 'USD',
            content_type: 'product',
            content_ids: [plan],
            content_name: `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan`,
            num_items: 1
          })
          
          console.log(`🔥 Meta Pixel InitiateCheckout tracked: ${plan} ($${value})`)
        }
      }

      // �🚀 Track TikTok InitiateCheckout event
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
        console.error('❌ Failed to track TikTok InitiateCheckout:', tikTokError);
      }

      // Create checkout session via API
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing?cancelled=true`,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
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
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') ? 'bg-purple-100' : 'bg-gray-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') ? 'text-purple-600' : 'text-gray-600'
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
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') ? 'bg-green-100' : 
                (profile.subscription_status === 'canceled' || profile.subscription_status === 'cancelled') ? 'bg-red-100' : 
                'bg-gray-100'
              }`}>
                <svg className={`w-6 h-6 ${
                  (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') ? 'text-green-600' : 
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
                  {(profile.subscription_status === 'active' || profile.subscription_status === 'trialing') && profile.updated_at ? 
                    (() => {
                      const nextBilling = new Date(profile.updated_at);
                      nextBilling.setDate(nextBilling.getDate() + 30);
                      return nextBilling.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      });
                    })()
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
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Subscription Plans</h2>
            <p className="text-sm text-gray-600">Choose the plan that best fits your needs.</p>
          </div>
          
          <PricingPlans 
            onSubscribeAction={handleSubscribe}
            isLoading={isLoading}
            variant="page"
            showAllPlans={true}
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
                    Credits are renewed monthly with your subscription
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Unused credits do not roll over to the next month
                  </li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-900 mb-3">Subscription Management</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    You can upgrade or downgrade your plan at any time
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">•</span>
                    Changes take effect at the next billing cycle
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