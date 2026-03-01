"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/avatar/Avatar";
import { VoiceWaveform } from "@/components/voice-waveform";
import type { AvatarState } from "@/components/avatar/Avatar";

const COMPLIMENTS = [
  "Oh wow — that red jacket is fire! You're definitely the main character today.",
  "Love the energy you two are bringing in! Matching sneakers? Power move.",
  "Now THAT'S how you accessorize — those earrings are everything.",
  "Group of four?! The squad is looking absolutely unstoppable right now.",
];

type DemoPhase = "idle" | "detecting" | "speaking";

const STATUS_MAP: Record<DemoPhase, { label: string; color: string }> = {
  idle: { label: "Waiting for someone amazing…", color: "bg-muted-foreground" },
  detecting: { label: "Oh! Someone's here!", color: "bg-amber-400" },
  speaking: { label: "Speaking", color: "bg-amber" },
};

const AVATAR_STATE_MAP: Record<DemoPhase, AvatarState> = {
  idle: "idle",
  detecting: "wow",
  speaking: "happy",
};

export function LandingDemo() {
  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  const runCycle = useCallback(() => {
    // Phase 1: idle (3s)
    setPhase("idle");
    setDisplayedText("");
    setIsTyping(false);

    const detectTimer = setTimeout(() => {
      // Phase 2: detecting (2s)
      setPhase("detecting");

      const speakTimer = setTimeout(() => {
        // Phase 3: speaking (~4s for typing)
        setPhase("speaking");
        setIsTyping(true);
      }, 2000);

      return () => clearTimeout(speakTimer);
    }, 3000);

    return () => clearTimeout(detectTimer);
  }, []);

  // Main cycle controller
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cycleTimer: NodeJS.Timeout;

    const startCycle = () => {
      cleanup = runCycle();
      // Total cycle: 3s idle + 2s detect + 5s speak + 1s pause = 11s
      cycleTimer = setTimeout(() => {
        setPhraseIndex((prev) => (prev + 1) % COMPLIMENTS.length);
        startCycle();
      }, 11000);
    };

    startCycle();

    return () => {
      cleanup?.();
      clearTimeout(cycleTimer);
    };
  }, [runCycle]);

  // Typewriter effect
  useEffect(() => {
    if (!isTyping) return;

    const phrase = COMPLIMENTS[phraseIndex];
    let charIndex = 0;
    setDisplayedText("");

    const interval = setInterval(() => {
      charIndex++;
      setDisplayedText(phrase.slice(0, charIndex));
      if (charIndex >= phrase.length) {
        clearInterval(interval);
      }
    }, 35);

    return () => clearInterval(interval);
  }, [isTyping, phraseIndex]);

  const status = STATUS_MAP[phase];

  return (
    <div className="w-full max-w-md">
      {/* Device window frame */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xl shadow-black/40">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>

        {/* Demo content */}
        <div className="flex flex-col items-center px-6 py-8 gap-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
            <motion.div
              className={`w-1.5 h-1.5 rounded-full ${status.color}`}
              animate={{ opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <AnimatePresence mode="wait">
              <motion.span
                key={phase}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2 }}
                className={phase === "speaking" ? "text-amber" : "text-muted-foreground"}
              >
                {status.label}
              </motion.span>
            </AnimatePresence>
          </div>

          {/* Avatar */}
          <div className="w-40 h-40">
            <Avatar state={AVATAR_STATE_MAP[phase]} size={160} />
          </div>

          {/* Streaming text area */}
          <div className="h-16 flex items-center justify-center w-full">
            <AnimatePresence mode="wait">
              {phase === "speaking" && displayedText && (
                <motion.p
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-sm text-center leading-relaxed text-foreground px-2"
                >
                  {displayedText}
                  {displayedText.length < COMPLIMENTS[phraseIndex].length && (
                    <motion.span
                      className="inline-block w-[2px] h-4 bg-amber ml-0.5 align-middle"
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Waveform */}
          <VoiceWaveform isActive={phase === "speaking"} barCount={24} />
        </div>
      </div>
    </div>
  );
}
