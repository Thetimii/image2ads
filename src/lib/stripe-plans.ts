export const STRIPE_PLANS = {
  starter: {
    name: "Starter",
    credits: 70,
    price: 9.99,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    paymentLink: "https://buy.stripe.com/9B67sL7HKgs10tFb3T8k806",
    productId: "starter",
    allowCoupons: true,
  },
  pro: {
    name: "Pro",
    credits: 200,
    price: 19.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    paymentLink: "https://buy.stripe.com/eVqbJ11jm8Zz5NZ1tj8k807",
    productId: "pro",
    allowCoupons: true,
  },
  business: {
    name: "Business",
    credits: 500,
    price: 49.99,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    paymentLink: "https://buy.stripe.com/dRm6oH1jm0t3ekv6ND8k808",
    productId: "business",
    allowCoupons: true,
  },
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;
