export const STRIPE_PLANS = {
  starter: {
    name: "Starter",
    credits: 200,
    price: 29.99,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    paymentLink: "https://buy.stripe.com/14AdR94vy3Ff4JVc7X8k803",
    productId: "starter",
    allowCoupons: true,
  },
  pro: {
    name: "Pro",
    credits: 600,
    price: 59.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    paymentLink: "https://buy.stripe.com/3cI00j0fi3Fffoz2xn8k804",
    productId: "pro",
    allowCoupons: true,
  },
  business: {
    name: "Business",
    credits: 1500,
    price: 149.99,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    paymentLink: "https://buy.stripe.com/14A28r0figs1a4feg58k805",
    productId: "business",
    allowCoupons: true,
  },
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;
