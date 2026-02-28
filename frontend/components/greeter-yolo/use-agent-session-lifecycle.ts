"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { StreamVideoClient, type User } from "@stream-io/video-react-sdk";
import {
  AGENT_JOIN_DEADLINE_MS,
  AGENT_LOG_MODE,
  AGENT_READY_DEADLINE_MS,
  AGENT_RETRY_BASE_DELAYS_MS,
  AGENT_RETRY_JITTER_MS,
  AGENT_STARTUP_V2_ENABLED,
  AGENT_TRANSIENT_LEAVE_GRACE_MS,
  MAX_AGENT_START_ATTEMPTS,
} from "@/components/greeter-yolo/constants";
import type {
  AddLogFn,
  AgentCustomEventPayload,
  AgentSessionStatusResponse,
  AgentStartResponse,
  AgentStopResponse,
  GreeterCallStatus,
  StartupLifecycle,
  StreamVideoCall,
} from "@/components/greeter-yolo/types";

interface UseAgentSessionLifecycleParams {
  spaceId: string;
  videoInput: "camera" | "stock";
  stockVideoUrl?: string;
  addLog: AddLogFn;
}

export function useAgentSessionLifecycle({
  spaceId,
  videoInput,
  stockVideoUrl,
  addLog,
}: UseAgentSessionLifecycleParams) {
  const isDemoMode = videoInput === "stock";

  const [client, setClient] = useState<StreamVideoClient | null>(null);
  const [call, setCall] = useState<StreamVideoCall | null>(null);
  const [activeCallId, setActiveCallId] = useState(spaceId);
  const [status, setStatus] = useState<GreeterCallStatus>("idle");

  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  const stockVideoElementRef = useRef<HTMLVideoElement | null>(null);
  const stockVideoStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<StreamVideoCall | null>(null);
  const clientRef = useRef<StreamVideoClient | null>(null);

  const activeCallIdRef = useRef(spaceId);
  const localCallingStateRef = useRef("unknown");
  const startupLifecycleRef = useRef<StartupLifecycle>("idle");
  const startupTimelineRef = useRef<string[]>([]);
  const startupTimelineFlushedRef = useRef(false);

  const agentSessionIdRef = useRef<string | null>(null);
  const agentSessionExpectedRef = useRef(false);
  const agentSeenThisAttemptRef = useRef(false);
  const agentReadyRef = useRef(false);
  const agentStartAttemptRef = useRef(0);
  const agentStartInFlightRef = useRef(false);
  const shutdownInProgressRef = useRef(false);

  const pendingRecoveryReasonRef = useRef<string | null>(null);
  const agentJoinTimerRef = useRef<NodeJS.Timeout | null>(null);
  const agentReadyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const agentTransientLeaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const agentRecoveryTimerRef = useRef<NodeJS.Timeout | null>(null);

  const requestRecoveryRef = useRef<(reason: string) => void>(() => undefined);
  const startAgentSessionRef = useRef<(reason: string) => Promise<void>>(
    async () => undefined,
  );

  const formatStartupContext = useCallback((reason?: string) => {
    const reasonPart = reason ? ` reason=${reason}` : "";
    return `call_id=${activeCallIdRef.current} attempt=${agentStartAttemptRef.current}/${MAX_AGENT_START_ATTEMPTS} session_id=${agentSessionIdRef.current ?? "none"} lifecycle=${startupLifecycleRef.current}${reasonPart}`;
  }, []);

  const addStartupLog = useCallback(
    (type: "info" | "detection" | "compliment" | "error" | "connection", message: string, reason?: string) => {
      if (AGENT_LOG_MODE === "debug") {
        addLog(type, `[startup] ${message} (${formatStartupContext(reason)})`);
      } else if (type === "error" || type === "connection") {
        addLog(type, message);
      }
    },
    [addLog, formatStartupContext],
  );

  const pushStartupTimeline = useCallback((entry: string) => {
    const stamp = new Date().toISOString().slice(11, 19);
    startupTimelineRef.current.push(`${stamp} ${entry}`);
    if (startupTimelineRef.current.length > 30) {
      startupTimelineRef.current = startupTimelineRef.current.slice(-30);
    }
  }, []);

  const flushStartupTimeline = useCallback(
    (outcome: "success" | "failure") => {
      if (startupTimelineFlushedRef.current) return;
      startupTimelineFlushedRef.current = true;
      const timeline = startupTimelineRef.current.join(" -> ");
      addLog(
        outcome === "success" ? "connection" : "error",
        `[startup] timeline(${outcome}) ${timeline || "no-events"}`,
      );
    },
    [addLog],
  );

  const transitionStartupLifecycle = useCallback(
    (next: StartupLifecycle, reason: string) => {
      if (startupLifecycleRef.current === next) return;
      startupLifecycleRef.current = next;
      pushStartupTimeline(`${next}:${reason}`);
      addStartupLog("connection", `Lifecycle -> ${next}`, reason);
    },
    [addStartupLog, pushStartupTimeline],
  );

  const clearAgentJoinTimer = useCallback(() => {
    if (!agentJoinTimerRef.current) return;
    clearTimeout(agentJoinTimerRef.current);
    agentJoinTimerRef.current = null;
  }, []);

  const clearAgentReadyTimer = useCallback(() => {
    if (!agentReadyTimerRef.current) return;
    clearTimeout(agentReadyTimerRef.current);
    agentReadyTimerRef.current = null;
  }, []);

  const clearAgentTransientLeaveTimer = useCallback(() => {
    if (!agentTransientLeaveTimerRef.current) return;
    clearTimeout(agentTransientLeaveTimerRef.current);
    agentTransientLeaveTimerRef.current = null;
  }, []);

  const clearAgentRecoveryTimer = useCallback(() => {
    if (!agentRecoveryTimerRef.current) return;
    clearTimeout(agentRecoveryTimerRef.current);
    agentRecoveryTimerRef.current = null;
  }, []);

  const clearStartupTimers = useCallback(() => {
    clearAgentJoinTimer();
    clearAgentReadyTimer();
    clearAgentTransientLeaveTimer();
    clearAgentRecoveryTimer();
  }, [
    clearAgentJoinTimer,
    clearAgentReadyTimer,
    clearAgentTransientLeaveTimer,
    clearAgentRecoveryTimer,
  ]);

  const isRecoveryBlockedByCallState = useCallback(() => {
    return (
      localCallingStateRef.current === "reconnecting" ||
      localCallingStateRef.current === "offline"
    );
  }, []);

  const markStartupReady = useCallback(
    (trigger: string) => {
      if (agentReadyRef.current) return;
      agentReadyRef.current = true;
      pendingRecoveryReasonRef.current = null;
      clearStartupTimers();
      transitionStartupLifecycle("ready", trigger);
      addStartupLog("connection", "Agent readiness confirmed", trigger);
      flushStartupTimeline("success");
    },
    [
      addStartupLog,
      clearStartupTimers,
      flushStartupTimeline,
      transitionStartupLifecycle,
    ],
  );

  const markStartupFailed = useCallback(
    (reason: string) => {
      agentReadyRef.current = false;
      pendingRecoveryReasonRef.current = null;
      clearStartupTimers();
      transitionStartupLifecycle("failed", reason);
      addStartupLog("error", "Agent startup failed", reason);
      flushStartupTimeline("failure");
    },
    [
      addStartupLog,
      clearStartupTimers,
      flushStartupTimeline,
      transitionStartupLifecycle,
    ],
  );

  const publishStockVideo = useCallback(
    async (videoCall: StreamVideoCall) => {
      if (!stockVideoUrl) {
        throw new Error("Missing stockVideoUrl for stock video input mode");
      }

      const videoElement = document.createElement("video");
      videoElement.src = stockVideoUrl;
      videoElement.loop = true;
      videoElement.muted = true;
      videoElement.playsInline = true;
      videoElement.crossOrigin = "anonymous";

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => resolve();
        const onError = () =>
          reject(new Error(`Failed to load stock video: ${stockVideoUrl}`));
        videoElement.addEventListener("loadeddata", onLoaded, { once: true });
        videoElement.addEventListener("error", onError, { once: true });
      });

      await videoElement.play();
      const capture = (
        videoElement as HTMLVideoElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        }
      ).captureStream;
      const mozCapture = (
        videoElement as HTMLVideoElement & {
          captureStream?: () => MediaStream;
          mozCaptureStream?: () => MediaStream;
        }
      ).mozCaptureStream;
      const stream = capture?.call(videoElement) ?? mozCapture?.call(videoElement);

      if (!stream) {
        throw new Error("Browser does not support video captureStream()");
      }

      if (!stream.getVideoTracks().length) {
        throw new Error("Stock video stream has no video track");
      }

      stockVideoElementRef.current = videoElement;
      stockVideoStreamRef.current = stream;

      await videoCall.publishVideoStream(stream);
      addLog("connection", "Publishing stock video stream");
    },
    [stockVideoUrl, addLog],
  );

  const getAgentSessionStatus = useCallback(
    async (sessionId: string): Promise<AgentSessionStatusResponse> => {
      try {
        const res = await fetch(
          `/api/agent-session/${encodeURIComponent(sessionId)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );
        const payload = (await res.json()) as AgentSessionStatusResponse;
        return payload;
      } catch (error) {
        return {
          status: "error",
          detail: `Failed to query session status: ${error}`,
        };
      }
    },
    [],
  );

  const stopAgentSessionById = useCallback(
    async (sessionId: string): Promise<AgentStopResponse> => {
      try {
        const res = await fetch("/api/agent-session/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionId }),
        });

        const payload = (await res.json()) as AgentStopResponse;
        return payload;
      } catch (error) {
        return {
          status: "error",
          detail: `Failed to stop agent session: ${error}`,
        };
      }
    },
    [],
  );

  const closeTrackedSessionWithVerification = useCallback(
    async (sessionId: string, reason: string) => {
      addStartupLog(
        "connection",
        `Hard-stopping stale session ${sessionId}`,
        reason,
      );
      const firstStop = await stopAgentSessionById(sessionId);

      if (firstStop.status === "error") {
        addStartupLog(
          "error",
          `Initial stop failed: ${firstStop.detail ?? "unknown error"}`,
          reason,
        );
      }

      const firstStatus = await getAgentSessionStatus(sessionId);
      if (firstStatus.status === "not_found") {
        addStartupLog("connection", `Session ${sessionId} is closed`, reason);
        if (agentSessionIdRef.current === sessionId) {
          agentSessionIdRef.current = null;
        }
        return true;
      }

      if (firstStatus.status === "running") {
        addStartupLog(
          "connection",
          `Session ${sessionId} still running after first stop; retrying close`,
          reason,
        );
        const secondStop = await stopAgentSessionById(sessionId);
        if (secondStop.status === "error") {
          addStartupLog(
            "error",
            `Second stop failed: ${secondStop.detail ?? "unknown error"}`,
            reason,
          );
        }

        const secondStatus = await getAgentSessionStatus(sessionId);
        if (secondStatus.status === "not_found") {
          addStartupLog(
            "connection",
            `Session ${sessionId} closed after second stop`,
            reason,
          );
          if (agentSessionIdRef.current === sessionId) {
            agentSessionIdRef.current = null;
          }
          return true;
        }

        addStartupLog(
          "error",
          `Session ${sessionId} still running after two stop attempts`,
          reason,
        );
        return false;
      }

      addStartupLog(
        "error",
        `Session status check failed: ${firstStatus.detail ?? "unknown"}`,
        reason,
      );
      return false;
    },
    [addStartupLog, getAgentSessionStatus, stopAgentSessionById],
  );

  const performRecovery = useCallback(
    async (reason: string) => {
      if (shutdownInProgressRef.current) return;
      if (isRecoveryBlockedByCallState()) {
        pendingRecoveryReasonRef.current = reason;
        addStartupLog(
          "connection",
          "Recovery deferred while local call is reconnecting/offline",
          reason,
        );
        return;
      }

      const trackedSessionId = agentSessionIdRef.current;
      if (trackedSessionId) {
        await closeTrackedSessionWithVerification(trackedSessionId, reason);
      }

      await startAgentSessionRef.current(`retry: ${reason}`);
    },
    [
      addStartupLog,
      closeTrackedSessionWithVerification,
      isRecoveryBlockedByCallState,
    ],
  );

  const requestRecovery = useCallback(
    (reason: string) => {
      if (shutdownInProgressRef.current) return;
      if (agentReadyRef.current) return;

      clearAgentJoinTimer();
      clearAgentReadyTimer();
      clearAgentTransientLeaveTimer();
      pendingRecoveryReasonRef.current = reason;

      if (agentStartAttemptRef.current >= MAX_AGENT_START_ATTEMPTS) {
        markStartupFailed(
          `Recovery exhausted after ${MAX_AGENT_START_ATTEMPTS} attempts`,
        );
        return;
      }

      if (agentStartInFlightRef.current) {
        addStartupLog(
          "connection",
          "Recovery queued while start request is in-flight",
          reason,
        );
        return;
      }

      if (agentRecoveryTimerRef.current) {
        addStartupLog("connection", "Recovery already scheduled", reason);
        return;
      }

      if (isRecoveryBlockedByCallState()) {
        addStartupLog(
          "connection",
          "Recovery deferred until local call returns to joined",
          reason,
        );
        return;
      }

      transitionStartupLifecycle("recovering", reason);
      const retryIndex = Math.max(0, agentStartAttemptRef.current - 1);
      const baseDelay =
        AGENT_RETRY_BASE_DELAYS_MS[
          Math.min(retryIndex, AGENT_RETRY_BASE_DELAYS_MS.length - 1)
        ];
      const jitter = Math.floor(Math.random() * (AGENT_RETRY_JITTER_MS + 1));
      const delayMs = baseDelay + jitter;

      addStartupLog(
        "connection",
        `Scheduling recovery in ${(delayMs / 1000).toFixed(2)}s`,
        reason,
      );
      pushStartupTimeline(`retry_in_${delayMs}ms:${reason}`);

      agentRecoveryTimerRef.current = setTimeout(() => {
        agentRecoveryTimerRef.current = null;
        const pending = pendingRecoveryReasonRef.current ?? reason;
        pendingRecoveryReasonRef.current = null;
        void performRecovery(pending);
      }, delayMs);
    },
    [
      addStartupLog,
      clearAgentJoinTimer,
      clearAgentReadyTimer,
      clearAgentTransientLeaveTimer,
      isRecoveryBlockedByCallState,
      markStartupFailed,
      performRecovery,
      pushStartupTimeline,
      transitionStartupLifecycle,
    ],
  );
  requestRecoveryRef.current = requestRecovery;

  const armAgentJoinDeadline = useCallback(
    (reason: string) => {
      if (agentJoinTimerRef.current) return;
      if (!agentSessionExpectedRef.current || agentReadyRef.current) return;

      addStartupLog(
        "connection",
        `Monitoring agent join for ${AGENT_JOIN_DEADLINE_MS / 1000}s`,
        reason,
      );
      agentJoinTimerRef.current = setTimeout(() => {
        agentJoinTimerRef.current = null;
        requestRecoveryRef.current(reason);
      }, AGENT_JOIN_DEADLINE_MS);
    },
    [addStartupLog],
  );

  const armAgentReadyDeadline = useCallback(
    (reason: string) => {
      if (agentReadyTimerRef.current) return;
      if (!agentSessionExpectedRef.current || agentReadyRef.current) return;

      addStartupLog(
        "connection",
        `Monitoring agent readiness for ${AGENT_READY_DEADLINE_MS / 1000}s`,
        reason,
      );
      agentReadyTimerRef.current = setTimeout(() => {
        agentReadyTimerRef.current = null;
        requestRecoveryRef.current(reason);
      }, AGENT_READY_DEADLINE_MS);
    },
    [addStartupLog],
  );

  const startAgentSession = useCallback(
    async (reason: string) => {
      const callId = activeCallIdRef.current;
      if (shutdownInProgressRef.current) return;

      if (agentStartInFlightRef.current) {
        addStartupLog("connection", "Agent start already in-flight", reason);
        return;
      }

      if (agentStartAttemptRef.current >= MAX_AGENT_START_ATTEMPTS) {
        markStartupFailed("Agent start retry budget exhausted");
        return;
      }

      clearAgentRecoveryTimer();
      clearAgentTransientLeaveTimer();
      clearAgentReadyTimer();
      clearAgentJoinTimer();

      const attempt = agentStartAttemptRef.current + 1;
      agentStartAttemptRef.current = attempt;
      agentStartInFlightRef.current = true;
      agentSessionExpectedRef.current = true;
      agentSeenThisAttemptRef.current = false;
      agentReadyRef.current = false;

      transitionStartupLifecycle("starting", reason);
      addStartupLog(
        "connection",
        `Starting agent session (${attempt}/${MAX_AGENT_START_ATTEMPTS})`,
        reason,
      );
      pushStartupTimeline(`attempt_${attempt}:${reason}`);

      let recoveryReason: string | null = null;

      try {
        const res = await fetch("/api/agent-session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ call_id: callId, call_type: "default" }),
        });

        const payload = (await res.json()) as AgentStartResponse;

        if (payload.status === "started") {
          if (payload.session_id) {
            agentSessionIdRef.current = payload.session_id;
          }

          transitionStartupLifecycle("awaiting_agent_join", "session-created");
          addStartupLog(
            "connection",
            payload.session_id
              ? `Agent session started (${payload.session_id})`
              : "Agent session started",
            reason,
          );
          armAgentJoinDeadline(
            "Agent participant did not join within join deadline",
          );
        } else if (payload.status === "already_running") {
          if (payload.session_id) {
            agentSessionIdRef.current = payload.session_id;
          }

          const detail = payload.detail ?? "Session limit reached";
          addStartupLog(
            "connection",
            `Agent session already running (scope=${payload.limit_scope ?? "unknown"}, upstream=${payload.upstream_status ?? "unknown"})`,
            detail,
          );

          const trackedSessionId = agentSessionIdRef.current;
          if (trackedSessionId) {
            const statusPayload = await getAgentSessionStatus(trackedSessionId);
            if (statusPayload.status === "running") {
              recoveryReason =
                "Tracked session is already running; forcing stale-session recovery";
            } else if (statusPayload.status === "not_found") {
              agentSessionIdRef.current = null;
              recoveryReason =
                "Tracked session missing while start returned already_running";
            }
          }

          transitionStartupLifecycle("awaiting_agent_join", "already-running");
          armAgentJoinDeadline(
            "Agent participant did not join within join deadline",
          );
        } else {
          const detail = payload.detail || "Failed to start agent session";
          addStartupLog(
            "error",
            `Agent start failed (upstream=${payload.upstream_status ?? "unknown"})`,
            detail,
          );
          recoveryReason = detail;
        }
      } catch (error) {
        const detail = `Failed to start agent session: ${error}`;
        addStartupLog("error", detail, reason);
        recoveryReason = detail;
      } finally {
        agentStartInFlightRef.current = false;
      }

      if (recoveryReason) {
        requestRecoveryRef.current(recoveryReason);
      }
    },
    [
      addStartupLog,
      armAgentJoinDeadline,
      clearAgentJoinTimer,
      clearAgentReadyTimer,
      clearAgentRecoveryTimer,
      clearAgentTransientLeaveTimer,
      getAgentSessionStatus,
      markStartupFailed,
      pushStartupTimeline,
      transitionStartupLifecycle,
    ],
  );
  startAgentSessionRef.current = startAgentSession;

  const stopAgentSession = useCallback(async () => {
    const sessionId = agentSessionIdRef.current;
    if (!sessionId) return;

    const payload = await stopAgentSessionById(sessionId);
    if (payload.status === "stopped" || payload.status === "not_found") {
      addStartupLog("connection", `Agent session stopped (${sessionId})`);
      agentSessionIdRef.current = null;
      return;
    }

    addStartupLog(
      "error",
      `Failed to stop agent session ${sessionId}: ${payload.detail ?? "unknown error"}`,
    );
  }, [addStartupLog, stopAgentSessionById]);

  const stopAgentSessionSync = useCallback(() => {
    const sessionId = agentSessionIdRef.current;
    if (!sessionId) return;

    try {
      const blob = new Blob([JSON.stringify({ session_id: sessionId })], {
        type: "application/json",
      });
      navigator.sendBeacon("/api/agent-session/stop", blob);
    } catch {
      // Best effort during unload.
    }
  }, []);

  const handleLocalCallingStateChange = useCallback(
    (callingState: string) => {
      if (!callingState || localCallingStateRef.current === callingState) {
        return;
      }

      localCallingStateRef.current = callingState;
      addStartupLog("connection", `Local call state -> ${callingState}`);

      if (
        callingState === "joined" &&
        pendingRecoveryReasonRef.current &&
        !agentStartInFlightRef.current &&
        !agentRecoveryTimerRef.current
      ) {
        const deferredReason = pendingRecoveryReasonRef.current;
        pendingRecoveryReasonRef.current = null;
        addStartupLog(
          "connection",
          "Executing deferred recovery after call rejoined",
          deferredReason,
        );
        requestRecoveryRef.current(deferredReason);
      }
    },
    [addStartupLog],
  );

  const handleAgentPresenceChange = useCallback(
    (hasAgent: boolean, hasPublishedVisualTrack: boolean) => {
      if (shutdownInProgressRef.current) return;

      if (hasAgent) {
        agentSeenThisAttemptRef.current = true;
        clearAgentJoinTimer();
        clearAgentTransientLeaveTimer();

        if (!agentReadyRef.current) {
          transitionStartupLifecycle("awaiting_ready", "agent-present");
        }

        if (hasPublishedVisualTrack) {
          markStartupReady("agent visual track published");
          return;
        }

        if (!agentReadyRef.current) {
          armAgentReadyDeadline(
            "Agent joined but did not become ready within readiness deadline",
          );
        }
        return;
      }

      clearAgentReadyTimer();

      if (
        !agentReadyRef.current &&
        agentSessionExpectedRef.current &&
        agentSeenThisAttemptRef.current &&
        !agentTransientLeaveTimerRef.current
      ) {
        addStartupLog(
          "connection",
          `Agent left before readiness; waiting ${AGENT_TRANSIENT_LEAVE_GRACE_MS / 1000}s grace`,
        );
        agentTransientLeaveTimerRef.current = setTimeout(() => {
          agentTransientLeaveTimerRef.current = null;
          requestRecoveryRef.current(
            "Agent disconnected before readiness and did not return within grace window",
          );
        }, AGENT_TRANSIENT_LEAVE_GRACE_MS);
      }
    },
    [
      addStartupLog,
      armAgentReadyDeadline,
      clearAgentJoinTimer,
      clearAgentReadyTimer,
      clearAgentTransientLeaveTimer,
      markStartupReady,
      transitionStartupLifecycle,
    ],
  );

  const handleTrustedAgentEvent = useCallback(
    (payload: AgentCustomEventPayload) => {
      if (shutdownInProgressRef.current || !payload.event_type) return;

      if (
        typeof payload.session_id === "string" &&
        payload.session_id.length > 0
      ) {
        if (agentSessionIdRef.current !== payload.session_id) {
          agentSessionIdRef.current = payload.session_id;
          addStartupLog(
            "connection",
            `Tracking session from event stream (${payload.session_id})`,
          );
        }
      }

      if (
        payload.event_type === "info" ||
        payload.event_type === "detection" ||
        payload.event_type === "compliment" ||
        payload.event_type === "joined_call" ||
        payload.event_type === "participant_detected" ||
        payload.event_type === "annotation_stream_ready"
      ) {
        markStartupReady(`trusted event: ${payload.event_type}`);
      }

      if (
        (payload.event_type === "error" ||
          payload.event_type === "session_error") &&
        !agentReadyRef.current
      ) {
        const message =
          typeof payload.data?.["message"] === "string"
            ? String(payload.data?.["message"])
            : "Agent reported startup error";
        requestRecoveryRef.current(
          `Agent reported error before ready: ${message}`,
        );
      }
    },
    [addStartupLog, markStartupReady],
  );

  const resetStartupLifecycle = useCallback(() => {
    startupLifecycleRef.current = "idle";
    startupTimelineRef.current = [];
    startupTimelineFlushedRef.current = false;
    localCallingStateRef.current = "unknown";
    pendingRecoveryReasonRef.current = null;
    agentSessionExpectedRef.current = false;
    agentSeenThisAttemptRef.current = false;
    agentReadyRef.current = false;
    agentStartAttemptRef.current = 0;

    clearStartupTimers();
  }, [clearStartupTimers]);

  const disconnect = useCallback(async () => {
    shutdownInProgressRef.current = true;
    addLog("connection", "Disconnecting...");

    clearStartupTimers();
    await stopAgentSession();

    stockVideoElementRef.current?.pause();
    stockVideoElementRef.current = null;
    stockVideoStreamRef.current?.getTracks().forEach((track) => track.stop());
    stockVideoStreamRef.current = null;

    await callRef.current?.leave().catch(() => undefined);
    await clientRef.current?.disconnectUser().catch(() => undefined);

    callRef.current = null;
    clientRef.current = null;
    setCall(null);
    setClient(null);
    setStatus("idle");

    resetStartupLifecycle();
    agentSessionIdRef.current = null;
    startupLifecycleRef.current = "idle";
    shutdownInProgressRef.current = false;

    addLog("connection", "Disconnected");
  }, [addLog, clearStartupTimers, resetStartupLifecycle, stopAgentSession]);

  const startSession = useCallback(async () => {
    if (!apiKey) {
      setStatus("error");
      return;
    }

    shutdownInProgressRef.current = false;
    resetStartupLifecycle();

    try {
      const ctx = new AudioContext();
      await ctx.resume();
      addLog("info", `AudioContext unlocked: ${ctx.state}`);
    } catch (error) {
      addLog("error", `AudioContext unlock failed: ${error}`);
    }

    setStatus("connecting");
    addLog("connection", "Connecting to Stream...");

    try {
      const runtimeCallId = isDemoMode
        ? `demo-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`
        : spaceId;
      activeCallIdRef.current = runtimeCallId;
      setActiveCallId(runtimeCallId);

      const userId = `greeter-yolo-${runtimeCallId}-${Date.now()}`;
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

      const videoCall = videoClient.call("default", runtimeCallId);
      await videoCall.join({ create: true });
      videoCall.setIncomingVideoEnabled(true);
      addLog("connection", `Joined call: ${runtimeCallId}`);

      setCall(videoCall);
      callRef.current = videoCall;
      setStatus("connected");
      addLog(
        "connection",
        `Connected - waiting for agent (${AGENT_STARTUP_V2_ENABLED ? "startup-v2" : "legacy"})`,
      );

      if (videoInput === "stock") {
        await videoCall.camera.disable().catch(() => undefined);
        await videoCall.microphone.disable().catch(() => undefined);
        addLog("connection", "Demo mode: camera and mic disabled");

        await publishStockVideo(videoCall);
      } else {
        await videoCall.camera.enable();
        addLog("connection", "Camera enabled");
      }

      transitionStartupLifecycle("starting", "initial-start");
      pushStartupTimeline("session-connected");
      await startAgentSession("initial call join");
    } catch (error) {
      console.error("Failed to connect:", error);
      addLog("error", `Connection failed: ${error}`);
      clearStartupTimers();
      await callRef.current?.leave().catch(() => undefined);
      await clientRef.current?.disconnectUser().catch(() => undefined);
      callRef.current = null;
      clientRef.current = null;
      setCall(null);
      setClient(null);
      setStatus("error");
      markStartupFailed("Failed to establish initial Stream call connection");
    }
  }, [
    addLog,
    apiKey,
    clearStartupTimers,
    isDemoMode,
    markStartupFailed,
    publishStockVideo,
    pushStartupTimeline,
    resetStartupLifecycle,
    spaceId,
    startAgentSession,
    transitionStartupLifecycle,
    videoInput,
  ]);

  useEffect(() => {
    return () => {
      shutdownInProgressRef.current = true;
      stockVideoElementRef.current?.pause();
      stockVideoElementRef.current = null;
      stockVideoStreamRef.current?.getTracks().forEach((track) => track.stop());
      stockVideoStreamRef.current = null;
      clearStartupTimers();
      stopAgentSessionSync();
      callRef.current?.leave().catch(() => undefined);
      clientRef.current?.disconnectUser().catch(() => undefined);
      callRef.current = null;
      clientRef.current = null;
    };
  }, [clearStartupTimers, stopAgentSessionSync]);

  const resetToIdle = useCallback(() => {
    setStatus("idle");
  }, []);

  return {
    apiKey,
    status,
    client,
    call,
    activeCallId,
    startSession,
    disconnect,
    resetToIdle,
    handleLocalCallingStateChange,
    handleAgentPresenceChange,
    handleTrustedAgentEvent,
  };
}
