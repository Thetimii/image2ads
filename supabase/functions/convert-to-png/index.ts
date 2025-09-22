import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // you can restrict later
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function inferExtFromContentType(ct?: string | null) {
  if (!ct) return null
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "image/gif": "gif",
  }
  return map[ct.toLowerCase()] ?? null
}

function extFromName(name?: string | null) {
  if (!name) return null
  const idx = name.lastIndexOf(".")
  if (idx === -1) return null
  return name.slice(idx + 1).toLowerCase()
}

async function readBodyAny(req: Request): Promise<{
  bytes: Uint8Array
  contentType?: string
  originalName?: string
  userId?: string
  folderId?: string
}> {
  const contentType = req.headers.get("content-type") || ""

  // 1) multipart/form-data (best if you want filename)
  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData()
    const file = form.get("file")
    const userId = form.get("userId")?.toString()
    const folderId = form.get("folderId")?.toString()
    const originalName = form.get("originalName")?.toString() || (file as File | null)?.name

    if (!(file instanceof File)) throw new Error("Expected form field 'file'")

    const buf = new Uint8Array(await file.arrayBuffer())
    return {
      bytes: buf,
      contentType: file.type || req.headers.get("content-type") || "application/octet-stream",
      originalName,
      userId,
      folderId,
    }
  }

  // 2) raw binary (application/octet-stream or image/*)
  if (
    contentType.startsWith("application/octet-stream") ||
    contentType.startsWith("image/")
  ) {
    const url = new URL(req.url)
    const userId = url.searchParams.get("userId") ?? undefined
    const folderId = url.searchParams.get("folderId") ?? undefined
    const originalName = url.searchParams.get("originalName") ?? undefined

    const ab = await req.arrayBuffer()
    return {
      bytes: new Uint8Array(ab),
      contentType: req.headers.get("content-type") || "application/octet-stream",
      originalName,
      userId,
      folderId,
    }
  }

  // 3) fallback: JSON { imageData: number[], originalName, userId, folderId }
  const json = await req.json().catch(() => {
    throw new Error("Unsupported content-type. Use multipart/form-data, raw binary, or JSON.")
  })
  if (!json?.imageData) throw new Error("Missing imageData in JSON payload")
  const bytes = new Uint8Array(json.imageData)
  return {
    bytes,
    contentType: json.contentType || "application/octet-stream",
    originalName: json.originalName,
    userId: json.userId,
    folderId: json.folderId,
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    const { bytes, contentType, originalName, userId, folderId } = await readBodyAny(req)

    if (!userId || !folderId) {
      return new Response(JSON.stringify({ error: "Missing userId or folderId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // figure out filename + extension
    const ts = Date.now()
    const rand = Math.random().toString(36).slice(2)
    const extFromCT = inferExtFromContentType(contentType)
    const extFromFN = extFromName(originalName)
    const ext = extFromFN || extFromCT || "bin"
    const fileName = `${ts}-${rand}.${ext}`
    const filePath = `${userId}/${folderId}/${fileName}`

    // upload exactly as-is
    const { error } = await supabase.storage.from("uploads").upload(filePath, bytes, {
      contentType: contentType || "application/octet-stream",
      upsert: true,
      // cacheControl: "3600", // optional
    })
    if (error) {
      return new Response(JSON.stringify({ error: "Failed to upload", details: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        fileName,
        filePath,
        fileSize: bytes.length,
        originalName: originalName ?? null,
        contentType: contentType ?? null,
        note: "Uploaded without conversion.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err: any) {
    console.error("Upload-as-is error:", err)
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
