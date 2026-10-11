// deno test supabase/functions/_shared/backend_test.ts
// Payload fixtures are copied from docs.kie.ai (Get Task Details, Nano Banana 2
// callback, Veo 3.1, Suno generate-music) as of 2026-10-11.
import { assert, assertEquals } from "jsr:@std/assert@1";
import { extractUrls, normalizeState, parseRecord } from "./kie.ts";
import { jobCallbackToken, kieSignature, verifyJobCallbackToken, verifyKieSignature } from "./signing.ts";
import { buildSpec, marginTable, OUR_PRICES } from "./catalog.ts";
import { classifyFailure } from "./errors.ts";
import { sniff } from "./pipeline.ts";

Deno.test("parseRecord: market image success", () => {
  const t = parseRecord("t1", {
    taskId: "t1", model: "nano-banana-2", state: "success",
    resultJson: '{"resultUrls":["https://tempfile.aiquickdraw.com/workers/images/a.jpg"]}',
    failCode: "", failMsg: "", costTime: 48, creditsConsumed: 8,
  });
  assertEquals(t.state, "success");
  assertEquals(t.resultUrls, ["https://tempfile.aiquickdraw.com/workers/images/a.jpg"]);
  assertEquals(t.creditsConsumed, 8);
  assertEquals(t.failCode, null);
});

Deno.test("parseRecord: failure carries code + message, 0 credits", () => {
  const t = parseRecord("t2", { state: "fail", resultJson: null, failCode: "500", failMsg: "Your prompt was flagged", creditsConsumed: 0 });
  assertEquals(t.state, "fail");
  assertEquals(t.failCode, "500");
  assertEquals(t.creditsConsumed, 0);
  assertEquals(classifyFailure(t.failMsg, t.failCode), "safety_filter");
});

Deno.test("parseRecord: pending states", () => {
  for (const s of ["waiting", "queuing", "generating"]) {
    assertEquals(parseRecord("t", { state: s }).state === "success", false);
  }
  assertEquals(normalizeState("FIRST_SUCCESS"), "generating"); // suno partial
  assertEquals(normalizeState("TEXT_SUCCESS"), "generating");
  assertEquals(normalizeState("SUCCESS"), "success");
  assertEquals(normalizeState("GENERATE_AUDIO_FAILED"), "fail");
  assertEquals(normalizeState("SENSITIVE_WORD_ERROR"), "fail");
});

Deno.test("extractUrls: veo 1080p prefers upscaled result_urls over origin_urls", () => {
  const { media } = extractUrls({
    resultJson: JSON.stringify({ data: { result_urls: ["https://x/1080.mp4"], origin_urls: ["https://x/720.mp4"] } }),
  });
  assertEquals(media[0], "https://x/1080.mp4");
  assert(media.includes("https://x/720.mp4"));
});

Deno.test("extractUrls: veo callback info shape", () => {
  const { media } = extractUrls({ info: { resultUrls: ["https://x/v.mp4"], originUrls: ["https://x/o.mp4"] } });
  assertEquals(media[0], "https://x/v.mp4");
});

Deno.test("extractUrls: suno tracks + covers (response.data[])", () => {
  const { media, covers } = extractUrls({
    response: { data: [
      { id: "1", audio_url: "https://x/1.mp3", image_url: "https://x/1.jpeg" },
      { id: "2", audio_url: "https://x/2.mp3", image_url: "https://x/2.jpeg" },
    ] },
  });
  assertEquals(media, ["https://x/1.mp3", "https://x/2.mp3"]);
  assertEquals(covers[0], "https://x/1.jpeg");
});

Deno.test("extractUrls: ignores garbage", () => {
  const { media } = extractUrls({ resultJson: "not json", response: { resultUrls: ["javascript:alert(1)", 5] } });
  assertEquals(media, []);
});

Deno.test("kie HMAC: matches the documented algorithm and rejects tampering/replays", async () => {
  // base64(HMAC-SHA256("taskId.timestamp", key)) - reference value computed with
  // node:crypto exactly as in docs.kie.ai/common-api/webhook-verification.
  const { createHmac } = await import("node:crypto");
  const ref = createHmac("sha256", "secret-key").update("task_123.1760000000").digest("base64");
  assertEquals(await kieSignature("task_123", "1760000000", "secret-key"), ref);
  assert(await verifyKieSignature("task_123", "1760000000", ref, "secret-key", 1760000100));
  assert(!(await verifyKieSignature("task_999", "1760000000", ref, "secret-key", 1760000100)));
  assert(!(await verifyKieSignature("task_123", "1760000000", ref, "other-key", 1760000100)));
  assert(!(await verifyKieSignature("task_123", "1760000000", ref, "secret-key", 1760000000 + 2 * 3600)));
  assert(!(await verifyKieSignature("task_123", null, ref, "secret-key")));
});

Deno.test("job callback token: per-job, secret-bound, url-safe", async () => {
  const tok = await jobCallbackToken("job-1", "s3cret");
  assert(/^[A-Za-z0-9_-]+$/.test(tok));
  assert(await verifyJobCallbackToken("job-1", tok, "s3cret"));
  assert(!(await verifyJobCallbackToken("job-2", tok, "s3cret")));
  assert(!(await verifyJobCallbackToken("job-1", tok, "")));
  assert(!(await verifyJobCallbackToken("job-1", null, "s3cret")));
});

