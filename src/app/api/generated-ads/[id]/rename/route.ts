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

    console.log('Rename request - adId:', adId, 'newName:', name)

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    // The adId is actually the filename without extension (e.g., "jobId-timestamp")
    // We need to find the actual file in storage
    const originalFileName = `${adId}.png`
    
    console.log('Looking for file:', originalFileName)

    // Search in all user folders to find the file
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('id')
      .eq('user_id', user.id)

    if (foldersError || !folders) {
      console.error('Folders error:', foldersError)
      return NextResponse.json({ error: 'Failed to get user folders' }, { status: 500 })
    }

    console.log('User folders found:', folders.length)

    let foundFile = null
    let folderPath = null

    // Look for the file in each folder
    for (const folder of folders) {
      const searchPath = `${user.id}/${folder.id}/`
      console.log('Searching in path:', searchPath)
      
      const { data: files, error: listError } = await supabase.storage
        .from('results')
        .list(searchPath)

      if (listError) {
        console.error('List error for folder', folder.id, ':', listError)
        continue
      }

      if (files) {
        console.log('Files in folder:', files.map(f => f.name))
        const file = files.find(f => f.name === originalFileName)
        if (file) {
          foundFile = file
          folderPath = searchPath
          console.log('File found in folder:', folder.id)
          break
        }
      }
    }

    if (!foundFile || !folderPath) {
      console.error('File not found:', originalFileName)
      return NextResponse.json({ error: 'Generated ad not found' }, { status: 404 })
    }

    // Create new file name with proper extension
    const sanitizedName = name.replace(/[^a-zA-Z0-9\-_]/g, '_') // Sanitize filename
    const newFileName = `${sanitizedName}.png`
    
    // Storage paths should NOT include the bucket name - they are relative to the bucket
    const oldStoragePath = `${folderPath}${originalFileName}`
    const newStoragePath = `${folderPath}${newFileName}`

    console.log('Storage move operation:')
    console.log('  From (storage path):', oldStoragePath)
    console.log('  To (storage path):', newStoragePath)

    // Rename the file in Supabase storage
    const { error: moveError } = await supabase.storage
      .from('results')
      .move(oldStoragePath, newStoragePath)

    if (moveError) {
      console.error('Error moving file in storage:', moveError)
      return NextResponse.json({ 
        error: 'Failed to rename file in storage', 
        details: moveError.message 
      }, { status: 500 })
    }

    console.log('File renamed successfully')

    return NextResponse.json({ 
      success: true, 
      oldName: originalFileName,
      newName: newFileName,
      newPath: `results/${newStoragePath}` // Include bucket name for UI
    })

  } catch (error) {
    console.error('Error renaming generated ad:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}