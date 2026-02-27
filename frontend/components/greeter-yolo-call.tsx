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
import { Avatar, type AvatarState } from "@/components/avatar/Avatar";
import { GreeterDrawer } from "@/components/greeter-drawer";

const POLL_INTERVAL_MS = 2000;

interface GreeterYoloCallProps {
  spaceId: string;
  spaceName?: string;
  videoInput?: "camera" | "stock";
  stockVideoUrl?: string;
}

interface ComplimentEntry {
  id: number;
  text: string;
  timestamp: Date;
  hasBusinessMention: boolean;
}

interface LogEntry {
  id: number;
  type: "info" | "detection" | "compliment" | "error" | "connection";
  message: string;
  timestamp: Date;
}

/* ─────────────────────────────────────────────
   Typewriter text animation
   ───────────────────────────────────────────── */
function TypewriterText({ text }: { text: string }) {
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (charIndex < text.length) {
      const timeout = setTimeout(() => setCharIndex((prev) => prev + 1), 25);
      return () => clearTimeout(timeout);
    }
  }, [charIndex, text]);

  return (
    <>
      {text.slice(0, charIndex)}
      {charIndex < text.length && (
        <motion.span
          className="inline-block w-0.5 h-8 bg-amber ml-1 align-middle"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   Shared ambient background gradient
   ───────────────────────────────────────────── */
function AmbientBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] opacity-15"
        style={{
          background:
            "radial-gradient(circle at 30% 40%, rgba(245,158,11,0.3), transparent 50%), radial-gradient(circle at 70% 60%, rgba(234,88,12,0.2), transparent 50%)",
        }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Inner component: renders inside StreamCall
   ───────────────────────────────────────────── */
function GreeterYoloInner({
  spaceId,
  compliments,
  addCompliment,
  addLog,
}: {
  spaceId: string;
  compliments: ComplimentEntry[];
  addCompliment: (text: string) => void;
  addLog: (type: LogEntry["type"], message: string) => void;
}) {
  const { useRemoteParticipants } = useCallStateHooks();
  const remoteParticipants = useRemoteParticipants();

  const agentParticipant = remoteParticipants.find(
    (p: StreamVideoParticipant) =>
      p.userId?.includes("heyyou") || p.userId?.includes("agent"),
  );

  const [botState, setBotState] = useState<
    "waiting" | "looking" | "detected" | "speaking" | "idle"
  >("waiting");
  const lastEventIdRef = useRef(-1);
  const wowTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const speakingTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const prevBotStateRef = useRef(botState);

  const hasAgent = Boolean(agentParticipant);
  const agentIsSpeaking = agentParticipant?.isSpeaking ?? false;

  // Poll the HTTP bridge for agent events
  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/agent-events?call_id=${spaceId}&since=${lastEventIdRef.current}`,
        );
        if (!res.ok) return;
        const { events } = await res.json();

        for (const evt of events) {
          lastEventIdRef.current = evt.id;
          if (evt.type === "compliment" && evt.data?.text) {
            addCompliment(evt.data.text);
            addLog("compliment", evt.data.text);

            // Clear pending timeouts from previous compliment cycle
            if (wowTimeoutRef.current) clearTimeout(wowTimeoutRef.current);
            if (speakingTimeoutRef.current)
              clearTimeout(speakingTimeoutRef.current);

            // Brief "detected" (wow) flash, then enter speaking
            setBotState("detected");
            wowTimeoutRef.current = setTimeout(() => {
              setBotState("speaking");
            }, 800);

            // Return to looking after estimated TTS duration
            const durationMs = Math.max(
              4000,
              (evt.data.text.length / 12) * 1000 + 2000,
            );
            speakingTimeoutRef.current = setTimeout(() => {
              setBotState((prev) =>
                prev === "speaking" ? "looking" : prev,
              );
            }, 800 + durationMs);
          } else if (evt.type === "detection") {
            addLog(
              "detection",
              evt.data?.detected ? "Person detected" : "No person in frame",
            );
            // Transition to "detected" only on positive detection while scanning
            if (evt.data?.detected) {
              setBotState((prev) =>
                prev === "looking" || prev === "idle" ? "detected" : prev,
              );
            }
          } else if (evt.type === "info" || evt.type === "error") {
            addLog(evt.type, evt.data?.message || "Unknown event");
          }
        }
      } catch {
        // Polling failure is non-fatal
      }
    };

    addLog("connection", "Polling agent events via HTTP bridge...");
    const interval = setInterval(() => {
      if (active) poll();
    }, POLL_INTERVAL_MS);
    poll();

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [spaceId, addCompliment, addLog]);

  // Drive bot state from agent participant presence + speaking status.
  // IMPORTANT: botState is NOT in deps — prevents the effect from overriding
  // compliment-driven state transitions (detected → speaking → looking cycle).
  useEffect(() => {
    if (!hasAgent) {
      setBotState("waiting");
      return;
    }

    if (agentIsSpeaking) {
      // isSpeaking from Stream SDK — clear wow timeout, go straight to speaking
      if (wowTimeoutRef.current) clearTimeout(wowTimeoutRef.current);
      setBotState("speaking");
    } else {
      // Agent connected but not speaking — only transition from "waiting"
      // Don't override "detected", "speaking", or "looking" — managed by
      // compliment handler timeouts and detection events
      setBotState((prev) => (prev === "waiting" ? "looking" : prev));
    }
  }, [hasAgent, agentIsSpeaking]);

  // Log state transitions
  useEffect(() => {
    if (prevBotStateRef.current === botState) return;
    const prev = prevBotStateRef.current;
    prevBotStateRef.current = botState;

    if (botState === "looking" && prev === "waiting")
      addLog("connection", "Agent connected — YOLO scanning active");
    else if (botState === "detected") addLog("detection", "Person detected!");
    else if (botState === "speaking")
      addLog("info", "Agent is speaking (TTS active)");
    else if (botState === "waiting" && prev !== "waiting")
      addLog("info", "Agent disconnected");
  }, [botState, addLog]);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (wowTimeoutRef.current) clearTimeout(wowTimeoutRef.current);
      if (speakingTimeoutRef.current)
        clearTimeout(speakingTimeoutRef.current);
    };
  }, []);

  // Bind remote audio manually
  useEffect(() => {
    if (!agentParticipant?.audioStream) return;
    const audio = new Audio();
    audio.autoplay = true;
    audio.srcObject = agentParticipant.audioStream;
    audio.play().catch(console.warn);
    return () => {
      audio.srcObject = null;
    };
  }, [agentParticipant?.audioStream]);

  const isSpeaking = botState === "speaking";
  const latestCompliment = compliments[compliments.length - 1];

  const avatarState: AvatarState = botState === "detected" ? "wow" : "idle";

  const stateColor = {
    waiting: "bg-yellow-500/50",
    looking: "bg-blue-400",
    detected: "bg-orange-400",
    speaking: "bg-emerald-400",
    idle: "bg-amber/60",
  };

  const stateLabel = {
    waiting: "Waiting for Agent",
    looking: "Scanning",
    detected: "Person Detected",
    speaking: "Speaking",
    idle: "Idle",
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0C0A09] text-foreground flex flex-col items-center justify-center overflow-hidden">
      <AmbientBackground />

      <AnimatePresence mode="wait">
        {isSpeaking && latestCompliment ? (
          /* ── Compliment display (Avatar hidden) ── */
          <motion.div
            key="compliment"
            className="relative z-10 flex flex-col items-center justify-center px-10 max-w-3xl"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <p className="text-4xl md:text-5xl text-foreground leading-relaxed text-center wrap-break-word font-medium tracking-tight">
              <TypewriterText
                key={latestCompliment.id}
                text={latestCompliment.text}
              />
            </p>
          </motion.div>
        ) : (
          /* ── Avatar display ── */
          <motion.div
            key="avatar"
            className="relative z-10 flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <Avatar state={avatarState} />

            {/* Status bar */}
            <div className="flex items-center gap-2.5 mt-4">
              <motion.div
                className={`w-2 h-2 rounded-full ${stateColor[botState]}`}
                animate={{
                  scale: hasAgent ? [1, 1.3, 1] : 1,
                  opacity: hasAgent ? [1, 0.6, 1] : 0.5,
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className="text-muted-foreground text-[10px] uppercase tracking-widest font-mono">
                {stateLabel[botState]}
              </span>
              {compliments.length > 0 && (
                <span className="text-amber/60 text-[10px] font-mono">
                  · {compliments.length} compliment
                  {compliments.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Contextual hint messages */}
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

      {/* Logo */}
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

/* ─────────────────────────────────────────────
   Main export: handles connection lifecycle
   ───────────────────────────────────────────── */
export function GreeterYoloCall({
  spaceId,
  videoInput = "camera",
  stockVideoUrl,
}: GreeterYoloCallProps) {
  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<ReturnType<
    StreamVideoClient["call"]
  > | null>(null);
  const [status, setStatus] = useState<
    "idle" | "connecting" | "connected" | "error"
  >("idle");

  const [compliments, setCompliments] = useState<ComplimentEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const nextId = useRef(0);

  const addCompliment = useCallback((text: string) => {
    const hasBusinessMention =
      /store|shop|arrivals|collection|inside|check out|browse/i.test(text);
    setCompliments((prev) => [
      ...prev,
      { id: nextId.current++, text, timestamp: new Date(), hasBusinessMention },
    ]);
  }, []);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [
      ...prev,
      { id: nextId.current++, type, message, timestamp: new Date() },
    ]);
  }, []);

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const stockVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const stockVideoStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<ReturnType<StreamVideoClient["call"]> | null>(null);
  const clientRef = useRef<StreamVideoClient | null>(null);

  const publishStockVideo = useCallback(
    async (videoCall: ReturnType<StreamVideoClient["call"]>) => {
      if (!stockVideoUrl) {
        throw new Error("Missing stockVideoUrl for stock video input mode");
      }

      const videoEl = document.createElement("video");
      videoEl.src = stockVideoUrl;
      videoEl.loop = true;
      videoEl.muted = true;
      videoEl.playsInline = true;
      videoEl.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => resolve();
        const onError = () =>
          reject(new Error(`Failed to load stock video: ${stockVideoUrl}`));
        videoEl.addEventListener("loadeddata", onLoaded, { once: true });
        videoEl.addEventListener("error", onError, { once: true });
      });

      await videoEl.play();
      const capture = (
        videoEl as HTMLVideoElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        }
      ).captureStream;
      const mozCapture = (
        videoEl as HTMLVideoElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        }
      ).mozCaptureStream;
      const stream = capture?.call(videoEl) ?? mozCapture?.call(videoEl);

      if (!stream) {
        throw new Error("Browser does not support video captureStream()");
      }

      if (!stream.getVideoTracks().length) {
        throw new Error("Stock video stream has no video track");
      }

      stockVideoElementRef.current = videoEl;
      stockVideoStreamRef.current = stream;

      await videoCall.publishVideoStream(stream);
      addLog("connection", "Publishing stock video stream");
    },
    [stockVideoUrl, addLog],
  );

  const startSession = async () => {
    if (!apiKey) {
      setStatus("error");
      return;
    }

    try {
      const ctx = new AudioContext();
      await ctx.resume();
      addLog("info", `AudioContext unlocked: ${ctx.state}`);
    } catch (e) {
      addLog("error", `AudioContext unlock failed: ${e}`);
    }

    setStatus("connecting");
    addLog("connection", "Connecting to Stream...");

    try {
      const userId = `greeter-yolo-${spaceId}-${Date.now()}`;
      addLog("info", `User: ${userId}`);

      const res = await fetch("/api/stream-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });

      if (!res.ok) throw new Error("Failed to fetch token");
      const { token } = await res.json();
      addLog("connection", "Token acquired");

      const user: User = { id: userId, name: "YOLO Greeter" };
      const videoClient = new StreamVideoClient({ apiKey, user, token });
      setClient(videoClient);
      clientRef.current = videoClient;

      const videoCall = videoClient.call("default", spaceId);
      await videoCall.join({ create: true });
      addLog("connection", `Joined call: ${spaceId}`);

      if (videoInput === "stock") {
        await videoCall.camera.disable().catch(() => undefined);
        await publishStockVideo(videoCall);
      } else {
        await videoCall.camera.enable();
        addLog("connection", "Camera enabled");
      }

      setCall(videoCall);
      callRef.current = videoCall;
      setStatus("connected");
      addLog("connection", "✅ Connected — waiting for agent");
    } catch (err) {
      console.error("Failed to connect:", err);
      addLog("error", `Connection failed: ${err}`);
      setStatus("error");
    }
  };

  useEffect(() => {
    return () => {
      stockVideoElementRef.current?.pause();
      stockVideoElementRef.current = null;
      stockVideoStreamRef.current?.getTracks().forEach((track) => track.stop());
      stockVideoStreamRef.current = null;
      callRef.current?.leave().catch(() => undefined);
      clientRef.current?.disconnectUser().catch(() => undefined);
      callRef.current = null;
      clientRef.current = null;
    };
  }, []);

  // ── Idle ──────────────────────────────────────────────────────────────────
  if (status === "idle") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0C0A09] text-foreground flex flex-col items-center justify-center">
        <AmbientBackground />

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Avatar state="idle" />
        </motion.div>

        <motion.button
          onClick={startSession}
          className="relative z-10 mt-8 px-8 py-3 bg-linear-to-r from-amber to-orange-500 text-black font-semibold rounded-full hover:from-amber/90 hover:to-orange-400 transition-all cursor-pointer shadow-lg shadow-amber/20"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Activate Greeter
        </motion.button>

        {!apiKey && (
          <motion.p
            className="relative z-10 mt-4 text-red-400 text-xs font-mono"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            ⚠ Missing NEXT_PUBLIC_STREAM_API_KEY
          </motion.p>
        )}
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (status === "error") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0C0A09] text-foreground flex flex-col items-center justify-center gap-6">
        <AmbientBackground />

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Avatar state="sad" />
        </motion.div>

        <motion.p
          className="relative z-10 text-muted-foreground text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Failed to connect. Check your Stream API keys.
        </motion.p>

        <motion.button
          onClick={() => setStatus("idle")}
          className="relative z-10 px-6 py-2 border border-amber/30 text-amber rounded-full hover:bg-amber/10 transition-colors cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Try Again
        </motion.button>
      </div>
    );
  }

  // ── Connecting ────────────────────────────────────────────────────────────
  if (status === "connecting" || !client || !call) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0C0A09] text-foreground flex flex-col items-center justify-center gap-6">
        <AmbientBackground />

        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Avatar state="idle" />
        </motion.div>

        <div className="relative z-10 flex items-center gap-3">
          <motion.div
            className="w-4 h-4 border-2 border-amber/30 border-t-amber rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <span className="text-muted-foreground text-sm font-mono">
            Connecting...
          </span>
        </div>
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────
  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <GreeterYoloInner
          spaceId={spaceId}
          compliments={compliments}
          addCompliment={addCompliment}
          addLog={addLog}
        />
        <GreeterDrawer logs={logs} />
      </StreamCall>
    </StreamVideo>
  );
}
