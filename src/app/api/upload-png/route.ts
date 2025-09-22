import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Configure route for 20MB uploads and longer timeouts
export const maxDuration = 60 // 60 seconds for large uploads

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse multipart form data
    const formData = await request.formData()
    const folderId = formData.get('folderId') as string
    const files = formData.getAll('files') as File[]
    const role = formData.get('role') as 'product' | 'background' || 'product'

    if (!folderId || files.length === 0) {
      return NextResponse.json(
        { error: 'Missing folderId or files' },
        { status: 400 }
      )
    }

    // Verify folder ownership
    const { data: folder, error: folderError } = await supabase
      .from('folders')
      .select('id')
      .eq('id', folderId)
      .eq('user_id', user.id)
      .single()

    if (folderError || !folder) {
      return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
    }

    // Process files using the working convert-to-png Edge Function
    const uploadedImages = []
    const failedFiles = []

    for (const file of files) {
      try {
        console.log(`[UPLOAD] Starting processing for file: ${file.name}, size: ${file.size} bytes`)
        
        // Convert file to array for Edge Function
        const arrayBuffer = await file.arrayBuffer()
        const imageData = Array.from(new Uint8Array(arrayBuffer))
        
        // Call the working convert-to-png Edge Function
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (!supabaseUrl) {
          throw new Error('Supabase URL not configured')
        }
        
        const convertResponse = await fetch(`${supabaseUrl}/functions/v1/convert-to-png`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            imageData,
            originalName: file.name,
            userId: user.id,
            folderId,
            role,
            maxSide: 1024
          })
        })
        
        if (!convertResponse.ok) {
          const errorData = await convertResponse.text()
          console.error(`[UPLOAD] Edge Function failed: ${convertResponse.status} - ${errorData}`)
          throw new Error(`Edge Function failed: ${convertResponse.status} - ${errorData}`)
        }

        const result = await convertResponse.json()
        
        if (!result.success) {
          console.error(`[UPLOAD] Conversion failed:`, result.error)
          throw new Error(result.error || 'Conversion failed')
        }

        // Create image record in database
        const { data: imageRecord, error: dbError } = await supabase
          .from('images')
          .insert({
            user_id: user.id,
            folder_id: folderId,
            file_path: result.filePath,
            original_name: file.name,
            file_size: result.fileSize || arrayBuffer.byteLength,
            mime_type: 'image/png',
            metadata: {
              role: result.role,
              assets: result.assets || {}
            }
          })
          .select()
          .single()

        if (dbError) {
          console.error(`[UPLOAD] Database error:`, dbError)
          throw new Error('Failed to save image record')
        }

        console.log(`[UPLOAD] File processed successfully: ${result.filePath}`)
        uploadedImages.push({
          id: imageRecord.id,
          fileName: result.filePath.split('/').pop(),
          filePath: result.filePath,
          originalName: file.name,
          role: result.role,
          assets: result.assets || {}
        })

      } catch (error) {
        console.error(`[UPLOAD] Error processing file ${file.name}:`, error)
        failedFiles.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Return results
    if (uploadedImages.length === 0 && failedFiles.length > 0) {
      return NextResponse.json(
        { 
          error: 'All files failed to upload',
          failedFiles
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      uploadedImages,
      failedFiles: failedFiles.length > 0 ? failedFiles : undefined,
      message: `Successfully uploaded ${uploadedImages.length} files${failedFiles.length > 0 ? `, ${failedFiles.length} failed` : ''}`
    })

  } catch (error) {
    console.error('[UPLOAD] Critical error:', error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}