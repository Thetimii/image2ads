import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
})

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id, subscription_status, plan')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Check if user already has an active trial or subscription
    if (profile?.subscription_status === 'trialing' || profile?.subscription_status === 'active') {
      return NextResponse.json(
        { error: 'You already have an active subscription or trial' },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { successUrl, cancelUrl } = body

    if (!successUrl || !cancelUrl) {
      return NextResponse.json(
        { error: 'successUrl and cancelUrl are required' },
        { status: 400 }
      )
    }

    // Get or create Stripe customer
    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Update profile with customer ID
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    console.log('Creating trial checkout session:', {
      userId: user.id,
      customerId,
      proPriceId: process.env.STRIPE_PRO_PRICE_ID,
      setupFeePriceId: process.env.STRIPE_TRIAL_PRICE_ID,
    })

    // Create Stripe checkout session for Pro subscription with 3-day trial + $1 setup fee
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRO_PRICE_ID!, // Main Pro subscription ($19.99/mo)
          quantity: 1,
        },
        {
          price: process.env.STRIPE_TRIAL_PRICE_ID!, // $5 one-time setup fee
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 3,
        metadata: {
          user_id: user.id,
          is_trial: 'true',
          plan: 'pro',
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: user.id,
        type: 'pro_trial_subscription',
        trial_days: '3',
      },
    })

    console.log('✅ Trial checkout session created:', session.id)

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url 
    })

  } catch (error) {
    console.error('Trial checkout session creation error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
