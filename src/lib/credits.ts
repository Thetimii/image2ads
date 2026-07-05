export type Quality = "low" | "medium" | "high";
export type Size = "1024x1024" | "1024x1536" | "1536x1024";

// The one place that decides how many credits an operation costs. Mirrors
// what run-job (supabase/functions/run-job) actually deducts via
// consume_credit - quality/size never affected the real charge (every live
// caller only ever sends "openai-medium-*"), so this returns the same flat
// cost run-job enforces instead of computing a number that isn't real.
export function billableCredits(
  model: string,
  _quality: Quality = "medium",
  _size: Size = "1024x1024",
  n: number = 1
): number {
  // For nano-banana, it's free!
  if (model === "nano-banana") {
    return 0;
  }

  // Every other model (openai-*, gemini, seedream) costs 1 credit per image.
  return 1 * n;
}

// Helper to extract quality and size from OpenAI model names
export function parseOpenAIModel(
  model: string
): { quality: Quality; size: Size } | null {
  if (!model.startsWith("openai-")) return null;

  const parts = model.split("-");
  if (parts.length !== 3) return null;

  const quality = parts[1] as Quality;
  const aspect = parts[2];

  let size: Size;
  if (aspect === "square") size = "1024x1024";
  else if (aspect === "landscape") size = "1536x1024";
  else if (aspect === "portrait") size = "1024x1536";
  else return null;

  return { quality, size };
}
