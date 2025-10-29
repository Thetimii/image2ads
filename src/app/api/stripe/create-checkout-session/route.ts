import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSessionSchema } from '@/lib/validations'
import { createCheckoutSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile to check for existing Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    // Handle case where profile doesn't exist yet (new users)
    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching user profile:', profileError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // For new users without profiles, profile will be null
    const stripeCustomerId = profile?.stripe_customer_id || null

    // Parse and validate request body
    const body = await request.json()
    const validation = createCheckoutSessionSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.issues },
        { status: 400 }
      )
    }

  const { plan, successUrl, cancelUrl, couponId, applyProDiscount } = validation.data

    console.log('Creating checkout session with:', {
      userId: user.id,
      plan,
      hasStripeCustomerId: !!stripeCustomerId,
      stripeCustomerId: stripeCustomerId,
      userEmail: user.email,
      applyProDiscount,
    })

    // If applyProDiscount is true and plan is Pro, use the special 20% discount coupon
    let finalCouponId = couponId
    if (applyProDiscount && plan === 'pro') {
      // Verify the discount is still valid (check if expiry time is in the future)
      const { data: discountProfile } = await supabase
        .from('profiles')
        .select('pro_discount_expires_at')
        .eq('id', user.id)
        .single()

      if (discountProfile && discountProfile.pro_discount_expires_at) {
        const expiresAt = new Date(discountProfile.pro_discount_expires_at)
        const now = new Date()

        if (now < expiresAt) {
          // Discount still valid - use the coupon
          finalCouponId = process.env.STRIPE_PRO_DISCOUNT_COUPON_ID || 'VbLhruZu'
          console.log('✨ Applying Pro 20% discount coupon:', finalCouponId)
        } else {
          console.log('⏰ Pro discount expired')
        }
      }
    }

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      userId: user.id,
      plan,
      successUrl,
      cancelUrl,
      customerEmail: user.email || undefined, // Pass user's email to prefill if no existing customer
      stripeCustomerId: stripeCustomerId || undefined, // Use existing customer ID if available
      couponId: finalCouponId || undefined,
    })

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url 
    })

  } catch (error) {
    console.error('Checkout session creation error details:', {
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