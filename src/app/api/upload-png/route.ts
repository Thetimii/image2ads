import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'

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

    // Process files and convert to PNG
    const uploadedImages = []
    const failedFiles = []

    for (const file of files) {
      try {
        console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`)
        
        // Convert file to PNG using Sharp directly
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        console.log(`Buffer created, size: ${buffer.length}`)
        
        // Convert to PNG with Sharp - this should handle JPG, PNG, WEBP, etc.
        const pngBuffer = await sharp(buffer)
          .png({
            quality: 95, // High quality PNG
            compressionLevel: 6, // Good compression
          })
          .toBuffer()

        console.log(`PNG conversion successful, size: ${pngBuffer.length}`)

        // Generate unique filename
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2)
        const pngFileName = `${timestamp}-${randomId}.png`
        const filePath = `${user.id}/${folderId}/${pngFileName}`

        console.log(`Uploading to path: ${filePath}`)

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, pngBuffer, {
            contentType: 'image/png',
            upsert: true,
          })

        if (uploadError) {
          console.error('Upload error:', uploadError)
          throw new Error(`Failed to upload PNG: ${uploadError.message}`)
        }

        console.log(`Upload successful for ${file.name}`)

        const result = {
          fileName: pngFileName,
          filePath: filePath,
          fileSize: pngBuffer.length,
          originalName: file.name,
          convertedFormat: 'png'
        }
        
        // Create image record in database
        const { data: imageRecord, error: dbError } = await supabase
          .from('images')
          .insert({
            user_id: user.id,
            folder_id: folderId,
            file_path: result.filePath,
            original_name: file.name,
            file_size: result.fileSize,
            mime_type: 'image/png', // Always PNG now
          })
          .select()
          .single()

        if (dbError) {
          console.error('Database error:', dbError)
          throw new Error('Failed to save image record')
        }

        uploadedImages.push({
          id: imageRecord.id,
          fileName: result.fileName,
          filePath: result.filePath,
          originalName: file.name,
        })

      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error)
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available')
        failedFiles.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        // Continue with other files instead of failing completely
      }
    }

    return NextResponse.json({
      success: uploadedImages.length > 0,
      uploadedImages,
      failedFiles,
      message: uploadedImages.length > 0 
        ? `Successfully uploaded ${uploadedImages.length} of ${files.length} images${failedFiles.length > 0 ? `. ${failedFiles.length} failed.` : ''}`
        : 'All files failed to upload',
    })

  } catch (error) {
    console.error('Upload PNG error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack available')
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}