"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type PointerEvent,
} from "react";
import {
  MotionConfig,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
} from "framer-motion";
import { Icon } from "./StudioIcons";

const MotionPreference = createContext(false);
export function StudioExperience({ children }: { children: ReactNode }) {
  const systemReduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const reduced = paused || !!systemReduced;
  const { scrollYProgress } = useScroll();
  return (
    <MotionPreference.Provider value={reduced}>
      <MotionConfig reducedMotion={reduced ? "always" : "user"}>
        <div className="studio-site" data-motion={reduced ? "off" : "on"}>
          <motion.div
            className="studio-scroll-progress"
            style={{ scaleX: scrollYProgress }}
          />
          {children}
          <button
            className="studio-motion-toggle"
            type="button"
            onClick={() => setPaused(!paused)}
            aria-pressed={paused}
            disabled={!!systemReduced}
            aria-label={
              systemReduced
                ? "Reduced motion follows your device setting"
                : paused
                  ? "Resume animations"
                  : "Pause animations"
            }
          >
            <Icon name={reduced ? "play" : "pause"} width="12" height="12" />
            <span>
              {systemReduced
                ? "Reduced motion"
                : paused
                  ? "Motion paused"
                  : "Pause motion"}
            </span>
          </button>
        </div>
      </MotionConfig>
    </MotionPreference.Provider>
  );
}
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useContext(MotionPreference);
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.7, delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  );
}
export function Tilt({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useContext(MotionPreference);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(x, { stiffness: 180, damping: 22 });
  const rotateY = useSpring(y, { stiffness: 180, damping: 22 });
  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduced || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    x.set((0.5 - (event.clientY - bounds.top) / bounds.height) * 9);
    y.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 9);
  }
  return (
    <motion.div
      className={className}
      onPointerMove={move}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
    >
      {children}
    </motion.div>
  );
}
