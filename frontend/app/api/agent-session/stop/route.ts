import { NextRequest, NextResponse } from "next/server";

interface AgentStopResponse {
  status: "stopped" | "not_found" | "error";
  detail?: string;
  upstream_status?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sessionId = body?.session_id;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json<AgentStopResponse>(
        {
          status: "error",
          detail: "session_id is required and must be a string",
        },
        { status: 400 },
      );
    }

    const agentServiceUrl = process.env.AGENT_SERVICE_URL;
    const agentServiceSecret = process.env.AGENT_SERVICE_SECRET;

    if (!agentServiceUrl) {
      return NextResponse.json<AgentStopResponse>(
        { status: "error", detail: "AGENT_SERVICE_URL is not configured" },
        { status: 500 },
      );
    }

    if (!agentServiceSecret) {
      return NextResponse.json<AgentStopResponse>(
        { status: "error", detail: "AGENT_SERVICE_SECRET is not configured" },
        { status: 500 },
      );
    }

    const endpoint = `${agentServiceUrl.replace(/\/+$/, "")}/sessions/${encodeURIComponent(sessionId)}`;
    const agentRes = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        "x-agent-secret": agentServiceSecret,
      },
      cache: "no-store",
    });

    if (agentRes.status === 204 || agentRes.ok) {
      return NextResponse.json<AgentStopResponse>({
        status: "stopped",
        upstream_status: agentRes.status,
      });
    }

    if (agentRes.status === 404) {
      return NextResponse.json<AgentStopResponse>({
        status: "not_found",
        detail: "Session not found (may have already ended)",
        upstream_status: agentRes.status,
      });
    }

    let detail = "Failed to stop agent session";
    try {
      const payload = (await agentRes.json()) as Record<string, unknown>;
      if (typeof payload.detail === "string") detail = payload.detail;
    } catch {
      // ignore parse errors
    }

    return NextResponse.json<AgentStopResponse>(
      { status: "error", detail, upstream_status: agentRes.status },
      { status: agentRes.status >= 400 ? agentRes.status : 500 },
    );
  } catch (error) {
    console.error("Error stopping agent session:", error);
    return NextResponse.json<AgentStopResponse>(
      { status: "error", detail: "Failed to stop agent session" },
      { status: 500 },
    );
  }
}
