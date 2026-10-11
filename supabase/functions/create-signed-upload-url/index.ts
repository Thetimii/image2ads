import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getRequestUser } from "../_shared/auth.ts"

// Deno global declarations
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

serve(async (req: Request) => {
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

    const { folderId, fileName, contentType } = await req.json()

    if (!folderId || !fileName) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // The owner comes from the verified session token, never from the request
    // body - otherwise any caller could mint an upload URL into someone else's
    // storage prefix.
    const user = await getRequestUser(req)
    if (!user) {
      return new Response(JSON.stringify({ error: "Missing or invalid session token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const { data: folder } = await supabase
      .from("folders")
      .select("id")
      .eq("id", folderId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!folder) {
      return new Response(JSON.stringify({ error: "Folder not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const filePath = `${user.id}/${folderId}/${fileName}`

    // Create signed upload URL
    const { data, error } = await supabase.storage
      .from("uploads")
      .createSignedUploadUrl(filePath)

    if (error) {
      console.error("Failed to create signed URL:", error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(JSON.stringify({
      url: data.signedUrl,
      path: filePath,
      method: "PUT",
      headers: {
        "content-type": contentType || "application/octet-stream"
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("Create signed URL error:", err)
    return new Response(
      JSON.stringify({ error: "Internal server error", details: err?.message ?? String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})