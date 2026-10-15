/**
 * Single source of truth for WHAT we generate, WHICH kie.ai model does it,
 * what WE charge (our credits) and what IT COSTS US (kie.ai credits).
 *
 * Every edge function prices and builds provider requests from this file -
 * there are no other copies of model names or credit amounts in the backend.
 * The frontend mirrors the user-facing prices in src/lib/pricing.ts; keep the
 * two in sync (scripts/margins.ts prints both side by side).
 *
 * kie.ai prices verified against https://kie.ai/pricing (model-pricing API)
 * on 2026-10-11. 1 kie.ai credit = $0.005.
 */

export const KIE_USD_PER_CREDIT = 0.005;

/**
 * What one of OUR credits is worth in net revenue, after Stripe fees
 * (2.9% + $0.30) on the Pro ($19.99 / 200 credits) and Business
 * ($49.99 / 500 credits) plans: (19.99 * 0.971 - 0.30) / 200 = $0.0955.
 * Starter ($9.99 / 70) nets $0.134/credit; 20%-off coupons drop Pro to $0.076.
 * We use the Pro figure as the planning number - it is the most common plan.
 */
export const NET_REVENUE_USD_PER_CREDIT = 0.0955;
// Pricing v2 (Oct 2026): Pro is $39 / 300 credits (0.1253/credit net) and
// yearly Pro $299 / 3600 (0.0802/credit net). 0.0955 stays the planning
// number - it sits between the two.

/** Free plan: new accounts get this many credits ONCE (pricing v2, Oct
 * 2026 - it used to refill daily). 1 standard image = 1 credit. The real
 * value lives in SQL, public.free_daily_credits(); this copy is for
 * messages and the margin report only. */
export const FREE_DAILY_CREDITS = 3;

export type ResultType = "image" | "video" | "music";
export type ImageModelId = "nano-banana" | "nano-banana-pro";
export type ImageResolution = "1K" | "2K" | "4K";
export type AspectRatio = "square" | "portrait" | "landscape";

export interface Tier {
  /** paying subscriber (active / trialing) */
  paid: boolean;
}

export interface GenerationSpec {
  resultType: ResultType;
  /** our product id, stored on jobs.product_model */
  productModel: string;
  /** kie.ai `model` field for POST /api/v1/jobs/createTask */
  kieModel: string;
  /** kie.ai `input` object */
  input: Record<string, unknown>;
  /** credits we deduct from the user (always > 0) */
  chargeCredits: number;
  /** "subscription" = paying subscriber (credits are revenue);
   * "free_plan" = everyone else (daily free credits, leftovers) */
  billingTier: "subscription" | "free_plan";
  /** what kie.ai bills us, in kie credits (estimate; the real figure comes
   * back as creditsConsumed and is stored per job) */
  expectedKieCredits: number;
}

export interface JobLike {
  prompt?: string | null;
  result_type?: string | null;
  has_images?: boolean | null;
  aspect_ratio?: string | null;
  music_options?: Record<string, unknown> | null;
}

