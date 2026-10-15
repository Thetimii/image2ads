import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CREDIT_PACKS, STRIPE_PLANS, isCreditPackId, resolveSubscriptionPlan } from "@/lib/stripe-plans";
import { trackPurchase } from "@/lib/tiktok-events";
import { sendMetaEvent } from "@/lib/meta-capi";

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

type PriceLike = {
  id?: string;
  product?: string | { id: string } | null;
  recurring?: { interval?: string } | null;
} | null | undefined;

// Plan + credits for a subscription: v2 subscriptions carry it in metadata,
// legacy ones are matched by their fixed price id (see stripe-plans.ts).
function planOf(subscription: Stripe.Subscription) {
  const price = subscription.items.data[0]?.price as PriceLike;
  return resolveSubscriptionPlan({
    metadata: subscription.metadata,
    priceId: price?.id,
    productId: typeof price?.product === "string" ? price.product : price?.product?.id,
    interval: price?.recurring?.interval,
  });
}

function planOfPrice(price: PriceLike) {
  if (!price) return null;
  return resolveSubscriptionPlan({
    priceId: price.id,
    productId: typeof price.product === "string" ? price.product : price.product?.id,
    interval: price.recurring?.interval,
  });
}

async function markHasPaid(match: { userId?: string | null; customerId?: string | null }) {
  const q = supabaseAdmin.from("profiles").update({ has_paid: true });
  const { error } = match.userId
    ? await q.eq("id", match.userId)
    : await q.eq("stripe_customer_id", match.customerId ?? "");
  if (error) console.error("markHasPaid failed:", error.message);
}

