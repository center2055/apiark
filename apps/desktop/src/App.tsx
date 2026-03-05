import { useEffect, useState, useCallback, useRef } from "react";
import { CollectionSidebar } from "@/components/collection/collection-sidebar";
import { TabBar } from "@/components/tabs/tab-bar";
import { UrlBar } from "@/components/request/url-bar";
import { RequestPanel } from "@/components/request/request-panel";
import { ResponsePanel } from "@/components/response/response-panel";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { CurlImportDialog } from "@/components/request/curl-import-dialog";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { GraphQLView } from "@/components/graphql/graphql-view";
import { GrpcView } from "@/components/grpc/grpc-view";
import { WebSocketView } from "@/components/websocket/websocket-view";
import { SSEView } from "@/components/sse/sse-view";
import { CollectionRunnerDialog } from "@/components/runner/collection-runner-dialog";
import { ImportDialog } from "@/components/import/import-dialog";
import type { TabProtocol } from "@apiark/types";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { useConsoleStore } from "@/stores/console-store";
import { useHistoryStore } from "@/stores/history-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useTheme } from "@/hooks/use-theme";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useFileWatcher } from "@/hooks/use-file-watcher";
import { ResponseDiffDialog } from "@/components/response/response-diff-dialog";
import { MockServerDialog } from "@/components/mock/mock-server-dialog";
import { MonitorDialog } from "@/components/scheduler/monitor-dialog";
import { DocsPreviewDialog } from "@/components/docs/docs-preview-dialog";
import { useDocsStore } from "@/stores/docs-store";
import { WelcomeScreen } from "@/components/onboarding/welcome-screen";
import { GuidedTour } from "@/components/onboarding/guided-tour";
import { ConsoleBottomBar } from "@/components/console/console-panel";
import { useCollectionStore } from "@/stores/collection-store";
import { AlertCircle, X, RefreshCw, FileX, GitMerge, Shield } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";

