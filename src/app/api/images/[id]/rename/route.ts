import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const bodySchema = z.object({
  newName: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[\w\- .()]+$/), // allow letters, numbers, spaces, dashes, etc.
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const parse = bodySchema.safeParse(await req.json());
    if (!parse.success) {
      return NextResponse.json(
        { error: "Invalid name", details: parse.error.issues },
        { status: 400 }
      );
    }
    const baseName = parse.data.newName.trim();

    // Load the image to get its current path and ownership
    const { data: img, error: imgErr } = await supabase
      .from("images")
      .select("id, user_id, file_path, original_name")
      .eq("id", id)
      .single();

    if (imgErr || !img || img.user_id !== user.id) {
      return NextResponse.json({ error: "Image not found" }, { status: 404 });
    }

    const bucket = "uploads"; // your bucket name
    const oldKey = img.file_path; // e.g. userId/folderId/file.png
    const lastSlash = oldKey.lastIndexOf("/");
    const folderPrefix = lastSlash >= 0 ? oldKey.slice(0, lastSlash + 1) : "";
    const ext = (oldKey.split(".").pop() || "png").toLowerCase();

    const newKey = `${folderPrefix}${baseName}.${ext}`;
    if (newKey === oldKey) return NextResponse.json({ ok: true, image: img });

    // Try to move (rename)
    const { error: moveErr } = await supabase.storage
      .from(bucket)
      .move(oldKey, newKey);
    if (moveErr) {
      // Common: 409 if file with that name already exists
      return NextResponse.json({ error: moveErr.message }, { status: 400 });
    }

    // Update DB record to point to the new key
    const { data: updated, error: updErr } = await supabase
      .from("images")
      .update({ file_path: newKey, original_name: `${baseName}.${ext}` })
      .eq("id", img.id)
      .select()
      .single();

    if (updErr) {
      // (Optional) roll back move to keep DB consistent
      await supabase.storage
        .from(bucket)
        .move(newKey, oldKey)
        .catch(() => {});
      return NextResponse.json(
        { error: "Failed to update database" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, image: updated });
  } catch (error) {
    console.error("Rename error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
