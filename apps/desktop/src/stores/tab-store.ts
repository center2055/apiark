import { create } from "zustand";
import type {
  HttpMethod,
  KeyValuePair,
  RequestBody,
  AuthConfig,
  HttpError,
  ResponseData,
  Tab,
  TabSnapshot,
  RequestFile,
  GraphQLState,
} from "@apiark/types";
import {
  sendRequest,
  sendRequestWithScripts,
  readRequestFile,
  saveRequestFile,
  loadPersistedState,
  savePersistedState,
} from "@/lib/tauri-api";
import { useEnvironmentStore } from "./environment-store";
import { useSettingsStore } from "./settings-store";
import { useConsoleStore } from "./console-store";

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  autoSaveError: string | null;

  // Tab management
  newTab: () => void;
  openTab: (filePath: string, collectionPath: string) => Promise<void>;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (id: string) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;

  // Protocol-specific tab creation
  newGraphQLTab: () => void;
  newWebSocketTab: () => void;
  newSSETab: () => void;
  newGrpcTab: () => void;

  // GraphQL mutations
  setGraphQLQuery: (query: string) => void;
  setGraphQLVariables: (variables: string) => void;
  setGraphQLOperationName: (operationName: string) => void;
  setGraphQLSchema: (schema: string | null) => void;

  // Active tab request mutations
  setMethod: (method: HttpMethod) => void;
  setUrl: (url: string) => void;
  setHeaders: (headers: KeyValuePair[]) => void;
  setParams: (params: KeyValuePair[]) => void;
  setBody: (body: RequestBody) => void;
  setAuth: (auth: AuthConfig) => void;
  setPreRequestScript: (script: string | null) => void;
  setPostResponseScript: (script: string | null) => void;
  setTestScript: (script: string | null) => void;
  setAssertions: (assertions: string | null) => void;

  // Actions
  send: () => Promise<void>;
  save: () => Promise<void>;
  autoSave: () => Promise<void>;
  clearAutoSaveError: () => void;
  clearResponse: () => void;
  updateResponse: (tabId: string, updates: Partial<ResponseData>) => void;
  hasUnsavedNewTabs: () => boolean;

  // Undo/Redo
  undoTab: () => void;
  redoTab: () => void;

  // Conflict resolution
  handleExternalChange: (filePath: string, changeType: "modified" | "deleted") => void;
  reloadFromDisk: (tabId: string) => Promise<void>;
  dismissConflict: (tabId: string) => void;

  // Detach tab to new window
  detachTab: (id: string) => Promise<void>;

  // Persistence
  persistTabs: () => void;
  restoreTabs: () => Promise<void>;
}

let tabCounter = 0;
function generateTabId(): string {
  return `tab_${Date.now()}_${++tabCounter}`;
}

const emptyKvRow = (): KeyValuePair => ({ key: "", value: "", enabled: true });

function createEmptyTab(overrides?: Partial<Tab>): Tab {
  return {
    id: generateTabId(),
    name: "Untitled Request",
    filePath: null,
    collectionPath: null,
    isDirty: false,
    protocol: "http",
    graphql: null,
    grpc: null,
    method: "GET",
    url: "",
    headers: [emptyKvRow()],
    params: [emptyKvRow()],
    body: { type: "none", content: "", formData: [] },
    auth: { type: "none" },
    preRequestScript: null,
    postResponseScript: null,
    testScript: null,
    assertions: null,
    response: null,
    error: null,
    loading: false,
    testResults: [],
    assertionResults: [],
    consoleOutput: [],
    conflictState: null,
    undoStack: [],
    redoStack: [],
    ...overrides,
  };
}

const MAX_UNDO_DEPTH = 100;

function takeSnapshot(tab: Tab): TabSnapshot {
  return {
    method: tab.method,
    url: tab.url,
    headers: JSON.parse(JSON.stringify(tab.headers)),
    params: JSON.parse(JSON.stringify(tab.params)),
    body: JSON.parse(JSON.stringify(tab.body)),
    auth: JSON.parse(JSON.stringify(tab.auth)),
    preRequestScript: tab.preRequestScript,
    postResponseScript: tab.postResponseScript,
    testScript: tab.testScript,
    assertions: tab.assertions,
  };
}

