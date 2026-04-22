import { tool } from 'ai';
import { z } from 'zod';
import { LIMITS, requireAbsolute } from './shared';

export const glob = tool({
  description:
    'Match files by glob pattern under an absolute base directory. Returns absolute paths. Caps at 1000 matches.',
  inputSchema: z.object({
    pattern: z.string().describe('Glob pattern (e.g. "**/*.ts").'),
    cwd: z.string().describe('Absolute base directory to scan from.'),
  }),
  execute: async ({ pattern, cwd }) => {
    requireAbsolute(cwd);
    const g = new Bun.Glob(pattern);
    const prefix = cwd.endsWith('/') ? cwd : cwd + '/';
    const results: string[] = [];
    let hitCap = false;
    for await (const rel of g.scan({ cwd, onlyFiles: true, dot: false })) {
      if (results.length >= LIMITS.maxEntries) {
        hitCap = true;
        break;
      }
      results.push(prefix + rel);
    }
    if (results.length === 0) return '(no matches)';
    results.sort();
    const header = hitCap
      ? `[truncated: ${LIMITS.maxEntries} of ${LIMITS.maxEntries}+ matches]\n`
      : '';
    return header + results.join('\n');
  },
});
