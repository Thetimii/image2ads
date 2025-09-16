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

    // First, get the current generated ad details to verify ownership
    const { data: generatedAd, error: fetchError } = await supabase
      .from('generated_ads')
      .select(`
        *,
        jobs!inner(user_id)
      `)
      .eq('id', adId)
      .single()

    if (fetchError || !generatedAd) {
      return NextResponse.json({ error: 'Generated ad not found' }, { status: 404 })
    }

    // Verify the user owns this generated ad through the job
    if (generatedAd.jobs.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Get the old file path for renaming in storage
    const oldPath = generatedAd.url
    const oldFileName = oldPath.split('/').pop()
    const pathWithoutFileName = oldPath.substring(0, oldPath.lastIndexOf('/'))
    
    // Create new file name with proper extension
    const fileExtension = oldFileName?.split('.').pop() || 'jpg'
    const sanitizedName = name.replace(/[^a-zA-Z0-9\-_]/g, '_') // Sanitize filename
    const newFileName = `${sanitizedName}.${fileExtension}`
    const newPath = `${pathWithoutFileName}/${newFileName}`

    // Rename the file in Supabase storage
    const { data: moveData, error: moveError } = await supabase.storage
      .from('results')
      .move(oldPath.replace('results/', ''), newPath.replace('results/', ''))

    if (moveError) {
      console.error('Error moving file in storage:', moveError)
      return NextResponse.json({ error: 'Failed to rename file in storage' }, { status: 500 })
    }

    // Update the generated ad record with new name and URL
    const { data: updatedAd, error: updateError } = await supabase
      .from('generated_ads')
      .update({ 
        name: name,
        url: newPath
      })
      .eq('id', adId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating generated ad:', updateError)
      // Try to move the file back if database update failed
      await supabase.storage
        .from('results')
        .move(newPath.replace('results/', ''), oldPath.replace('results/', ''))
      
      return NextResponse.json({ error: 'Failed to update generated ad' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      generatedAd: updatedAd 
    })

  } catch (error) {
    console.error('Error renaming generated ad:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}