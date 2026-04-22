import { test, expect } from 'bun:test';
import { tools } from './index';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
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
