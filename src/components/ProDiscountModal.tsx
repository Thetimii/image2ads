'use client'

import { useState, useEffect } from 'react'
import {
  trackMetaAddPaymentInfo,
  trackMetaInitiateCheckout,
  trackMetaSubscribedButtonClick,
} from '@/lib/meta-events'

interface ProDiscountModalProps {
  onCloseAction: () => void
  onUpgradeAction?: () => void
}

export default function ProDiscountModal({ onCloseAction, onUpgradeAction }: ProDiscountModalProps) {
  const [timeLeft, setTimeLeft] = useState({ minutes: 15, seconds: 0 })
  const [isExpired, setIsExpired] = useState(false)
  const [isStarting, setIsStarting] = useState(true)
  const [isUpgrading, setIsUpgrading] = useState(false)

  // Initialize timer by calling API to start it OR get remaining time
  useEffect(() => {
    const startTimer = async () => {
      try {
        console.log('🚀 Checking/starting Pro discount timer...')
        
        // First check if already activated
        const checkResponse = await fetch('/api/pro-discount-status')
        const checkData = await checkResponse.json()
        
        if (checkData.is_valid) {
          // Already activated, use the remaining time
          console.log('⏰ Discount already active, syncing time:', checkData)
          setTimeLeft({
            minutes: checkData.minutes_left,
            seconds: checkData.seconds_left,
          })
          setIsStarting(false)
        } else if (checkData.discount_never_activated) {
          // Not activated yet, activate it now
          console.log('🆕 Activating discount for first time')
          const response = await fetch('/api/pro-discount-status', {
            method: 'POST',
          })
          
          if (response.ok) {
            const data = await response.json()
            console.log('✅ Pro discount timer started:', data)
            // Set initial time to 15:00
            setTimeLeft({ minutes: 15, seconds: 0 })
            setIsStarting(false)
          } else {
            console.error('❌ Failed to start timer:', response.status, response.statusText)
            setIsStarting(false)
          }
        } else {
          // Expired
          console.log('⏱️ Discount expired')
          setIsExpired(true)
          setIsStarting(false)
        }
      } catch (error) {
        console.error('❌ Failed to start discount timer:', error)
        setIsStarting(false)
      }
    }

    startTimer()
  }, [])

  // Update countdown every second
  useEffect(() => {
    if (isExpired || isStarting) return

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

    // Server verification every 30 seconds
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

        setTimeLeft({
          minutes: data.minutes_left,
          seconds: data.seconds_left,
        })
      } catch (error) {
        console.error('Failed to check discount status:', error)
      }
    }, 30000)

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

  const handleUpgrade = async () => {
    setIsUpgrading(true)
    const metaOptions = {
      plan: 'pro' as const,
      couponId: 'VbLhruZu',
      source: 'pro_discount_modal',
    }
    trackMetaSubscribedButtonClick(metaOptions)
    try {
      trackMetaInitiateCheckout(metaOptions)
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan: 'pro',
          successUrl: `${window.location.origin}/dashboard?upgrade=success`,
          cancelUrl: `${window.location.origin}/dashboard`,
          applyProDiscount: true
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
        setIsUpgrading(false)
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('Failed to start checkout. Please try again.')
      setIsUpgrading(false)
    }
  }

  const originalPrice = 19.99
  const discountedPrice = (originalPrice * 0.8).toFixed(2) // 20% off

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4">
          <button
            onClick={onCloseAction}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl leading-none"
            disabled={isUpgrading}
          >
            ×
          </button>
          
          <div className="text-center mb-4">
            <div className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl px-6 py-3 mb-4">
              <div className="text-3xl font-mono font-bold text-white tracking-wider">
                {formatTime()}
              </div>
              <div className="text-xs text-white/90">
                Offer expires in
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ✨ Unlock Pro with 20% Off
            </h2>
            <p className="text-gray-600">
              Your next level is here — get 200 monthly credits, HD quality, and AI video generation.
            </p>
          </div>
        </div>

        {/* Plan Card */}
        <div className="px-6 pb-6">
          <div className="relative rounded-xl p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-500">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-xs font-semibold">
              LIMITED TIME OFFER
            </div>
            
            <div className="text-center mb-4 pt-2">
              <h3 className="text-xl font-bold text-gray-900">Pro Plan</h3>
              <div className="mt-2 flex flex-col items-center">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-400 line-through">CHF {originalPrice}</span>
                  <span className="text-4xl font-bold text-gray-900">CHF {discountedPrice}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-gray-500">/month</span>
                  <span className="bg-pink-500 text-white text-xs px-2 py-1 rounded-full font-semibold">-20%</span>
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">200 credits per month</p>
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-6">
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">200 image credits per month</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">AI video generator</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">AI music generator</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700">Commercial license</span>
              </li>
            </ul>

            {/* Upgrade Button */}
            <button
              onClick={handleUpgrade}
              disabled={isUpgrading}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUpgrading ? 'Processing...' : 'Upgrade to Pro'}
            </button>
          </div>

          {/* Continue Button */}
          <button
            onClick={onCloseAction}
            disabled={isUpgrading}
            className="w-full mt-4 text-gray-600 hover:text-gray-800 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Continue (use last free credit)
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-500 text-center">
            💳 Secure payment • Auto-renews monthly • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
}
