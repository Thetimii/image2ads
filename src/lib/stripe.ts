import Stripe from "stripe";
import {
  CREDIT_PACKS,
  STRIPE_PLANS,
  creditsFor,
  priceFor,
  type BillingInterval,
  type CreditPackId,
  type StripePlan,
} from "./stripe-plans";

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
/**
 * Ad-click context captured when checkout starts, so the webhook's server-side
 * Meta Purchase event can be matched to the ad click (fbc/fbp/IP/UA).
 * Stored on the Checkout Session metadata (values max 500 chars).
 */
export type CheckoutTracking = {
  fbc?: string;
  fbp?: string;
  ip?: string;
  ua?: string;
};

function trackingMetadata(t?: CheckoutTracking): Record<string, string> {
  if (!t) return {};
  const out: Record<string, string> = {};
  if (t.fbc) out.meta_fbc = t.fbc.slice(0, 490);
  if (t.fbp) out.meta_fbp = t.fbp.slice(0, 490);
  if (t.ip) out.meta_ip = t.ip.slice(0, 64);
  if (t.ua) out.meta_ua = t.ua.slice(0, 490);
  return out;
}

export async function createCheckoutSession({
  userId,
  plan,
  interval = "month",
  successUrl,
  cancelUrl,
  customerEmail,
  stripeCustomerId,
  couponId,
  tracking,
}: {
  userId: string;
  plan: StripePlan;
  interval?: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  stripeCustomerId?: string;
  couponId?: string;
  tracking?: CheckoutTracking;
}) {
  const planData = STRIPE_PLANS[plan];
  const credits = creditsFor(plan, interval);
  const amountCents = Math.round(priceFor(plan, interval) * 100);
  const planMetadata = {
    user_id: userId,
    plan,
    interval,
    credits: String(credits),
    pricing_version: "v2",
  };

  const sessionOptions: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          product: planData.productId,
          unit_amount: amountCents,
          recurring: { interval },
        },
      },
    ],
    // Stripe replaces {CHECKOUT_SESSION_ID} on redirect, giving the client a
    // stable id to build a Purchase eventId that matches the webhook's -
    // required so Meta dedupes the client pixel + server CAPI Purchase events.
    success_url: withSessionId(successUrl),
    cancel_url: cancelUrl,
    metadata: { ...planMetadata, ...trackingMetadata(tracking) },
    // Renewals only see the subscription, so it carries the plan too.
    subscription_data: { metadata: planMetadata },
    automatic_tax: { enabled: false },
    payment_method_options: {
      card: { request_three_d_secure: "automatic" },
    },
    billing_address_collection: "auto",
  };

  // Discounts only on monthly plans - yearly is already ~35% off, and the
  // whole year of credits is granted upfront, so a promo code there would
  // hand out thousands of credits for (almost) nothing.
  if (interval === "month") {
    if (couponId) {
      sessionOptions.discounts = [{ coupon: couponId }];
    } else {
      sessionOptions.allow_promotion_codes = true;
    }
  }

  if (stripeCustomerId) {
    sessionOptions.customer = stripeCustomerId;
  } else {
    sessionOptions.customer_email = customerEmail;
  }

  try {
    return await stripe.checkout.sessions.create(sessionOptions);
  } catch (err) {
    // A coupon that was deleted/archived in Stripe must never block a sale:
    // fall back to full price (promo-code field) instead of failing checkout.
    const e = err as { code?: string; param?: string; message?: string };
    const couponGone =
      !!sessionOptions.discounts &&
      (e.code === "resource_missing" || /coupon/i.test(e.message || "")) &&
      /coupon|discounts/i.test(`${e.param || ""} ${e.message || ""}`);
    if (!couponGone) throw err;
    console.error("[checkout] coupon unavailable, continuing without it:", couponId, e.message);
    delete sessionOptions.discounts;
    sessionOptions.allow_promotion_codes = interval === "month" ? true : undefined;
    return stripe.checkout.sessions.create(sessionOptions);
  }
}

/** One-time credit pack purchase. Credits are granted by the webhook. */
export async function createCreditPackCheckoutSession({
  userId,
  packId,
  successUrl,
  cancelUrl,
  customerEmail,
  stripeCustomerId,
  tracking,
}: {
  userId: string;
  packId: CreditPackId;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  stripeCustomerId?: string;
  tracking?: CheckoutTracking;
}) {
  const pack = CREDIT_PACKS[packId];
  const sessionOptions: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(pack.price * 100),
          product_data: {
            name: `Image2Ad ${pack.name} - ${pack.credits} credits`,
            description: "One-time purchase. Credits never expire.",
          },
        },
      },
    ],
    success_url: withSessionId(successUrl),
    cancel_url: cancelUrl,
    metadata: {
      user_id: userId,
      type: "credit_pack",
      pack: pack.id,
      credits: String(pack.credits),
      pricing_version: "v2",
      ...trackingMetadata(tracking),
    },
    payment_intent_data: {
      metadata: { user_id: userId, type: "credit_pack", pack: pack.id },
    },
    // No promo codes on packs (they're already the entry-level offer).
    billing_address_collection: "auto",
  };

  if (stripeCustomerId) {
    sessionOptions.customer = stripeCustomerId;
  } else {
    sessionOptions.customer_email = customerEmail;
    // Payment-mode sessions don't create a customer unless asked to, and the
    // webhook links purchases to profiles through the customer id.
    sessionOptions.customer_creation = "always";
  }

  return stripe.checkout.sessions.create(sessionOptions);
}

function withSessionId(url: string): string {
  return url.includes("?")
    ? `${url}&session_id={CHECKOUT_SESSION_ID}`
    : `${url}?session_id={CHECKOUT_SESSION_ID}`;
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
