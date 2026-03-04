import type {
  SendRequestParams,
  ResponseData,
  ScriptedResponseData,
  HttpError,
  CollectionNode,
  RequestFile,
  EnvironmentData,
  HistoryEntry,
  AppSettings,
  ParsedCurlRequest,
  PersistedState,
  RunConfig,
  RunSummary,
  WsConnectParams,
} from "@apiark/types";

// ── Tauri environment detection ──

// window.__TAURI_INTERNALS__ exists only inside the Tauri webview.
// When running via plain `pnpm dev` in a browser, invoke is unavailable.
function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let _invoke: typeof import("@tauri-apps/api/core").invoke | undefined;

async function getInvoke() {
  if (!isTauri()) {
    throw new Error("Not running in Tauri environment. Use `pnpm tauri dev` to run the app.");
  }
  if (!_invoke) {
    const mod = await import("@tauri-apps/api/core");
    _invoke = mod.invoke;
  }
  return _invoke;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const fn = await getInvoke();
  return fn<T>(cmd, args);
}

// ── Error handling ──

function handleTauriError(err: unknown): never {
  if (typeof err === "string") {
    try {
      const httpError: HttpError = JSON.parse(err);
      throw httpError;
    } catch (parseErr) {
      if ((parseErr as HttpError).errorType) {
        throw parseErr;
      }
      throw {
        errorType: "unknown",
        message: err,
      } satisfies HttpError;
    }
  }
  throw {
    errorType: "unknown",
    message: String(err),
  } satisfies HttpError;
}

// ── HTTP ──

export async function sendRequest(
  params: SendRequestParams,
  variables?: Record<string, string>,
  collectionPath?: string,
  requestName?: string,
): Promise<ResponseData> {
  try {
    return await invoke<ResponseData>("send_request", {
      params,
      variables: variables ?? null,
      collectionPath: collectionPath ?? null,
      requestName: requestName ?? null,
    });
  } catch (err) {
    handleTauriError(err);
  }
}

export async function sendRequestWithScripts(
  params: SendRequestParams,
  variables?: Record<string, string>,
  collectionPath?: string,
  requestName?: string,
  preRequestScript?: string | null,
  postResponseScript?: string | null,
  testScript?: string | null,
  assertionsYaml?: string | null,
): Promise<ScriptedResponseData> {
  try {
    return await invoke<ScriptedResponseData>("send_request_with_scripts", {
      params,
      variables: variables ?? null,
      collectionPath: collectionPath ?? null,
      requestName: requestName ?? null,
      preRequestScript: preRequestScript ?? null,
      postResponseScript: postResponseScript ?? null,
      testScript: testScript ?? null,
      assertionsYaml: assertionsYaml ?? null,
    });
  } catch (err) {
    handleTauriError(err);
  }
}

// ── Collections ──

export async function openCollection(path: string): Promise<CollectionNode> {
  return await invoke<CollectionNode>("open_collection", { path });
}

export async function readRequestFile(path: string): Promise<RequestFile> {
  return await invoke<RequestFile>("read_request_file", { path });
}

export async function saveRequestFile(
  path: string,
  request: RequestFile,
): Promise<void> {
  return await invoke<void>("save_request_file", { path, request });
}

export async function createRequest(
  dir: string,
  filename: string,
  name: string,
): Promise<string> {
  return await invoke<string>("create_request", {
    dir,
    filename,
    name,
    method: "GET",
    url: "",
  });
}

export async function createFolder(
  parent: string,
  name: string,
): Promise<string> {
  return await invoke<string>("create_folder", { parent, name });
}

export async function deleteItem(
  path: string,
  collectionName: string,
): Promise<void> {
  return await invoke<void>("delete_item", { path, collectionName });
}

export async function renameItem(
  path: string,
  newName: string,
): Promise<string> {
  return await invoke<string>("rename_item", { path, newName });
}

// ── Environments ──

export async function loadEnvironments(
  collectionPath: string,
): Promise<EnvironmentData[]> {
  return await invoke<EnvironmentData[]>("load_environments", {
    collectionPath,
  });
}

export async function getResolvedVariables(
  collectionPath: string,
  environmentName: string,
): Promise<Record<string, string>> {
  return await invoke<Record<string, string>>("get_resolved_variables", {
    collectionPath,
    environmentName,
  });
}

// ── History ──

export async function getHistory(): Promise<HistoryEntry[]> {
  return await invoke<HistoryEntry[]>("get_history", {});
}

export async function searchHistory(query: string): Promise<HistoryEntry[]> {
  return await invoke<HistoryEntry[]>("search_history", { query });
}

export async function clearHistory(): Promise<void> {
  return await invoke<void>("clear_history", {});
}

// ── State Persistence ──

export async function loadPersistedState(): Promise<PersistedState> {
  return await invoke<PersistedState>("load_persisted_state", {});
}

export async function savePersistedState(state: PersistedState): Promise<void> {
  return await invoke<void>("save_persisted_state", { state });
}

// ── cURL ──

export async function parseCurlCommand(input: string): Promise<ParsedCurlRequest> {
  return await invoke<ParsedCurlRequest>("parse_curl_command", { input });
}

export async function exportCurlCommand(
  method: string,
  url: string,
  headers: Record<string, string>,
  body?: string,
  authBasic?: [string, string],
): Promise<string> {
  return await invoke<string>("export_curl_command", {
    method,
    url,
    headers,
    body: body ?? null,
    authBasic: authBasic ?? null,
  });
}

// ── Collection Runner ──

export async function runCollection(config: RunConfig): Promise<RunSummary> {
  try {
    return await invoke<RunSummary>("run_collection_command", { config });
  } catch (err) {
    handleTauriError(err);
  }
}

// ── WebSocket ──

export async function wsConnect(connectionId: string, params: WsConnectParams): Promise<void> {
  return await invoke<void>("ws_connect", { connectionId, params });
}

export async function wsSend(connectionId: string, message: string): Promise<void> {
  return await invoke<void>("ws_send", { connectionId, message });
}

export async function wsDisconnect(connectionId: string): Promise<void> {
  return await invoke<void>("ws_disconnect", { connectionId });
}

// ── SSE ──

export async function sseConnect(connectionId: string, params: { url: string; headers: import("@apiark/types").KeyValuePair[] }): Promise<void> {
  return await invoke<void>("sse_connect", { connectionId, params });
}

export async function sseDisconnect(connectionId: string): Promise<void> {
  return await invoke<void>("sse_disconnect", { connectionId });
}

// ── Settings ──

export async function getSettings(): Promise<AppSettings> {
  return await invoke<AppSettings>("get_settings", {});
}

export async function updateSettings(
  patch: Partial<AppSettings>,
): Promise<AppSettings> {
  return await invoke<AppSettings>("update_settings", { patch });
}
