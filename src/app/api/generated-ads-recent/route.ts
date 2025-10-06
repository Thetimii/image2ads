import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Helper function to convert storage path to public URL
function getPublicUrl(supabase: any, path: string): string {
  const { data } = supabase.storage
    .from('results')
    .getPublicUrl(path)
  return data?.publicUrl || ''
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent completed jobs with result URLs
    const { data: jobs, error: fetchError } = await supabase
      .from('jobs')
      .select('id, custom_name, result_url, created_at, updated_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .not('result_url', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(20) // Get last 20 generated ads

    if (fetchError) {
      console.error('Error fetching generated ads:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch generated ads' }, { status: 500 })
    }

    // Transform to match expected format with proper public URLs
    const generatedAds = (jobs || []).map(job => ({
      id: job.id,
      url: getPublicUrl(supabase, job.result_url),
      created_at: job.updated_at || job.created_at,
      name: job.custom_name || 'Generated Ad'
    }))

    console.log(`Fetched ${generatedAds.length} generated ads for user ${user.id}`)
    return NextResponse.json({ generatedAds })

  } catch (error) {
    console.error('Unexpected error in GET /api/generated-ads:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}