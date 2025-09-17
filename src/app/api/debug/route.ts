import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if custom_name column exists by trying to query it
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, custom_name, prompt, created_at')
      .eq('user_id', user.id)
      .limit(5)

    if (jobsError) {
      console.error('Error querying jobs with custom_name:', jobsError)
      return NextResponse.json({ 
        error: 'Database error', 
        details: jobsError.message,
        customNameColumnExists: false
      }, { status: 500 })
    }

    // Try to get generated ads from storage
    const { data: folders } = await supabase
      .from('folders')
      .select('id, name')
      .eq('user_id', user.id)
      .limit(3)

    let storageFiles: Array<{name: string, size: number, created_at: string | null}> = []
    if (folders && folders.length > 0) {
      const firstFolder = folders[0]
      const folderPath = `${user.id}/${firstFolder.id}/`
      
      const { data: files, error: storageError } = await supabase.storage
        .from('results')
        .list(folderPath)

      if (!storageError && files) {
        storageFiles = files.map(f => ({
          name: f.name,
          size: f.metadata?.size || 0,
          created_at: f.created_at
        }))
      }
    }

    return NextResponse.json({ 
      success: true,
      customNameColumnExists: true,
      recentJobs: jobs || [],
      userFolders: folders || [],
      storageFiles: storageFiles,
      userId: user.id
    })

  } catch (error) {
    console.error('Error in debug API:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}