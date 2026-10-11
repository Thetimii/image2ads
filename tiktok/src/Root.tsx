import React from "react";
import { Composition } from "remotion";
import { RevealFirst, DesignerVsThis, RateThem } from "./Reels";
import { UiDemo, KineticType, TheRace } from "./Motion";
import { FPS, W, H } from "./lib";

const base = { fps: FPS, width: W, height: H };
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="RevealFirst" component={RevealFirst} durationInFrames={360} {...base} />
    <Composition id="DesignerVsThis" component={DesignerVsThis} durationInFrames={315} {...base} />
    <Composition id="RateThem" component={RateThem} durationInFrames={330} {...base} />
    <Composition id="UiDemo" component={UiDemo} durationInFrames={390} {...base} />
    <Composition id="KineticType" component={KineticType} durationInFrames={330} {...base} />
    <Composition id="TheRace" component={TheRace} durationInFrames={300} {...base} />
  </>
);
