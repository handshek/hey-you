import { NextRequest, NextResponse } from "next/server";

interface AgentSessionStatusResponse {
  status: "running" | "not_found" | "error";
  detail?: string;
  upstream_status?: number;
}

export async function GET(
  _request: NextRequest,
  context: { params: { session_id: string } | Promise<{ session_id: string }> },
) {
  try {
    const params = await Promise.resolve(context.params);
    const sessionId = params?.session_id;

    if (!sessionId || typeof sessionId !== "string") {
      return NextResponse.json<AgentSessionStatusResponse>(
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
      return NextResponse.json<AgentSessionStatusResponse>(
        { status: "error", detail: "AGENT_SERVICE_URL is not configured" },
        { status: 500 },
      );
    }

    if (!agentServiceSecret) {
      return NextResponse.json<AgentSessionStatusResponse>(
        { status: "error", detail: "AGENT_SERVICE_SECRET is not configured" },
        { status: 500 },
      );
    }

    const endpoint = `${agentServiceUrl.replace(/\/+$/, "")}/sessions/${encodeURIComponent(sessionId)}`;
    const agentRes = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-agent-secret": agentServiceSecret,
      },
      cache: "no-store",
    });

    if (agentRes.ok) {
      return NextResponse.json<AgentSessionStatusResponse>({
        status: "running",
        upstream_status: agentRes.status,
      });
    }

    if (agentRes.status === 404) {
      return NextResponse.json<AgentSessionStatusResponse>({
        status: "not_found",
        detail: "Session not found",
        upstream_status: agentRes.status,
      });
    }

    let detail = "Failed to fetch session status";
    try {
      const payload = (await agentRes.json()) as Record<string, unknown>;
      if (typeof payload.detail === "string") detail = payload.detail;
    } catch {
      // Ignore parse errors.
    }

    return NextResponse.json<AgentSessionStatusResponse>(
      { status: "error", detail, upstream_status: agentRes.status },
      { status: agentRes.status >= 400 ? agentRes.status : 500 },
    );
  } catch (error) {
    console.error("Error fetching agent session status:", error);
    return NextResponse.json<AgentSessionStatusResponse>(
      { status: "error", detail: "Failed to fetch session status" },
      { status: 500 },
    );
  }
}
