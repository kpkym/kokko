import { describe, expect, test } from 'bun:test';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { appendStore, loadStore, defaultRagDir } from './store';

async function makeDir() {
  return await mkdtemp(join(tmpdir(), 'kokko-store-'));
}

describe('store', () => {
  test('loadStore returns null when no files', async () => {
    const dir = await makeDir();
    try {
      expect(await loadStore(dir)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('append then load round-trip', async () => {
    const dir = await makeDir();
    try {
      const r1 = await appendStore(
        dir,
        [
          { id: 'a', source: '/x.md', content: 'hello' },
          { id: 'b', source: '/x.md', content: 'world' },
        ],
        [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      );
      expect(r1).toEqual({ added: 2, total: 2, dim: 3 });

      const loaded = await loadStore(dir);
      expect(loaded).not.toBeNull();
      expect(loaded!.dim).toBe(3);
      expect(loaded!.chunks).toEqual([
        { id: 'a', source: '/x.md', content: 'hello' },
        { id: 'b', source: '/x.md', content: 'world' },
      ]);
      expect(Array.from(loaded!.vectors)).toEqual([
        Math.fround(0.1),
        Math.fround(0.2),
        Math.fround(0.3),
        Math.fround(0.4),
        Math.fround(0.5),
        Math.fround(0.6),
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('appending preserves existing data', async () => {
    const dir = await makeDir();
    try {
      await appendStore(dir, [{ id: 'a', source: '/x', content: 'one' }], [[1, 0, 0]]);
      const r2 = await appendStore(
        dir,
        [{ id: 'b', source: '/x', content: 'two' }],
        [[0, 1, 0]],
      );
      expect(r2.total).toBe(2);
      const loaded = await loadStore(dir);
      expect(loaded!.chunks.map((c) => c.id)).toEqual(['a', 'b']);
      expect(Array.from(loaded!.vectors)).toEqual([1, 0, 0, 0, 1, 0]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('rejects dim mismatch on append', async () => {
    const dir = await makeDir();
    try {
      await appendStore(dir, [{ id: 'a', source: '/x', content: 'one' }], [[1, 0, 0]]);
      await expect(
        appendStore(dir, [{ id: 'b', source: '/x', content: 'two' }], [[1, 0]]),
      ).rejects.toThrow(/dim mismatch/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('empty append is a no-op', async () => {
    const dir = await makeDir();
    try {
      const r = await appendStore(dir, [], []);
      expect(r).toEqual({ added: 0, total: 0, dim: 0 });
      expect(await loadStore(dir)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test('defaultRagDir honors KOKKO_RAG_DIR', () => {
    const prev = process.env.KOKKO_RAG_DIR;
    try {
      process.env.KOKKO_RAG_DIR = '/tmp/some-dir';
      expect(defaultRagDir()).toBe('/tmp/some-dir');
      delete process.env.KOKKO_RAG_DIR;
      expect(defaultRagDir('/proj')).toBe('/proj/.kokko/rag');
    } finally {
      if (prev === undefined) delete process.env.KOKKO_RAG_DIR;
      else process.env.KOKKO_RAG_DIR = prev;
    }
  });
});
