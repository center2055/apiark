import { useEffect, useRef, useCallback, useState } from "react";
import { useConsoleStore, type ConsoleLogEntry } from "@/stores/console-store";
import { Terminal, Trash2, ChevronDown, Filter } from "lucide-react";

export function ConsoleBottomBar() {
  const { entries, open, height, filter, toggle, clear, setHeight, setFilter } =
    useConsoleStore();
  const listRef = useRef<HTMLDivElement>(null);
  const [resizing, setResizing] = useState(false);

  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.level === filter);

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (open && listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filtered.length, open]);

  // Resize via drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizing(true);
      const startY = e.clientY;
      const startHeight = height;

      const onMouseMove = (ev: MouseEvent) => {
        setHeight(startHeight - (ev.clientY - startY));
      };
      const onMouseUp = () => {
        setResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [height, setHeight],
  );

  if (!open) {
    return (
      <button
        onClick={toggle}
        className="flex items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-primary)]"
      >
        <Terminal className="h-3.5 w-3.5" />
        Console
        {entries.length > 0 && (
          <span className="rounded-full bg-[var(--color-accent)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--color-accent)]">
            {entries.length}
          </span>
        )}
        <ChevronDown className="ml-auto h-3 w-3 rotate-180 text-[var(--color-text-dimmed)]" />
      </button>
    );
  }

  return (
    <div
      className="flex flex-col border-t border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ height }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-1 cursor-row-resize hover:bg-[var(--color-accent)]/30 ${resizing ? "bg-[var(--color-accent)]/30" : ""}`}
      />

      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-1">
        <Terminal className="h-3 w-3 text-[var(--color-text-muted)]" />
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          Console
        </span>
        <span className="text-[10px] text-[var(--color-text-dimmed)]">
          {filtered.length} entries
        </span>

        <div className="flex-1" />

        {/* Filter */}
        <div className="flex items-center gap-0.5">
          <Filter className="mr-1 h-3 w-3 text-[var(--color-text-dimmed)]" />
          {(["all", "log", "info", "warn", "error"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-1.5 py-0.5 text-[10px] ${
                filter === f
                  ? "bg-[var(--color-accent)] text-white"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={clear}
          className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-secondary)]"
          title="Clear console"
        >
          <Trash2 className="h-3 w-3" />
        </button>
        <button
          onClick={toggle}
          className="rounded p-0.5 text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-secondary)]"
          title="Close console"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Log entries */}
      <div ref={listRef} className="flex-1 overflow-auto font-mono text-xs">
        {filtered.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[var(--color-text-dimmed)]">
            No console output
          </div>
        ) : (
          filtered.map((entry) => <ConsoleRow key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}

function ConsoleRow({ entry }: { entry: ConsoleLogEntry }) {
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const levelColors: Record<string, string> = {
    log: "text-[var(--color-text-secondary)]",
    info: "text-blue-400",
    warn: "text-yellow-400",
    error: "text-red-400",
  };

  const bgColors: Record<string, string> = {
    log: "",
    info: "",
    warn: "bg-yellow-500/5",
    error: "bg-red-500/5",
  };

  return (
    <div
      className={`flex gap-2 border-b border-[var(--color-border)]/50 px-3 py-0.5 ${bgColors[entry.level] ?? ""}`}
    >
      <span className="shrink-0 text-[var(--color-text-dimmed)]">{time}</span>
      <span
        className={`w-10 shrink-0 uppercase ${levelColors[entry.level] ?? ""}`}
      >
        {entry.level}
      </span>
      <span className="shrink-0 text-[var(--color-text-muted)]">
        [{entry.source}]
      </span>
      <span className="flex-1 whitespace-pre-wrap break-all text-[var(--color-text-primary)]">
        {entry.message}
      </span>
    </div>
  );
}
