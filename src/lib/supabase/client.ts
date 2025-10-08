import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ CRITICAL: Missing Supabase environment variables:", {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey,
      all_env_keys: Object.keys(process.env).sort(),
    });
    throw new Error("Missing required Supabase environment variables");
  }

  try {
    const client = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          // Check if we're in a browser environment
          if (typeof document === 'undefined') {
            return [];
          }
          
          return document.cookie
            .split(';')
            .map(cookie => cookie.trim().split('='))
            .filter(([name]) => name)
            .map(([name, ...values]) => ({
              name,
              value: values.join('=') || ''
            }));
        },
        setAll(cookiesToSet) {
          // Check if we're in a browser environment
          if (typeof document === 'undefined') {
            return;
          }
          
          cookiesToSet.forEach(({ name, value, options = {} }) => {
            // Set production-safe cookie options
            const cookieOptions = {
              ...options,
              sameSite: 'lax' as const,
              secure: typeof window !== 'undefined' && window.location.protocol === 'https:',
              path: '/',
            };
            
            let cookieString = `${name}=${value}`;
            if (cookieOptions.maxAge) cookieString += `; Max-Age=${cookieOptions.maxAge}`;
            if (cookieOptions.expires) cookieString += `; Expires=${cookieOptions.expires.toUTCString()}`;
            if (cookieOptions.domain) cookieString += `; Domain=${cookieOptions.domain}`;
            if (cookieOptions.path) cookieString += `; Path=${cookieOptions.path}`;
            if (cookieOptions.secure) cookieString += `; Secure`;
            if (cookieOptions.sameSite) cookieString += `; SameSite=${cookieOptions.sameSite}`;
            if (cookieOptions.httpOnly) cookieString += `; HttpOnly`;
            
            document.cookie = cookieString;
          });
        },
      },
    });
    return client;
  } catch (error) {
    console.error("❌ Failed to create Supabase client:", error);
    throw error;
  }
}
