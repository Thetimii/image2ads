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

    for (const file of files) {
      try {
        // Convert file to PNG using Sharp directly
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Convert to PNG with Sharp
        const pngBuffer = await sharp(buffer)
          .png({
            quality: 95, // High quality PNG
            compressionLevel: 6, // Good compression
          })
          .toBuffer()

        // Generate unique filename
        const timestamp = Date.now()
        const randomId = Math.random().toString(36).substring(2)
        const pngFileName = `${timestamp}-${randomId}.png`
        const filePath = `${user.id}/${folderId}/${pngFileName}`

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
        // Continue with other files instead of failing completely
      }
    }

    return NextResponse.json({
      success: true,
      uploadedImages,
      message: `Successfully uploaded ${uploadedImages.length} of ${files.length} images`,
    })

  } catch (error) {
    console.error('Upload PNG error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}