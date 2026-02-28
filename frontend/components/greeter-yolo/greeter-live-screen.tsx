"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Avatar, type AvatarState } from "@/components/avatar/Avatar";
import { TypewriterText } from "@/components/greeter-yolo/typewriter-text";
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

const STATE_COLOR: Record<GreeterBotState, string> = {
  waiting: "bg-yellow-500/50",
  looking: "bg-blue-400",
  detected: "bg-orange-400",
  speaking: "bg-emerald-400",
  idle: "bg-amber/60",
};

const STATE_LABEL: Record<GreeterBotState, string> = {
  waiting: "Waiting for Agent",
  looking: "Scanning",
  detected: "Person Detected",
  speaking: "Speaking",
  idle: "Idle",
};

export function GreeterLiveScreen({
  botState,
  hasAgent,
  latestCompliment,
  complimentCount,
  onDisconnect,
}: GreeterLiveScreenProps) {
  const isSpeaking = botState === "speaking";
  const avatarState: AvatarState = botState === "detected" ? "wow" : "idle";

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
              <TypewriterText key={latestCompliment.id} text={latestCompliment.text} />
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

            <div className="flex items-center gap-2.5 mt-4">
              <motion.div
                className={`w-2 h-2 rounded-full ${STATE_COLOR[botState]}`}
                animate={{
                  scale: hasAgent ? [1, 1.3, 1] : 1,
                  opacity: hasAgent ? [1, 0.6, 1] : 0.5,
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-muted-foreground text-[10px] uppercase tracking-widest font-mono">
                {STATE_LABEL[botState]}
              </span>
              {complimentCount > 0 && (
                <span className="text-amber/60 text-[10px] font-mono">
                  {" - "}
                  {complimentCount} compliment{complimentCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            <AnimatePresence mode="wait">
              {!hasAgent && (
                <motion.p
                  key="no-agent"
                  className="text-muted-foreground text-sm text-center max-w-sm mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Waiting for the AI agent to join...
                </motion.p>
              )}
              {hasAgent && botState === "looking" && (
                <motion.p
                  key="scanning"
                  className="text-muted-foreground text-sm text-center max-w-sm mt-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  Scanning for visitors...
                </motion.p>
              )}
            </AnimatePresence>
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
