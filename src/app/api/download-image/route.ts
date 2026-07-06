import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import sharp from 'sharp'

// Service-role client: needs to read any user's result file + profile to
// decide on watermarking, and storage.objects RLS only allows owners to
// read their own files via the user's own client.
const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function buildWatermarkSvg(width: number, height: number): Buffer {
  const tile = 340
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wm" width="${tile}" height="${tile}" patternUnits="userSpaceOnUse"
                  patternTransform="rotate(-30)">
          <text x="0" y="${tile / 2}" font-family="sans-serif" font-size="28"
                font-weight="700" fill="rgba(255,255,255,0.35)"
                stroke="rgba(0,0,0,0.25)" stroke-width="0.5">
            PREVIEW - UPGRADE FOR HD
          </text>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wm)" />
    </svg>
  `
  return Buffer.from(svg)
}

// Serves a generated image for download. Free-tier users get a watermark
// composited on top of nano-banana-pro results (used_pro_model=true) - the
// original in storage is never touched, so upgrading later gets clean
// downloads automatically. Everything else (regular nano-banana, other
// pipelines, paying subscribers) passes through unmodified.
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId')
    const path = request.nextUrl.searchParams.get('path')
    if (!jobId && !path) {
      return NextResponse.json({ error: 'jobId or path required' }, { status: 400 })
    }

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const jobQuery = supabaseAdmin
      .from('jobs')
      .select('user_id, result_url, status, used_pro_model')
    const { data: job, error: jobError } = await (
      jobId ? jobQuery.eq('id', jobId) : jobQuery.eq('result_url', path!)
    ).single()

    if (jobError || !job || job.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (job.status !== 'completed' || !job.result_url) {
      return NextResponse.json({ error: 'Image not ready' }, { status: 404 })
    }

    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from('results')
      .download(job.result_url)

    if (downloadError || !fileBlob) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const originalBuffer = Buffer.from(await fileBlob.arrayBuffer())

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single()

    const isPayingSubscriber =
      profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'

    const shouldWatermark = job.used_pro_model === true && !isPayingSubscriber

    let outputBuffer: Buffer = originalBuffer
    if (shouldWatermark) {
      const image = sharp(originalBuffer)
      const metadata = await image.metadata()
      const width = metadata.width || 1024
      const height = metadata.height || 1024

      outputBuffer = await image
        .composite([{ input: buildWatermarkSvg(width, height), top: 0, left: 0 }])
        .png()
        .toBuffer()
    }

    return new NextResponse(new Uint8Array(outputBuffer), {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="generated-image-${(jobId || path || 'download').slice(0, 8)}.png"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err) {
    console.error('[download-image] route error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
