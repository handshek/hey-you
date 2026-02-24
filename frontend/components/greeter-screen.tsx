"use client";

import { motion } from "framer-motion";
import { BotFace } from "@/components/bot-face";
import { VoiceWaveform } from "@/components/voice-waveform";
import { StreamingText } from "@/components/streaming-text";

type GreeterState = "idle" | "detecting" | "speaking";

interface GreeterScreenProps {
  spaceName?: string;
  greetingText?: string;
  botState?: GreeterState;
}

export function GreeterScreen({
  spaceName = "HeyYou",
  greetingText = "",
  botState,
}: GreeterScreenProps) {
  const state: GreeterState = botState
    ? botState
    : greetingText
      ? "speaking"
      : "idle";

  const handleStreamingComplete = () => {
    // Text streaming animation finished
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center min-h-screen bg-[#0C0A09] overflow-hidden"
      id="greeter-screen"
    >
      {/* Ambient background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(251,146,60,0.04) 0%, transparent 60%)",
        }}
      />

      {/* Top-left branding */}
      <motion.div
        className="absolute top-6 left-6 flex items-center gap-2"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <span className="text-amber font-display text-2xl italic">HeyYou</span>
      </motion.div>

      {/* Status indicator */}
      <motion.div
        className="absolute top-6 right-6 flex items-center gap-2"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      >
        <div
          className={`w-2 h-2 rounded-full ${
            state === "idle"
              ? "bg-muted-foreground"
              : state === "detecting"
                ? "bg-amber animate-pulse"
                : "bg-green-400 animate-pulse"
          }`}
        />
        <span className="text-xs text-muted-foreground uppercase tracking-widest">
          {state === "idle"
            ? "Watching"
            : state === "detecting"
              ? "Someone's here"
              : "Greeting"}
        </span>
      </motion.div>

      {/* Streaming text — above bot face */}
      <div className="mb-8 min-h-[80px] flex items-end w-full max-w-2xl px-8">
        {greetingText && (
          <StreamingText
            text={greetingText}
            speed={35}
            onComplete={handleStreamingComplete}
          />
        )}
      </div>

      {/* Bot face — center */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <BotFace state={state} size={220} />
      </motion.div>

      {/* Voice waveform — below bot face */}
      <div className="mt-8">
        <VoiceWaveform isActive={state === "speaking"} />
      </div>

      {/* Bottom space name */}
      <motion.div
        className="absolute bottom-6 left-0 right-0 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 0.4, y: 0 }}
        transition={{ delay: 1, duration: 0.6 }}
      >
        <span className="text-xs text-muted-foreground tracking-[0.2em] uppercase">
          {spaceName}
        </span>
      </motion.div>
    </div>
  );
}
