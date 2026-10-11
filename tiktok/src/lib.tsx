import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  continueRender,
  delayRender,
} from "remotion";

export const BRAND = "#3b82f6";
export const FPS = 30;
export const W = 1080;
export const H = 1920;

// ---------- Fonts ----------
let fontsLoaded = false;
export const useFonts = () => {
  const [handle] = useState(() => (fontsLoaded ? null : delayRender("fonts")));
  useEffect(() => {
    if (handle === null) return;
    const faces = [
      ["500", "poppins-latin-500-normal.woff2"],
      ["700", "poppins-latin-700-normal.woff2"],
      ["800", "poppins-latin-800-normal.woff2"],
    ].map(([weight, file]) =>
      new FontFace("Poppins", `url(${staticFile("fonts/" + file)})`, {
        weight,
      }).load()
    );
    Promise.all(faces).then((loaded) => {
      loaded.forEach((f) => document.fonts.add(f));
      fontsLoaded = true;
      continueRender(handle);
    });
  }, [handle]);
};

export const FONT = "Poppins, system-ui, sans-serif";

// ---------- Photo: full-bleed cover, landscape gets blurred fill ----------
export const Photo: React.FC<{
  src: string;
  landscape?: boolean;
  zoomFrom?: number;
  zoomTo?: number;
  durationInFrames?: number;
  startFrame?: number;
  dim?: number;
}> = ({
  src,
  landscape,
  zoomFrom = 1,
  zoomTo = 1,
  durationInFrames = 90,
  startFrame = 0,
  dim = 0,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(
    frame,
    [startFrame, startFrame + durationInFrames],
    [zoomFrom, zoomTo],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const url = staticFile(src);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      {landscape ? (
        <>
          <Img
            src={url}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(40px) brightness(0.6)",
              transform: `scale(${scale * 1.15})`,
            }}
          />
          <Img
            src={url}
            style={{
              position: "absolute",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: `scale(${scale})`,
            }}
          />
        </>
      ) : (
        <Img
          src={url}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale})`,
          }}
        />
      )}
      {dim > 0 && (
        <AbsoluteFill style={{ background: `rgba(0,0,0,${dim})` }} />
      )}
    </AbsoluteFill>
  );
};

// ---------- TikTok-native text (white on black pill, per line) ----------
export const TikTokText: React.FC<{
  lines: string[];
  top?: number; // percent of height
  size?: number;
  enterFrame?: number;
  color?: string;
  bg?: string;
  align?: "center" | "left";
  weight?: number;
}> = ({
  lines,
  top = 18,
  size = 64,
  enterFrame = 0,
  color = "#fff",
  bg = "rgba(0,0,0,0.85)",
  align = "center",
  weight = 800,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({
    frame: frame - enterFrame,
    fps,
    config: { damping: 14, stiffness: 220, mass: 0.7 },
  });
  if (frame < enterFrame) return null;
  const scale = interpolate(s, [0, 1], [0.6, 1]);
  const opacity = interpolate(s, [0, 0.4], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}%`,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: align === "center" ? "center" : "flex-start",
        paddingLeft: align === "left" ? 70 : 60,
        paddingRight: 60,
        gap: 0,
        transform: `scale(${scale})`,
        opacity,
        transformOrigin: "center",
      }}
    >
      {lines.map((l, i) => (
        <span
          key={i}
          style={{
            fontFamily: FONT,
            fontWeight: weight,
            fontSize: size,
            lineHeight: 1.25,
            color,
            background: bg,
            padding: "4px 26px",
            borderRadius: 18,
            textAlign: align,
            letterSpacing: -0.5,
            whiteSpace: "nowrap",
          }}
        >
          {l}
        </span>
      ))}
    </div>
  );
};

