# kokko

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.3.10. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Agentic loop

The REPL runs an agentic loop on each turn: the model may emit tool calls,
which kokko executes and feeds back to the model until the model stops or the
step cap is hit.

Starter tools (see `tools.ts`):
- `get_current_time` — no args, returns an ISO 8601 timestamp.
- `read_file({ path })` — reads a text file via `Bun.file`.

Tool events are shown inline in the stream:

```
→ read_file({"path":"./README.md"})
← read_file ok (1423 chars)
```

Errors show `ERROR:` instead of `ok` and are fed back to the model.

### Environment

- `AI_MAX_STEPS` — optional. Integer ≥ 1. Caps the number of steps
  (model generation + tool execution counts as one round). Default: `10`.

### Adding a tool

Add an entry to the `tools` object in `tools.ts`:

```ts
import { tool } from 'ai';
import { z } from 'zod';

export const tools = {
  // ...
  my_tool: tool({
    description: 'What it does.',
    inputSchema: z.object({ /* fields */ }),
    execute: async (input) => { /* ... */ },
  }),
};
```
