import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

interface AgentStartResponse {
  status: "started" | "already_running" | "error";
  session_id?: string;
  detail?: string;
  upstream_status?: number;
  limit_scope?: "per_call" | "concurrent" | "unknown";
}

const classifyLimitScope = (
  detail: string,
): "per_call" | "concurrent" | "unknown" => {
  const normalized = detail.toLowerCase();
  if (normalized.includes("sessions per call")) return "per_call";
  if (normalized.includes("concurrent sessions")) return "concurrent";
  return "unknown";
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const callId = body?.call_id;
    const callType = body?.call_type ?? "default";

    if (!callId || typeof callId !== "string") {
      return NextResponse.json<AgentStartResponse>(
        {
          status: "error",
          detail: "call_id is required and must be a string",
        },
        { status: 400 },
      );
    }

    const agentServiceUrl = process.env.AGENT_SERVICE_URL;
    const agentServiceSecret = process.env.AGENT_SERVICE_SECRET;

    if (!agentServiceUrl) {
      return NextResponse.json<AgentStartResponse>(
        { status: "error", detail: "AGENT_SERVICE_URL is not configured" },
        { status: 500 },
      );
    }

    if (!agentServiceSecret) {
      return NextResponse.json<AgentStartResponse>(
        { status: "error", detail: "AGENT_SERVICE_SECRET is not configured" },
        { status: 500 },
      );
    }

    const endpoint = `${agentServiceUrl.replace(/\/+$/, "")}/sessions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 58_000);
    let agentRes: Response;
    try {
      agentRes = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-agent-secret": agentServiceSecret,
        },
        body: JSON.stringify({ call_id: callId, call_type: callType }),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return NextResponse.json<AgentStartResponse>(
          {
            status: "error",
            detail: "Timed out while starting agent session",
            upstream_status: 504,
          },
          { status: 504 },
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await agentRes.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (agentRes.ok) {
      return NextResponse.json<AgentStartResponse>({
        status: "started",
        session_id:
          typeof payload.session_id === "string" ? payload.session_id : undefined,
        upstream_status: agentRes.status,
      });
    }

    const detail =
      typeof payload.detail === "string" ? payload.detail : "Agent start failed";

    if (agentRes.status === 429) {
      return NextResponse.json<AgentStartResponse>({
        status: "already_running",
        detail,
        upstream_status: agentRes.status,
        limit_scope: classifyLimitScope(detail),
      });
    }

    return NextResponse.json<AgentStartResponse>(
      { status: "error", detail, upstream_status: agentRes.status },
      { status: agentRes.status >= 400 ? agentRes.status : 500 },
    );
  } catch (error) {
    console.error("Error starting agent session:", error);
    return NextResponse.json<AgentStartResponse>(
      {
        status: "error",
        detail: "Failed to start agent session",
      },
      { status: 500 },
    );
  }
}
