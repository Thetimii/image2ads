import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
    const { id: adId } = await params

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`Attempting to delete generated ad: ${adId}`)

    // The adId is the filename without .png extension, we need to add it back
    const fileName = adId.endsWith('.png') ? adId : `${adId}.png`

    // First, try to get the ad metadata (may not exist for older files)
    const { data: adData, error: fetchError } = await supabase
      .from('generated_ads_metadata')
      .select('file_name, user_id, folder_id')
      .eq('file_name', fileName)
      .single()

    // If no metadata exists, we need to find the file in storage to verify ownership
    const userId = user.id
    let folderPath = null

    if (fetchError && fetchError.code === 'PGRST116') {
      // No metadata found - this is an older file, we need to find it in storage
      console.log('No metadata found, searching storage for file:', fileName)
      
      // Try to find the file in the user's folders
      const { data: folders } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', user.id)

      let foundInFolder = null
      if (folders) {
        for (const folder of folders) {
          const testPath = `${user.id}/${folder.id}/`
          const { data: files } = await supabase.storage
            .from('results')
            .list(testPath)

          if (files && files.find(f => f.name === fileName)) {
            foundInFolder = folder.id
            folderPath = testPath
            break
          }
        }
      }

      if (!foundInFolder) {
        return NextResponse.json({ 
          error: 'File not found or access denied',
          details: `Could not locate ${fileName} in any of your folders`
        }, { status: 404 })
      }
    } else if (fetchError) {
      console.error('Error fetching ad data:', fetchError)
      return NextResponse.json({ 
        error: 'Failed to fetch ad data',
        details: fetchError.message 
      }, { status: 500 })
    } else if (adData) {
      // Verify ownership
      if (adData.user_id !== user.id) {
        return NextResponse.json({ error: 'Unauthorized - not your ad' }, { status: 403 })
      }
      // Set folder path if we have metadata
      if (adData.folder_id) {
        folderPath = `${user.id}/${adData.folder_id}/`
      }
    }

    // Delete from storage
    let storageDeleted = false
    
    if (folderPath) {
      // We know the exact path
      const { error: storageError } = await supabase.storage
        .from('results')
        .remove([`${folderPath}${fileName}`])
      
      if (storageError) {
        console.error('Error deleting from results storage:', storageError)
      } else {
        console.log('Successfully deleted from results storage:', `${folderPath}${fileName}`)
        storageDeleted = true
      }
    } else {
      // Fallback: search all user folders
      const { data: folders } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', user.id)

      if (folders) {
        for (const folder of folders) {
          const testPath = `${user.id}/${folder.id}/`
          const { error: storageError } = await supabase.storage
            .from('results')
            .remove([`${testPath}${fileName}`])
          
          if (!storageError) {
            console.log('Successfully deleted from results storage:', `${testPath}${fileName}`)
            storageDeleted = true
            break
          }
        }
      }
    }

    // Also try generated-ads bucket (backup location)
    const { error: genStorageError } = await supabase.storage
      .from('generated-ads')
      .remove([fileName])
    
    if (!genStorageError) {
      console.log('Successfully deleted from generated-ads storage:', fileName)
      storageDeleted = true
    }

    // Delete from database (only if metadata exists)
    if (adData) {
      const { error: deleteError } = await supabase
        .from('generated_ads_metadata')
        .delete()
        .eq('file_name', fileName)
        .eq('user_id', user.id) // Extra safety check

      if (deleteError) {
        console.error('Error deleting ad from database:', deleteError)
        return NextResponse.json({ 
          error: 'Failed to delete ad metadata from database',
          details: deleteError.message 
        }, { status: 500 })
      }
      console.log('Successfully deleted metadata from database')
    }

    console.log(`Successfully deleted generated ad: ${adId}`)

    return NextResponse.json({ 
      success: true,
      message: 'Ad deleted successfully',
      storageDeleted,
      metadataDeleted: !!adData
    })

  } catch (error) {
    console.error('Error in DELETE /api/generated-ads/[id]:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}