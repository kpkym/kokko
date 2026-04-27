import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { rm, mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registry } from './index';
import { makeCtx } from './test-helpers';

const indexCmd = registry.index!;

async function makeWorkdir() {
  return await mkdtemp(join(tmpdir(), 'kokko-index-cmd-'));
}

describe('/index', () => {
  const prevKey = process.env.VOYAGE_API_KEY;
  const prevDir = process.env.KOKKO_RAG_DIR;

  beforeEach(() => {
    delete process.env.VOYAGE_API_KEY;
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.VOYAGE_API_KEY;
    else process.env.VOYAGE_API_KEY = prevKey;
    if (prevDir === undefined) delete process.env.KOKKO_RAG_DIR;
    else process.env.KOKKO_RAG_DIR = prevDir;
  });

  test('rejects missing path', async () => {
    await expect(indexCmd.run([], makeCtx())).rejects.toThrow(/usage/);
  });

  test('rejects relative path', async () => {
    await expect(indexCmd.run(['rel/path.md'], makeCtx())).rejects.toThrow(/absolute/);
  });

  test('rejects non-existent path', async () => {
    await expect(indexCmd.run(['/no/such/path/here'], makeCtx())).rejects.toThrow();
  });

  test('reports zero matches for empty directory', async () => {
    const work = await makeWorkdir();
    try {
      const empty = join(work, 'empty');
      await mkdir(empty, { recursive: true });
      await indexCmd.run([empty], makeCtx());
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });

  test('throws when files exist but VOYAGE_API_KEY missing', async () => {
    const work = await makeWorkdir();
    try {
      const ragDir = join(work, 'rag');
      process.env.KOKKO_RAG_DIR = ragDir;
      await writeFile(join(work, 'a.md'), 'hello world');
      await expect(indexCmd.run([join(work, 'a.md')], makeCtx())).rejects.toThrow(
        /VOYAGE_API_KEY/,
      );
    } finally {
      await rm(work, { recursive: true, force: true });
    }
  });
});
