"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  useCallStateHooks,
  User,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { motion, AnimatePresence } from "framer-motion";

interface GreeterCallProps {
  spaceId: string;
  spaceName?: string;
}

function GreeterInner() {
  const { useLocalParticipant, useRemoteParticipants } = useCallStateHooks();
  const remoteParticipants = useRemoteParticipants();
  const localParticipant = useLocalParticipant();

  const [botState, setBotState] = useState<
    "waiting" | "looking" | "speaking" | "idle"
  >("waiting");
  const [greetingText, setGreetingText] = useState(
    "Waiting for AI agent to join...",
  );
  const [complimentCount, setComplimentCount] = useState(0);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const videoRef = useRef<HTMLVideoElement>(null);

  // Manage audio for remote participants
  useEffect(() => {
    const currentElements = audioElementsRef.current;

    remoteParticipants.forEach((participant: StreamVideoParticipant) => {
      const sessionId = participant.sessionId;
      if (!sessionId) return;

      if (participant.audioStream) {
        if (!currentElements.has(sessionId)) {
          const audio = new Audio();
          audio.autoplay = true;
          audio.srcObject = participant.audioStream;
          audio
            .play()
            .catch((e: unknown) =>
              console.warn("[HeyYou] Audio play error:", e),
            );
          currentElements.set(sessionId, audio);
          console.log("[HeyYou] Audio bound for", sessionId);
        }
      }
    });

    // Cleanup departed participants
    const activeIds = new Set(
      remoteParticipants
        .map((p: StreamVideoParticipant) => p.sessionId)
        .filter(Boolean),
    );
    currentElements.forEach((audio, id) => {
      if (!activeIds.has(id)) {
        audio.srcObject = null;
        currentElements.delete(id);
      }
    });
  }, [remoteParticipants]);

  // Attach local video
  useEffect(() => {
    if (localParticipant?.videoStream && videoRef.current) {
      videoRef.current.srcObject = localParticipant.videoStream;
    }
  }, [localParticipant?.videoStream]);

  // Detect agent state: connected, speaking, idle
  useEffect(() => {
    const agentParticipant = remoteParticipants.find(
      (p: StreamVideoParticipant) =>
        p.userId?.includes("heyyou") || p.userId?.includes("agent"),
    );

    if (agentParticipant) {
      if (agentParticipant.isSpeaking) {
        if (botState !== "speaking") {
          setBotState("speaking");
          setGreetingText("✨ Listen to your compliment!");
          setComplimentCount((c) => c + 1);
        }
      } else {
        // Agent is connected but not speaking
        if (botState === "waiting") {
          setBotState("looking");
          setGreetingText("AI is looking at you...");
        } else if (botState === "speaking") {
          setBotState("idle");
          setGreetingText("Say something or tap below for another compliment!");
        }
      }
    } else {
      if (botState !== "waiting") {
        setBotState("waiting");
        setGreetingText("Waiting for AI agent to join...");
      }
    }
  }, [remoteParticipants, botState]);

  const handleComplimentAgain = useCallback(() => {
    setBotState("looking");
    setGreetingText("Next compliment coming soon... ✨");

    // Reset to idle after a few seconds
    setTimeout(() => {
      setBotState((prev) => (prev === "looking" ? "idle" : prev));
      setGreetingText((prev) =>
        prev.includes("coming soon") ? "A new compliment is on its way!" : prev,
      );
    }, 5000);
  }, []);

  const hasAgent = remoteParticipants.some(
    (p: StreamVideoParticipant) =>
      p.userId?.includes("heyyou") || p.userId?.includes("agent"),
  );

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#0C0A09] overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-20"
          style={{
            background:
              "radial-gradient(circle at 30% 40%, rgba(245,158,11,0.3), transparent 50%), radial-gradient(circle at 70% 60%, rgba(234,88,12,0.2), transparent 50%)",
          }}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: 120,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {/* Camera feed */}
      <div className="relative z-10 mb-8">
        <motion.div
          className="relative w-72 h-72 rounded-full overflow-hidden border-4 border-amber/30"
          animate={{
            borderColor:
              botState === "speaking"
                ? [
                    "rgba(245,158,11,0.8)",
                    "rgba(234,88,12,0.8)",
                    "rgba(245,158,11,0.8)",
                  ]
                : botState === "looking"
                  ? [
                      "rgba(245,158,11,0.4)",
                      "rgba(245,158,11,0.8)",
                      "rgba(245,158,11,0.4)",
                    ]
                  : "rgba(245,158,11,0.3)",
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />

          {/* Scanning overlay */}
          <AnimatePresence>
            {botState === "looking" && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber/60 to-transparent"
                  animate={{ top: ["0%", "100%", "0%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pulse rings when speaking */}
        <AnimatePresence>
          {botState === "speaking" && (
            <>
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-amber/30"
                  initial={{ scale: 1, opacity: 0.5 }}
                  animate={{ scale: 1.2 + i * 0.15, opacity: 0 }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.4,
                    ease: "easeOut",
                  }}
                />
              ))}
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Status indicator */}
      <motion.div
        className="relative z-10 flex items-center gap-2 mb-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.div
          className={`w-2.5 h-2.5 rounded-full ${
            hasAgent ? "bg-emerald-400" : "bg-amber/50"
          }`}
          animate={{
            scale: hasAgent ? [1, 1.3, 1] : 1,
            opacity: hasAgent ? [1, 0.6, 1] : 0.5,
          }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <span className="text-muted-foreground text-xs uppercase tracking-widest">
          {hasAgent ? "Agent Connected" : "Waiting for Agent"}
        </span>
      </motion.div>

      {/* Greeting text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={greetingText}
          className="relative z-10 text-foreground text-xl font-medium text-center max-w-md px-6 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.4 }}
        >
          {greetingText}
        </motion.p>
      </AnimatePresence>

      {/* Compliment counter */}
      {complimentCount > 0 && (
        <motion.p
          className="relative z-10 text-muted-foreground text-xs mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {complimentCount} compliment{complimentCount !== 1 ? "s" : ""} given
        </motion.p>
      )}

      {/* Compliment Again button */}
      {hasAgent && botState !== "waiting" && (
        <motion.button
          className="relative z-10 px-8 py-3 bg-gradient-to-r from-amber to-orange-500 text-black font-semibold rounded-full hover:from-amber/90 hover:to-orange-400 transition-all cursor-pointer shadow-lg shadow-amber/20 disabled:opacity-50 disabled:cursor-not-allowed"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleComplimentAgain}
          disabled={botState === "looking"}
        >
          {botState === "looking" ? "Looking..." : "✨ Compliment Me Again"}
        </motion.button>
      )}

      {/* Logo */}
      <motion.span
        className="absolute bottom-8 text-amber/30 font-display text-sm italic"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        HeyYou
      </motion.span>
    </div>
  );
}

export function GreeterCall({ spaceId }: GreeterCallProps) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<ReturnType<
    StreamVideoClient["call"]
  > | null>(null);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

  const startSession = async () => {
    if (!apiKey) {
      setStatus("error");
      return;
    }

    // Unlock browser audio on user click
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      console.log("[HeyYou] AudioContext unlocked:", ctx.state);
    } catch (e) {
      console.warn("[HeyYou] AudioContext unlock failed:", e);
    }

    setStatus("connecting");

    try {
      const userId = `greeter-${spaceId}-${Date.now()}`;
      console.log("[HeyYou] Fetching token for user:", userId);

      const res = await fetch("/api/stream-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!res.ok) throw new Error("Failed to fetch token");
      const { token } = await res.json();

      const user: User = { id: userId, name: "Greeter Display" };
      const videoClient = new StreamVideoClient({ apiKey, user, token });
      setClient(videoClient);

      const videoCall = videoClient.call("default", spaceId);
      await videoCall.join({ create: true });
      console.log("[HeyYou] Joined call successfully!");

      await videoCall.camera.enable();
      // Mic disabled — agent doesn't use STT, prevents echo loop
      console.log("[HeyYou] Camera enabled (mic off — no echo loop)");

      setCall(videoCall);
      setStatus("connected");
    } catch (err) {
      console.error("Failed to connect:", err);
      setStatus("error");
    }
  };

  if (status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0C0A09] text-foreground gap-6">
        <motion.span
          className="text-amber font-display text-5xl italic"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          HeyYou
        </motion.span>
        <motion.p
          className="text-muted-foreground text-sm max-w-sm text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Click to start the greeter. Your camera will be shared with the AI
          agent for personalized compliments.
        </motion.p>
        <motion.button
          onClick={startSession}
          className="px-8 py-3 bg-gradient-to-r from-amber to-orange-500 text-black font-semibold rounded-full hover:from-amber/90 hover:to-orange-400 transition-all cursor-pointer shadow-lg shadow-amber/20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Start Greeter
        </motion.button>
        {!apiKey && (
          <p className="text-red-400 text-xs">
            Missing NEXT_PUBLIC_STREAM_API_KEY
          </p>
        )}
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0C0A09] text-foreground gap-4">
        <p className="text-muted-foreground text-sm">
          Failed to connect. Check your Stream API keys and try again.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="px-6 py-2 border border-amber/30 text-amber rounded-full hover:bg-amber/10 transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    );
  }

  if (status === "connecting" || !client || !call) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0C0A09] text-foreground gap-4">
        <motion.div
          className="w-10 h-10 border-2 border-amber/30 border-t-amber rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <p className="text-muted-foreground text-sm">
          Connecting to greeter session...
        </p>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <GreeterInner />
      </StreamCall>
    </StreamVideo>
  );
}
