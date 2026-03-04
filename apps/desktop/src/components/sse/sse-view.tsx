import { useState, useRef, useEffect, useMemo } from "react";
import { useActiveTab } from "@/stores/tab-store";
import { useTabStore } from "@/stores/tab-store";
import { useSSE } from "@/hooks/use-sse";
import { KeyValueEditor } from "@/components/request/key-value-editor";
import { Plug, Unplug, Trash2, ChevronDown, ChevronRight } from "lucide-react";

export function SSEView() {
  const tab = useActiveTab();
  const { setUrl, setHeaders } = useTabStore();
  const [filter, setFilter] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [showHeaders, setShowHeaders] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const connectionId = tab?.id ?? "";
  const { status, events, error, connect, disconnect, clearEvents } =
    useSSE(connectionId);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const filteredEvents = useMemo(() => {
    if (!filter.trim()) return events;
    const q = filter.toLowerCase();
    return events.filter((e) => e.eventType.toLowerCase().includes(q));
  }, [events, filter]);

  if (!tab) return null;

  const handleConnect = () => {
    if (status === "connected") {
      disconnect();
    } else {
      connect(tab.url, tab.headers.filter((h) => h.key.trim() && h.enabled));
    }
  };

  // Unique event types for stats
  const eventTypes = [...new Set(events.map((e) => e.eventType))];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* URL Bar */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs font-bold text-orange-400">
          SSE
        </span>
        <input
          type="text"
          value={tab.url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/events"
          className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
          disabled={status === "connected"}
        />
        <div className="flex items-center gap-1">
          <span
            className={`h-2 w-2 rounded-full ${
              status === "connected"
                ? "bg-green-500"
                : status === "connecting"
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-gray-500"
            }`}
          />
          <span className="text-xs text-[var(--color-text-muted)] capitalize">{status}</span>
        </div>
        <button
          onClick={handleConnect}
          disabled={status === "connecting" || !tab.url.trim()}
          className={`flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${
            status === "connected"
              ? "bg-red-600 hover:bg-red-700"
              : "bg-orange-600 hover:bg-orange-700"
          }`}
        >
          {status === "connected" ? (
            <>
              <Unplug className="h-3.5 w-3.5" />
              Disconnect
            </>
          ) : (
            <>
              <Plug className="h-3.5 w-3.5" />
              {status === "connecting" ? "Connecting..." : "Connect"}
            </>
          )}
        </button>
      </div>

      {/* Headers (collapsible) */}
      <div className="border-b border-[var(--color-border)]">
        <button
          onClick={() => setShowHeaders(!showHeaders)}
          className="flex w-full items-center gap-1 px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        >
          {showHeaders ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          Headers
          {tab.headers.filter((h) => h.key.trim()).length > 0 && (
            <span className="text-[10px]">({tab.headers.filter((h) => h.key.trim()).length})</span>
          )}
        </button>
        {showHeaders && (
          <div className="px-3 pb-2">
            <KeyValueEditor
              pairs={tab.headers}
              onChange={setHeaders}
              keyPlaceholder="Header"
              valuePlaceholder="Value"
            />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border-b border-[var(--color-border)] bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Stats and filter bar */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-muted)]">
        <div className="flex gap-3">
          <span>Events: {events.length}</span>
          {eventTypes.length > 0 && (
            <span>Types: {eventTypes.join(", ")}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by event type..."
            className="w-36 rounded bg-[var(--color-elevated)] px-2 py-0.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
          />
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="h-3 w-3"
            />
            Auto-scroll
          </label>
          <button
            onClick={clearEvents}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[var(--color-elevated)]"
            title="Clear events"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Event stream */}
      <div ref={logRef} className="flex-1 overflow-auto">
        {filteredEvents.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-[var(--color-text-dimmed)]">
            {status === "connected" ? "Waiting for events..." : "Connect to start streaming"}
          </div>
        ) : (
          filteredEvents.map((event, i) => (
            <div
              key={i}
              className="border-b border-[var(--color-border)] px-3 py-2"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-medium text-orange-400">
                  {event.eventType}
                </span>
                {event.id && (
                  <span className="text-[10px] text-[var(--color-text-dimmed)]">
                    id: {event.id}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-[var(--color-text-dimmed)]">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs text-[var(--color-text-primary)]">
                {event.data}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
