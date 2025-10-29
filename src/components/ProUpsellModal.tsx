'use client'

import { useState, useEffect } from 'react'
import PricingPlans from './PricingPlans'

interface ProUpsellModalProps {
  onCloseAction: () => void
  onUpgradeAction?: () => void
  isUpgrading?: string | null
}

export default function ProUpsellModal({ onCloseAction, onUpgradeAction, isUpgrading }: ProUpsellModalProps) {
  const [timeLeft, setTimeLeft] = useState({ minutes: 15, seconds: 0 })
  const [isExpired, setIsExpired] = useState(false)
  const [isStarting, setIsStarting] = useState(true)
  const [isUpgradingLocal, setIsUpgradingLocal] = useState<string | null>(null)

  // Initialize timer by calling API to start it
  useEffect(() => {
    const startTimer = async () => {
      try {
        const response = await fetch('/api/pro-discount-status', {
          method: 'POST',
        })
        
        if (response.ok) {
          console.log('✅ Pro discount timer started')
          setIsStarting(false)
        }
      } catch (error) {
        console.error('Failed to start discount timer:', error)
        setIsStarting(false)
      }
    }

    startTimer()
  }, [])

  // Update countdown every second (client-side countdown, verify with server every 30 seconds)
  useEffect(() => {
    if (isExpired || isStarting) return

    // Client-side countdown every second
    const countdownInterval = setInterval(() => {
      setTimeLeft(prev => {
        const totalSeconds = prev.minutes * 60 + prev.seconds - 1
        
        if (totalSeconds <= 0) {
          setIsExpired(true)
          return { minutes: 0, seconds: 0 }
        }
        
        return {
          minutes: Math.floor(totalSeconds / 60),
          seconds: totalSeconds % 60
        }
      })
    }, 1000)

    // Server verification every 30 seconds to ensure accuracy
    const verificationInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/pro-discount-status')
        const data = await response.json()

        if (!data.is_valid) {
          setIsExpired(true)
          clearInterval(countdownInterval)
          clearInterval(verificationInterval)
          return
        }

        // Sync with server time
        setTimeLeft({
          minutes: data.minutes_left,
          seconds: data.seconds_left,
        })

      } catch (error) {
        console.error('Failed to check discount status:', error)
      }
    }, 30000) // Check server every 30 seconds

    return () => {
      clearInterval(countdownInterval)
      clearInterval(verificationInterval)
    }
  }, [isExpired, isStarting])

  const formatTime = () => {
    const mins = String(timeLeft.minutes).padStart(2, '0')
    const secs = String(timeLeft.seconds).padStart(2, '0')
    return `${mins}:${secs}`
  }

  const handleSubscribe = async (plan: 'starter' | 'pro' | 'business') => {
    setIsUpgradingLocal(plan)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          successUrl: `${window.location.origin}/billing?success=true`,
          cancelUrl: `${window.location.origin}/billing`,
          // Only apply discount to Pro plan
          ...(plan === 'pro' && { applyProDiscount: true })
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        window.location.href = url
      } else {
        const errorData = await response.json()
        console.error('Failed to create checkout session:', errorData.error)
        alert('Failed to start checkout. Please try again.')
        setIsUpgradingLocal(null)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
      setIsUpgradingLocal(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header with timer */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center rounded-t-2xl">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900">⚠️ You have 1 credit left</h2>
            <p className="text-sm text-gray-600 mt-1">
              <span className="font-semibold text-purple-600">Limited Time: 20% off Pro Plan</span> — expires in:
            </p>
          </div>
          
          {/* Countdown Timer - compact */}
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl px-6 py-3 shadow-lg">
              <div className="text-center">
                <div className="text-3xl font-mono font-bold text-white tracking-wider">
                  {formatTime()}
                </div>
                <div className="text-xs text-white/90 mt-0.5">
                  remaining
                </div>
              </div>
            </div>
            
            <button
              onClick={onCloseAction}
              className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Plans Grid - same as normal popup */}
        <PricingPlans 
          onSubscribeAction={handleSubscribe}
          isLoading={isUpgradingLocal}
          variant="popup"
          discountPercentage={20}
          couponId="VbLhruZu"
        />

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-500 text-center">
            💳 Secure payment powered by Stripe • Cancel anytime • 30-day money-back guarantee
          </p>
        </div>
      </div>
    </div>
  )
}
