"use client";

import { motion } from "framer-motion";
import { AvatarState } from "./Avatar";

/**
 * Pac-man eyes — both eyes have the wedge effect.
 * Trick: last curve closes to the CENTER of each ellipse instead of the start point.
 * The Z command then draws a straight line back to the start = wedge cutout.
 */
export const EyesPacman = () => (
  <>
    {/* Left eye — closes to center (143) instead of start (223) */}
    <path
      d="M223.302 120C223.302 186.274 187.484 240 143.302 240C99.1188 240 63.3016 186.274 63.3016 120C63.3016 53.7258 99.1188 0 143.302 0C187.484 0 223.302 53.7258 143.302 120Z"
      fill="white"
    />
    {/* Right eye — closes to center (543) instead of start (623) */}
    <path
      d="M623.302 120C623.302 186.274 587.484 240 543.302 240C499.119 240 463.302 186.274 463.302 120C463.302 53.7258 499.119 0 543.302 0C587.484 0 623.302 53.7258 543.302 120Z"
      fill="white"
    />
  </>
);

/** Closed eyelid arcs (v v) */
export const EyesClosed = () => (
  <>
    <path
      d="M75 100 Q 143 185 211 100"
      fill="none"
      stroke="white"
      strokeWidth="28"
      strokeLinecap="round"
    />
    <path
      d="M475 100 Q 543 185 611 100"
      fill="none"
      stroke="white"
      strokeWidth="28"
      strokeLinecap="round"
    />
  </>
);

/** Squinting eyes (- -) */
export const EyesSquinting = () => (
  <>
    <ellipse cx="143" cy="120" rx="80" ry="14" fill="white" />
    <ellipse cx="543" cy="120" rx="80" ry="14" fill="white" />
  </>
);

// Helper to get individual eye paths
const LeftEye = () => (
  <path
    d="M223.302 120C223.302 186.274 187.484 240 143.302 240C99.1188 240 63.3016 186.274 63.3016 120C63.3016 53.7258 99.1188 0 143.302 0C187.484 0 223.302 53.7258 143.302 120Z"
    fill="white"
  />
);

const RightEye = () => (
  <path
    d="M623.302 120C623.302 186.274 587.484 240 543.302 240C499.119 240 463.302 186.274 463.302 120C463.302 53.7258 499.119 0 543.302 0C587.484 0 623.302 53.7258 543.302 120Z"
    fill="white"
  />
);

export function Eyes({
  state,
  isBlinking = false,
  isWowAnimating = false,
}: {
  state: AvatarState;
  isBlinking?: boolean;
  isWowAnimating?: boolean;
}) {
  const isWow = state === "wow";

  return (
    <g>
      {state === "squinting" ? (
        <motion.g
          animate={{ opacity: isBlinking ? 0 : 1 }}
          transition={{ duration: 0.05 }}
        >
          <EyesSquinting />
        </motion.g>
      ) : (
        <>
          {/* Left Eye */}
          <motion.g
            animate={
              isWowAnimating
                ? { y: [0, 44, 0, 0] }
                : { y: 0, opacity: isBlinking ? 0 : 1 }
            }
            transition={
              isWowAnimating
                ? {
                    duration: 3,
                    times: [0, 0.1, 0.2, 1],
                    ease: [0.45, 0.05, 0.55, 0.95],
                  }
                : { duration: 0.1 }
            }
          >
            <LeftEye />
          </motion.g>

          {/* Right Eye */}
          <motion.g
            animate={
              isWowAnimating
                ? { y: [0, 0, 44, 0, 0] }
                : { y: 0, opacity: isBlinking ? 0 : 1 }
            }
            transition={
              isWowAnimating
                ? {
                    duration: 3,
                    times: [0, 0.1, 0.2, 0.3, 1],
                    ease: [0.45, 0.05, 0.55, 0.95],
                  }
                : { duration: 0.1 }
            }
          >
            <RightEye />
          </motion.g>
        </>
      )}

      {/* Blink Layer: Closed lids (only used for non-wow states) */}
      {!isWow && (
        <motion.g
          initial={false}
          animate={{ opacity: isBlinking ? 1 : 0 }}
          transition={{ duration: 0.05 }}
        >
          <EyesClosed />
        </motion.g>
      )}
    </g>
  );
}
