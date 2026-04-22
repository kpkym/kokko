import { tool } from 'ai';
import { z } from 'zod';
import { requireAbsolute } from './shared';

const GREP_LIMITS = {
  contentDefaultLines: 250,
  timeoutMs: 60_000,
  graceMs: 2_000,
} as const;

export const grep = tool({
  description:
    'Search file contents under an absolute path using ripgrep. ' +
    'Three output modes: "content" (matching lines), "files_with_matches" (paths), "count" (per-file counts). ' +
    'Always searches hidden files and ignores .gitignore. 60s timeout.',
  inputSchema: z.object({
    pattern: z.string().min(1).describe('Regex pattern (rg default syntax).'),
    path: z.string().describe('Absolute path to a file or directory.'),
    output_mode: z
      .enum(['content', 'files_with_matches', 'count'])
      .default('files_with_matches')
      .describe('What to return: matching lines, file paths, or per-file counts.'),
    glob: z.string().optional().describe('Filter files by glob (e.g. "*.ts").'),
    type: z.string().optional().describe('Filter by rg file type (e.g. "ts", "py").'),
    case_insensitive: z.boolean().default(false).describe('rg -i.'),
    multiline: z
      .boolean()
      .default(false)
      .describe('rg -U --multiline-dotall; . matches newlines.'),
    before_context: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('rg -B. Content mode only.'),
    after_context: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('rg -A. Content mode only.'),
    context: z.number().int().min(0).optional().describe('rg -C. Content mode only.'),
    line_numbers: z
      .boolean()
      .default(true)
      .describe('Include line numbers in content mode. Ignored otherwise.'),
    head_limit: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe('Cap on output lines/entries. Default 250 for content, 1000 otherwise.'),
  }),
  execute: async ({ path }) => {
    requireAbsolute(path);
    return '(no matches)';
  },
});
