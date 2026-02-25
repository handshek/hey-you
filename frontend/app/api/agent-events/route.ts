import { NextRequest, NextResponse } from "next/server";

/**
 * Simple in-memory event store for agent → frontend communication.
 * The agent POSTs events here, and the frontend polls via GET.
 *
 * Events are stored per call_id so multiple sessions don't interfere.
 */

interface AgentEvent {
  id: number;
  type: "compliment" | "detection" | "info" | "error";
  data: Record<string, unknown>;
  timestamp: string;
}

// In-memory store: call_id → events[]
const eventStore = new Map<string, AgentEvent[]>();
let globalEventId = 0;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { call_id, type, data } = body;

    if (!call_id || !type) {
      return NextResponse.json(
        { error: "call_id and type are required" },
        { status: 400 },
      );
    }

    if (!eventStore.has(call_id)) {
      eventStore.set(call_id, []);
    }

    const event: AgentEvent = {
      id: globalEventId++,
      type,
      data: data || {},
      timestamp: new Date().toISOString(),
    };

    eventStore.get(call_id)!.push(event);

    // Keep only last 100 events per call
    const events = eventStore.get(call_id)!;
    if (events.length > 100) {
      eventStore.set(call_id, events.slice(-100));
    }

    return NextResponse.json({ ok: true, event_id: event.id });
  } catch (error) {
    console.error("Error storing agent event:", error);
    return NextResponse.json(
      { error: "Failed to store event" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const callId = searchParams.get("call_id");
  const since = parseInt(searchParams.get("since") || "-1", 10);

  if (!callId) {
    return NextResponse.json(
      { error: "call_id query param is required" },
      { status: 400 },
    );
  }

  const events = eventStore.get(callId) || [];
  const newEvents = events.filter((e) => e.id > since);

  return NextResponse.json({
    events: newEvents,
    latest_id: events.length > 0 ? events[events.length - 1].id : -1,
  });
}
