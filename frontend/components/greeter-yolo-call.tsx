"use client";

import { StreamCall, StreamVideo } from "@stream-io/video-react-sdk";
import { GreeterDrawer } from "@/components/greeter-drawer";
import { GreeterStatusScreen } from "@/components/greeter-yolo/greeter-status-screen";
import { GreeterYoloInner } from "@/components/greeter-yolo/greeter-yolo-inner";
import { useAgentSessionLifecycle } from "@/components/greeter-yolo/use-agent-session-lifecycle";
import { useGreeterEntries } from "@/components/greeter-yolo/use-greeter-entries";
import type { GreeterYoloCallProps } from "@/components/greeter-yolo/types";

export function GreeterYoloCall({
  spaceId,
  videoInput = "camera",
  stockVideoUrl,
}: GreeterYoloCallProps) {
  const { compliments, logs, addCompliment, addLog } = useGreeterEntries();

  const {
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
  } = useAgentSessionLifecycle({
    spaceId,
    videoInput,
    stockVideoUrl,
    addLog,
  });

  if (status === "idle" || status === "error" || status === "connecting") {
    return (
      <GreeterStatusScreen
        status={status}
        hasApiKey={Boolean(apiKey)}
        onActivate={() => {
          void startSession();
        }}
        onRetry={resetToIdle}
      />
    );
  }

  if (!client || !call) {
    return (
      <GreeterStatusScreen
        status="connecting"
        hasApiKey={Boolean(apiKey)}
        onActivate={() => {
          void startSession();
        }}
        onRetry={resetToIdle}
      />
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <GreeterYoloInner
          callId={activeCallId}
          compliments={compliments}
          addCompliment={addCompliment}
          addLog={addLog}
          onAgentPresenceChange={handleAgentPresenceChange}
          onTrustedAgentEvent={handleTrustedAgentEvent}
          onLocalCallingStateChange={handleLocalCallingStateChange}
        />
        <GreeterDrawer logs={logs} onDisconnect={disconnect} />
      </StreamCall>
    </StreamVideo>
  );
}
