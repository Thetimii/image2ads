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
  customerEmail,
  stripeCustomerId,
}: {
  userId: string;
  plan: StripePlan;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  stripeCustomerId?: string;
}) {
  const planData = STRIPE_PLANS[plan];

  if (!planData.priceId) {
    throw new Error(`Price ID not configured for plan: ${plan}`);
  }

  // Prepare checkout session options
  const sessionOptions: Stripe.Checkout.SessionCreateParams = {
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
  };

  // If user has existing Stripe customer ID, use it
  if (stripeCustomerId) {
    sessionOptions.customer = stripeCustomerId;
  } else {
    // If no existing customer, prefill email for new customer creation
    sessionOptions.customer_email = customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionOptions);

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
