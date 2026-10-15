import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Keeps Supabase session cookies fresh and consistent between server + client.
 * Also disables caching for authenticated dashboard routes to prevent
 * "must hard refresh" or stale user state issues.
 */
export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("⚠️ Middleware: Missing Supabase env vars");
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // Set on request cookies for immediate use
          request.cookies.set(name, value);
          // Set on response cookies for browser
          response.cookies.set(name, value, {
            ...options,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            httpOnly: false, // Allow client-side access for auth tokens
            path: '/',
          });
        });
      },
    },
  });

  // ✅ Refresh session if expired (essential for SSR)
  await supabase.auth.getUser();

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ⚙️ Skip Stripe webhooks and public assets
  if (pathname.startsWith("/api/stripe/webhook")) {
    return NextResponse.next();
  }

  // 🔑 OAuth safety net: if Supabase sends the login code to any page other
  // than /auth/callback (e.g. it falls back to the Site URL because the
  // redirect URL isn't allow-listed), forward it to the callback on the SAME
  // host so the PKCE verifier cookie is present and the session gets created.
  const authCode = request.nextUrl.searchParams.get("code");
  if (
    authCode &&
    // Supabase PKCE auth codes are UUIDs - leave any other ?code= alone
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authCode) &&
    !pathname.startsWith("/auth/") &&
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/reset-password")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    url.search = "";
    url.searchParams.set("code", authCode);
    url.searchParams.set("next", pathname === "/" ? "/dashboard" : pathname);
    return NextResponse.redirect(url);
  }

  // ✅ Always refresh Supabase session
  const response = await updateSession(request);

  // 🚫 Disable caching for dashboard pages to avoid hydration mismatches
  if (pathname.startsWith("/dashboard")) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    response.headers.set("Surrogate-Control", "no-store");
  }

  return response;
}

// ✅ Applies middleware to all routes except static assets & images
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
