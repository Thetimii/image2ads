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
    const path = searchParams.get('path')
    const imageId = searchParams.get('imageId')

    // If checking a specific image ID
    if (imageId) {
      const { data: image, error: imageError } = await supabase
        .from('images')
        .select('file_path, folder_id, original_name, user_id')
        .eq('id', imageId)
        .single()

      if (imageError || !image) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 })
      }

      // Check if files exist in buckets
      const bucketResults = []
      
      for (const bucket of ['uploads', 'results']) {
        try {
          // Try to create signed URL
          const { data: signed, error: signError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(image.file_path, 60)

          if (signError) {
            bucketResults.push({
              bucket,
              error: signError.message,
              exists: false
            })
            continue
          }

          // Try to fetch the file
          const response = await fetch(signed.signedUrl)
          bucketResults.push({
            bucket,
            exists: response.ok,
            status: response.status,
            contentType: response.headers.get('content-type'),
            size: response.headers.get('content-length')
          })
        } catch (e) {
          bucketResults.push({
            bucket,
            error: (e as Error).message,
            exists: false
          })
        }
      }

      return NextResponse.json({
        image,
        bucketResults
      })
    }

    // List files in user directory
    if (path) {
      const results: Record<string, { error?: string; files?: string[] }> = {}
      
      for (const bucket of ['uploads', 'results']) {
        try {
          const { data, error } = await supabase.storage
            .from(bucket)
            .list(path, { limit: 100 })

          if (error) {
            results[bucket] = { error: error.message }
          } else {
            results[bucket] = { files: data?.map((f: { name: string }) => f.name) || [] }
          }
        } catch (e) {
          results[bucket] = { error: (e as Error).message }
        }
      }

      return NextResponse.json(results)
    }

    // List user's folders if no specific path
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('id, name')
      .eq('user_id', user.id)

    if (foldersError) {
      return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 })
    }

    return NextResponse.json({
      userId: user.id,
      folders,
      message: 'Use ?path=user_id/folder_id to list files or ?imageId=uuid to check specific image'
    })

  } catch (error) {
    console.error('Debug storage error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}