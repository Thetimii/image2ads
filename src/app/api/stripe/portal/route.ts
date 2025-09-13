import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPortalSession, createStripeCustomer } from "@/lib/stripe";
import { getUserProfile, updateUserStripeCustomerId } from "@/lib/database";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile to check for Stripe customer ID
    const profile = await getUserProfile(user.id);

    if (!profile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    let stripeCustomerId = profile.stripe_customer_id;

    // If user doesn't have a Stripe customer ID, create one
    if (!stripeCustomerId) {
      try {
        console.log(`Creating Stripe customer for user ${user.id}`);
        const stripeCustomer = await createStripeCustomer({
          email: user.email!,
          name: profile.full_name || undefined,
        });

        stripeCustomerId = stripeCustomer.id;

        // Update the user profile with the new Stripe customer ID
        const updateSuccess = await updateUserStripeCustomerId(
          user.id,
          stripeCustomerId
        );

        if (!updateSuccess) {
          console.error(
            "Failed to update user profile with Stripe customer ID"
          );
          return NextResponse.json(
            { error: "Failed to create billing account" },
            { status: 500 }
          );
        }

        console.log(
          `Successfully created Stripe customer ${stripeCustomerId} for user ${user.id}`
        );
      } catch (error) {
        console.error("Error creating Stripe customer:", error);
        return NextResponse.json(
          { error: "Failed to create billing account" },
          { status: 500 }
        );
      }
    }

    // Parse request body for return URL
    const body = await request.json();
    const returnUrl =
      body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/billing`;

    // Create Stripe portal session
    const session = await createPortalSession({
      customerId: stripeCustomerId!,
      returnUrl,
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error) {
    console.error("Portal session creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
