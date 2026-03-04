import { create } from "zustand";
import type {
  HttpMethod,
  KeyValuePair,
  RequestBody,
  AuthConfig,
  HttpError,
  Tab,
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

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;

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
  clearResponse: () => void;

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
    ...overrides,
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
    tabs: state.tabs.map((t) =>
      t.id === state.activeTabId
        ? { ...t, ...updater(t), isDirty: true }
        : t,
    ),
  };
}

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [],
  activeTabId: null,

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
      console.error("Failed to open request file:", err);
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
      }
    } catch (err) {
      set({
        tabs: get().tabs.map((t) =>
          t.id === activeTabId
            ? { ...t, error: err as HttpError, loading: false }
            : t,
        ),
      });
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
      console.error("Failed to save request:", err);
    }
  },

  clearResponse: () => {
    set((state) => updateActiveTab(state, () => ({ response: null, error: null })));
  },

  persistTabs: () => {
    const { tabs, activeTabId } = get();
    // Only persist file-backed tabs (exclude ephemeral WS/SSE tabs)
    const persistedTabs = tabs
      .filter((t) => t.filePath && t.collectionPath && t.protocol !== "websocket" && t.protocol !== "sse")
      .map((t) => ({ filePath: t.filePath!, collectionPath: t.collectionPath! }));
    const activeIndex = tabs.findIndex((t) => t.id === activeTabId);
    savePersistedState({
      tabs: persistedTabs,
      activeTabIndex: activeIndex >= 0 ? activeIndex : null,
    }).catch((err) => console.error("Failed to persist tabs:", err));
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
      console.error("Failed to restore tabs:", err);
    }
  },
}));

// Selectors
export const useActiveTab = () => {
  const { tabs, activeTabId } = useTabStore();
  return tabs.find((t) => t.id === activeTabId) ?? null;
};