// Grants credits exactly once per Stripe object (checkout session, invoice,
// upgrade). Stripe retries webhooks and fires several events per payment; the
// credit_grants ledger (unique source_ref) makes every grant idempotent and the
// balance update atomic (no read-modify-write race). Throws on failure so the
// handler answers 500 and Stripe retries - safe precisely because it's
// idempotent - instead of silently losing a paying customer's credits.
async function grantCreditsOnce(
  stripeCustomerId: string,
  credits: number,
  reason: string,
  sourceRef: string
): Promise<{ granted: boolean }> {
  const { data: profile, error: findError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();
  if (findError || !profile) {
    // Not an error worth retrying: the customer hasn't signed up / linked yet.
    console.error("grantCreditsOnce: no profile for Stripe customer", stripeCustomerId, findError?.message);
    return { granted: false };
  }
  const { data, error } = await supabaseAdmin.rpc("grant_credits_once", {
    p_user: profile.id,
    p_amount: credits,
    p_reason: reason,
    p_ref: sourceRef,
  });
  if (error) throw new Error(`grant_credits_once failed: ${error.message}`);
  console.log(`${data ? "Granted" : "Already granted"} ${credits} credits (${reason}, ${sourceRef}) to ${stripeCustomerId}`);
  return { granted: !!data };
}

// API 2025-08-27.basil moved invoice.subscription to
// invoice.parent.subscription_details.subscription - read both.
function invoiceSubscriptionId(invoice: unknown): string | null {
  const inv = invoice as {
    subscription?: string | { id: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
  };
  const sub = inv.parent?.subscription_details?.subscription ?? inv.subscription ?? null;
  if (!sub) return null;
  return typeof sub === "string" ? sub : sub.id;
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
                updated_at: new Date().toISOString(),
              })
              .eq("id", userId);

            if (updateError) {
              console.error("Error updating trial status:", updateError);
            } else {
              console.log(`✅ Trial activated for user ${userId}, ends at ${trialEndDate.toISOString()}`);
            }

            // Trial = "you have 200 Pro credits": raise the balance to at
            // least 200, once per checkout session (never lowers it).
            const { error: grantError } = await supabaseAdmin.rpc("grant_credits_once", {
              p_user: userId,
              p_amount: STRIPE_PLANS.pro.credits,
              p_reason: "pro_trial",
              p_ref: `trial:${session.id}`,
              p_mode: "set_min",
            });
            if (grantError) throw new Error(`Trial credit grant failed: ${grantError.message}`);

            // Track TikTok purchase event for trial
            try {
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("email")
                .eq("id", userId)
                .single();

              if (profile?.email) {
                const amount = (session.amount_total || 0) / 100;
                const currency = session.currency || 'usd';
                
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

                // Server-side Meta CAPI StartTrial — the reliable source of
                // truth. The client also fires this from the billing success
                // page with the same eventId (Stripe checkout session id),
                // so Meta dedupes them into a single counted conversion
                // instead of missing it entirely when the browser never
                // returns from Stripe.
                await sendMetaEvent({
                  eventName: 'StartTrial',
                  eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://image2ad.com'}/dashboard`,
                  actionSource: 'website',
                  eventId: `purchase_${session.id}`,
                  eventTime: Math.floor(Date.now() / 1000),
                  customData: { value: amount, currency: currency.toUpperCase(), content_name: '3-Day Pro Trial' },
                  userData: { email: profile.email, externalId: userId },
                });
              }
            } catch (error) {
              console.error('❌ Failed to track TikTok trial purchase:', error);
            }

            // First-party analytics: source of truth for trial starts
            try {
              await supabaseAdmin.rpc('track_server_event', {
                p_user_id: userId,
                p_event_name: 'trial_started',
                p_properties: {
                  amount: (session.amount_total || 0) / 100,
                  currency: (session.currency || 'usd').toUpperCase(),
                  plan: 'pro_trial',
                },
              });
            } catch (error) {
              console.error('❌ Failed to track analytics trial_started:', error);
            }
          }
          break;
        }

        // One-time credit pack
        if (session.mode === "payment" && session.metadata?.type === "credit_pack") {
          const userId = session.metadata?.user_id;
          const packId = session.metadata?.pack;
          if (session.payment_status !== "paid" || !userId || !isCreditPackId(packId)) {
            console.log("Credit pack session not paid or missing data:", session.id);
            break;
          }
          const pack = CREDIT_PACKS[packId];
          const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

          // Link the Stripe customer if the profile doesn't have one yet.
          if (customerId) {
            await supabaseAdmin
              .from("profiles")
              .update({ stripe_customer_id: customerId })
              .eq("id", userId)
              .is("stripe_customer_id", null);
          }

          const { error: grantError } = await supabaseAdmin.rpc("grant_credits_once", {
            p_user: userId,
            p_amount: pack.credits,
            p_reason: `credit_pack:${pack.id}`,
            p_ref: `pack:${session.id}`,
          });
          if (grantError) throw new Error(`Credit pack grant failed: ${grantError.message}`);
          await markHasPaid({ userId });

          const amount = (session.amount_total || 0) / 100;
          const currency = (session.currency || "usd").toUpperCase();
          const email = session.customer_details?.email || session.customer_email || undefined;
          try {
            if (email) {
              await trackPurchase({
                email,
                userId,
                value: amount,
                currency,
                contentId: pack.id,
                contentName: pack.name,
                url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://image2ad.com'}/billing`,
              });
            }
            await sendMetaEvent({
              eventName: 'Purchase',
              eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://image2ad.com'}/billing`,
              actionSource: 'website',
              eventId: `purchase_${session.id}`,
              eventTime: Math.floor(Date.now() / 1000),
              customData: { value: amount, currency, content_name: pack.name, content_type: 'product', content_ids: [pack.id] },
              userData: { email, externalId: userId },
            });
            await supabaseAdmin.rpc('track_server_event', {
              p_user_id: userId,
              p_event_name: 'payment_completed',
              p_properties: { amount, currency, plan: pack.id, mode: 'payment' },
            });
          } catch (error) {
            console.error('❌ Failed to track credit pack purchase:', error);
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

          const resolved = planOf(subscription);
          const creditsToAdd = resolved?.credits ?? 0;
          const planName = resolved?.plan ?? null;

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

          // Plan change via a new checkout: stop the customer's other
          // subscriptions. Monthly ones end now (as before); yearly ones were
          // paid upfront, so they just stop renewing at the end of the year.
          const [activeSubs, trialingSubs] = await Promise.all([
            stripe.subscriptions.list({ customer: customerId, status: 'active' }),
            stripe.subscriptions.list({ customer: customerId, status: 'trialing' }),
          ]);
          const subscriptionsToCancel = [...activeSubs.data, ...trialingSubs.data].filter(
            sub => sub.id !== subscription.id
          );
          for (const subToCancel of subscriptionsToCancel) {
            try {
              const isYearly = subToCancel.items.data[0]?.price?.recurring?.interval === 'year';
              if (isYearly) {
                await stripe.subscriptions.update(subToCancel.id, { cancel_at_period_end: true });
                console.log(`Old yearly subscription set to end at period end: ${subToCancel.id}`);
              } else {
                await stripe.subscriptions.cancel(subToCancel.id);
                console.log(`Canceled old subscription: ${subToCancel.id}`);
              }
            } catch (error) {
              console.error(`Error canceling subscription ${subToCancel.id}:`, error);
            }
          }

          // Credits for the first period (yearly = the whole year upfront)
          if (creditsToAdd > 0) {
            await grantCreditsOnce(customerId, creditsToAdd, `subscription_start:${planName ?? "unknown"}:${resolved?.interval ?? "month"}`, `checkout:${session.id}`);
          }
          await markHasPaid({ customerId });

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
                  contentName: `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan (${resolved?.interval === 'year' ? 'yearly' : 'monthly'})`,
                  url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://image2ad.com'}/billing`,
                });
                
                console.log(`✅ TikTok Purchase event tracked for ${customer.email}, plan: ${planName}, amount: ${amount} ${currency}`);

                // Server-side Meta CAPI Purchase — the reliable source of
                // truth (shares an eventId with the client-side billing
                // success page fire so Meta dedupes to one conversion; see
                // StartTrial above for why this matters).
                await sendMetaEvent({
                  eventName: 'Purchase',
                  eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://image2ad.com'}/billing`,
                  actionSource: 'website',
                  eventId: `purchase_${session.id}`,
                  eventTime: Math.floor(Date.now() / 1000),
                  customData: {
                    value: amount,
                    currency: currency.toUpperCase(),
                    content_name: `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan`,
                    content_type: 'product',
                    content_ids: [planName],
                  },
                  userData: { email: customer.email, externalId: profile.id },
                });

                // First-party analytics: source of truth for revenue
                await supabaseAdmin.rpc('track_server_event', {
                  p_user_id: profile.id,
                  p_event_name: 'payment_completed',
                  p_properties: {
                    amount,
                    currency: currency.toUpperCase(),
                    plan: planName,
                    interval: resolved?.interval ?? 'month',
                    mode: session.mode,
                  },
                });
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

        const planItem = subscription.items.data[0];
        const resolved = planOf(subscription);
        const creditsToAdd = resolved?.credits ?? 0;
        const planName = resolved?.plan ?? null;

        // An outgoing subscription (set to end because the customer bought a
        // new plan) must not overwrite the new plan on the profile.
        if (subscription.cancel_at_period_end) {
          const others = await stripe.subscriptions.list({ customer: subscription.customer as string, status: "active" });
          if (others.data.some((s) => s.id !== subscription.id && !s.cancel_at_period_end)) {
            console.log(`Skipping profile update for outgoing subscription ${subscription.id}`);
            break;
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

        // Credits here ONLY for an actual plan change (the price on the
        // subscription item changed). subscription.updated also fires on every
        // renewal, cancel/uncancel, payment-method change etc. - those used to
        // grant a full month of credits each time. Renewals are granted once
        // per invoice in invoice.payment_succeeded; first payments in
        // checkout.session.completed.
        // Upgrades only, the credit difference (Pro -> Business = +300), and at
        // most ONE upgrade grant per subscription per billing period, so
        // switching plans back and forth can't farm credits.
        const previous = (event.data as { previous_attributes?: { items?: { data?: Array<{ price?: PriceLike }> } } }).previous_attributes;
        const previousPrice = previous?.items?.data?.[0]?.price;
        const previousPriceId = previousPrice?.id;
        const previousCredits = planOfPrice(previousPrice)?.credits ?? 0;
        const upgradeCredits = creditsToAdd - previousCredits;
        if (
          event.type === "customer.subscription.updated" &&
          subscription.status === "active" &&
          previousPriceId && previousPriceId !== planItem?.price?.id &&
          previousCredits > 0 && upgradeCredits > 0
        ) {
          const periodStart =
            (planItem as unknown as { current_period_start?: number }).current_period_start ??
            (subscription as unknown as { current_period_start?: number }).current_period_start ?? 0;
          await grantCreditsOnce(
            subscription.customer as string,
            upgradeCredits,
            `upgrade:${planName ?? "unknown"}`,
            `upgrade:${subscription.id}:${periodStart}`
          );
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
        const invoice = event.data.object as { id: string; billing_reason?: string | null };
        const subscriptionId = invoiceSubscriptionId(invoice);

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const creditsToAdd = planOf(subscription)?.credits ?? 0;

          // Only recurring cycles grant here; the first invoice of a new
          // subscription is covered by checkout.session.completed.
          if (invoice.billing_reason === "subscription_cycle" && creditsToAdd > 0) {
            await grantCreditsOnce(subscription.customer as string, creditsToAdd, "subscription_renewal", `invoice:${invoice.id}`);
          }

          const { error } = await supabaseAdmin
            .from("profiles")
            .update({ subscription_status: subscription.status })
            .eq("stripe_customer_id", subscription.customer);
          if (error) console.error("Error updating subscription status:", error);
        }
        break;
      }

      case "invoice.payment_failed": {
        const failedSubscriptionId = invoiceSubscriptionId(event.data.object);

        if (failedSubscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(failedSubscriptionId);

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

      // Refunds / chargebacks: yearly plans and packs grant credits upfront,
      // so take back what was granted for that payment (never below 0) and
      // drop paid status. Partial refunds are left alone (goodwill credits).
      // Requires these events to be enabled on the Stripe webhook endpoint.
      case "charge.refunded":
      case "charge.dispute.created": {
        const obj = event.data.object as Stripe.Charge | Stripe.Dispute;
        const charge: Stripe.Charge =
          event.type === "charge.refunded"
            ? (obj as Stripe.Charge)
            : await stripe.charges.retrieve(
                typeof (obj as Stripe.Dispute).charge === "string"
                  ? ((obj as Stripe.Dispute).charge as string)
                  : ((obj as Stripe.Dispute).charge as Stripe.Charge).id
              );
        if (event.type === "charge.refunded" && !charge.refunded) {
          console.log(`Partial refund on ${charge.id}, credits kept`);
          break;
        }
        const customerId = typeof charge.customer === "string" ? charge.customer : charge.customer?.id;
        if (!customerId) break;
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();
        if (!profile) break;

        // Which credit grants did this payment produce?
        //  - credit pack / first subscription payment: the Checkout session
        //  - renewals: the invoice (Charge.invoice is gone in API basil, so
        //    go through invoice payments)
        const refs: string[] = [];
        const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (piId) {
          const sessions = await stripe.checkout.sessions.list({ payment_intent: piId, limit: 1 });
          if (sessions.data[0]) refs.push(`pack:${sessions.data[0].id}`, `checkout:${sessions.data[0].id}`);
          const invoicePayments = await stripe.invoicePayments.list({
            payment: { type: "payment_intent", payment_intent: piId },
            limit: 1,
          });
          const inv = invoicePayments.data[0]?.invoice;
          const invId = typeof inv === "string" ? inv : inv?.id;
          if (invId) {
            refs.push(`invoice:${invId}`);
            const invoice = await stripe.invoices.retrieve(invId);
            const subId = invoiceSubscriptionId(invoice);
            if (invoice.billing_reason === "subscription_create" && subId) {
              const subSessions = await stripe.checkout.sessions.list({ subscription: subId, limit: 1 });
              if (subSessions.data[0]) refs.push(`checkout:${subSessions.data[0].id}`);
            }
          }
        }
        let granted = 0;
        if (refs.length) {
          const { data: grants } = await supabaseAdmin
            .from("credit_grants")
            .select("amount")
            .in("source_ref", refs)
            .gt("amount", 0);
          granted = (grants ?? []).reduce((sum, g: { amount: number }) => sum + (g.amount ?? 0), 0);
        }
        // One clawback per charge, whichever event (refund or dispute) comes first.
        const { data: applied, error } = await supabaseAdmin.rpc("clawback_credits_once", {
          p_user: profile.id,
          p_amount: granted,
          p_ref: `clawback:${charge.id}`,
          p_paid_refs: refs,
        });
        if (error) throw new Error(`refund clawback failed: ${error.message}`);
        console.log(`${event.type}: ${applied ? `removed up to ${granted}` : "already handled"} credits for ${profile.id} (charge ${charge.id})`);
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
