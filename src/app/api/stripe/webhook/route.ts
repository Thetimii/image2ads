import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { STRIPE_PLANS } from "@/lib/stripe-plans";
import { trackPurchase } from "@/lib/tiktok-events";

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
    // Use actual Stripe product IDs from environment variables
    [process.env.STRIPE_PRODUCT_ID_STARTER!]: { credits: STRIPE_PLANS.starter.credits, planName: 'starter' },
    [process.env.STRIPE_PRODUCT_ID_PRO!]: { credits: STRIPE_PLANS.pro.credits, planName: 'pro' },
    [process.env.STRIPE_PRODUCT_ID_BUSINESS!]: { credits: STRIPE_PLANS.business.credits, planName: 'business' },
    // Fallback for metadata-based plan names
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

        // Handle trial payment (one-time CHF 1 payment)
        if (session.mode === "payment" && session.metadata?.type === "pro_trial") {
          const customerId = session.customer as string;
          const userId = session.metadata?.user_id;
          const trialDays = parseInt(session.metadata?.trial_days || "3");

          console.log(`Processing pro trial payment for user ${userId}`);

          if (userId) {
            // Calculate trial end date
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + trialDays);

            // Update user profile with trial status
            const { error: updateError } = await supabaseAdmin
              .from("profiles")
              .update({
                subscription_status: "trialing",
                plan: "pro_trial",
                trial_end_at: trialEndDate.toISOString(),
                credits: STRIPE_PLANS.pro.credits, // Give 200 Pro credits
                updated_at: new Date().toISOString(),
              })
              .eq("id", userId);

            if (updateError) {
              console.error("Error updating trial status:", updateError);
            } else {
              console.log(`✅ Trial activated for user ${userId}, ends at ${trialEndDate.toISOString()}`);
            }

            // Track TikTok purchase event for trial
            try {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("email")
                .eq("id", userId)
                .single();

              if (profile?.email) {
                const amount = (session.amount_total || 0) / 100;
                const currency = session.currency || 'chf';
                
                await trackPurchase({
                  email: profile.email,
                  userId: userId,
                  value: amount,
                  currency: currency.toUpperCase(),
                  contentId: 'pro_trial',
                  contentName: '3-Day Pro Trial',
                  url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://image2ad.com'}/dashboard`,
                });
                
                console.log(`✅ TikTok Purchase event tracked for trial: ${profile.email}`);
              }
            } catch (error) {
              console.error('❌ Failed to track TikTok trial purchase:', error);
            }
          }
          break;
        }

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

          // Get plan info from the subscription line items using price ID
          const planItem = subscription.items.data[0];
          let creditsToAdd = 0;
          let planName = null;

          if (planItem?.price?.id) {
            // Use price ID to determine plan directly
            creditsToAdd = getCreditsByPriceId(planItem.price.id);
            
            // Determine plan name based on price ID
            if (planItem.price.id === process.env.STRIPE_STARTER_PRICE_ID) {
              planName = 'starter';
            } else if (planItem.price.id === process.env.STRIPE_PRO_PRICE_ID) {
              planName = 'pro';
            } else if (planItem.price.id === process.env.STRIPE_BUSINESS_PRICE_ID) {
              planName = 'business';
            }
          }

          // Create or update customer profile
          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (existingProfile) {
            // Update existing profile with plan name instead of subscription ID
            const { error: profileError } = await supabaseAdmin
              .from("profiles")
              .update({
                email: customer.email,
                subscription_status: subscription.status,
                subscription_id: planName || subscription.id, // Use plan name or fallback to subscription ID
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
                  subscription_id: planName || subscription.id, // Use plan name or fallback to subscription ID
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

          // Cancel any other active subscriptions for this customer (plan changes)
          const allSubscriptions = await stripe.subscriptions.list({
            customer: customerId,
            status: 'active',
          });

          // Cancel all other subscriptions except the current one
          const currentSubscriptionId = subscription.id;
          const subscriptionsToCancel = allSubscriptions.data.filter(
            sub => sub.id !== currentSubscriptionId
          );

          if (subscriptionsToCancel.length > 0) {
            console.log(`Found ${subscriptionsToCancel.length} other active subscriptions to cancel`);
            
            for (const subToCancel of subscriptionsToCancel) {
              try {
                await stripe.subscriptions.cancel(subToCancel.id);
                console.log(`Canceled old subscription: ${subToCancel.id}`);
              } catch (error) {
                console.error(`Error canceling subscription ${subToCancel.id}:`, error);
              }
            }
          }

          // Add credits based on product ID
          if (creditsToAdd > 0) {
            await addCreditsToCustomer(customerId, creditsToAdd);
            console.log(`Added ${creditsToAdd} credits for plan: ${planName}`);
          }

          // Track TikTok purchase event
          if (customer.email && planName) {
            try {
              // Get profile for user ID
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("stripe_customer_id", customerId)
                .single();

              if (profile) {
                const amount = (session.amount_total || 0) / 100; // Convert cents to dollars
                const currency = session.currency || 'usd';
                
                await trackPurchase({
                  email: customer.email,
                  userId: profile.id,
                  value: amount,
                  currency: currency.toUpperCase(),
                  contentId: planName,
                  contentName: `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan`,
                  url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://image2ad.com'}/billing`,
                });
                
                console.log(`✅ TikTok Purchase event tracked for ${customer.email}, plan: ${planName}, amount: ${amount} ${currency}`);
              }
            } catch (error) {
              console.error('❌ Failed to track TikTok Purchase event:', error);
              // Don't fail the webhook if TikTok tracking fails
            }
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

        // Get plan info from the subscription line items using price ID
        const planItem = subscription.items.data[0];
        let creditsToAdd = 0;
        let planName = null;

        if (planItem?.price?.id) {
          // Use price ID to determine plan directly
          creditsToAdd = getCreditsByPriceId(planItem.price.id);
          
          // Determine plan name based on price ID
          if (planItem.price.id === process.env.STRIPE_STARTER_PRICE_ID) {
            planName = 'starter';
          } else if (planItem.price.id === process.env.STRIPE_PRO_PRICE_ID) {
            planName = 'pro';
          } else if (planItem.price.id === process.env.STRIPE_BUSINESS_PRICE_ID) {
            planName = 'business';
          }
        }

        // Update subscription status with plan name
        const { error } = await supabaseAdmin
          .from("profiles")
          .update({
            subscription_status: subscription.status,
            subscription_id: planName || subscription.id, // Use plan name or fallback to subscription ID
          })
          .eq("stripe_customer_id", subscription.customer);

        if (error) {
          console.error("Error updating subscription:", error);
        }

        // Only add credits for subscription updates (plan changes), not creation
        // Creation credits are handled by checkout.session.completed
        if (event.type === "customer.subscription.updated" && subscription.status === "active" && creditsToAdd > 0) {
          const result = await addCreditsToCustomer(
            subscription.customer as string,
            creditsToAdd
          );

          if (result.error) {
            console.error("Error adding subscription credits:", result.error);
          } else {
            console.log(`Added ${creditsToAdd} credits for plan change (plan: ${planName})`);
          }
        } else if (event.type === "customer.subscription.created") {
          console.log(`Subscription created, credits handled by checkout.session.completed`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        // Check if customer has any other active subscriptions before marking as canceled
        // This prevents marking as canceled during an upgrade when old sub is canceled
        const allSubscriptions = await stripe.subscriptions.list({
          customer: subscription.customer as string,
          status: 'active',
        });

        // Only mark as canceled if there are NO other active subscriptions
        if (allSubscriptions.data.length === 0) {
          console.log(`No other active subscriptions found, marking customer as canceled`);
          
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
        } else {
          console.log(`Customer has ${allSubscriptions.data.length} other active subscription(s), keeping as active`);
          // Don't update status - they still have an active subscription
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
