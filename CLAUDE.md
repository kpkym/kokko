# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

kokko is a minimal terminal REPL that runs an agentic loop against an LLM: the model streams text and emits tool calls, kokko executes them and feeds results back, and the step count is capped per turn. Runtime is Bun + TypeScript; the model layer is the Vercel AI SDK (`ai`) with provider adapters for OpenAI and Anthropic.

## Commands

- `bun run start` — start the REPL (requires env vars, see below).
- `bun test` — run all tests. Tests are colocated next to sources as `*.test.ts`.
- `bun test src/tools/bash.test.ts` — run a single test file. Add `-t "<pattern>"` to filter by test name.
- `bun run devtools` — launch `@ai-sdk/devtools` to inspect model traffic (the app wraps its model with `devToolsMiddleware()`, so traces appear here when the REPL is running).

No lint/typecheck scripts are configured; `tsc` is not invoked directly (`noEmit` is set and Bun runs `.ts` sources natively).

## Environment

Required env vars are enforced at startup by `src/config.ts` (missing ones throw). Bun auto-loads `.env`.

- `AI_PROVIDER` — `openai` | `anthropic`.
- If `anthropic`: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`.
- If `openai`: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.
- `AI_MAX_STEPS` — optional integer ≥ 1, caps tool rounds per turn (default `10`).

See `.env.example` for the shape.

## Architecture

The codebase is deliberately small; three layers matter.

**REPL loop (`src/index.ts`).** Maintains a single `ModelMessage[]` across turns. Each turn calls `streamText({ model, messages, tools, stopWhen: stepCountIs(config.maxSteps) })` and renders the `fullStream` by part type: `text-delta` is printed inline; `tool-call` / `tool-result` / `tool-error` are rendered as `→ name(args)` / `← name ok|ERROR` status lines; `error` parts abort the stream without appending to history. On success, the full response messages (assistant text + tool calls + tool results) are appended so the next turn sees them.

**Config (`src/config.ts`).** `loadConfig()` runs at module import, so a missing env var fails the process at startup. `resolveModel()` builds the provider-specific model and wraps it with `devToolsMiddleware()` via `wrapLanguageModel`. To add a provider, extend the `Provider` union, add a branch in `loadConfig()` and `resolveModel()`.

**Tools (`src/tools/`).** Each tool is its own file, defined with `tool({ description, inputSchema: z.object(...), execute })` from the AI SDK. `src/tools/index.ts` re-exports them as a single `tools` object passed to `streamText`. Shared conventions live in `src/tools/shared.ts`:

- `LIMITS` — `maxLines` (2000), `maxBytes` (256KB for reads), `maxWriteBytes` (10MB), `maxEntries` (1000). Bash-only limits (`maxBashBytes`, timeouts) live in `bash.ts`, not shared, because they apply to no other tool.
- `requireAbsolute(path)` — every filesystem/shell tool rejects relative paths. This is a load-bearing invariant; don't weaken it.
- `detectBinary(bytes)` — NUL-byte scan of the first 8KB; used by `read_file` to refuse binaries.
- `truncateTail(bytes, cap)` — keeps the last `cap` bytes and reports total; used by `bash` for stdout/stderr capping.

Tools prefer Bun-native APIs (`Bun.file`, `Bun.write`, `Bun.Glob`, `Bun.spawn`) over `node:fs`. `bash` uses `Bun.spawn(['/bin/bash', '-c', command])` with a SIGTERM → 2 s grace → SIGKILL timeout chain and returns a formatted string containing stdout, an optional `--- stderr ---` block, and a trailing `[exit code: N]` — non-zero exits are returned, not thrown. `grep` shells out to system `ripgrep` with three output modes (`content` / `files_with_matches` / `count`); hidden + gitignored files are always searched, 60 s timeout.

### Adding a tool

1. Create `src/tools/<name>.ts` exporting a `tool({...})`.
2. Enforce invariants in `execute`: call `requireAbsolute` on any path input, respect `LIMITS`, throw `Error` for preconditions. Thrown errors surface as `tool-error` parts in the REPL and are fed back to the model.
3. Register in `src/tools/index.ts`.
4. Add `src/tools/<name>.test.ts`. Use `tools.<name>.execute!(input, ctx)` via the `ctx` and `makeTempDir` helpers in `src/tools/test-helpers.ts`.

## Testing

Tests import tools through `./index` (not directly) so the registration path is exercised, and pass the shared `ctx` from `test-helpers.ts` as the `ToolExecutionOptions` arg. Tests that touch the filesystem use `makeTempDir()` and clean up in a `finally`. Keep tests colocated — one `*.test.ts` per source file.
