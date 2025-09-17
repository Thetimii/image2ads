export const STRIPE_PLANS = {
  starter: {
    name: "Starter",
    credits: 200,
    price: 29.99,
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    paymentLink: "https://buy.stripe.com/aFa9AT1jmdfPccn2xn8k802",
    productId: "starter", // Will be updated from webhook
    allowCoupons: true,
  },
  pro: {
    name: "Pro",
    credits: 600,
    price: 59.99,
    priceId: process.env.STRIPE_PRO_PRICE_ID,
    paymentLink: "https://buy.stripe.com/eVqbJ17HK5Nnb8jeg58k801",
    productId: "pro", // Will be updated from webhook
    allowCoupons: true,
  },
  business: {
    name: "Business",
    credits: 1500,
    price: 149.99,
    priceId: process.env.STRIPE_BUSINESS_PRICE_ID,
    paymentLink: "https://buy.stripe.com/dRmdR93rua3D3FRfk98k800",
    productId: "business", // Will be updated from webhook
    allowCoupons: true,
  },
} as const;

export type StripePlan = keyof typeof STRIPE_PLANS;