export interface GenerateOptions {
  model?: string | null;
  resolution?: string | null;
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

/** kie.ai credits per call, from kie.ai/pricing. */
export const KIE_PRICES = {
  "nano-banana-2-1": { "1K": 4, "2K": 6, "4K": 9 },
  "nano-banana-pro": { "1K": 18, "2K": 18, "4K": 24 },
  "veo3_fast-720p-8s": 60,
  "suno-generate": 12,
} as const;

/** Our credit prices - the same for everyone. */
export const OUR_PRICES = {
  image: { standard: 1, pro: 6 },
  video: 8,
  music: 3,
} as const;

/** Standard model output size: free plan 1K (cheapest), subscribers 2K (HD). */
export const STANDARD_RESOLUTION: Record<"free" | "paid", ImageResolution> = {
  free: "1K",
  paid: "2K",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function imageAspect(aspect: string | null | undefined): string {
  if (aspect === "portrait") return "9:16";
  if (aspect === "landscape") return "16:9";
  return "1:1";
}

export function videoAspect(aspect: string | null | undefined): "9:16" | "16:9" {
  return aspect === "portrait" ? "9:16" : "16:9";
}

function normalizeResolution(r: string | null | undefined): ImageResolution {
  return r === "1K" || r === "4K" ? r : "2K";
}

function cleanPrompt(p: string | null | undefined, fallback: string): string {
  const t = (p ?? "").trim();
  return t.length > 0 ? t.slice(0, 20000) : fallback;
}

export function resultTypeOf(job: JobLike): ResultType {
  if (job.result_type === "video") return "video";
  if (job.result_type === "music") return "music";
  return "image";
}

// ---------------------------------------------------------------------------
// Spec builder
// ---------------------------------------------------------------------------

/**
 * Turns a job row + the client's model choice into a fully priced provider
 * request. `imageUrls` are already-signed URLs of the job's reference images.
 * Throws on invalid combinations (caller maps to a 400).
 */
export function buildSpec(
  job: JobLike,
  opts: GenerateOptions,
  tier: Tier,
  imageUrls: string[],
): GenerationSpec {
  const resultType = resultTypeOf(job);
  const billingTier = tier.paid ? "subscription" as const : "free_plan" as const;

  if (resultType === "image") {
    const pro = opts.model === "nano-banana-pro";
    const prompt = cleanPrompt(job.prompt, imageUrls.length ? "Transform this image into a polished product ad" : "A polished product advertisement photo");
    if (pro) {
      const resolution = normalizeResolution(opts.resolution);
      return {
        resultType,
        productModel: "nano-banana-pro",
        kieModel: "nano-banana-pro",
        input: {
          prompt,
          image_input: imageUrls.slice(0, 8),
          aspect_ratio: imageAspect(job.aspect_ratio),
          resolution,
          output_format: "png",
        },
        chargeCredits: OUR_PRICES.image.pro,
        billingTier,
        expectedKieCredits: KIE_PRICES["nano-banana-pro"][resolution],
      };
    }
    const resolution = STANDARD_RESOLUTION[tier.paid ? "paid" : "free"];
    return {
      resultType,
      productModel: "nano-banana",
      kieModel: "nano-banana-2-1",
      input: {
        prompt,
        image_input: imageUrls.slice(0, 10),
        aspect_ratio: imageAspect(job.aspect_ratio),
        resolution,
        output_format: "png",
      },
      chargeCredits: OUR_PRICES.image.standard,
      billingTier,
      expectedKieCredits: KIE_PRICES["nano-banana-2-1"][resolution],
    };
  }

  if (resultType === "video") {
    const input: Record<string, unknown> = {
      prompt: cleanPrompt(job.prompt, imageUrls.length ? "Animate this image with subtle, cinematic motion" : "A cinematic product shot"),
      model: "veo3_fast",
      generation_type: imageUrls.length ? "FIRST_AND_LAST_FRAMES_2_VIDEO" : "TEXT_2_VIDEO",
      aspect_ratio: videoAspect(job.aspect_ratio),
      resolution: "720p",
      duration: 8,
      enable_translation: true,
    };
    if (imageUrls.length) input.image_urls = imageUrls.slice(0, 1);
    return {
      resultType,
      productModel: "veo-3.1-fast",
      kieModel: "veo-3-1",
      input,
      chargeCredits: OUR_PRICES.video,
      billingTier,
      expectedKieCredits: KIE_PRICES["veo3_fast-720p-8s"],
    };
  }

  // music (Suno V6 via the unified Market API)
  const mo = (job.music_options ?? {}) as Record<string, unknown>;
  const instrumental = mo.make_instrumental === true;
  const customLyrics = typeof mo.custom_lyrics === "string" ? mo.custom_lyrics.trim() : "";
  const description = cleanPrompt(job.prompt, "An upbeat, catchy track for a product ad");
  const duration = typeof mo.duration === "number" ? Math.min(360, Math.max(10, Math.round(mo.duration))) : undefined;

  let input: Record<string, unknown>;
  if (customLyrics && !instrumental) {
    // Custom mode: the user's text is sung word for word. `style` steers the
    // sound; title is required in custom mode (max 80 chars).
    input = {
      model: "V6",
      custom_mode: true,
      instrumental: false,
      lyrics: customLyrics.slice(0, 5000),
      style: typeof mo.style === "string" && mo.style.trim() ? mo.style.trim().slice(0, 1000) : "catchy, modern, commercial",
      title: deriveTitle(description),
    };
    if (duration) input.duration = duration;
  } else {
    // Simple mode: the prompt is the idea, Suno writes lyrics itself. Simple
    // mode rejects requests without at least one of style/lyrics/media, so
    // the description doubles as the style hint.
    input = {
      model: "V6",
      custom_mode: false,
      instrumental,
      prompt: description.slice(0, 3000),
      style: description.slice(0, 1000),
    };
  }
  return {
    resultType: "music",
    productModel: "suno-v6",
    kieModel: "ai-music-api/generate",
    input,
    chargeCredits: OUR_PRICES.music,
    billingTier,
    expectedKieCredits: KIE_PRICES["suno-generate"],
  };
}

function deriveTitle(text: string): string {
  const firstLine = text.split(/\r?\n/)[0].replace(/[[\]]/g, "").trim();
  const t = firstLine.length ? firstLine : "Untitled";
  return t.length > 80 ? `${t.slice(0, 77)}...` : t;
}

// ---------------------------------------------------------------------------
// Margins
// ---------------------------------------------------------------------------

export function kieCreditsToUsd(credits: number): number {
  return Math.round(credits * KIE_USD_PER_CREDIT * 10000) / 10000;
}

export interface MarginRow {
  product: string;
  tier: "paid" | "free";
  ourCredits: number;
  revenueUsd: number;
  costUsd: number;
  marginUsd: number;
  marginPct: number | null;
}

/** Unit economics per product, used by scripts/margins.ts and the docs. */
export function marginTable(): MarginRow[] {
  const row = (product: string, tier: "paid" | "free", ourCredits: number, kieCredits: number, revenuePerCredit: number): MarginRow => {
    const revenueUsd = round4(ourCredits * revenuePerCredit);
    const costUsd = kieCreditsToUsd(kieCredits);
    const marginUsd = round4(revenueUsd - costUsd);
    return { product, tier, ourCredits, revenueUsd, costUsd, marginUsd, marginPct: revenueUsd > 0 ? Math.round((marginUsd / revenueUsd) * 1000) / 10 : null };
  };
  const r = NET_REVENUE_USD_PER_CREDIT;
  return [
    row("Image · Nano Banana 2.1 · 2K", "paid", OUR_PRICES.image.standard, KIE_PRICES["nano-banana-2-1"]["2K"], r),
    row("Image · Nano Banana 2.1 · 1K (free daily credit)", "free", OUR_PRICES.image.standard, KIE_PRICES["nano-banana-2-1"]["1K"], 0),
    row("Image · Nano Banana Pro · 1K/2K", "paid", OUR_PRICES.image.pro, KIE_PRICES["nano-banana-pro"]["2K"], r),
    row("Image · Nano Banana Pro · 4K", "paid", OUR_PRICES.image.pro, KIE_PRICES["nano-banana-pro"]["4K"], r),
    row("Video · Veo 3.1 Fast · 720p · 8s", "paid", OUR_PRICES.video, KIE_PRICES["veo3_fast-720p-8s"], r),
    row("Music · Suno V6 (2 tracks)", "paid", OUR_PRICES.music, KIE_PRICES["suno-generate"], r),
  ];
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
