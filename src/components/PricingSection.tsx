"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CREDIT_PACKS,
  STRIPE_PLANS,
  creditsFor,
  yearlyMonthlyEquivalent,
  yearlySavingsPercent,
  type BillingInterval,
  type StripePlan,
} from "@/lib/stripe-plans";
import { trackMetaSubscribedButtonClick, trackMetaViewContent } from "@/lib/meta-events";
import { Reveal } from "./studio/StudioMotion";
import { Icon } from "./studio/StudioIcons";

const descriptions: Record<StripePlan, string> = {
  starter: "HD product ads for one brand.",
  pro: "Images, video and music for a growing store.",
  business: "A whole catalog of creative, every month.",
};

const features: Record<StripePlan, string[]> = {
  starter: ['HD images, no watermark', 'AI video, music & Nano Banana Pro', 'Commercial use'],
  pro: ['Everything in Starter', '3x the credits of Starter', 'Built for weekly ad testing'],
  business: ['Everything in Pro', 'For agencies & big catalogs', 'Lowest price per credit'],
};

function money(n: number) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

// Remembered so the paywall opens right after signup with this choice.
function rememberIntent(intent: Record<string, string>) {
  try {
    localStorage.setItem(
      "i2a_checkout_intent",
      JSON.stringify({ ...intent, ts: Date.now() }),
    );
  } catch {}
}

export default function PricingSection() {
  const router = useRouter();
  const [interval, setBillingInterval] = useState<BillingInterval>("year");
  const yearly = interval === "year";
  const sectionRef = useRef<HTMLElement>(null);

  // Tell Meta when someone actually looks at pricing (strong buying signal)
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let sent = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (sent || !entries.some((e) => e.isIntersecting)) return;
        sent = true;
        trackMetaViewContent({
          contentName: "Pricing",
          contentCategory: "pricing",
          source: "landing_pricing_section",
        });
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function subscribe(plan: StripePlan) {
    trackMetaSubscribedButtonClick({
      plan,
      interval,
      source: `marketing_pricing_${interval}`,
    });
    rememberIntent({ plan, interval });
    router.push("/signup");
  }
  function buyPack(pack: string) {
    trackMetaSubscribedButtonClick({ plan: pack, source: "marketing_pricing_pack" });
    rememberIntent({ pack });
    router.push("/signup");
  }

  return (
    <section
      ref={sectionRef}
      id="pricing"
      className="studio-pricing studio-section studio-container"
      aria-labelledby="pricing-title"
    >
      <Reveal>
        <div className="studio-section-heading">
          <div>
            <span className="studio-eyebrow">03 / ROOM FOR EVERY AMBITION</span>
            <h2 id="pricing-title">
              Great creative.
              <br />
              <span className="studio-muted">Grounded pricing.</span>
            </h2>
          </div>
          <div className="studio-pricing-note">
            <div className="studio-interval-toggle" role="tablist" aria-label="Billing interval">
              <button
                type="button"
                role="tab"
                aria-selected={yearly}
                className={yearly ? "is-active" : ""}
                onClick={() => setBillingInterval("year")}
              >
                YEARLY <em>SAVE {yearlySavingsPercent("pro")}%</em>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={!yearly}
                className={!yearly ? "is-active" : ""}
                onClick={() => setBillingInterval("month")}
              >
                MONTHLY
              </button>
            </div>
            <p>
              Start with 3 free images, no card required.
              <br />
              Cancel anytime.
            </p>
          </div>
        </div>
      </Reveal>
      <div className="studio-pricing-grid">
        {(["starter", "pro", "business"] as const).map((key, index) => {
          const plan = STRIPE_PLANS[key];
          const popular = key === "pro";
          const perMonth = yearly ? yearlyMonthlyEquivalent(key) : plan.price;
          return (
            <Reveal
              key={key}
              delay={index * 0.08}
              className={`studio-price-card ${popular ? "is-featured" : ""}`}
            >
              <div className="studio-plan-top">
                <Icon
                  name={
                    key === "starter"
                      ? "spark"
                      : key === "pro"
                        ? "layers"
                        : "grid"
                  }
                  width="26"
                  height="26"
                />
                {popular ? (
                  <span className="studio-popular">MOST POPULAR</span>
                ) : (
                  <span>0{index + 1}</span>
                )}
              </div>
              <h3>{plan.name}</h3>
              <p className="studio-plan-description">{descriptions[key]}</p>
              <div className="studio-price">
                {money(perMonth)}
                <span>/ month</span>
              </div>
              <p className="studio-price-sub">
                {yearly ? (
                  <>
                    {money(plan.yearlyPrice)} billed yearly{" "}
                    <s>{money(plan.price * 12)}</s>
                  </>
                ) : (
                  "Billed monthly"
                )}
              </p>
              <div className="studio-credit-allocation">
                <strong>{creditsFor(key, interval).toLocaleString("en-US")}</strong>
                <span>{yearly ? "credits, all upfront" : "credits / month"}</span>
                <Icon name="spark" width="18" height="18" />
              </div>
              <ul>
                {features[key].map((feature) => (
                  <li key={feature}>
                    <Icon name="check" width="15" height="15" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`studio-button ${popular ? "studio-button-lime" : "studio-button-outline"}`}
                onClick={() => subscribe(key)}
              >
                Choose {plan.name}
                <Icon name="diagonal" width="17" height="17" />
              </button>
            </Reveal>
          );
        })}
      </div>
      <Reveal>
        <div className="studio-packs">
          <div>
            <strong>No subscription? Buy credits once.</strong>
            <span>Credits never expire · HD, no watermark</span>
          </div>
          {Object.values(CREDIT_PACKS).map((pack) => (
            <button key={pack.id} type="button" onClick={() => buyPack(pack.id)}>
              <span>
                {pack.name} · {pack.credits} credits
              </span>
              <strong>{money(pack.price)}</strong>
            </button>
          ))}
        </div>
      </Reveal>
      <Reveal>
        <div className="studio-pricing-footnote">
          <p>
            1 credit = 1 HD image. Nano Banana Pro images use 6, an 8-second
            video 8, a music track 3. Unused credits roll over.
          </p>
          <div>
            <span>
              <Icon name="check" width="14" height="14" />
              Commercial use
            </span>
            <span>
              <Icon name="check" width="14" height="14" />
              Cancel anytime
            </span>
            <span>
              <Icon name="check" width="14" height="14" />
              Secure checkout
            </span>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
