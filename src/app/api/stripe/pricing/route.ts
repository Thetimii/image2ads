import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { STRIPE_PLANS } from "@/lib/stripe-plans";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    const dynamicPlans = await Promise.all(
      Object.entries(STRIPE_PLANS).map(async ([key, plan]) => {
        try {
          // Fetch current price from Stripe
          const price = await stripe.prices.retrieve(plan.priceId!);

          return {
            id: key,
            name: plan.name,
            credits: plan.credits,
            price: price.unit_amount ? price.unit_amount / 100 : plan.price, // Convert from cents
            currency: price.currency || "usd",
            interval: price.recurring?.interval || "month",
            priceId: plan.priceId,
            allowCoupons: plan.allowCoupons,
          };
        } catch (error) {
          console.error(`Error fetching price for ${key}:`, error);
          // Fallback to static price if Stripe fetch fails
          return {
            id: key,
            name: plan.name,
            credits: plan.credits,
            price: plan.price,
            currency: "usd",
            interval: "month",
            priceId: plan.priceId,
            allowCoupons: plan.allowCoupons,
          };
        }
      })
    );

    return NextResponse.json({ plans: dynamicPlans });
  } catch (error) {
    console.error("Error fetching pricing:", error);

    // Fallback to static pricing
    const fallbackPlans = Object.entries(STRIPE_PLANS).map(([key, plan]) => ({
      id: key,
      name: plan.name,
      credits: plan.credits,
      price: plan.price,
      currency: "usd",
      interval: "month",
      priceId: plan.priceId,
      allowCoupons: plan.allowCoupons,
    }));

    return NextResponse.json({ plans: fallbackPlans });
  }
}
