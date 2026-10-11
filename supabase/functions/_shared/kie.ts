/**
 * kie.ai client - unified Market API only.
 *
 * Every model we use (Nano Banana 2.1 / Pro, Veo 3.1, Suno) now goes through
 *   POST /api/v1/jobs/createTask   { model, callBackUrl, input }
 *   GET  /api/v1/jobs/recordInfo?taskId=...
 * The old per-family endpoints (/api/v1/veo/generate, /api/v1/generate for
 * Suno, ...) are kie.ai "old model" docs and are no longer used here.
 *
 * kie.ai returns HTTP 200 for most errors - the real status is in body.code.
 */

const KIE_BASE = "https://api.kie.ai";
const CREATE_TIMEOUT_MS = 20_000;
const QUERY_TIMEOUT_MS = 10_000;

export type KieState = "waiting" | "queuing" | "generating" | "success" | "fail";

export interface KieTask {
  taskId: string;
  state: KieState;
  /** media URLs in priority order (best quality first) */
  resultUrls: string[];
  /** cover art for music tasks */
  coverUrls: string[];
  failCode: string | null;
  failMsg: string | null;
  /** what kie.ai actually charged us for this task, in kie credits */
  creditsConsumed: number | null;
  costTimeSec: number | null;
}

export class KieError extends Error {
  constructor(
    message: string,
    /** kie body.code or HTTP status */
    readonly code: number,
    /** safe to retry the same request */
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "KieError";
  }
}

function apiKey(): string {
  const key = Deno.env.get("KIE_API_KEY");
  if (!key) throw new KieError("KIE_API_KEY not set", 500, false);
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** body.code values that mean "request not processed, try again later". */
const RETRYABLE_CODES = new Set([429, 455, 500, 503, 505]);

async function kieFetch(path: string, init: RequestInit, timeoutMs: number): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${KIE_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Timeouts are NOT retryable for createTask: the request may have been
    // accepted (and billed) before we stopped waiting. Connection failures
    // (TypeError) never reached kie.ai, so they are.
    const timedOut = err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError");
    throw new KieError(`kie.ai ${timedOut ? "timeout" : "network error"}: ${String(err)}`, 0, !timedOut);
  }
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new KieError(`kie.ai returned non-JSON (HTTP ${res.status}): ${text.slice(0, 200)}`, res.status, res.status >= 500 || res.status === 429);
  }
  const code = typeof body.code === "number" ? body.code : res.status;
  if (!res.ok || code !== 200) {
    const msg = typeof body.msg === "string" ? body.msg : `HTTP ${res.status}`;
    throw new KieError(`kie.ai error ${code}: ${msg}`, code, RETRYABLE_CODES.has(code) || res.status >= 500 || res.status === 429);
  }
  return body;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (!(err instanceof KieError) || !err.retryable || i === attempts - 1) throw err;
      await sleep(500 * 2 ** i + Math.random() * 250);
    }
  }
  throw last;
}

export async function createTask(model: string, input: Record<string, unknown>, callBackUrl?: string): Promise<string> {
  const payload: Record<string, unknown> = { model, input };
  if (callBackUrl) payload.callBackUrl = callBackUrl;
  const body = await withRetry(() =>
    kieFetch("/api/v1/jobs/createTask", { method: "POST", body: JSON.stringify(payload) }, CREATE_TIMEOUT_MS)
  );
  const data = body.data as Record<string, unknown> | null | undefined;
  const taskId = data && typeof data.taskId === "string" ? data.taskId : null;
  if (!taskId) throw new KieError(`kie.ai createTask returned no taskId: ${JSON.stringify(body).slice(0, 300)}`, 500, false);
  return taskId;
}

export async function getTask(taskId: string): Promise<KieTask> {
  const body = await withRetry(() =>
    kieFetch(`/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`, { method: "GET" }, QUERY_TIMEOUT_MS)
  );
  return parseRecord(taskId, (body.data ?? {}) as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Parsing - pure, unit tested in kie_test.ts
// ---------------------------------------------------------------------------

function parseMaybeJson(v: unknown): unknown {
  if (typeof v !== "string") return v;
  const t = v.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function strings(v: unknown): string[] {
  if (typeof v === "string" && /^https?:\/\//.test(v)) return [v];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && /^https?:\/\//.test(x));
  return [];
}

export function normalizeState(raw: unknown): KieState {
  const s = String(raw ?? "").toLowerCase();
  if (s === "success" || s === "completed" || s === "complete") return "success";
  if (s === "fail" || s === "failed" || s === "error" || s.endsWith("_failed") || s.includes("sensitive") || s.includes("exception")) return "fail";
  if (s === "generating" || s === "processing" || s.endsWith("_success")) return "generating"; // suno TEXT_SUCCESS / FIRST_SUCCESS
  if (s === "queuing" || s === "queue") return "queuing";
  return "waiting";
}

/** Extracts media + cover URLs from any of kie.ai's result shapes. */
export function extractUrls(record: Record<string, unknown>): { media: string[]; covers: string[] } {
  const media: string[] = [];
  const covers: string[] = [];
  const candidates = [parseMaybeJson(record.resultJson), parseMaybeJson(record.response), record.info];

  for (const c of candidates) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    // Veo 1080p/4k: the upscaled file is in data.result_urls, 720p original in data.origin_urls
    const nested = (o.data && typeof o.data === "object" && !Array.isArray(o.data)) ? o.data as Record<string, unknown> : null;
    if (nested) media.push(...strings(nested.result_urls), ...strings(nested.resultUrls));
    media.push(...strings(o.resultUrls), ...strings(o.result_urls), ...strings(o.videoUrls));
    // Suno: tracks in data[] (or sunoData[] on legacy payloads)
    const tracks = Array.isArray(o.data) ? o.data : Array.isArray(o.sunoData) ? o.sunoData : [];
    for (const t of tracks) {
      if (!t || typeof t !== "object") continue;
      const tr = t as Record<string, unknown>;
      media.push(...strings(tr.audio_url ?? tr.audioUrl));
      covers.push(...strings(tr.image_url ?? tr.imageUrl));
    }
    if (nested) media.push(...strings(nested.origin_urls));
    media.push(...strings(o.originUrls), ...strings(o.origin_urls));
  }
  return { media: [...new Set(media)], covers: [...new Set(covers)] };
}

export function parseRecord(taskId: string, d: Record<string, unknown>): KieTask {
  const { media, covers } = extractUrls(d);
  let state = normalizeState(d.state ?? d.status);
  // Veo legacy flag: successFlag 1 = success, 2/3 = failure.
  if (d.successFlag === 1) state = "success";
  else if (d.successFlag === 2 || d.successFlag === 3) state = "fail";
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : null);
  return {
    taskId,
    state,
    resultUrls: media,
    coverUrls: covers,
    failCode: str(d.failCode ?? d.errorCode),
    failMsg: str(d.failMsg ?? d.errorMessage),
    creditsConsumed: num(d.creditsConsumed),
    costTimeSec: num(d.costTime),
  };
}
