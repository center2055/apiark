import { useEffect, useState, useCallback, useRef } from "react";
import type { WsMessage, WsStatus, KeyValuePair } from "@apiark/types";
import { wsConnect, wsSend, wsDisconnect } from "@/lib/tauri-api";

interface UseWebSocketReturn {
  status: "disconnected" | "connecting" | "connected";
  messages: WsMessage[];
  error: string | null;
  connect: (url: string, headers: KeyValuePair[]) => Promise<void>;
  send: (message: string) => Promise<void>;
  disconnect: () => Promise<void>;
  clearMessages: () => void;
}

export function useWebSocket(connectionId: string): UseWebSocketReturn {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [messages, setMessages] = useState<WsMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const unlistenersRef = useRef<(() => void)[]>([]);

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");

        const unlistenStatus = await listen<WsStatus>("ws:status", (event) => {
          if (cancelled || event.payload.connectionId !== connectionId) return;
          setStatus(event.payload.state as "disconnected" | "connecting" | "connected");
          setError(event.payload.error ?? null);
        });

        const unlistenMessage = await listen<WsMessage>("ws:message", (event) => {
          if (cancelled || event.payload.connectionId !== connectionId) return;
          setMessages((prev) => [...prev, event.payload]);
        });

        unlistenersRef.current = [unlistenStatus, unlistenMessage];
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
        await wsConnect(connectionId, { url, headers, protocols: [] });
      } catch (err) {
        setError(String(err));
        setStatus("disconnected");
      }
    },
    [connectionId],
  );

  const send = useCallback(
    async (message: string) => {
      try {
        await wsSend(connectionId, message);
      } catch (err) {
        setError(String(err));
      }
    },
    [connectionId],
  );

  const disconnect = useCallback(async () => {
    try {
      await wsDisconnect(connectionId);
    } catch (err) {
      setError(String(err));
    }
  }, [connectionId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { status, messages, error, connect, send, disconnect, clearMessages };
}
