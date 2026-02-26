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
  const [isWowAnimating, setIsWowAnimating] = useState(false);

  // Blink logic: quick blink every 4-5 seconds
  useEffect(() => {
    if (state !== "idle" && state !== "happy") return;

    const triggerBlink = () => {
      setIsBlinking(true);
      setTimeout(() => setIsBlinking(false), 120);
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

  // Wow animation logic: trigger sequence every few seconds
  useEffect(() => {
    if (state !== "wow") return;

    let timeoutId: NodeJS.Timeout;
    let resetTimeoutId: NodeJS.Timeout;

    const triggerWow = () => {
      setIsWowAnimating(true);
      // Sequence reset after it finishes
      resetTimeoutId = setTimeout(() => setIsWowAnimating(false), 2000);

      const delay = Math.random() * 3000 + 3000;
      timeoutId = setTimeout(triggerWow, delay + 2000);
    };

    // Initial trigger after a short delay
    timeoutId = setTimeout(triggerWow, 1000);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(resetTimeoutId);
      setIsWowAnimating(false);
    };
  }, [state]);

  // Determine transition based on whether we are blinking or switching expression
  const isTransitioningExpression = !isBlinking && !isWowAnimating;

  return (
    <motion.svg
      viewBox="-100 -100 879 873"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: size ?? "min(55vh, 55vw)",
        height: size ?? "min(55vh, 55vw)",
        cursor: "pointer",
        overflow: "visible",
      }}
      whileHover={{
        scale: 1.02,
      }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
    >
      <motion.g
        animate={{
          y: [0, -25, 0],
          rotate: [0, 0.5, -0.5, 0],
        }}
        transition={{
          duration: 5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.g
            key={state}
            initial={{
              opacity: 0,
              scale: isTransitioningExpression ? 1.05 : 1,
            }}
            animate={{
              opacity: 1,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              scale: isTransitioningExpression ? 0.95 : 1,
            }}
            transition={{
              duration: isBlinking ? 0.08 : 0.2,
              ease: "easeOut",
            }}
          >
            <Eyes
              state={state}
              isBlinking={isBlinking}
              isWowAnimating={isWowAnimating}
            />
            <Mouth state={state} isWowAnimating={isWowAnimating} />
          </motion.g>
        </AnimatePresence>
      </motion.g>
    </motion.svg>
  );
}
