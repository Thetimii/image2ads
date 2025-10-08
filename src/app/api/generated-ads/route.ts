import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folder_id");

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let files: any[] = [];
    let folderPath = '';

    if (folderId) {
      // List files for specific folder
      folderPath = `${user.id}/${folderId}/`;
      
      const { data: folderFiles, error } = await supabase.storage
        .from('results')
        .list(folderPath, {
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) {
        console.error('Error listing results:', error);
        return NextResponse.json({ error: "Failed to load generated ads" }, { status: 500 });
      }

      files = folderFiles || [];
    } else {
      // List all files across all folders for this user
      const userPath = `${user.id}/`;
      console.log('Fetching all images for user:', user.id);
      
      // First, get folder information from database to map IDs to names
      const { data: folders, error: folderDbError } = await supabase
        .from('folders')
        .select('id, name')
        .eq('user_id', user.id);

      if (folderDbError) {
        console.error('Error fetching folder names:', folderDbError);
      }

      // Create a map of folder ID to folder name
      const folderNameMap = new Map();
      if (folders) {
        folders.forEach(folder => {
          folderNameMap.set(folder.id, folder.name);
        });
      }

      const { data: userFolders, error: foldersError } = await supabase.storage
        .from('results')
        .list(userPath);

      if (foldersError) {
        console.error('Error listing user folders:', foldersError);
        return NextResponse.json({ error: "Failed to load generated ads" }, { status: 500 });
      }

      console.log('Found folders/items in user directory:', userFolders?.map(f => f.name));

      // Get files from all folders
      const allFiles: any[] = [];
      
      for (const folder of userFolders || []) {
        // Check if it's a folder (has no file extension)
        if (folder.name && !folder.name.includes('.')) {
          console.log(`Checking folder: ${folder.name}`);
          const { data: folderFiles, error: folderError } = await supabase.storage
            .from('results')
            .list(`${userPath}${folder.name}/`, {
              sortBy: { column: 'created_at', order: 'desc' }
            });

          if (!folderError && folderFiles) {
            console.log(`Found ${folderFiles.length} files in folder ${folder.name}:`, folderFiles.map(f => f.name));
            // Add folder info to each file
            const filesWithFolder = folderFiles.map(file => ({
              ...file,
              folder_id: folder.name,
              folder_name: folderNameMap.get(folder.name) || folder.name, // Use database name or fallback to ID
              folder_path: `${userPath}${folder.name}/`
            }));
            allFiles.push(...filesWithFolder);
          } else {
            console.log(`Error or no files in folder ${folder.name}:`, folderError);
          }
        }
      }

      console.log(`Total files found across all folders: ${allFiles.length}`);

      // Sort all files by creation date
      files = allFiles.sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        return dateB - dateA; // Newest first
      });
    }

    // Get metadata for custom names
    const { data: metadata, error: metadataError } = await supabase
      .from('generated_ads_metadata')
      .select('file_name, custom_name')
      .eq('user_id', user.id)

    if (metadataError) {
      console.error('Error fetching metadata:', metadataError)
    }

    // Create a map for quick lookup
    const metadataMap = new Map()
    if (metadata) {
      metadata.forEach(meta => {
        // Use custom_name if available
        const displayName = meta.custom_name
        if (displayName) {
          metadataMap.set(meta.file_name, displayName)
        }
      })
    }

    console.log('Metadata map:', Object.fromEntries(metadataMap))

    // Transform files into a format similar to jobs for UI compatibility
    const generatedAds = await Promise.all(
      (files || [])
        .filter(file => file.name.endsWith('.png') || file.name.endsWith('.mp4')) // Include PNG images and MP4 videos
        .map(async (file) => {
          // Determine the correct file path
          const filePath = file.folder_path 
            ? `${file.folder_path}${file.name}` 
            : `${folderPath}${file.name}`;
          
          // Create signed URL for the image
          const { data: signedUrl } = await supabase.storage
            .from('results')
            .createSignedUrl(filePath, 3600);

          // Determine media type
          const isVideo = file.name.endsWith('.mp4');
          const mediaType = isVideo ? 'video' : 'image';
          
          // Extract timestamp from filename (jobId-timestamp.png/mp4 format)
          const nameMatch = file.name.match(/^(.+)-(\d+)\.(png|mp4)$/);
          const timestamp = nameMatch ? parseInt(nameMatch[2]) : file.created_at ? new Date(file.created_at).getTime() : Date.now();
          
          // Get custom name from metadata, fallback to filename without extension
          const customName = metadataMap.get(file.name) || metadataMap.get(filePath)
          const fallbackName = file.name.replace(/\.(png|mp4)$/, '').replace(/-\d+$/, '') // Remove timestamp from fallback
          
          console.log(`File: ${file.name}, Full path: ${filePath}, Custom name: ${customName}, Fallback: ${fallbackName}, Type: ${mediaType}`)
          
          return {
            id: file.name.replace(/\.(png|mp4)$/, ''), // Use filename without extension as ID
            name: customName || fallbackName, // Use custom name if available, otherwise clean filename
            file_path: filePath,
            url: signedUrl?.signedUrl || '',
            created_at: new Date(timestamp).toISOString(),
            size: file.metadata?.size || 0,
            status: 'completed',
            folder_id: file.folder_id || folderId, // Include folder info for library view
            folder_name: file.folder_name || file.folder_id || folderId, // Use proper folder name
            mediaType: mediaType // Add media type to the response
          };
        })
    );

    return NextResponse.json({ generatedAds });
  } catch (error) {
    console.error('Error in generated-ads API:', error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}