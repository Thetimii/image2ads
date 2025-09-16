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

    console.log('Metadata rename request - adId:', adId, 'newName:', name)

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    // The adId is the filename without extension (e.g., "jobId-timestamp")
    const fileName = `${adId}.png`
    
    console.log('Looking for metadata for file:', fileName)

    // First, check if metadata already exists
    const { data: existingMetadata, error: fetchError } = await supabase
      .from('generated_ads_metadata')
      .select('*')
      .eq('file_name', fileName)
      .eq('user_id', user.id)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching metadata:', fetchError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (existingMetadata) {
      // Update existing metadata
      const { data: updatedMetadata, error: updateError } = await supabase
        .from('generated_ads_metadata')
        .update({ 
          custom_name: name.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingMetadata.id)
        .select()
        .single()

      if (updateError) {
        console.error('Error updating metadata:', updateError)
        return NextResponse.json({ error: 'Failed to update name' }, { status: 500 })
      }

      console.log('Metadata updated:', updatedMetadata)
    } else {
      // Create new metadata entry
      // We need to find the folder this file belongs to
      const { data: folders } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', user.id)

      let foundFolderId = null

      if (folders) {
        // Search for the file in storage to determine which folder it belongs to
        for (const folder of folders) {
          const folderPath = `${user.id}/${folder.id}/`
          const { data: files } = await supabase.storage
            .from('results')
            .list(folderPath)

          if (files && files.find(f => f.name === fileName)) {
            foundFolderId = folder.id
            break
          }
        }
      }

      const { data: newMetadata, error: insertError } = await supabase
        .from('generated_ads_metadata')
        .insert({
          file_name: fileName,
          custom_name: name.trim(),
          user_id: user.id,
          folder_id: foundFolderId
        })
        .select()
        .single()

      if (insertError) {
        console.error('Error creating metadata:', insertError)
        return NextResponse.json({ error: 'Failed to save name' }, { status: 500 })
      }

      console.log('Metadata created:', newMetadata)
    }

    return NextResponse.json({ 
      success: true,
      fileName: fileName,
      customName: name.trim()
    })

  } catch (error) {
    console.error('Error in metadata rename:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}