import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { STRIPE_PLANS } from "@/lib/stripe-plans";

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

// Helper function to get credits for a given Stripe price ID
function getCreditsByPriceId(priceId: string): number {
  if (priceId === process.env.STRIPE_STARTER_PRICE_ID) {
    return STRIPE_PLANS.starter.credits;
  } else if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
    return STRIPE_PLANS.pro.credits;
  } else if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) {
    return STRIPE_PLANS.business.credits;
  }
  return 0;
}

// Helper function to get plan info by product ID
function getPlanByProductId(productId: string): { credits: number; planName: string } | null {
  // Map Stripe product IDs to our plan structure
  const productIdToPlan: Record<string, { credits: number; planName: string }> = {
    'starter': { credits: STRIPE_PLANS.starter.credits, planName: 'starter' },
    'pro': { credits: STRIPE_PLANS.pro.credits, planName: 'pro' },
    'business': { credits: STRIPE_PLANS.business.credits, planName: 'business' },
  };
  
  return productIdToPlan[productId] || null;
}

// Helper function to add credits to a customer by Stripe customer ID
async function addCreditsToCustomer(stripeCustomerId: string, credits: number) {
  // First find the profile by stripe_customer_id
  const { data: profile, error: findError } = await supabaseAdmin
    .from("profiles")
    .select("id, credits")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();

  if (findError || !profile) {
    console.error(
      "Profile not found for customer:",
      stripeCustomerId,
      findError
    );
    return { error: "Profile not found" };
  }

  // Add credits to existing balance
  const newCredits = (profile.credits || 0) + credits;

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({
      credits: newCredits,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id);

  if (updateError) {
    console.error("Error adding credits:", updateError);
    return { error: updateError };
  }

  console.log(
    `Successfully added ${credits} credits to customer ${stripeCustomerId} (new total: ${newCredits})`
  );
  return { success: true };
}

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

          // Get product ID from the subscription line items
          const planItem = subscription.items.data[0];
          let productId = null;
          let creditsToAdd = 0;
          let planName = null;

          if (planItem?.price?.product) {
            // Get the product to determine the plan
            const product = await stripe.products.retrieve(planItem.price.product as string);
            
            // Use product metadata or name to determine plan
            productId = product.metadata?.plan_id || product.name?.toLowerCase();
            
            if (productId) {
              const planInfo = getPlanByProductId(productId);
              if (planInfo) {
                creditsToAdd = planInfo.credits;
                planName = planInfo.planName;
              }
            }
          }

          // Create or update customer profile
          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (existingProfile) {
            // Update existing profile with product ID instead of subscription ID
            const { error: profileError } = await supabaseAdmin
              .from("profiles")
              .update({
                email: customer.email,
                subscription_status: subscription.status,
                subscription_id: productId || subscription.id, // Use product ID or fallback to subscription ID
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
                  subscription_id: productId || subscription.id, // Use product ID or fallback to subscription ID
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

          // Add credits based on product ID
          if (creditsToAdd > 0) {
            await addCreditsToCustomer(customerId, creditsToAdd);
            console.log(`Added ${creditsToAdd} credits for plan: ${planName}`);
          }
        }
        break;
      }

      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;

        // First check if this Stripe customer ID already exists
        const { data: existingStripeCustomer } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customer.id)
          .single();

        if (existingStripeCustomer) {
          console.log(
            `Customer ${customer.id} already exists in database, skipping creation`
          );
          break;
        }

        // Then try to find existing profile by email to link
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id, stripe_customer_id")
          .eq("email", customer.email)
          .single();

        if (existingProfile && !existingProfile.stripe_customer_id) {
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
          } else {
            console.log(
              `Linked existing profile to Stripe customer ${customer.id}`
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

        // Get product ID from the subscription line items
        const planItem = subscription.items.data[0];
        let productId = null;
        let creditsToAdd = 0;

        if (planItem?.price?.product) {
          // Get the product to determine the plan
          const product = await stripe.products.retrieve(planItem.price.product as string);
          
          // Use product metadata or name to determine plan
          productId = product.metadata?.plan_id || product.name?.toLowerCase();
          
          if (productId) {
            const planInfo = getPlanByProductId(productId);
            if (planInfo) {
              creditsToAdd = planInfo.credits;
            }
          }
        }

        // Update subscription status with product ID
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: subscription.status,
            subscription_id: productId || subscription.id, // Use product ID or fallback to subscription ID
          })
          .eq("stripe_customer_id", subscription.customer);

        if (error) {
          console.error("Error updating subscription:", error);
        }

        // Add credits for active subscriptions (creation or plan changes)
        if (subscription.status === "active" && creditsToAdd > 0) {
          const result = await addCreditsToCustomer(
            subscription.customer as string,
            creditsToAdd
          );

          if (result.error) {
            console.error("Error adding subscription credits:", result.error);
          } else {
            const eventType =
              event.type === "customer.subscription.created"
                ? "new subscription"
                : "plan change";
            console.log(`Added ${creditsToAdd} credits for ${eventType} (product: ${productId})`);
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

          if (planItem?.price?.id) {
            creditsToAdd = getCreditsByPriceId(planItem.price.id);
          }

          if (creditsToAdd > 0) {
            const result = await addCreditsToCustomer(
              subscription.customer as string,
              creditsToAdd
            );

            if (result.error) {
              console.error("Error adding recurring credits:", result.error);
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
