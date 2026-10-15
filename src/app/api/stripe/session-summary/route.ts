import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// What the user just paid for - lets the billing success page fire the
// client-side Purchase pixel with the real value (yearly / packs), sharing
// the event id with the webhook's server-side CAPI event.
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('session_id')
  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({
      amount: (session.amount_total ?? 0) / 100,
      currency: (session.currency ?? 'usd').toUpperCase(),
      mode: session.mode,
      paid: session.payment_status === 'paid' || session.status === 'complete',
      plan: session.metadata?.plan ?? null,
      interval: session.metadata?.interval ?? null,
      pack: session.metadata?.pack ?? null,
      isTrial: session.metadata?.type === 'pro_trial_subscription',
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
