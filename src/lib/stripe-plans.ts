export const STRIPE_PLANS = {
  starter: {
    name: "Starter",
    credits: 200,
    price: 29.99,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    allowCoupons: true,
  },
  pro: {
    name: "Pro",
    credits: 600,
    price: 59.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    allowCoupons: true,
  },
  business: {
    name: "Business",
    credits: 1500,
    price: 149.99,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    allowCoupons: true,
  },
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;
