'use client'

import { useState } from 'react'
import {
  trackMetaAddPaymentInfo,
  trackMetaInitiateCheckout,
  trackMetaSubscribedButtonClick,
} from '@/lib/meta-events'

interface ProTrialModalProps {
  onCloseAction: () => void
  onStartTrialAction?: () => void
  source?: 'trial_button' | 'auto'
}

export default function ProTrialModal({ onCloseAction, onStartTrialAction, source = 'auto' }: ProTrialModalProps) {
  const [isStarting, setIsStarting] = useState(false)

  const handleStartTrial = async () => {
    setIsStarting(true)
    const metaOptions = {
      plan: 'pro_trial',
      value: 5,
      source: `pro_trial_${source}`,
      contentName: 'Pro Trial',
    }
    trackMetaSubscribedButtonClick(metaOptions)
    try {
      trackMetaInitiateCheckout(metaOptions)
      const response = await fetch('/api/stripe/create-trial-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/dashboard?trial=success`,
          cancelUrl: `${window.location.origin}/dashboard`,
        }),
      })

      if (response.ok) {
        const { url } = await response.json()
        trackMetaAddPaymentInfo(metaOptions)
        window.location.href = url
      } else {
        const errorData = await response.json()
        console.error('Failed to create trial checkout:', errorData.error)
        alert('Failed to start trial. Please try again.')
        setIsStarting(false)
      }
    } catch (error) {
      console.error('Error creating trial checkout:', error)
      alert('Failed to start trial. Please try again.')
      setIsStarting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl my-2 md:my-4">
        {/* Header */}
        <div className="relative px-4 pt-4 pb-2 md:px-5 md:pt-5 md:pb-3">
          <button
            onClick={onCloseAction}
            className="absolute top-2 right-2 md:top-3 md:right-3 text-gray-400 hover:text-gray-600 text-2xl leading-none p-2"
            disabled={isStarting}
          >
            ×
          </button>

          <div className="text-center">
            <div className="inline-block mb-2">
              <div className="text-3xl md:text-4xl">{source === 'trial_button' ? '✨' : '🤔'}</div>
            </div>

            <h2 className="text-lg md:text-xl font-bold text-gray-900 mb-1">
              {source === 'trial_button' ? 'Try Pro for 3 Days – $5' : 'Not sure yet?'}
            </h2>
            <p className="text-xs md:text-sm text-gray-600">
              {source === 'trial_button'
                ? 'Get full Pro access for just $5'
                : 'Try full Pro for 3 days — just $5'
              }
            </p>
          </div>
        </div>

        {/* Trial Offer */}
        <div className="px-4 pb-4 md:px-5 md:pb-5">
          <div className="rounded-xl p-3 md:p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 mb-2 md:mb-3">
            {/* Price Display */}
            <div className="text-center mb-2 md:mb-3">
              <div className="text-4xl font-bold text-purple-600 mb-1">
                $5.00
              </div>
              <p className="text-sm text-gray-600">
                3 days Pro access
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Then $19.99/month
              </p>
            </div>

            {/* Features - Highlighted */}
            <div className="bg-white rounded-lg p-3 md:p-4 mb-2 md:mb-3 shadow-sm">
              <p className="text-sm font-bold text-gray-900 mb-3 text-center">
                What you get:
              </p>
              <ul className="space-y-1.5 md:space-y-2.5">
                <li className="flex items-start md:items-center justify-center gap-2.5">
                  <span className="text-purple-500 text-lg font-bold mt-0.5 md:mt-0">✓</span>
                  <span className="text-sm font-medium text-gray-800 text-left md:text-center">200 ready-made ads (4K resolution)</span>
                </li>
                <li className="flex items-center justify-center gap-2.5">
                  <span className="text-purple-500 text-lg font-bold">✓</span>
                  <span className="text-sm font-medium text-gray-800">All Pro modes unlocked</span>
                </li>
                <li className="flex items-center justify-center gap-2.5">
                  <span className="text-purple-500 text-lg font-bold">✓</span>
                  <span className="text-sm font-medium text-gray-800">Video & music generation</span>
                </li>
                <li className="flex items-center justify-center gap-2.5">
                  <span className="text-purple-500 text-lg font-bold">✓</span>
                  <span className="text-sm font-medium text-gray-800">Commercial usage</span>
                </li>
              </ul>
            </div>

            {/* How it works - Smaller */}
            <div className="bg-purple-100/50 rounded-lg p-2.5">
              <p className="text-xs text-gray-600 leading-relaxed text-center">
                <span className="font-semibold text-gray-700">How it works:</span><br />
                Pay $5 now • Use Pro for 3 days • Automatically renews at $19.99/month unless you cancel
              </p>
            </div>
          </div>

          {/* Start Trial Button */}
          <button
            onClick={handleStartTrial}
            disabled={isStarting}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2.5 md:py-3 px-6 rounded-xl font-semibold text-sm md:text-base hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isStarting ? 'Starting...' : 'Start 3-Day Trial for $5'}
          </button>

          {/* No Thanks Button */}
          <button
            onClick={onCloseAction}
            disabled={isStarting}
            className="w-full mt-2 text-gray-600 hover:text-gray-800 py-2 text-xs font-medium transition-colors disabled:opacity-50"
          >
            No thanks
          </button>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-2 md:px-5 md:py-3 bg-gray-50 rounded-b-2xl flex justify-between items-center">
          <p className="text-xs text-gray-500 text-center flex-1">
            💳 Secure payment • Auto-renews monthly • Cancel anytime
          </p>
          <span className="text-[10px] text-gray-300">v1.0.1</span>
        </div>
      </div>
    </div >
  )
}
