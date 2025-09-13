import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
  typescript: true,
})

export const STRIPE_PLANS = {
  starter: {
    name: 'Starter',
    credits: 200,
    price: 9.99,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
  },
  pro: {
    name: 'Pro',
    credits: 600,
    price: 24.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  business: {
    name: 'Business',
    credits: 2000,
    price: 79.99,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
  },
} as const

export type StripePlan = keyof typeof STRIPE_PLANS

export async function createCheckoutSession({
  userId,
  plan,
  successUrl,
  cancelUrl,
}: {
  userId: string
  plan: StripePlan
  successUrl: string
  cancelUrl: string
}) {
  const planData = STRIPE_PLANS[plan]
  
  if (!planData.priceId) {
    throw new Error(`Price ID not configured for plan: ${plan}`)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: planData.priceId,
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
      plan: plan,
    },
  })

  return session
}

export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string
  returnUrl: string
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}