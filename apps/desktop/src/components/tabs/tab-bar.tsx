import { useState, useRef, useEffect } from "react";
import type { HttpMethod, Tab } from "@apiark/types";
import { useTabStore } from "@/stores/tab-store";
import { Plus, X, Globe, Zap, Radio, ChevronDown } from "lucide-react";

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "text-green-500",
  POST: "text-yellow-500",
  PUT: "text-blue-500",
  PATCH: "text-purple-500",
  DELETE: "text-red-500",
  HEAD: "text-cyan-500",
  OPTIONS: "text-gray-500",
};

function TabBadge({ tab }: { tab: Tab }) {
  switch (tab.protocol) {
    case "graphql":
      return (
        <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-bold text-purple-400">
          GQL
        </span>
      );
    case "websocket":
      return (
        <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-400">
          WS
        </span>
      );
    case "sse":
      return (
        <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-bold text-orange-400">
          SSE
        </span>
      );
    default:
      return (
        <span className={`text-[10px] font-bold ${METHOD_COLORS[tab.method]}`}>
          {tab.method}
        </span>
      );
  }
}

function NewTabDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { newTab, newGraphQLTab, newWebSocketTab, newSSETab } = useTabStore();

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const items = [
    { label: "HTTP Request", icon: Globe, action: newTab },
    { label: "GraphQL", icon: Globe, action: newGraphQLTab, color: "text-purple-400" },
    { label: "WebSocket", icon: Zap, action: newWebSocketTab, color: "text-cyan-400" },
    { label: "SSE", icon: Radio, action: newSSETab, color: "text-orange-400" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex shrink-0 items-center gap-0.5 p-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
        title="New Tab"
      >
        <Plus className="h-4 w-4" />
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded border border-[var(--color-border)] bg-[var(--color-elevated)] py-1 shadow-lg">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.action();
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
            >
              <item.icon className={`h-3.5 w-3.5 ${item.color ?? "text-[var(--color-text-muted)]"}`} />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabStore();

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="flex flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group flex shrink-0 items-center gap-1.5 border-r border-[var(--color-border)] px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
                  : "bg-[var(--color-bg)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              <TabBadge tab={tab} />
              <span className="max-w-[120px] truncate">{tab.name}</span>
              {tab.isDirty && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-muted)]" />
              )}
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 rounded p-0.5 opacity-0 hover:bg-[var(--color-border)] group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </span>
            </button>
          );
        })}
      </div>
      <NewTabDropdown />
    </div>
  );
}
