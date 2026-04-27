import { test, expect } from 'bun:test';
import { buildTools } from './index';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ctx, makeTempDir } from './test-helpers';

const tools = buildTools({ skills: [] });

test('list_dir lists children with type markers, alphabetically, including dotfiles', async () => {
  const dir = await makeTempDir();
  try {
    await writeFile(join(dir, 'b.txt'), '');
    await writeFile(join(dir, '.hidden'), '');
    await mkdir(join(dir, 'a-subdir'));
    const result = await tools.list_dir.execute!({ path: dir }, ctx) as string;
    const lines = result.split('\n');
    expect(lines).toEqual(['.hidden', 'a-subdir/', 'b.txt']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('list_dir returns (empty) for empty directories', async () => {
  const dir = await makeTempDir();
  try {
    const result = await tools.list_dir.execute!({ path: dir }, ctx);
    expect(result).toBe('(empty)');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('list_dir throws when path is not a directory', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'file.txt');
    await writeFile(file, '');
    await expect(
      tools.list_dir.execute!({ path: file }, ctx),
    ).rejects.toThrow(/not a directory/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('list_dir rejects relative paths', async () => {
  await expect(
    tools.list_dir.execute!({ path: './' }, ctx),
  ).rejects.toThrow(/absolute/i);
});
