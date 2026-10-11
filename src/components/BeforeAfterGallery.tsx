"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./studio/StudioIcons";
import { Reveal } from "./studio/StudioMotion";

const examples = [
  {
    id: "tote",
    name: "An everyday essential.",
    type: "Lifestyle",
    before: "/before2.jpg",
    after: "/after2.jpg",
    detail: "A simple tote. A London state of mind.",
    number: "01",
    color: "#d5deeb",
  },
  {
    id: "mug",
    name: "Make mornings a mood.",
    type: "Lifestyle",
    before: "/before1.jpg",
    after: "/after1.jpg",
    detail: "A product shot becomes a morning ritual.",
    number: "02",
    color: "#efdbc8",
  },
  {
    id: "hoodie",
    name: "Good energy, styled.",
    type: "Fashion",
    before: "/before3.jpg",
    after: "/after3.jpg",
    detail: "From flat lay to the center of attention.",
    number: "03",
    color: "#e9cbbd",
  },
];
function Comparison({ item }: { item: (typeof examples)[number] }) {
  const [position, setPosition] = useState(24);
  return (
    <article className="studio-work-card">
      <div className="studio-comparison" style={{ background: item.color }}>
        <Image
          src={item.after}
          alt={`${item.type} campaign: ${item.detail}`}
          fill
          sizes="(max-width: 640px) 90vw, (max-width: 900px) 44vw, 30vw"
        />
        <div
          className="studio-comparison-before"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <Image
            src={item.before}
            alt={`Original product photo for ${item.name}`}
            fill
            sizes="(max-width: 640px) 90vw, 30vw"
          />
        </div>
        <div className="studio-comparison-tags">
          <span>ORIGINAL</span>
          <span>
            REIMAGINED <Icon name="spark" width="11" height="11" />
          </span>
        </div>
        <div
          className="studio-comparison-divider"
          style={{ left: `${position}%` }}
        >
          <span>↔</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={position}
          onChange={(event) => setPosition(Number(event.target.value))}
          aria-label={`Compare original and reimagined ${item.id} photos`}
          aria-valuetext={`${position}% original photo visible`}
          className="studio-comparison-range"
        />
        <div className="studio-comparison-hint" aria-hidden="true">
          <Icon name="layers" width="13" height="13" /> DRAG TO COMPARE
        </div>
      </div>
      <div className="studio-work-info">
        <div>
          <span className="studio-work-type">
            {item.type} / {item.number}
          </span>
          <h3>{item.name}</h3>
          <p>{item.detail}</p>
        </div>
        <span className="studio-work-arrow">
          <Icon name="diagonal" width="21" height="21" />
        </span>
      </div>
    </article>
  );
}
export default function BeforeAfterGallery() {
  const [filter, setFilter] = useState("All work");
  const items = examples.filter(
    (item) => filter === "All work" || item.type === filter,
  );
  return (
    <section
      id="showcase"
      className="studio-showcase studio-section studio-container"
      aria-labelledby="showcase-title"
    >
      <Reveal>
        <div className="studio-section-heading">
          <div>
            <span className="studio-eyebrow">01 / THE POSSIBILITIES</span>
            <h2 id="showcase-title">
              Same product.
              <br />
              <span className="studio-muted">Entirely new energy.</span>
            </h2>
          </div>
          <p>
            That photo sitting in your camera roll?
            <br />
            It’s the start of your next great campaign.
            <br />
            <strong>Slide to see the difference.</strong>
          </p>
        </div>
      </Reveal>
      <Reveal>
        <div className="studio-gallery-toolbar">
          <div
            className="studio-filter-group"
            aria-label="Filter campaign examples"
          >
            {["All work", "Lifestyle", "Fashion"].map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setFilter(label)}
                aria-pressed={filter === label}
                className={filter === label ? "is-active" : ""}
              >
                {label}
                {label === "All work" && <span>03</span>}
              </button>
            ))}
          </div>
          <span className="studio-small-label">
            REAL PRODUCT TRANSFORMATIONS{" "}
            <Icon name="diagonal" width="14" height="14" />
          </span>
        </div>
      </Reveal>
      <motion.div className="studio-work-grid" layout>
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.35 }}
            >
              <Comparison item={item} />
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>
      <Reveal>
        <div className="studio-gallery-bottom">
          <span>YOUR PRODUCT COULD BE NEXT.</span>
          <a href="/signup" className="studio-text-link">
            Give your photos a new perspective{" "}
            <Icon name="arrow" width="18" height="18" />
          </a>
        </div>
      </Reveal>
    </section>
  );
}
