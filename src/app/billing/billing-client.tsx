'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import { STRIPE_PLANS, type StripePlan } from '@/lib/stripe-plans'
import DashboardLayout from '@/components/DashboardLayout'

interface BillingClientProps {
  user: User
  profile: Profile
}

export default function BillingClient({ user, profile }: BillingClientProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  // Function to determine plan display name based on subscription_id (which now contains product ID)
  const getPlanDisplayName = () => {
    if (profile.subscription_status === 'active' || profile.subscription_status === 'trialing') {
      // Check if subscription_id contains a product ID
      if (profile.subscription_id) {
        switch (profile.subscription_id.toLowerCase()) {
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
            return 'Subscribed Plan' // Fallback for old subscription IDs
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
      const planData = STRIPE_PLANS[plan]
      
      // Construct payment link with prefilled email
      const paymentUrl = new URL(planData.paymentLink)
      if (user.email) {
        paymentUrl.searchParams.set('prefilled_email', user.email)
      }
      
      // Redirect to payment link
      window.location.href = paymentUrl.toString()
    } catch (error) {
      console.error('Error redirecting to payment link:', error)
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

  return (
    <DashboardLayout user={user} profile={profile}>
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
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(STRIPE_PLANS).map(([key, plan]) => (
                <div
                  key={key}
                  className={`relative rounded-2xl p-6 border-2 transition-all duration-200 ${
                    key === 'pro' 
                      ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg shadow-blue-100/50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {key === 'pro' && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-xs font-medium">
                        Best Value
                      </span>
                    </div>
                  )}
                  
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.name}</h3>
                    <div className="mb-2">
                      <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-500 ml-1">/month</span>
                    </div>
                  </div>

                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">{plan.credits} credits per month</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">High-quality AI generation</span>
                    </li>
                    <li className="flex items-center">
                      <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-700">Priority processing</span>
                    </li>
                  </ul>

                  <button
                    onClick={() => handleSubscribe(key as StripePlan)}
                    disabled={isLoading === key}
                    className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                      key === 'pro'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 focus:ring-blue-500 shadow-lg shadow-blue-500/20'
                        : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
                    }`}
                  >
                    {isLoading === key ? (
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Loading...</span>
                      </div>
                    ) : (
                      `Subscribe to ${plan.name}`
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
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