const urls = ["https://s/1.png", "https://s/2.png"];

Deno.test("buildSpec: standard image - paid charged 1 @2K, free rides quota @1K", () => {
  const paid = buildSpec({ prompt: "shoe", result_type: "image", aspect_ratio: "portrait" }, { model: "nano-banana" }, { paid: true }, []);
  assertEquals(paid.kieModel, "nano-banana-2-1");
  assertEquals(paid.chargeCredits, 1);
  assertEquals(paid.billingTier, "credits");
  assertEquals(paid.input.resolution, "2K");
  assertEquals(paid.input.aspect_ratio, "9:16");
  const free = buildSpec({ prompt: "shoe", result_type: "image" }, {}, { paid: false }, urls);
  assertEquals(free.chargeCredits, 0);
  assertEquals(free.billingTier, "free_quota");
  assertEquals(free.input.resolution, "1K");
  assertEquals(free.input.image_input, urls);
});

Deno.test("buildSpec: pro image pricing + caps reference images at 8", () => {
  const many = Array.from({ length: 12 }, (_, i) => `https://s/${i}.png`);
  const p = buildSpec({ prompt: "x", result_type: "image" }, { model: "nano-banana-pro", resolution: "4K" }, { paid: true }, many);
  assertEquals(p.kieModel, "nano-banana-pro");
  assertEquals(p.chargeCredits, OUR_PRICES.image.proPaid);
  assertEquals(p.expectedKieCredits, 24);
  assertEquals((p.input.image_input as string[]).length, 8);
  const f = buildSpec({ prompt: "x", result_type: "image" }, { model: "nano-banana-pro", resolution: "bogus" }, { paid: false }, []);
  assertEquals(f.chargeCredits, OUR_PRICES.image.proFree);
  assertEquals(f.input.resolution, "2K");
});

Deno.test("buildSpec: veo 3.1 via unified market API", () => {
  const t2v = buildSpec({ prompt: "dog", result_type: "video", aspect_ratio: "square" }, {}, { paid: true }, []);
  assertEquals(t2v.kieModel, "veo-3-1");
  assertEquals(t2v.input.model, "veo3_fast");
  assertEquals(t2v.input.generation_type, "TEXT_2_VIDEO");
  assertEquals(t2v.input.aspect_ratio, "16:9");
  assertEquals("image_urls" in t2v.input, false);
  const i2v = buildSpec({ prompt: "", result_type: "video", aspect_ratio: "portrait", has_images: true }, {}, { paid: true }, urls);
  assertEquals(i2v.input.generation_type, "FIRST_AND_LAST_FRAMES_2_VIDEO");
  assertEquals(i2v.input.image_urls, ["https://s/1.png"]);
  assertEquals(i2v.input.aspect_ratio, "9:16");
  assert(String(i2v.input.prompt).length > 0);
  assertEquals(i2v.chargeCredits, 8);
});

Deno.test("buildSpec: music - simple mode needs a style; custom lyrics use custom mode with a title", () => {
  const simple = buildSpec({ prompt: "upbeat jingle for coffee", result_type: "music", music_options: { make_instrumental: true } }, {}, { paid: true }, []);
  assertEquals(simple.kieModel, "ai-music-api/generate");
  assertEquals(simple.input.custom_mode, false);
  assertEquals(simple.input.instrumental, true);
  assert(String(simple.input.style).length > 0);
  const custom = buildSpec({ prompt: "[Verse] la la la", result_type: "music", music_options: { lyrics_mode: "custom", custom_lyrics: "[Verse] la la la", duration: 30 } }, {}, { paid: true }, []);
  assertEquals(custom.input.custom_mode, true);
  assertEquals(custom.input.lyrics, "[Verse] la la la");
  assertEquals(custom.input.duration, 30);
  assert(String(custom.input.title).length > 0 && String(custom.input.title).length <= 80);
  assertEquals(custom.chargeCredits, 3);
});

Deno.test("margins: every paid product is profitable", () => {
  for (const r of marginTable()) {
    if (r.tier === "paid") assert(r.marginUsd > 0, `${r.product} loses money`);
  }
});

Deno.test("sniff: magic bytes", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const mp4 = new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0, 0, 0]);
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assertEquals(sniff(png, "image").type, "image/png");
  assertEquals(sniff(mp4, "video").type, "video/mp4");
  assertEquals(sniff(jpg, "image").type, "image/jpeg");
  assertEquals(sniff(new Uint8Array(20), "music").type, "audio/mpeg");
});

Deno.test("classifyFailure", () => {
  assertEquals(classifyFailure("Failed to fetch image due to access limits", "400"), "invalid_input");
  assertEquals(classifyFailure("system maintenance", "455"), "provider_unavailable");
  assertEquals(classifyFailure("still generating after 1000s"), "unknown");
  assertEquals(classifyFailure("Task timed out"), "timeout");
});
