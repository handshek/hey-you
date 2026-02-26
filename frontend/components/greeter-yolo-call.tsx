"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  useCallStateHooks,
  User,
  ParticipantView,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import { motion, AnimatePresence } from "framer-motion";

const POLL_INTERVAL_MS = 2000;

interface GreeterYoloCallProps {
  spaceId: string;
  spaceName?: string;
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
   Inner component: renders inside StreamCall
   ───────────────────────────────────────────── */
function GreeterYoloInner({
  spaceId,
  compliments,
  addCompliment,
  logs,
  addLog,
}: {
  spaceId: string;
  compliments: ComplimentEntry[];
  addCompliment: (text: string) => void;
  logs: LogEntry[];
  addLog: (type: LogEntry["type"], message: string) => void;
}) {
  const { useRemoteParticipants } = useCallStateHooks();
  const remoteParticipants = useRemoteParticipants();

  const agentParticipant = remoteParticipants.find(
    (p: StreamVideoParticipant) =>
      p.userId?.includes("heyyou") || p.userId?.includes("agent"),
  );

  const [botState, setBotState] = useState<
    "waiting" | "looking" | "speaking" | "idle"
  >("waiting");
  const [detectionActive, setDetectionActive] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const complimentEndRef = useRef<HTMLDivElement>(null);
  const lastEventIdRef = useRef(-1);

  // Poll the HTTP bridge for agent events (compliments + detections)
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
          } else if (evt.type === "detection") {
            setDetectionActive(Boolean(evt.data?.detected));
            addLog(
              "detection",
              evt.data?.detected ? "Person detected" : "No person in frame",
            );
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
    poll(); // initial poll

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [spaceId, addCompliment, addLog]);

  // Detect agent state
  useEffect(() => {
    if (agentParticipant) {
      if (agentParticipant.isSpeaking) {
        if (botState !== "speaking") {
          setBotState("speaking");
          addLog("info", "Agent is speaking (TTS active)");
        }
      } else {
        if (botState === "waiting") {
          setBotState("looking");
          addLog("connection", "Agent connected — YOLO scanning active");
        } else if (botState === "speaking") {
          setBotState("idle");
        }
      }
    } else {
      if (botState !== "waiting") {
        setBotState("waiting");
        addLog("info", "Agent disconnected");
      }
    }
  }, [agentParticipant, botState, addLog]);

