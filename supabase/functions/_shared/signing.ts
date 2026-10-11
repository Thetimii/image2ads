/**
 * Callback authentication.
 *
 * Two independent ways a kie.ai callback can prove it is genuine:
 *
 * 1. kie.ai's own HMAC (recommended): enable "Webhook HMAC" at
 *    https://kie.ai/settings and set KIE_WEBHOOK_HMAC_KEY. kie.ai then sends
 *      X-Webhook-Timestamp: <unix seconds>
 *      X-Webhook-Signature: base64(HMAC-SHA256(`${taskId}.${timestamp}`, key))
 *
 * 2. Our own per-job token baked into the callBackUrl we hand kie.ai:
 *      ...?job=<jobId>&sig=<base64url HMAC-SHA256(jobId, INTERNAL_FUNCTION_SECRET)>
 *    This works with zero kie.ai configuration.
 *
 * Neither covers the body, and that's fine: the callback is only used as a
 * "check now" trigger - the result is always re-read from kie.ai's API.
 */

const enc = new TextEncoder();

async function hmac(key: string, message: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}

function b64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64url(bytes: Uint8Array): string {
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Signature kie.ai sends in X-Webhook-Signature. */
export async function kieSignature(taskId: string, timestamp: string, key: string): Promise<string> {
  return b64(await hmac(key, `${taskId}.${timestamp}`));
}

/** Max clock skew / replay window for kie.ai-signed callbacks. kie.ai retries
 * failed deliveries, so this is deliberately generous. */
export const KIE_SIGNATURE_MAX_AGE_SEC = 60 * 60;

export async function verifyKieSignature(
  taskId: string,
  timestamp: string | null,
  signature: string | null,
  key: string,
  nowSec = Math.floor(Date.now() / 1000),
): Promise<boolean> {
  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSec - Number(timestamp)) > KIE_SIGNATURE_MAX_AGE_SEC) return false;
  return timingSafeEqual(await kieSignature(taskId, timestamp, key), signature);
}

/** Token for our own callback URL. */
export async function jobCallbackToken(jobId: string, secret: string): Promise<string> {
  return b64url(await hmac(secret, `kie-callback:${jobId}`));
}

export async function verifyJobCallbackToken(jobId: string | null, token: string | null, secret: string): Promise<boolean> {
  if (!jobId || !token || !secret) return false;
  return timingSafeEqual(await jobCallbackToken(jobId, secret), token);
}
