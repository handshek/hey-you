"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Avatar, type AvatarState } from "@/components/avatar/Avatar";
import { TypewriterText } from "@/components/greeter-yolo/typewriter-text";
import { BarVisualizer, type AgentState } from "@/components/ui/bar-visualizer";
import { LiveWaveform } from "@/components/ui/live-waveform";
import type { GreeterBotState } from "@/components/greeter-yolo/types";

interface GreeterLiveScreenProps {
  botState: GreeterBotState;
  hasAgent: boolean;
  agentAudioStream?: MediaStream | null;
  displayComplimentText?: string | null;
  currentComplimentId?: number | null;
  isComplimentVisible?: boolean;
  revealedWordCount?: number;
}

export function GreeterLiveScreen({
  botState,
  hasAgent,
  agentAudioStream = null,
  displayComplimentText = null,
  currentComplimentId = null,
  isComplimentVisible = false,
  revealedWordCount = 0,
}: GreeterLiveScreenProps) {
  const isSpeaking = botState === "speaking";
  const shouldShowComplimentText =
    isComplimentVisible &&
    typeof displayComplimentText === "string" &&
    displayComplimentText.trim().length > 0;
  const avatarState: AvatarState = botState === "detected" ? "wow" : "idle";

  const shouldShowScanningBars =
    !isComplimentVisible &&
    (!hasAgent || botState === "looking" || botState === "detected");
  const visualizerState: AgentState | undefined = !hasAgent
    ? "initializing"
    : botState === "looking"
      ? "connecting"
      : botState === "detected"
        ? "thinking"
        : undefined;

  return (
    <div className="fixed inset-0 z-50 bg-[#0C0A09] text-foreground flex flex-col items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        {shouldShowComplimentText && displayComplimentText ? (
          <motion.div
            key="compliment"
            className="relative z-10 flex w-[min(92vw,44rem)] md:w-[clamp(60vw,70vw,80vw)] flex-col items-center justify-center px-5 md:px-10"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <p className="w-full text-[clamp(2rem,4.6vw,5.3rem)] text-foreground leading-[1.15] text-center wrap-break-word font-medium tracking-tight">
              <TypewriterText
                key={currentComplimentId ?? displayComplimentText}
                text={displayComplimentText}
                revealedWordCount={revealedWordCount}
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

            {shouldShowScanningBars && (
              <div className="mt-12 flex justify-center w-full px-4">
                <BarVisualizer
                  state={visualizerState}
                  barCount={8}
                  centerAlign={true}
                  demo={true}
                  speedMultiplier={1.5}
                  className="bg-transparent! h-28 w-full max-w-sm"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            key="live-waveform"
            className="absolute bottom-14 left-1/2 z-20 w-[min(90vw,42rem)] -translate-x-1/2"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <LiveWaveform
              active={Boolean(agentAudioStream)}
              processing={!agentAudioStream}
              stream={agentAudioStream}
              useMicrophone={false}
              mode="static"
              height={64}
              barWidth={4}
              barGap={2}
              barRadius={2}
              fadeEdges={true}
              barColor="#f59e0b"
              className="text-amber"
            />
          </motion.div>
        )}
      </AnimatePresence>

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
