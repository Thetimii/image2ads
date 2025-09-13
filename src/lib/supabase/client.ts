import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log("Supabase client initialization debug:", {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : "MISSING",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : "MISSING",
    env_keys: Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC_')),
    typeof_process_env: typeof process.env,
  });

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ CRITICAL: Missing Supabase environment variables:", {
      NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey,
      all_env_keys: Object.keys(process.env).sort(),
    });
    throw new Error("Missing required Supabase environment variables");
  }

  try {
    const client = createBrowserClient(supabaseUrl, supabaseAnonKey);
    console.log("✅ Supabase client created successfully");
    return client;
  } catch (error) {
    console.error("❌ Failed to create Supabase client:", error);
    throw error;
  }
}
