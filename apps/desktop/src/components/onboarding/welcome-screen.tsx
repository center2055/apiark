import { useState } from "react";
import { FolderOpen, Download, Plus } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { createSampleCollection } from "@/lib/tauri-api";
import { useCollectionStore } from "@/stores/collection-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useTabStore } from "@/stores/tab-store";

export function WelcomeScreen({
  onComplete,
  onOpenImport,
}: {
  onComplete: (startTour?: boolean) => void;
  onOpenImport: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { updateSettings } = useSettingsStore();

  const handleStartFresh = async () => {
    setLoading(true);
    try {
      const path = await createSampleCollection();
      await useCollectionStore.getState().openCollection(path);
      useTabStore.getState().newTab();
      await updateSettings({ onboardingComplete: true });
      onComplete(true);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to create sample collection: ${err}`),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    await updateSettings({ onboardingComplete: true });
    onComplete();
    onOpenImport();
  };

  const handleOpenFolder = async () => {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected) {
        await useCollectionStore.getState().openCollection(selected as string);
        await updateSettings({ onboardingComplete: true });
        onComplete();
      }
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to open folder: ${err}`),
      );
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <div className="flex max-w-md flex-col items-center gap-8 text-center">
        <div>
          <h1 className="text-2xl font-bold">Welcome to ApiArk</h1>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            Local-first API development. No accounts. No cloud. Just speed.
          </p>
        </div>

        <div className="flex w-full flex-col gap-3">
          <button
            onClick={handleStartFresh}
            disabled={loading}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3 text-left transition hover:border-blue-500/50 hover:bg-[var(--color-border)]"
          >
            <Plus className="h-5 w-5 shrink-0 text-blue-400" />
            <div>
              <div className="text-sm font-medium">Start from scratch</div>
              <div className="text-xs text-[var(--color-text-dimmed)]">
                Create a sample collection with example requests
              </div>
            </div>
          </button>

          <button
            onClick={handleImport}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3 text-left transition hover:border-blue-500/50 hover:bg-[var(--color-border)]"
          >
            <Download className="h-5 w-5 shrink-0 text-green-400" />
            <div>
              <div className="text-sm font-medium">Import existing collection</div>
              <div className="text-xs text-[var(--color-text-dimmed)]">
                From Postman, Insomnia, Bruno, or OpenAPI
              </div>
            </div>
          </button>

          <button
            onClick={handleOpenFolder}
            className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-elevated)] px-4 py-3 text-left transition hover:border-blue-500/50 hover:bg-[var(--color-border)]"
          >
            <FolderOpen className="h-5 w-5 shrink-0 text-yellow-400" />
            <div>
              <div className="text-sm font-medium">Open a folder</div>
              <div className="text-xs text-[var(--color-text-dimmed)]">
                Open a directory with an existing ApiArk collection
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={async () => {
            await updateSettings({ onboardingComplete: true });
            onComplete();
          }}
          className="text-xs text-[var(--color-text-dimmed)] hover:text-[var(--color-text-secondary)]"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
