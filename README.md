# kokko

A minimal terminal REPL that runs an agentic loop against an LLM. The model streams text and emits tool calls; kokko executes them and feeds results back until the model stops or the step cap is hit. Runtime is [Bun](https://bun.com); the model layer is the [Vercel AI SDK](https://sdk.vercel.ai/).

## Setup

```bash
bun install
cp .env.example .env   # then fill in keys
bun run start
```

### Environment

Required (enforced at startup):

- `AI_PROVIDER` — `openai` | `anthropic`.
- Anthropic: `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`.
- OpenAI: `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.

Optional:

- `AI_MAX_STEPS` — integer ≥ 1. Caps tool rounds per turn (default `10`).

## Tools

Defined in `src/tools/`, one file per tool, registered in `src/tools/index.ts`.

- `get_current_time` — no args, returns an ISO 8601 timestamp.
- `read_file({ path, offset?, limit? })` — reads a UTF-8 text file at an absolute path. 1-based `offset`/`limit` page through long files; caps at 2000 lines / 256KB; refuses binary files.
- `write_file({ path, content })` — writes (or overwrites) a UTF-8 text file at an absolute path. Creates parent directories. Rejects content >10MB.
- `edit_file({ path, old_string, new_string, replace_all? })` — exact string replacement. `old_string` must appear exactly once unless `replace_all=true`.
- `list_dir({ path })` — lists direct children of a directory. `/` suffix = directory, `@` = symlink. Caps at 1000 entries.
- `glob({ pattern, cwd })` — glob-matches files under an absolute `cwd`. Returns absolute paths. Caps at 1000 matches.
- `bash({ command, timeout_ms?, cwd? })` — runs `/bin/bash -c <command>`. Captures stdout and stderr separately and appends `[exit code: N]`. Default timeout 2 min, max 10 min; on timeout, SIGTERM → 2 s grace → SIGKILL. Each stream truncated to the last 30 KB. Non-zero exits are returned, not thrown.

All filesystem/shell tools require absolute paths.

Tool events are shown inline in the stream:

```
→ read_file({"path":"/abs/path/README.md"})
← read_file ok (1423 chars)
```

Errors show `ERROR:` instead of `ok` and are fed back to the model.

### Adding a tool

1. Create `src/tools/<name>.ts` exporting a `tool({ description, inputSchema: z.object(...), execute })`.
2. Register it in `src/tools/index.ts`.
3. Add `src/tools/<name>.test.ts` (colocated, uses helpers in `test-helpers.ts`).

```ts
import { tool } from 'ai';
import { z } from 'zod';

export const my_tool = tool({
  description: 'What it does.',
  inputSchema: z.object({ /* fields */ }),
  execute: async (input) => { /* ... */ },
});
```

## Testing

```bash
bun test                        # all tests
bun test src/tools/bash.test.ts # single file
```

## Devtools

```bash
bun run devtools
```

Launches `@ai-sdk/devtools` to inspect model traffic. The app wraps its model with `devToolsMiddleware()`, so traces appear here when the REPL is running.
