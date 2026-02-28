"use client";

import { useCallback, useRef, useState } from "react";
import type {
  AddLogFn,
  ComplimentEntry,
  LogEntry,
} from "@/components/greeter-yolo/types";

export function useGreeterEntries() {
  const [compliments, setCompliments] = useState<ComplimentEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const nextId = useRef(0);

  const addCompliment = useCallback((text: string) => {
    const hasBusinessMention =
      /store|shop|arrivals|collection|inside|check out|browse/i.test(text);

    setCompliments((prev) => [
      ...prev,
      { id: nextId.current++, text, timestamp: new Date(), hasBusinessMention },
    ]);
  }, []);

  const addLog: AddLogFn = useCallback((type, message) => {
    setLogs((prev) => [
      ...prev,
      { id: nextId.current++, type, message, timestamp: new Date() },
    ]);
  }, []);

  return {
    compliments,
    logs,
    addCompliment,
    addLog,
  };
}
