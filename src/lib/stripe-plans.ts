/**
 * Pricing catalog (v2, Oct 2026).
 *
 * Prices are sent to Stripe inline (Checkout `price_data`) against the
 * existing Stripe products, so changing a number here changes what new
 * customers pay - no dashboard work needed. Every subscription carries its
 * plan / interval / credits in metadata, which is what the webhook reads to
 * grant credits on renewals.
 *
 * Yearly plans grant the whole year of credits upfront. Worst case (every
 * credit) the provider cost is ~45% of the yearly price for Pro and ~56%
 * for Business, so even an all-video customer stays profitable. Typical
 * image-only use costs us ~$0.03 per credit (~10-25% of revenue).
 */

export type StripePlan = "starter" | "pro" | "business";
export type BillingInterval = "month" | "year";
export type CreditPackId = "pack_100" | "pack_350";

export interface PlanDefinition {
  name: string;
  /** credits granted per month (yearly = 12x, granted upfront) */
  credits: number;
  /** monthly price in USD */
  price: number;
  /** yearly price in USD (billed once a year) */
  yearlyPrice: number;
  /** Stripe product the inline prices attach to */
  productId: string;
  allowCoupons: boolean;
}

export const STRIPE_PLANS: Record<StripePlan, PlanDefinition> = {
  starter: {
    name: "Starter",
    credits: 100,
    price: 19,
    yearlyPrice: 149,
    productId: "prod_T2wzTL6ZmYZQDa",
    allowCoupons: true,
  },
  pro: {
    name: "Pro",
    credits: 300,
    price: 39,
    yearlyPrice: 299,
    productId: "prod_T2x00jXHEIYfR4",
    allowCoupons: true,
  },
  business: {
    name: "Business",
    credits: 1000,
    price: 99,
    yearlyPrice: 799,
    productId: "prod_T2x1lL9Q9HicqR",
    allowCoupons: true,
  },
};

export interface CreditPack {
  id: CreditPackId;
  name: string;
  credits: number;
  price: number;
  tagline: string;
}

/** One-time packs. Credits never expire. */
export const CREDIT_PACKS: Record<CreditPackId, CreditPack> = {
  pack_100: {
    id: "pack_100",
    name: "Launch Pack",
    credits: 100,
    price: 29,
    tagline: "One product launch, done",
  },
  pack_350: {
    id: "pack_350",
    name: "Studio Pack",
    credits: 350,
    price: 79,
    tagline: "A whole catalog of ads",
  },
};

/** Credits granted for one billing period of a plan. */
export function creditsFor(plan: StripePlan, interval: BillingInterval): number {
  const p = STRIPE_PLANS[plan];
  return interval === "year" ? p.credits * 12 : p.credits;
}

export function priceFor(plan: StripePlan, interval: BillingInterval): number {
  const p = STRIPE_PLANS[plan];
  return interval === "year" ? p.yearlyPrice : p.price;
}

/** Effective monthly price of the yearly plan, e.g. 24.92 for Pro. */
export function yearlyMonthlyEquivalent(plan: StripePlan): number {
  return Math.round((STRIPE_PLANS[plan].yearlyPrice / 12) * 100) / 100;
}

/** Percent saved by paying yearly, e.g. 36 for Pro. */
export function yearlySavingsPercent(plan: StripePlan): number {
  const p = STRIPE_PLANS[plan];
  return Math.round((1 - p.yearlyPrice / (p.price * 12)) * 100);
}

export function isStripePlan(v: unknown): v is StripePlan {
  return v === "starter" || v === "pro" || v === "business";
}

export function isCreditPackId(v: unknown): v is CreditPackId {
  return v === "pack_100" || v === "pack_350";
}

/**
 * Subscriptions created before v2 used fixed Stripe prices and carry no
 * credits metadata. Their renewals must keep granting the credits they
 * were sold with.
 */
export const LEGACY_PRICES: Record<string, { plan: StripePlan; credits: number }> = {
  price_1SD2hiEmSPK4NJFz75PfLTQX: { plan: "starter", credits: 70 }, // $9.99
  price_1SD2hMEmSPK4NJFzhAk5d8Fx: { plan: "pro", credits: 200 }, // $19.99
  price_1SD2h8EmSPK4NJFz96lKR2m9: { plan: "business", credits: 500 }, // $49.99
  price_1S8G9wEmSPK4NJFzWnAAMNKZ: { plan: "starter", credits: 70 },
  price_1S8G9YEmSPK4NJFzR2yiOitM: { plan: "pro", credits: 200 },
  price_1S8G9BEmSPK4NJFzUswclf3X: { plan: "business", credits: 500 },
  price_1S6r5uEmSPK4NJFzjr4KgQTS: { plan: "starter", credits: 70 },
  price_1S6r6pEmSPK4NJFz9PDWb0Y2: { plan: "pro", credits: 200 },
  price_1S6r79EmSPK4NJFzjeYd0z91: { plan: "business", credits: 500 },
};

const PRODUCT_TO_PLAN: Record<string, StripePlan> = {
  prod_T2wzTL6ZmYZQDa: "starter",
  prod_T2x00jXHEIYfR4: "pro",
  prod_T2x1lL9Q9HicqR: "business",
};

/**
 * Resolves plan + credits-per-period for a subscription item. Order:
 * legacy fixed price -> subscription metadata (v2) -> product + interval.
 */
export function resolveSubscriptionPlan(input: {
  metadata?: Record<string, string> | null;
  priceId?: string | null;
  productId?: string | null;
  interval?: string | null;
}): { plan: StripePlan; interval: BillingInterval; credits: number } | null {
  const md = input.metadata ?? {};
  // Legacy fixed prices first: some pre-v2 trial subscriptions carry
  // plan metadata ("pro") but were sold with the old credit amounts.
  if (input.priceId && LEGACY_PRICES[input.priceId]) {
    const legacy = LEGACY_PRICES[input.priceId];
    return { plan: legacy.plan, interval: "month", credits: legacy.credits };
  }
  if (isStripePlan(md.plan)) {
    const interval: BillingInterval = md.interval === "year" ? "year" : "month";
    const credits = Number.parseInt(md.credits ?? "", 10);
    return {
      plan: md.plan,
      interval,
      credits: Number.isFinite(credits) && credits > 0 ? credits : creditsFor(md.plan, interval),
    };
  }
  const plan = input.productId ? PRODUCT_TO_PLAN[input.productId] : undefined;
  if (plan) {
    const interval: BillingInterval = input.interval === "year" ? "year" : "month";
    return { plan, interval, credits: creditsFor(plan, interval) };
  }
  return null;
}
