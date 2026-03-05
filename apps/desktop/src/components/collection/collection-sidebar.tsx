import { useState } from "react";
import { useCollectionStore } from "@/stores/collection-store";
import { CollectionTree } from "./collection-tree";
import { EnvironmentSelector } from "@/components/environment/environment-selector";
import { HistoryPanel } from "@/components/history/history-panel";
import { FolderOpen, ChevronDown, ChevronRight, Settings, Search, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useSettingsStore } from "@/stores/settings-store";

type SidebarSection = "collections" | "environments" | "history";

interface CollectionSidebarProps {
  onOpenSettings?: () => void;
  collapsed?: boolean;
  envSelectorRef?: React.RefObject<HTMLSelectElement | null>;
}

export function CollectionSidebar({ onOpenSettings, collapsed, envSelectorRef }: CollectionSidebarProps) {
  const sidebarWidth = useSettingsStore((s) => s.settings.sidebarWidth);
  const { collections, openCollection } = useCollectionStore();
  const [expandedSections, setExpandedSections] = useState<Set<SidebarSection>>(
    new Set(["collections", "environments"]),
  );
  const [searchQuery, setSearchQuery] = useState("");

  if (collapsed) return null;

  const toggleSection = (section: SidebarSection) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleOpenFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        await openCollection(selected as string);
      }
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to open folder: ${err}`),
      );
    }
  };

  return (
    <aside
      data-tour="sidebar"
      className="flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ width: `${sidebarWidth}px` }}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b border-[var(--color-border)] px-4">
        <span className="text-lg font-semibold text-[var(--color-accent)]">ApiArk</span>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-elevated)] hover:text-[var(--color-text-secondary)]"
            title="Settings (Ctrl+,)"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Collections section */}
        <div>
          <button
            onClick={() => toggleSection("collections")}
            className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          >
            {expandedSections.has("collections") ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Collections
          </button>

          {expandedSections.has("collections") && (
            <div className="px-1 pb-2">
              {/* Search input */}
              {collections.length > 0 && (
                <div className="relative mb-1 px-2">
                  <Search className="absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--color-text-dimmed)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search requests..."
                    className="w-full rounded bg-[var(--color-elevated)] py-1 pl-7 pr-6 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-dimmed)] hover:text-[var(--color-text-secondary)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {collections.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="mb-3 text-xs text-[var(--color-text-dimmed)]">
                    No collections open
                  </p>
                  <button
                    onClick={handleOpenFolder}
                    className="flex w-full items-center justify-center gap-1.5 rounded bg-[var(--color-elevated)] px-3 py-2 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Open Folder
                  </button>
                </div>
              ) : (
                <>
                  {collections.map((collection) => (
                    <CollectionTree
                      key={collection.path}
                      nodes={
                        collection.type === "collection"
                          ? collection.children
                          : [collection]
                      }
                      collectionPath={collection.path}
                      collectionName={collection.name}
                      searchQuery={searchQuery}
                    />
                  ))}
                  <button
                    onClick={handleOpenFolder}
                    className="mt-1 flex w-full items-center gap-1.5 rounded px-2 py-1 text-xs text-[var(--color-text-dimmed)] hover:text-[var(--color-text-secondary)]"
                  >
                    <FolderOpen className="h-3 w-3" />
                    Open Another
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Environment section */}
        <div className="border-t border-[var(--color-border)]">
          <button
            onClick={() => toggleSection("environments")}
            className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          >
            {expandedSections.has("environments") ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Environment
          </button>
          {expandedSections.has("environments") && (
            <div className="px-3 pb-2">
              <EnvironmentSelector ref={envSelectorRef} />
            </div>
          )}
        </div>

        {/* History section */}
        <div className="border-t border-[var(--color-border)]">
          <button
            onClick={() => toggleSection("history")}
            className="flex w-full items-center gap-1 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
          >
            {expandedSections.has("history") ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            History
          </button>
          {expandedSections.has("history") && (
            <div className="pb-2">
              <HistoryPanel />
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
