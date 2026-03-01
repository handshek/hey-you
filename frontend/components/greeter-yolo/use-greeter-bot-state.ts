"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useCall,
  useCallStateHooks,
  type StreamVideoParticipant,
} from "@stream-io/video-react-sdk";
import {
  TRACK_TYPE_SCREEN_SHARE,
  TRACK_TYPE_VIDEO,
} from "@/components/greeter-yolo/constants";
import type {
  AddLogFn,
  AgentCustomEventPayload,
  ComplimentEntry,
  GreeterBotState,
} from "@/components/greeter-yolo/types";

interface UseGreeterBotStateParams {
  callId: string;
  compliments: ComplimentEntry[];
  addCompliment: (text: string) => void;
  addLog: AddLogFn;
  onAgentPresenceChange: (
    hasAgent: boolean,
    hasPublishedVisualTrack: boolean,
  ) => void;
  onTrustedAgentEvent: (payload: AgentCustomEventPayload) => void;
  onLocalCallingStateChange: (callingState: string) => void;
}

const POST_DONE_HOLD_MS = 3000;
const TYPEWRITER_WORD_INTERVAL_MS = 100;
const TTS_TIMEOUT_MS = 5000;

function splitWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

export function useGreeterBotState({
  callId,
  addCompliment,
  addLog,
  onAgentPresenceChange,
  onTrustedAgentEvent,
  onLocalCallingStateChange,
}: UseGreeterBotStateParams) {
  const call = useCall();
  const { useRemoteParticipants, useCallCallingState } = useCallStateHooks();
  const remoteParticipants = useRemoteParticipants();
  const callingState = useCallCallingState();

  const agentParticipant = remoteParticipants.find(
    (participant: StreamVideoParticipant) =>
      participant.userId?.includes("heyyou") ||
      participant.userId?.includes("agent"),
  );

  const [botState, setBotState] = useState<GreeterBotState>("waiting");
  const [displayComplimentText, setDisplayComplimentText] = useState<
    string | null
  >(null);
  const [currentComplimentId, setCurrentComplimentId] = useState<number | null>(
    null,
  );
  const [isComplimentVisible, setIsComplimentVisible] = useState(false);
  const [revealedWordCount, setRevealedWordCount] = useState(0);

  const prevBotStateRef = useRef(botState);
  const lastDetectionLogRef = useRef(0);
  const lastHandledComplimentIdRef = useRef<number | null>(null);

  // Typewriter + completion tracking refs
  const typewriterTimerRef = useRef<NodeJS.Timeout | null>(null);
  const postDoneTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ttsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lifecycleIdRef = useRef<number | null>(null);
  const wordsRef = useRef<string[]>([]);
  const typewriterDoneRef = useRef(false);
  const ttsDoneRef = useRef(false);
  const ttsStartedRef = useRef(false);

  const hasAgent = Boolean(agentParticipant);
  const agentIsSpeaking = agentParticipant?.isSpeaking ?? false;
  const publishedTracks = agentParticipant?.publishedTracks ?? [];
  const hasPublishedVisualTrack =
    publishedTracks.includes(TRACK_TYPE_VIDEO) ||
    publishedTracks.includes(TRACK_TYPE_SCREEN_SHARE);

  // --- Stable refs for event handler access (avoids re-subscription) ---
  const callRef = useRef(call);
  const addComplimentRef = useRef(addCompliment);
  const addLogRef = useRef(addLog);
  const onTrustedAgentEventRef = useRef(onTrustedAgentEvent);
  const isComplimentVisibleRef = useRef(isComplimentVisible);
  const hasAgentRef = useRef(hasAgent);
  const prevAgentIsSpeakingRef = useRef(false);

  // Keep refs in sync every render
  useEffect(() => {
    callRef.current = call;
    addComplimentRef.current = addCompliment;
    addLogRef.current = addLog;
    onTrustedAgentEventRef.current = onTrustedAgentEvent;
    isComplimentVisibleRef.current = isComplimentVisible;
    hasAgentRef.current = hasAgent;
  });

  // --- Timer cleanup helpers ---
  const clearTypewriterTimer = useCallback(() => {
    if (typewriterTimerRef.current) {
      clearInterval(typewriterTimerRef.current);
      typewriterTimerRef.current = null;
    }
  }, []);

  const clearPostDoneTimer = useCallback(() => {
    if (postDoneTimerRef.current) {
      clearTimeout(postDoneTimerRef.current);
      postDoneTimerRef.current = null;
    }
  }, []);

  const clearTtsTimeout = useCallback(() => {
    if (ttsTimeoutRef.current) {
      clearTimeout(ttsTimeoutRef.current);
      ttsTimeoutRef.current = null;
    }
  }, []);

  const clearAllTimers = useCallback(() => {
    clearTypewriterTimer();
    clearPostDoneTimer();
    clearTtsTimeout();
  }, [clearTypewriterTimer, clearPostDoneTimer, clearTtsTimeout]);

  const clearAllTimersRef = useRef(clearAllTimers);
  useEffect(() => {
    clearAllTimersRef.current = clearAllTimers;
  }, [clearAllTimers]);

  const resetComplimentVisualState = useCallback(
    (nextBotState: GreeterBotState) => {
      console.log("[HeyYou] resetComplimentVisualState →", nextBotState);
      clearAllTimers();
      setDisplayComplimentText(null);
      setCurrentComplimentId(null);
      setIsComplimentVisible(false);
      setRevealedWordCount(0);
      setBotState(nextBotState);

      lifecycleIdRef.current = null;
      wordsRef.current = [];
      typewriterDoneRef.current = false;
      ttsDoneRef.current = false;
      ttsStartedRef.current = false;
    },
    [clearAllTimers],
  );

  // Check if both typewriter and TTS are done → schedule cleanup
  const checkBothDone = useCallback(
    (lifecycleId: number) => {
      console.log("[HeyYou] checkBothDone id=%d typewriter=%s tts=%s", lifecycleId, typewriterDoneRef.current, ttsDoneRef.current);
      if (!typewriterDoneRef.current || !ttsDoneRef.current) return;
      if (lifecycleIdRef.current !== lifecycleId) return;

      console.log("[HeyYou] Both done! Scheduling reset in %dms", POST_DONE_HOLD_MS);
      clearPostDoneTimer();
      postDoneTimerRef.current = setTimeout(() => {
        if (lifecycleIdRef.current !== lifecycleId) return;
        resetComplimentVisualState(
          hasAgentRef.current ? "looking" : "waiting",
        );
      }, POST_DONE_HOLD_MS);
    },
    [clearPostDoneTimer, resetComplimentVisualState],
  );

  const checkBothDoneRef = useRef(checkBothDone);
  useEffect(() => {
    checkBothDoneRef.current = checkBothDone;
  }, [checkBothDone]);

  // Start typewriter word reveal interval
  const startTypewriter = useCallback(
    (lifecycleId: number) => {
      clearTypewriterTimer();
      let cursor = 0;
      setRevealedWordCount(0);
      const totalWords = wordsRef.current.length;
      console.log("[HeyYou] startTypewriter id=%d words=%d", lifecycleId, totalWords);

      typewriterTimerRef.current = setInterval(() => {
        if (lifecycleIdRef.current !== lifecycleId) {
          clearTypewriterTimer();
          return;
        }

        cursor += 1;
        setRevealedWordCount(cursor);

        if (cursor >= wordsRef.current.length) {
          clearTypewriterTimer();
          typewriterDoneRef.current = true;
          console.log("[HeyYou] Typewriter done id=%d", lifecycleId);
          checkBothDoneRef.current(lifecycleId);
        }
      }, TYPEWRITER_WORD_INTERVAL_MS);
    },
    [clearTypewriterTimer],
  );

  // --- Effects ---

  useEffect(() => {
    onLocalCallingStateChange(String(callingState ?? "unknown").toLowerCase());
  }, [callingState, onLocalCallingStateChange]);

  useEffect(() => {
    if (!call) return;
    call.setIncomingVideoEnabled(true);
  }, [call]);

  useEffect(() => {
    onAgentPresenceChange(hasAgent, hasPublishedVisualTrack);
  }, [hasAgent, hasPublishedVisualTrack, onAgentPresenceChange]);

  // --- Custom event listener (stable — depends only on callId) ---
  useEffect(() => {
    const currentCall = callRef.current;
    if (!currentCall) {
      console.log("[HeyYou] Event listener: no call object, skipping subscription");
      return;
    }

    console.log("[HeyYou] Event listener: subscribing for callId=%s", callId);
    addLogRef.current("connection", "Listening for agent events...");

    const unsubscribe = currentCall.on("custom", (event) => {
      const payloadUnknown = (event as { custom?: unknown }).custom;
      if (!payloadUnknown || typeof payloadUnknown !== "object") return;

      const payload = payloadUnknown as AgentCustomEventPayload;
      if (payload.source !== "heyyou-agent") return;
      if (payload.call_id && payload.call_id !== callId) return;

      onTrustedAgentEventRef.current(payload);
      const data = payload.data ?? {};

      if (payload.event_type === "compliment") {
        const text =
          typeof data["text"] === "string" ? data["text"].trim() : "";
        if (!text) return;

        const complimentIdRaw =
          typeof data["compliment_id"] === "number" &&
          Number.isInteger(data["compliment_id"])
            ? data["compliment_id"]
            : null;

        if (
          complimentIdRaw !== null &&
          lastHandledComplimentIdRef.current !== null &&
          complimentIdRaw <= lastHandledComplimentIdRef.current
        ) {
          console.log("[HeyYou] Skipping duplicate compliment id=%d", complimentIdRaw);
          return;
        }

        const lifecycleId = complimentIdRaw ?? Date.now();
        if (complimentIdRaw !== null) {
          lastHandledComplimentIdRef.current = complimentIdRaw;
        }

        console.log("[HeyYou] Compliment received id=%d text=%s", lifecycleId, text.slice(0, 50));

        // Reset everything for this new compliment
        clearAllTimersRef.current();
        lifecycleIdRef.current = lifecycleId;
        wordsRef.current = splitWords(text);
        typewriterDoneRef.current = false;
        ttsDoneRef.current = false;
        ttsStartedRef.current = false;

        addComplimentRef.current(text);
        addLogRef.current("compliment", text);

        setCurrentComplimentId(lifecycleId);
        setDisplayComplimentText(text);
        setIsComplimentVisible(true);
        setRevealedWordCount(0);
        setBotState("speaking");

        // TTS timeout fallback: if TTS never starts, auto-complete after timeout
        ttsTimeoutRef.current = setTimeout(() => {
          if (lifecycleIdRef.current !== lifecycleId) return;
          if (!ttsStartedRef.current) {
            console.log("[HeyYou] TTS timeout (no speech detected in %dms) id=%d", TTS_TIMEOUT_MS, lifecycleId);
            ttsDoneRef.current = true;
            checkBothDoneRef.current(lifecycleId);
          }
        }, TTS_TIMEOUT_MS);
        return;
      }

      if (
        payload.event_type === "detection" ||
        payload.event_type === "participant_detected"
      ) {
        const detected =
          payload.event_type === "participant_detected"
            ? true
            : Boolean(data["detected"]);

        if (detected && !isComplimentVisibleRef.current) {
          setBotState((prev) =>
            prev === "looking" || prev === "idle" ? "detected" : prev,
          );
        }

        const now = Date.now();
        if (now - lastDetectionLogRef.current > 1500) {
          lastDetectionLogRef.current = now;
          addLogRef.current(
            "detection",
            detected ? "Person detected" : "No person in frame",
          );
        }
        return;
      }

      if (payload.event_type === "annotation_stream_ready") {
        addLogRef.current("info", "YOLO annotation stream ready");
        return;
      }

      if (
        payload.event_type === "info" ||
        payload.event_type === "session_starting" ||
        payload.event_type === "joined_call" ||
        payload.event_type === "session_stopping"
      ) {
        const message =
          typeof data["message"] === "string"
            ? data["message"]
            : payload.event_type.replaceAll("_", " ");
        addLogRef.current("info", message);
        return;
      }

      if (
        payload.event_type === "error" ||
        payload.event_type === "session_error"
      ) {
        const message =
          typeof data["message"] === "string"
            ? data["message"]
            : payload.event_type.replaceAll("_", " ");
        addLogRef.current("error", message);
      }
    });

    return () => {
      console.log("[HeyYou] Event listener: unsubscribing for callId=%s", callId);
      unsubscribe?.();
    };
  }, [callId]);

  // --- Start typewriter when compliment becomes visible or changes ---
  useEffect(() => {
    const lifecycleId = lifecycleIdRef.current;
    if (!isComplimentVisible || lifecycleId === null) return;
    console.log("[HeyYou] Typewriter effect triggered id=%d complimentId=%s", lifecycleId, currentComplimentId);
    startTypewriter(lifecycleId);
  }, [isComplimentVisible, currentComplimentId, startTypewriter]);

  // --- Track agent speaking for TTS completion ---
  useEffect(() => {
    const wasSpeaking = prevAgentIsSpeakingRef.current;
    prevAgentIsSpeakingRef.current = agentIsSpeaking;

    const lifecycleId = lifecycleIdRef.current;

    // No active compliment — agent present means "looking"
    if (!isComplimentVisible || lifecycleId === null) {
      if (!hasAgent) {
        if (botState !== "waiting") {
          clearAllTimers();
          resetComplimentVisualState("waiting");
        }
        return;
      }
      // Don't let agentIsSpeaking noise toggle botState outside compliment mode
      // Preserve "detected" so the wow avatar + thinking bars render until
      // the compliment event arrives and sets botState to "speaking".
      if (botState !== "looking" && botState !== "detected") {
        setBotState("looking");
      }
      return;
    }

    // Agent disconnected mid-compliment
    if (!hasAgent) {
      console.log("[HeyYou] Agent disconnected mid-compliment, resetting");
      clearAllTimers();
      resetComplimentVisualState("waiting");
      return;
    }

    // Rising edge: TTS started
    if (agentIsSpeaking && !wasSpeaking) {
      console.log("[HeyYou] TTS rising edge (speaking started) id=%d", lifecycleId);
      ttsStartedRef.current = true;
      // Clear the TTS timeout since TTS actually started
      clearTtsTimeout();
    }

    // Falling edge: TTS finished
    if (!agentIsSpeaking && wasSpeaking && ttsStartedRef.current) {
      console.log("[HeyYou] TTS falling edge (speaking done) id=%d", lifecycleId);
      ttsDoneRef.current = true;
      checkBothDone(lifecycleId);
    }
  }, [
    agentIsSpeaking,
    botState,
    checkBothDone,
    clearAllTimers,
    clearTtsTimeout,
    hasAgent,
    isComplimentVisible,
    resetComplimentVisualState,
  ]);

  // --- Bot state transition logging ---
  useEffect(() => {
    if (prevBotStateRef.current === botState) return;

    const previousBotState = prevBotStateRef.current;
    prevBotStateRef.current = botState;
    console.log("[HeyYou] botState: %s → %s", previousBotState, botState);

    if (botState === "looking" && previousBotState === "waiting") {
      addLog("connection", "Agent connected - YOLO scanning active");
    } else if (botState === "detected") {
      addLog("detection", "Person detected!");
    } else if (botState === "speaking") {
      addLog("info", "Agent is speaking (TTS active)");
    } else if (botState === "looking" && previousBotState === "speaking") {
      addLog("info", "Back to scanning");
    } else if (botState === "waiting" && previousBotState !== "waiting") {
      addLog("info", "Agent disconnected");
    }
  }, [botState, addLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  // Auto-play agent audio
  useEffect(() => {
    if (!agentParticipant?.audioStream) {
      console.log("[HeyYou] No agent audio stream");
      return;
    }

    console.log("[HeyYou] Agent audio stream available, creating Audio element");
    const audio = new Audio();
    audio.autoplay = true;
    audio.srcObject = agentParticipant.audioStream;
    audio.play().catch((err) => {
      console.warn("[HeyYou] Audio play failed:", err);
    });

    return () => {
      audio.srcObject = null;
    };
  }, [agentParticipant?.audioStream]);

  const agentAudioStream = agentParticipant?.audioStream ?? null;

  return {
    botState,
    hasAgent,
    displayComplimentText,
    currentComplimentId,
    isComplimentVisible,
    revealedWordCount,
    agentAudioStream,
  };
}
