"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  useCallStateHooks,
  ParticipantView,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import {
  Drawer,
  DrawerPortal,
  DrawerTrigger,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerTerminal01Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: number;
  type: "info" | "detection" | "compliment" | "error" | "connection";
  message: string;
  timestamp: Date;
}

/* ─────────────────────────────────────────────
   Self-contained debug drawer
   Must be rendered inside <StreamCall> context
   ───────────────────────────────────────────── */
export function GreeterDrawer({ logs }: { logs: LogEntry[] }) {
  const { useRemoteParticipants } = useCallStateHooks();
  const remoteParticipants = useRemoteParticipants();

  const agentParticipant = remoteParticipants.find(
    (p: StreamVideoParticipant) =>
      p.userId?.includes("heyyou") || p.userId?.includes("agent"),
  );

  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <Drawer direction="right" modal={false}>
      {/* Gear icon — floats above the greeter view */}
      <DrawerTrigger asChild>
        <button className="fixed top-4 right-4 z-60 p-2.5 rounded-full bg-card/50 border border-border/30 hover:bg-card/80 transition-colors backdrop-blur-sm cursor-pointer flex items-center justify-center">
          <HugeiconsIcon
            icon={ComputerTerminal01Icon}
            size={18}
            className="text-muted-foreground"
          />
        </button>
      </DrawerTrigger>

      {/* Render content without overlay (non-modal) */}
      <DrawerPortal>
        <DrawerPrimitive.Content
          className={cn(
            "fixed inset-y-0 right-0 z-60 flex flex-col",
            "w-3/4 sm:max-w-md",
            "bg-[#0A0908] border-l border-border/50",
          )}
        >
          <DrawerHeader className="border-b border-border/30 shrink-0 flex flex-row items-center justify-between">
            <DrawerTitle className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
              Debug Console
            </DrawerTitle>
            <DrawerClose asChild>
              <button className="p-1.5 hover:bg-white/5 rounded-md transition-colors cursor-pointer text-muted-foreground/50 hover:text-muted-foreground">
                <HugeiconsIcon icon={Cancel01Icon} size={16} />
              </button>
            </DrawerClose>
          </DrawerHeader>

          {/* ── YOLO Video Feed ── */}
          <div className="p-4 border-b border-border/20 shrink-0">
            <p className="text-[10px] font-mono text-blue-400/60 uppercase tracking-widest mb-2">
              YOLO Video Feed
            </p>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black/50 border border-border/30">
              {agentParticipant?.videoStream ? (
                <ParticipantView
                  participant={agentParticipant}
                  trackType="videoTrack"
                  muteAudio
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                  <p className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-wider">
                    Waiting for YOLO stream
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Event Log ── */}
          <div className="flex flex-col flex-1 min-h-0 p-4">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <p className="text-[10px] font-mono text-blue-400/60 uppercase tracking-widest">
                Event Log
              </p>
              <span className="text-[10px] font-mono text-muted-foreground/40">
                {logs.length} events
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
              {logs.length === 0 ? (
                <p className="text-[10px] font-mono text-muted-foreground/30 italic py-4 text-center">
                  No events yet...
                </p>
              ) : (
                logs.map((log) => (
                  <motion.div
                    key={log.id}
                    className="flex items-start gap-2 py-0.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                  >
                    <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0">
                      {log.timestamp.toLocaleTimeString("en-US", {
                        hour12: false,
                      })}
                    </span>
                    <span
                      className={`text-[9px] font-mono shrink-0 uppercase w-10 ${
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
                      {log.type === "compliment"
                        ? "cmpl"
                        : log.type.slice(0, 4)}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground/70 wrap-break-word min-w-0 flex-1">
                      {log.type === "compliment"
                        ? log.message.slice(0, 80) +
                          (log.message.length > 80 ? "..." : "")
                        : log.message}
                    </span>
                  </motion.div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
