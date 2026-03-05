import { useEnvironmentStore } from "@/stores/environment-store";
import { useCollectionStore } from "@/stores/collection-store";
import { useMockStore } from "@/stores/mock-store";
import { useMonitorStore } from "@/stores/monitor-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useConsoleStore } from "@/stores/console-store";
import { Globe, FolderOpen, Server, Activity, Columns2, Rows2, Terminal, ScrollText } from "lucide-react";
import type { AppSettings } from "@apiark/types";

interface StatusBarProps {
  onToggleTerminal?: () => void;
  terminalOpen?: boolean;
}

export function StatusBar({ onToggleTerminal, terminalOpen }: StatusBarProps) {
  const activeEnv = useEnvironmentStore((s) => s.activeEnvironmentName);
  const collections = useCollectionStore((s) => s.collections);
  const mockServers = useMockStore((s) => s.servers);
  const monitors = useMonitorStore((s) => s.monitors);
  const layout = useSettingsStore((s) => s.settings.layout);
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const consoleEntries = useConsoleStore((s) => s.entries);
  const consoleOpen = useConsoleStore((s) => s.open);
  const toggleConsole = useConsoleStore((s) => s.toggle);
  const hasErrors = consoleEntries.some((e) => e.level === "error");

  const runningMocks = mockServers.filter((s) => s.running).length;
  const activeMonitors = monitors.filter((m) => m.enabled).length;

  const toggleLayout = () => {
    const next: AppSettings["layout"] = layout === "horizontal" ? "vertical" : "horizontal";
    updateSettings({ layout: next });
  };

  return (
    <div className="flex h-6 shrink-0 items-center border-t border-[var(--color-border)] bg-[var(--color-activity-bar)] px-2 text-[11px]">
      {/* Left side */}
      <div className="flex items-center gap-3">
        {activeEnv && (
          <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <Globe className="h-3 w-3" />
            {activeEnv}
          </span>
        )}
        {collections.length > 0 && (
          <span className="flex items-center gap-1 text-[var(--color-text-muted)]">
            <FolderOpen className="h-3 w-3" />
            {collections.length} collection{collections.length !== 1 ? "s" : ""}
          </span>
        )}
        {runningMocks > 0 && (
          <span className="flex items-center gap-1 text-[var(--color-success)]">
            <Server className="h-3 w-3" />
            {runningMocks} mock{runningMocks !== 1 ? "s" : ""}
          </span>
        )}
        {activeMonitors > 0 && (
          <span className="flex items-center gap-1 text-[var(--color-success)]">
            <Activity className="h-3 w-3" />
            {activeMonitors} monitor{activeMonitors !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="flex-1" />

      {/* Right side */}
      <div className="flex items-center gap-2">
        {/* Console toggle */}
        <button
          onClick={toggleConsole}
          className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
            consoleOpen
              ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
              : "text-[var(--color-text-dimmed)] hover:text-[var(--color-text-secondary)]"
          }`}
          title="Toggle Console"
        >
          <ScrollText className="h-3 w-3" />
          {consoleEntries.length > 0 && (
            <span className={`text-[10px] font-bold ${hasErrors ? "text-[var(--color-error)]" : ""}`}>
              {consoleEntries.length}
            </span>
          )}
        </button>

        {/* Terminal toggle */}
        {onToggleTerminal && (
          <button
            onClick={onToggleTerminal}
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors ${
              terminalOpen
                ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)]"
                : "text-[var(--color-text-dimmed)] hover:text-[var(--color-text-secondary)]"
            }`}
            title="Toggle Terminal (Ctrl+`)"
          >
            <Terminal className="h-3 w-3" />
          </button>
        )}

        {/* Layout toggle */}
        <button
          onClick={toggleLayout}
          className="flex items-center gap-1 text-[var(--color-text-dimmed)] transition-colors hover:text-[var(--color-text-secondary)]"
          title={layout === "horizontal" ? "Switch to stacked layout" : "Switch to side-by-side layout"}
        >
          {layout === "horizontal" ? (
            <Columns2 className="h-3 w-3" />
          ) : (
            <Rows2 className="h-3 w-3" />
          )}
        </button>

        <span className="text-[var(--color-text-dimmed)]">ApiArk v0.1.0</span>
      </div>
    </div>
  );
}
