"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Avatar, type AvatarState } from "@/components/avatar/Avatar";
import { TypewriterText } from "@/components/greeter-yolo/typewriter-text";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import type {
  ComplimentEntry,
  GreeterBotState,
} from "@/components/greeter-yolo/types";

interface GreeterLiveScreenProps {
  botState: GreeterBotState;
  hasAgent: boolean;
  latestCompliment?: ComplimentEntry;
  complimentCount: number;
  onDisconnect: () => void;
}

export function GreeterLiveScreen({
  botState,
  hasAgent,
  latestCompliment,
  onDisconnect,
}: GreeterLiveScreenProps) {
  const isSpeaking = botState === "speaking";
  const avatarState: AvatarState = botState === "detected" ? "wow" : "idle";

  let visualizerState: AgentState | undefined = undefined;
  if (!hasAgent) {
    visualizerState = "initializing";
  } else if (botState === "looking") {
    visualizerState = "connecting";
  } else if (botState === "detected") {
    visualizerState = "thinking";
  } else if (botState === "speaking") {
    visualizerState = "speaking";
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0C0A09] text-foreground flex flex-col items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {isSpeaking && latestCompliment ? (
          <motion.div
            key="compliment"
            className="relative z-10 flex w-[min(92vw,44rem)] md:w-[clamp(60vw,70vw,80vw)] flex-col items-center justify-center px-5 md:px-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <p className="w-full text-[clamp(2rem,4.6vw,5.3rem)] text-foreground leading-[1.15] text-center break-words font-medium tracking-tight">
              <TypewriterText
                key={latestCompliment.id}
                text={latestCompliment.text}
              />
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="avatar"
            className="relative z-10 flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Avatar state={avatarState} />

            <div className="mt-12 flex justify-center w-full px-4">
              <BarVisualizer
                state={visualizerState}
                barCount={8}
                centerAlign={true}
                demo={true}
                className="bg-transparent! h-28 w-full max-w-sm"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={onDisconnect}
        className="absolute bottom-6 left-6 z-10 px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50 hover:text-red-400 border border-border/20 hover:border-red-400/30 rounded-full transition-colors cursor-pointer backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
      >
        Disconnect
      </motion.button>

      <motion.span
        className="absolute bottom-6 text-amber/20 font-display text-sm italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        HeyYou
      </motion.span>
    </div>
  );
}
