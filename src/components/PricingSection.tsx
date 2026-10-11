"use client";

import { useRouter } from "next/navigation";
import { STRIPE_PLANS, type StripePlan } from "@/lib/stripe-plans";
import { trackMetaSubscribedButtonClick } from "@/lib/meta-events";
import { Reveal } from "./studio/StudioMotion";
import { Icon } from "./studio/StudioIcons";

const descriptions = {
  starter: "For the first spark of an idea.",
  pro: "For your next creative chapter.",
  business: "For bigger ideas and more of them.",
};
export default function PricingSection() {
  const router = useRouter();
  function subscribe(plan: StripePlan) {
    trackMetaSubscribedButtonClick({ plan, source: "marketing_pricing" });
    router.push("/signin");
  }
  return (
    <section
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
            <span className="studio-billing-pill">
              <span className="studio-status-dot" /> BILLED MONTHLY
            </span>
            <p>
              No long-term commitments.
              <br />
              Pick your pace. Cancel anytime.
            </p>
          </div>
        </div>
      </Reveal>
      <div className="studio-pricing-grid">
        {(["starter", "pro", "business"] as const).map((key, index) => {
          const plan = STRIPE_PLANS[key];
          const popular = key === "pro";
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
                  <span className="studio-popular">THE SWEET SPOT</span>
                ) : (
                  <span>0{index + 1}</span>
                )}
              </div>
              <h3>{plan.name}</h3>
              <p className="studio-plan-description">{descriptions[key]}</p>
              <div className="studio-price">
                ${plan.price}
                <span>/ month</span>
              </div>
              <div className="studio-credit-allocation">
                <strong>{plan.credits}</strong>
                <span>creative credits / month</span>
                <Icon name="spark" width="18" height="18" />
              </div>
              <ul>
                {[
                  "Text-to-image & image-to-image",
                  ...(key === "starter"
                    ? [
                        "Build your product image library",
                        "Explore new visual directions",
                      ]
                    : [
                        "Text-to-video & image-to-video",
                        "Text-to-music generation",
                      ]),
                  "Download your generated assets",
                  "Manage your creative library",
                ].map((feature) => (
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
        <div className="studio-pricing-footnote">
          <p>
            Start exploring with free credits. Image, video, and music
            generations use different amounts of credits.
          </p>
          <div>
            <span>
              <Icon name="check" width="14" height="14" />
              Monthly billing
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
