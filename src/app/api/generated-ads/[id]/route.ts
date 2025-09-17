import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id: adId } = await params
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get('folder_id')

    console.log(`DELETE request for adId: ${adId}, folderId: ${folderId}`)

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log(`Attempting to delete generated ad: ${adId}`)

    // Create admin client with elevated permissions for file operations
    const adminSupabase = createServiceClient()

    // The adId might already include .png extension or not, handle both cases
    const fileName = adId.endsWith('.png') ? adId : `${adId}.png`
    const cleanAdId = adId.replace('.png', '') // For searching metadata
    
    console.log(`fileName: ${fileName}, cleanAdId: ${cleanAdId}`)

    // DEBUG: Let's see exactly where this file exists
    console.log('=== DEBUGGING FILE LOCATIONS ===')
    
    // Check all user folders for the file
    const { data: debugFolders } = await supabase
      .from('folders')
      .select('id, name')
      .eq('user_id', user.id)
    
    console.log(`User has ${debugFolders?.length || 0} folders`)
    
    const fileLocations = []
    if (debugFolders) {
      for (const folder of debugFolders) {
        const checkPath = `${user.id}/${folder.id}`
        const { data: folderFiles } = await supabase.storage
          .from('results')
          .list(checkPath)
        
        const fileInFolder = folderFiles?.find((f: any) => f.name === fileName)
        if (fileInFolder) {
          const fullPath = `${checkPath}/${fileName}`
          fileLocations.push({
            bucket: 'results',
            path: fullPath,
            folderId: folder.id,
            folderName: folder.name,
            fileSize: fileInFolder.metadata?.size,
            lastModified: fileInFolder.updated_at
          })
          console.log(`FOUND: ${fullPath} (size: ${fileInFolder.metadata?.size}, modified: ${fileInFolder.updated_at})`)
        }
      }
    }
    
    // Check generated-ads bucket
    const { data: genFiles } = await supabase.storage
      .from('generated-ads')
      .list('')
    
    const inGenAds = genFiles?.find((f: any) => f.name === fileName)
    if (inGenAds) {
      fileLocations.push({
        bucket: 'generated-ads',
        path: fileName,
        folderId: null,
        folderName: 'generated-ads-bucket',
        fileSize: inGenAds.metadata?.size,
        lastModified: inGenAds.updated_at
      })
      console.log(`FOUND: generated-ads/${fileName} (size: ${inGenAds.metadata?.size}, modified: ${inGenAds.updated_at})`)
    }
    
    console.log(`Total file locations found: ${fileLocations.length}`)
    console.log('File locations:', JSON.stringify(fileLocations, null, 2))
    
    if (fileLocations.length === 0) {
      console.log('File not found in any location!')
      return NextResponse.json({ 
        message: 'File not found in storage',
        fileName,
        storageDeleted: true,
        metadataDeleted: false
      })
    }
    
    console.log('=== END DEBUG INFO ===')

    // First, try to get the ad metadata (may not exist for older files)
    const { data: adData, error: fetchError } = await supabase
      .from('generated_ads_metadata')
      .select('file_name, user_id, folder_id')
      .eq('file_name', fileName)
      .single()

    console.log('Metadata query result:', { adData, fetchError })

    // If no metadata exists, we need to find the file in storage to verify ownership
    const userId = user.id
    let folderPath = null

    if (fetchError && fetchError.code === 'PGRST116') {
      // No metadata found - this is an older file, we need to find it in storage
      console.log('No metadata found, searching storage for file:', fileName)
      
      // If we have a folder_id from the request, try that first
      if (folderId) {
        const testPath = `${user.id}/${folderId}/`
        const { data: files } = await supabase.storage
          .from('results')
          .list(testPath)

        if (files && files.find(f => f.name === fileName)) {
          folderPath = testPath
          console.log('Found file in provided folder:', folderPath)
        }
      }
      
      // If still not found, try all user folders
      if (!folderPath) {
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
      // Set folder path - prefer provided folder_id, then metadata folder_id
      const targetFolderId = folderId || adData.folder_id
      if (targetFolderId) {
        folderPath = `${user.id}/${targetFolderId}/`
      }
    }

    // Delete from storage - try all possible locations
    let storageDeleted = false
    const deletionAttempts = []
    
    console.log('Attempting storage deletion with folderPath:', folderPath)
    
    if (folderPath) {
      // We know the exact path
      const filePath = `${folderPath}${fileName}`
      console.log('Attempting to delete from results storage:', filePath)
      
      // First check if file exists
      const { data: beforeFiles } = await supabase.storage
        .from('results')
        .list(folderPath)
      
      const fileExistsBefore = beforeFiles?.find(f => f.name === fileName)
      console.log('File exists before deletion:', !!fileExistsBefore)
      
      if (!fileExistsBefore) {
        console.log('File not found at expected path:', filePath)
        deletionAttempts.push({
          bucket: 'results',
          path: filePath,
          success: false,
          error: 'File not found at expected path'
        })
      } else {
        // Use admin client for file deletion (has elevated permissions)
        console.log('Using admin client for file deletion with elevated permissions')
        const { error: storageError } = await adminSupabase.storage
          .from('results')
          .remove([filePath])
        
        // Add a small delay to allow Supabase storage to propagate the deletion
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Check if file still exists after deletion (use admin client for verification too)
        const { data: afterFiles } = await adminSupabase.storage
          .from('results')
          .list(folderPath)
        
        const fileExistsAfter = afterFiles?.find(f => f.name === fileName)
        const actuallyDeleted = !fileExistsAfter
        
        console.log('File exists after deletion:', !!fileExistsAfter)
        console.log('Actually deleted:', actuallyDeleted)
        
        deletionAttempts.push({
          bucket: 'results',
          path: filePath,
          success: actuallyDeleted,
          error: storageError?.message,
          supabaseSuccess: !storageError,
          actuallyDeleted
        })
        
        if (storageError) {
          console.error('Error deleting from results storage:', storageError)
        } else if (actuallyDeleted) {
          console.log('Successfully deleted from results storage:', filePath)
          storageDeleted = true
        } else {
          console.error('Supabase said success but file still exists:', filePath)
          
          // Try alternative deletion methods for this stubborn file using admin client
          console.log('Attempting alternative deletion methods with admin client...')
          
          // Try deleting just the filename without full path
          const { error: altError1 } = await adminSupabase.storage
            .from('results')
            .remove([fileName])
          
          // Try with different path construction
          const altPath = `${user.id}/${folderId}/${fileName}`
          const { error: altError2 } = await adminSupabase.storage
            .from('results')
            .remove([altPath])
          
          // Check again if file was deleted by alternative methods
          const { data: finalCheck } = await adminSupabase.storage
            .from('results')
            .list(folderPath)
          
          const stillExists = finalCheck?.find(f => f.name === fileName)
          
          deletionAttempts.push({
            bucket: 'results',
            path: fileName,
            success: !altError1,
            error: altError1?.message,
            type: 'alternative-method-1'
          })
          
          deletionAttempts.push({
            bucket: 'results', 
            path: altPath,
            success: !altError2,
            error: altError2?.message,
            type: 'alternative-method-2'
          })
          
          if (!stillExists) {
            console.log('Alternative deletion method worked!')
            storageDeleted = true
          } else {
            console.error('All deletion methods failed, file still exists')
          }
        }
      }
    }
    
    // If we don't have a specific folder path or the deletion failed, try all folders
    if (!storageDeleted) {
      console.log('Searching all folders for file deletion...')
      const { data: folders } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', user.id)

      if (folders) {
        for (const folder of folders) {
          const testPath = `${user.id}/${folder.id}/${fileName}`
          console.log('Trying to delete from path:', testPath)
          
          // Use admin client for cross-folder deletion
          const { error: storageError } = await adminSupabase.storage
            .from('results')
            .remove([testPath])
          
          deletionAttempts.push({
            bucket: 'results',
            path: testPath,
            success: !storageError,
            error: storageError?.message
          })
          
          if (!storageError) {
            console.log('Successfully deleted from results storage:', testPath)
            storageDeleted = true
            break
          } else {
            console.log('Failed to delete from path:', testPath, storageError.message)
          }
        }
      }
    }

    // Also try generated-ads bucket (backup location) - use admin client
    console.log('Attempting to delete from generated-ads bucket:', fileName)
    const { error: genStorageError } = await adminSupabase.storage
      .from('generated-ads')
      .remove([fileName])
    
    deletionAttempts.push({
      bucket: 'generated-ads',
      path: fileName,
      success: !genStorageError,
      error: genStorageError?.message
    })
    
    if (!genStorageError) {
      console.log('Successfully deleted from generated-ads storage:', fileName)
      storageDeleted = true
    } else {
      console.log('Could not delete from generated-ads storage (expected if not stored there):', genStorageError.message)
    }

    // Final verification: Check if file still exists anywhere after all deletion attempts
    console.log('Performing final verification of file deletion...')
    
    // Add delay to allow Supabase storage to fully propagate all deletions
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    let finalFileExists = false
    
    // Check in the specific folder path if we have one (use admin client for verification)
    if (folderPath) {
      const { data: finalFolderCheck } = await adminSupabase.storage
        .from('results')
        .list(folderPath)
      
      const stillInFolder = finalFolderCheck?.find((f: any) => f.name === fileName)
      if (stillInFolder) {
        console.log('WARNING: File still exists in original folder after deletion attempts!')
        finalFileExists = true
      }
    }
    
    // Check all user folders to be absolutely sure
    const { data: allFolders } = await supabase
      .from('folders')
      .select('id')
      .eq('user_id', user.id)
    
    if (allFolders) {
      for (const folder of allFolders) {
        const checkPath = `${user.id}/${folder.id}`
        const { data: folderFiles } = await supabase.storage
          .from('results')
          .list(checkPath)
        
        const fileInThisFolder = folderFiles?.find(f => f.name === fileName)
        if (fileInThisFolder) {
          console.log(`WARNING: File still exists in folder ${folder.id} after deletion attempts!`)
          finalFileExists = true
          
          // Try one more aggressive deletion attempt
          console.log(`Attempting final aggressive deletion from ${checkPath}/${fileName}`)
          const { error: finalDeleteError } = await supabase.storage
            .from('results')
            .remove([`${checkPath}/${fileName}`])
          
          if (!finalDeleteError) {
            console.log(`Final aggressive deletion succeeded for ${checkPath}/${fileName}`)
          } else {
            console.log(`Final aggressive deletion failed: ${finalDeleteError.message}`)
          }
        }
      }
    }
    
    // Update storage deleted status based on final verification
    if (finalFileExists) {
      console.log('Final verification shows file still exists despite deletion attempts')
      storageDeleted = false
    } else {
      console.log('Final verification confirms file has been successfully deleted')
      storageDeleted = true
    }

    // Log all deletion attempts
    console.log('All deletion attempts:', deletionAttempts)

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

    console.log(`Delete operation completed for ${adId}:`, {
      storageDeleted,
      metadataDeleted: !!adData,
      fileName,
      folderPath: folderPath || 'none',
      deletionAttempts
    })

    return NextResponse.json({ 
      success: true,
      message: 'Ad deleted successfully',
      storageDeleted,
      metadataDeleted: !!adData,
      details: {
        fileName,
        folderPath: folderPath || 'searched all folders',
        deletionAttempts
      }
    })

  } catch (error) {
    console.error('Error in DELETE /api/generated-ads/[id]:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}