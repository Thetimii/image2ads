'use client'

import { useState } from 'react'

interface ProTrialModalProps {
  onCloseAction: () => void
  onStartTrialAction?: () => void
  source?: 'trial_button' | 'auto'
}

export default function ProTrialModal({ onCloseAction, onStartTrialAction, source = 'auto' }: ProTrialModalProps) {
  const [isStarting, setIsStarting] = useState(false)

  const handleStartTrial = async () => {
    setIsStarting(true)
    try {
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
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl my-4">
        {/* Header */}
        <div className="relative px-5 pt-5 pb-3">
          <button
            onClick={onCloseAction}
            className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 text-2xl leading-none"
            disabled={isStarting}
          >
            ×
          </button>
          
          <div className="text-center">
            <div className="inline-block mb-2">
              <div className="text-4xl">{source === 'trial_button' ? '✨' : '🤔'}</div>
            </div>
            
            <h2 className="text-xl font-bold text-gray-900 mb-1">
              {source === 'trial_button' ? 'Try Pro for 3 Days – $1' : 'Not sure yet?'}
            </h2>
            <p className="text-sm text-gray-600">
              {source === 'trial_button' 
                ? 'Get full Pro access for just $1' 
                : 'Try full Pro for 3 days — just $1'
              }
            </p>
          </div>
        </div>

        {/* Trial Offer */}
        <div className="px-5 pb-5">
          <div className="rounded-xl p-4 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 mb-3">
            {/* Price Display */}
            <div className="text-center mb-3">
              <div className="text-4xl font-bold text-purple-600 mb-1">
                $1.00
              </div>
              <p className="text-sm text-gray-600">
                3 days Pro access
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Then $19.99/month
              </p>
            </div>

            {/* Features - Highlighted */}
            <div className="bg-white rounded-lg p-4 mb-3 shadow-sm">
              <p className="text-sm font-bold text-gray-900 mb-3 text-center">
                What you get:
              </p>
              <ul className="space-y-2.5">
                <li className="flex items-center justify-center gap-2.5">
                  <span className="text-purple-500 text-lg font-bold">✓</span>
                  <span className="text-sm font-medium text-gray-800">200 credits instantly</span>
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
                <span className="font-semibold text-gray-700">How it works:</span><br/>
                Pay $1 now • Use Pro for 3 days • Automatically renews at $19.99/month unless you cancel
              </p>
            </div>
          </div>

          {/* Start Trial Button */}
          <button
            onClick={handleStartTrial}
            disabled={isStarting}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold text-base hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isStarting ? 'Starting...' : 'Start 3-Day Trial for $1'}
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
        <div className="border-t border-gray-200 px-5 py-3 bg-gray-50 rounded-b-2xl">
          <p className="text-xs text-gray-500 text-center">
            💳 Secure payment • Auto-renews monthly • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
}