function requestFileToTab(
  file: RequestFile,
  filePath: string,
  collectionPath: string,
): Tab {
  // Convert Record<string, string> headers to KeyValuePair[]
  const headers: KeyValuePair[] = Object.entries(file.headers || {}).map(
    ([key, value]) => ({ key, value, enabled: true }),
  );
  if (headers.length === 0) headers.push(emptyKvRow());

  // Convert Record<string, string> params to KeyValuePair[]
  const params: KeyValuePair[] = Object.entries(file.params || {}).map(
    ([key, value]) => ({ key, value, enabled: true }),
  );
  if (params.length === 0) params.push(emptyKvRow());

  // Convert body
  const body: RequestBody = file.body
    ? {
        type: file.body.type as RequestBody["type"],
        content: file.body.content || "",
        formData: [],
      }
    : { type: "none", content: "", formData: [] };

  // Convert assert to YAML string for the editor
  let assertionsStr: string | null = null;
  if (file.assert) {
    // The assert field comes from Rust as a serde_yaml::Value serialized to JSON.
    // Convert it back to a simple YAML-like string for editing.
    try {
      if (typeof file.assert === "object" && file.assert !== null) {
        assertionsStr = Object.entries(file.assert as Record<string, unknown>)
          .map(([k, v]) => {
            if (typeof v === "object" && v !== null) {
              return `${k}:\n` + Object.entries(v as Record<string, unknown>)
                .map(([ok, ov]) => `  ${ok}: ${JSON.stringify(ov)}`)
                .join("\n");
            }
            return `${k}: ${JSON.stringify(v)}`;
          })
          .join("\n");
      } else if (typeof file.assert === "string") {
        assertionsStr = file.assert;
      }
    } catch {
      // If conversion fails, just stringify
      assertionsStr = JSON.stringify(file.assert);
    }
  }

  // Detect GraphQL: JSON body with a "query" field
  const isGraphQL = file.body?.type === "json" && file.body.content &&
    (() => { try { return "query" in JSON.parse(file.body!.content!); } catch { return false; } })();
  const graphqlState: GraphQLState | null = isGraphQL
    ? (() => {
        try {
          const parsed = JSON.parse(file.body!.content!);
          return {
            query: parsed.query || "",
            variables: parsed.variables ? JSON.stringify(parsed.variables, null, 2) : "{}",
            operationName: parsed.operationName || "",
            schemaJson: null,
          };
        } catch { return { query: "", variables: "{}", operationName: "", schemaJson: null }; }
      })()
    : null;

  return {
    id: generateTabId(),
    name: file.name,
    filePath,
    collectionPath,
    isDirty: false,
    protocol: isGraphQL ? "graphql" : "http",
    graphql: graphqlState,
    grpc: null,
    method: file.method,
    url: file.url,
    headers,
    params,
    body,
    auth: file.auth || { type: "none" },
    preRequestScript: file.preRequestScript ?? null,
    postResponseScript: file.postResponseScript ?? null,
    testScript: file.tests ?? null,
    assertions: assertionsStr,
    response: null,
    error: null,
    loading: false,
    testResults: [],
    assertionResults: [],
    consoleOutput: [],
    conflictState: null,
    undoStack: [],
    redoStack: [],
  };
}

function tabToRequestFile(tab: Tab): RequestFile {
  // Convert KeyValuePair[] to Record<string, string> (only enabled, non-empty)
  const headers: Record<string, string> = {};
  for (const h of tab.headers) {
    if (h.key.trim() && h.enabled) {
      headers[h.key] = h.value;
    }
  }

  const params: Record<string, string> = {};
  for (const p of tab.params) {
    if (p.key.trim() && p.enabled) {
      params[p.key] = p.value;
    }
  }

  return {
    name: tab.name,
    method: tab.method,
    url: tab.url,
    headers,
    params: Object.keys(params).length > 0 ? params : undefined,
    auth: tab.auth.type !== "none" ? tab.auth : undefined,
    body:
      tab.body.type !== "none"
        ? { type: tab.body.type, content: tab.body.content }
        : undefined,
    preRequestScript: tab.preRequestScript || undefined,
    postResponseScript: tab.postResponseScript || undefined,
    tests: tab.testScript || undefined,
  };
}

