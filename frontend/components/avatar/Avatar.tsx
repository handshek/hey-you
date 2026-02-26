"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { Eyes } from "./Eyes";
import { Mouth } from "./Mouth";
export type AvatarState = "idle" | "happy" | "wow" | "sad" | "squinting";

export function Avatar({
  state = "idle",
  size,
}: {
  state?: AvatarState;
  size?: number;
}) {
  const [isBlinking, setIsBlinking] = useState(false);

  // Blink logic: quick blink every 4-5 seconds
  useEffect(() => {
    // We only blink during idle or happy (squinting is semi-closed already)
    if (state !== "idle" && state !== "happy") return;

    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 120); // Quick sharp blink
    };

    const scheduleNextBlink = () => {
      const delay = Math.random() * 3000 + 3000;
      return setTimeout(() => {
        triggerBlink();
        timeoutId = scheduleNextBlink();
      }, delay);
    };

    let timeoutId = scheduleNextBlink();
    return () => clearTimeout(timeoutId);
  }, [state]);

  // Determine transition based on whether we are blinking or switching expression
  const isTransitioningExpression = !isBlinking;

  return (
    <motion.svg
      viewBox="0 0 679 673"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: size ?? "min(55vh, 55vw)",
        height: size ?? "min(55vh, 55vw)",
      }}
    >
      <AnimatePresence mode="wait">
        <motion.g
          key={state}
          initial={{
            opacity: 0.4,
            scale: isTransitioningExpression ? 1.05 : 1,
            filter: "brightness(2)",
          }}
          animate={{
            opacity: 1,
            scale: 1,
            filter: "brightness(1)",
          }}
          exit={{
            opacity: 0.4,
            scale: isTransitioningExpression ? 0.95 : 1,
            filter: "brightness(1.5)",
          }}
          transition={{
            duration: isBlinking ? 0.08 : 0.2, // Blinking is faster than expression morphing
            ease: "easeOut",
          }}
        >
          <Eyes state={state} isBlinking={isBlinking} />
          <Mouth state={state} />
        </motion.g>
      </AnimatePresence>
    </motion.svg>
  );
}
