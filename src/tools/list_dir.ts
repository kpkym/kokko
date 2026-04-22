import { tool } from 'ai';
import { z } from 'zod';
import { readdir, stat } from 'node:fs/promises';
import { LIMITS, requireAbsolute } from './shared';

export const list_dir = tool({
  description:
    'List direct children of a directory at an absolute path. Appends / to dirs, @ to symlinks. Caps at 1000 entries.',
  inputSchema: z.object({
    path: z.string().describe('Absolute path to a directory.'),
  }),
  execute: async ({ path }) => {
    requireAbsolute(path);
    const st = await stat(path);
    if (!st.isDirectory()) {
      throw new Error(`list_dir: not a directory (path=${path})`);
    }
    const entries = await readdir(path, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const total = entries.length;
    if (total === 0) return '(empty)';
    const capped = entries.slice(0, LIMITS.maxEntries);
    const lines = capped.map((e) => {
      if (e.isDirectory()) return e.name + '/';
      if (e.isSymbolicLink()) return e.name + '@';
      return e.name;
    });
    const header =
      total > LIMITS.maxEntries
        ? `[truncated: ${LIMITS.maxEntries} of ${total} entries]\n`
        : '';
    return header + lines.join('\n');
  },
});
