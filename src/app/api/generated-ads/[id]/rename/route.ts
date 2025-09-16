import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { name } = await request.json()
    const supabase = await createClient()
    const { id: adId } = await context.params

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // The adId is actually the filename without extension (e.g., "jobId-timestamp")
    // We need to find the actual file in storage
    const originalFileName = `${adId}.png`
    
    // Search in all user folders to find the file
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('id')
      .eq('user_id', user.id)

    if (foldersError || !folders) {
      return NextResponse.json({ error: 'Failed to get user folders' }, { status: 500 })
    }

    let foundFile = null
    let folderPath = null

    // Look for the file in each folder
    for (const folder of folders) {
      const searchPath = `${user.id}/${folder.id}/`
      const { data: files, error: listError } = await supabase.storage
        .from('results')
        .list(searchPath)

      if (!listError && files) {
        const file = files.find(f => f.name === originalFileName)
        if (file) {
          foundFile = file
          folderPath = searchPath
          break
        }
      }
    }

    if (!foundFile || !folderPath) {
      return NextResponse.json({ error: 'Generated ad not found' }, { status: 404 })
    }

    // Create new file name with proper extension
    const sanitizedName = name.replace(/[^a-zA-Z0-9\-_]/g, '_') // Sanitize filename
    const newFileName = `${sanitizedName}.png`
    const oldPath = `${folderPath}${originalFileName}`
    const newPath = `${folderPath}${newFileName}`

    // Rename the file in Supabase storage
    const { error: moveError } = await supabase.storage
      .from('results')
      .move(oldPath.replace('results/', ''), newPath.replace('results/', ''))

    if (moveError) {
      console.error('Error moving file in storage:', moveError)
      return NextResponse.json({ error: 'Failed to rename file in storage' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      oldName: originalFileName,
      newName: newFileName,
      newPath: newPath 
    })

  } catch (error) {
    console.error('Error renaming generated ad:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}