import { useState } from "react";
import { useTabStore, useActiveTab } from "@/stores/tab-store";
import { KeyValueEditor } from "@/components/request/key-value-editor";
import { ResponsePanel } from "@/components/response/response-panel";
import { Send, Download } from "lucide-react";
import type { AuthConfig } from "@apiark/types";

type GqlTab = "query" | "variables" | "headers" | "auth";

const INTROSPECTION_QUERY = `query IntrospectionQuery {
  __schema {
    types {
      name
      kind
      description
      fields(includeDeprecated: false) {
        name
        type { name kind ofType { name kind } }
      }
    }
    queryType { name }
    mutationType { name }
    subscriptionType { name }
  }
}`;

export function GraphQLView() {
  const [activeTab, setActiveTab] = useState<GqlTab>("query");
  const [schemaTypes, setSchemaTypes] = useState<{ name: string; kind: string }[]>([]);
  const [fetchingSchema, setFetchingSchema] = useState(false);
  const tab = useActiveTab();
  const {
    setUrl,
    setHeaders,
    setAuth,
    setGraphQLQuery,
    setGraphQLVariables,
    setGraphQLOperationName,
    setGraphQLSchema,
    send,
  } = useTabStore();

  if (!tab || !tab.graphql) return null;

  const handleFetchSchema = async () => {
    if (!tab.url.trim()) return;
    setFetchingSchema(true);
    // Temporarily set graphql query to introspection, send, then restore
    const originalQuery = tab.graphql!.query;
    setGraphQLQuery(INTROSPECTION_QUERY);
    setGraphQLOperationName("IntrospectionQuery");
    await send();
    // Restore original query
    setGraphQLQuery(originalQuery);
    setGraphQLOperationName(tab.graphql!.operationName);

    // Parse schema from response
    const updated = useTabStore.getState().tabs.find((t) => t.id === tab.id);
    if (updated?.response?.body) {
      try {
        const data = JSON.parse(updated.response.body);
        const types = data?.data?.__schema?.types?.filter(
          (t: { name: string }) => !t.name.startsWith("__"),
        ) ?? [];
        setSchemaTypes(types);
        setGraphQLSchema(updated.response.body);
      } catch {
        setSchemaTypes([]);
      }
    }
    setFetchingSchema(false);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* URL Bar */}
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
        <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs font-bold text-yellow-500">
          POST
        </span>
        <input
          type="text"
          value={tab.url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/graphql"
          className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              send();
            }
          }}
        />
        <button
          onClick={handleFetchSchema}
          disabled={fetchingSchema || !tab.url.trim()}
          className="flex items-center gap-1 rounded bg-[var(--color-elevated)] px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-border)] disabled:opacity-50"
          title="Fetch Schema (Introspection)"
        >
          <Download className="h-3 w-3" />
          {fetchingSchema ? "Fetching..." : "Schema"}
        </button>
        <button
          onClick={send}
          disabled={tab.loading || !tab.url.trim()}
          className="flex items-center gap-1.5 rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          {tab.loading ? "Sending..." : "Send"}
        </button>
      </div>

      {/* Split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Query editor */}
        <div className="flex w-1/2 flex-col border-r border-[var(--color-border)]">
          {/* Tab bar */}
          <div className="flex gap-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            {(["query", "variables", "headers", "auth"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`px-4 py-2 text-sm capitalize transition-colors ${
                  activeTab === t
                    ? "border-b-2 border-purple-500 text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-3">
            {activeTab === "query" && (
              <div className="flex h-full flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                    GraphQL Query
                  </label>
                  <input
                    type="text"
                    value={tab.graphql.operationName}
                    onChange={(e) => setGraphQLOperationName(e.target.value)}
                    placeholder="Operation Name (optional)"
                    className="rounded bg-[var(--color-elevated)] px-2 py-1 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none"
                  />
                </div>
                <textarea
                  value={tab.graphql.query}
                  onChange={(e) => setGraphQLQuery(e.target.value)}
                  placeholder={"query {\n  users {\n    id\n    name\n  }\n}"}
                  className="flex-1 resize-none rounded bg-[var(--color-elevated)] p-3 font-mono text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-purple-500"
                  spellCheck={false}
                />
              </div>
            )}

            {activeTab === "variables" && (
              <div className="flex h-full flex-col gap-2">
                <label className="text-xs font-medium text-[var(--color-text-secondary)]">
                  Variables (JSON)
                </label>
                <textarea
                  value={tab.graphql.variables}
                  onChange={(e) => setGraphQLVariables(e.target.value)}
                  placeholder={'{\n  "id": "123"\n}'}
                  className="flex-1 resize-none rounded bg-[var(--color-elevated)] p-3 font-mono text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-purple-500"
                  spellCheck={false}
                />
              </div>
            )}

            {activeTab === "headers" && (
              <KeyValueEditor
                pairs={tab.headers}
                onChange={setHeaders}
                keyPlaceholder="Header"
                valuePlaceholder="Value"
              />
            )}

            {activeTab === "auth" && (
              <AuthEditorCompact auth={tab.auth} onChange={setAuth} />
            )}
          </div>

          {/* Schema types panel */}
          {schemaTypes.length > 0 && (
            <div className="max-h-32 overflow-auto border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <p className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
                Schema Types ({schemaTypes.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {schemaTypes.slice(0, 50).map((t) => (
                  <span
                    key={t.name}
                    className="rounded bg-[var(--color-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--color-text-muted)]"
                    title={t.kind}
                  >
                    {t.name}
                  </span>
                ))}
                {schemaTypes.length > 50 && (
                  <span className="text-[10px] text-[var(--color-text-dimmed)]">
                    +{schemaTypes.length - 50} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right: Response */}
        <div className="flex w-1/2 flex-col">
          <ResponsePanel />
        </div>
      </div>
    </div>
  );
}

function AuthEditorCompact({
  auth,
  onChange,
}: {
  auth: AuthConfig;
  onChange: (auth: AuthConfig) => void;
}) {
  return (
    <div className="space-y-3">
      <select
        value={auth.type}
        onChange={(e) => {
          const type = e.target.value as AuthConfig["type"];
          switch (type) {
            case "none": onChange({ type: "none" }); break;
            case "bearer": onChange({ type: "bearer", token: "" }); break;
            case "basic": onChange({ type: "basic", username: "", password: "" }); break;
            case "api-key": onChange({ type: "api-key", key: "", value: "", addTo: "header" }); break;
          }
        }}
        className="rounded bg-[var(--color-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-purple-500"
      >
        <option value="none">No Auth</option>
        <option value="bearer">Bearer Token</option>
        <option value="basic">Basic Auth</option>
        <option value="api-key">API Key</option>
      </select>

      {auth.type === "bearer" && (
        <input
          type="text"
          value={auth.token}
          onChange={(e) => onChange({ ...auth, token: e.target.value })}
          placeholder="Token"
          className="w-full rounded bg-[var(--color-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none focus:ring-1 focus:ring-purple-500"
        />
      )}

      {auth.type === "basic" && (
        <div className="space-y-2">
          <input type="text" value={auth.username} onChange={(e) => onChange({ ...auth, username: e.target.value })} placeholder="Username" className="w-full rounded bg-[var(--color-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none" />
          <input type="password" value={auth.password} onChange={(e) => onChange({ ...auth, password: e.target.value })} placeholder="Password" className="w-full rounded bg-[var(--color-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-dimmed)] outline-none" />
        </div>
      )}
    </div>
  );
}
