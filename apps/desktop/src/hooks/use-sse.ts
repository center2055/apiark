import { useEffect, useState, useCallback, useRef } from "react";
import type { SseEvent, SseStatus, KeyValuePair } from "@apiark/types";
import { sseConnect, sseDisconnect } from "@/lib/tauri-api";

interface UseSSEReturn {
  status: "disconnected" | "connecting" | "connected";
  events: SseEvent[];
  error: string | null;
  connect: (url: string, headers: KeyValuePair[]) => Promise<void>;
  disconnect: () => Promise<void>;
  clearEvents: () => void;
}

export function useSSE(connectionId: string): UseSSEReturn {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const unlistenersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        const unlistenStatus = await listen<SseStatus>("sse:status", (event) => {
          if (cancelled || event.payload.connectionId !== connectionId) return;
          setStatus(event.payload.state as "disconnected" | "connecting" | "connected");
          setError(event.payload.error ?? null);
        });

        const unlistenEvent = await listen<SseEvent>("sse:event", (event) => {
          if (cancelled || event.payload.connectionId !== connectionId) return;
          setEvents((prev) => [...prev, event.payload]);
        });

        unlistenersRef.current = [unlistenStatus, unlistenEvent];
      } catch {
        // Not in Tauri env
      }
    };

    setup();

    return () => {
      cancelled = true;
      for (const unlisten of unlistenersRef.current) {
        unlisten();
      }
      unlistenersRef.current = [];
    };
  }, [connectionId]);

  const connect = useCallback(
    async (url: string, headers: KeyValuePair[]) => {
      setError(null);
      try {
        await sseConnect(connectionId, { url, headers });
      } catch (err) {
        setError(String(err));
        setStatus("disconnected");
      }
    },
    [connectionId],
  );

  const disconnect = useCallback(async () => {
    try {
      await sseDisconnect(connectionId);
    } catch (err) {
      setError(String(err));
    }
  }, [connectionId]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return { status, events, error, connect, disconnect, clearEvents };
}
