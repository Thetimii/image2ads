import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params
    console.log('Fetching job status:', jobId)

    // Use regular client to respect RLS
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch job with user permission check
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('id, status, created_at, updated_at, error_message, result_url, custom_name')
      .eq('id', jobId)
      .eq('user_id', user.id) // Ensure user owns the job
      .single()

    if (fetchError) {
      console.error('Error fetching job:', fetchError)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    console.log('Job status:', { id: job.id, status: job.status })
    return NextResponse.json(job)

  } catch (error) {
    console.error('Unexpected error in GET /api/jobs/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobId } = await params
    console.log('Deleting failed job:', jobId)

    // Create service client with admin privileges for reliable deletion
    const adminSupabase = createServiceClient()

    // First verify the job exists and is in failed state
    const { data: job, error: fetchError } = await adminSupabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (fetchError) {
      console.error('Error fetching job:', fetchError)
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Verify this is a failed job (optional - we could allow deleting any job)
    if (job.status !== 'failed') {
      console.log('Warning: Deleting job that is not in failed state:', job.status)
    }

    // Delete the job from the database
    const { error: deleteError } = await adminSupabase
      .from('jobs')
      .delete()
      .eq('id', jobId)

    if (deleteError) {
      console.error('Error deleting job from database:', deleteError)
      return NextResponse.json({ error: 'Failed to delete job' }, { status: 500 })
    }

    console.log('Successfully deleted failed job:', jobId)
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Unexpected error in DELETE /api/jobs/[id]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}