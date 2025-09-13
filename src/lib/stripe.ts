import Stripe from "stripe";
import { STRIPE_PLANS, type StripePlan } from "./stripe-plans";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
  typescript: true,
});

export { STRIPE_PLANS, type StripePlan };

export async function createStripeCustomer({
  email,
  name,
}: {
  email: string;
  name?: string;
}) {
  const customer = await stripe.customers.create({
    email,
    name,
  });

  return customer;
}
export async function createCheckoutSession({
  userId,
  plan,
  successUrl,
  cancelUrl,
}: {
  userId: string;
  plan: StripePlan;
  successUrl: string;
  cancelUrl: string;
}) {
  const planData = STRIPE_PLANS[plan];

  if (!planData.priceId) {
    throw new Error(`Price ID not configured for plan: ${plan}`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    allow_promotion_codes: true,
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
  });

  return session;
}

export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}
