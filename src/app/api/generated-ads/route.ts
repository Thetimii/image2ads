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

    if (!folderId) {
      return NextResponse.json({ error: "folder_id is required" }, { status: 400 });
    }

    // List all files in the results bucket for this user/folder
    const folderPath = `${user.id}/${folderId}/`;
    
    const { data: files, error } = await supabase.storage
      .from('results')
      .list(folderPath, {
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('Error listing results:', error);
      return NextResponse.json({ error: "Failed to load generated ads" }, { status: 500 });
    }

    // Get metadata for custom names
    const { data: metadata, error: metadataError } = await supabase
      .from('generated_ads_metadata')
      .select('file_name, custom_name, name')
      .eq('user_id', user.id)

    if (metadataError) {
      console.error('Error fetching metadata:', metadataError)
    }

    // Create a map for quick lookup
    const metadataMap = new Map()
    if (metadata) {
      metadata.forEach(meta => {
        // Use custom_name if available, otherwise use name field
        const displayName = meta.custom_name || meta.name
        if (displayName) {
          metadataMap.set(meta.file_name, displayName)
        }
      })
    }

    console.log('Metadata map:', Object.fromEntries(metadataMap))

    // Transform files into a format similar to jobs for UI compatibility
    const generatedAds = await Promise.all(
      (files || [])
        .filter(file => file.name.endsWith('.png')) // Only PNG files
        .map(async (file) => {
          const filePath = `${folderPath}${file.name}`;
          
          // Create signed URL for the image
          const { data: signedUrl } = await supabase.storage
            .from('results')
            .createSignedUrl(filePath, 3600);

          // Extract timestamp from filename (jobId-timestamp.png format)
          const nameMatch = file.name.match(/^(.+)-(\d+)\.png$/);
          const timestamp = nameMatch ? parseInt(nameMatch[2]) : file.created_at ? new Date(file.created_at).getTime() : Date.now();
          
          // Get custom name from metadata, fallback to filename without extension
          const customName = metadataMap.get(file.name)
          const fallbackName = file.name.replace('.png', '').replace(/-\d+$/, '') // Remove timestamp from fallback
          
          console.log(`File: ${file.name}, Custom name: ${customName}, Fallback: ${fallbackName}`)
          
          return {
            id: file.name.replace('.png', ''), // Use filename without extension as ID
            name: customName || fallbackName, // Use custom name if available, otherwise clean filename
            file_path: filePath,
            url: signedUrl?.signedUrl || '',
            created_at: new Date(timestamp).toISOString(),
            size: file.metadata?.size || 0,
            status: 'completed'
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