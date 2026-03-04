import { create } from "zustand";
import type { RunConfig, RunProgress, RunSummary } from "@apiark/types";
import { runCollection } from "@/lib/tauri-api";

interface RunnerState {
  isRunning: boolean;
  progress: RunProgress[];
  summary: RunSummary | null;
  error: string | null;

  startRun: (config: RunConfig) => Promise<void>;
  reset: () => void;
}

export const useRunnerStore = create<RunnerState>((set) => ({
  isRunning: false,
  progress: [],
  summary: null,
  error: null,

  startRun: async (config) => {
    set({ isRunning: true, progress: [], summary: null, error: null });

    // Listen for progress events
    let unlisten: (() => void) | null = null;
    try {
      const { listen } = await import("@tauri-apps/api/event");
      unlisten = await listen<RunProgress>("runner:progress", (event) => {
        set((state) => ({
          progress: [...state.progress, event.payload],
        }));
      });
    } catch {
      // Not in Tauri env
    }

    try {
      const summary = await runCollection(config);
      set({ summary, isRunning: false });
    } catch (err) {
      set({
        error: typeof err === "string" ? err : (err as Error).message ?? String(err),
        isRunning: false,
      });
    } finally {
      if (unlisten) unlisten();
    }
  },

  reset: () => {
    set({ isRunning: false, progress: [], summary: null, error: null });
  },
}));
