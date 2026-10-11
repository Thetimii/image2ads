// Unit economics per generation type, from the backend's own price catalog.
//   deno run supabase/scripts/margins.ts
// Live per-job numbers (actual kie.ai cost per task) are in the database:
//   select * from generation_margins_daily order by day desc;
import { marginTable, NET_REVENUE_USD_PER_CREDIT, KIE_USD_PER_CREDIT, FREE_DAILY_CREDITS, KIE_PRICES } from "../functions/_shared/catalog.ts";

const usd = (n: number) => `$${n.toFixed(4)}`;
console.log(`Net revenue per credit: $${NET_REVENUE_USD_PER_CREDIT} (Pro plan after Stripe fees) · kie.ai credit: $${KIE_USD_PER_CREDIT}\n`);
console.log(["Product".padEnd(44), "Tier".padEnd(5), "Credits", "Revenue".padStart(9), "Cost".padStart(9), "Margin".padStart(9), "  %"].join(" "));
for (const r of marginTable()) {
  console.log([r.product.padEnd(44), r.tier.padEnd(5), String(r.ourCredits).padStart(7), usd(r.revenueUsd).padStart(9), usd(r.costUsd).padStart(9), usd(r.marginUsd).padStart(9), r.marginPct == null ? "   –" : `${r.marginPct}%`.padStart(6)].join(" "));
}
// Free credits can buy 3 standard images (1K) or 1 music track - both cost us ~$0.06.
const freeMax = Math.max(
  FREE_DAILY_CREDITS * KIE_PRICES["nano-banana-2-1"]["1K"],
  Math.floor(FREE_DAILY_CREDITS / 3) * KIE_PRICES["suno-generate"],
) * KIE_USD_PER_CREDIT;
console.log(`\nFree plan: ${FREE_DAILY_CREDITS} free credits/day (= ${FREE_DAILY_CREDITS} images). Worst case $${freeMax.toFixed(2)}/user/day ($${(freeMax * 30).toFixed(2)}/month).`);