// ---------- Big centered statement on dark ----------
export const Statement: React.FC<{
  lines: string[];
  size?: number;
  accentWord?: string;
  enterFrame?: number;
}> = ({ lines, size = 96, accentWord, enterFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill
      style={{
        background: "#0b0f1a",
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {lines.map((l, i) => {
          const s = spring({
            frame: frame - enterFrame - i * 4,
            fps,
            config: { damping: 16, stiffness: 180 },
          });
          const y = interpolate(s, [0, 1], [40, 0]);
          const o = interpolate(s, [0, 0.5], [0, 1], {
            extrapolateRight: "clamp",
          });
          const parts = accentWord ? l.split(accentWord) : [l];
          return (
            <div
              key={i}
              style={{
                fontFamily: FONT,
                fontWeight: 800,
                fontSize: size,
                lineHeight: 1.1,
                color: "#fff",
                textAlign: "center",
                transform: `translateY(${y}px)`,
                opacity: o,
                letterSpacing: -2,
              }}
            >
              {parts.map((p, j) => (
                <React.Fragment key={j}>
                  {p}
                  {j < parts.length - 1 && (
                    <span style={{ color: BRAND }}>{accentWord}</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ---------- Wipe reveal: after image swipes over before ----------
export const WipeReveal: React.FC<{
  before: string;
  after: string;
  beforeLandscape?: boolean;
  startFrame: number;
  duration?: number;
  direction?: "ltr" | "btt";
}> = ({
  before,
  after,
  beforeLandscape,
  startFrame,
  duration = 14,
  direction = "ltr",
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.7, 0, 0.2, 1),
  });
  const clip =
    direction === "ltr"
      ? `inset(0 ${(1 - p) * 100}% 0 0)`
      : `inset(${(1 - p) * 100}% 0 0 0)`;
  const linePos = p * 100;
  return (
    <AbsoluteFill>
      <Photo src={before} landscape={beforeLandscape} />
      <AbsoluteFill style={{ clipPath: clip }}>
        <Photo src={after} />
      </AbsoluteFill>
      {p > 0 && p < 1 && (
        <div
          style={{
            position: "absolute",
            ...(direction === "ltr"
              ? { top: 0, bottom: 0, left: `${linePos}%`, width: 8 }
              : { left: 0, right: 0, top: `${linePos}%`, height: 8 }),
            background: "#fff",
            boxShadow: "0 0 30px rgba(255,255,255,0.9)",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

// ---------- Slam-in: image punches in with blur ----------
export const Slam: React.FC<{ startFrame: number; children: React.ReactNode }> =
  ({ startFrame, children }) => {
    const frame = useCurrentFrame();
    const t = interpolate(frame, [startFrame, startFrame + 7], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    });
    const scale = interpolate(t, [0, 1], [1.35, 1]);
    const blur = interpolate(t, [0, 1], [18, 0]);
    return (
      <AbsoluteFill
        style={{ transform: `scale(${scale})`, filter: `blur(${blur}px)` }}
      >
        {children}
      </AbsoluteFill>
    );
  };

// ---------- Flash ----------
export const Flash: React.FC<{ at: number; len?: number }> = ({
  at,
  len = 6,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 1, at + len], [0, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: "#fff", opacity: o }} />;
};

// ---------- Small corner label (BEFORE / AFTER) ----------
export const Tag: React.FC<{
  text: string;
  color?: string;
  enterFrame?: number;
}> = ({ text, color = "#fff", enterFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - enterFrame, fps, config: { damping: 15 } });
  if (frame < enterFrame) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 110,
        left: 60,
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: 40,
        letterSpacing: 6,
        color: color === "#fff" ? "#0b0f1a" : "#fff",
        background: color,
        padding: "10px 28px",
        borderRadius: 12,
        transform: `scale(${interpolate(s, [0, 1], [0.5, 1])})`,
        transformOrigin: "left center",
        opacity: s,
      }}
    >
      {text}
    </div>
  );
};

// ---------- Subtle URL watermark (reads as part of a screen recording, not a CTA) ----------
export const Url: React.FC<{ enterFrame?: number; strong?: boolean }> = ({
  enterFrame = 0,
  strong,
}) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [enterFrame, enterFrame + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 420,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: FONT,
        fontWeight: strong ? 700 : 500,
        fontSize: strong ? 44 : 34,
        color: "#fff",
        opacity: o * (strong ? 1 : 0.75),
        textShadow: "0 2px 16px rgba(0,0,0,0.8)",
        letterSpacing: 1,
      }}
    >
      image2ad.com
    </div>
  );
};

// ---------- Timer HUD ----------
export const Timer: React.FC<{
  startFrame: number;
  stopFrame: number;
  secondsAtStop: number;
}> = ({ startFrame, stopFrame, secondsAtStop }) => {
  const frame = useCurrentFrame();
  if (frame < startFrame) return null;
  const t = interpolate(frame, [startFrame, stopFrame], [0, secondsAtStop], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sec = Math.floor(t);
  const cs = Math.floor((t - sec) * 100);
  const stopped = frame >= stopFrame;
  return (
    <div
      style={{
        position: "absolute",
        top: 1380,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 84,
          fontVariantNumeric: "tabular-nums",
          color: stopped ? "#0b0f1a" : "#fff",
          background: stopped ? "#4ade80" : "rgba(0,0,0,0.8)",
          padding: "8px 40px",
          borderRadius: 24,
          letterSpacing: 2,
          border: stopped ? "none" : `4px solid ${BRAND}`,
        }}
      >
        0:{String(sec).padStart(2, "0")}.{String(cs).padStart(2, "0")}
      </div>
    </div>
  );
};

// ---------- Audio helpers ----------
import { Audio, Sequence as _Seq } from "remotion";

export const Sfx: React.FC<{ name: string; at: number; volume?: number }> = ({
  name,
  at,
  volume = 1,
}) => (
  <_Seq from={at} durationInFrames={120}>
    <Audio src={staticFile(`sfx/${name}.wav`)} volume={volume} />
  </_Seq>
);

export const MUSIC_VOLUME = 0.22; // set to 0 to render without the beat
export const Music: React.FC<{ fadeOutAt?: number }> = ({ fadeOutAt }) => {
  const frame = useCurrentFrame();
  if (MUSIC_VOLUME <= 0) return null;
  return (
    <Audio
      src={staticFile("sfx/beat.wav")}
      volume={(f) => {
        const fin = interpolate(f, [0, 20], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
        const fout = fadeOutAt ? interpolate(f, [fadeOutAt, fadeOutAt + 30], [1, 0], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }) : 1;
        return MUSIC_VOLUME * fin * fout;
      }}
    />
  );
};

// ---------- Cursor (macOS-style arrow) ----------
export const Cursor: React.FC<{ x: number; y: number; pressed?: boolean }> = ({ x, y, pressed }) => (
  <svg
    width={60}
    height={72}
    viewBox="0 0 20 24"
    style={{
      position: "absolute",
      left: x,
      top: y,
      transform: `scale(${pressed ? 0.85 : 1})`,
      transformOrigin: "top left",
      filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
    }}
  >
    <path d="M2 1 L2 19 L6.5 14.5 L9.5 21.5 L12.5 20.2 L9.5 13.3 L16 13.3 Z" fill="#fff" stroke="#000" strokeWidth={1.2} strokeLinejoin="round" />
  </svg>
);

// keyframe interpolation helper: [[frame, value], ...]
export const kf = (frame: number, keys: [number, number][], easing = Easing.inOut(Easing.cubic)) => {
  const xs = keys.map((k) => k[0]);
  const ys = keys.map((k) => k[1]);
  return interpolate(frame, xs, ys, { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
};

// ---------- Rolling number (slot machine) ----------
export const RollNumber: React.FC<{
  from: number;
  to: number;
  startFrame: number;
  duration: number;
  prefix?: string;
  suffix?: string;
  size?: number;
  color?: string;
  decimals?: number;
}> = ({ from, to, startFrame, duration, prefix = "", suffix = "", size = 160, color = "#fff", decimals = 0 }) => {
  const frame = useCurrentFrame();
  const v = interpolate(frame, [startFrame, startFrame + duration], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const done = frame >= startFrame + duration;
  const punch = done ? 1 + 0.08 * Math.exp(-(frame - startFrame - duration) / 4) : 1;
  return (
    <div
      style={{
        fontFamily: FONT,
        fontWeight: 800,
        fontSize: size,
        color,
        fontVariantNumeric: "tabular-nums",
        letterSpacing: -4,
        lineHeight: 1,
        transform: `scale(${punch})`,
        display: "inline-block",
      }}
    >
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </div>
  );
};

// ---------- Typewriter ----------
export const Typewriter: React.FC<{ text: string; startFrame: number; cps?: number; size?: number; color?: string; top?: number }> = ({
  text,
  startFrame,
  cps = 2.2,
  size = 56,
  color = "#fff",
  top = 50,
}) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - startFrame) * cps)));
  if (frame < startFrame) return null;
  const caret = Math.floor(frame / 8) % 2 === 0;
  return (
    <div
      style={{
        position: "absolute",
        top: `${top}%`,
        left: 80,
        right: 80,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        color,
        textAlign: "center",
        lineHeight: 1.2,
      }}
    >
      {text.slice(0, n)}
      <span style={{ opacity: caret && n < text.length ? 1 : 0, color: BRAND }}>|</span>
    </div>
  );
};
