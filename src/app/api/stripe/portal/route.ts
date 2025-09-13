import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createPortalSession } from "@/lib/stripe";
import { getUserProfile } from "@/lib/database";

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

    if (!profile.stripe_customer_id) {
      return NextResponse.json(
        {
          error: "No billing account found. Please subscribe to a plan first.",
        },
        { status: 400 }
      );
    }

    // Parse request body for return URL
    const body = await request.json();
    const returnUrl =
      body.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/billing`;

    // Create Stripe portal session
    const session = await createPortalSession({
      customerId: profile.stripe_customer_id,
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
