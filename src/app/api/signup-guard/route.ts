import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Service-role client: apply_signup_ip_guard is locked to the service role,
// same pattern as the analytics ingest route.
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Called once right after a new account is created (email or OAuth signup).
// Caps free credits per IP so one person can't farm free generations by
// creating dozens of accounts, without requiring email verification.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      null

    if (!ip) {
      return NextResponse.json({ ok: true, skipped: 'no-ip' })
    }

    const { error } = await supabaseAdmin.rpc('apply_signup_ip_guard', {
      p_user_id: user.id,
      p_ip: ip,
    })

    if (error) {
      console.error('[signup-guard] Failed to apply IP guard:', error.message)
      return NextResponse.json({ error: 'guard failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[signup-guard] route error:', err)
    // Never block signup over this - fail open
    return NextResponse.json({ ok: true, skipped: 'error' })
  }
}
