import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

const cryptoProvider = Stripe.createSubtleCryptoProvider()

serve(async (request) => {
  const signature = request.headers.get('Stripe-Signature')
  const body = await request.text()
  
  if (!signature) {
    return new Response('No signature', { status: 400 })
  }

  try {
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || '',
      undefined,
      cryptoProvider
    )

    console.log(`Processing event: ${event.type}`)

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        
        if (session.mode === 'subscription') {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          
          // Map plan to credits
          const creditsMap: Record<string, number> = {
            'starter': 200,
            'pro': 600,
            'business': 2000
          }
          
          const planName = session.metadata?.plan || 'starter'
          const credits = creditsMap[planName] || 200
          
          // Update user profile
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              stripe_customer_id: session.customer as string,
              subscription_id: subscription.id,
              subscription_status: subscription.status,
            })
            .eq('id', session.metadata?.user_id)
          
          if (profileError) {
            console.error('Error updating profile:', profileError)
            return new Response('Profile update failed', { status: 500 })
          }
          
          // Add credits
          const { error: creditsError } = await supabase.rpc('add_credits', {
            user_uuid: session.metadata?.user_id,
            credit_amount: credits
          })
          
          if (creditsError) {
            console.error('Error adding credits:', creditsError)
            return new Response('Credits update failed', { status: 500 })
          }
        }
        break
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_status: subscription.status,
          })
          .eq('stripe_customer_id', subscription.customer as string)
        
        if (error) {
          console.error('Error updating subscription status:', error)
          return new Response('Subscription update failed', { status: 500 })
        }
        break
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_id: null,
            subscription_status: 'canceled',
          })
          .eq('stripe_customer_id', subscription.customer as string)
        
        if (error) {
          console.error('Error canceling subscription:', error)
          return new Response('Subscription cancellation failed', { status: 500 })
        }
        break
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return new Response('Webhook error', { status: 400 })
  }
})