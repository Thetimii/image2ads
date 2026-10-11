import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import {
  BRAND,
  Photo,
  TikTokText,
  Statement,
  WipeReveal,
  Slam,
  Flash,
  Tag,
  Url,
  Timer,
  useFonts,
  FONT,
} from "./lib";

// Swap these to make a new video. before = plain product photo, after = image2ad output.
export const PAIRS = [
  { before: "before1.jpg", after: "after1.jpg", beforeLandscape: false, name: "mug" },
  { before: "before2.jpg", after: "after2.jpg", beforeLandscape: false, name: "tote bag" },
  { before: "before3.jpg", after: "after3.jpg", beforeLandscape: false, name: "hoodie" },
];

/* =====================================================================
   REEL 1 — Reveal first. 12s. Result in frame 1, original second.
   ===================================================================== */
export const RevealFirst: React.FC = () => {
  useFonts();
  const hero = PAIRS[1];
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* 0-2.5s: the finished ad, slow push-in */}
      <Sequence from={0} durationInFrames={75}>
        <Photo src={hero.after} zoomFrom={1} zoomTo={1.08} durationInFrames={75} />
        <TikTokText lines={["this ad took", "12 seconds"]} top={16} size={72} enterFrame={2} />
      </Sequence>

      {/* 2.5-5s: the original photo */}
      <Sequence from={75} durationInFrames={75}>
        <Slam startFrame={0}>
          <Photo src={hero.before} landscape={hero.beforeLandscape} zoomFrom={1.04} zoomTo={1} durationInFrames={75} />
        </Slam>
        <Tag text="BEFORE" enterFrame={3} />
        <TikTokText lines={["the original photo:"]} top={16} size={64} enterFrame={4} />
        <TikTokText lines={["no photoshoot.", "no designer."]} top={64} size={56} enterFrame={34} bg={BRAND} />
      </Sequence>

      {/* 5-7.5s: mug wipe */}
      <Sequence from={150} durationInFrames={75}>
        <WipeReveal before={PAIRS[0].before} after={PAIRS[0].after} startFrame={18} duration={14} direction="ltr" />
        <TikTokText lines={["works on anything"]} top={16} size={64} enterFrame={2} />
      </Sequence>

      {/* 7.5-10s: hoodie wipe */}
      <Sequence from={225} durationInFrames={75}>
        <WipeReveal before={PAIRS[2].before} after={PAIRS[2].after} startFrame={14} duration={14} direction="btt" />
        <TikTokText lines={["works on anything"]} top={16} size={64} enterFrame={0} />
      </Sequence>

      {/* 10-12s: engagement bait + loop seam back to hero */}
      <Sequence from={300} durationInFrames={60}>
        <Photo src={hero.after} dim={0.45} zoomFrom={1.08} zoomTo={1.0} durationInFrames={60} />
        <TikTokText lines={["comment a product", "and I'll make its ad"]} top={40} size={62} enterFrame={2} />
        <Url enterFrame={6} />
      </Sequence>

      <Flash at={75} />
    </AbsoluteFill>
  );
};

/* =====================================================================
   REEL 2 — Designer vs this. 10.5s. Price/time contrast + live timer.
   ===================================================================== */
export const DesignerVsThis: React.FC = () => {
  useFonts();
  const p = PAIRS[0];
  return (
    <AbsoluteFill style={{ background: "#0b0f1a" }}>
      <Sequence from={0} durationInFrames={45}>
        <Statement lines={["a designer", "quoted me $400"]} accentWord="$400" />
      </Sequence>
      <Sequence from={45} durationInFrames={40}>
        <Statement lines={["...and 3 days"]} accentWord="3 days" />
      </Sequence>
      <Sequence from={85} durationInFrames={35}>
        <Statement lines={["so I tried", "this instead"]} accentWord="this" />
      </Sequence>

      {/* 4s-9s: photo + timer + reveal */}
      <Sequence from={120} durationInFrames={150}>
        <Slam startFrame={0}>
          <WipeReveal before={p.before} after={p.after} startFrame={118} duration={12} direction="ltr" />
        </Slam>
        <TikTokText lines={["uploaded one photo"]} top={14} size={62} enterFrame={4} />
        <Timer startFrame={10} stopFrame={118} secondsAtStop={12} />
        <SpedUp from={10} to={118} />
        <Sequence from={122}>
          <Tag text="AFTER" color={BRAND} enterFrame={0} />
        </Sequence>
      </Sequence>

      {/* 9-10.5s: punchline */}
      <Sequence from={270} durationInFrames={45}>
        <Statement lines={["12 seconds.", "$0."]} accentWord="$0." size={120} />
        <Url enterFrame={8} strong />
      </Sequence>

      <Flash at={120} />
      <Flash at={238} len={4} />
    </AbsoluteFill>
  );
};

const SpedUp: React.FC<{ from: number; to: number }> = ({ from, to }) => {
  const frame = useCurrentFrame();
  if (frame < from || frame > to) return null;
  const o = interpolate(frame, [from, from + 6], [0, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        position: "absolute",
        top: 1500,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: 500,
        fontSize: 30,
        color: "rgba(255,255,255,0.7)",
        opacity: o,
        letterSpacing: 3,
        textShadow: "0 2px 10px rgba(0,0,0,0.8)",
      }}
    >
      3× SPEED
    </div>
  );
};

/* =====================================================================
   REEL 3 — Rate them 1-3. 11s. Rapid montage, comment bait at end.
   ===================================================================== */
const PairBlock: React.FC<{ pair: (typeof PAIRS)[number]; index: number }> = ({ pair, index }) => {
  const frame = useCurrentFrame();
  const cut = 26;
  return (
    <AbsoluteFill>
      {frame < cut ? (
        <>
          <Photo src={pair.before} landscape={pair.beforeLandscape} zoomFrom={1} zoomTo={1.04} durationInFrames={cut} />
          <Tag text="BEFORE" enterFrame={0} />
        </>
      ) : (
        <>
          <Slam startFrame={cut}>
            <Photo src={pair.after} zoomFrom={1} zoomTo={1.05} durationInFrames={50} startFrame={cut} />
          </Slam>
          <Tag text="AFTER" color={BRAND} enterFrame={cut} />
        </>
      )}
      <Counter n={index + 1} />
      <Flash at={cut} len={4} />
    </AbsoluteFill>
  );
};

const Counter: React.FC<{ n: number }> = ({ n }) => (
  <div
    style={{
      position: "absolute",
      top: 100,
      right: 60,
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: 150,
      color: "#fff",
      lineHeight: 1,
      textShadow: "0 4px 30px rgba(0,0,0,0.7)",
    }}
  >
    {n}
  </div>
);

export const RateThem: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: "#0b0f1a" }}>
      <Sequence from={0} durationInFrames={50}>
        <Statement lines={["3 products.", "1 photo each.", "rate the results"]} accentWord="rate" size={88} />
      </Sequence>
      {PAIRS.map((pair, i) => (
        <Sequence key={i} from={50 + i * 76} durationInFrames={76}>
          <PairBlock pair={pair} index={i} />
        </Sequence>
      ))}
      <Sequence from={278} durationInFrames={52}>
        <Photo src={PAIRS[2].after} dim={0.5} zoomFrom={1.05} zoomTo={1.1} durationInFrames={52} />
        <TikTokText lines={["which one wins?"]} top={34} size={76} enterFrame={2} />
        <TikTokText lines={["1, 2 or 3"]} top={44} size={76} enterFrame={8} bg={BRAND} />
        <Url enterFrame={10} />
      </Sequence>
    </AbsoluteFill>
  );
};
