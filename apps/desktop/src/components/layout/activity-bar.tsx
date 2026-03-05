import {
  FolderOpen,
  Globe,
  Clock,
  Settings,
  Terminal,
  Server,
  FileText,
  Activity,
  Sparkles,
} from "lucide-react";

export type ActivityView = "collections" | "environments" | "history" | "mock" | "monitor" | "docs";

interface ActivityBarProps {
  activeView: ActivityView;
  onViewChange: (view: ActivityView) => void;
  onOpenSettings: () => void;
  onOpenAi: () => void;
  onToggleConsole: () => void;
}

const TOP_ITEMS: { id: ActivityView; icon: typeof FolderOpen; label: string; color: string; glow: string }[] = [
  { id: "collections", icon: FolderOpen, label: "Collections", color: "text-blue-400", glow: "bg-blue-400/10" },
  { id: "environments", icon: Globe, label: "Environments", color: "text-emerald-400", glow: "bg-emerald-400/10" },
  { id: "history", icon: Clock, label: "History", color: "text-amber-400", glow: "bg-amber-400/10" },
];

const BOTTOM_ITEMS: { id: ActivityView; icon: typeof Server; label: string; color: string; glow: string }[] = [
  { id: "mock", icon: Server, label: "Mock Servers", color: "text-violet-400", glow: "bg-violet-400/10" },
  { id: "monitor", icon: Activity, label: "Monitors", color: "text-rose-400", glow: "bg-rose-400/10" },
  { id: "docs", icon: FileText, label: "API Docs", color: "text-cyan-400", glow: "bg-cyan-400/10" },
];

export function ActivityBar({
  activeView,
  onViewChange,
  onOpenSettings,
  onOpenAi,
  onToggleConsole,
}: ActivityBarProps) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center border-r border-[var(--color-border)] bg-[var(--color-activity-bar)] py-3">
      {/* Logo */}
      <div className="mb-4 flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)]">
        <span className="text-xs font-black text-white">A</span>
      </div>

      {/* Top nav items */}
      <div className="flex flex-col items-center gap-1">
        {TOP_ITEMS.map((item) => (
          <ActivityBarButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeView === item.id}
            activeColor={item.color}
            activeGlow={item.glow}
            onClick={() => onViewChange(item.id)}
          />
        ))}
      </div>

      <div className="mx-auto my-3 h-px w-6 bg-[var(--color-border)]" />

      {/* Bottom nav items */}
      <div className="flex flex-col items-center gap-1">
        {BOTTOM_ITEMS.map((item) => (
          <ActivityBarButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeView === item.id}
            activeColor={item.color}
            activeGlow={item.glow}
            onClick={() => onViewChange(item.id)}
          />
        ))}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-1">
        <ActivityBarButton icon={Sparkles} label="AI Assistant (Ctrl+Shift+A)" onClick={onOpenAi} activeColor="text-purple-400" activeGlow="bg-purple-400/10" />
        <ActivityBarButton icon={Terminal} label="Console (Ctrl+`)" onClick={onToggleConsole} activeColor="text-orange-400" activeGlow="bg-orange-400/10" />
        <ActivityBarButton icon={Settings} label="Settings (Ctrl+,)" onClick={onOpenSettings} />
      </div>
    </div>
  );
}

function ActivityBarButton({
  icon: Icon,
  label,
  active,
  activeColor,
  activeGlow,
  onClick,
}: {
  icon: typeof FolderOpen;
  label: string;
  active?: boolean;
  activeColor?: string;
  activeGlow?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-all ${
        active
          ? `${activeGlow ?? "bg-[var(--color-accent-glow)]"} ${activeColor ?? "text-[var(--color-accent)]"}`
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-secondary)]"
      }`}
    >
      {active && (
        <span className={`absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r ${activeColor ? activeColor.replace("text-", "bg-") : "bg-[var(--color-accent)]"}`} />
      )}
      <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2 : 1.5} />
    </button>
  );
}
