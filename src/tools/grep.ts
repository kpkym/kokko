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

interface FlagInputs {
  glob?: string;
  type?: string;
  case_insensitive: boolean;
  multiline: boolean;
}

function buildCommonFlags(input: FlagInputs): string[] {
  const flags: string[] = ['--color=never', '--hidden', '--no-ignore'];
  if (input.glob !== undefined) flags.push('--glob', input.glob);
  if (input.type !== undefined) flags.push('--type', input.type);
  if (input.case_insensitive) flags.push('-i');
  if (input.multiline) flags.push('-U', '--multiline-dotall');
  return flags;
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
  flagInputs: FlagInputs,
): Promise<string> {
  const flags = [...buildCommonFlags(flagInputs), '--files-with-matches', '--no-messages'];
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

async function runCount(
  pattern: string,
  path: string,
  headLimit: number,
  flagInputs: FlagInputs,
): Promise<string> {
  const flags = [...buildCommonFlags(flagInputs), '--count', '--no-messages'];
  const { stdout, stderr, exitCode, timedOut } = await runRg(flags, pattern, path);
  if (timedOut) {
    throw new Error(`grep: timed out after ${GREP_LIMITS.timeoutMs}ms; process killed`);
  }
  if (exitCode === 1) return '(no matches)';
  if (exitCode >= 2) throw new Error(stderr.trim() || `grep: rg exited ${exitCode}`);
  const rows = stdout.split('\n').filter((l) => l.length > 0).sort();
  if (rows.length === 0) return '(no matches)';
  return capWithHeader(rows, headLimit).body;
}

interface ContentInputs extends FlagInputs {
  line_numbers: boolean;
  before_context?: number;
  after_context?: number;
  context?: number;
}

async function runContent(
  pattern: string,
  path: string,
  headLimit: number,
  input: ContentInputs,
): Promise<string> {
  const flags = [...buildCommonFlags(input), '--no-heading'];
  if (input.line_numbers) flags.push('--line-number');
  if (input.before_context !== undefined) flags.push('-B', String(input.before_context));
  if (input.after_context !== undefined) flags.push('-A', String(input.after_context));
  if (input.context !== undefined) flags.push('-C', String(input.context));

  const { stdout, stderr, exitCode, timedOut } = await runRg(flags, pattern, path);
  if (timedOut) {
    throw new Error(`grep: timed out after ${GREP_LIMITS.timeoutMs}ms; process killed`);
  }
  if (exitCode === 1) return '(no matches)';
  if (exitCode >= 2) throw new Error(stderr.trim() || `grep: rg exited ${exitCode}`);

  const byteCap = LIMITS.maxBytes;
  const rawBytes = new TextEncoder().encode(stdout);
  const totalBytes = rawBytes.length;

  let body: string;
  let byteHeader: string | null = null;
  if (totalBytes > byteCap) {
    body = new TextDecoder('utf-8').decode(rawBytes.subarray(0, byteCap));
    byteHeader = `[truncated: kept first ${byteCap} of ${totalBytes} bytes]`;
  } else {
    body = stdout;
  }

  const lines = body.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  if (lines.length === 0 && byteHeader === null) return '(no matches)';

  let lineHeader: string | null = null;
  let kept = lines;
  if (kept.length > headLimit) {
    lineHeader = `[truncated: kept first ${headLimit} lines]`;
    kept = kept.slice(0, headLimit);
  }

  const parts: string[] = [];
  if (lineHeader) parts.push(lineHeader);
  if (byteHeader) parts.push(byteHeader);
  parts.push(kept.join('\n'));
  return parts.join('\n');
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
    const hasContext =
      input.before_context !== undefined ||
      input.after_context !== undefined ||
      input.context !== undefined;
    if (hasContext && (input.output_mode ?? 'files_with_matches') !== 'content') {
      throw new Error(
        'grep: context flags (before_context/after_context/context) require output_mode="content"',
      );
    }
    const mode: OutputMode = input.output_mode ?? 'files_with_matches';
    const defaultCap =
      mode === 'content' ? GREP_LIMITS.contentDefaultLines : LIMITS.maxEntries;
    const headLimit = input.head_limit ?? defaultCap;

    if (mode === 'files_with_matches') {
      return await runFilesWithMatches(input.pattern, input.path, headLimit, {
        glob: input.glob,
        type: input.type,
        case_insensitive: input.case_insensitive ?? false,
        multiline: input.multiline ?? false,
      });
    }
    if (mode === 'count') {
      return await runCount(input.pattern, input.path, headLimit, {
        glob: input.glob,
        type: input.type,
        case_insensitive: input.case_insensitive ?? false,
        multiline: input.multiline ?? false,
      });
    }
    return await runContent(input.pattern, input.path, headLimit, {
      glob: input.glob,
      type: input.type,
      case_insensitive: input.case_insensitive ?? false,
      multiline: input.multiline ?? false,
      line_numbers: input.line_numbers ?? true,
      before_context: input.before_context,
      after_context: input.after_context,
      context: input.context,
    });
  },
});