function updateActiveTab(
  state: TabState,
  updater: (tab: Tab) => Partial<Tab>,
): Partial<TabState> {
  if (!state.activeTabId) return {};
  return {
    tabs: state.tabs.map((t) => {
      if (t.id !== state.activeTabId) return t;
      const snapshot = takeSnapshot(t);
      const changes = updater(t);
      return {
        ...t,
        ...changes,
        isDirty: true,
        undoStack: [...t.undoStack.slice(-MAX_UNDO_DEPTH + 1), snapshot],
        redoStack: [], // Clear redo on new change
      };
    }),
  };
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,
  autoSaveError: null,

  newTab: () => {
    const tab = createEmptyTab();
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    }));
  },

  newGraphQLTab: () => {
    const tab = createEmptyTab({
      name: "Untitled GraphQL",
      protocol: "graphql",
      method: "POST",
      graphql: { query: "", variables: "{}", operationName: "", schemaJson: null },
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  newWebSocketTab: () => {
    const tab = createEmptyTab({
      name: "Untitled WebSocket",
      protocol: "websocket",
      method: "GET",
      url: "ws://localhost:8080",
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  newSSETab: () => {
    const tab = createEmptyTab({
      name: "Untitled SSE",
      protocol: "sse",
      method: "GET",
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  newGrpcTab: () => {
    const tab = createEmptyTab({
      name: "Untitled gRPC",
      protocol: "grpc",
      url: "http://localhost:50051",
      grpc: {
        services: [],
        selectedService: null,
        selectedMethod: null,
        requestJson: "{}",
        metadata: [{ key: "", value: "", enabled: true }],
        response: null,
        loading: false,
        error: null,
      },
    });
    set((state) => ({ tabs: [...state.tabs, tab], activeTabId: tab.id }));
  },

  openTab: async (filePath, collectionPath) => {
    // Check if already open
    const existing = get().tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    try {
      const file = await readRequestFile(filePath);
      const tab = requestFileToTab(file, filePath, collectionPath);
      set((state) => ({
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      }));
    } catch (err) {
      const errStr = String((err as { message?: string })?.message ?? err);
      if (errStr.includes("MERGE_CONFLICT:")) {
        // Open a blank tab with merge-conflict state
        const tab = createEmptyTab({
          name: filePath.split("/").pop()?.replace(".yaml", "") ?? "Conflict",
          filePath,
          collectionPath,
          conflictState: "merge-conflict",
        });
        set((state) => ({
          tabs: [...state.tabs, tab],
          activeTabId: tab.id,
        }));
      } else {
        const { useToastStore } = await import("@/stores/toast-store");
        useToastStore.getState().showError(`Failed to open request: ${String((err as { message?: string })?.message ?? err)}`);
      }
    }
  },

  closeTab: (id) => {
    set((state) => {
      const idx = state.tabs.findIndex((t) => t.id === id);
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActive = state.activeTabId;
      if (state.activeTabId === id) {
        if (newTabs.length === 0) {
          newActive = null;
        } else if (idx >= newTabs.length) {
          newActive = newTabs[newTabs.length - 1].id;
        } else {
          newActive = newTabs[idx].id;
        }
      }
      return { tabs: newTabs, activeTabId: newActive };
    });
  },

  closeOtherTabs: (id) => {
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === id),
      activeTabId: id,
    }));
  },

  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  reorderTabs: (fromIndex, toIndex) => {
    set((state) => {
      const newTabs = [...state.tabs];
      const [moved] = newTabs.splice(fromIndex, 1);
      newTabs.splice(toIndex, 0, moved);
      return { tabs: newTabs };
    });
  },

  // Request mutations (apply to active tab)
  setMethod: (method) => set((state) => updateActiveTab(state, () => ({ method }))),
  setUrl: (url) => set((state) => updateActiveTab(state, () => ({ url }))),
  setHeaders: (headers) => set((state) => updateActiveTab(state, () => ({ headers }))),
  setParams: (params) => set((state) => updateActiveTab(state, () => ({ params }))),
  setBody: (body) => set((state) => updateActiveTab(state, () => ({ body }))),
  setAuth: (auth) => set((state) => updateActiveTab(state, () => ({ auth }))),
  setPreRequestScript: (script) => set((state) => updateActiveTab(state, () => ({ preRequestScript: script }))),
  setPostResponseScript: (script) => set((state) => updateActiveTab(state, () => ({ postResponseScript: script }))),
  setTestScript: (script) => set((state) => updateActiveTab(state, () => ({ testScript: script }))),
  setAssertions: (assertions) => set((state) => updateActiveTab(state, () => ({ assertions }))),

  // GraphQL setters
  setGraphQLQuery: (query) => set((state) => updateActiveTab(state, (t) => ({
    graphql: t.graphql ? { ...t.graphql, query } : null,
  }))),
  setGraphQLVariables: (variables) => set((state) => updateActiveTab(state, (t) => ({
    graphql: t.graphql ? { ...t.graphql, variables } : null,
  }))),
  setGraphQLOperationName: (operationName) => set((state) => updateActiveTab(state, (t) => ({
    graphql: t.graphql ? { ...t.graphql, operationName } : null,
  }))),
  setGraphQLSchema: (schemaJson) => set((state) => updateActiveTab(state, (t) => ({
    graphql: t.graphql ? { ...t.graphql, schemaJson } : null,
  }))),

  send: async () => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.url.trim()) return;

    // Mark loading
    set({
      tabs: tabs.map((t) =>
        t.id === activeTabId
          ? { ...t, loading: true, error: null, response: null, testResults: [], assertionResults: [], consoleOutput: [] }
          : t,
      ),
    });

    // Get resolved variables from environment store
    const envStore = useEnvironmentStore.getState();
    const variables = await envStore.getResolvedVariables();

    // Get network settings
    const { settings } = useSettingsStore.getState();
    const proxy = settings.proxyUrl
      ? {
          url: settings.proxyUrl,
          username: settings.proxyUsername ?? undefined,
          password: settings.proxyPassword ?? undefined,
        }
      : undefined;

    // Build body — for GraphQL, construct from graphql state
    let body = tab.body.type !== "none" ? tab.body : undefined;
    let headers = tab.headers.filter((h) => h.key.trim() !== "" && h.enabled);
    if (tab.protocol === "graphql" && tab.graphql) {
      const gqlBody: Record<string, unknown> = { query: tab.graphql.query };
      try {
        const vars = JSON.parse(tab.graphql.variables);
        if (Object.keys(vars).length > 0) gqlBody.variables = vars;
      } catch { /* ignore invalid JSON */ }
      if (tab.graphql.operationName) gqlBody.operationName = tab.graphql.operationName;
      body = { type: "json", content: JSON.stringify(gqlBody), formData: [] };
      // Auto-add Content-Type if not present
      if (!headers.some((h) => h.key.toLowerCase() === "content-type")) {
        headers = [{ key: "Content-Type", value: "application/json", enabled: true }, ...headers];
      }
    }

    const requestParams = {
      method: tab.protocol === "graphql" ? ("POST" as const) : tab.method,
      url: tab.url.trim(),
      headers,
      params: tab.params.filter((p) => p.key.trim() !== "" && p.enabled),
      body,
      auth: tab.auth.type !== "none" ? tab.auth : undefined,
      proxy,
      timeoutMs: settings.timeoutMs,
      followRedirects: settings.followRedirects,
      verifySsl: settings.verifySsl,
      caCertPath: settings.caCertPath ?? undefined,
      clientCertPath: settings.clientCertPath ?? undefined,
      clientKeyPath: settings.clientKeyPath ?? undefined,
      clientCertPassphrase: settings.clientCertPassphrase ?? undefined,
    };

    const hasScripts = tab.preRequestScript || tab.postResponseScript || tab.testScript || tab.assertions;

    try {
      if (hasScripts) {
        const scriptedResponse = await sendRequestWithScripts(
          requestParams,
          variables,
          tab.collectionPath ?? undefined,
          tab.name !== "Untitled Request" ? tab.name : undefined,
          tab.preRequestScript,
          tab.postResponseScript,
          tab.testScript,
          tab.assertions,
        );
        // Apply env mutations to the environment store
        if (scriptedResponse.envMutations && Object.keys(scriptedResponse.envMutations).length > 0) {
          envStore.applyMutations(scriptedResponse.envMutations);
        }
        set({
          tabs: get().tabs.map((t) =>
            t.id === activeTabId
              ? {
                  ...t,
                  response: {
                    status: scriptedResponse.status,
                    statusText: scriptedResponse.statusText,
                    headers: scriptedResponse.headers,
                    cookies: scriptedResponse.cookies,
                    body: scriptedResponse.body,
                    timeMs: scriptedResponse.timeMs,
                    sizeBytes: scriptedResponse.sizeBytes,
                  },
                  testResults: scriptedResponse.testResults,
                  assertionResults: scriptedResponse.assertionResults,
                  consoleOutput: scriptedResponse.consoleOutput,
                  loading: false,
                }
              : t,
          ),
        });

        // Push script console output to global console
        const consoleFn = useConsoleStore.getState().log;
        const reqLabel = tab.name || tab.url || "Request";
        consoleFn(reqLabel, `${scriptedResponse.status} ${scriptedResponse.statusText} (${scriptedResponse.timeMs}ms)`, "info");
        for (const entry of scriptedResponse.consoleOutput) {
          const level = entry.level === "error" ? "error" : entry.level === "warn" ? "warn" : "log";
          consoleFn(reqLabel, entry.message, level);
        }
      } else {
        const response = await sendRequest(
          requestParams,
          variables,
          tab.collectionPath ?? undefined,
          tab.name !== "Untitled Request" ? tab.name : undefined,
        );
        set({
          tabs: get().tabs.map((t) =>
            t.id === activeTabId ? { ...t, response, loading: false } : t,
          ),
        });
        const reqLabel = tab.name || tab.url || "Request";
        useConsoleStore.getState().log(reqLabel, `${response.status} ${response.statusText} (${response.timeMs}ms)`, "info");
      }
    } catch (err) {
      set({
        tabs: get().tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, error: err as HttpError, loading: false }
            : t,
        ),
      });
      const reqLabel = tab.name || tab.url || "Request";
      const httpErr = err as HttpError;
      useConsoleStore.getState().log(reqLabel, httpErr?.message || String(err), "error");
    }
  },

  save: async () => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.filePath) return;

    try {
      const requestFile = tabToRequestFile(tab);
      await saveRequestFile(tab.filePath, requestFile);
      set({
        tabs: get().tabs.map((t) =>
          t.id === activeTabId ? { ...t, isDirty: false } : t,
        ),
      });
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError(`Failed to save request: ${String(err)}`)
      );
    }
  },

  autoSave: async () => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === activeTabId);
    if (!tab || !tab.filePath || !tab.isDirty) return;

    try {
      const requestFile = tabToRequestFile(tab);
      await saveRequestFile(tab.filePath, requestFile);
      set({
        autoSaveError: null,
        tabs: get().tabs.map((t) =>
          t.id === activeTabId ? { ...t, isDirty: false } : t,
        ),
      });
    } catch (err) {
      set({ autoSaveError: String(err) });
    }
  },

  clearAutoSaveError: () => {
    set({ autoSaveError: null });
  },

  hasUnsavedNewTabs: () => {
    return get().tabs.some((t) => !t.filePath && (t.url.trim() || t.body.content.trim()));
  },

  clearResponse: () => {
    set((state) => updateActiveTab(state, () => ({ response: null, error: null })));
  },

  updateResponse: (tabId: string, updates: Partial<ResponseData>) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId && t.response
          ? { ...t, response: { ...t.response, ...updates } }
          : t
      ),
    }));
  },

  undoTab: () => {
    set((state) => {
      if (!state.activeTabId) return {};
      return {
        tabs: state.tabs.map((t) => {
          if (t.id !== state.activeTabId || t.undoStack.length === 0) return t;
          const snapshot = t.undoStack[t.undoStack.length - 1];
          const currentSnapshot = takeSnapshot(t);
          return {
            ...t,
            ...snapshot,
            undoStack: t.undoStack.slice(0, -1),
            redoStack: [...t.redoStack, currentSnapshot],
          };
        }),
      };
    });
  },

  redoTab: () => {
    set((state) => {
      if (!state.activeTabId) return {};
      return {
        tabs: state.tabs.map((t) => {
          if (t.id !== state.activeTabId || t.redoStack.length === 0) return t;
          const snapshot = t.redoStack[t.redoStack.length - 1];
          const currentSnapshot = takeSnapshot(t);
          return {
            ...t,
            ...snapshot,
            redoStack: t.redoStack.slice(0, -1),
            undoStack: [...t.undoStack, currentSnapshot],
          };
        }),
      };
    });
  },

  handleExternalChange: (filePath, changeType) => {
    set((state) => ({
      tabs: state.tabs.map((t) => {
        if (t.filePath !== filePath) return t;
        if (changeType === "deleted") {
          return { ...t, conflictState: "deleted" as const };
        }
        // Modified externally — if tab is dirty, show conflict; if clean, auto-reload
        if (t.isDirty) {
          return { ...t, conflictState: "external-change" as const };
        }
        // Clean tab: auto-reload will be handled by the caller
        return t;
      }),
    }));
  },

  reloadFromDisk: async (tabId) => {
    const tab = get().tabs.find((t) => t.id === tabId);
    if (!tab || !tab.filePath || !tab.collectionPath) return;
    try {
      const file = await readRequestFile(tab.filePath);
      const reloaded = requestFileToTab(file, tab.filePath, tab.collectionPath);
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId
            ? { ...reloaded, id: t.id, conflictState: null }
            : t,
        ),
      }));
    } catch {
      // File may no longer exist
      set((state) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, conflictState: "deleted" as const } : t,
        ),
      }));
    }
  },

  dismissConflict: (tabId) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, conflictState: null } : t,
      ),
    }));
  },

  detachTab: async (id) => {
    const tab = get().tabs.find((t) => t.id === id);
    if (!tab || !tab.filePath) return;

    try {
      const { openNewWindow } = await import("@/lib/tauri-api");
      await openNewWindow();
      // Close the tab in the current window — the new window will load its own state
      get().closeTab(id);
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showError("Failed to open new window. Please try again.")
      );
    }
  },

  persistTabs: () => {
    const { tabs, activeTabId } = get();
    // Only persist file-backed tabs (exclude ephemeral WS/SSE tabs)
    const persistedTabs = tabs
      .filter((t) => t.filePath && t.collectionPath && t.protocol !== "websocket" && t.protocol !== "sse" && t.protocol !== "grpc")
      .map((t) => ({ filePath: t.filePath!, collectionPath: t.collectionPath! }));
    const activeIndex = tabs.findIndex((t) => t.id === activeTabId);

    // Capture window position/size
    const windowState = {
      x: window.screenX,
      y: window.screenY,
      width: window.outerWidth,
      height: window.outerHeight,
      maximized: false, // Will be updated from Tauri API if needed
    };

    savePersistedState({
      tabs: persistedTabs,
      activeTabIndex: activeIndex >= 0 ? activeIndex : null,
      windowState,
    }).catch(() => { /* Tab persistence failure is non-critical */ });
  },

  restoreTabs: async () => {
    try {
      const persisted = await loadPersistedState();
      if (persisted.tabs.length === 0) return;

      for (const pt of persisted.tabs) {
        try {
          const file = await readRequestFile(pt.filePath);
          const tab = requestFileToTab(file, pt.filePath, pt.collectionPath);
          set((state) => ({
            tabs: [...state.tabs, tab],
            activeTabId: state.activeTabId ?? tab.id,
          }));
        } catch {
          // File may have been deleted, skip it
        }
      }

      // Set active tab by index
      if (persisted.activeTabIndex != null) {
        const { tabs } = get();
        if (persisted.activeTabIndex < tabs.length) {
          set({ activeTabId: tabs[persisted.activeTabIndex].id });
        }
      }
    } catch (err) {
      import("@/stores/toast-store").then(({ useToastStore }) =>
        useToastStore.getState().showWarning("Some tabs could not be restored from your last session.")
      );
    }
  },
}));

// Selectors
export const useActiveTab = () => {
  const { tabs, activeTabId } = useTabStore();
  return tabs.find((t) => t.id === activeTabId) ?? null;
};
