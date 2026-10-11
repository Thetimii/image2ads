"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { Reveal } from "./studio/StudioMotion";
import { Icon } from "./studio/StudioIcons";

const faqs = [
  {
    q: "Do I need professional product photos?",
    a: "No. Start with a clear photo of your product, including one taken on your phone. Good lighting and a visible product give the AI a stronger starting point.",
  },
  {
    q: "How do I control the look of my ads?",
    a: "Use your prompt to describe the scene, mood, colors, lighting, and composition you want. Try different creative directions until you find a result that fits your brand.",
  },
  {
    q: "What can I create with Image2Ad?",
    a: "Create images from text or an existing photo. Pro and Business also unlock text-to-video, image-to-video, and AI music tools in your workspace.",
  },
  {
    q: "How do creative credits work?",
    a: "Your plan includes a monthly credit allocation. Each generation uses credits, and the amount varies by format and model. Your workspace shows your available balance.",
  },
  {
    q: "Can I try it before choosing a plan?",
    a: "Yes. Create an account to start exploring with free credits. You can choose a paid plan when you need more room to create.",
  },
  {
    q: "Can I cancel my subscription?",
    a: "Yes. Manage or cancel your subscription from Usage & Billing in your workspace. Paid plans renew monthly until canceled.",
  },
];
export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const id = "studio-faq-answer";
  return (
    <section id="faq" className="studio-faq studio-section">
      <div className="studio-container studio-faq-grid">
        <Reveal>
          <span className="studio-eyebrow">04 / A FEW GOOD QUESTIONS</span>
          <h2>
            A little clarity.
            <br />
            <span className="studio-muted">Before you create.</span>
          </h2>
          <p>
            Still curious about something?
            <br />
            We’re happy to help.
          </p>
          <Link href="/contact" className="studio-text-link">
            Let’s talk <Icon name="diagonal" width="17" height="17" />
          </Link>
        </Reveal>
        <Reveal className="studio-faq-list">
          {faqs.map((faq, index) => (
            <div
              className={`studio-faq-item ${open === index ? "is-open" : ""}`}
              key={faq.q}
            >
              <h3>
                <button
                  type="button"
                  aria-expanded={open === index}
                  aria-controls={`${id}-${index}`}
                  onClick={() => setOpen(open === index ? null : index)}
                >
                  <span className="studio-faq-number">0{index + 1}</span>
                  {faq.q}
                  <span className="studio-faq-plus">
                    <Icon name="plus" width="20" height="20" />
                  </span>
                </button>
              </h3>
              <AnimatePresence initial={false}>
                {open === index && (
                  <motion.div
                    id={`${id}-${index}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p>{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </Reveal>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }),
        }}
      />
    </section>
  );
}
