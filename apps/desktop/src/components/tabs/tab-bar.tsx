import { useState, useRef, useEffect } from "react";
import type { HttpMethod, Tab } from "@apiark/types";
import { useTabStore } from "@/stores/tab-store";
import { Plus, X, Globe, Zap, Radio, ChevronDown } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
    case "grpc":
      return (
        <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[10px] font-bold text-green-400">
          gRPC
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

function SortableTab({
  tab,
  isActive,
  onActivate,
  onClose,
  onDetach,
  onCloseOthers,
  onCloseAll,
}: {
  tab: Tab;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onDetach: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
}) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <button
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={onActivate}
        onContextMenu={handleContextMenu}
        className={`group relative flex shrink-0 items-center gap-2 px-4 py-2 text-sm transition-all ${
          isActive
            ? "bg-[var(--color-surface)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/50 hover:text-[var(--color-text-secondary)]"
        }`}
      >
        {isActive && (
          <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-accent)]" />
        )}
        <TabBadge tab={tab} />
        <span className="max-w-[140px] truncate">{tab.name}</span>
        {tab.isDirty && (
          <span className="h-2 w-2 rounded-full bg-orange-400/80" />
        )}
        <span
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity hover:bg-[var(--color-border)] group-hover:opacity-100"
        >
          <X className="h-3 w-3" />
        </span>
      </button>
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[180px] rounded border border-[var(--color-border)] bg-[var(--color-elevated)] py-1 shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            onClick={() => { onClose(); setContextMenu(null); }}
            className="flex w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
          >
            Close
          </button>
          <button
            onClick={() => { onCloseOthers(); setContextMenu(null); }}
            className="flex w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
          >
            Close Others
          </button>
          <button
            onClick={() => { onCloseAll(); setContextMenu(null); }}
            className="flex w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
          >
            Close All
          </button>
          <div className="my-1 border-t border-[var(--color-border)]" />
          <button
            onClick={() => { onDetach(); setContextMenu(null); }}
            className="flex w-full px-3 py-1.5 text-left text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
          >
            Move to New Window
          </button>
        </div>
      )}
    </>
  );
}

function NewTabDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { newTab, newGraphQLTab, newWebSocketTab, newSSETab, newGrpcTab } = useTabStore();

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
    { label: "gRPC", icon: Globe, action: newGrpcTab, color: "text-green-400" },
  ];

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen(!open)}
        className="mx-2 flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] px-2.5 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent)]/10 hover:text-[var(--color-accent)]"
        title="New Tab"
      >
        <Plus className="h-3.5 w-3.5" />
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
  const { tabs, activeTabId, setActiveTab, closeTab, closeOtherTabs, closeAllTabs, reorderTabs, detachTab } = useTabStore();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = tabs.findIndex((t) => t.id === active.id);
    const toIndex = tabs.findIndex((t) => t.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderTabs(fromIndex, toIndex);
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div data-tour="tabs" className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-bg)]/80">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={tabs.map((t) => t.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-1 overflow-x-auto">
            {tabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={tab.id === activeTabId}
                onActivate={() => setActiveTab(tab.id)}
                onClose={() => closeTab(tab.id)}
                onDetach={() => detachTab(tab.id)}
                onCloseOthers={() => closeOtherTabs(tab.id)}
                onCloseAll={() => closeAllTabs()}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <NewTabDropdown />
    </div>
  );
}
