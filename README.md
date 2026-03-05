<p align="center">
  <img src="apps/desktop/src-tauri/icons/128x128@2x.png" alt="ApiArk" width="96" height="96" />
</p>

<h1 align="center">ApiArk</h1>

<p align="center">
  <strong>The API platform that respects your privacy, your RAM, and your Git workflow.</strong>
</p>

<p align="center">
  No login. No cloud. No bloat.
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#performance">Performance</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#switching-from-postman">Switching from Postman</a> &bull;
  <a href="#development">Development</a>
</p>

---

## Why ApiArk?

| | Postman | Bruno | Hoppscotch | **ApiArk** |
|---|---|---|---|---|
| **Framework** | Electron | Electron | Tauri | **Tauri v2** |
| **RAM Usage** | 300-800 MB | 150-300 MB | 50-80 MB | **~60 MB** |
| **Startup** | 10-30s | 3-8s | <2s | **<2s** |
| **Account Required** | Yes | No | Optional | **No** |
| **Data Storage** | Cloud | Filesystem | IndexedDB | **Filesystem (YAML)** |
| **Git-Friendly** | No | Yes (.bru) | No | **Yes (standard YAML)** |
| **gRPC** | Yes | Yes | No | **Yes** |
| **Mock Servers** | Cloud only | No | No | **Local** |
| **Monitors** | Cloud only | No | No | **Local** |
| **Plugin System** | No | No | No | **JS + WASM** |

## Features

**Multi-Protocol** — REST, GraphQL, gRPC, WebSocket, SSE, MQTT, Socket.IO in one app.

**Local-First Storage** — Every request is a `.yaml` file. Collections are directories. Everything is git-diffable. No proprietary formats.

**TypeScript Scripting** — Pre/post-request scripts with full type definitions. `ark.test()`, `ark.expect()`, `ark.env.set()`.

**Collection Runner** — Run entire collections with data-driven testing (CSV/JSON), configurable iterations, JUnit/HTML reports.

**Local Mock Servers** — Create mock APIs from your collections. Faker.js data, latency simulation, error injection.

**Scheduled Monitoring** — Cron-based automated testing with desktop notifications and webhook alerts.

**API Docs Generation** — Generate HTML + Markdown documentation from your collections.

**OpenAPI Editor** — Edit and lint OpenAPI specs with Spectral integration.

**Response Diff** — Compare responses side-by-side across runs.

**Proxy Capture** — Local intercepting HTTP/HTTPS proxy for traffic inspection and replay.

**AI Assistant** — Natural language to requests, auto-generate tests, OpenAI-compatible API.

**Plugin System** — Extend ApiArk with JavaScript or WASM plugins.

**Import Everything** — Postman, Insomnia, Bruno, Hoppscotch, OpenAPI, HAR, cURL. One-click migration.

**Dark Mode + Themes** — Dark, Light, Black/OLED themes. 8 accent colors. Your app, your look.

**Zen Mode** — Hide all chrome with `Ctrl+.` for focused API debugging.

## Performance

Built with Tauri v2 (Rust backend + native OS webview), not Electron.

| Metric | Target |
|---|---|
| Binary size | ~20 MB |
| RAM at idle | ~60 MB |
| Cold startup | <2s |
| Request send latency | <10ms overhead |

## Installation

### Download

> Coming soon — pre-built binaries for macOS, Windows, and Linux.

### Build from Source

**Prerequisites:** Node.js 22+, pnpm 10+, Rust toolchain, [Tauri v2 system deps](https://v2.tauri.app/start/prerequisites/)

```bash
git clone https://github.com/berbicanes/apiark.git
cd apiark
pnpm install
pnpm tauri build
```

## Switching from Postman

1. Export your Postman collection (Collection v2.1 JSON)
2. Open ApiArk
3. `Ctrl+K` > "Import Collection" > select your file
4. Done. Your requests are now YAML files you own.

ApiArk imports from: **Postman**, **Insomnia**, **Bruno**, **Hoppscotch**, **OpenAPI 3.x**, **HAR**, **cURL**.

## CLI

```bash
# Run a collection
apiark run ./my-collection --env production

# With data-driven testing
apiark run ./my-collection --data users.csv --reporter junit

# Import a Postman collection
apiark import postman-export.json
```

## Data Format

Your data is plain YAML. No lock-in. No proprietary encoding.

```yaml
# users/create-user.yaml
name: Create User
method: POST
url: "{{baseUrl}}/api/users"

headers:
  Content-Type: application/json

auth:
  type: bearer
  token: "{{adminToken}}"

body:
  type: json
  content: |
    {
      "name": "{{userName}}",
      "email": "{{userEmail}}"
    }

assert:
  status: 201
  body.id: { type: string }
  responseTime: { lt: 2000 }

tests: |
  ark.test("should return created user", () => {
    const body = ark.response.json();
    ark.expect(body).to.have.property("id");
  });
```

## No Lock-In Pledge

> If you decide to leave ApiArk, your data leaves with you. Every file is a standard format. Every database is open. We will never make it hard to switch away.

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# TypeScript check
pnpm -C apps/desktop exec tsc --noEmit

# Build for production
pnpm tauri build
```

### Project Structure

```
apiark/
├── apps/
│   ├── desktop/           # Tauri v2 desktop app
│   │   ├── src/           # React frontend
│   │   └── src-tauri/     # Rust backend
│   ├── cli/               # CLI tool (Rust)
│   ├── mcp-server/        # MCP server for AI editors
│   └── vscode-extension/  # VS Code extension
├── packages/
│   ├── types/             # Shared TypeScript types
│   └── importer/          # Collection importers
└── CLAUDE.md              # Full product & engineering blueprint
```

### Tech Stack

**Frontend:** React 19, TypeScript, Vite 6, Zustand, Tailwind CSS 4, Monaco Editor, Radix UI

**Backend:** Rust, Tauri v2, reqwest, tokio, tonic (gRPC), axum (mock servers), deno_core (scripting)

## Contributing

Contributions are welcome. Please read the [CLAUDE.md](CLAUDE.md) blueprint for architecture details and conventions.

## License

MIT
