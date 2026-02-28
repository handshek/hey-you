"use client";

import { useEffect, useRef, useState } from "react";
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

export function useGreeterBotState({
  callId,
  compliments,
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
  const wowTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const speakingTimeoutRef = useRef<NodeJS.Timeout>(undefined);
  const prevBotStateRef = useRef(botState);
  const lastDetectionLogRef = useRef(0);

  const hasAgent = Boolean(agentParticipant);
  const agentIsSpeaking = agentParticipant?.isSpeaking ?? false;
  const publishedTracks = agentParticipant?.publishedTracks ?? [];
  const hasPublishedVisualTrack =
    publishedTracks.includes(TRACK_TYPE_VIDEO) ||
    publishedTracks.includes(TRACK_TYPE_SCREEN_SHARE);

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

  useEffect(() => {
    if (!call) return;

    addLog("connection", "Listening for agent events...");

    const unsubscribe = call.on("custom", (event) => {
      const payloadUnknown = (event as { custom?: unknown }).custom;
      if (!payloadUnknown || typeof payloadUnknown !== "object") return;

      const payload = payloadUnknown as AgentCustomEventPayload;
      if (payload.source !== "heyyou-agent") return;
      if (payload.call_id && payload.call_id !== callId) return;

      onTrustedAgentEvent(payload);
      const data = payload.data ?? {};

      if (payload.event_type === "compliment") {
        const text = typeof data["text"] === "string" ? data["text"] : null;
        if (!text) return;

        addCompliment(text);
        addLog("compliment", text);

        if (wowTimeoutRef.current) clearTimeout(wowTimeoutRef.current);
        if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);

        setBotState("detected");
        wowTimeoutRef.current = setTimeout(() => {
          setBotState("speaking");
        }, 800);

        const durationMs = Math.max(4000, (text.length / 12) * 1000 + 2000);
        speakingTimeoutRef.current = setTimeout(() => {
          setBotState((prev) => (prev === "speaking" ? "looking" : prev));
        }, 800 + durationMs);
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

        if (detected) {
          setBotState((prev) =>
            prev === "looking" || prev === "idle" ? "detected" : prev,
          );
        }

        const now = Date.now();
        if (now - lastDetectionLogRef.current > 1500) {
          lastDetectionLogRef.current = now;
          addLog("detection", detected ? "Person detected" : "No person in frame");
        }
        return;
      }

      if (payload.event_type === "annotation_stream_ready") {
        addLog("info", "YOLO annotation stream ready");
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
        addLog("info", message);
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
        addLog("error", message);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [call, callId, addCompliment, addLog, onTrustedAgentEvent]);

  useEffect(() => {
    if (!hasAgent) {
      setBotState("waiting");
      return;
    }

    if (agentIsSpeaking) {
      if (wowTimeoutRef.current) clearTimeout(wowTimeoutRef.current);
      setBotState("speaking");
      return;
    }

    setBotState((prev) => (prev === "waiting" ? "looking" : prev));
  }, [hasAgent, agentIsSpeaking]);

  useEffect(() => {
    if (prevBotStateRef.current === botState) return;

    const previousBotState = prevBotStateRef.current;
    prevBotStateRef.current = botState;

    if (botState === "looking" && previousBotState === "waiting") {
      addLog("connection", "Agent connected - YOLO scanning active");
    } else if (botState === "detected") {
      addLog("detection", "Person detected!");
    } else if (botState === "speaking") {
      addLog("info", "Agent is speaking (TTS active)");
    } else if (botState === "waiting" && previousBotState !== "waiting") {
      addLog("info", "Agent disconnected");
    }
  }, [botState, addLog]);

  useEffect(() => {
    return () => {
      if (wowTimeoutRef.current) clearTimeout(wowTimeoutRef.current);
      if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    };
  }, []);

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

  const latestCompliment = compliments[compliments.length - 1];

  return {
    botState,
    hasAgent,
    latestCompliment,
  };
}
