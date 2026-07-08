// deno-lint-ignore-file no-explicit-any
/**
 * Shared failure classification for generation errors, used across every
 * edge function that consumes a credit before calling an AI provider
 * (run-job, generate-image-image, generate-text-image, generate-image-video,
 * generate-text-video, check-job-status). Keeps refund + friendly-message +
 * retry logic consistent instead of duplicating regex per function.
 */

export type FailureCategory =
  | "safety_filter"
  | "timeout"
  | "insufficient_credits"
  | "unknown";

const SAFETY_PATTERNS = [
  /prohibited use policy/i,
  /violat(ed|es).{0,40}polic/i,
  /safety system/i,
  /content_policy_violation/i,
  /blocked.{0,20}(safety|policy|content)/i,
  /no images found in ai response/i,
  /flagged as (sensitive|inappropriate)/i,
  /\bSAFETY\b|\bRECITATION\b|PROHIBITED_CONTENT|BLOCKED_REASON/,
];

export function classifyFailure(message: string | null | undefined): FailureCategory {
  if (!message) return "unknown";
  if (SAFETY_PATTERNS.some((re) => re.test(message))) return "safety_filter";
  if (/timeout|timed out|stuck in/i.test(message)) return "timeout";
  if (/insufficient credits|\b402\b/i.test(message)) return "insufficient_credits";
  return "unknown";
}

// Best-effort heuristic, not a guarantee - some rejections (e.g. the source
// photo itself) won't be fixable by sanitizing the prompt alone.
export function friendlyMessage(category: FailureCategory): string {
  if (category === "safety_filter") {
    return "Google's content filter blocked this one — try a different photo or simpler description. No credit was used.";
  }
  return "Generation failed — no credit was used. Please try again.";
}

export function sanitizePromptForRetry(prompt: string): string {
  return (
    (prompt || "")
      // strip superlatives that commonly trip the filter
      .replace(/\b(best|sexiest|hottest|cheapest|ultimate|most\s+\w+)\b/gi, "")
      // rough proper-noun/brand strip: capitalized 2+ word runs mid-sentence
      .replace(/(?<=\s)([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() +
    ", professional commercial product photography, no text, no logos, no people"
  );
}
