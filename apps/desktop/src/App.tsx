import { useEffect, useState, useCallback } from "react";
import { CollectionSidebar } from "@/components/collection/collection-sidebar";
import { TabBar } from "@/components/tabs/tab-bar";
import { UrlBar } from "@/components/request/url-bar";
import { RequestPanel } from "@/components/request/request-panel";
import { ResponsePanel } from "@/components/response/response-panel";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { CurlImportDialog } from "@/components/request/curl-import-dialog";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { GraphQLView } from "@/components/graphql/graphql-view";
import { WebSocketView } from "@/components/websocket/websocket-view";
import { SSEView } from "@/components/sse/sse-view";
import { CollectionRunnerDialog } from "@/components/runner/collection-runner-dialog";
import type { TabProtocol } from "@apiark/types";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { useHistoryStore } from "@/stores/history-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useTheme } from "@/hooks/use-theme";

function App() {
  const { newTab, closeTab, save, persistTabs, restoreTabs } = useTabStore();
  const activeTab = useActiveTab();
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const { loadSettings } = useSettingsStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [curlImportOpen, setCurlImportOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);

  useTheme();

  // Load settings and restore tabs on mount
  useEffect(() => {
    loadSettings();
    restoreTabs();
  }, [loadSettings, restoreTabs]);

  // Persist tabs on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => persistTabs(), 500);
    return () => clearTimeout(timer);
  }, [tabs, activeTabId, persistTabs]);

  // Persist tabs on window close
  useEffect(() => {
    const handleBeforeUnload = () => persistTabs();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [persistTabs]);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openCurlImport = useCallback(() => setCurlImportOpen(true), []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      switch (e.key.toLowerCase()) {
        case "n":
        case "t":
          e.preventDefault();
          newTab();
          break;
        case "w":
          e.preventDefault();
          if (activeTab) closeTab(activeTab.id);
          break;
        case "s":
          e.preventDefault();
          save();
          break;
        case ",":
          e.preventDefault();
          setSettingsOpen(true);
          break;
        case "i":
          e.preventDefault();
          setCurlImportOpen(true);
          break;
        case "k":
          e.preventDefault();
          setCommandPaletteOpen(true);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [newTab, closeTab, save, activeTab]);

  // Refresh history when a request completes
  useEffect(() => {
    if (activeTab && !activeTab.loading && (activeTab.response || activeTab.error)) {
      useHistoryStore.getState().loadHistory();
    }
  }, [activeTab?.loading, activeTab?.response, activeTab?.error]);

  return (
    <div className="flex h-screen bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      {/* Sidebar */}
      <CollectionSidebar onOpenSettings={openSettings} />

      {/* Main Panel */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Tab Bar */}
        <TabBar />

        {activeTab ? (
          <ProtocolView protocol={activeTab.protocol} />
        ) : (
          <EmptyState />
        )}
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CurlImportDialog open={curlImportOpen} onOpenChange={setCurlImportOpen} />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onOpenSettings={openSettings}
        onOpenCurlImport={openCurlImport}
        onOpenRunner={() => setRunnerOpen(true)}
      />
      <CollectionRunnerDialog open={runnerOpen} onOpenChange={setRunnerOpen} />
    </div>
  );
}

function ProtocolView({ protocol }: { protocol: TabProtocol }) {
  switch (protocol) {
    case "graphql":
      return <GraphQLView />;
    case "websocket":
      return <WebSocketView />;
    case "sse":
      return <SSEView />;
    default:
      return (
        <>
          <UrlBar />
          <div className="flex flex-1 overflow-hidden">
            <div className="flex w-1/2 flex-col border-r border-[var(--color-border)]">
              <RequestPanel />
            </div>
            <div className="flex w-1/2 flex-col">
              <ResponsePanel />
            </div>
          </div>
        </>
      );
  }
}

function EmptyState() {
  const { newTab } = useTabStore();
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-sm text-[var(--color-text-dimmed)]">
        Open a request from the sidebar, or press{" "}
        <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-elevated)] px-1.5 py-0.5 text-xs text-[var(--color-text-secondary)]">
          Ctrl+N
        </kbd>{" "}
        to create one
      </p>
      <button
        onClick={newTab}
        className="rounded bg-[var(--color-elevated)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
      >
        New Request
      </button>
    </div>
  );
}

export default App;
