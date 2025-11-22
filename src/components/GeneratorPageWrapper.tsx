'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import ChatGenerator from '@/components/ChatGenerator'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/validations'
import PricingPlans from '@/components/PricingPlans'
import ProUpsellModal from '@/components/ProUpsellModal'
import ProTrialModal from '@/components/ProTrialModal'
import {
  trackMetaAddPaymentInfo,
  trackMetaInitiateCheckout,
  trackMetaSubscribedButtonClick,
  trackMetaViewContent,
} from '@/lib/meta-events'

interface GeneratorPageWrapperProps {
  user: User
  profile: Profile
  onShowUpgrade?: () => void
}

export default function GeneratorPageWrapper({ user, profile, onShowUpgrade }: GeneratorPageWrapperProps) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [showProUpsellModal, setShowProUpsellModal] = useState(false)
  const [showProTrialModal, setShowProTrialModal] = useState(false)
  const [isUpgrading, setIsUpgrading] = useState<string | null>(null)
  const [hasActiveDiscount, setHasActiveDiscount] = useState(false)
  const [discountMinutes, setDiscountMinutes] = useState(0)
  const [discountSeconds, setDiscountSeconds] = useState(0)

  // Check for active discount on mount and update timer
  useEffect(() => {
    const checkDiscount = async () => {
      try {
        const response = await fetch('/api/pro-discount-status')
        const data = await response.json()
        
        if (data.is_valid) {
          setHasActiveDiscount(true)
          setDiscountMinutes(data.minutes_left)
          setDiscountSeconds(data.seconds_left)
        }
      } catch (err) {
        console.error('Failed to check discount:', err)
      }
    }
    
    checkDiscount()
    
    // Update discount timer every second if active
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/pro-discount-status')
        const data = await response.json()
        
        if (data.is_valid) {
          setHasActiveDiscount(true)
          setDiscountMinutes(data.minutes_left)
          setDiscountSeconds(data.seconds_left)
        } else {
          setHasActiveDiscount(false)
        }
      } catch (err) {
        console.error('Failed to update discount:', err)
      }
    }, 30000) // Check every 30 seconds
    
    return () => clearInterval(interval)
  }, [])

  // 🚀 Track TikTok ViewContent on page load
  useEffect(() => {
    const trackViewContent = async () => {
      try {
        await fetch('/api/tiktok-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'ViewContent',
            contentId: 'generator',
            contentName: 'AI Generator Dashboard',
          }),
        })
        console.log('✅ TikTok ViewContent event tracked')
      } catch (error) {
        console.error('❌ Failed to track TikTok ViewContent:', error)
      }
    }
    
    trackViewContent()
    trackMetaViewContent({
      contentName: 'AI Generator Dashboard',
      contentCategory: 'dashboard',
      contentIds: ['generator'],
      source: 'generator_dashboard',
    })
  }, []); // Only run once on mount

  const handleLockedFeature = async () => {
    // Check if there's an active 15-minute discount window
    try {
      const response = await fetch('/api/pro-discount-status')
      const data = await response.json()
      
      // Show discount modal if discount is active (is_valid = true)
      if (data.is_valid) {
        setShowProUpsellModal(true)
      } else {
        // Otherwise show normal upgrade popup
        setShowUpgrade(true)
      }
    } catch (err) {
      // On error, show normal popup
      setShowUpgrade(true)
    }
  }

  // Handler for showing trial modal
  const handleShowTrialModal = () => {
    // Always show the Pro trial modal when clicking "$5 Pro Trial" button
    setShowProTrialModal(true)
  }

  // Lock navigation if tutorial not completed
  const isNavigationLocked = !profile.tutorial_completed

  const handleSubscribe = async (plan: 'starter' | 'pro' | 'business', couponId?: string) => {
    setIsUpgrading(plan)
    const metaOptions = {
      plan,
      couponId,
      source: 'generator_pricing_modal',
    }
    trackMetaSubscribedButtonClick(metaOptions)
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
          plan,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}${window.location.pathname}`,
          // Apply discount if active and Pro plan
          ...(hasActiveDiscount && plan === 'pro' && { applyProDiscount: true })
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
        setIsUpgrading(null)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
      setIsUpgrading(null)
    }
  }

  return (
    <DashboardLayout user={user} profile={profile} isNavigationLocked={isNavigationLocked}>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <ChatGenerator 
          user={user} 
          profile={profile} 
          onLockedFeature={handleLockedFeature}
          onShowUpgrade={handleShowTrialModal}
        />
      </div>
      
      {/* Pro Trial Modal ($5 trial) */}
      {showProTrialModal && (
        <ProTrialModal
          onCloseAction={() => setShowProTrialModal(false)}
          onStartTrialAction={() => {}}
          source="trial_button"
        />
      )}
      
      {/* Pro Upsell Modal with discount */}
      {showProUpsellModal && (
        <ProUpsellModal
          onCloseAction={() => setShowProUpsellModal(false)}
          isUpgrading={isUpgrading}
        />
      )}
      
      {/* Normal Upgrade Modal */}
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
              discountPercentage={hasActiveDiscount ? 20 : undefined}
              couponId={hasActiveDiscount ? 'VbLhruZu' : undefined}
            />

            {/* Footer */}
            <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
              <p className="text-xs text-gray-500 text-center">
                💳 Secure payment powered by Stripe • Auto-renews monthly • Cancel anytime
              </p>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
