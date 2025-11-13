'use client'

import { STRIPE_PLANS } from '@/lib/stripe-plans'

interface PricingPlansProps {
  // onSubscribeAction may optionally receive a couponId when available
  onSubscribeAction: (plan: 'starter' | 'pro' | 'business', couponId?: string) => void
  isLoading?: string | null
  variant?: 'popup' | 'page'
  showAllPlans?: boolean
  // Optional discount used to render discounted prices client-side for preview
  discountPercentage?: number
  couponId?: string
}

export default function PricingPlans({ 
  onSubscribeAction, 
  isLoading, 
  variant = 'popup',
  showAllPlans = true,
  discountPercentage,
  couponId,
}: PricingPlansProps) {
  const plans = showAllPlans 
    ? ['starter', 'pro', 'business'] as const
    : ['pro', 'business'] as const

  return (
    <div className={variant === 'popup' ? 'p-6' : ''}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((key) => {
          const plan = STRIPE_PLANS[key]
          const isPro = key === 'pro'
          const isStarter = key === 'starter'
          const isBusiness = key === 'business'

          // Calculate equivalents
          let equivalentText = ''
          if (isStarter) {
            equivalentText = '70 images'
          } else if (isPro) {
            equivalentText = '200 images or 250s video or 66 songs'
          } else if (isBusiness) {
            equivalentText = '500 images or 625s video or 166 songs'
          }

          return (
            <div
              key={key}
              className={`relative rounded-xl p-6 border-2 transition ${
                isPro
                  ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-500 hover:border-purple-600'
                  : 'bg-white border-gray-200 hover:border-gray-300'
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-xs font-semibold">
                  RECOMMENDED
                </div>
              )}
              
              <div className={`text-center mb-4 ${isPro ? 'pt-2' : ''}`}>
                <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                <div className="mt-2">
                  {isPro && discountPercentage && discountPercentage > 0 ? (
                    <div className="flex flex-col items-center">
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-gray-400 line-through">${plan.price}</span>
                        <span className="text-3xl font-bold text-gray-900">${(plan.price * (1 - discountPercentage / 100)).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-gray-500 text-sm">/month</span>
                        <span className="bg-pink-500 text-white text-xs px-2 py-0.5 rounded-full font-semibold">-{discountPercentage}%</span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                      <span className="text-gray-500 text-sm">/month</span>
                    </>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">{equivalentText}</p>
              </div>

              <ul className="space-y-2 mb-6 min-h-[168px]">
                {isStarter ? (
                  <>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>Text-to-Image</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>Image-to-Image</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>Text-to-Video</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>Image-to-Video</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>Text-to-Music</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>70 credits per month</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>Text-to-Image</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>Image-to-Image</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>Text-to-Video</strong></span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>Image-to-Video</strong></span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span><strong>Text-to-Music</strong></span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span>{plan.credits} credits/month</span>
                    </li>
                  </>
                )}
              </ul>

              <button
                onClick={() => onSubscribeAction(key, couponId)}
                disabled={!!isLoading}
                className={`block w-full text-center py-3 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  isPro
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105 active:scale-95 shadow-lg'
                    : isBusiness
                    ? 'bg-gray-900 text-white hover:bg-gray-800 active:bg-gray-700'
                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300'
                }`}
              >
                {isLoading === key ? 'Processing...' : isStarter ? 'Get Started' : isPro ? 'Upgrade to Pro' : 'Upgrade to Business'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
