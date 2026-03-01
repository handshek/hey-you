"use client";

import { GreeterLiveScreen } from "@/components/greeter-yolo/greeter-live-screen";
import { useGreeterBotState } from "@/components/greeter-yolo/use-greeter-bot-state";
import type {
  AddLogFn,
  AgentCustomEventPayload,
  ComplimentEntry,
} from "@/components/greeter-yolo/types";

interface GreeterYoloInnerProps {
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

export function GreeterYoloInner({
  callId,
  compliments,
  addCompliment,
  addLog,
  onAgentPresenceChange,
  onTrustedAgentEvent,
  onLocalCallingStateChange,
}: GreeterYoloInnerProps) {
  const {
    botState,
    hasAgent,
    agentAudioStream,
    displayComplimentText,
    currentComplimentId,
    isComplimentVisible,
    revealedWordCount,
  } = useGreeterBotState({
    callId,
    compliments,
    addCompliment,
    addLog,
    onAgentPresenceChange,
    onTrustedAgentEvent,
    onLocalCallingStateChange,
  });

  return (
    <GreeterLiveScreen
      botState={botState}
      hasAgent={hasAgent}
      agentAudioStream={agentAudioStream}
      displayComplimentText={displayComplimentText}
      currentComplimentId={currentComplimentId}
      isComplimentVisible={isComplimentVisible}
      revealedWordCount={revealedWordCount}
    />
  );
}
