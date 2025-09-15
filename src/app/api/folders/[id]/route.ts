import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: folderId } = await params;

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify folder ownership
    const { data: folder, error: folderError } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folderId)
      .eq("user_id", user.id)
      .single();

    if (folderError || !folder) {
      return NextResponse.json(
        { error: "Folder not found or access denied" },
        { status: 404 }
      );
    }

    // Delete all images in the folder first
    const { data: images } = await supabase
      .from("images")
      .select("id, file_path")
      .eq("folder_id", folderId)
      .eq("user_id", user.id);

    if (images && images.length > 0) {
      // Delete image files from storage
      const filePaths = images.map((img) => img.file_path);
      await supabase.storage.from("uploads").remove(filePaths);

      // Delete image records
      const { error: imagesDeleteError } = await supabase
        .from("images")
        .delete()
        .eq("folder_id", folderId)
        .eq("user_id", user.id);

      if (imagesDeleteError) {
        console.error("Error deleting images:", imagesDeleteError);
        return NextResponse.json(
          { error: "Failed to delete folder images" },
          { status: 500 }
        );
      }
    }

    // Delete the folder
    const { error: folderDeleteError } = await supabase
      .from("folders")
      .delete()
      .eq("id", folderId)
      .eq("user_id", user.id);

    if (folderDeleteError) {
      console.error("Error deleting folder:", folderDeleteError);
      return NextResponse.json(
        { error: "Failed to delete folder" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Folder deletion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
