import React from "react";
import { AbsoluteFill, Sequence, Img, staticFile, useCurrentFrame, useVideoConfig, interpolate, spring, Easing } from "remotion";
import {
  BRAND, FONT, Photo, TikTokText, Statement, Slam, Flash, Tag, Url,
  useFonts, Sfx, Music, Cursor, kf, RollNumber, Typewriter,
} from "./lib";
import { PAIRS } from "./Reels";

const DARK = "#0b0f1a";

/* =====================================================================
   REEL 4 — UI DEMO. 13s. Drag photo → generate → scan → result slams in.
   ===================================================================== */
const Grid: React.FC = () => (
  <AbsoluteFill
    style={{
      background: DARK,
      backgroundImage:
        "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      backgroundSize: "80px 80px",
    }}
  />
);

const Wordmark: React.FC = () => (
  <div style={{ position: "absolute", top: 400, left: 0, right: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 18 }}>
    <Img src={staticFile("logo.png")} style={{ width: 64, height: 64, borderRadius: 16 }} />
    <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 44, color: "#fff", letterSpacing: -1 }}>image2ad</span>
  </div>
);

const DROP = { x: 140, y: 560, w: 800, h: 800 };

const UiDemoScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pair = PAIRS[1];

  // --- thumbnail drag path (frames 8-40) ---
  const dropped = frame >= 40;
  const tx = kf(frame, [[8, -300], [40, DROP.x + DROP.w / 2 - 150]]);
  const ty = kf(frame, [[8, 1700], [40, DROP.y + DROP.h / 2 - 200]]);
  const trot = kf(frame, [[8, -12], [40, 0]]);
  const dropSpring = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 200 } });
  const thumbScale = dropped ? interpolate(dropSpring, [0, 1], [1, 2.0]) : 1;

  // --- cursor path ---
  const cx = frame < 44 ? tx + 160 : kf(frame, [[44, tx + 160], [66, 540], [72, 540]]);
  const cy = frame < 44 ? ty + 220 : kf(frame, [[44, ty + 220], [66, 1470], [72, 1470]]);
  const pressed = frame >= 72 && frame < 78;

  // --- generate button ---
  const btnS = spring({ frame: frame - 48, fps, config: { damping: 14, stiffness: 200 } });
  const btnPress = pressed ? 0.93 : 1;
  const showBtn = frame >= 48 && frame < 78;

  // --- processing (78-165) ---
  const processing = frame >= 78 && frame < 165;
  const progress = interpolate(frame, [78, 160], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const scanY = ((frame - 78) % 30) / 30;
  const status =
    frame < 104 ? "analyzing product" : frame < 130 ? "building scene" : frame < 150 ? "lighting & shadows" : "rendering";

  const dzBorder = dropped ? BRAND : "rgba(255,255,255,0.35)";
  const pulse = 1 + 0.015 * Math.sin(frame / 6);

  return (
    <AbsoluteFill>
      <Grid />
      <Wordmark />

      {/* Dropzone */}
      <div
        style={{
          position: "absolute",
          left: DROP.x, top: DROP.y, width: DROP.w, height: DROP.h,
          border: `6px dashed ${dzBorder}`,
          borderRadius: 40,
          transform: `scale(${dropped ? 1 : pulse})`,
          background: dropped ? "rgba(59,130,246,0.08)" : "rgba(255,255,255,0.03)",
          overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {!dropped && (
          <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 40, color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.4 }}>
            drop your<br />product photo
          </div>
        )}
        {dropped && (
          <>
            <Img src={staticFile(pair.before)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${interpolate(dropSpring, [0, 1], [0.6, 1])})`, filter: processing ? "saturate(1.2)" : "none" }} />
            {processing && (
              <>
                <div style={{ position: "absolute", left: 0, right: 0, top: `${scanY * 100}%`, height: 6, background: BRAND, boxShadow: `0 0 40px 10px ${BRAND}` }} />
                <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: `${scanY * 100}%`, background: `linear-gradient(to bottom, transparent, rgba(59,130,246,0.25))` }} />
              </>
            )}
          </>
        )}
      </div>

      {/* Dragged thumbnail (before drop) */}
      {!dropped && frame >= 8 && (
        <div style={{ position: "absolute", left: tx, top: ty, width: 300, height: 400, borderRadius: 24, overflow: "hidden", transform: `rotate(${trot}deg) scale(${thumbScale})`, boxShadow: "0 30px 60px rgba(0,0,0,0.6)", border: "4px solid #fff" }}>
          <Img src={staticFile(pair.before)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      {/* Generate button */}
      {showBtn && (
        <div
          style={{
            position: "absolute", left: 140, top: 1420, width: 800, height: 120,
            borderRadius: 30, background: BRAND,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: FONT, fontWeight: 700, fontSize: 48, color: "#fff",
            transform: `scale(${interpolate(btnS, [0, 1], [0.7, 1]) * btnPress})`,
            opacity: btnS, boxShadow: `0 20px 60px rgba(59,130,246,0.45)`,
          }}
        >
          Generate ad
        </div>
      )}

      {/* Progress + status */}
      {processing && (
        <>
          <div style={{ position: "absolute", left: 140, top: 1420, width: 800, height: 120, borderRadius: 30, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{ width: `${progress}%`, height: "100%", background: BRAND, transition: "none" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT, fontWeight: 700, fontSize: 44, color: "#fff", fontVariantNumeric: "tabular-nums" }}>
              {Math.round(progress)}%
            </div>
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: 1570, textAlign: "center", fontFamily: FONT, fontWeight: 500, fontSize: 34, color: "rgba(255,255,255,0.7)", letterSpacing: 2 }}>
            {status}{".".repeat(1 + (Math.floor(frame / 8) % 3))}
          </div>
        </>
      )}

      {/* Cursor */}
      {frame >= 8 && frame < 100 && <Cursor x={cx} y={cy} pressed={pressed || (frame >= 8 && frame < 40)} />}
    </AbsoluteFill>
  );
};

export const UiDemo: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: DARK }}>
      <Music fadeOutAt={360} />

      <Sequence from={0} durationInFrames={165}>
        <UiDemoScene />
        <TikTokText lines={["watch this photo", "become an ad"]} top={5} size={56} enterFrame={2} />
      </Sequence>
      <Sfx name="whoosh" at={8} volume={0.7} />
      <Sfx name="thud" at={40} />
      <Sfx name="pop" at={48} volume={0.6} />
      <Sfx name="click" at={72} />
      {[84, 96, 108, 118, 127, 135, 142, 148, 153, 157, 160].map((f) => <Sfx key={f} name="tick" at={f} volume={0.35} />)}
      <Sfx name="beep" at={78} volume={0.4} />
      <Sfx name="beep" at={104} volume={0.4} />
      <Sfx name="beep" at={130} volume={0.4} />
      <Sfx name="riser" at={120} volume={0.8} />

      {/* Result */}
      <Sequence from={165} durationInFrames={80}>
        <Slam startFrame={0}>
          <Photo src={PAIRS[1].after} zoomFrom={1} zoomTo={1.06} durationInFrames={80} />
        </Slam>
        <TikTokText lines={["done."]} top={14} size={80} enterFrame={4} />
        <TikTokText lines={["12.4 seconds"]} top={23} size={54} enterFrame={30} bg={BRAND} />
      </Sequence>
      <Flash at={165} len={5} />
      <Sfx name="bass_hit_big" at={165} />
      <Sfx name="ding" at={169} volume={0.7} />
      <Sfx name="pop" at={195} volume={0.6} />

      {/* Second + third result, whip pans */}
      <Sequence from={245} durationInFrames={55}>
        <Whip>
          <Photo src={PAIRS[2].after} zoomFrom={1.04} zoomTo={1} durationInFrames={55} />
        </Whip>
        <TikTokText lines={["same with this one"]} top={14} size={60} enterFrame={6} />
      </Sequence>
      <Sfx name="whoosh_short" at={243} />
      <Sequence from={300} durationInFrames={45}>
        <Whip>
          <Photo src={PAIRS[0].after} zoomFrom={1.04} zoomTo={1} durationInFrames={45} />
        </Whip>
        <TikTokText lines={["and this one"]} top={14} size={60} enterFrame={6} />
      </Sequence>
      <Sfx name="whoosh_short" at={298} />

      {/* CTA */}
      <Sequence from={345} durationInFrames={45}>
        <Photo src={PAIRS[0].after} dim={0.55} zoomFrom={1} zoomTo={1.04} durationInFrames={45} />
        <TikTokText lines={["try it with", "your product"]} top={36} size={70} enterFrame={2} />
        <Url enterFrame={8} strong />
      </Sequence>
      <Sfx name="pop" at={347} volume={0.6} />
    </AbsoluteFill>
  );
};

const Whip: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const x = interpolate(frame, [0, 8], [1080, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const blur = interpolate(frame, [0, 8], [20, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `translateX(${x}px)`, filter: `blur(${blur}px)` }}>{children}</AbsoluteFill>;
};

/* =====================================================================
   REEL 5 — KINETIC TYPE. 11s. Word slams + flash cuts + number roll.
   ===================================================================== */
const Word: React.FC<{ text: string; size?: number; color?: string; shake?: boolean }> = ({ text, size = 170, color = "#fff", shake }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [0, 6], [0, 1], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const sc = interpolate(t, [0, 1], [2.6, 1]);
  const bl = interpolate(t, [0, 1], [30, 0]);
  const sx = shake ? Math.sin(frame * 2.3) * 6 * Math.exp(-frame / 20) : 0;
  const sy = shake ? Math.cos(frame * 2.9) * 6 * Math.exp(-frame / 20) : 0;
  return (
    <AbsoluteFill style={{ background: DARK, justifyContent: "center", alignItems: "center" }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, color, letterSpacing: -6, lineHeight: 1, transform: `scale(${sc}) translate(${sx}px, ${sy}px)`, filter: `blur(${bl}px)`, textAlign: "center" }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const KineticType: React.FC = () => {
  useFonts();
  const words: [string, number, number, string?][] = [
    ["your", 0, 8],
    ["product", 8, 8],
    ["photos", 16, 8],
    ["are", 24, 8],
  ];
  const cuts: { src: string; from: number; len: number; tag: "BEFORE" | "AFTER" }[] = [
    { src: PAIRS[0].before, from: 118, len: 10, tag: "BEFORE" },
    { src: PAIRS[0].after, from: 128, len: 18, tag: "AFTER" },
    { src: PAIRS[1].before, from: 146, len: 9, tag: "BEFORE" },
    { src: PAIRS[1].after, from: 155, len: 18, tag: "AFTER" },
    { src: PAIRS[2].before, from: 173, len: 9, tag: "BEFORE" },
    { src: PAIRS[2].after, from: 182, len: 20, tag: "AFTER" },
  ];
  return (
    <AbsoluteFill style={{ background: DARK }}>
      <Music fadeOutAt={300} />
      {words.map(([w, from, len]) => (
        <Sequence key={w} from={from} durationInFrames={len}>
          <Word text={w} />
        </Sequence>
      ))}
      {words.map(([w, from]) => <Sfx key={"s" + w} name="bass_hit" at={from} volume={0.55} />)}
      <Sequence from={32} durationInFrames={40}>
        <Word text="BORING." size={200} color={BRAND} shake />
      </Sequence>
      <Sfx name="bass_hit_big" at={32} />
      <Flash at={32} len={3} />

      <Sequence from={72} durationInFrames={46}>
        <AbsoluteFill style={{ background: DARK }} />
        <Typewriter text="and it's costing you sales." startFrame={0} cps={1.1} size={64} top={44} />
      </Sequence>
      {Array.from({ length: 26 }, (_, i) => 72 + Math.floor(i / 1.1)).filter((v, i, a) => a.indexOf(v) === i).map((f) => (
        <Sfx key={"k" + f} name="key" at={f} volume={0.5} />
      ))}
      <Sfx name="riser" at={75} volume={0.9} />

      {cuts.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.len}>
          <Slam startFrame={0}>
            <Photo src={c.src} zoomFrom={1} zoomTo={1.04} durationInFrames={c.len} />
          </Slam>
          <Tag text={c.tag} color={c.tag === "AFTER" ? BRAND : "#fff"} enterFrame={0} />
        </Sequence>
      ))}
      {cuts.map((c, i) => <Sfx key={"c" + i} name={c.tag === "AFTER" ? "bass_hit" : "shutter"} at={c.from} volume={c.tag === "AFTER" ? 0.7 : 0.8} />)}
      <Flash at={118} len={4} />

      {/* number roll */}
      <Sequence from={202} durationInFrames={58}>
        <AbsoluteFill style={{ background: DARK, justifyContent: "center", alignItems: "center" }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 60, color: "rgba(255,255,255,0.7)", marginBottom: 20 }}>fix it in</div>
          <RollNumber from={0} to={12} startFrame={4} duration={26} suffix="" size={300} color={BRAND} />
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 80, color: "#fff", marginTop: 10 }}>seconds</div>
        </AbsoluteFill>
      </Sequence>
      {[206, 209, 212, 215, 218, 221, 224, 227].map((f) => <Sfx key={f} name="tick" at={f} volume={0.5} />)}
      <Sfx name="clack" at={232} />
      <Sfx name="pop" at={233} volume={0.6} />

      <Sequence from={260} durationInFrames={70}>
        <Photo src={PAIRS[1].after} dim={0.45} zoomFrom={1} zoomTo={1.06} durationInFrames={70} />
        <TikTokText lines={["no designer.", "no photoshoot."]} top={30} size={66} enterFrame={2} />
        <TikTokText lines={["save this for your next launch"]} top={46} size={44} enterFrame={22} bg={BRAND} />
        <Url enterFrame={30} />
      </Sequence>
      <Sfx name="whoosh" at={258} />
      <Sfx name="pop" at={282} volume={0.6} />
    </AbsoluteFill>
  );
};

/* =====================================================================
   REEL 6 — THE RACE. 10s. Designer lane vs image2ad lane.
   ===================================================================== */
const Lane: React.FC<{
  label: string;
  top: number;
  progress: number;
  color: string;
  sub: string;
  done?: boolean;
  thumb?: string;
  cost: React.ReactNode;
}> = ({ label, top, progress, color, sub, done, thumb, cost }) => (
  <div style={{ position: "absolute", left: 90, right: 90, top, height: 560, borderRadius: 40, background: "rgba(255,255,255,0.05)", border: `3px solid ${done ? color : "rgba(255,255,255,0.1)"}`, padding: 50, boxSizing: "border-box" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 56, color: "#fff", letterSpacing: -1 }}>{label}</div>
      {cost}
    </div>
    <div style={{ marginTop: 40, height: 44, borderRadius: 22, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
      <div style={{ width: `${progress}%`, height: "100%", background: color, borderRadius: 22 }} />
    </div>
    <div style={{ marginTop: 36, display: "flex", alignItems: "center", gap: 30 }}>
      {thumb && done && (
        <div style={{ width: 180, height: 240, borderRadius: 20, overflow: "hidden", border: `4px solid ${color}`, flexShrink: 0 }}>
          <Img src={staticFile(thumb)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}
      <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 40, color: done ? color : "rgba(255,255,255,0.6)", lineHeight: 1.3 }}>{sub}</div>
    </div>
  </div>
);

const RaceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dProg = interpolate(frame, [10, 190], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.quad) });
  const aProg = interpolate(frame, [14, 46], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const aDone = frame >= 46;
  const dDone = frame >= 190;
  const dSub = frame < 70 ? "day 1 · briefing call" : frame < 130 ? "day 2 · first drafts" : frame < 190 ? "day 3 · revisions…" : "delivered · 3 days";
  const aSub = aDone ? "delivered · 12 seconds" : "generating…";
  const dCost = (
    <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 60, color: "#f87171", fontVariantNumeric: "tabular-nums" }}>
      ${Math.round(interpolate(frame, [10, 190], [0, 400], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))}
    </div>
  );
  const aCost = <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 60, color: "#4ade80" }}>$0</div>;
  const waitS = spring({ frame: frame - 120, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <Grid />
      <div style={{ position: "absolute", top: 160, left: 0, right: 0, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 72, color: "#fff", letterSpacing: -2 }}>
        same brief. same photo.
      </div>
      <Lane label="designer" top={360} progress={dProg} color="#f87171" sub={dSub} done={dDone} cost={dCost} />
      <div style={{ position: "absolute", top: 940, left: 0, right: 0, textAlign: "center", fontFamily: FONT, fontWeight: 800, fontSize: 60, color: "rgba(255,255,255,0.35)" }}>vs</div>
      <Lane label="image2ad" top={1030} progress={aProg} color={BRAND} sub={aSub} done={aDone} thumb={PAIRS[0].after} cost={aCost} />
      {frame >= 120 && frame < 190 && (
        <div style={{ position: "absolute", top: 1630, left: 0, right: 0, textAlign: "center", fontFamily: FONT, fontWeight: 700, fontSize: 48, color: "rgba(255,255,255,0.8)", transform: `scale(${waitS})` }}>
          …still waiting
        </div>
      )}
    </AbsoluteFill>
  );
};

export const TheRace: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ background: DARK }}>
      <Music fadeOutAt={270} />
      <Sequence from={0} durationInFrames={30}>
        <Statement lines={["designer", "vs AI"]} accentWord="AI" size={130} />
      </Sequence>
      <Sfx name="bass_hit" at={0} volume={0.7} />
      <Sfx name="bass_hit" at={6} volume={0.7} />

      <Sequence from={30} durationInFrames={175}>
        <RaceScene />
      </Sequence>
      <Sfx name="whoosh" at={30} />
      <Sfx name="riser" at={44} volume={0.5} />
      <Sfx name="success" at={76} volume={0.8} />
      <Sfx name="notify" at={100} volume={0.5} />
      <Sfx name="notify" at={160} volume={0.5} />
      {[60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210].map((f) => <Sfx key={f} name="tick" at={f} volume={0.25} />)}
      <Sfx name="pop" at={150} volume={0.6} />
      <Sfx name="clack" at={220} />

      <Sequence from={205} durationInFrames={55}>
        <Slam startFrame={0}>
          <Photo src={PAIRS[0].after} zoomFrom={1} zoomTo={1.06} durationInFrames={55} />
        </Slam>
        <TikTokText lines={["same result."]} top={14} size={76} enterFrame={3} />
        <TikTokText lines={["12 seconds. $0."]} top={23} size={56} enterFrame={18} bg={BRAND} />
      </Sequence>
      <Flash at={205} len={4} />
      <Sfx name="bass_hit_big" at={205} />
      <Sfx name="pop" at={223} volume={0.6} />

      <Sequence from={260} durationInFrames={40}>
        <Photo src={PAIRS[0].after} dim={0.55} zoomFrom={1.06} zoomTo={1.1} durationInFrames={40} />
        <TikTokText lines={["which would", "you pick?"]} top={36} size={72} enterFrame={2} />
        <Url enterFrame={8} />
      </Sequence>
      <Sfx name="pop" at={262} volume={0.6} />
    </AbsoluteFill>
  );
};
