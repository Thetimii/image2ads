'use client'

import { useRouter } from 'next/navigation'
import PricingPlans from './PricingPlans'
import type { StripePlan } from '@/lib/stripe-plans'
import { trackMetaSubscribedButtonClick } from '@/lib/meta-events'

export default function PricingSection() {
  const router = useRouter()

  // For landing page, redirect to signin when user tries to subscribe
  const handleGetStarted = (plan: StripePlan, couponId?: string) => {
    trackMetaSubscribedButtonClick({
      plan,
      couponId,
      source: 'marketing_pricing',
    })
    router.push('/signin')
  }

  return (
    <section className="py-20" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            💰 New Pricing & Credit Allocation
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Choose the plan that fits your needs. Start creating professional ads today.
          </p>
        </div>

        {/* Pricing Cards */}
        <PricingPlans 
          onSubscribeAction={handleGetStarted}
          isLoading={null}
          variant="page"
          showAllPlans={true}
        />

        {/* Additional info */}
        <div className="text-center mt-12">
          <p className="text-gray-600 mb-4">
            All plans include free Credits. No credit card required to start.
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Auto-renews monthly
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Cancel anytime
            </div>
            <div className="flex items-center">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Secure payments
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}