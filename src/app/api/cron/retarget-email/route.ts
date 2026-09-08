import { NextRequest, NextResponse } from 'next/server'
import { edgeFunctionUrl, internalFunctionHeaders } from '@/lib/edge-functions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when
// CRON_SECRET is set as an env var - this is the real auth check the old
// send-reminders route left commented out. Requires CRON_SECRET to be set
// in Vercel project env vars (see deployment notes).
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const internalHeaders = internalFunctionHeaders()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !internalHeaders) {
    return NextResponse.json({ error: 'missing supabase config' }, { status: 500 })
  }

  try {
    const resp = await fetch(edgeFunctionUrl('retarget-email-daily'), {
      method: 'POST',
      headers: internalHeaders,
    })

    const body = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      console.error('[cron/retarget-email] edge function failed:', resp.status, body)
      return NextResponse.json({ ok: false, status: resp.status, body }, { status: 502 })
    }

    return NextResponse.json({ ok: true, result: body })
  } catch (err) {
    console.error('[cron/retarget-email] error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
