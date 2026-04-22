import { tool } from 'ai';
import { z } from 'zod';
import { LIMITS, requireAbsolute } from './shared';

const GREP_LIMITS = {
  contentDefaultLines: 250,
  timeoutMs: 60_000,
  graceMs: 2_000,
} as const;

type OutputMode = 'content' | 'files_with_matches' | 'count';

interface SpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
}

async function runRg(flags: string[], pattern: string, path: string): Promise<SpawnResult> {
  let proc: ReturnType<typeof Bun.spawn>;
  try {
    proc = Bun.spawn(['rg', ...flags, '--', pattern, path], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(
        'grep: ripgrep (`rg`) not found on PATH. Install it (e.g. `brew install ripgrep`) and retry.',
      );
    }
    throw err;
  }

  let timedOut = false;
  const term = setTimeout(() => {
    timedOut = true;
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill('SIGKILL');
    }, GREP_LIMITS.graceMs).unref();
  }, GREP_LIMITS.timeoutMs);
  term.unref();

  try {
    const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
      new Response(proc.stdout).arrayBuffer(),
      new Response(proc.stderr).arrayBuffer(),
      proc.exited,
    ]);
    return {
      stdout: new TextDecoder('utf-8').decode(new Uint8Array(stdoutBuf)),
      stderr: new TextDecoder('utf-8').decode(new Uint8Array(stderrBuf)),
      exitCode,
      timedOut,
    };
  } finally {
    clearTimeout(term);
  }
}

function buildBaseFlags(): string[] {
  return ['--color=never', '--hidden', '--no-ignore'];
}

function capWithHeader(
  lines: string[],
  cap: number,
): { body: string; truncated: boolean } {
  if (lines.length <= cap) {
    return { body: lines.join('\n'), truncated: false };
  }
  const kept = lines.slice(0, cap);
  const header = `[truncated: ${cap} of ${cap}+ matches]`;
  return { body: [header, ...kept].join('\n'), truncated: true };
}

async function runFilesWithMatches(
  pattern: string,
  path: string,
  headLimit: number,
): Promise<string> {
  const flags = [...buildBaseFlags(), '--files-with-matches', '--no-messages'];
  const { stdout, stderr, exitCode, timedOut } = await runRg(flags, pattern, path);
  if (timedOut) {
    throw new Error(`grep: timed out after ${GREP_LIMITS.timeoutMs}ms; process killed`);
  }
  if (exitCode === 1) return '(no matches)';
  if (exitCode >= 2) throw new Error(stderr.trim() || `grep: rg exited ${exitCode}`);
  const paths = stdout.split('\n').filter((l) => l.length > 0).sort();
  if (paths.length === 0) return '(no matches)';
  return capWithHeader(paths, headLimit).body;
}

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
  execute: async (input) => {
    requireAbsolute(input.path);
    const mode: OutputMode = input.output_mode ?? 'files_with_matches';
    const defaultCap =
      mode === 'content' ? GREP_LIMITS.contentDefaultLines : LIMITS.maxEntries;
    const headLimit = input.head_limit ?? defaultCap;

    if (mode === 'files_with_matches') {
      return await runFilesWithMatches(input.pattern, input.path, headLimit);
    }
    return '(no matches)';
  },
});
