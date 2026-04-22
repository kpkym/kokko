import { test, expect } from 'bun:test';
import { tools } from './tools';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ctx = { toolCallId: 't', messages: [] } as any;

async function makeTempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'kokko-test-'));
}

test('glob returns absolute paths matching a pattern', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'a.ts'), '');
    await writeFile(join(dir, 'b.ts'), '');
    await writeFile(join(dir, 'c.md'), '');
    const result = await tools.glob.execute!(
      { pattern: '*.ts', cwd: dir },
      ctx,
    ) as string;
    const lines = result.split('\n');
    expect(lines).toEqual([join(dir, 'a.ts'), join(dir, 'b.ts')]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('glob returns (no matches) when nothing matches', async () => {
  const dir = await makeTempDir();
  try {
    const result = await tools.glob.execute!(
      { pattern: '*.never', cwd: dir },
      ctx,
    );
    expect(result).toBe('(no matches)');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('glob rejects relative cwd', async () => {
  await expect(
    tools.glob.execute!({ pattern: '*.ts', cwd: './' }, ctx),
  ).rejects.toThrow(/absolute/i);
});

test('bash echoes stdout and reports exit 0', async () => {
  const result = (await tools.bash.execute!(
    { command: 'echo hello' },
    ctx,
  )) as string;
  expect(result).toContain('hello');
  expect(result).toContain('[exit code: 0]');
  expect(result).not.toContain('--- stderr ---');
});

test('bash captures stderr separately from stdout', async () => {
  const result = (await tools.bash.execute!(
    { command: 'echo out; echo oops 1>&2' },
    ctx,
  )) as string;
  expect(result).toContain('out');
  expect(result).toContain('--- stderr ---');
  expect(result).toContain('oops');
  expect(result).toContain('[exit code: 0]');
});

test('bash reports non-zero exit code without throwing', async () => {
  const result = (await tools.bash.execute!(
    { command: 'exit 3' },
    ctx,
  )) as string;
  expect(result).toContain('[exit code: 3]');
});

test('bash respects cwd', async () => {
  const dir = await makeTempDir();
  try {
    const result = (await tools.bash.execute!(
      { command: 'pwd', cwd: dir },
      ctx,
    )) as string;
    // macOS /tmp is a symlink to /private/tmp; accept either realpath.
    expect(result.includes(dir) || result.includes('/private' + dir)).toBe(true);
    expect(result).toContain('[exit code: 0]');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('bash rejects relative cwd', async () => {
  await expect(
    tools.bash.execute!({ command: 'pwd', cwd: './' }, ctx),
  ).rejects.toThrow(/absolute/i);
});

test('bash omits the stderr block when stderr is empty', async () => {
  const result = (await tools.bash.execute!(
    { command: 'echo only-stdout' },
    ctx,
  )) as string;
  expect(result).not.toContain('--- stderr ---');
});

test('bash rejects timeout_ms over the cap', async () => {
  await expect(
    tools.bash.execute!(
      { command: 'echo x', timeout_ms: 700_000 },
      ctx,
    ),
  ).rejects.toThrow();
});

test('bash times out and marks the process killed', async () => {
  const start = Date.now();
  const result = (await tools.bash.execute!(
    { command: 'sleep 5', timeout_ms: 200 },
    ctx,
  )) as string;
  const elapsed = Date.now() - start;
  expect(elapsed).toBeLessThan(2500);
  expect(result).toContain('[timed out after 200ms; process killed]');
  expect(result).toMatch(/\[exit code: -?\d+\]/);
});

test('bash truncates large stdout to the last 30000 bytes', async () => {
  // yes $'a' | head -c 40000 → 40 KB of 'a' characters
  const result = (await tools.bash.execute!(
    { command: "yes a | tr -d '\\n' | head -c 40000" },
    ctx,
  )) as string;
  expect(result).toMatch(/\[truncated: kept last 30000 of 40000 bytes\]/);
  expect(result).toContain('[exit code: 0]');

  // Tail-kept check: the truncated body should be exactly 30000 'a's.
  const header = '[truncated: kept last 30000 of 40000 bytes]\n';
  const afterHeader = result.slice(result.indexOf(header) + header.length);
  const body = afterHeader.slice(0, 30000);
  expect(body).toBe('a'.repeat(30000));
});

test('bash handles large stdout past the ArrayBuffer threshold', async () => {
  // 500 KB of 'a' — reliably above Bun's Response.bytes() → ArrayBuffer boundary (~200 KB).
  const result = (await tools.bash.execute!(
    { command: "yes a | tr -d '\\n' | head -c 500000" },
    ctx,
  )) as string;
  expect(result).toContain('[truncated: kept last 30000 of 500000 bytes]');
  expect(result).toContain('[exit code: 0]');
});
