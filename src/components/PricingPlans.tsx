'use client'

import { useState } from 'react'
import {
  CREDIT_PACKS,
  STRIPE_PLANS,
  creditsFor,
  yearlyMonthlyEquivalent,
  yearlySavingsPercent,
  type BillingInterval,
  type CreditPackId,
  type StripePlan,
} from '@/lib/stripe-plans'
import { startCreditPackCheckout } from '@/lib/checkout-client'

interface PricingPlansProps {
  // onSubscribeAction may optionally receive a couponId when available
  onSubscribeAction: (plan: StripePlan, couponId?: string, interval?: BillingInterval) => void
  isLoading?: string | null
  variant?: 'popup' | 'page'
  showAllPlans?: boolean
  // Optional discount (monthly Pro only) used to render discounted prices
  discountPercentage?: number
  couponId?: string
  /** Which billing interval is selected first. Yearly by default. */
  defaultInterval?: BillingInterval
  /** Show the one-time credit packs row. */
  showPacks?: boolean
  /** Analytics source label */
  source?: string
}

const FEATURES: Record<StripePlan, string[]> = {
  starter: ['HD images, no watermark', 'AI video, music & Nano Banana Pro', 'Commercial use'],
  pro: ['Everything in Starter', '3x the credits of Starter', 'Built for weekly ad testing'],
  business: ['Everything in Pro', 'For agencies & big catalogs', 'Lowest price per credit'],
}

function fmt(n: number) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`
}

export default function PricingPlans({
  onSubscribeAction,
  isLoading,
  variant = 'popup',
  showAllPlans = true,
  discountPercentage,
  couponId,
  defaultInterval = 'year',
  showPacks = true,
  source = 'pricing_plans',
}: PricingPlansProps) {
  const [interval, setBillingInterval] = useState<BillingInterval>(defaultInterval)
  const [packLoading, setPackLoading] = useState<CreditPackId | null>(null)
  const plans: StripePlan[] = showAllPlans ? ['starter', 'pro', 'business'] : ['pro', 'business']
  const yearly = interval === 'year'
  const busy = !!isLoading || !!packLoading

  const buyPack = async (packId: CreditPackId) => {
    setPackLoading(packId)
    const ok = await startCreditPackCheckout(packId, source)
    if (!ok) setPackLoading(null)
  }

  return (
    <div className={variant === 'popup' ? 'p-6' : ''}>
      {/* Interval toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex items-center rounded-full bg-gray-100 p-1 text-sm font-semibold" role="tablist" aria-label="Billing interval">
          <button
            type="button"
            role="tab"
            aria-selected={yearly}
            onClick={() => setBillingInterval('year')}
            className={`rounded-full px-4 py-2 transition ${yearly ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Yearly <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">save {yearlySavingsPercent('pro')}%</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={!yearly}
            onClick={() => setBillingInterval('month')}
            className={`rounded-full px-4 py-2 transition ${!yearly ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-800'}`}
          >
            Monthly
          </button>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-5 ${plans.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {plans.map((key) => {
          const plan = STRIPE_PLANS[key]
          const isPro = key === 'pro'
          const credits = creditsFor(key, interval)
          const showDiscount = !yearly && isPro && !!discountPercentage && discountPercentage > 0
          const monthlyShown = yearly ? yearlyMonthlyEquivalent(key) : plan.price

          return (
            <div
              key={key}
              className={`relative flex flex-col rounded-2xl border-2 p-6 transition ${
                isPro ? 'border-gray-900 bg-white shadow-xl md:-mt-2' : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-1 text-xs font-semibold text-white">
                  MOST POPULAR
                </div>
              )}

              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>

              <div className="mt-3">
                {showDiscount ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold text-gray-400 line-through">{fmt(plan.price)}</span>
                    <span className="text-4xl font-extrabold tracking-tight text-gray-900">
                      {fmt(Math.round(plan.price * (1 - discountPercentage! / 100) * 100) / 100)}
                    </span>
                    <span className="text-sm text-gray-500">/mo</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-tight text-gray-900">{fmt(monthlyShown)}</span>
                    <span className="text-sm text-gray-500">/mo</span>
                  </div>
                )}
                <p className="mt-1 h-5 text-xs text-gray-500">
                  {yearly ? (
                    <>
                      {fmt(plan.yearlyPrice)} billed yearly · <span className="text-gray-400 line-through">{fmt(plan.price * 12)}</span>
                    </>
                  ) : (
                    'Billed monthly · cancel anytime'
                  )}
                </p>
              </div>

              <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
                <div className="text-2xl font-bold text-gray-900">{credits.toLocaleString('en-US')}</div>
                <div className="text-xs text-gray-500">
                  {yearly ? 'credits, all upfront' : 'credits / month'} · 1 credit = 1 HD image
                </div>
              </div>

              <ul className="mt-4 mb-6 flex-1 space-y-2">
                {FEATURES[key].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 text-emerald-500">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onSubscribeAction(key, showDiscount ? couponId : undefined, interval)}
                disabled={busy}
                className={`w-full rounded-xl py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isPro ? 'bg-gray-900 text-white hover:bg-gray-800' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                }`}
              >
                {isLoading === key ? 'Opening checkout…' : `Get ${plan.name}${yearly ? ' yearly' : ''}`}
              </button>
            </div>
          )
        })}
      </div>

      {showPacks && (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">Not ready for a plan? Buy credits once.</p>
            <p className="text-xs text-gray-500">No subscription · credits never expire · HD, no watermark</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.values(CREDIT_PACKS).map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => buyPack(pack.id)}
                disabled={busy}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    {pack.name} · {pack.credits} credits
                  </span>
                  <span className="block text-xs text-gray-500">{pack.tagline}</span>
                </span>
                <span className="text-lg font-bold text-gray-900">
                  {packLoading === pack.id ? '…' : fmt(pack.price)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
