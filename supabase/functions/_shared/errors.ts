/**
 * Failure classification shared by every generation path. Keeps refund,
 * friendly-message and retry decisions consistent.
 */

export type FailureCategory =
  | "safety_filter"
  | "timeout"
  | "insufficient_credits"
  | "provider_unavailable"
  | "invalid_input"
  | "unknown";

const SAFETY_PATTERNS = [
  /prohibited use policy/i,
  /violat(ed|es|ing).{0,40}polic/i,
  /content polic/i,
  /safety (system|filter|check)/i,
  /content_policy_violation/i,
  /blocked.{0,20}(safety|policy|content)/i,
  /no images found in ai response/i,
  /flagged/i,
  /sensitive/i,
  /unsafe image/i,
  /nsfw/i,
  /\bSAFETY\b|\bRECITATION\b|PROHIBITED_CONTENT|BLOCKED_REASON/,
];

export function classifyFailure(message: string | null | undefined, code?: string | number | null): FailureCategory {
  const m = message ?? "";
  if (SAFETY_PATTERNS.some((re) => re.test(m))) return "safety_filter";
  if (/timeout|timed out|stuck in|took too long/i.test(m) || String(code) === "408") return "timeout";
  if (/insufficient credits|\b402\b/i.test(m)) return "insufficient_credits";
  if (/failed to fetch image|image.{0,20}(download|access)|invalid (image|url)|unsupported (format|image)|\b422\b/i.test(m) || String(code) === "422") return "invalid_input";
  if (/maintenance|unavailable|rate limit|\b429\b|\b455\b|\b50[0-5]\b/i.test(m) || ["429", "455", "500", "501", "503", "505"].includes(String(code ?? ""))) return "provider_unavailable";
  return "unknown";
}

export function friendlyMessage(category: FailureCategory): string {
  switch (category) {
    case "safety_filter":
      return "The AI's content filter blocked this one — try a different photo or a simpler description. No credits were used.";
    case "timeout":
      return "This took longer than expected and was cancelled. No credits were used — please try again.";
    case "invalid_input":
      return "We couldn't read your reference image. Try a JPG or PNG under 10 MB. No credits were used.";
    case "provider_unavailable":
      return "The AI service is busy right now. No credits were used — please try again in a minute.";
    case "insufficient_credits":
      return "You don't have enough credits for this generation.";
    default:
      return "Generation failed — no credits were used. Please try again.";
  }
}

/** Best-effort prompt softening for a single retry after a safety rejection. */
export function sanitizePromptForRetry(prompt: string): string {
  return (
    (prompt || "")
      .replace(/\b(best|sexiest|hottest|cheapest|ultimate|most\s+\w+)\b/gi, "")
      // rough brand / proper-noun strip: capitalised 2+ word runs mid-sentence
      .replace(/(?<=\s)([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim() +
    ", professional commercial product photography, no text, no logos, no people"
  );
}
