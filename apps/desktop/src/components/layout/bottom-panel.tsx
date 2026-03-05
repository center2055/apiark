import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useConsoleStore, type ConsoleLogEntry } from "@/stores/console-store";
import { Terminal, ScrollText, ChevronDown, Trash2, Filter } from "lucide-react";

const TerminalPanel = lazy(() =>
  import("@/components/terminal/terminal-panel").then((m) => ({
    default: m.TerminalPanel,
  })),
);

type BottomTab = "console" | "terminal";

interface BottomPanelProps {
  terminalOpen: boolean;
  onTerminalOpenChange: (open: boolean) => void;
}

export function BottomPanel({ terminalOpen, onTerminalOpenChange }: BottomPanelProps) {
  const consoleOpen = useConsoleStore((s) => s.open);
  const [activeTab, setActiveTab] = useState<BottomTab>("console");
  const [height, setHeight] = useState(250);
  const [resizing, setResizing] = useState(false);

  const isOpen = (activeTab === "console" && consoleOpen) || (activeTab === "terminal" && terminalOpen);

  // If one panel opens, show it
  useEffect(() => {
    if (consoleOpen && !terminalOpen) setActiveTab("console");
    if (terminalOpen && !consoleOpen) setActiveTab("terminal");
  }, [consoleOpen, terminalOpen]);

  const toggleTab = useCallback((tab: BottomTab) => {
    if (activeTab === tab && isOpen) {
      if (tab === "console") useConsoleStore.getState().setOpen(false);
      else onTerminalOpenChange(false);
    } else {
      setActiveTab(tab);
      if (tab === "console") useConsoleStore.getState().setOpen(true);
      else onTerminalOpenChange(true);
    }
  }, [activeTab, isOpen, onTerminalOpenChange]);

  const closePanel = useCallback(() => {
    if (activeTab === "console") useConsoleStore.getState().setOpen(false);
    else onTerminalOpenChange(false);
  }, [activeTab, onTerminalOpenChange]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setResizing(true);
      const startY = e.clientY;
      const startH = height;

      const onMouseMove = (ev: MouseEvent) => {
        const newH = Math.max(120, Math.min(600, startH - (ev.clientY - startY)));
        setHeight(newH);
      };
      const onMouseUp = () => {
        setResizing(false);
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [height],
  );

  if (!isOpen) return null;

  return (
    <div
      className="flex flex-col border-t border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ height }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`h-1 cursor-row-resize transition-colors hover:bg-[var(--color-accent)]/30 ${resizing ? "bg-[var(--color-accent)]/30" : ""}`}
      />

      {/* Tab bar */}
      <div className="flex items-center border-b border-[var(--color-border)] px-1">
        <PanelTab
          icon={ScrollText}
          label="Console"
          active={activeTab === "console"}
          onClick={() => toggleTab("console")}
        />
        <PanelTab
          icon={Terminal}
          label="Terminal"
          active={activeTab === "terminal"}
          onClick={() => toggleTab("terminal")}
        />

        <div className="flex-1" />

        {/* Console-specific controls */}
        {activeTab === "console" && <ConsoleControls />}

        <button
          onClick={closePanel}
          className="rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-secondary)]"
          title="Close panel"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "console" ? (
          <ConsoleContent />
        ) : (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-sm text-[var(--color-text-dimmed)]">
                Loading terminal...
              </div>
            }
          >
            <TerminalPanel />
          </Suspense>
        )}
      </div>
    </div>
  );
}

function PanelTab({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Terminal;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-b-2 border-[var(--color-accent)] text-[var(--color-text-primary)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function ConsoleControls() {
  const filter = useConsoleStore((s) => s.filter);
  const setFilter = useConsoleStore((s) => s.setFilter);
  const clear = useConsoleStore((s) => s.clear);

  return (
    <div className="flex items-center gap-2 pr-1">
      <div className="flex items-center gap-0.5 rounded-lg bg-[var(--color-elevated)] p-0.5">
        <Filter className="mx-1 h-3 w-3 text-[var(--color-text-dimmed)]" />
        {(["all", "log", "info", "warn", "error"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
              filter === f
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <button
        onClick={clear}
        className="rounded-md p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-secondary)]"
        title="Clear console"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ConsoleContent() {
  const entries = useConsoleStore((s) => s.entries);
  const filter = useConsoleStore((s) => s.filter);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered =
    filter === "all" ? entries : entries.filter((e) => e.level === filter);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [filtered.length]);

  return (
    <div ref={listRef} className="h-full overflow-auto font-mono text-xs">
      {filtered.length === 0 ? (
        <div className="flex h-full items-center justify-center text-[var(--color-text-dimmed)]">
          No console output
        </div>
      ) : (
        filtered.map((entry) => <ConsoleRow key={entry.id} entry={entry} />)
      )}
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
    warn: "text-amber-400",
    error: "text-[var(--color-error)]",
  };

  const bgColors: Record<string, string> = {
    log: "",
    info: "",
    warn: "bg-amber-500/5",
    error: "bg-red-500/5",
  };

  return (
    <div className={`flex gap-2 border-b border-[var(--color-border)]/30 px-3 py-1 ${bgColors[entry.level] ?? ""}`}>
      <span className="shrink-0 text-[var(--color-text-dimmed)]">{time}</span>
      <span className={`w-10 shrink-0 uppercase ${levelColors[entry.level] ?? ""}`}>
        {entry.level}
      </span>
      <span className="shrink-0 text-[var(--color-text-muted)]">[{entry.source}]</span>
      <span className="flex-1 whitespace-pre-wrap break-all text-[var(--color-text-primary)]">
        {entry.message}
      </span>
    </div>
  );
}
