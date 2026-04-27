const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function parts(v: string): [number, number, number] | null {
  const m = SEMVER_RE.exec(v);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function compareSemver(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  if (pa === null || pb === null) {
    throw new Error(`compareSemver: invalid version: ${pa === null ? a : b}`);
  }
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] - pb[i];
  }
  return 0;
}

export function pickHighestVersion(candidates: string[]): string | null {
  let best: string | null = null;
  for (const c of candidates) {
    if (parts(c) === null) continue;
    if (best === null || compareSemver(c, best) > 0) best = c;
  }
  return best;
}
