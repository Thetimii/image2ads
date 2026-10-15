'use client'

import { CREDIT_PACKS, type CreditPackId } from '@/lib/stripe-plans'
import {
  trackMetaAddPaymentInfo,
  trackMetaInitiateCheckout,
  trackMetaSubscribedButtonClick,
} from '@/lib/meta-events'

/**
 * Starts a Stripe Checkout for a one-time credit pack and redirects.
 * Returns false (after alerting) if the session could not be created.
 */
export async function startCreditPackCheckout(packId: CreditPackId, source: string): Promise<boolean> {
  const pack = CREDIT_PACKS[packId]
  const metaOptions = {
    plan: packId,
    source,
    value: pack.price,
    contentName: `${pack.name} (${pack.credits} credits)`,
  }
  trackMetaSubscribedButtonClick(metaOptions)
  trackMetaInitiateCheckout(metaOptions)
  import('@/lib/analytics')
    .then(({ track }) => track('checkout_started', { plan: packId, interval: 'one_time', source }))
    .catch(() => {})
  try {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pack: packId,
        successUrl: `${window.location.origin}/billing?success=true&pack=${packId}`,
        cancelUrl: `${window.location.origin}${window.location.pathname}?checkout=cancelled`,
      }),
    })
    if (response.status === 401) {
      window.location.href = '/signup'
      return false
    }
    if (!response.ok) throw new Error(`checkout failed: ${response.status}`)
    const { url } = await response.json()
    trackMetaAddPaymentInfo(metaOptions)
    window.location.href = url
    return true
  } catch (error) {
    console.error('Credit pack checkout failed:', error)
    alert('Failed to start checkout. Please try again.')
    return false
  }
}
