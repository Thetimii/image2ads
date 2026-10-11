"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./studio/StudioIcons";
import { Reveal } from "./studio/StudioMotion";

const steps = [
  {
    title: "Start with your product.",
    description:
      "Upload a product photo. The everyday, on-your-phone kind is a perfectly good place to start.",
    icon: "upload" as const,
    label: "YOUR STARTING POINT",
  },
  {
    title: "Give it a little direction.",
    description:
      "Describe the scene, the feeling, the big idea. Set the style and let AI bring your vision into focus.",
    icon: "spark" as const,
    label: "THE CREATIVE DIRECTION",
  },
  {
    title: "Meet your next campaign.",
    description:
      "Download your new creative, try another direction, and keep exploring. Your next idea is always welcome.",
    icon: "download" as const,
    label: "READY FOR THE SPOTLIGHT",
  },
];
export default function HowItWorks() {
  const [step, setStep] = useState(0);
  return (
    <section
      id="how-it-works"
      className="studio-process studio-section"
      aria-labelledby="process-title"
    >
      <div className="studio-container">
        <Reveal>
          <div className="studio-section-heading">
            <div>
              <span className="studio-eyebrow">
                02 / FROM IDEA TO “THAT’S THE ONE”
              </span>
              <h2 id="process-title">
                Big creative.
                <br />
                <span className="studio-muted">Small learning curve.</span>
              </h2>
            </div>
            <p>
              You bring the product.
              <br />
              We’ll help you see it differently.
            </p>
          </div>
        </Reveal>
        <div className="studio-process-grid">
          <Reveal className="studio-process-steps">
            {steps.map((item, index) => (
              <button
                className={`studio-step ${step === index ? "is-active" : ""}`}
                type="button"
                key={item.title}
                aria-pressed={step === index}
                aria-controls="workflow-preview"
                onClick={() => setStep(index)}
              >
                <span className="studio-step-number">0{index + 1}</span>
                <span>
                  <strong>{item.title}</strong>
                  <span className="studio-step-description">
                    {item.description}
                  </span>
                </span>
                <Icon name="diagonal" width="19" height="19" />
              </button>
            ))}
            <Link className="studio-text-link" href="/signup">
              Okay, let’s make something{" "}
              <Icon name="arrow" width="18" height="18" />
            </Link>
          </Reveal>
          <Reveal className="studio-workflow-window" delay={0.15}>
            <div className="studio-window-top">
              <div className="studio-window-dots">
                <i />
                <i />
                <i />
              </div>
              <span>your creative playground</span>
              <Icon name="spark" width="14" height="14" />
            </div>
            <div
              className="studio-workflow-content"
              id="workflow-preview"
              role="region"
              aria-label={`Workflow preview: ${steps[step].title}`}
            >
              <div className="studio-workflow-eyebrow">
                <span className="studio-status-dot" />
                {steps[step].label}
                <span>0{step + 1} / 03</span>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="studio-demo-stage"
                >
                  {step === 0 ? (
                    <div className="studio-demo-upload">
                      <div className="studio-demo-product">
                        <Image
                          src="/before2.jpg"
                          alt="An uploaded blue tote bag product photo"
                          fill
                          sizes="220px"
                        />
                      </div>
                      <span className="studio-demo-upload-icon">
                        <Icon name="upload" width="19" height="19" />
                      </span>
                      <strong>Your next great ad starts here.</strong>
                      <p>
                        product-photo.jpg{" "}
                        <Icon name="check" width="13" height="13" />
                      </p>
                    </div>
                  ) : step === 1 ? (
                    <div className="studio-demo-prompt">
                      <span className="studio-demo-caption">THE IDEA</span>
                      <p>
                        “An effortlessly stylish woman carrying my tote on a
                        London street. Warm light, editorial photography,
                        everyday elegance.”
                      </p>
                      <div className="studio-prompt-chips">
                        <span>Editorial</span>
                        <span>Warm light</span>
                        <span>4:5 portrait</span>
                      </div>
                      <div className="studio-demo-prompt-bottom">
                        <Icon name="spark" />
                        <span>A little direction goes a long way.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="studio-demo-result">
                      <div className="studio-demo-result-image">
                        <Image
                          src="/after2.jpg"
                          alt="Finished London lifestyle campaign for the blue tote bag"
                          fill
                          sizes="230px"
                        />
                        <span>
                          Everyday.
                          <br />
                          Extraordinary.
                        </span>
                      </div>
                      <div className="studio-demo-result-label">
                        <span className="studio-ready-check">
                          <Icon name="check" width="14" height="14" />
                        </span>
                        <strong>A new perspective.</strong>
                        <span>Your creative is ready</span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
              <div className="studio-demo-bottom">
                <span>ILLUSTRATIVE WALKTHROUGH</span>
                <button type="button" onClick={() => setStep((step + 1) % 3)}>
                  {step === 2 ? "Start again" : "Next step"}
                  <Icon name="arrow" width="15" height="15" />
                </button>
              </div>
            </div>
          </Reveal>
        </div>
        <Reveal>
          <div className="studio-toolkit">
            <div>
              <Icon name="image" />
              <span>Product photography</span>
            </div>
            <div>
              <Icon name="video" />
              <span>Video generation</span>
            </div>
            <div>
              <Icon name="music" />
              <span>AI music</span>
            </div>
            <div>
              <Icon name="layers" />
              <span>Endless creative directions</span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
