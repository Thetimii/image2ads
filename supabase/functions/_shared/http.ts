const ALLOWED_ORIGINS = new Set([
  "https://image2ad.com",
  "https://www.image2ad.com",
  "http://localhost:3000",
  "http://localhost:5173",
]);

export function corsHeaders(req: Request, methods = "GET, POST, OPTIONS"): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://image2ad.com",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers":
      req.headers.get("access-control-request-headers") || "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Structured single-line logs - searchable in Supabase's log explorer. */
export function log(fn: string, event: string, fields: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ fn, event, ...fields }));
}

export function logError(fn: string, event: string, err: unknown, fields: Record<string, unknown> = {}): void {
  console.error(JSON.stringify({ fn, event, error: err instanceof Error ? err.message : String(err), ...fields }));
}
