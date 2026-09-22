# AI Bracho

AI Bracho is a local-first Windows desktop companion. Version 0.2 connects the
Tauri application to an OpenAI-compatible local llama.cpp server with streamed
responses. Memory remains limited to the current application session.

## Development

Prerequisites for development only:

- Node.js 20+
- pnpm
- Rust stable with the Windows MSVC target
- Tauri 2 Windows prerequisites (WebView2 and MSVC Build Tools)

```powershell
pnpm install
pnpm tauri dev
```

For the complete development stack (Q4 model, llama-server, and Tauri), use:

```powershell
.\dev-start.bat
```

Development-only runtime, model, and API locations are kept in
`dev-config.bat`. The launcher waits for `/health` instead of relying on a fixed
delay and stops only the llama-server process that it started.

Useful checks:

```powershell
pnpm check
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml
```

The final portable build will not require Node.js, pnpm, Rust, or other
development tools on the target computer.

## Project layout

- `src/` — UI and frontend application code
- `src/core/` — companion-domain state, independent from the UI
- `src/features/` — feature modules such as chat and character
- `src/services/` — replaceable frontend service boundaries and Tauri LLM adapter
- `src-tauri/src/llm/` — model-agnostic OpenAI-compatible HTTP/streaming client
- `src-tauri/src/companion/` — companion personality and domain configuration
- `src-tauri/` — Rust/Tauri application shell and system integrations
- `runtime/` — local llama.cpp development runtime (ignored by Git)

## v0.2 scope

The chat sends the current in-memory conversation to a local llama-server and
streams the reply into the interface. The application handles offline, timeout,
malformed-response, and interrupted-stream states without exiting. Long-term
memory, tools, model discovery, and portable production startup remain out of
scope.
