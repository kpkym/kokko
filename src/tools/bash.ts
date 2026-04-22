import { tool } from 'ai';
import { z } from 'zod';
import { LIMITS, requireAbsolute, truncateTail } from './shared';

function formatBashResult(
  stdoutBytes: Uint8Array,
  stderrBytes: Uint8Array,
  exitCode: number,
  timedOut: boolean,
  timeoutMs: number,
): string {
  const out = truncateTail(stdoutBytes, LIMITS.maxBashBytes);
  const err = truncateTail(stderrBytes, LIMITS.maxBashBytes);

  const parts: string[] = [];
  if (out.truncated) {
    parts.push(`[truncated: kept last ${LIMITS.maxBashBytes} of ${out.total} bytes]`);
  }
  if (out.text.length > 0) parts.push(out.text);

  if (stderrBytes.length > 0) {
    parts.push('--- stderr ---');
    if (err.truncated) {
      parts.push(`[truncated: kept last ${LIMITS.maxBashBytes} of ${err.total} bytes]`);
    }
    parts.push(err.text);
  }

  if (timedOut) {
    parts.push(`[timed out after ${timeoutMs}ms; process killed]`);
  }

  parts.push(`[exit code: ${exitCode}]`);
  return parts.join('\n');
}

export const bash = tool({
  description:
    'Run a shell command via `/bin/bash -c`. Captures stdout and stderr separately and appends `[exit code: N]`. ' +
    'Default timeout 2 min, max 10 min. On timeout: SIGTERM → 2 s grace → SIGKILL. Each stream truncated to the last 30 KB (tail kept). ' +
    'Non-zero exits are returned in the string, not thrown.',
  inputSchema: z.object({
    command: z.string().min(1).describe('The shell command to run.'),
    timeout_ms: z
      .number()
      .int()
      .min(1)
      .max(LIMITS.maxTimeoutMs)
      .optional()
      .describe('Timeout in milliseconds. Default 120000, max 600000.'),
    cwd: z
      .string()
      .optional()
      .describe('Absolute working directory. Defaults to the kokko process cwd.'),
  }),
  execute: async ({ command, timeout_ms, cwd }) => {
    if (cwd !== undefined) requireAbsolute(cwd);
    if (timeout_ms !== undefined && (timeout_ms < 1 || timeout_ms > LIMITS.maxTimeoutMs)) {
      throw new Error(
        `bash: timeout_ms must be between 1 and ${LIMITS.maxTimeoutMs} (got ${timeout_ms})`,
      );
    }
    const timeoutMs = timeout_ms ?? LIMITS.defaultTimeoutMs;

    const proc = Bun.spawn(['/bin/bash', '-c', command], {
      cwd: cwd ?? process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    });

    let timedOut = false;
    const term = setTimeout(() => {
      timedOut = true;
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (proc.exitCode === null) proc.kill('SIGKILL');
      }, 2000).unref();
    }, timeoutMs);
    term.unref();

    try {
      const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
        new Response(proc.stdout).arrayBuffer(),
        new Response(proc.stderr).arrayBuffer(),
        proc.exited,
      ]);
      const stdoutBytes = new Uint8Array(stdoutBuf);
      const stderrBytes = new Uint8Array(stderrBuf);
      return formatBashResult(stdoutBytes, stderrBytes, exitCode, timedOut, timeoutMs);
    } finally {
      clearTimeout(term);
    }
  },
});
