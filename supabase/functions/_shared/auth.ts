import { createClient } from "npm:@supabase/supabase-js@2.57.4";

// Why auth lives here instead of in the platform's verify_jwt check:
//
// Supabase's built-in verify_jwt check only understands the project's legacy
// HS256 API keys, and it stopped accepting ours - every call carrying the anon
// or service_role key now dies at the gateway with UNAUTHORIZED_LEGACY_JWT
// before any function code runs. Per Supabase's own 401 troubleshooting guide
// the fix for that is to turn the built-in check off and authorize in the
// function instead, which is what these helpers do.
//
// Two kinds of caller are allowed:
//   - a signed-in user, presenting their Supabase session token as
//     `Authorization: Bearer <jwt>` (verified against GoTrue below)
//   - one of our own backends - a Next.js route handler or cron job - which has
//     no user session and presents `x-internal-secret` instead.
//
// Every function that uses these MUST be deployed with --no-verify-jwt (see
// supabase/config.toml), otherwise the gateway rejects the request first.

const authClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

// Constant-time compare so a wrong secret can't be recovered byte by byte.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * True when the caller is one of our own backends presenting
 * INTERNAL_FUNCTION_SECRET. Returns false if the secret isn't configured, so a
 * missing env var fails closed rather than opening the function to everyone.
 */
export function isInternalCall(req: Request): boolean {
  const secret = Deno.env.get("INTERNAL_FUNCTION_SECRET");
  if (!secret) return false;
  const presented = req.headers.get("x-internal-secret");
  return !!presented && safeEqual(presented, secret);
}

/** Resolves the signed-in user from the Authorization header, or null. */
export async function getRequestUser(req: Request): Promise<{ id: string } | null> {
  const token = bearerToken(req);
  if (!token) return null;
  try {
    const { data, error } = await authClient.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user as { id: string };
  } catch (err) {
    console.error("[auth] getUser failed:", err);
    return null;
  }
}

export type AuthResult = { ok: true } | { ok: false; status: number; message: string };

/**
 * Authorizes a request against a specific job: internal callers pass, everyone
 * else must be the signed-in owner of that job.
 */
export async function authorizeJob(req: Request, jobUserId: string): Promise<AuthResult> {
  if (isInternalCall(req)) return { ok: true };

  const user = await getRequestUser(req);
  if (!user) {
    return { ok: false, status: 401, message: "Missing or invalid session token" };
  }
  if (user.id !== jobUserId) {
    console.warn(`[auth] user ${user.id} tried to act on a job owned by ${jobUserId}`);
    return { ok: false, status: 403, message: "This job belongs to another user" };
  }
  return { ok: true };
}

/** Authorizes a request that only our own backends are allowed to make. */
export function authorizeInternal(req: Request): AuthResult {
  if (isInternalCall(req)) return { ok: true };
  return { ok: false, status: 401, message: "Internal endpoint" };
}
