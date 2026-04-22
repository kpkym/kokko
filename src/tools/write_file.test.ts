import { test, expect } from 'bun:test';
import { tools } from './index';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ctx = { toolCallId: 't', messages: [] } as any;

async function makeTempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), 'kokko-test-'));
}

test('write_file creates a new file with given content', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'new.txt');
    const result = await tools.write_file.execute!(
      { path: file, content: 'hello' },
      ctx,
    );
    expect(result).toContain('wrote 5 bytes');
    expect(await Bun.file(file).text()).toBe('hello');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('write_file overwrites an existing file', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'existing.txt');
    await writeFile(file, 'old');
    await tools.write_file.execute!({ path: file, content: 'new' }, ctx);
    expect(await Bun.file(file).text()).toBe('new');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('write_file creates missing parent directories', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'nested', 'deeper', 'file.txt');
    await tools.write_file.execute!({ path: file, content: 'ok' }, ctx);
    expect(await Bun.file(file).text()).toBe('ok');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('write_file rejects relative paths', async () => {
  await expect(
    tools.write_file.execute!({ path: './out.txt', content: 'x' }, ctx),
  ).rejects.toThrow(/absolute/i);
});

test('write_file rejects content exceeding the size limit', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'huge.txt');
    const content = 'a'.repeat(10 * 1024 * 1024 + 1);
    await expect(
      tools.write_file.execute!({ path: file, content }, ctx),
    ).rejects.toThrow(/exceeds/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
