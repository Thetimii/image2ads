"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "./studio/StudioIcons";
import { Reveal, Tilt } from "./studio/StudioMotion";

const campaigns = [
  {
    label: "The everyday tote",
    before: "/before2.jpg",
    after: "/after2.jpg",
    title: (
      <>
        Everyday.
        <br />
        Extraordinary.
      </>
    ),
    category: "LIFESTYLE / 001",
    color: "#bac6e5",
    alt: "Blue tote bag styled in a London lifestyle campaign",
  },
  {
    label: "The morning ritual",
    before: "/before1.jpg",
    after: "/after1.jpg",
    title: (
      <>
        A little sip.
        <br />A big moment.
      </>
    ),
    category: "LIFESTYLE / 002",
    color: "#e7ba99",
    alt: "Red mug featured in a sunlit morning lifestyle campaign",
  },
  {
    label: "The statement piece",
    before: "/before3.jpg",
    after: "/after3.jpg",
    title: (
      <>
        Wear your
        <br />
        good energy.
      </>
    ),
    category: "FASHION / 003",
    color: "#e3a293",
    alt: "Red graphic hoodie featured in a studio fashion campaign",
  },
];
export default function Hero() {
  const [active, setActive] = useState(0);
  const campaign = campaigns[active];
  return (
    <>
      <section
        className="studio-hero studio-container"
        aria-labelledby="hero-title"
      >
        <div className="studio-hero-copy">
          <Reveal>
            <div className="studio-eyebrow">
              <span className="studio-status-dot" /> SMALL INPUT. BIG CREATIVE
              ENERGY.
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <h1 id="hero-title">
              Your product.
              <br />A whole new
              <br />
              <span className="studio-highlight">
                spotlight.
                <svg
                  viewBox="0 0 430 24"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path d="M5 16C115 1 300 1 420 12M30 22c130-12 250-12 350-7" />
                </svg>
              </span>
              <span className="studio-title-spark">
                <Icon name="spark" />
              </span>
            </h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="studio-hero-description">
              Turn a simple product photo into the ad you wish you’d thought of.
              Your ideas, a little AI, and a whole lot of possibility.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <div className="studio-hero-actions">
              <Link href="/signup" className="studio-button">
                Make something great
                <span className="studio-button-icon">
                  <Icon name="diagonal" width="17" height="17" />
                </span>
              </Link>
              <a href="#how-it-works" className="studio-text-link">
                <span className="studio-play-icon">
                  <Icon name="play" width="12" height="12" />
                </span>
                See how it works
              </a>
            </div>
            <div className="studio-hero-note">
              <Icon name="check" width="14" height="14" /> 3 free images
              every day
              <span />
              No design skills needed
            </div>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="studio-creative-note">
              <span className="studio-handwritten">
                Less production.
                <br />
                More possibility.
              </span>
              <svg
                width="80"
                height="43"
                viewBox="0 0 80 43"
                aria-hidden="true"
              >
                <path d="M3 35C35 43 65 27 65 3m-12 9L65 2l10 11" />
              </svg>
            </div>
          </Reveal>
        </div>
        <Reveal className="studio-hero-art" delay={0.2}>
          <div
            className="studio-art-orbit"
            style={{ backgroundColor: campaign.color }}
          />
          <div className="studio-dot-grid" />
          <div className="studio-orbit-label">
            <Icon name="spark" width="15" height="15" /> A LITTLE AI. A LOT OF
            WOW.
          </div>
          <div className="studio-back-card">
            <Image
              src="/after3.jpg"
              alt="An example fashion ad with a red hoodie"
              fill
              sizes="180px"
            />
            <span>
              GOOD ENERGY
              <br />
              LOOKS GOOD.
            </span>
          </div>
          <Tilt className="studio-campaign-tilt">
            <div className="studio-campaign-card">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  className="studio-campaign-image"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Image
                    src={campaign.after}
                    alt={campaign.alt}
                    fill
                    priority={active === 0}
                    sizes="(max-width: 600px) 70vw, 360px"
                  />
                  <div className="studio-campaign-shade" />
                  <div className="studio-campaign-top">
                    <span>THE EVERYDAY, REIMAGINED.</span>
                    <Icon name="spark" width="23" height="23" />
                  </div>
                  <div className="studio-campaign-title">{campaign.title}</div>
                  <div className="studio-campaign-bottom">
                    <span>CREATED WITH IMAGE2AD</span>
                    <Icon name="diagonal" width="16" height="16" />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </Tilt>
          <div className="studio-original-card">
            <div className="studio-original-caption">
              <span className="studio-status-dot" /> YOUR ORIGINAL
            </div>
            <div className="studio-original-image">
              <Image
                src={campaign.before}
                alt={`Original product photo: ${campaign.label}`}
                fill
                sizes="130px"
              />
            </div>
            <span>Just a product photo.</span>
          </div>
          <svg
            className="studio-transform-arrow"
            viewBox="0 0 140 90"
            aria-hidden="true"
          >
            <path d="M5 80C10 10 90 0 125 32m-24-3 26 5-4-24" />
          </svg>
          <div className="studio-round-stamp" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <defs>
                <path
                  id="stamp-circle"
                  d="M50,50m-37,0a37,37 0 1,1 74,0a37,37 0 1,1 -74,0"
                />
              </defs>
              <text>
                <textPath href="#stamp-circle">
                  MADE TO STAND OUT • MADE TO STAND OUT •{" "}
                </textPath>
              </text>
            </svg>
            <Icon name="spark" width="32" height="32" />
          </div>
          <div className="studio-ready-pill">
            <span className="studio-ready-check">
              <Icon name="check" width="16" height="16" />
            </span>
            <div>
              <strong>From photo to possibility.</strong>
              <span>Same product. A different world.</span>
            </div>
          </div>
          <div
            className="studio-campaign-selector"
            aria-label="Choose a campaign example"
          >
            {campaigns.map((item, index) => (
              <button
                type="button"
                key={item.label}
                className={active === index ? "is-active" : ""}
                onClick={() => setActive(index)}
                aria-pressed={active === index}
              >
                <span>0{index + 1}</span>
                {item.label}
              </button>
            ))}
          </div>
        </Reveal>
        <div className="studio-hero-bottom">
          <span>A CREATIVE STUDIO. MINUS THE STUDIO.</span>
          <a href="#showcase">
            SCROLL TO GET INSPIRED <span>↓</span>
          </a>
        </div>
      </section>
      <div
        className="studio-ticker"
        aria-label="Create product images, lifestyle campaigns, scroll-stopping ads, and fresh ideas"
      >
        <div className="studio-ticker-track">
          {[0, 1].map((n) => (
            <div className="studio-ticker-group" key={n} aria-hidden={n === 1}>
              {[
                "BIG IDEAS",
                "SMALL INPUTS",
                "FRESH PERSPECTIVES",
                "SCROLL-STOPPING CREATIVE",
              ].map((item) => (
                <span key={item}>
                  {item}
                  <Icon name="spark" width="28" height="28" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
