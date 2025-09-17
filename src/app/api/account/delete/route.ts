import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// Create Supabase client with service role for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // This is the key that bypasses RLS
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function DELETE(request: NextRequest) {
  try {
    // Get the JWT token from the Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.split(' ')[1]
    
    // Verify the JWT token using the admin client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userId = user.id

    console.log(`Starting account deletion for user: ${userId}`)

    // Step 1: Delete all files from storage buckets
    await deleteUserStorageFiles(userId)

    // Step 2: Delete database records (in order to respect foreign key constraints)
    // The CASCADE deletes should handle most of this, but we'll be explicit
    
    // Delete generated ads metadata
    const { error: metadataError } = await supabaseAdmin
      .from('generated_ads_metadata')
      .delete()
      .eq('user_id', userId)
    
    if (metadataError) {
      console.error('Error deleting generated ads metadata:', metadataError)
    }

    // Delete usage events
    const { error: usageError } = await supabaseAdmin
      .from('usage_events')
      .delete()
      .eq('user_id', userId)
    
    if (usageError) {
      console.error('Error deleting usage events:', usageError)
    }

    // Delete jobs (this will cascade to related data)
    const { error: jobsError } = await supabaseAdmin
      .from('jobs')
      .delete()
      .eq('user_id', userId)
    
    if (jobsError) {
      console.error('Error deleting jobs:', jobsError)
    }

    // Delete images (this will cascade from folders, but being explicit)
    const { error: imagesError } = await supabaseAdmin
      .from('images')
      .delete()
      .eq('user_id', userId)
    
    if (imagesError) {
      console.error('Error deleting images:', imagesError)
    }

    // Delete folders
    const { error: foldersError } = await supabaseAdmin
      .from('folders')
      .delete()
      .eq('user_id', userId)
    
    if (foldersError) {
      console.error('Error deleting folders:', foldersError)
    }

    // Delete profile (this should cascade delete most other data due to ON DELETE CASCADE)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to delete profile data' },
        { status: 500 }
      )
    }

    // Step 3: Delete the auth user (this is the final step)
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError)
      return NextResponse.json(
        { error: 'Failed to delete user account' },
        { status: 500 }
      )
    }

    console.log(`Successfully deleted account for user: ${userId}`)

    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    )

  } catch (error) {
    console.error('Error in account deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function deleteUserStorageFiles(userId: string) {
  try {
    // Delete from uploads bucket
    const { data: uploadFiles, error: uploadListError } = await supabaseAdmin.storage
      .from('uploads')
      .list(userId)

    if (uploadListError) {
      console.error('Error listing upload files:', uploadListError)
    } else if (uploadFiles && uploadFiles.length > 0) {
      const uploadFilePaths = uploadFiles.map(file => `${userId}/${file.name}`)
      const { error: uploadDeleteError } = await supabaseAdmin.storage
        .from('uploads')
        .remove(uploadFilePaths)
      
      if (uploadDeleteError) {
        console.error('Error deleting upload files:', uploadDeleteError)
      } else {
        console.log(`Deleted ${uploadFiles.length} files from uploads bucket`)
      }
    }

    // Delete from results bucket
    const { data: resultFiles, error: resultListError } = await supabaseAdmin.storage
      .from('results')
      .list(userId)

    if (resultListError) {
      console.error('Error listing result files:', resultListError)
    } else if (resultFiles && resultFiles.length > 0) {
      const resultFilePaths = resultFiles.map(file => `${userId}/${file.name}`)
      const { error: resultDeleteError } = await supabaseAdmin.storage
        .from('results')
        .remove(resultFilePaths)
      
      if (resultDeleteError) {
        console.error('Error deleting result files:', resultDeleteError)
      } else {
        console.log(`Deleted ${resultFiles.length} files from results bucket`)
      }
    }

  } catch (error) {
    console.error('Error deleting storage files:', error)
  }
}