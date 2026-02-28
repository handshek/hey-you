export const TRACK_TYPE_VIDEO = 2;
export const TRACK_TYPE_SCREEN_SHARE = 3;

export const AGENT_STARTUP_V2_ENABLED =
  process.env.NEXT_PUBLIC_AGENT_STARTUP_V2 !== "false";

export const AGENT_LOG_MODE: "concise" | "debug" =
  process.env.NEXT_PUBLIC_AGENT_LOG_MODE === "debug" ? "debug" : "concise";

export const AGENT_JOIN_DEADLINE_MS = 20_000;
export const AGENT_READY_DEADLINE_MS = 20_000;
export const AGENT_TRANSIENT_LEAVE_GRACE_MS = 3_000;
export const AGENT_RETRY_BASE_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 13_000];
export const AGENT_RETRY_JITTER_MS = 500;
export const MAX_AGENT_START_ATTEMPTS = AGENT_RETRY_BASE_DELAYS_MS.length;
