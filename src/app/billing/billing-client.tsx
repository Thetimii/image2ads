'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import { STRIPE_PLANS, type StripePlan } from '@/lib/stripe-plans'

interface BillingClientProps {
  user: User
  profile: Profile
}

export default function BillingClient({ user, profile }: BillingClientProps) {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const router = useRouter()

  const handleSubscribe = async (plan: StripePlan) => {
    setIsLoading(plan)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing`,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        console.error('Failed to create checkout session')
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:text-blue-800">
                ← Back to Dashboard
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">Billing & Usage</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Current status */}
          <div className="bg-white rounded-lg shadow mb-8">
            <div className="px-6 py-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Current Status</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">{profile.credits}</div>
                  <div className="text-sm text-gray-500">Credits Remaining</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-medium text-gray-900">
                    {profile.subscription_status === 'active' ? 'Active' : 'Free Plan'}
                  </div>
                  <div className="text-sm text-gray-500">Subscription Status</div>
                </div>
                <div className="text-center">
                  <button
                    onClick={handleManageBilling}
                    disabled={isLoading === 'portal'}
                    className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                  >
                    {isLoading === 'portal' ? 'Loading...' : 'Manage Billing'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pricing plans */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-6 py-8">
              <h2 className="text-lg font-medium text-gray-900 mb-6">Choose Your Plan</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(STRIPE_PLANS).map(([key, plan]) => (
                  <div
                    key={key}
                    className={`border rounded-lg p-6 ${
                      key === 'pro' ? 'border-blue-500 ring-2 ring-blue-500 ring-opacity-20' : 'border-gray-200'
                    }`}
                  >
                    {key === 'pro' && (
                      <div className="text-center">
                        <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                          Most Popular
                        </span>
                      </div>
                    )}
                    
                    <div className="text-center mt-4">
                      <h3 className="text-lg font-medium text-gray-900">{plan.name}</h3>
                      <div className="mt-4">
                        <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
                        <span className="text-gray-500">/month</span>
                      </div>
                    </div>

                    <ul className="mt-6 space-y-3">
                      <li className="flex items-center">
                        <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-600">{plan.credits} credits per month</span>
                      </li>
                      <li className="flex items-center">
                        <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-600">High-quality AI generation</span>
                      </li>
                      <li className="flex items-center">
                        <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-600">Priority processing</span>
                      </li>
                      <li className="flex items-center">
                        <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-gray-600">Coupon discounts available</span>
                      </li>
                    </ul>

                    <button
                      onClick={() => handleSubscribe(key as StripePlan)}
                      disabled={isLoading === key}
                      className={`mt-6 w-full py-2 px-4 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 ${
                        key === 'pro'
                          ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                          : 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
                      }`}
                    >
                      {isLoading === key ? 'Loading...' : `Subscribe to ${plan.name}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Usage history section */}
          <div className="mt-8 bg-white rounded-lg shadow">
            <div className="px-6 py-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Usage Information</h2>
              <div className="text-sm text-gray-600">
                <p className="mb-2">• Each AI generation costs 1 credit</p>
                <p className="mb-2">• Credits are renewed monthly with your subscription</p>
                <p className="mb-2">• Unused credits do not roll over to the next month</p>
                <p>• You can upgrade or downgrade your plan at any time</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}