function App() {
  const { newTab, closeTab, save, send, persistTabs, restoreTabs, undoTab, redoTab } = useTabStore();
  const activeTab = useActiveTab();
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const { loadSettings } = useSettingsStore();
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const onboardingComplete = useSettingsStore((s) => s.settings.onboardingComplete);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [curlImportOpen, setCurlImportOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const urlBarRef = useRef<HTMLInputElement>(null);
  const envSelectorRef = useRef<HTMLSelectElement>(null);

  useTheme();
  useFileWatcher();
  const { autoSaveError } = useAutoSave();

  // Load settings and restore tabs on mount
  useEffect(() => {
    loadSettings();
    restoreTabs();
  }, [loadSettings, restoreTabs]);

  // Show welcome screen on first run
  useEffect(() => {
    if (settingsLoaded && !onboardingComplete) {
      setShowWelcome(true);
    }
  }, [settingsLoaded, onboardingComplete]);

  // Persist tabs on change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => persistTabs(), 500);
    return () => clearTimeout(timer);
  }, [tabs, activeTabId, persistTabs]);

  // Persist tabs on window close — warn about unsaved new tabs
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      persistTabs();
      if (useTabStore.getState().hasUnsavedNewTabs()) {
        e.preventDefault();
      }
    };
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

      // Ctrl+` to toggle console (no mod key conflict)
      if (e.key === "`" && mod) {
        e.preventDefault();
        useConsoleStore.getState().toggle();
        return;
      }

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
        case "e":
          e.preventDefault();
          envSelectorRef.current?.focus();
          break;
        case "l":
          e.preventDefault();
          urlBarRef.current?.focus();
          break;
        case "\\":
          e.preventDefault();
          setSidebarCollapsed((prev) => !prev);
          break;
        case "enter":
          e.preventDefault();
          send();
          break;
        case "z":
          e.preventDefault();
          if (e.shiftKey) {
            redoTab();
          } else {
            undoTab();
          }
          break;
        case "y":
          e.preventDefault();
          redoTab();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [newTab, closeTab, save, send, undoTab, redoTab, activeTab]);

  // Refresh history when a request completes
  useEffect(() => {
    if (activeTab && !activeTab.loading && (activeTab.response || activeTab.error)) {
      useHistoryStore.getState().loadHistory();
    }
  }, [activeTab?.loading, activeTab?.response, activeTab?.error]);

  if (showWelcome) {
    return (
      <WelcomeScreen
        onComplete={(startTour?: boolean) => {
          setShowWelcome(false);
          if (startTour) setShowTour(true);
        }}
        onOpenImport={() => {
          setShowWelcome(false);
          setImportOpen(true);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      {/* Crash report opt-in banner */}
      <CrashReportBanner />

      {/* Auto-save error banner */}
      {autoSaveError && (
        <div className="flex items-center gap-2 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">Auto-save failed: {autoSaveError}</span>
          <button
            onClick={() => useTabStore.getState().autoSave()}
            className="rounded bg-red-500/20 px-2 py-0.5 text-xs hover:bg-red-500/30"
          >
            Retry
          </button>
          <button
            onClick={() => useTabStore.getState().clearAutoSaveError()}
            className="rounded p-0.5 hover:bg-red-500/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* File conflict banner */}
      {activeTab?.conflictState && (
        <ConflictBanner tabId={activeTab.id} conflictState={activeTab.conflictState} />
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <CollectionSidebar
          onOpenSettings={openSettings}
          collapsed={sidebarCollapsed}
          envSelectorRef={envSelectorRef}
        />

        {/* Main Panel */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {/* Tab Bar */}
          <TabBar />

          {activeTab ? (
            <ProtocolView protocol={activeTab.protocol} urlBarRef={urlBarRef} />
          ) : (
            <EmptyState />
          )}
        </main>
      </div>

      {/* Console panel */}
      <ConsoleBottomBar />

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <CurlImportDialog open={curlImportOpen} onOpenChange={setCurlImportOpen} />
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onOpenSettings={openSettings}
        onOpenCurlImport={openCurlImport}
        onOpenRunner={() => setRunnerOpen(true)}
        onOpenImport={() => setImportOpen(true)}
      />
      <CollectionRunnerDialog open={runnerOpen} onOpenChange={setRunnerOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ResponseDiffDialog />
      <MockServerDialog />
      <MonitorDialog />
      <DocsDialogWrapper />
      {showTour && <GuidedTour onComplete={() => setShowTour(false)} />}
      <MigrationDialog />
    </div>
  );
}

function DocsDialogWrapper() {
  const { open, collectionPath, collectionName, closeDocs } = useDocsStore();
  return (
    <DocsPreviewDialog
      open={open}
      onOpenChange={(v) => { if (!v) closeDocs(); }}
      collectionPath={collectionPath}
      collectionName={collectionName}
    />
  );
}

function ProtocolView({
  protocol,
  urlBarRef,
}: {
  protocol: TabProtocol;
  urlBarRef: React.RefObject<HTMLInputElement | null>;
}) {
  switch (protocol) {
    case "graphql":
      return <GraphQLView />;
    case "grpc":
      return <GrpcView />;
    case "websocket":
      return <WebSocketView />;
    case "sse":
      return <SSEView />;
    default:
      return (
        <>
          <UrlBar ref={urlBarRef} />
          <div className="flex flex-1 overflow-hidden">
            <div data-tour="request-panel" className="flex w-1/2 flex-col border-r border-[var(--color-border)]">
              <RequestPanel />
            </div>
            <div data-tour="response-panel" className="flex w-1/2 flex-col">
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

function CrashReportBanner() {
  const { settings, updateSettings } = useSettingsStore();
  if (settings.crashReportsEnabled !== null) return null;

  return (
    <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
      <Shield className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Help improve ApiArk by sending anonymous crash reports? No request data is ever included.
      </span>
      <button
        onClick={() => updateSettings({ crashReportsEnabled: true })}
        className="rounded bg-blue-500/20 px-2 py-0.5 text-xs hover:bg-blue-500/30"
      >
        Enable
      </button>
      <button
        onClick={() => updateSettings({ crashReportsEnabled: false })}
        className="rounded bg-blue-500/20 px-2 py-0.5 text-xs hover:bg-blue-500/30"
      >
        No thanks
      </button>
    </div>
  );
}

function ConflictBanner({ tabId, conflictState }: { tabId: string; conflictState: "external-change" | "deleted" | "merge-conflict" }) {
  const { reloadFromDisk, dismissConflict, closeTab } = useTabStore();

  if (conflictState === "merge-conflict") {
    return (
      <div className="flex items-center gap-2 bg-orange-500/10 px-4 py-2 text-sm text-orange-400">
        <GitMerge className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          This file has Git merge conflicts. Please resolve them in your editor or Git tool, then reload.
        </span>
        <button
          onClick={() => reloadFromDisk(tabId)}
          className="rounded bg-orange-500/20 px-2 py-0.5 text-xs hover:bg-orange-500/30"
        >
          Reload
        </button>
        <button
          onClick={() => closeTab(tabId)}
          className="rounded bg-orange-500/20 px-2 py-0.5 text-xs hover:bg-orange-500/30"
        >
          Close
        </button>
      </div>
    );
  }

  if (conflictState === "deleted") {
    return (
      <div className="flex items-center gap-2 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-400">
        <FileX className="h-4 w-4 shrink-0" />
        <span className="flex-1">This file was deleted externally.</span>
        <button
          onClick={() => closeTab(tabId)}
          className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs hover:bg-yellow-500/30"
        >
          Close
        </button>
        <button
          onClick={() => dismissConflict(tabId)}
          className="rounded p-0.5 hover:bg-yellow-500/20"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 text-sm text-blue-400">
      <RefreshCw className="h-4 w-4 shrink-0" />
      <span className="flex-1">This file was changed externally.</span>
      <button
        onClick={() => reloadFromDisk(tabId)}
        className="rounded bg-blue-500/20 px-2 py-0.5 text-xs hover:bg-blue-500/30"
      >
        Reload
      </button>
      <button
        onClick={() => dismissConflict(tabId)}
        className="rounded bg-blue-500/20 px-2 py-0.5 text-xs hover:bg-blue-500/30"
      >
        Keep Mine
      </button>
      <button
        onClick={() => dismissConflict(tabId)}
        className="rounded p-0.5 hover:bg-blue-500/20"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function MigrationDialog() {
  const { migrationPrompt, dismissMigration, acceptMigration, openReadOnly } =
    useCollectionStore();

  if (!migrationPrompt) return null;
  const { status } = migrationPrompt;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && dismissMigration()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl focus:outline-none">
          <div className="border-b border-[var(--color-border)] px-6 py-4">
            <Dialog.Title className="text-base font-semibold text-[var(--color-text-primary)]">
              {status.isNewer ? "Newer Collection Format" : "Collection Format Upgrade"}
            </Dialog.Title>
          </div>
          <div className="space-y-3 px-6 py-4">
            {status.isNewer ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                This collection uses format v{status.collectionVersion}, but this
                version of ApiArk only supports up to v{status.currentVersion}.
                You can open it in read-only mode.
              </p>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">
                This collection uses format v{status.collectionVersion}. The
                current version is v{status.currentVersion}. Would you like to
                upgrade?
              </p>
            )}
            {!status.isNewer && (
              <p className="text-xs text-[var(--color-text-muted)]">
                Tip: commit your collection to Git before upgrading so you can
                revert if needed.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-3">
            <button
              onClick={dismissMigration}
              className="rounded px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-elevated)]"
            >
              Cancel
            </button>
            <button
              onClick={openReadOnly}
              className="rounded bg-[var(--color-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-border)]"
            >
              Open Read-Only
            </button>
            {!status.isNewer && (
              <button
                onClick={acceptMigration}
                className="rounded bg-[var(--color-accent)] px-3 py-1.5 text-sm text-white hover:opacity-90"
              >
                Upgrade
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default App;
