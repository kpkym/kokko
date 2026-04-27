import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildTools } from './index';
import { ctx } from './test-helpers';
import { appendStore } from '../embeddings';

const tools = buildTools({ skills: [] });

async function makeDir() {
  return await mkdtemp(join(tmpdir(), 'kokko-getinfo-'));
}

describe('get_information', () => {
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

  test('returns empty hits when no store exists', async () => {
    const dir = await makeDir();
    try {
      process.env.KOKKO_RAG_DIR = dir;
      const out = (await tools.get_information.execute!(
        { question: 'anything' },
        ctx,
      )) as { hits: unknown[]; note?: string };
      expect(out.hits).toEqual([]);
      expect(out.note).toMatch(/no relevant/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('throws when store exists but VOYAGE_API_KEY missing', async () => {
    const dir = await makeDir();
    try {
      process.env.KOKKO_RAG_DIR = dir;
      await appendStore(dir, [{ id: 'a', source: '/x', content: 'hi' }], [[1, 0, 0]]);
      await expect(
        tools.get_information.execute!({ question: 'q' }, ctx),
      ).rejects.toThrow(/VOYAGE_API_KEY/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
