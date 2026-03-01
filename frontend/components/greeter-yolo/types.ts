import type { StreamVideoClient } from "@stream-io/video-react-sdk";
import type { SpaceConfig } from "@/lib/space-config";

export interface GreeterYoloCallProps {
  spaceId: string;
  spaceName?: string;
  videoInput?: "camera" | "stock";
  stockVideoUrl?: string;
  spaceConfig?: SpaceConfig | null;
}

export interface ComplimentEntry {
  id: number;
  text: string;
  timestamp: Date;
  hasBusinessMention: boolean;
}

export interface LogEntry {
  id: number;
  type: "info" | "detection" | "compliment" | "error" | "connection";
  message: string;
  timestamp: Date;
}

export type AgentEventType =
  | "compliment"
  | "detection"
  | "info"
  | "error"
  | "session_starting"
  | "joined_call"
  | "participant_detected"
  | "session_error"
  | "session_stopping"
  | "annotation_stream_ready";

export interface AgentEventData extends Record<string, unknown> {
  text?: string;
  preview_text?: string;
  compliment_id?: number;
  tts_enabled?: boolean;
  speech_delay_ms?: number;
  preview_hide_ms_text_only?: number;
  message?: string;
  detected?: boolean;
}

export interface AgentCustomEventPayload {
  source?: string;
  event_type?: AgentEventType;
  call_id?: string;
  session_id?: string;
  data?: AgentEventData;
  ts?: string;
}

export type StartupLifecycle =
  | "idle"
  | "starting"
  | "awaiting_agent_join"
  | "awaiting_ready"
  | "ready"
  | "recovering"
  | "failed";

export interface AgentStartResponse {
  status?: "started" | "already_running" | "error";
  session_id?: string;
  detail?: string;
  upstream_status?: number;
  limit_scope?: "per_call" | "concurrent" | "unknown";
}

export interface AgentStopResponse {
  status?: "stopped" | "not_found" | "error";
  detail?: string;
  upstream_status?: number;
}

export interface AgentSessionStatusResponse {
  status?: "running" | "not_found" | "error";
  detail?: string;
  upstream_status?: number;
}

export type GreeterBotState =
  | "waiting"
  | "looking"
  | "detected"
  | "speaking"
  | "idle";

export type GreeterCallStatus = "idle" | "connecting" | "connected" | "error";

export type StreamVideoCall = ReturnType<StreamVideoClient["call"]>;

export type AddLogFn = (type: LogEntry["type"], message: string) => void;
