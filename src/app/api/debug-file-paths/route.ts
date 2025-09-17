/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const fileName = searchParams.get('fileName')
  
  if (!fileName) {
    return NextResponse.json({ error: 'fileName parameter required' }, { status: 400 })
  }

  const supabase = await createClient()
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  console.log(`=== DEBUG FILE PATHS FOR: ${fileName} ===`)
  
  const results = {
    fileName,
    userId: user.id,
    foundPaths: [] as any[],
    bucketContents: {} as Record<string, unknown>,
    permissions: {} as Record<string, unknown>,
    metadata: null as Record<string, unknown> | null
  }

  try {
    // 1. Check metadata first
    console.log('1. Checking metadata...')
    const { data: metadataData, error: metadataError } = await supabase
      .from('generated_ads_metadata')
      .select('*')
      .eq('file_name', fileName)
      .maybeSingle()
    
    results.metadata = { data: metadataData, error: metadataError }
    console.log('Metadata result:', results.metadata)

    // 2. Get all user folders
    console.log('2. Getting all user folders...')
    const { data: folders, error: foldersError } = await supabase
      .from('folders')
      .select('id, name')
      .eq('user_id', user.id)
    
    if (foldersError) {
      console.error('Error getting folders:', foldersError)
      return NextResponse.json({ error: 'Failed to get folders' }, { status: 500 })
    }

    console.log(`Found ${folders?.length || 0} folders for user`)

    // 3. Check each folder for the file
    if (folders) {
      for (const folder of folders) {
        const folderPath = `${user.id}/${folder.id}`
        console.log(`Checking folder: ${folderPath}`)
        
        const { data: folderFiles, error: listError } = await supabase.storage
          .from('results')
          .list(folderPath)
        
        if (listError) {
          console.error(`Error listing folder ${folderPath}:`, listError)
          continue
        }

        const foundFile = folderFiles?.find((f: any) => f.name === fileName)
        if (foundFile) {
          const fullPath = `${folderPath}/${fileName}`
          console.log(`FOUND FILE AT: ${fullPath}`)
          
          // Try to get file info and public URL
          const { data: fileInfo } = await supabase.storage
            .from('results')
            .list(folderPath, {
              search: fileName
            })
          
          // Test permissions by trying to get a signed URL
          const { data: signedUrl, error: urlError } = await supabase.storage
            .from('results')
            .createSignedUrl(fullPath, 60)
          
          results.foundPaths.push({
            bucketName: 'results',
            fullPath,
            folderPath,
            folderId: folder.id,
            folderName: folder.name,
            fileInfo: foundFile,
            signedUrlSuccess: !urlError,
            signedUrlError: urlError?.message,
            signedUrl: signedUrl?.signedUrl
          })
        }
      }
    }

    // 4. Check generated-ads bucket
    console.log('4. Checking generated-ads bucket...')
    const { data: genAdsFiles, error: genAdsError } = await supabase.storage
      .from('generated-ads')
      .list('')
    
    results.bucketContents.generatedAds = { data: genAdsFiles, error: genAdsError }
    
    const foundInGenAds = genAdsFiles?.find((f: any) => f.name === fileName)
    if (foundInGenAds) {
      console.log(`FOUND FILE IN GENERATED-ADS: ${fileName}`)
      
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from('generated-ads')
        .createSignedUrl(fileName, 60)
      
      results.foundPaths.push({
        bucketName: 'generated-ads',
        fullPath: fileName,
        folderPath: '',
        folderId: null,
        folderName: null,
        fileInfo: foundInGenAds,
        signedUrlSuccess: !urlError,
        signedUrlError: urlError?.message,
        signedUrl: signedUrl?.signedUrl
      })
    }

    // 5. Check root of results bucket
    console.log('5. Checking root of results bucket...')
    const { data: rootFiles, error: rootError } = await supabase.storage
      .from('results')
      .list('')
    
    results.bucketContents.resultsRoot = { data: rootFiles, error: rootError }
    
    const foundInRoot = rootFiles?.find((f: any) => f.name === fileName)
    if (foundInRoot) {
      console.log(`FOUND FILE IN RESULTS ROOT: ${fileName}`)
      
      const { data: signedUrl, error: urlError } = await supabase.storage
        .from('results')
        .createSignedUrl(fileName, 60)
      
      results.foundPaths.push({
        bucketName: 'results',
        fullPath: fileName,
        folderPath: '',
        folderId: null,
        folderName: 'root',
        fileInfo: foundInRoot,
        signedUrlSuccess: !urlError,
        signedUrlError: urlError?.message,
        signedUrl: signedUrl?.signedUrl
      })
    }

    // 6. Test deletion permissions on each found path
    console.log('6. Testing deletion permissions...')
    for (const path of results.foundPaths) {
      console.log(`Testing deletion for: ${path.fullPath} in bucket: ${path.bucketName}`)
      
      // Don't actually delete, just test the permission by trying to get file info
      const { data: fileExists, error: checkError } = await supabase.storage
        .from(path.bucketName)
        .list(path.folderPath || '')
      
      const stillThere = fileExists?.find((f: any) => f.name === fileName)
      
      path.canAccess = !checkError
      path.accessError = checkError?.message
      path.fileStillExists = !!stillThere
      
      // Try a test operation to check write permissions
      const testPath = path.fullPath
      const { error: testError } = await supabase.storage
        .from(path.bucketName)
        .list(path.folderPath || '', { search: fileName })
      
      path.hasReadPermission = !testError
      path.readPermissionError = testError?.message
    }

    console.log(`=== SUMMARY FOR ${fileName} ===`)
    console.log(`Found in ${results.foundPaths.length} locations:`)
    results.foundPaths.forEach((path, i) => {
      console.log(`${i + 1}. ${path.bucketName}:${path.fullPath} (folder: ${path.folderName || 'root'})`)
    })

    return NextResponse.json(results)

  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : 'Unknown error',
      results 
    }, { status: 500 })
  }
}