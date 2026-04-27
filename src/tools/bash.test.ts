import { test, expect } from 'bun:test';
import { buildTools } from './index';
import { rm } from 'node:fs/promises';
import { ctx, makeTempDir } from './test-helpers';

const tools = buildTools({ skills: [] });

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
  const result = (await tools.bash.execute!(
    { command: "yes a | tr -d '\\n' | head -c 40000" },
    ctx,
  )) as string;
  expect(result).toMatch(/\[truncated: kept last 30000 of 40000 bytes\]/);
  expect(result).toContain('[exit code: 0]');

  const header = '[truncated: kept last 30000 of 40000 bytes]\n';
  const afterHeader = result.slice(result.indexOf(header) + header.length);
  const body = afterHeader.slice(0, 30000);
  expect(body).toBe('a'.repeat(30000));
});

test('bash handles large stdout past the ArrayBuffer threshold', async () => {
  const result = (await tools.bash.execute!(
    { command: "yes a | tr -d '\\n' | head -c 500000" },
    ctx,
  )) as string;
  expect(result).toContain('[truncated: kept last 30000 of 500000 bytes]');
  expect(result).toContain('[exit code: 0]');
});
