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

    const { plan, successUrl, cancelUrl } = validation.data

    // Create Stripe checkout session
    const session = await createCheckoutSession({
      userId: user.id,
      plan,
      successUrl,
      cancelUrl,
      customerEmail: user.email || undefined, // Pass user's email to prefill if no existing customer
      stripeCustomerId: stripeCustomerId || undefined, // Use existing customer ID if available
    })

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url 
    })

  } catch (error) {
    console.error('Checkout session creation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}