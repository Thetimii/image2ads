import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserJobs, getSignedUrl } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user jobs
    const jobs = await getUserJobs(user.id)

    // Enhance jobs with signed URLs for completed results
    const enhancedJobs = await Promise.all(
      jobs.map(async (job) => {
        if (job.status === 'completed' && job.result_url) {
          const signedUrl = await getSignedUrl('results', job.result_url, 300) // 5 minutes
          return {
            ...job,
            result_signed_url: signedUrl,
          }
        }
        return job
      })
    )

    return NextResponse.json({ jobs: enhancedJobs })

  } catch (error) {
    console.error('Jobs fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}