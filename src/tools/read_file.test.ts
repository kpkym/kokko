import { test, expect } from 'bun:test';
import { tools } from './index';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { ctx, makeTempDir } from './test-helpers';

test('read_file returns file contents as a string', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'sample.json');
    await writeFile(file, '{"name":"kokko"}');
    const result = await tools.read_file.execute!({ path: file }, ctx);
    expect(typeof result).toBe('string');
    expect(result).toContain('"name":"kokko"');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('read_file propagates filesystem errors', async () => {
  await expect(
    tools.read_file.execute!(
      { path: '/nonexistent/does-not-exist-xyz.txt' },
      ctx,
    ),
  ).rejects.toThrow();
});

test('read_file rejects relative paths', async () => {
  await expect(
    tools.read_file.execute!({ path: './package.json' }, ctx),
  ).rejects.toThrow(/absolute/i);
});

test('read_file honours 1-based offset and limit', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'lines.txt');
    const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`).join('\n');
    await writeFile(file, lines);

    const result = await tools.read_file.execute!(
      { path: file, offset: 2, limit: 3 },
      ctx,
    );
    expect(result).toContain('line2');
    expect(result).toContain('line3');
    expect(result).toContain('line4');
    expect(result).not.toContain('line1');
    expect(result).not.toContain('line5');
    expect(result).toContain('[truncated: showing lines 2-4 of 10]');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('read_file throws on binary files', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'bin.dat');
    await writeFile(file, new Uint8Array([0x48, 0x00, 0x49]));
    await expect(
      tools.read_file.execute!({ path: file }, ctx),
    ).rejects.toThrow(/binary/i);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('read_file prepends truncation header when line cap is hit', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'big.txt');
    const content = Array.from({ length: 2500 }, (_, i) => `row${i + 1}`).join('\n');
    await writeFile(file, content);
    const result = await tools.read_file.execute!({ path: file }, ctx) as string;
    expect(result.startsWith('[truncated: showing lines 1-2000 of 2500]\n')).toBe(true);
    expect(result).toContain('row2000');
    expect(result).not.toContain('row2001');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('read_file does not count trailing newline as an extra line', async () => {
  const dir = await makeTempDir();
  try {
    const file = join(dir, 'trail.txt');
    await writeFile(file, 'a\nb\nc\n');
    const result = await tools.read_file.execute!({ path: file }, ctx) as string;
    expect(result).not.toContain('[truncated');
    expect(result).toBe('a\nb\nc');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
