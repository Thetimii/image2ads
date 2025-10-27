import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTikTokEvent } from '@/lib/tiktok-events'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { event, properties } = body

    // Get user IP and user agent from headers
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
    const userAgent = request.headers.get('user-agent')
    const referer = request.headers.get('referer') || 'https://image2ad.com'

    // Build event parameters
    const eventParams: any = {
      event,
      event_time: Math.floor(Date.now() / 1000),
      user: {
        email: user.email,
        external_id: user.id,
        ip: ip || undefined,
        user_agent: userAgent || undefined,
      },
      page: {
        url: referer,
      },
    }

    if (properties) {
      eventParams.properties = properties
    }

    // Send to TikTok
    await sendTikTokEvent(eventParams)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('TikTok event tracking error:', error)
    return NextResponse.json(
      { error: 'Failed to track event' },
      { status: 500 }
    )
  }
}
