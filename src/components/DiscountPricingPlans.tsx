'use client'

import { useState } from 'react'

interface DiscountPricingPlansProps {
  discountPercentage: number
  couponId: string
  onSubscribeAction: (plan: 'starter' | 'pro' | 'business', couponId: string) => Promise<void>
  isLoading: string | null
}

const PLANS = {
  starter: {
    name: 'Starter',
    originalPrice: 9.99,
    credits: '70 images',
    features: [
      'Text-to-Image',
      'Image-to-Image',
      '70 images per month',
      'No video features',
      'No music generation',
    ],
    recommended: false,
  },
  pro: {
    name: 'Pro',
    originalPrice: 19.99,
    credits: '200 images or 250s video or 66 songs',
    features: [
      'Text-to-Image',
      'Image-to-Image',
      'Text-to-Video',
      'Image-to-Video',
      'Text-to-Music',
      '200 credits/month',
    ],
    recommended: true,
  },
  business: {
    name: 'Business',
    originalPrice: 49.99,
    credits: '500 images or 625s video or 166 songs',
    features: [
      'Text-to-Image',
      'Image-to-Image',
      'Text-to-Video',
      'Image-to-Video',
      'Text-to-Music',
      '500 credits/month',
    ],
    recommended: false,
  },
}

export default function DiscountPricingPlans({
  discountPercentage,
  couponId,
  onSubscribeAction,
  isLoading,
}: DiscountPricingPlansProps) {
  const calculateDiscountedPrice = (originalPrice: number) => {
    const discount = originalPrice * (discountPercentage / 100)
    return (originalPrice - discount).toFixed(2)
  }

  return (
    <div className="p-6 bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
        {Object.entries(PLANS).map(([key, plan]) => {
          const planKey = key as 'starter' | 'pro' | 'business'
          const discountedPrice = calculateDiscountedPrice(plan.originalPrice)
          const savings = (plan.originalPrice - parseFloat(discountedPrice)).toFixed(2)

          return (
            <div
              key={planKey}
              className={`relative bg-white rounded-2xl shadow-lg p-6 flex flex-col ${
                plan.recommended ? 'ring-2 ring-purple-500 scale-105' : ''
              }`}
            >
              {plan.recommended && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    RECOMMENDED
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="mb-2">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-bold text-gray-400 line-through">
                      ${plan.originalPrice}
                    </span>
                    <span className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      ${discountedPrice}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">/month</div>
                  <div className="mt-2 inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
                    Save ${savings}/month
                  </div>
                </div>
                <p className="text-sm text-gray-600">{plan.credits}</p>
              </div>

              <div className="flex-1">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center text-sm">
                      <svg
                        className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                      <span className={feature.startsWith('No ') ? 'text-gray-400 line-through' : 'text-gray-700'}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={() => onSubscribeAction(planKey, couponId)}
                disabled={isLoading === planKey}
                className={`w-full py-3 px-6 rounded-xl font-semibold transition-all ${
                  plan.recommended
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg hover:scale-105'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isLoading === planKey ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processing...
                  </span>
                ) : planKey === 'starter' ? (
                  'Get Started'
                ) : (
                  `Upgrade to ${plan.name}`
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
