// Calling Supabase Edge Functions from our own backend.
//
// These functions run with the platform's verify_jwt check disabled - it only
// understands the project's legacy HS256 API keys and now rejects them with
// UNAUTHORIZED_LEGACY_JWT before any function code runs. Auth happens inside
// the functions instead (see supabase/functions/_shared/auth.ts).
//
// Browser callers prove who they are with the user's session token. Server
// callers have no session, so they present INTERNAL_FUNCTION_SECRET, which must
// be set to the same value here and in the Supabase function secrets.

export function edgeFunctionUrl(name: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${name}`
}

/**
 * Headers that identify the caller as one of our own backends. Returns null
 * (rather than throwing) when the secret isn't configured, so best-effort
 * callers can log and carry on instead of failing the user's request.
 */
export function internalFunctionHeaders(): Record<string, string> | null {
  const secret = process.env.INTERNAL_FUNCTION_SECRET
  if (!secret) {
    console.error('[edge-functions] INTERNAL_FUNCTION_SECRET is not set - edge function call will be rejected')
    return null
  }
  return {
    'Content-Type': 'application/json',
    'x-internal-secret': secret,
  }
}
