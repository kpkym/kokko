export const LIMITS = {
  maxLines: 2000,
  maxBytes: 262_144,
  maxWriteBytes: 10_485_760,
  maxEntries: 1000,
} as const;

export function requireAbsolute(path: string): void {
  if (!path.startsWith('/')) {
    throw new Error(`path must be absolute (got: ${path})`);
  }
}

export function detectBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8192);
  for (let i = 0; i < n; i++) {
    if (bytes[i] === 0) return true;
  }
  return false;
}

export function truncateTail(
  bytes: Uint8Array,
  cap: number,
): { text: string; truncated: boolean; total: number } {
  const total = bytes.length;
  if (total <= cap) {
    return { text: new TextDecoder('utf-8').decode(bytes), truncated: false, total };
  }
  const kept = bytes.subarray(total - cap);
  return { text: new TextDecoder('utf-8').decode(kept), truncated: true, total };
}

export interface SpawnResult {
  stdoutBytes: Uint8Array;
  stderrBytes: Uint8Array;
  exitCode: number;
  timedOut: boolean;
}

// Spawns `cmd`, capturing stdout/stderr; on timeout sends SIGTERM, then SIGKILL after `graceMs`.
// Throws synchronously (e.g. ENOENT) if the binary is not on PATH — callers wrap if they
// want a friendlier message.
export async function spawnWithTimeout(
  cmd: string[],
  opts: { cwd?: string; timeoutMs: number; graceMs?: number },
): Promise<SpawnResult> {
  const graceMs = opts.graceMs ?? 2_000;
  const proc = Bun.spawn(cmd, {
    cwd: opts.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

  let timedOut = false;
  const term = setTimeout(() => {
    timedOut = true;
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (proc.exitCode === null) proc.kill('SIGKILL');
    }, graceMs).unref();
  }, opts.timeoutMs);
  term.unref();

  try {
    const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
      new Response(proc.stdout).arrayBuffer(),
      new Response(proc.stderr).arrayBuffer(),
      proc.exited,
    ]);
    return {
      stdoutBytes: new Uint8Array(stdoutBuf),
      stderrBytes: new Uint8Array(stderrBuf),
      exitCode,
      timedOut,
    };
  } finally {
    clearTimeout(term);
  }
}
