import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendMetaEvent } from '@/lib/meta-capi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Called from the client the moment any of ChatGenerator's 3 independent
// completion-detection paths (polling / realtime / fallback re-poll) sees a
// job go to status='completed'. Safe to call on every completion, every
// user - the atomic `IS NULL` guard below means only the true first
// completion for a given user actually fires the event/CAPI call, so the
// 3 duplicate detection paths racing each other is harmless.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
    }

    const admin = createServiceClient()

    const { data: updated, error: updateErr } = await admin
      .from('profiles')
      .update({ first_generation_completed_at: new Date().toISOString() })
      .eq('id', user.id)
      .is('first_generation_completed_at', null)
      .select('id, email')
      .maybeSingle()

    if (updateErr) {
      console.error('[first-generation-completed] update failed:', updateErr.message)
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    if (!updated) {
      // Already recorded for this user - not an error, just a no-op.
      return NextResponse.json({ ok: true, fired: false })
    }

    await admin.rpc('track_server_event', {
      p_user_id: user.id,
      p_event_name: 'first_generation_completed',
      p_properties: {},
    })

    // Match via the fbclid captured server-side at landing (analytics_sessions),
    // not the client's localStorage copy - this route runs server-side.
    const { data: session } = await admin
      .from('analytics_sessions')
      .select('fbclid, landed_at')
      .eq('user_id', user.id)
      .not('fbclid', 'is', null)
      .order('landed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const fbc = session?.fbclid
      ? `fb.1.${new Date(session.landed_at).getTime()}.${session.fbclid}`
      : undefined

    // Deliberately does not touch the Meta Ads campaign's optimization event -
    // this only sends the signal so it can accumulate volume before anyone
    // switches the campaign over to it.
    const metaResult = await sendMetaEvent({
      eventName: 'FirstGenerationCompleted',
      eventSourceUrl: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://image2ad.com'}/dashboard`,
      actionSource: 'website',
      eventId: `first_gen_${user.id}`,
      eventTime: Math.floor(Date.now() / 1000),
      customData: { content_name: 'first_generation_completed' },
      userData: { email: updated.email, externalId: user.id, fbc },
    })

    return NextResponse.json({ ok: true, fired: true, meta: metaResult })
  } catch (err) {
    console.error('[first-generation-completed] error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
