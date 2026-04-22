export const LIMITS = {
  maxLines: 2000,
  maxBytes: 262_144,
  maxWriteBytes: 10_485_760,
  maxEntries: 1000,
  maxBashBytes: 30_000,
  defaultTimeoutMs: 120_000,
  maxTimeoutMs: 600_000,
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
