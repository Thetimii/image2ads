import { NextResponse } from "next/server";
import {
  CREDIT_PACKS,
  STRIPE_PLANS,
  creditsFor,
  yearlyMonthlyEquivalent,
  yearlySavingsPercent,
  type StripePlan,
} from "@/lib/stripe-plans";

// Current catalog (prices are sent to Stripe inline at checkout, so the
// catalog file is the source of truth).
export async function GET() {
  const plans = (Object.keys(STRIPE_PLANS) as StripePlan[]).map((key) => {
    const plan = STRIPE_PLANS[key];
    return {
      id: key,
      name: plan.name,
      currency: "usd",
      monthly: { price: plan.price, credits: creditsFor(key, "month") },
      yearly: {
        price: plan.yearlyPrice,
        perMonth: yearlyMonthlyEquivalent(key),
        credits: creditsFor(key, "year"),
        savingsPercent: yearlySavingsPercent(key),
      },
      allowCoupons: plan.allowCoupons,
    };
  });
  return NextResponse.json({ plans, packs: Object.values(CREDIT_PACKS) });
}
