import { test, expect } from 'bun:test';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tools } from './index';
import { ctx, makeTempDir } from './test-helpers';

test('grep rejects relative path', async () => {
  await expect(
    tools.grep.execute!({ pattern: 'x', path: './here' }, ctx),
  ).rejects.toThrow(/absolute/i);
});

test('grep files_with_matches returns sorted absolute paths', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'a.ts'), 'hello world\n');
    await writeFile(join(dir, 'b.ts'), 'hello again\n');
    await writeFile(join(dir, 'c.ts'), 'nothing here\n');
    const result = (await tools.grep.execute!(
      { pattern: 'hello', path: dir },
      ctx,
    )) as string;
    const lines = result.split('\n');
    expect(lines).toEqual([join(dir, 'a.ts'), join(dir, 'b.ts')]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('grep files_with_matches returns (no matches) when pattern misses', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'a.ts'), 'hello\n');
    const result = await tools.grep.execute!(
      { pattern: 'neverappears', path: dir },
      ctx,
    );
    expect(result).toBe('(no matches)');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('grep files_with_matches truncates at 1000 entries', async () => {
  const dir = await makeTempDir();
  try {
    const writes: Promise<void>[] = [];
    for (let i = 0; i < 1100; i++) {
      writes.push(writeFile(join(dir, `f${String(i).padStart(4, '0')}.ts`), 'hello\n'));
    }
    await Promise.all(writes);
    const result = (await tools.grep.execute!(
      { pattern: 'hello', path: dir },
      ctx,
    )) as string;
    expect(result.startsWith('[truncated: 1000 of 1000+ matches]\n')).toBe(true);
    const body = result.split('\n').slice(1);
    expect(body.length).toBe(1000);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
