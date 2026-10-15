import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// Only allow same-site relative paths as the post-login destination.
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return "/dashboard";
  }
  return raw;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  // Stay on the host the user is on (www vs apex). The PKCE verifier and the
  // new session cookies are host-only, so bouncing between hosts loses them.
  const baseUrl = request.nextUrl.origin;

  const providerError = searchParams.get("error_description") || searchParams.get("error");
  if (providerError) {
    console.error("[auth/callback] provider error:", providerError);
    return NextResponse.redirect(
      `${baseUrl}/signin?error=${encodeURIComponent(providerError)}`
    );
  }

  const supabase = await createClient();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // New user (created in the last minute) -> signup tracking page
      const createdMs = new Date(data.user.created_at).getTime();
      const isNewUser = Date.now() - createdMs < 60000;
      return NextResponse.redirect(
        isNewUser ? `${baseUrl}/auth/signup-success` : `${baseUrl}${next}`
      );
    }
    console.error("[auth/callback] code exchange failed:", error?.message);
  }

  // The code may already have been used (double redirect / refresh) while the
  // session was still created - if so, just continue.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${baseUrl}${next}`);
  }

  return NextResponse.redirect(
    `${baseUrl}/signin?error=${encodeURIComponent(
      "Google sign-in didn't complete. Please try again."
    )}`
  );
}
