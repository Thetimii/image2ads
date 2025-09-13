import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.18.0?target=deno";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
  httpClient: Stripe.createFetchHttpClient(),
});

// Create admin client that bypasses RLS
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (request: Request) => {
  const signature = request.headers.get("Stripe-Signature");
  const body = await request.text();

  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || "",
      undefined,
      cryptoProvider
    );

    console.log(`Processing event: ${event.type}`);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode === "subscription") {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          // Map plan to credits
          const creditsMap: Record<string, number> = {
            starter: 200,
            pro: 600,
            business: 2000,
          };

          const planName = session.metadata?.plan || "starter";
          const credits = creditsMap[planName] || 200;

          // Update user profile
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              stripe_customer_id: session.customer as string,
              subscription_id: subscription.id,
              subscription_status: subscription.status,
            })
            .eq("id", session.metadata?.user_id);

          if (profileError) {
            console.error("Error updating profile:", profileError);
            return new Response("Profile update failed", { status: 500 });
          }

          // Add credits
          const { error: creditsError } = await supabaseAdmin.rpc(
            "add_credits",
            {
              user_uuid: session.metadata?.user_id,
              credit_amount: credits,
            }
          );

          if (creditsError) {
            console.error("Error adding credits:", creditsError);
            return new Response("Credits update failed", { status: 500 });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        const { error } = await supabase
          .from("profiles")
          .update({
            subscription_status: subscription.status,
          })
          .eq("stripe_customer_id", subscription.customer as string);

        if (error) {
          console.error("Error updating subscription status:", error);
          return new Response("Subscription update failed", { status: 500 });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        const { error } = await supabase
          .from("profiles")
          .update({
            subscription_id: null,
            subscription_status: "canceled",
          })
          .eq("stripe_customer_id", subscription.customer as string);

        if (error) {
          console.error("Error canceling subscription:", error);
          return new Response("Subscription cancellation failed", {
            status: 500,
          });
        }
        break;
      }

      case "billing_portal.configuration.updated": {
        // This event is triggered when billing portal configuration is updated
        // No action needed, just acknowledge receipt
        console.log("Billing portal configuration updated");
        break;
      }

      case "customer.created": {
        const customer = event.data.object as Stripe.Customer;
        console.log(`Customer created: ${customer.id}`);
        // Customer creation is handled when they first access billing portal
        break;
      }

      case "customer.updated": {
        const customer = event.data.object as Stripe.Customer;
        console.log(`Customer updated: ${customer.id}`);

        // Update customer info in our database if needed
        const { error } = await supabase
          .from("profiles")
          .update({
            email: customer.email,
          })
          .eq("stripe_customer_id", customer.id);

        if (error) {
          console.error("Error updating customer profile:", error);
        }
        break;
      }

      case "customer.deleted": {
        const customer = event.data.object as Stripe.Customer;
        console.log(`Customer deleted: ${customer.id}`);

        // Clear Stripe data from user profile
        const { error } = await supabase
          .from("profiles")
          .update({
            stripe_customer_id: null,
            subscription_id: null,
            subscription_status: null,
          })
          .eq("stripe_customer_id", customer.id);

        if (error) {
          console.error("Error clearing customer data:", error);
        }
        break;
      }

      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log(`Subscription created: ${subscription.id}`);

        // Update subscription info
        const { error } = await supabase
          .from("profiles")
          .update({
            subscription_id: subscription.id,
            subscription_status: subscription.status,
          })
          .eq("stripe_customer_id", subscription.customer as string);

        if (error) {
          console.error("Error updating subscription:", error);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Payment succeeded for invoice: ${invoice.id}`);

        if (invoice.subscription) {
          // Recurring payment - add monthly credits
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );

          // Get plan from subscription metadata or items
          const planItem = subscription.items.data[0];
          let credits = 200; // default starter credits

          // Map price IDs to credits
          if (planItem.price.id === Deno.env.get("STRIPE_PRO_PRICE_ID")) {
            credits = 600;
          } else if (
            planItem.price.id === Deno.env.get("STRIPE_BUSINESS_PRICE_ID")
          ) {
            credits = 2000;
          }

          // Find user by customer ID and add credits
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("stripe_customer_id", invoice.customer as string)
            .single();

          if (profile) {
            const { error } = await supabaseAdmin.rpc("add_credits", {
              user_uuid: profile.id,
              credit_amount: credits,
            });

            if (error) {
              console.error("Error adding recurring credits:", error);
            } else {
              console.log(`Added ${credits} credits for recurring payment`);
            }
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`Payment failed for invoice: ${invoice.id}`);

        // Update subscription status to past_due
        if (invoice.subscription) {
          const { error } = await supabase
            .from("profiles")
            .update({
              subscription_status: "past_due",
            })
            .eq("stripe_customer_id", invoice.customer as string);

          if (error) {
            console.error("Error updating payment failed status:", error);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response("Webhook error", { status: 400 });
  }
});