  // Auto-scroll logs and compliments
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  useEffect(() => {
    complimentEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [compliments]);

  const hasAgent = Boolean(agentParticipant);

  const stateColor = {
    waiting: "bg-yellow-500/50",
    looking: "bg-blue-400",
    speaking: "bg-emerald-400",
    idle: "bg-amber/60",
  };

  const stateLabel = {
    waiting: "Waiting for Agent",
    looking: "YOLO Scanning",
    speaking: "Speaking",
    idle: "Idle",
  };

  return (
    <div className="flex h-screen bg-[#0C0A09] text-foreground overflow-hidden">
      {/* ── LEFT PANEL: Video + Status ── */}
      <div className="flex flex-col items-center justify-center w-1/2 p-8 relative">
        {/* Background gradient */}
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

        {/* Stock video display */}
        <div className="relative z-10 mb-6">
          <motion.div
            className="relative w-80 h-56 rounded-2xl overflow-hidden border-2 bg-black/50"
            animate={{
              borderColor:
                botState === "speaking"
                  ? [
                      "rgba(245,158,11,0.8)",
                      "rgba(16,185,129,0.8)",
                      "rgba(245,158,11,0.8)",
                    ]
                  : botState === "looking"
                    ? [
                        "rgba(96,165,250,0.4)",
                        "rgba(96,165,250,0.8)",
                        "rgba(96,165,250,0.4)",
                      ]
                    : "rgba(245,158,11,0.3)",
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {agentParticipant ? (
              <ParticipantView
                participant={agentParticipant}
                trackType="videoTrack"
                muteAudio
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                src="/stock/street_10.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover opacity-50 grayscale"
              />
            )}

            {/* Detection badge */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
              <div
                className={`w-2 h-2 rounded-full ${detectionActive ? "bg-emerald-400" : "bg-red-400/60"}`}
              />
              <span className="text-[10px] font-mono text-white/80 uppercase tracking-wider">
                {detectionActive ? "Person detected" : "No detection"}
              </span>
            </div>

            {/* YOLO label */}
            <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-full">
              <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider">
                YOLO v11 Pose
              </span>
            </div>
          </motion.div>

          {/* Pulse rings when speaking */}
          <AnimatePresence>
            {botState === "speaking" && (
              <>
                {[1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-2xl border border-emerald-400/20"
                    initial={{ scale: 1, opacity: 0.4 }}
                    animate={{ scale: 1.05 + i * 0.04, opacity: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.3,
                      ease: "easeOut",
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Status bar */}
        <div className="relative z-10 flex items-center gap-3 mb-4">
          <motion.div
            className={`w-2.5 h-2.5 rounded-full ${stateColor[botState]}`}
            animate={{
              scale: hasAgent ? [1, 1.3, 1] : 1,
              opacity: hasAgent ? [1, 0.6, 1] : 0.5,
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-muted-foreground text-xs uppercase tracking-widest font-mono">
            {stateLabel[botState]}
          </span>
          {compliments.length > 0 && (
            <span className="text-amber/60 text-xs font-mono">
              · {compliments.length} compliment
              {compliments.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Latest compliment display */}
        <AnimatePresence mode="wait">
          {compliments.length > 0 && (
            <motion.div
              key={compliments[compliments.length - 1].id}
              className="relative z-10 max-w-md px-6 py-4 bg-card/50 backdrop-blur-sm border border-amber/20 rounded-2xl"
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              <p className="text-foreground text-base leading-relaxed text-center">
                <TypewriterText
                  key={compliments[compliments.length - 1].id}
                  text={compliments[compliments.length - 1].text}
                />
              </p>
              {compliments[compliments.length - 1].hasBusinessMention && (
                <div className="mt-2 flex justify-center">
                  <span className="text-[10px] font-mono text-amber/40 uppercase tracking-wider bg-amber/5 px-2 py-0.5 rounded-full">
                    business mention
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {compliments.length === 0 && hasAgent && (
          <motion.p
            className="relative z-10 text-muted-foreground text-sm text-center max-w-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            YOLO is scanning the video feed. Compliments will appear when a
            person is detected...
          </motion.p>
        )}

        {!hasAgent && (
          <motion.p
            className="relative z-10 text-muted-foreground text-sm text-center max-w-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            Waiting for the AI agent to join the call...
          </motion.p>
        )}

        {/* Logo */}
        <motion.span
          className="absolute bottom-6 text-amber/20 font-display text-sm italic"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          HeyYou · YOLO Test
        </motion.span>
      </div>

      {/* ── RIGHT PANEL: Debug Log ── */}
      <div className="w-1/2 flex flex-col border-l border-border/50 bg-[#0A0908]">
        {/* Debug header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 bg-card/30">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="ml-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
              Debug Console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {logs.length} events
            </span>
          </div>
        </div>

        {/* Compliment history */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-5 py-2 border-b border-border/30 bg-card/20">
            <span className="text-[10px] font-mono text-amber/60 uppercase tracking-widest">
              Compliment History
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 min-h-0 max-h-[40vh]">
            {compliments.length === 0 ? (
              <p className="text-muted-foreground/40 text-xs font-mono italic py-4 text-center">
                No compliments yet...
              </p>
            ) : (
              compliments.map((entry) => (
                <motion.div
                  key={entry.id}
                  className="group"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground/40 mt-0.5 shrink-0">
                      {entry.timestamp.toLocaleTimeString("en-US", {
                        hour12: false,
                      })}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/90 leading-relaxed wrap-break-word">
                        {entry.text}
                      </p>
                      {entry.hasBusinessMention && (
                        <span className="inline-block mt-1 text-[9px] font-mono text-amber/40 bg-amber/5 px-1.5 py-0.5 rounded">
                          BIZ
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={complimentEndRef} />
          </div>

          {/* Event log */}
          <div className="px-5 py-2 border-t border-b border-border/30 bg-card/20">
            <span className="text-[10px] font-mono text-blue-400/60 uppercase tracking-widest">
              Event Log
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-2 space-y-1 min-h-0 max-h-[40vh]">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                className="flex items-start gap-2 py-0.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
              >
                <span className="text-[10px] font-mono text-muted-foreground/30 shrink-0">
                  {log.timestamp.toLocaleTimeString("en-US", {
                    hour12: false,
                  })}
                </span>
                <span
                  className={`text-[10px] font-mono shrink-0 uppercase w-12 ${
                    log.type === "error"
                      ? "text-red-400"
                      : log.type === "detection"
                        ? "text-emerald-400"
                        : log.type === "compliment"
                          ? "text-amber"
                          : log.type === "connection"
                            ? "text-blue-400"
                            : "text-muted-foreground/50"
                  }`}
                >
                  {log.type === "compliment" ? "cmpl" : log.type.slice(0, 4)}
                </span>
                <span className="text-xs font-mono text-muted-foreground/70 wrap-break-word min-w-0">
                  {log.type === "compliment"
                    ? log.message.slice(0, 60) +
                      (log.message.length > 60 ? "..." : "")
                    : log.message}
                </span>
              </motion.div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Typewriter text animation
   Uses `key` prop from parent to trigger remount on text change
   ───────────────────────────────────────────── */
function TypewriterText({ text }: { text: string }) {
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (charIndex < text.length) {
      const timeout = setTimeout(() => {
        setCharIndex((prev) => prev + 1);
      }, 25);
      return () => clearTimeout(timeout);
    }
  }, [charIndex, text]);

  const displayedText = text.slice(0, charIndex);

  return (
    <>
      {displayedText}
      {charIndex < text.length && (
        <motion.span
          className="inline-block w-0.5 h-4 bg-amber ml-0.5 align-middle"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   Main export: handles connection + wraps inner
   ───────────────────────────────────────────── */
export function GreeterYoloCall({ spaceId }: GreeterYoloCallProps) {
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
      {
        id: nextId.current++,
        text,
        timestamp: new Date(),
        hasBusinessMention,
      },
    ]);
  }, []);

  const addLog = useCallback((type: LogEntry["type"], message: string) => {
    setLogs((prev) => [
      ...prev,
      {
        id: nextId.current++,
        type,
        message,
        timestamp: new Date(),
      },
    ]);
  }, []);

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

      const user: User = { id: userId, name: "YOLO Test Display" };
      const videoClient = new StreamVideoClient({ apiKey, user, token });
      setClient(videoClient);

      const videoCall = videoClient.call("default", spaceId);
      await videoCall.join({ create: true });
      // Camera stays ON — required for --video-track-override to activate on the agent side.
      // Without a video track from the participant, VLM receives no frames.
      addLog("connection", `Joined call: ${spaceId}`);

      setCall(videoCall);
      setStatus("connected");
      addLog("connection", "✅ Connected — waiting for agent");
    } catch (err) {
      console.error("Failed to connect:", err);
      addLog("error", `Connection failed: ${err}`);
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
        <motion.div
          className="flex items-center gap-2 bg-card/50 border border-border/50 px-3 py-1.5 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            YOLO Test Mode
          </span>
        </motion.div>
        <motion.p
          className="text-muted-foreground text-sm max-w-md text-center leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          This test uses YOLO pose detection to trigger AI compliments. A stock
          video plays locally while the agent processes via{" "}
          <code className="text-amber/60 text-xs bg-card px-1.5 py-0.5 rounded">
            --video-track-override
          </code>
          . Compliments appear as text in the debug panel.
        </motion.p>
        <motion.button
          onClick={startSession}
          className="px-8 py-3 bg-linear-to-r from-amber to-orange-500 text-black font-semibold rounded-full hover:from-amber/90 hover:to-orange-400 transition-all cursor-pointer shadow-lg shadow-amber/20"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Start YOLO Test
        </motion.button>
        {!apiKey && (
          <p className="text-red-400 text-xs font-mono">
            ⚠ Missing NEXT_PUBLIC_STREAM_API_KEY
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
          className="w-10 h-10 border-2 border-blue-400/30 border-t-blue-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <p className="text-muted-foreground text-sm font-mono">
          Connecting to YOLO test session...
        </p>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <GreeterYoloInner
          spaceId={spaceId}
          compliments={compliments}
          addCompliment={addCompliment}
          logs={logs}
          addLog={addLog}
        />
      </StreamCall>
    </StreamVideo>
  );
}
