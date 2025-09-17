import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

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