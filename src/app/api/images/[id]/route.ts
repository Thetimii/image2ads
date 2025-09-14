import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const imageId = params.id;

    // Get image details and verify ownership
    const { data: image, error: imageError } = await supabase
      .from("images")
      .select("id, file_path, folder_id, folders!inner(user_id)")
      .eq("id", imageId)
      .single();

    if (imageError || !image) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    // Verify ownership through folder
    const folder = Array.isArray(image.folders)
      ? image.folders[0]
      : image.folders;
    if (folder.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("uploads")
      .remove([image.file_path]);

    if (storageError) {
      console.error("Error deleting from storage:", storageError);
      // Continue anyway - maybe file was already deleted
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("images")
      .delete()
      .eq("id", imageId);

    if (dbError) {
      console.error("Error deleting from database:", dbError);
      return NextResponse.json(
        { error: "Failed to delete image" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in image deletion:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
