import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folder_id')
    
    if (!folderId) {
      return NextResponse.json({ error: 'folder_id required' }, { status: 400 })
    }

    // List all files in the results bucket for this folder
    const folderPath = `${user.id}/${folderId}/`
    
    const { data: files, error } = await supabase.storage
      .from('results')
      .list(folderPath, {
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('Error listing results:', error)
      return NextResponse.json({ error: "Failed to list files" }, { status: 500 })
    }

    // Also check generated-ads bucket
    const { data: genFiles, error: genError } = await supabase.storage
      .from('generated-ads')
      .list('', { limit: 100 })

    return NextResponse.json({
      folderPath,
      resultsBucket: {
        files: files?.map(f => ({
          name: f.name,
          size: f.metadata?.size,
          created_at: f.created_at
        })) || [],
        count: files?.length || 0
      },
      generatedAdsBucket: {
        files: genFiles?.map(f => ({
          name: f.name,
          size: f.metadata?.size,
          created_at: f.created_at
        })) || [],
        count: genFiles?.length || 0,
        error: genError?.message
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in debug-files API:', error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}