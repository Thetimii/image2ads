export const STRIPE_PLANS = {
  starter: {
    name: "Starter",
    credits: 200,
    price: 9.99,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
  },
  pro: {
    name: "Pro",
    credits: 600,
    price: 24.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
  },
  business: {
    name: "Business",
    credits: 2000,
    price: 79.99,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
  },
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;