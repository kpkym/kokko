import { test, expect } from 'bun:test';
import { tools } from './index';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ctx, makeTempDir } from './test-helpers';

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
