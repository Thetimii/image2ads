import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // raw body + crypto

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-08-27.basil",
});

// Create admin Supabase client for webhook operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export async function POST(req: NextRequest) {
  // ✔️ Stripe sends this; you must use it instead of your own auth
  const sig = req.headers.get("stripe-signature");
  if (!sig)
    return new NextResponse("Missing stripe-signature", { status: 400 });

  // IMPORTANT: use raw text body for signature verification
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET! // from CLI/Dashboard
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Signature verify failed:", errorMessage);
    return new NextResponse(`Webhook Error: ${errorMessage}`, { status: 400 });
  }

  try {
    console.log(`Processing event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription") {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          const customerId = subscription.customer as string;
          const customer = await stripe.customers.retrieve(customerId);

          if (customer.deleted) {
            console.error("Customer was deleted");
            break;
          }

          // Create or update customer profile
          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (existingProfile) {
            // Update existing profile
            const { error: profileError } = await supabaseAdmin
              .from("profiles")
              .update({
                email: customer.email,
                subscription_status: subscription.status,
                subscription_id: subscription.id,
              })
              .eq("stripe_customer_id", customerId);

            if (profileError) {
              console.error("Error updating profile:", profileError);
            }
          } else {
            // Try to find profile by email and link it
            const { data: profileByEmail } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("email", customer.email)
              .single();

            if (profileByEmail) {
              // Link existing profile to Stripe customer
              const { error: linkError } = await supabaseAdmin
                .from("profiles")
                .update({
                  stripe_customer_id: customerId,
                  subscription_status: subscription.status,
                  subscription_id: subscription.id,
                })
                .eq("id", profileByEmail.id);

              if (linkError) {
                console.error("Error linking profile to Stripe:", linkError);
              }
            } else {
              console.log("No profile found for customer:", customer.email);
              // Profile will be created when user signs up
            }
          }

          // Add credits based on subscription plan
          const planItem = subscription.items.data[0];
          if (planItem?.price?.id === process.env.STRIPE_STARTER_PRICE_ID) {
            const { error: creditsError } = await supabaseAdmin.rpc(
              "add_credits",
              {
                customer_id: customerId,
                credits_to_add: 150,
              }
            );
            if (creditsError)
              console.error("Error adding credits:", creditsError);
          } else if (planItem?.price?.id === process.env.STRIPE_PRO_PRICE_ID) {
            const { error: creditsError } = await supabaseAdmin.rpc(
              "add_credits",
              {
                customer_id: customerId,
                credits_to_add: 400,
              }
            );
            if (creditsError)
              console.error("Error adding credits:", creditsError);
          } else if (
            planItem?.price?.id === process.env.STRIPE_BUSINESS_PRICE_ID
          ) {
            const { error: creditsError } = await supabaseAdmin.rpc(
              "add_credits",
              {
                customer_id: customerId,
                credits_to_add: 700,
              }
            );
            if (creditsError)
              console.error("Error adding credits:", creditsError);
          }
        }
        break;
      }

      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;

        // First, try to find existing profile by email
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id, stripe_customer_id")
          .eq("email", customer.email)
          .single();

        if (existingProfile) {
          // Update existing profile with Stripe customer ID
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              stripe_customer_id: customer.id,
            })
            .eq("id", existingProfile.id);

          if (error) {
            console.error(
              "Error updating existing profile with Stripe ID:",
              error
            );
          }
        } else {
          console.log("No existing profile found for email:", customer.email);
          // Customer exists in Stripe but no user account yet - this is normal
          // The profile will be created when they sign up/sign in
        }
        break;
      }

      case "customer.updated": {
        const customer = event.data.object as Stripe.Customer;

        // Update profile where stripe_customer_id matches
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            email: customer.email,
          })
          .eq("stripe_customer_id", customer.id);

        if (error) {
          console.error("Error updating customer:", error);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        // Update subscription status
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: subscription.status,
            subscription_id: subscription.id,
          })
          .eq("stripe_customer_id", subscription.customer);

        if (error) {
          console.error("Error updating subscription:", error);
        }

        // Add credits for active subscriptions (creation or plan changes)
        if (subscription.status === "active") {
          const planItem = subscription.items.data[0];
          let creditsToAdd = 0;

          if (planItem?.price?.id === process.env.STRIPE_STARTER_PRICE_ID) {
            creditsToAdd = 150;
          } else if (planItem?.price?.id === process.env.STRIPE_PRO_PRICE_ID) {
            creditsToAdd = 400;
          } else if (
            planItem?.price?.id === process.env.STRIPE_BUSINESS_PRICE_ID
          ) {
            creditsToAdd = 700;
          }

          if (creditsToAdd > 0) {
            const { error: creditsError } = await supabaseAdmin.rpc(
              "add_credits",
              {
                customer_id: subscription.customer as string,
                credits_to_add: creditsToAdd,
              }
            );

            if (creditsError) {
              console.error("Error adding subscription credits:", creditsError);
            } else {
              const eventType =
                event.type === "customer.subscription.created"
                  ? "new subscription"
                  : "plan change";
              console.log(`Added ${creditsToAdd} credits for ${eventType}`);
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: "canceled",
            subscription_id: null,
          })
          .eq("stripe_customer_id", subscription.customer);

        if (error) {
          console.error("Error canceling subscription:", error);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;

        // Type assertion for subscription property
        const invoiceWithSub = invoice as { subscription?: string };

        if (invoiceWithSub.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoiceWithSub.subscription
          );

          // Add credits for successful payments
          const planItem = subscription.items.data[0];
          let creditsToAdd = 0;

          if (planItem?.price?.id === process.env.STRIPE_STARTER_PRICE_ID) {
            creditsToAdd = 150;
          } else if (planItem?.price?.id === process.env.STRIPE_PRO_PRICE_ID) {
            creditsToAdd = 400;
          } else if (
            planItem?.price?.id === process.env.STRIPE_BUSINESS_PRICE_ID
          ) {
            creditsToAdd = 700;
          }

          if (creditsToAdd > 0) {
            const { error } = await supabaseAdmin.rpc("add_credits", {
              customer_id: subscription.customer as string,
              credits_to_add: creditsToAdd,
            });

            if (error) {
              console.error("Error adding recurring credits:", error);
            } else {
              console.log(
                `Added ${creditsToAdd} credits for successful payment`
              );
            }
          }

          // Update subscription status
          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: subscription.status,
            })
            .eq("stripe_customer_id", subscription.customer);

          if (error) {
            console.error("Error updating subscription status:", error);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        // Type assertion for subscription property
        const invoiceWithSub = invoice as { subscription?: string };

        if (invoiceWithSub.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoiceWithSub.subscription
          );

          const { error } = await supabaseAdmin
            .from("profiles")
            .update({
              subscription_status: subscription.status,
            })
            .eq("stripe_customer_id", subscription.customer);

          if (error) {
            console.error("Error updating failed payment status:", error);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (err) {
    console.error("Webhook handler error:", err);
    return new NextResponse("Server error", { status: 500 });
  }
}
