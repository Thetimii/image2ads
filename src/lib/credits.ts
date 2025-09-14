export type Quality = "low" | "medium" | "high";
export type Size = "1024x1024" | "1024x1536" | "1536x1024";

export function billableCredits(
  model: string,
  quality: Quality = "medium",
  size: Size = "1024x1024",
  n: number = 1
): number {
  // For OpenAI models, use the quality and size
  if (model.startsWith("openai-")) {
    const tallOrWide = size === "1024x1536" || size === "1536x1024";
    let per = 0;
    if (quality === "low") per = 0.5;
    else if (quality === "medium") per = 1;
    else per = 7; // high - simplified to 7 for all sizes
    return per * n;
  }

  // For other models (gemini, seedream), use default 1 credit
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
