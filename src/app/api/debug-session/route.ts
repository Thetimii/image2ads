import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    // 🧩 Extract cookies from the incoming request
    const cookieHeader = request.headers.get('cookie') || ''
    const cookies = cookieHeader.split(';').map((pair) => {
      const [name, ...rest] = pair.trim().split('=')
      return { name, value: rest.join('=') }
    })

    // 🧠 Create Supabase client with those cookies
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () => cookies,
        setAll: () => {},
      },
    })

    // 🔍 Try to get user from session
    const { data, error } = await supabase.auth.getUser()

    return NextResponse.json({
      success: !error && !!data?.user,
      cookiesDetected: cookies.map((c) => c.name),
      user: data?.user || null,
      error: error ? error.message : null,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      message: (err as Error).message,
    })
  }
}