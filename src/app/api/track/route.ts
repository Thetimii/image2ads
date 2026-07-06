import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Service-role client: analytics tables have no RLS policies,
// so only this client (and the Stripe webhook) can write to them.
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const eventSchema = z.object({
  event_name: z.string().min(1).max(64),
  page: z.string().max(512).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  created_at: z.string().optional(),
})

const payloadSchema = z.object({
  session: z.object({
    id: z.string().uuid(),
    anonymous_id: z.string().uuid(),
    user_id: z.string().uuid().optional(),
    landing_page: z.string().max(512).optional(),
    referrer: z.string().max(1024).optional(),
    referrer_category: z.string().max(128).optional(),
    utm_source: z.string().max(256).optional(),
    utm_medium: z.string().max(256).optional(),
    utm_campaign: z.string().max(256).optional(),
    utm_term: z.string().max(256).optional(),
    utm_content: z.string().max(256).optional(),
    fbclid: z.string().max(512).optional(),
    ttclid: z.string().max(512).optional(),
    scroll_depth: z.number().int().min(0).max(100).optional(),
    new_pages: z.number().int().min(0).max(100).optional(),
  }),
  events: z.array(eventSchema).max(50),
})

function parseUserAgent(ua: string) {
  const isTablet = /iPad|Tablet/i.test(ua)
  const isMobile = !isTablet && /Mobi|Android|iPhone/i.test(ua)
  const device_type = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop'

  let browser = 'other'
  if (/Edg\//.test(ua)) browser = 'edge'
  else if (/OPR\//.test(ua)) browser = 'opera'
  else if (/SamsungBrowser/.test(ua)) browser = 'samsung'
  else if (/Chrome\//.test(ua)) browser = 'chrome'
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'safari'
  else if (/Firefox\//.test(ua)) browser = 'firefox'

  let os = 'other'
  if (/Windows/.test(ua)) os = 'windows'
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'ios'
  else if (/Mac OS X/.test(ua)) os = 'macos'
  else if (/Android/.test(ua)) os = 'android'
  else if (/Linux/.test(ua)) os = 'linux'

  return { device_type, browser, os }
}

export async function POST(request: NextRequest) {
  try {
    // sendBeacon may post as text/plain, so parse the raw body
    const raw = await request.text()
    const parsed = payloadSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
    }
    const { session, events } = parsed.data

    // Prefer the auth cookie (authoritative), but the cookie set by a
    // signUp()/signIn() call moments earlier doesn't always land before this
    // request fires - that race was silently losing the anonymous->user link
    // for some signups. Fall back to the client-supplied id in that case;
    // this only affects marketing attribution, never anything privileged.
    let userId: string | null = null
    try {
      const supabase = await createServerClient()
      const { data } = await supabase.auth.getUser()
      userId = data.user?.id ?? null
    } catch {
      // not signed in — anonymous traffic is fine
    }
    if (!userId && session.user_id) {
      userId = session.user_id
    }

    const ua = request.headers.get('user-agent') || ''
    const { device_type, browser, os } = parseUserAgent(ua)
    const country =
      request.headers.get('x-vercel-ip-country') ||
      request.headers.get('cf-ipcountry') ||
      null

    const { error } = await supabaseAdmin.rpc('ingest_analytics', {
      p_session: {
        ...session,
        user_id: userId,
        device_type,
        browser,
        os,
        country,
        user_agent: ua.slice(0, 512),
      },
      p_events: events,
    })

    if (error) {
      console.error('[analytics] ingest failed:', error.message)
      return NextResponse.json({ error: 'ingest failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[analytics] track route error:', err)
    return NextResponse.json({ error: 'bad request' }, { status: 400 })
  }
}
