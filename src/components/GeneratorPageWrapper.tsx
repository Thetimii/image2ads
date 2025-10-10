'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import ChatGenerator from '@/components/ChatGenerator'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import PricingPlans from '@/components/PricingPlans'

interface GeneratorPageWrapperProps {
  user: User
  profile: Profile
}

export default function GeneratorPageWrapper({ user, profile }: GeneratorPageWrapperProps) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null)

  const handleLockedFeature = () => {
    setShowUpgrade(true)
  }

  const handleSubscribe = async (plan: 'starter' | 'pro' | 'business') => {
    setIsUpgrading(plan)
    try {
      // Create checkout session via API
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}${window.location.pathname}`,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        const errorData = await response.json()
        console.error('Failed to create checkout session:', errorData.error)
        alert('Failed to start checkout. Please try again.')
        setIsUpgrading(null)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
      setIsUpgrading(null)
    }
  }

  return (
    <DashboardLayout user={user} profile={profile}>
      <ChatGenerator 
        user={user} 
        profile={profile} 
        onLockedFeature={handleLockedFeature}
      />
      
      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-gray-900">🎬 Unlock Video Generation</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Video features require a Pro or Business subscription. Choose a plan to get started:
                </p>
              </div>
              <button
                onClick={() => setShowUpgrade(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Plans Grid */}
            <PricingPlans 
              onSubscribeAction={handleSubscribe}
              isLoading={isUpgrading}
              variant="popup"
            />

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
              <p className="text-xs text-gray-500 text-center">
                💳 Secure payment powered by Stripe • Cancel anytime • 30-day money-back guarantee
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}