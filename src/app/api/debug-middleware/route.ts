import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // 🧩 Extract cookies from middleware context
    const cookieStore = request.cookies
    const cookies = cookieStore.getAll()

    // 🧠 Create Supabase client with middleware pattern
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookies
        },
        setAll(cookiesToSet) {
          // In middleware, we can't set cookies on response here
          // This is just for testing session reading
        },
      },
    })

    // 🔍 Try to get user from session in middleware context
    const { data, error } = await supabase.auth.getUser()

    return NextResponse.json({
      context: 'middleware-edge',
      success: !error && !!data?.user,
      cookiesDetected: cookies.map((c) => c.name),
      cookieValues: cookies.reduce((acc, c) => {
        // Only show Supabase auth cookies for security
        if (c.name.startsWith('sb-')) {
          acc[c.name] = c.value ? `${c.value.substring(0, 20)}...` : 'empty'
        }
        return acc
      }, {} as Record<string, string>),
      user: data?.user ? {
        id: data.user.id,
        email: data.user.email,
        created_at: data.user.created_at
      } : null,
      error: error ? error.message : null,
      userAgent: request.headers.get('user-agent')?.substring(0, 100),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
    })
  } catch (err) {
    return NextResponse.json({
      context: 'middleware-edge',
      success: false,
      error: (err as Error).message,
      stack: (err as Error).stack?.substring(0, 500)
    })
  }
}