import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendMetaEvent } from '@/lib/meta-capi'

interface MetaEventRequestBody {
  eventName?: string
  eventSourceUrl?: string
  actionSource?: string
  eventId?: string
  eventTime?: number
  customData?: Record<string, unknown>
  attributionData?: Record<string, unknown>
  originalEventData?: Record<string, unknown>
  userData?: Record<string, unknown>
}

const getCookieValue = (cookies: string | null, key: string) => {
  if (!cookies) return undefined
  const match = cookies.split(/; */).find(cookie => cookie.startsWith(`${key}=`))
  if (!match) return undefined
  return match.split('=')[1]
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MetaEventRequestBody

    if (!body.eventName) {
      return NextResponse.json({ error: 'eventName is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    // Don't fail if user is not authenticated - some events (like PageView) can be anonymous
    if (authError) {
      console.warn('[MetaCAPI] No authenticated user, sending anonymous event')
    }

    const userAgent = request.headers.get('user-agent') || undefined
    const referer = body.eventSourceUrl || request.headers.get('referer') || process.env.NEXT_PUBLIC_APP_URL || 'https://image2ad.com'
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || undefined
    const cookies = request.headers.get('cookie') || null

    const response = await sendMetaEvent({
      eventName: body.eventName,
      eventSourceUrl: referer,
      actionSource: (body.actionSource as any) || 'website',
      eventId: body.eventId,
      eventTime: body.eventTime,
      customData: body.customData,
      attributionData: body.attributionData,
      originalEventData: body.originalEventData,
      userData: {
        email: (body.userData?.email as string | undefined) || user?.email || undefined,
        phone: body.userData?.phone as string | undefined,
        firstName: (body.userData?.firstName as string | undefined) || (user?.user_metadata as any)?.first_name,
        lastName: (body.userData?.lastName as string | undefined) || (user?.user_metadata as any)?.last_name,
        city: body.userData?.city as string | undefined,
        state: body.userData?.state as string | undefined,
        country: body.userData?.country as string | undefined,
        county: body.userData?.county as string | undefined,
        zip: body.userData?.zip as string | undefined,
        gender: body.userData?.gender as string | undefined,
        externalId: (body.userData?.externalId as string | undefined) || user?.id,
        clientUserAgent: userAgent,
        ipAddress,
        fbp: (body.userData?.fbp as string | undefined) || getCookieValue(cookies, '_fbp'),
        fbc: (body.userData?.fbc as string | undefined) || getCookieValue(cookies, '_fbc'),
      },
    })

    // Return success even if Meta API fails - don't break user flow
    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[MetaCAPI] API route error:', error)
    // Return 200 to not break user experience, log error for debugging
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 200 })
  }
}
